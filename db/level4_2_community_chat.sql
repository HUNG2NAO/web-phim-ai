-- AI FILM NETWORK — Level 4.2: Community Chat (áp SAU level4_rewards_unlock_social_v1.sql và level4_1).
-- Phòng: "network" (chung toàn mạng 5 site) và "film:<site>:<film_id>" (bàn luận theo phim).
-- Chỉ thành viên đã đăng nhập đọc/gửi. Gửi tin CHỈ qua hàm send_chat_message (không INSERT trực tiếp):
--   * tên người gửi lấy từ hồ sơ trên máy chủ → không giả mạo được;
--   * nội dung 1–500 ký tự, không ký tự điều khiển; hiển thị luôn bằng textContent (không HTML);
--   * giới hạn 5 tin / 30 giây / người, chặn tin trùng lặp trong 60 giây;
--   * người bị khóa chat không gửi được.
-- Kiểm duyệt (ẩn/khôi phục tin, khóa/mở chat, xử lý báo cáo) chỉ cho quản trị viên; mọi thao tác ghi admin_audit_log.
-- Realtime: bảng chat_messages được thêm vào publication supabase_realtime (Realtime vẫn áp dụng RLS).
-- Additive & idempotent. Gỡ: db/staging/99_rollback_level4.sql.
begin;

create or replace function private.chat_room_site(p_room text) returns text
language sql immutable set search_path = pg_catalog as $$
  select case when p_room = 'network' then null else split_part(p_room, ':', 2) end
$$;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room text not null check (room = 'network'
    or room ~ '^film:(xuongphim|khophim|phephim|phimhay|ghienphim):[a-z0-9][a-z0-9-]{0,119}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  hidden boolean not null default false,
  hidden_by uuid,
  hidden_at timestamptz
);
create index if not exists chat_messages_room_time on public.chat_messages(room, created_at desc);
create index if not exists chat_messages_user_time on public.chat_messages(user_id, created_at desc);

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  reporter uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','spoiler','inappropriate','other')),
  note text not null default '' check (char_length(note) <= 300),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  handled_by uuid,
  handled_at timestamptz,
  unique (message_id, reporter)
);
create index if not exists chat_reports_status on public.chat_reports(status, created_at desc);
create index if not exists chat_reports_reporter on public.chat_reports(reporter);

create table if not exists public.chat_mutes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  muted_until timestamptz,                      -- null = khóa đến khi được mở
  reason text not null check (char_length(reason) between 3 and 300),
  muted_by uuid not null,
  created_at timestamptz not null default now()
);

-- Ai được kiểm duyệt phòng nào: chủ mạng; phòng phim → nhân sự site đó; phòng chung → quản trị viên bất kỳ site.
create or replace function private.can_moderate_room(p_room text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select private.is_network_admin()
    or (p_room <> 'network' and private.is_site_staff(private.chat_room_site(p_room)))
    or (p_room = 'network' and exists (select 1 from public.site_staff where user_id = auth.uid() and role = 'admin'))
$$;
create or replace function private.is_chat_moderator() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select private.is_network_admin() or exists (select 1 from public.site_staff where user_id = auth.uid())
$$;

alter table public.chat_messages enable row level security;
alter table public.chat_reports enable row level security;
alter table public.chat_mutes enable row level security;
revoke all on public.chat_messages, public.chat_reports, public.chat_mutes from anon, authenticated;
grant select on public.chat_messages, public.chat_reports, public.chat_mutes to authenticated;

drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages for select to authenticated
  -- Policies must not call helpers of the private schema (the invoking role has no access); inline the moderator rules.
  using (not hidden or user_id = (select auth.uid())
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))
    or (room <> 'network' and exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.site_id = split_part(room, ':', 2)))
    or (room = 'network' and exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.role = 'admin')));
drop policy if exists chat_reports_read on public.chat_reports;
create policy chat_reports_read on public.chat_reports for select to authenticated
  using (reporter = (select auth.uid()) or (exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))
    or exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()))));
drop policy if exists chat_mutes_read on public.chat_mutes;
create policy chat_mutes_read on public.chat_mutes for select to authenticated
  using (user_id = (select auth.uid()) or (exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))
    or exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()))));

-- ---------------------------------------------------------------- viewer RPCs
create or replace function public.send_chat_message(p_room text, p_body text)
returns public.chat_messages language plpgsql security definer set search_path = pg_catalog, public as $$
declare uid uuid := auth.uid(); v_body text; v_name text; m public.chat_mutes; r public.chat_messages;
begin
  if uid is null then raise exception 'login_required' using errcode = '28000'; end if;
  if p_room is null or not (p_room = 'network'
     or p_room ~ '^film:(xuongphim|khophim|phephim|phimhay|ghienphim):[a-z0-9][a-z0-9-]{0,119}$') then
    raise exception 'invalid_room' using errcode = '22023';
  end if;
  v_body := btrim(regexp_replace(coalesce(p_body, ''), '[[:space:]]+', ' ', 'g'));
  if v_body ~ '[[:cntrl:]]' then raise exception 'invalid_message' using errcode = '22023'; end if;
  if char_length(v_body) < 1 then raise exception 'empty_message' using errcode = '22023'; end if;
  if char_length(v_body) > 500 then raise exception 'message_too_long' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chat:' || uid::text, 0));   -- serialise one user's sends
  select * into m from public.chat_mutes where user_id = uid;
  if found and (m.muted_until is null or m.muted_until > now()) then
    raise exception 'chat_muted' using errcode = '42501';
  end if;
  if (select count(*) from public.chat_messages where user_id = uid and created_at > now() - interval '30 seconds') >= 5 then
    raise exception 'chat_rate_limited' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.chat_messages where user_id = uid and room = p_room and body = v_body
             and created_at > now() - interval '60 seconds') then
    raise exception 'chat_duplicate' using errcode = 'P0001';
  end if;
  -- Tên hiển thị: hồ sơ (profiles) → tên đã nhập khi đăng ký (user_metadata) → "Thành viên". Không bao giờ dùng email.
  select left(coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), 'Thành viên'), 60)
    into v_name from auth.users u left join public.profiles p on p.id = u.id where u.id = uid;
  insert into public.chat_messages(room, user_id, display_name, body)
  values (p_room, uid, coalesce(v_name, 'Thành viên'), v_body) returning * into r;
  return r;
end $$;

create or replace function public.report_chat_message(p_message_id uuid, p_reason text, p_note text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare uid uuid := auth.uid(); msg public.chat_messages;
begin
  if uid is null then raise exception 'login_required' using errcode = '28000'; end if;
  select * into msg from public.chat_messages where id = p_message_id and not hidden;
  if not found then raise exception 'message_not_found' using errcode = 'P0002'; end if;
  if msg.user_id = uid then raise exception 'cannot_report_own' using errcode = '22023'; end if;
  if (select count(*) from public.chat_reports where reporter = uid and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'report_rate_limited' using errcode = 'P0001';
  end if;
  insert into public.chat_reports(message_id, reporter, reason, note)
  values (p_message_id, uid, coalesce(nullif(p_reason, ''), 'other'), left(coalesce(p_note, ''), 300))
  on conflict (message_id, reporter) do nothing;
  return jsonb_build_object('status', 'reported');
end $$;

-- ---------------------------------------------------------------- moderation RPCs (audited)
create or replace function public.chat_moderate_message(p_message_id uuid, p_hide boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare msg public.chat_messages;
begin
  select * into msg from public.chat_messages where id = p_message_id;
  if not found then raise exception 'message_not_found' using errcode = 'P0002'; end if;
  if not private.can_moderate_room(msg.room) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  update public.chat_messages set hidden = p_hide, hidden_by = case when p_hide then auth.uid() end,
    hidden_at = case when p_hide then now() end where id = msg.id;
  update public.chat_reports set status = 'resolved', handled_by = auth.uid(), handled_at = now()
    where message_id = msg.id and status = 'open';
  perform private.audit(private.chat_room_site(msg.room), case when p_hide then 'chat.hide' else 'chat.restore' end,
    msg.room || ' #' || msg.id, jsonb_build_object('author', msg.user_id, 'reason', left(btrim(p_reason), 300)));
  return jsonb_build_object('status', case when p_hide then 'hidden' else 'restored' end);
end $$;

create or replace function public.chat_dismiss_report(p_report_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare rep public.chat_reports; msg public.chat_messages;
begin
  select * into rep from public.chat_reports where id = p_report_id;
  if not found then raise exception 'report_not_found' using errcode = 'P0002'; end if;
  select * into msg from public.chat_messages where id = rep.message_id;
  if not private.can_moderate_room(msg.room) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.chat_reports set status = 'dismissed', handled_by = auth.uid(), handled_at = now() where id = rep.id;
  perform private.audit(private.chat_room_site(msg.room), 'chat.report_dismiss', rep.id::text, '{}'::jsonb);
  return jsonb_build_object('status', 'dismissed');
end $$;

create or replace function public.chat_set_mute(p_user uuid, p_minutes integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  -- Khóa chat có hiệu lực toàn mạng → chỉ chủ mạng hoặc quản trị viên site (không phải moderator).
  if not (private.is_network_admin() or exists (select 1 from public.site_staff where user_id = auth.uid() and role = 'admin')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = auth.uid() then raise exception 'cannot_mute_self' using errcode = '22023'; end if;
  if exists (select 1 from public.network_staff where user_id = p_user) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_minutes is null or p_minutes = 0 then                       -- 0 = mở khóa
    delete from public.chat_mutes where user_id = p_user;
    perform private.audit(null, 'chat.unmute', p_user::text, jsonb_build_object('reason', left(btrim(coalesce(p_reason, '')), 300)));
    return jsonb_build_object('status', 'unmuted');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  if p_minutes < -1 or p_minutes > 525600 then raise exception 'invalid_duration' using errcode = '22023'; end if;
  insert into public.chat_mutes(user_id, muted_until, reason, muted_by)
  values (p_user, case when p_minutes = -1 then null else now() + make_interval(mins => p_minutes) end, left(btrim(p_reason), 300), auth.uid())
  on conflict (user_id) do update set muted_until = excluded.muted_until, reason = excluded.reason, muted_by = excluded.muted_by, created_at = now();
  perform private.audit(null, 'chat.mute', p_user::text, jsonb_build_object('minutes', p_minutes, 'reason', left(btrim(p_reason), 300)));
  return jsonb_build_object('status', 'muted');
end $$;

-- Danh sách báo cáo kèm nội dung tin (cho Dashboard), chỉ trong phạm vi được kiểm duyệt.
create or replace function public.admin_chat_reports(p_status text)
returns table(report_id uuid, message_id uuid, room text, author uuid, author_name text, body text, hidden boolean,
  reason text, note text, status text, reports bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not private.is_chat_moderator() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select r.id, m.id, m.room, m.user_id, m.display_name, m.body, m.hidden, r.reason, r.note, r.status,
    count(*) over (partition by m.id), r.created_at
  from public.chat_reports r join public.chat_messages m on m.id = r.message_id
  where (p_status is null or r.status = p_status) and private.can_moderate_room(m.room)
  order by r.created_at desc limit 200;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.send_chat_message(text, text) from public, anon;
revoke all on function public.report_chat_message(uuid, text, text) from public, anon;
revoke all on function public.chat_moderate_message(uuid, boolean, text) from public, anon;
revoke all on function public.chat_dismiss_report(uuid) from public, anon;
revoke all on function public.chat_set_mute(uuid, integer, text) from public, anon;
revoke all on function public.admin_chat_reports(text) from public, anon;
grant execute on function public.send_chat_message(text, text) to authenticated;
grant execute on function public.report_chat_message(uuid, text, text) to authenticated;
grant execute on function public.chat_moderate_message(uuid, boolean, text) to authenticated;
grant execute on function public.chat_dismiss_report(uuid) to authenticated;
grant execute on function public.chat_set_mute(uuid, integer, text) to authenticated;
grant execute on function public.admin_chat_reports(text) to authenticated;

-- Realtime (chỉ có trên Supabase; CSDL test cục bộ không có publication này thì bỏ qua).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
end $$;

comment on table public.chat_messages is 'Community chat. Insert only via send_chat_message(); author name taken from profiles server-side.';
commit;
