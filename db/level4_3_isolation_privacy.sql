-- AI FILM NETWORK — Level 4.3: cách ly quản trị theo website + quy trình yêu cầu quyền riêng tư.
-- Additive & idempotent. Gỡ: db/staging/98_rollback_level4_3.sql (đưa về đúng Level 4.2).
--
-- 1. Báo cáo chat: quản trị viên chỉ đọc báo cáo của tin thuộc phòng mình được quyền kiểm duyệt
--    (phòng phim → nhân sự đúng website; phòng chung → quản trị viên; chủ mạng → tất cả). Người báo cáo đọc báo cáo của mình.
-- 2. Danh sách khóa chat: chỉ người bị khóa, chủ mạng và quản trị viên (role admin) — không còn mở cho mọi nhân sự.
-- 3. Yêu cầu quyền riêng tư:
--    - Bản ghi yêu cầu không còn bị xóa dây chuyền khi xóa tài khoản (user_id → NULL, giữ subject_id bút danh) để chứng minh đã xử lý.
--    - Mỗi người chỉ có 1 yêu cầu đang mở cho mỗi loại.
--    - Quản trị viên đổi trạng thái qua RPC (kiểm tra chuyển trạng thái, ghi nhật ký, gửi thông báo cho thành viên),
--      không còn UPDATE thẳng vào bảng.
--    - Thực thi xóa tài khoản: CHỈ chủ mạng, phải ở trạng thái in_review, phải gõ đúng email, mặc định chạy thử (dry run).
-- 4. Tài khoản đã đăng phim/tập vẫn xóa được (created_by → NULL thay vì chặn).
-- 5. my_data_export(): thành viên tự tải toàn bộ dữ liệu của mình (kể cả ví, sổ điểm, chat).
begin;

-- 1–2. Cách ly đọc báo cáo / khóa chat ---------------------------------------------------------
drop policy if exists chat_reports_read on public.chat_reports;
create policy chat_reports_read on public.chat_reports for select to authenticated
  using (
    reporter = (select auth.uid())
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))
    or exists (
      select 1 from public.chat_messages m
      where m.id = chat_reports.message_id
        and ((m.room <> 'network' and exists (select 1 from public.site_staff s
                where s.user_id = (select auth.uid()) and s.site_id = split_part(m.room, ':', 2)))
          or (m.room = 'network' and exists (select 1 from public.site_staff s
                where s.user_id = (select auth.uid()) and s.role = 'admin')))));

drop policy if exists chat_mutes_read on public.chat_mutes;
create policy chat_mutes_read on public.chat_mutes for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))
    or exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.role = 'admin'));

-- 3. Yêu cầu quyền riêng tư -------------------------------------------------------------------
alter table public.member_privacy_requests add column if not exists subject_id uuid;
alter table public.member_privacy_requests add column if not exists handled_by uuid;
update public.member_privacy_requests set subject_id = user_id where subject_id is null and user_id is not null;
alter table public.member_privacy_requests alter column user_id drop not null;
do $$ declare c text; begin
  for c in select conname from pg_constraint
           where conrelid = 'public.member_privacy_requests'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass loop
    execute format('alter table public.member_privacy_requests drop constraint %I', c);
  end loop;
end $$;
alter table public.member_privacy_requests add constraint member_privacy_requests_user_fk
  foreign key (user_id) references auth.users(id) on delete set null;

create or replace function private.privacy_request_subject() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  new.subject_id := new.user_id;   -- bút danh cố định, không đổi theo client
  new.handled_by := null;
  return new;
end $$;
drop trigger if exists privacy_request_subject on public.member_privacy_requests;
create trigger privacy_request_subject before insert on public.member_privacy_requests
  for each row execute function private.privacy_request_subject();

create unique index if not exists privacy_requests_one_open
  on public.member_privacy_requests(subject_id, request_type) where status in ('pending', 'in_review');

-- Không còn UPDATE thẳng: mọi thay đổi trạng thái đi qua RPC bên dưới.
revoke update on public.member_privacy_requests from authenticated;
drop policy if exists privacy_manage_by_staff on public.member_privacy_requests;
drop policy if exists privacy_read_own_or_staff on public.member_privacy_requests;
create policy privacy_read_own_or_staff on public.member_privacy_requests for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))
    or exists (select 1 from public.site_staff s where s.user_id = (select auth.uid())
                 and s.site_id = member_privacy_requests.site_id and s.role = 'admin'));

create or replace function public.admin_privacy_request_set_status(p_id uuid, p_status text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  r public.member_privacy_requests;
  v_note text := left(btrim(coalesce(p_note, '')), 500);
  v_kind text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into r from public.member_privacy_requests where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not private.is_site_admin(r.site_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not ((r.status = 'pending' and p_status in ('in_review', 'rejected'))
       or (r.status = 'in_review' and p_status in ('completed', 'rejected'))) then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  if p_status = 'completed' and r.request_type = 'delete_account' then
    raise exception 'use_account_deletion' using errcode = '22023';
  end if;
  if p_status = 'rejected' and char_length(v_note) < 5 then raise exception 'note_required' using errcode = '22023'; end if;

  update public.member_privacy_requests
     set status = p_status, handled_by = auth.uid(), admin_note = v_note,
         handled_at = case when p_status in ('completed', 'rejected') then now() else null end
   where id = p_id;
  perform private.audit(r.site_id, 'privacy.' || p_status, p_id::text,
    jsonb_build_object('type', r.request_type, 'from', r.status, 'subject', r.subject_id));

  if r.user_id is not null then
    v_kind := case r.request_type when 'delete_account' then 'xóa tài khoản'
                                  when 'data_export' then 'xuất dữ liệu' else 'xóa lịch sử hoạt động' end;
    insert into public.member_notifications(user_id, site_id, title, body, event_key)
    values (r.user_id, r.site_id,
      case p_status when 'in_review' then 'Yêu cầu ' || v_kind || ' đang được xử lý'
                    when 'completed' then 'Yêu cầu ' || v_kind || ' đã hoàn tất'
                    else 'Yêu cầu ' || v_kind || ' chưa được chấp thuận' end,
      case when v_note <> '' then 'Ghi chú của quản trị viên: ' || v_note else '' end,
      'privacy:' || p_id || ':' || p_status)
    on conflict do nothing;
  end if;
  return jsonb_build_object('id', p_id, 'status', p_status);
end $$;

-- Thực thi xóa tài khoản. Mặc định p_dry_run = true: chỉ trả về số bản ghi sẽ bị xóa, không ghi gì.
create or replace function public.admin_execute_account_deletion(p_request_id uuid, p_confirm_email text, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  r public.member_privacy_requests;
  v_user uuid;
  v_email text;
  v_counts jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.network_staff where user_id = auth.uid() and role = 'owner') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.member_privacy_requests where id = p_request_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.request_type <> 'delete_account' then raise exception 'invalid_type' using errcode = '22023'; end if;
  if r.status <> 'in_review' then raise exception 'invalid_state' using errcode = '22023'; end if;
  v_user := r.user_id;
  if v_user is null then raise exception 'already_deleted' using errcode = '22023'; end if;
  select email into v_email from auth.users where id = v_user;
  if not coalesce(p_dry_run, true) and (v_email is null or lower(btrim(coalesce(p_confirm_email, ''))) <> lower(v_email)) then
    raise exception 'email_mismatch' using errcode = '22023';
  end if;
  if v_user = auth.uid() or exists (select 1 from public.network_staff where user_id = v_user) then
    raise exception 'cannot_delete_owner' using errcode = '42501';
  end if;
  if exists (select 1 from public.site_staff where user_id = v_user) then
    raise exception 'target_is_staff' using errcode = '22023';   -- gỡ quyền quản trị trước, có nhật ký riêng
  end if;

  v_counts := jsonb_build_object(
    'viewer_profiles',      (select count(*) from public.viewer_profiles where user_id = v_user),
    'watch_progress',       (select count(*) from public.watch_progress where user_id = v_user),
    'film_reviews',         (select count(*) from public.film_reviews where user_id = v_user),
    'wallet_ledger',        (select count(*) from public.wallet_ledger where user_id = v_user),
    'daily_checkins',       (select count(*) from public.daily_checkins where user_id = v_user),
    'content_entitlements', (select count(*) from public.content_entitlements where user_id = v_user),
    'chat_messages',        (select count(*) from public.chat_messages where user_id = v_user),
    'chat_reports',         (select count(*) from public.chat_reports where reporter = v_user),
    'member_notifications', (select count(*) from public.member_notifications where user_id = v_user),
    'privacy_requests_kept_pseudonymous', (select count(*) from public.member_privacy_requests where user_id = v_user));
  if coalesce(p_dry_run, true) then
    -- Email che một phần để chủ mạng đối chiếu; bước xóa thật vẫn phải gõ đúng toàn bộ email.
    return jsonb_build_object('status', 'dry_run', 'counts', v_counts,
      'email_hint', left(split_part(v_email, '@', 1), 2) || '***@' || split_part(v_email, '@', 2));
  end if;

  update public.member_privacy_requests
     set status = 'completed', handled_at = now(), handled_by = auth.uid(),
         admin_note = case when id = p_request_id then 'Đã xóa tài khoản và dữ liệu liên quan' else 'Đóng do tài khoản đã bị xóa' end
   where subject_id = v_user and status in ('pending', 'in_review');
  perform private.audit(r.site_id, 'privacy.account_deleted', p_request_id::text,
    jsonb_build_object('subject', v_user, 'counts', v_counts));
  delete from auth.users where id = v_user;
  return jsonb_build_object('status', 'deleted', 'counts', v_counts);
end $$;

-- 4. Tài khoản tạo phim/tập vẫn xóa được ------------------------------------------------------
alter table public.site_films alter column created_by drop not null;
alter table public.site_episodes alter column created_by drop not null;
do $$ declare t text; c text; begin
  foreach t in array array['site_films', 'site_episodes'] loop
    for c in select con.conname from pg_constraint con
              join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
             where con.conrelid = ('public.' || t)::regclass and con.contype = 'f'
               and con.confrelid = 'auth.users'::regclass and a.attname = 'created_by' loop
      execute format('alter table public.%I drop constraint %I', t, c);
    end loop;
    execute format('alter table public.%I add constraint %I foreign key (created_by) references auth.users(id) on delete set null',
                   t, t || '_created_by_fk');
  end loop;
end $$;

-- 5. Tự xuất toàn bộ dữ liệu của chính mình ---------------------------------------------------
create or replace function public.my_data_export() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', id, 'email', email, 'created_at', created_at, 'email_confirmed_at', email_confirmed_at)
                  from auth.users where id = u),
    'profiles',             coalesce((select jsonb_agg(to_jsonb(t)) from public.profiles t where t.id = u), '[]'),
    'site_memberships',     coalesce((select jsonb_agg(to_jsonb(t)) from public.site_memberships t where t.user_id = u), '[]'),
    'viewer_profiles',      coalesce((select jsonb_agg(to_jsonb(t)) from public.viewer_profiles t where t.user_id = u), '[]'),
    'viewer_preferences',   coalesce((select jsonb_agg(to_jsonb(t)) from public.viewer_preferences t where t.user_id = u), '[]'),
    'film_library',         coalesce((select jsonb_agg(to_jsonb(t)) from public.film_library t where t.user_id = u), '[]'),
    'watch_progress',       coalesce((select jsonb_agg(to_jsonb(t)) from public.watch_progress t where t.user_id = u), '[]'),
    'film_reviews',         coalesce((select jsonb_agg(to_jsonb(t)) from public.film_reviews t where t.user_id = u), '[]'),
    'member_notifications', coalesce((select jsonb_agg(to_jsonb(t)) from public.member_notifications t where t.user_id = u), '[]'),
    'wallet',               (select to_jsonb(t) from public.wallets t where t.user_id = u),
    'wallet_ledger',        coalesce((select jsonb_agg(to_jsonb(t) - 'actor' order by t.id) from public.wallet_ledger t where t.user_id = u), '[]'),
    'daily_checkins',       coalesce((select jsonb_agg(to_jsonb(t)) from public.daily_checkins t where t.user_id = u), '[]'),
    'content_entitlements', coalesce((select jsonb_agg(to_jsonb(t)) from public.content_entitlements t where t.user_id = u), '[]'),
    'chat_messages',        coalesce((select jsonb_agg(to_jsonb(t) - 'hidden_by' order by t.created_at) from public.chat_messages t where t.user_id = u), '[]'),
    'chat_reports_sent',    coalesce((select jsonb_agg(jsonb_build_object('message_id', t.message_id, 'reason', t.reason, 'note', t.note, 'status', t.status, 'created_at', t.created_at)) from public.chat_reports t where t.reporter = u), '[]'),
    'chat_mutes',           coalesce((select jsonb_agg(to_jsonb(t) - 'muted_by') from public.chat_mutes t where t.user_id = u), '[]'),
    'privacy_requests',     coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'site_id', t.site_id, 'request_type', t.request_type, 'status', t.status, 'submitted_at', t.submitted_at, 'handled_at', t.handled_at, 'admin_note', t.admin_note)) from public.member_privacy_requests t where t.user_id = u), '[]'));
end $$;

revoke all on function public.admin_privacy_request_set_status(uuid, text, text) from public, anon;
revoke all on function public.admin_execute_account_deletion(uuid, text, boolean) from public, anon;
revoke all on function public.my_data_export() from public, anon;
grant execute on function public.admin_privacy_request_set_status(uuid, text, text) to authenticated;
grant execute on function public.admin_execute_account_deletion(uuid, text, boolean) to authenticated;
grant execute on function public.my_data_export() to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

commit;
