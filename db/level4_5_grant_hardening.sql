-- AI FILM NETWORK — Level 4.5: tăng cứng quyền (không đổi hành vi người dùng).
-- Additive & idempotent. Gỡ: db/staging/96_rollback_level4_5.sql (cấp lại đúng các quyền đã thu hồi, theo nhật ký).
--
-- 1. Thu hồi TRUNCATE / TRIGGER / REFERENCES của anon & authenticated trên mọi bảng public
--    (mặc định Supabase cấp ALL; TRUNCATE không chịu RLS — API REST không có lệnh này, nhưng phòng thủ nhiều lớp).
--    Áp cả cho bảng tạo về sau (default privileges của role postgres).
-- 2. Thu hồi INSERT / UPDATE / DELETE ở bảng KHÔNG có policy tương ứng cho role đó (RLS vốn đã chặn → không đổi hành vi,
--    nhưng quyền khớp đúng chính sách, dễ rà soát).
-- 3. Mọi quyền bị thu hồi được ghi vào private.grant_hardening_log để gỡ chính xác.
-- 4. log_landing (khách gọi được): trần 300 lượt/phút/website để chặn ghi tràn bảng traffic_events.
begin;

create table if not exists private.grant_hardening_log (
  table_name text not null, grantee text not null, privilege text not null, revoked_at timestamptz not null default now(),
  primary key (table_name, grantee, privilege)
);
revoke all on private.grant_hardening_log from public, anon, authenticated;

do $$
declare r record; has_policy boolean;
begin
  for r in
    select g.table_name, g.grantee, g.privilege_type
      from information_schema.role_table_grants g
      join pg_class c on c.relname = g.table_name and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
     where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated')
       and g.privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES', 'INSERT', 'UPDATE', 'DELETE')
  loop
    if r.privilege_type in ('INSERT', 'UPDATE', 'DELETE') then
      select exists (
        select 1 from pg_policies p
         where p.schemaname = 'public' and p.tablename = r.table_name
           and (p.cmd = r.privilege_type or p.cmd = 'ALL')
           and (r.grantee = any(p.roles) or 'public' = any(p.roles))) into has_policy;
      if has_policy then continue; end if;
    end if;
    execute format('revoke %s on public.%I from %I', r.privilege_type, r.table_name, r.grantee);
    insert into private.grant_hardening_log(table_name, grantee, privilege) values (r.table_name, r.grantee, r.privilege_type)
      on conflict do nothing;
  end loop;
end $$;

alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from anon, authenticated;

create or replace function public.log_landing(p_site text, p_path text, p_film text,
  p_source text, p_medium text, p_campaign text, p_ref text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not private.valid_site(p_site) then return; end if;
  if nullif(p_source, '') is null and nullif(p_medium, '') is null and nullif(p_campaign, '') is null and nullif(p_ref, '') is null then
    return;  -- only campaign/referral landings are recorded
  end if;
  -- Trần chống ghi tràn (khách gọi được): tối đa 300 lượt/phút/website. Dùng chỉ mục traffic_site_time.
  if (select count(*) from public.traffic_events where site_id = p_site and landed_at > now() - interval '1 minute') >= 300 then
    return;
  end if;
  insert into public.traffic_events(site_id, path, film_id, utm_source, utm_medium, utm_campaign, ref_code)
  values (p_site, left(coalesce(nullif(p_path, ''), '/'), 200),
    case when p_film ~ '^[a-z0-9][a-z0-9-]{0,119}$' then p_film end,
    left(lower(nullif(p_source, '')), 60), left(lower(nullif(p_medium, '')), 60), left(nullif(p_campaign, ''), 100),
    case when p_ref ~ '^[A-Za-z0-9_-]{1,40}$' then p_ref end);
end $$;
revoke all on function public.log_landing(text, text, text, text, text, text, text) from public;
grant execute on function public.log_landing(text, text, text, text, text, text, text) to anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
commit;
