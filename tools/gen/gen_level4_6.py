#!/usr/bin/env python3
"""Sinh db/level4_6_staff_mfa.sql và db/staging/95_rollback_level4_6.sql từ định nghĩa hiện hành (không gõ tay thân hàm).
Mỗi phép thay thế phải xuất hiện đúng 1 lần, nếu không script dừng."""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
def fn(file, name):
    s = (ROOT / 'db' / file).read_text()
    m = re.search(r"create or replace function public\.%s\(.*?\nend \$\$;\n" % name, s, re.S)
    assert m, name
    return m.group(0)
def sub1(text, old, new):
    assert text.count(old) == 1, (old, text.count(old))
    return text.replace(old, new)

DEL = fn('level4_3_isolation_privacy.sql', 'admin_execute_account_deletion')
CHAT = fn('level4_4_chat_switch.sql', 'admin_set_chat_enabled')
MUTE = fn('level4_2_community_chat.sql', 'chat_set_mute')

del_new = sub1(DEL, "if auth.uid() is null or not exists (select 1 from public.network_staff where user_id = auth.uid() and role = 'owner') then",
                    "if auth.uid() is null or not private.is_network_owner() then")
del_new = sub1(del_new, "    raise exception 'email_mismatch' using errcode = '22023';\n  end if;\n",
  "    raise exception 'email_mismatch' using errcode = '22023';\n  end if;\n"
  "  -- Level 4.6: xóa thật luôn cần phiên đã xác thực 2 lớp (AAL2), kể cả khi chưa bật bắt buộc 2FA.\n"
  "  if not coalesce(p_dry_run, true) and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then\n"
  "    raise exception 'mfa_required' using errcode = '42501';\n"
  "  end if;\n")
chat_new = sub1(CHAT, "or (p_scope = 'network' and exists (select 1 from public.site_staff where user_id = auth.uid() and role = 'admin'))) then",
                      "or (p_scope = 'network' and private.is_any_site_admin())) then")
mute_new = sub1(MUTE, "if not (private.is_network_admin() or exists (select 1 from public.site_staff where user_id = auth.uid() and role = 'admin')) then",
                      "if not (private.is_network_admin() or private.is_any_site_admin()) then")

GATES = [  # (table, cmd, expr) — RESTRICTIVE, to authenticated. gate = nhân sự đã đạt điều kiện 2FA, hoặc không phải nhân sự
  ('admin_audit_log', 'select', 'G'),
  ('chat_messages', 'select', "not hidden or user_id = (select auth.uid()) or G"),
  ('chat_mutes', 'select', "user_id = (select auth.uid()) or G"),
  ('chat_reports', 'select', "reporter = (select auth.uid()) or G"),
  ('content_reports', 'select', "user_id = (select auth.uid()) or G"),
  ('content_reports', 'update', 'G'),
  ('episode_sources', 'select', 'G'), ('episode_sources', 'insert', 'G'), ('episode_sources', 'update', 'G'), ('episode_sources', 'delete', 'G'),
  ('film_reviews', 'select', "user_id = (select auth.uid()) or G"),
  ('film_reviews', 'update', 'G'),
  ('member_notifications', 'insert', 'G'),
  ('member_privacy_requests', 'select', "user_id = (select auth.uid()) or G"),
  ('site_episodes', 'select', 'published or G'), ('site_episodes', 'insert', 'G'), ('site_episodes', 'update', 'G'), ('site_episodes', 'delete', 'G'),
  ('site_films', 'select', 'published or G'), ('site_films', 'insert', 'G'), ('site_films', 'update', 'G'), ('site_films', 'delete', 'G'),
  ('site_memberships', 'select', "user_id = (select auth.uid()) or G"),
  ('site_social_links', 'select', 'enabled or G'), ('site_social_links', 'insert', 'G'), ('site_social_links', 'update', 'G'), ('site_social_links', 'delete', 'G'),
]
def pol(t, c, e):
    e = '(' + e.replace('G', '(select public.afn_staff_gate())') + ')'
    clause = {'select': f'using {e}', 'delete': f'using {e}', 'insert': f'with check {e}', 'update': f'using {e} with check {e}'}[c]
    return (f"drop policy if exists mfa_gate_{c} on public.{t};\n"
            f"create policy mfa_gate_{c} on public.{t} as restrictive for {c} to authenticated {clause};\n")

up = f"""-- AI FILM NETWORK — Level 4.6: xác thực 2 lớp (TOTP) cho nhân sự + tăng cứng quyền đợt 2.
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

{''.join(pol(*g) for g in GATES)}
-- RPC kiểm quyền trực tiếp (sinh từ bản hiện hành, chỉ thay điều kiện kiểm quyền người gọi)
{del_new}
{chat_new}
{mute_new}
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
"""

def orig_fn_block(text):  # bản gốc để gỡ
    return text
down = f"""-- AI FILM NETWORK — GỠ Level 4.6 (db/level4_6_staff_mfa.sql), đưa về đúng Level 4.5.
-- SINH TỰ ĐỘNG bởi tools/gen/gen_level4_6.py. CHỈ dùng trên STAGING. Không xóa dữ liệu người dùng (factor 2FA do Supabase Auth quản lý, không bị đụng).
-- Muốn gỡ toàn bộ Level 4: 95 → 96 → 97 → 98 → 99.
begin;
{''.join(f"drop policy if exists mfa_gate_{c} on public.{t};\n" for t, c, _ in GATES)}
{DEL}
{CHAT}
{MUTE}
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
"""
(ROOT / 'db' / 'level4_6_staff_mfa.sql').write_text(up)
(ROOT / 'db' / 'staging' / '95_rollback_level4_6.sql').write_text(down)
print('ok', len(up), len(down))
