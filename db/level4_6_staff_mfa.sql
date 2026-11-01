-- AI FILM NETWORK — Level 4.6: xác thực 2 lớp (TOTP) cho nhân sự + tăng cứng quyền đợt 2.
-- SINH TỰ ĐỘNG bởi tools/gen/gen_level4_6.py — không sửa tay. Additive & idempotent. Gỡ: db/staging/95_rollback_level4_6.sql
--
-- A. MFA nhân sự (mẫu khuyến nghị của Supabase, KHÔNG khóa tài khoản nào):
--    * Nhân sự đã đăng ký 2FA (factor 'verified') → mọi quyền quản trị cần phiên AAL2 (đã nhập mã 6 số).
--    * Nhân sự chưa đăng ký → vẫn làm việc như cũ, cho tới khi CHỦ MẠNG bật "bắt buộc 2FA cho nhân sự".
--    * Khi chưa đạt điều kiện, nhân sự chỉ mất quyền QUẢN TRỊ (như thành viên thường), vẫn đăng nhập/xem phim/ví bình thường.
--    * Áp ở 3 lớp: hàm kiểm quyền private.is_* (mọi RPC quản trị), RPC kiểm quyền trực tiếp, policy RESTRICTIVE (REST + Realtime).
--    * Xóa tài khoản thật (admin_execute_account_deletion, p_dry_run=false) luôn cần AAL2.
-- B. Quyền: thu hồi quyền trên sequence của anon/authenticated (setval/nextval), TRUNCATE của service_role,
--    mặc định không cấp EXECUTE hàm mới cho anon; hàm private.dangerous_grants() để giám sát.
begin;

create table if not exists private.security_settings (
  id boolean primary key default true check (id),
  staff_mfa_required boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into private.security_settings(id) values (true) on conflict do nothing;
revoke all on private.security_settings from public, anon, authenticated;

create table if not exists private.grant_hardening_log2 (
  kind text not null, object_name text not null, grantee text not null, privilege text not null,
  revoked_at timestamptz not null default now(), primary key (kind, object_name, grantee, privilege)
);
revoke all on private.grant_hardening_log2 from public, anon, authenticated;

-- ------------------------------------------------------------------ A. MFA
create or replace function private.has_verified_factor(p_user uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (select 1 from auth.mfa_factors f where f.user_id = p_user and f.status::text = 'verified')
$$;
-- Phiên hiện tại đủ điều kiện 2FA để dùng quyền quản trị?
create or replace function private.mfa_ok() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or (not private.has_verified_factor(auth.uid())
          and not coalesce((select staff_mfa_required from private.security_settings where id), false))
$$;
create or replace function private.is_network_admin() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select private.mfa_ok() and exists (select 1 from public.network_staff where user_id = auth.uid())
$$;
create or replace function private.is_network_owner() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select private.mfa_ok() and exists (select 1 from public.network_staff where user_id = auth.uid() and role = 'owner')
$$;
create or replace function private.is_site_admin(p_site text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select private.is_network_admin() or (private.mfa_ok() and exists (
    select 1 from public.site_staff where user_id = auth.uid() and site_id = p_site and role = 'admin'))
$$;
create or replace function private.is_site_staff(p_site text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select private.is_network_admin() or (private.mfa_ok() and exists (
    select 1 from public.site_staff where user_id = auth.uid() and site_id = p_site))
$$;
create or replace function private.is_any_site_admin() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select private.mfa_ok() and exists (select 1 from public.site_staff where user_id = auth.uid() and role = 'admin')
$$;
create or replace function private.can_moderate_room(p_room text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select private.is_network_admin()
    or (p_room <> 'network' and private.is_site_staff(private.chat_room_site(p_room)))
    or (p_room = 'network' and private.is_any_site_admin())
$$;
create or replace function private.is_chat_moderator() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select private.is_network_admin() or (private.mfa_ok() and exists (select 1 from public.site_staff where user_id = auth.uid()))
$$;

-- Cổng dùng trong policy RESTRICTIVE (policy không gọi được schema private): true nếu không phải nhân sự, hoặc nhân sự đạt 2FA.
create or replace function public.afn_staff_gate() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select not (exists (select 1 from public.network_staff where user_id = auth.uid())
           or exists (select 1 from public.site_staff where user_id = auth.uid()))
      or private.mfa_ok()
$$;
revoke all on function public.afn_staff_gate() from public, anon;
grant execute on function public.afn_staff_gate() to authenticated;

drop policy if exists mfa_gate_select on public.admin_audit_log;
create policy mfa_gate_select on public.admin_audit_log as restrictive for select to authenticated using ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_select on public.chat_messages;
create policy mfa_gate_select on public.chat_messages as restrictive for select to authenticated using (not hidden or user_id = (select auth.uid()) or (select public.afn_staff_gate()));
drop policy if exists mfa_gate_select on public.chat_mutes;
create policy mfa_gate_select on public.chat_mutes as restrictive for select to authenticated using (user_id = (select auth.uid()) or (select public.afn_staff_gate()));
drop policy if exists mfa_gate_select on public.chat_reports;
create policy mfa_gate_select on public.chat_reports as restrictive for select to authenticated using (reporter = (select auth.uid()) or (select public.afn_staff_gate()));
drop policy if exists mfa_gate_select on public.content_reports;
create policy mfa_gate_select on public.content_reports as restrictive for select to authenticated using (user_id = (select auth.uid()) or (select public.afn_staff_gate()));
drop policy if exists mfa_gate_update on public.content_reports;
create policy mfa_gate_update on public.content_reports as restrictive for update to authenticated using ((select public.afn_staff_gate())) with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_select on public.episode_sources;
create policy mfa_gate_select on public.episode_sources as restrictive for select to authenticated using ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_insert on public.episode_sources;
create policy mfa_gate_insert on public.episode_sources as restrictive for insert to authenticated with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_update on public.episode_sources;
create policy mfa_gate_update on public.episode_sources as restrictive for update to authenticated using ((select public.afn_staff_gate())) with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_delete on public.episode_sources;
create policy mfa_gate_delete on public.episode_sources as restrictive for delete to authenticated using ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_select on public.film_reviews;
create policy mfa_gate_select on public.film_reviews as restrictive for select to authenticated using (user_id = (select auth.uid()) or (select public.afn_staff_gate()));
drop policy if exists mfa_gate_update on public.film_reviews;
create policy mfa_gate_update on public.film_reviews as restrictive for update to authenticated using ((select public.afn_staff_gate())) with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_insert on public.member_notifications;
create policy mfa_gate_insert on public.member_notifications as restrictive for insert to authenticated with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_select on public.member_privacy_requests;
create policy mfa_gate_select on public.member_privacy_requests as restrictive for select to authenticated using (user_id = (select auth.uid()) or (select public.afn_staff_gate()));
drop policy if exists mfa_gate_select on public.site_episodes;
create policy mfa_gate_select on public.site_episodes as restrictive for select to authenticated using (published or (select public.afn_staff_gate()));
drop policy if exists mfa_gate_insert on public.site_episodes;
create policy mfa_gate_insert on public.site_episodes as restrictive for insert to authenticated with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_update on public.site_episodes;
create policy mfa_gate_update on public.site_episodes as restrictive for update to authenticated using ((select public.afn_staff_gate())) with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_delete on public.site_episodes;
create policy mfa_gate_delete on public.site_episodes as restrictive for delete to authenticated using ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_select on public.site_films;
create policy mfa_gate_select on public.site_films as restrictive for select to authenticated using (published or (select public.afn_staff_gate()));
drop policy if exists mfa_gate_insert on public.site_films;
create policy mfa_gate_insert on public.site_films as restrictive for insert to authenticated with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_update on public.site_films;
create policy mfa_gate_update on public.site_films as restrictive for update to authenticated using ((select public.afn_staff_gate())) with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_delete on public.site_films;
create policy mfa_gate_delete on public.site_films as restrictive for delete to authenticated using ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_select on public.site_memberships;
create policy mfa_gate_select on public.site_memberships as restrictive for select to authenticated using (user_id = (select auth.uid()) or (select public.afn_staff_gate()));
drop policy if exists mfa_gate_select on public.site_social_links;
create policy mfa_gate_select on public.site_social_links as restrictive for select to authenticated using (enabled or (select public.afn_staff_gate()));
drop policy if exists mfa_gate_insert on public.site_social_links;
create policy mfa_gate_insert on public.site_social_links as restrictive for insert to authenticated with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_update on public.site_social_links;
create policy mfa_gate_update on public.site_social_links as restrictive for update to authenticated using ((select public.afn_staff_gate())) with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_delete on public.site_social_links;
create policy mfa_gate_delete on public.site_social_links as restrictive for delete to authenticated using ((select public.afn_staff_gate()));

-- RPC kiểm quyền trực tiếp (sinh từ bản hiện hành, chỉ thay điều kiện kiểm quyền người gọi)
create or replace function public.admin_execute_account_deletion(p_request_id uuid, p_confirm_email text, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  r public.member_privacy_requests;
  v_user uuid;
  v_email text;
  v_counts jsonb;
begin
  if auth.uid() is null or not private.is_network_owner() then
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
  -- Level 4.6: xóa thật luôn cần phiên đã xác thực 2 lớp (AAL2), kể cả khi chưa bật bắt buộc 2FA.
  if not coalesce(p_dry_run, true) and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
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
    or (p_scope = 'network' and private.is_any_site_admin())) then
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

create or replace function public.chat_set_mute(p_user uuid, p_minutes integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  -- Khóa chat có hiệu lực toàn mạng → chỉ chủ mạng hoặc quản trị viên site (không phải moderator).
  if not (private.is_network_admin() or private.is_any_site_admin()) then
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

-- Trạng thái bảo mật của chính người gọi (Studio dùng để nhắc đăng ký / nhập mã 2FA)
create or replace function public.my_security_status() returns jsonb
language sql stable security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'is_staff', exists (select 1 from public.network_staff where user_id = auth.uid())
             or exists (select 1 from public.site_staff where user_id = auth.uid()),
    'is_owner', exists (select 1 from public.network_staff where user_id = auth.uid() and role = 'owner'),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'has_factor', private.has_verified_factor(auth.uid()),
    'staff_mfa_required', coalesce((select staff_mfa_required from private.security_settings where id), false),
    'mfa_ok', private.mfa_ok())
$$;
-- Danh sách nhân sự và tình trạng 2FA (chỉ chủ mạng / quản trị mạng, phiên đạt 2FA)
create or replace function public.admin_staff_mfa_status()
returns table(user_id uuid, display_name text, scope text, role text, has_factor boolean)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not private.is_network_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select s.user_id, coalesce(p.display_name, ''), s.scope, s.role, private.has_verified_factor(s.user_id)
  from (select n.user_id, 'network'::text scope, n.role from public.network_staff n
        union all select st.user_id, st.site_id, st.role from public.site_staff st) s
  left join public.profiles p on p.id = s.user_id
  order by s.scope, s.role;
end $$;
-- Bật/tắt "bắt buộc 2FA cho nhân sự". Chỉ chủ mạng, đang ở phiên AAL2 và đã có factor → không thể tự khóa mình.
create or replace function public.admin_set_staff_mfa_required(p_required boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_reason text := left(btrim(coalesce(p_reason, '')), 300); v_missing int;
begin
  if not private.is_network_owner() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' or not private.has_verified_factor(auth.uid()) then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if p_required is null then raise exception 'invalid_value' using errcode = '22023'; end if;
  if char_length(v_reason) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  update private.security_settings set staff_mfa_required = p_required, updated_at = now(), updated_by = auth.uid() where id;
  select count(distinct s.user_id) into v_missing
    from (select n.user_id from public.network_staff n union all select st.user_id from public.site_staff st) s
   where not private.has_verified_factor(s.user_id);
  perform private.audit(null, case when p_required then 'security.mfa_required_on' else 'security.mfa_required_off' end,
    'staff', jsonb_build_object('reason', v_reason, 'staff_without_factor', v_missing));
  return jsonb_build_object('staff_mfa_required', p_required, 'staff_without_factor', v_missing);
end $$;
revoke all on function public.my_security_status() from public, anon;
revoke all on function public.admin_staff_mfa_status() from public, anon;
revoke all on function public.admin_set_staff_mfa_required(boolean, text) from public, anon;
grant execute on function public.my_security_status() to authenticated;
grant execute on function public.admin_staff_mfa_status() to authenticated;
grant execute on function public.admin_set_staff_mfa_required(boolean, text) to authenticated;

-- ------------------------------------------------------------------ B. Quyền đợt 2
do $$
declare r record;
begin
  -- B1. sequence: anon/authenticated không cần (cột identity tự cấp số; mọi ghi qua RPC/RLS) → thu hồi để chặn setval/nextval
  for r in select c.relname, g.grantee, g.privilege_type
             from pg_class c cross join lateral aclexplode(c.relacl) a
             join lateral (select pg_get_userbyid(a.grantee) grantee, a.privilege_type) g on true
            where c.relkind = 'S' and c.relnamespace = 'public'::regnamespace and g.grantee in ('anon', 'authenticated') loop
    execute format('revoke %s on sequence public.%I from %I', r.privilege_type, r.relname, r.grantee);
    insert into private.grant_hardening_log2 values ('sequence', r.relname, r.grantee, r.privilege_type) on conflict do nothing;
  end loop;
  -- B2. TRUNCATE của service_role (khóa máy chủ, ứng dụng không dùng; TRUNCATE xóa sạch bảng, không qua trigger/nhật ký)
  for r in select g.table_name from information_schema.role_table_grants g
            where g.table_schema = 'public' and g.grantee = 'service_role' and g.privilege_type = 'TRUNCATE' loop
    execute format('revoke truncate on public.%I from service_role', r.table_name);
    insert into private.grant_hardening_log2 values ('table', r.table_name, 'service_role', 'TRUNCATE') on conflict do nothing;
  end loop;
end $$;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate on tables from service_role;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- Giám sát: mọi quyền nguy hiểm còn tồn tại (kỳ vọng 0 dòng). Chỉ postgres gọi được.
create or replace function private.dangerous_grants()
returns table(object_name text, grantee text, privilege text, why text)
language sql stable security definer set search_path = pg_catalog, public as $$
  select g.table_name::text, g.grantee::text, g.privilege_type::text, 'TRUNCATE/TRIGGER/REFERENCES cho role API'
    from information_schema.role_table_grants g
   where g.table_schema in ('public', 'private') and g.grantee in ('anon', 'authenticated', 'PUBLIC')
     and g.privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
  union all
  select g.table_name::text, g.grantee::text, g.privilege_type::text, 'TRUNCATE cho service_role'
    from information_schema.role_table_grants g
   where g.table_schema = 'public' and g.grantee = 'service_role' and g.privilege_type = 'TRUNCATE'
  union all
  select g.table_name::text, g.grantee::text, g.privilege_type::text, 'quyền ghi không có policy tương ứng'
    from information_schema.role_table_grants g
   where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated') and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = g.table_name
                       and p.permissive = 'PERMISSIVE' and (p.cmd = g.privilege_type or p.cmd = 'ALL')
                       and (g.grantee::name = any(p.roles) or 'public' = any(p.roles)))
  union all
  select c.relname::text, pg_get_userbyid(a.grantee)::text, a.privilege_type, 'quyền trên sequence cho role API'
    from pg_class c cross join lateral aclexplode(c.relacl) a
   where c.relkind = 'S' and c.relnamespace = 'public'::regnamespace and pg_get_userbyid(a.grantee) in ('anon', 'authenticated')
  union all
  select n.nspname::text, r.rolname::text, 'USAGE', 'role API dùng được schema private'
    from pg_namespace n cross join pg_roles r
   where n.nspname = 'private' and r.rolname in ('anon', 'authenticated') and has_schema_privilege(r.oid, n.oid, 'usage')
  union all
  select c.relname::text, 'RLS', 'off', 'bảng public chưa bật RLS'
    from pg_class c where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace and not c.relrowsecurity
$$;
revoke all on all functions in schema private from public, anon, authenticated;
commit;
