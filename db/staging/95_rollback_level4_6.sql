-- AI FILM NETWORK — GỠ Level 4.6 (db/level4_6_staff_mfa.sql), đưa về đúng Level 4.5.
-- SINH TỰ ĐỘNG bởi tools/gen/gen_level4_6.py. CHỈ dùng trên STAGING. Không xóa dữ liệu người dùng (factor 2FA do Supabase Auth quản lý, không bị đụng).
-- Muốn gỡ toàn bộ Level 4: 95 → 96 → 97 → 98 → 99.
begin;
drop policy if exists mfa_gate_select on public.admin_audit_log;
drop policy if exists mfa_gate_select on public.chat_messages;
drop policy if exists mfa_gate_select on public.chat_mutes;
drop policy if exists mfa_gate_select on public.chat_reports;
drop policy if exists mfa_gate_select on public.content_reports;
drop policy if exists mfa_gate_update on public.content_reports;
drop policy if exists mfa_gate_select on public.episode_sources;
drop policy if exists mfa_gate_insert on public.episode_sources;
drop policy if exists mfa_gate_update on public.episode_sources;
drop policy if exists mfa_gate_delete on public.episode_sources;
drop policy if exists mfa_gate_select on public.film_reviews;
drop policy if exists mfa_gate_update on public.film_reviews;
drop policy if exists mfa_gate_insert on public.member_notifications;
drop policy if exists mfa_gate_select on public.member_privacy_requests;
drop policy if exists mfa_gate_select on public.site_episodes;
drop policy if exists mfa_gate_insert on public.site_episodes;
drop policy if exists mfa_gate_update on public.site_episodes;
drop policy if exists mfa_gate_delete on public.site_episodes;
drop policy if exists mfa_gate_select on public.site_films;
drop policy if exists mfa_gate_insert on public.site_films;
drop policy if exists mfa_gate_update on public.site_films;
drop policy if exists mfa_gate_delete on public.site_films;
drop policy if exists mfa_gate_select on public.site_memberships;
drop policy if exists mfa_gate_select on public.site_social_links;
drop policy if exists mfa_gate_insert on public.site_social_links;
drop policy if exists mfa_gate_update on public.site_social_links;
drop policy if exists mfa_gate_delete on public.site_social_links;

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

create or replace function private.is_network_admin() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (select 1 from public.network_staff where user_id = auth.uid())
$$;
create or replace function private.is_site_admin(p_site text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select private.is_network_admin() or exists (
    select 1 from public.site_staff where user_id = auth.uid() and site_id = p_site and role = 'admin')
$$;
create or replace function private.is_site_staff(p_site text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select private.is_network_admin() or exists (
    select 1 from public.site_staff where user_id = auth.uid() and site_id = p_site)
$$;
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
drop function if exists public.admin_set_staff_mfa_required(boolean, text);
drop function if exists public.admin_staff_mfa_status();
drop function if exists public.my_security_status();
drop function if exists public.afn_staff_gate();
drop function if exists private.dangerous_grants();
drop function if exists private.is_any_site_admin();
drop function if exists private.is_network_owner();
drop function if exists private.mfa_ok();
drop function if exists private.has_verified_factor(uuid);
do $$ declare r record; begin
  if to_regclass('private.grant_hardening_log2') is null then return; end if;
  for r in select * from private.grant_hardening_log2 loop
    if r.kind = 'sequence' and to_regclass('public.' || quote_ident(r.object_name)) is not null then
      execute format('grant %s on sequence public.%I to %I', r.privilege, r.object_name, r.grantee);
    elsif r.kind = 'table' and to_regclass('public.' || quote_ident(r.object_name)) is not null then
      execute format('grant %s on public.%I to %I', r.privilege, r.object_name, r.grantee);
    end if;
  end loop;
end $$;
drop table if exists private.grant_hardening_log2;
drop table if exists private.security_settings;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated;
alter default privileges for role postgres in schema public grant truncate on tables to service_role;
alter default privileges for role postgres in schema public grant execute on functions to anon;
revoke all on all functions in schema private from public, anon, authenticated;
commit;
