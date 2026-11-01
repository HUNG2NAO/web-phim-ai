-- AI FILM NETWORK — Level 4.4: công tắc Community Chat phía máy chủ, cấu hình theo từng website.
-- Additive & idempotent. Gỡ: db/staging/97_rollback_level4_4.sql (đưa về đúng Level 4.3). Không xóa dữ liệu chat.
--
-- Phạm vi (scope): 'network' = phòng chung toàn mạng; '<site_id>' = các phòng phim của website đó.
-- Khi một phạm vi ĐÓNG (enabled = false):
--   * Gửi tin (send_chat_message) và báo cáo tin (report_chat_message) bị chặn ở máy chủ bằng trigger → lỗi 'chat_disabled'
--     (kể cả gọi API trực tiếp, kể cả quản trị viên — phòng đóng là đóng).
--   * Thành viên KHÔNG đọc được tin của phòng đó (RLS) → Realtime cũng không đẩy tin (Realtime tuân thủ RLS).
--   * Kiểm duyệt vẫn hoạt động cho nhân sự có quyền (đọc, ẩn/khôi phục, bỏ qua báo cáo, khóa/mở khóa) để dọn nội dung.
--   * Dữ liệu được giữ nguyên; mở lại là thấy lại.
-- Ai được đổi:
--   * MỞ một phạm vi: chỉ chủ mạng (quyết định pháp lý/kinh doanh).
--   * ĐÓNG: chủ mạng; quản trị viên website đóng phòng phim của website mình; quản trị viên bất kỳ đóng phòng chung (khẩn cấp).
--   * Mọi thay đổi bắt buộc có lý do và ghi admin_audit_log.
-- Phạm vi không có trong bảng → coi như ĐÓNG (an toàn mặc định).
begin;

create table if not exists public.chat_settings (
  scope text primary key check (scope in ('network', 'xuongphim', 'khophim', 'phephim', 'phimhay', 'ghienphim')),
  enabled boolean not null default true,
  reason text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
-- Giữ nguyên hành vi đã nghiệm thu trên Preview: mọi phạm vi đang mở.
insert into public.chat_settings(scope) values ('network'), ('xuongphim'), ('khophim'), ('phephim'), ('phimhay'), ('ghienphim')
  on conflict (scope) do nothing;
alter table public.chat_settings enable row level security;
revoke all on public.chat_settings from anon, authenticated;
grant select on public.chat_settings to anon, authenticated;
drop policy if exists chat_settings_read on public.chat_settings;
create policy chat_settings_read on public.chat_settings for select to anon, authenticated using (true);

create or replace function private.chat_scope(p_room text) returns text
language sql immutable set search_path = pg_catalog as $$
  select case when p_room = 'network' then 'network' else split_part(p_room, ':', 2) end
$$;
create or replace function private.chat_open(p_room text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce((select enabled from public.chat_settings where scope = private.chat_scope(p_room)), false)
$$;

-- Chặn ở tầng dữ liệu: áp cho MỌI đường ghi (RPC hiện tại, RPC tương lai, ghi trực tiếp nếu có).
create or replace function private.chat_guard_message() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not private.chat_open(new.room) then raise exception 'chat_disabled' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists chat_guard_message on public.chat_messages;
create trigger chat_guard_message before insert on public.chat_messages
  for each row execute function private.chat_guard_message();

create or replace function private.chat_guard_report() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_room text;
begin
  select room into v_room from public.chat_messages where id = new.message_id;
  if v_room is null or not private.chat_open(v_room) then raise exception 'chat_disabled' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists chat_guard_report on public.chat_reports;
create trigger chat_guard_report before insert on public.chat_reports
  for each row execute function private.chat_guard_report();

-- Đọc: thành viên chỉ thấy tin của phạm vi đang mở; nhân sự kiểm duyệt giữ nguyên quyền như Level 4.2.
drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages for select to authenticated
  using (
    (((not hidden) or user_id = (select auth.uid()))
      and exists (select 1 from public.chat_settings cs
                  where cs.scope = (case when chat_messages.room = 'network' then 'network' else split_part(chat_messages.room, ':', 2) end)
                    and cs.enabled))
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))
    or (room <> 'network' and exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.site_id = split_part(room, ':', 2)))
    or (room = 'network' and exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.role = 'admin')));

create or replace function public.admin_set_chat_enabled(p_scope text, p_enabled boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
  v_owner boolean := private.is_network_admin();
  v_row public.chat_settings;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_scope not in ('network', 'xuongphim', 'khophim', 'phephim', 'phimhay', 'ghienphim') then
    raise exception 'invalid_scope' using errcode = '22023';
  end if;
  if p_enabled is null then raise exception 'invalid_value' using errcode = '22023'; end if;
  if char_length(v_reason) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  if p_enabled and not v_owner then raise exception 'forbidden' using errcode = '42501'; end if;     -- chỉ chủ mạng được MỞ
  if not p_enabled and not v_owner and not (
       (p_scope <> 'network' and private.is_site_admin(p_scope))
    or (p_scope = 'network' and exists (select 1 from public.site_staff where user_id = auth.uid() and role = 'admin'))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.chat_settings(scope, enabled, reason, updated_at, updated_by)
  values (p_scope, p_enabled, v_reason, now(), auth.uid())
  on conflict (scope) do update set enabled = excluded.enabled, reason = excluded.reason, updated_at = now(), updated_by = auth.uid()
  returning * into v_row;
  perform private.audit(case when p_scope = 'network' then null else p_scope end,
    case when p_enabled then 'chat.enable' else 'chat.disable' end, p_scope, jsonb_build_object('reason', v_reason));
  return jsonb_build_object('scope', v_row.scope, 'enabled', v_row.enabled, 'reason', v_row.reason, 'updated_at', v_row.updated_at);
end $$;

revoke all on function public.admin_set_chat_enabled(text, boolean, text) from public, anon;
grant execute on function public.admin_set_chat_enabled(text, boolean, text) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

comment on table public.chat_settings is 'Công tắc Community Chat theo phạm vi (network | site_id). Đóng = chặn gửi/báo cáo (trigger) + ẩn tin với thành viên (RLS). Không xóa dữ liệu.';
commit;
