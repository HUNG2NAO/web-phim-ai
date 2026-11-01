-- AI FILM NETWORK — GỠ Level 4.5 (db/level4_5_grant_hardening.sql), đưa quyền về đúng Level 4.4.
-- CHỈ dùng trên STAGING. Cấp lại chính xác các quyền đã thu hồi (theo private.grant_hardening_log).
-- Muốn gỡ toàn bộ Level 4: 96 → 97 → 98 → 99.
begin;
do $$ declare r record; begin
  if to_regclass('private.grant_hardening_log') is null then return; end if;
  for r in select table_name, grantee, privilege from private.grant_hardening_log loop
    if to_regclass('public.' || quote_ident(r.table_name)) is not null then
      execute format('grant %s on public.%I to %I', r.privilege, r.table_name, r.grantee);
    end if;
  end loop;
end $$;
drop table if exists private.grant_hardening_log;
alter default privileges for role postgres in schema public grant truncate, trigger, references on tables to anon, authenticated;
create or replace function public.log_landing(p_site text, p_path text, p_film text,
  p_source text, p_medium text, p_campaign text, p_ref text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not private.valid_site(p_site) then return; end if;
  if nullif(p_source, '') is null and nullif(p_medium, '') is null and nullif(p_campaign, '') is null and nullif(p_ref, '') is null then
    return;  -- only campaign/referral landings are recorded
  end if;
  insert into public.traffic_events(site_id, path, film_id, utm_source, utm_medium, utm_campaign, ref_code)
  values (p_site, left(coalesce(nullif(p_path, ''), '/'), 200),
    case when p_film ~ '^[a-z0-9][a-z0-9-]{0,119}$' then p_film end,
    left(lower(nullif(p_source, '')), 60), left(lower(nullif(p_medium, '')), 60), left(nullif(p_campaign, ''), 100),
    case when p_ref ~ '^[A-Za-z0-9_-]{1,40}$' then p_ref end);
end $$;
commit;
