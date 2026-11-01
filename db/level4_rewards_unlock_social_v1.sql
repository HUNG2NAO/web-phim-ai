-- AI FILM NETWORK — Level 4 (Master website: Xưởng Phim first, shared by all five brands)
-- Daily check-in, points wallet, early-access episode unlocking, social links,
-- content error reports, campaign traffic (UTM/ref) and an admin audit log.
--
-- Apply ONLY to Supabase project "ai-film-network" AFTER the Level 3 migrations
-- (auth_v1, level3_pilot, level3_completion_v1, level3_engagement_v1, cleanup, fk_indexes).
-- Additive: creates new tables/functions, never drops or rewrites existing member data.
--
-- Money-like rules (enforced in the database, not in the browser):
--  * Browsers can READ their own wallet/ledger but can never INSERT/UPDATE/DELETE them.
--  * Every balance change happens inside one SECURITY DEFINER function, under a row lock
--    on the user's wallet (SELECT ... FOR UPDATE), with an idempotency key that is UNIQUE
--    per user. Balance has CHECK (balance >= 0), so a double-spend cannot go negative.
--  * One check-in per user per Vietnam calendar day across the whole network
--    (PRIMARY KEY (user_id, checkin_date)), date computed from the server clock.
--  * Points are deducted only in the same transaction that grants the entitlement.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------- helpers
create or replace function private.vn_today() returns date
language sql stable set search_path = pg_catalog as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date
$$;

create or replace function private.valid_site(p_site text) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select p_site in ('xuongphim','khophim','phephim','phimhay','ghienphim')
$$;

create table if not exists public.network_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  added_at timestamptz not null default now()
);
alter table public.network_staff enable row level security;
revoke all on public.network_staff from anon, authenticated;
grant select on public.network_staff to authenticated;
drop policy if exists network_staff_self on public.network_staff;
create policy network_staff_self on public.network_staff for select to authenticated
  using (user_id = (select auth.uid()));
-- Same verified owner that Level 3 seeded into site_staff; inserts nothing elsewhere.
insert into public.network_staff(user_id, role)
select u.id, 'owner' from auth.users u
where u.id = '90b8b707-2a3d-4fa3-95e1-b34974230673'::uuid
  and u.email = 'hung2nao@gmail.com' and u.email_confirmed_at is not null
on conflict (user_id) do nothing;

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

-- ---------------------------------------------------------------- audit log
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  site_id text,
  action text not null check (char_length(action) between 3 and 80),
  target text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_site_time on public.admin_audit_log(site_id, created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;
drop policy if exists audit_read_admins on public.admin_audit_log;
create policy audit_read_admins on public.admin_audit_log for select to authenticated using (
  exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))
  or (site_id is not null and exists (select 1 from public.site_staff s
      where s.user_id = (select auth.uid()) and s.site_id = admin_audit_log.site_id and s.role = 'admin')));

create or replace function private.audit(p_site text, p_action text, p_target text, p_details jsonb)
returns void language sql security definer set search_path = pg_catalog, public as $$
  insert into public.admin_audit_log(actor, site_id, action, target, details)
  values (auth.uid(), p_site, p_action, coalesce(p_target, ''), coalesce(p_details, '{}'::jsonb))
$$;

-- Generic row trigger for staff-edited tables. Records WHO changed WHAT (column names),
-- not secrets. Runs as definer so staff cannot write the log directly.
create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare r jsonb; o jsonb; changed text[];
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    select coalesce(array_agg(k order by k), '{}') into changed
    from jsonb_object_keys(r) k where r->k is distinct from o->k and k <> 'updated_at';
    if coalesce(array_length(changed, 1), 0) = 0 then return new; end if;
  end if;
  perform private.audit(r->>'site_id', tg_table_name || '.' || lower(tg_op),
    coalesce(r->>'film_id', '') || coalesce(':' || (r->>'episode_no'), '') || coalesce(' #' || (r->>'id'), ''),
    jsonb_build_object('changed', to_jsonb(changed)));
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- ---------------------------------------------------------------- reward rules (configurable)
create table if not exists public.reward_rules (
  id smallint primary key default 1 check (id = 1),
  checkin_enabled boolean not null default true,
  checkin_base integer not null default 10 check (checkin_base between 0 and 100000),
  streak_step integer not null default 2 check (streak_step between 0 and 100000),
  streak_step_cap integer not null default 5 check (streak_step_cap between 0 and 365),
  day7_bonus integer not null default 30 check (day7_bonus between 0 and 1000000),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.reward_rules(id) values (1) on conflict (id) do nothing;
alter table public.reward_rules enable row level security;
revoke all on public.reward_rules from anon, authenticated;
grant select on public.reward_rules to anon, authenticated;
drop policy if exists reward_rules_public_read on public.reward_rules;
create policy reward_rules_public_read on public.reward_rules for select to anon, authenticated using (true);

-- ---------------------------------------------------------------- wallet + ledger
create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  earned_total bigint not null default 0 check (earned_total >= 0),
  spent_total bigint not null default 0 check (spent_total >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.wallet_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id text check (site_id is null or site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
  kind text not null check (kind in ('checkin','unlock','refund','admin_credit','admin_debit')),
  delta bigint not null check (delta <> 0),
  balance_after bigint not null check (balance_after >= 0),
  reference text not null default '',
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  note text not null default '' check (char_length(note) <= 300),
  actor uuid,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists wallet_ledger_user_time on public.wallet_ledger(user_id, created_at desc);
create table if not exists public.daily_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  site_id text not null check (site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
  streak integer not null check (streak >= 1),
  points integer not null check (points >= 0),
  ledger_id bigint references public.wallet_ledger(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, checkin_date)
);
create index if not exists daily_checkins_site_date on public.daily_checkins(site_id, checkin_date);
create index if not exists daily_checkins_ledger on public.daily_checkins(ledger_id);

alter table public.wallets enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.daily_checkins enable row level security;
revoke all on public.wallets, public.wallet_ledger, public.daily_checkins from anon, authenticated;
grant select on public.wallets, public.wallet_ledger, public.daily_checkins to authenticated;
drop policy if exists wallets_read_own on public.wallets;
create policy wallets_read_own on public.wallets for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists ledger_read_own on public.wallet_ledger;
create policy ledger_read_own on public.wallet_ledger for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists checkins_read_own on public.daily_checkins;
create policy checkins_read_own on public.daily_checkins for select to authenticated using (user_id = (select auth.uid()));

-- Locks (creating if needed) the wallet row of a user for the rest of the transaction.
create or replace function private.lock_wallet(p_user uuid) returns public.wallets
language plpgsql security definer set search_path = pg_catalog, public as $$
declare w public.wallets;
begin
  insert into public.wallets(user_id) values (p_user) on conflict (user_id) do nothing;
  select * into w from public.wallets where user_id = p_user for update;
  return w;
end $$;

-- ---------------------------------------------------------------- episodes, sources, entitlements
create table if not exists public.site_episodes (
  id uuid primary key default gen_random_uuid(),
  site_id text not null check (site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
  film_id text not null check (film_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  episode_no integer not null check (episode_no between 1 and 10000),
  title text not null default '' check (char_length(title) <= 160),
  access_tier text not null default 'free' check (access_tier in ('free','early','member')),
  price_points integer not null default 0 check (price_points between 0 and 1000000),
  free_from timestamptz,
  access_days integer check (access_days between 1 and 3650),
  published boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, film_id, episode_no),
  foreign key (site_id, film_id) references public.site_films(site_id, film_id) on delete cascade,
  constraint early_needs_price check (access_tier <> 'early' or price_points > 0)
);
create index if not exists site_episodes_public on public.site_episodes(site_id, film_id, episode_no) where published;
create index if not exists site_episodes_creator on public.site_episodes(created_by);

-- Playback sources are NEVER readable by viewers directly; only get_playback_source() returns them.
create table if not exists public.episode_sources (
  episode_id uuid primary key references public.site_episodes(id) on delete cascade,
  source_kind text not null check (source_kind in ('youtube','native')),
  youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  video_url text check (video_url ~ '^https://[^[:space:]]+$' and char_length(video_url) <= 1000),
  updated_at timestamptz not null default now(),
  constraint one_valid_source check (
    (source_kind = 'youtube' and youtube_id is not null and video_url is null) or
    (source_kind = 'native' and youtube_id is null and video_url is not null))
);
create table if not exists public.content_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.site_episodes(id) on delete cascade,
  site_id text not null check (site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
  film_id text not null,
  episode_no integer not null,
  points_paid integer not null default 0 check (points_paid >= 0),
  ledger_id bigint references public.wallet_ledger(id) on delete set null,
  status text not null default 'active' check (status in ('active','expired','refunded','revoked')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  closed_at timestamptz
);
create unique index if not exists entitlement_one_active on public.content_entitlements(user_id, episode_id) where status = 'active';
create index if not exists entitlements_user_time on public.content_entitlements(user_id, granted_at desc);
create index if not exists entitlements_episode on public.content_entitlements(episode_id);
create index if not exists entitlements_ledger on public.content_entitlements(ledger_id);

alter table public.site_episodes enable row level security;
alter table public.episode_sources enable row level security;
alter table public.content_entitlements enable row level security;
revoke all on public.site_episodes, public.episode_sources, public.content_entitlements from anon, authenticated;
grant select on public.site_episodes to anon, authenticated;
grant insert, delete on public.site_episodes to authenticated;
grant update (title, access_tier, price_points, free_from, access_days, published, updated_at) on public.site_episodes to authenticated;
grant select, insert, update, delete on public.episode_sources to authenticated;
grant select on public.content_entitlements to authenticated;

-- Policies for anon must not reference staff tables (anon has no SELECT on them → permission error).
drop policy if exists episodes_anon_read on public.site_episodes;
create policy episodes_anon_read on public.site_episodes for select to anon using (published);
drop policy if exists episodes_public_read on public.site_episodes;
create policy episodes_public_read on public.site_episodes for select to authenticated using (
  published or exists (select 1 from public.site_staff s where s.user_id = (select auth.uid())
    and s.site_id = site_episodes.site_id and s.role = 'admin')
  or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())));
drop policy if exists episodes_admin_insert on public.site_episodes;
create policy episodes_admin_insert on public.site_episodes for insert to authenticated with check (
  created_by = (select auth.uid()) and (
    exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.site_id = site_episodes.site_id and s.role = 'admin')
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))));
drop policy if exists episodes_admin_update on public.site_episodes;
create policy episodes_admin_update on public.site_episodes for update to authenticated
  using (exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.site_id = site_episodes.site_id and s.role = 'admin')
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())))
  with check (exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.site_id = site_episodes.site_id and s.role = 'admin')
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())));
drop policy if exists episodes_admin_delete on public.site_episodes;
create policy episodes_admin_delete on public.site_episodes for delete to authenticated using (
  exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.site_id = site_episodes.site_id and s.role = 'admin')
  or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())));

drop policy if exists sources_admin_all on public.episode_sources;
create policy sources_admin_all on public.episode_sources for all to authenticated
  using (exists (select 1 from public.site_episodes e join public.site_staff s
      on s.site_id = e.site_id and s.user_id = (select auth.uid()) and s.role = 'admin'
      where e.id = episode_sources.episode_id)
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())))
  with check (exists (select 1 from public.site_episodes e join public.site_staff s
      on s.site_id = e.site_id and s.user_id = (select auth.uid()) and s.role = 'admin'
      where e.id = episode_sources.episode_id)
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())));

drop policy if exists entitlements_read_own on public.content_entitlements;
create policy entitlements_read_own on public.content_entitlements for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- social links, reports, traffic
create table if not exists public.site_social_links (
  id uuid primary key default gen_random_uuid(),
  site_id text not null check (site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
  platform text not null check (platform in ('facebook_page','facebook_group','tiktok','youtube','telegram','zalo','instagram','other')),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  url text not null check (url ~ '^https://[^[:space:]<>"]+$' and char_length(url) <= 500),
  placements text[] not null default '{footer,member}'
    check (placements <@ array['header','footer','film','member']::text[]),
  sort_order smallint not null default 0,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists social_links_site on public.site_social_links(site_id, sort_order);
alter table public.site_social_links enable row level security;
revoke all on public.site_social_links from anon, authenticated;
grant select on public.site_social_links to anon, authenticated;
grant insert, update, delete on public.site_social_links to authenticated;
drop policy if exists social_anon_read on public.site_social_links;
create policy social_anon_read on public.site_social_links for select to anon using (enabled);
drop policy if exists social_public_read on public.site_social_links;
create policy social_public_read on public.site_social_links for select to authenticated using (
  enabled or exists (select 1 from public.site_staff s where s.user_id = (select auth.uid())
    and s.site_id = site_social_links.site_id and s.role = 'admin')
  or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())));
drop policy if exists social_admin_write on public.site_social_links;
create policy social_admin_write on public.site_social_links for all to authenticated
  using (exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.site_id = site_social_links.site_id and s.role = 'admin')
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())))
  with check (exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.site_id = site_social_links.site_id and s.role = 'admin')
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())));

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  site_id text not null check (site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
  film_id text not null check (film_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  episode_no integer check (episode_no between 1 and 10000),
  kind text not null check (kind in ('video_error','wrong_info','subtitle','copyright','other')),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid
);
create index if not exists content_reports_site_status on public.content_reports(site_id, status, created_at desc);
create index if not exists content_reports_user on public.content_reports(user_id, created_at desc);
alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;
grant select, insert on public.content_reports to authenticated;
grant update (status, handled_at, handled_by) on public.content_reports to authenticated;
drop policy if exists reports_insert_own on public.content_reports;
create policy reports_insert_own on public.content_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and handled_at is null and handled_by is null);
drop policy if exists reports_read_own_or_staff on public.content_reports;
create policy reports_read_own_or_staff on public.content_reports for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.site_id = content_reports.site_id)
  or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())));
drop policy if exists reports_staff_handle on public.content_reports;
create policy reports_staff_handle on public.content_reports for update to authenticated
  using (exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.site_id = content_reports.site_id)
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())))
  with check (handled_by = (select auth.uid()) and (
    exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.site_id = content_reports.site_id)
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))));

-- Simple abuse guard: at most 20 reports per account per 24h.
create or replace function private.limit_reports() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if (select count(*) from public.content_reports
      where user_id = new.user_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'report_rate_limited' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists content_reports_rate_limit on public.content_reports;
create trigger content_reports_rate_limit before insert on public.content_reports
  for each row execute function private.limit_reports();

-- Campaign landings only (UTM or referral code present). No IP, no user agent, no user id.
create table if not exists public.traffic_events (
  id bigint generated always as identity primary key,
  site_id text not null check (site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
  landed_at timestamptz not null default now(),
  path text not null default '/' check (char_length(path) <= 200),
  film_id text check (film_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  utm_source text check (char_length(utm_source) <= 60),
  utm_medium text check (char_length(utm_medium) <= 60),
  utm_campaign text check (char_length(utm_campaign) <= 100),
  ref_code text check (ref_code ~ '^[A-Za-z0-9_-]{1,40}$')
);
create index if not exists traffic_site_time on public.traffic_events(site_id, landed_at desc);
alter table public.traffic_events enable row level security;
revoke all on public.traffic_events from anon, authenticated;

-- ---------------------------------------------------------------- viewer RPCs
create or replace function public.claim_daily_checkin(p_site text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  uid uuid := auth.uid();
  rules public.reward_rules;
  today date := private.vn_today();
  prev_streak integer;
  v_streak integer;
  v_points integer;
  w public.wallets;
  v_ledger bigint;
  existing public.daily_checkins;
begin
  if uid is null then raise exception 'login_required' using errcode = '28000'; end if;
  if not private.valid_site(p_site) then raise exception 'invalid_site' using errcode = '22023'; end if;
  select * into rules from public.reward_rules where id = 1;
  if not found or not rules.checkin_enabled then
    return jsonb_build_object('status', 'disabled');
  end if;
  w := private.lock_wallet(uid);                     -- serialises concurrent requests of this user
  select * into existing from public.daily_checkins where user_id = uid and checkin_date = today;
  if found then
    return jsonb_build_object('status', 'already', 'date', today, 'streak', existing.streak,
      'points', existing.points, 'balance', w.balance, 'site_id', existing.site_id);
  end if;
  select streak into prev_streak from public.daily_checkins where user_id = uid and checkin_date = today - 1;
  v_streak := coalesce(prev_streak, 0) + 1;
  v_points := rules.checkin_base + least(v_streak - 1, rules.streak_step_cap) * rules.streak_step
              + case when v_streak % 7 = 0 then rules.day7_bonus else 0 end;
  if v_points > 0 then
    update public.wallets set balance = balance + v_points, earned_total = earned_total + v_points,
      updated_at = now() where user_id = uid returning * into w;
    insert into public.wallet_ledger(user_id, site_id, kind, delta, balance_after, reference, idempotency_key, note)
    values (uid, p_site, 'checkin', v_points, w.balance, 'checkin:' || today, 'checkin:' || today,
      'Điểm danh ngày ' || to_char(today, 'DD/MM/YYYY') || ' · chuỗi ' || v_streak || ' ngày')
    returning id into v_ledger;
  end if;
  insert into public.daily_checkins(user_id, checkin_date, site_id, streak, points, ledger_id)
  values (uid, today, p_site, v_streak, v_points, v_ledger);
  return jsonb_build_object('status', 'claimed', 'date', today, 'streak', v_streak, 'points', v_points,
    'balance', w.balance, 'day7', v_streak % 7 = 0);
end $$;

create or replace function private.episode_is_open(e public.site_episodes) returns boolean
language sql stable set search_path = pg_catalog as $$
  select e.access_tier = 'free' or (e.access_tier = 'early' and e.free_from is not null and e.free_from <= now())
$$;

create or replace function public.unlock_episode(p_episode_id uuid, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  uid uuid := auth.uid();
  e public.site_episodes;
  w public.wallets;
  ent public.content_entitlements;
  v_ledger bigint;
  v_expires timestamptz;
begin
  if uid is null then raise exception 'login_required' using errcode = '28000'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100
     or p_idempotency_key !~ '^[A-Za-z0-9_:-]+$' then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;
  select * into e from public.site_episodes where id = p_episode_id and published;
  if not found then raise exception 'episode_not_found' using errcode = 'P0002'; end if;
  if private.episode_is_open(e) then return jsonb_build_object('status', 'free'); end if;
  if e.access_tier = 'member' then return jsonb_build_object('status', 'member_access'); end if;

  w := private.lock_wallet(uid);
  -- Replay of the same request: return the original outcome, never charge twice.
  if exists (select 1 from public.wallet_ledger where user_id = uid and idempotency_key = 'unlock:' || p_idempotency_key) then
    select * into ent from public.content_entitlements c
      where c.user_id = uid and c.episode_id = e.id order by granted_at desc limit 1;
    return jsonb_build_object('status', 'already_unlocked', 'balance', w.balance, 'expires_at', ent.expires_at, 'replay', true);
  end if;
  update public.content_entitlements set status = 'expired', closed_at = now()
    where user_id = uid and episode_id = e.id and status = 'active' and expires_at is not null and expires_at <= now();
  select * into ent from public.content_entitlements
    where user_id = uid and episode_id = e.id and status = 'active';
  if found then
    return jsonb_build_object('status', 'already_unlocked', 'balance', w.balance, 'expires_at', ent.expires_at);
  end if;
  if w.balance < e.price_points then
    return jsonb_build_object('status', 'insufficient', 'balance', w.balance, 'price', e.price_points);
  end if;
  update public.wallets set balance = balance - e.price_points, spent_total = spent_total + e.price_points,
    updated_at = now() where user_id = uid returning * into w;
  insert into public.wallet_ledger(user_id, site_id, kind, delta, balance_after, reference, idempotency_key, note)
  values (uid, e.site_id, 'unlock', -e.price_points, w.balance, 'episode:' || e.id, 'unlock:' || p_idempotency_key,
    'Mở khóa ' || e.film_id || ' tập ' || e.episode_no)
  returning id into v_ledger;
  v_expires := case when e.access_days is null then null else now() + make_interval(days => e.access_days) end;
  insert into public.content_entitlements(user_id, episode_id, site_id, film_id, episode_no, points_paid, ledger_id, expires_at)
  values (uid, e.id, e.site_id, e.film_id, e.episode_no, e.price_points, v_ledger, v_expires)
  returning * into ent;
  return jsonb_build_object('status', 'unlocked', 'balance', w.balance, 'price', e.price_points,
    'expires_at', ent.expires_at, 'entitlement_id', ent.id);
end $$;

-- The ONLY way a viewer obtains a playback source. Anonymous allowed for free episodes.
create or replace function public.get_playback_source(p_episode_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare uid uuid := auth.uid(); e public.site_episodes; s public.episode_sources; allowed boolean;
begin
  select * into e from public.site_episodes where id = p_episode_id;
  if not found or (not e.published and not private.is_site_admin(e.site_id)) then
    return jsonb_build_object('status', 'not_found');
  end if;
  allowed := private.episode_is_open(e) or (uid is not null and private.is_site_admin(e.site_id));
  if not allowed and e.access_tier = 'member' then allowed := uid is not null; end if;
  if not allowed and e.access_tier = 'early' and uid is not null then
    allowed := exists (select 1 from public.content_entitlements c where c.user_id = uid and c.episode_id = e.id
      and c.status = 'active' and (c.expires_at is null or c.expires_at > now()));
  end if;
  if not allowed then
    return jsonb_build_object('status', case when uid is null then 'login_required' else 'locked' end,
      'tier', e.access_tier, 'price', e.price_points, 'free_from', e.free_from);
  end if;
  select * into s from public.episode_sources where episode_id = e.id;
  if not found then return jsonb_build_object('status', 'no_source'); end if;
  return jsonb_build_object('status', 'ok', 'source_kind', s.source_kind, 'youtube_id', s.youtube_id, 'video_url', s.video_url);
end $$;

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

-- ---------------------------------------------------------------- admin RPCs (all audited)
create or replace function public.admin_set_reward_rules(p_enabled boolean, p_base integer, p_step integer,
  p_cap integer, p_day7 integer)
returns public.reward_rules language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.reward_rules; before jsonb;
begin
  if not private.is_network_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select to_jsonb(x) into before from public.reward_rules x where id = 1;
  update public.reward_rules set checkin_enabled = p_enabled, checkin_base = p_base, streak_step = p_step,
    streak_step_cap = p_cap, day7_bonus = p_day7, updated_at = now(), updated_by = auth.uid()
  where id = 1 returning * into r;
  perform private.audit(null, 'reward_rules.update', 'checkin',
    jsonb_build_object('before', before - 'updated_at' - 'updated_by', 'after', to_jsonb(r) - 'updated_at' - 'updated_by'));
  return r;
end $$;

create or replace function public.admin_adjust_points(p_user uuid, p_delta integer, p_reason text, p_key text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare w public.wallets;
begin
  if not private.is_network_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_delta = 0 or abs(p_delta) > 1000000 then raise exception 'invalid_amount' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  if p_key is null or p_key !~ '^[A-Za-z0-9_:-]{8,100}$' then raise exception 'invalid_idempotency_key' using errcode = '22023'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'user_not_found' using errcode = 'P0002'; end if;
  w := private.lock_wallet(p_user);
  if exists (select 1 from public.wallet_ledger where user_id = p_user and idempotency_key = 'admin:' || p_key) then
    return jsonb_build_object('status', 'replay', 'balance', w.balance);
  end if;
  if w.balance + p_delta < 0 then
    return jsonb_build_object('status', 'insufficient', 'balance', w.balance);
  end if;
  update public.wallets set balance = balance + p_delta,
    earned_total = earned_total + greatest(p_delta, 0), spent_total = spent_total + greatest(-p_delta, 0),
    updated_at = now() where user_id = p_user returning * into w;
  insert into public.wallet_ledger(user_id, kind, delta, balance_after, reference, idempotency_key, note, actor)
  values (p_user, case when p_delta > 0 then 'admin_credit' else 'admin_debit' end, p_delta, w.balance,
    'admin', 'admin:' || p_key, left(btrim(p_reason), 300), auth.uid());
  perform private.audit(null, 'wallet.adjust', p_user::text, jsonb_build_object('delta', p_delta, 'reason', left(btrim(p_reason), 300)));
  return jsonb_build_object('status', 'ok', 'balance', w.balance);
end $$;

create or replace function public.admin_refund_unlock(p_entitlement_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare ent public.content_entitlements; w public.wallets;
begin
  select * into ent from public.content_entitlements where id = p_entitlement_id;
  if not found then raise exception 'entitlement_not_found' using errcode = 'P0002'; end if;
  if not private.is_site_admin(ent.site_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  w := private.lock_wallet(ent.user_id);
  select * into ent from public.content_entitlements where id = p_entitlement_id for update;
  if ent.status <> 'active' then return jsonb_build_object('status', 'not_refundable', 'current', ent.status); end if;
  update public.content_entitlements set status = 'refunded', closed_at = now() where id = ent.id;
  if ent.points_paid > 0 then
    update public.wallets set balance = balance + ent.points_paid,
      spent_total = greatest(spent_total - ent.points_paid, 0), updated_at = now()
    where user_id = ent.user_id returning * into w;
    insert into public.wallet_ledger(user_id, site_id, kind, delta, balance_after, reference, idempotency_key, note, actor)
    values (ent.user_id, ent.site_id, 'refund', ent.points_paid, w.balance, 'entitlement:' || ent.id,
      'refund:' || ent.id, left(btrim(p_reason), 300), auth.uid());
  end if;
  perform private.audit(ent.site_id, 'entitlement.refund', ent.id::text,
    jsonb_build_object('user', ent.user_id, 'points', ent.points_paid, 'reason', left(btrim(p_reason), 300)));
  return jsonb_build_object('status', 'refunded', 'points', ent.points_paid, 'balance', w.balance);
end $$;

create or replace function public.admin_overview(p_site text)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare today date := private.vn_today();
begin
  if not private.is_site_staff(p_site) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'members', (select count(*) from public.site_memberships where site_id = p_site),
    'films_published', (select count(*) from public.site_films where site_id = p_site and published),
    'films_draft', (select count(*) from public.site_films where site_id = p_site and not published),
    'episodes_published', (select count(*) from public.site_episodes where site_id = p_site and published),
    'episodes_locked', (select count(*) from public.site_episodes e where site_id = p_site and published and not private.episode_is_open(e)),
    'checkins_today', (select count(*) from public.daily_checkins where site_id = p_site and checkin_date = today),
    'checkins_7d', (select count(*) from public.daily_checkins where site_id = p_site and checkin_date > today - 7),
    'points_issued_7d', (select coalesce(sum(delta), 0) from public.wallet_ledger where site_id = p_site and delta > 0 and created_at > now() - interval '7 days'),
    'points_spent_7d', (select coalesce(-sum(delta), 0) from public.wallet_ledger where site_id = p_site and kind = 'unlock' and created_at > now() - interval '7 days'),
    'unlocks_7d', (select count(*) from public.content_entitlements where site_id = p_site and granted_at > now() - interval '7 days'),
    'reviews_pending', (select count(*) from public.film_reviews where site_id = p_site and moderation_status = 'pending'),
    'reports_open', (select count(*) from public.content_reports where site_id = p_site and status = 'open'),
    'campaign_visits_7d', (select count(*) from public.traffic_events where site_id = p_site and landed_at > now() - interval '7 days'),
    'generated_at', now());
end $$;

create or replace function public.admin_member_wallets(p_site text)
returns table(user_id uuid, display_name text, joined_at timestamptz, balance bigint,
  earned_total bigint, spent_total bigint, last_checkin date, streak integer)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not private.is_site_admin(p_site) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select m.user_id, coalesce(p.display_name, 'Thành viên'), m.joined_at,
    coalesce(w.balance, 0), coalesce(w.earned_total, 0), coalesce(w.spent_total, 0),
    c.checkin_date, c.streak
  from public.site_memberships m
  left join public.profiles p on p.id = m.user_id
  left join public.wallets w on w.user_id = m.user_id
  left join lateral (select d.checkin_date, d.streak from public.daily_checkins d
    where d.user_id = m.user_id order by d.checkin_date desc limit 1) c on true
  where m.site_id = p_site
  order by m.joined_at desc limit 500;
end $$;

create or replace function public.admin_member_ledger(p_site text, p_user uuid)
returns setof public.wallet_ledger
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not private.is_site_admin(p_site) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.site_memberships where site_id = p_site and user_id = p_user)
     and not private.is_network_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from public.wallet_ledger where user_id = p_user order by created_at desc limit 200;
end $$;

create or replace function public.admin_site_entitlements(p_site text)
returns setof public.content_entitlements
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not private.is_site_admin(p_site) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select * from public.content_entitlements where site_id = p_site order by granted_at desc limit 300;
end $$;

create or replace function public.admin_traffic(p_site text, p_days integer)
returns table(utm_source text, utm_medium text, utm_campaign text, ref_code text, visits bigint, last_visit timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not private.is_site_admin(p_site) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select t.utm_source, t.utm_medium, t.utm_campaign, t.ref_code, count(*), max(t.landed_at)
  from public.traffic_events t
  where t.site_id = p_site and t.landed_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 365))
  group by 1, 2, 3, 4 order by 5 desc limit 200;
end $$;

create or replace function public.admin_site_staff(p_site text)
returns table(user_id uuid, display_name text, role text, added_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not private.is_site_admin(p_site) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select s.user_id, coalesce(p.display_name, 'Thành viên'), s.role, s.added_at
  from public.site_staff s left join public.profiles p on p.id = s.user_id
  where s.site_id = p_site
  union all
  select n.user_id, coalesce(p.display_name, 'Thành viên'), 'network_' || n.role, n.added_at
  from public.network_staff n left join public.profiles p on p.id = n.user_id
  order by 4;
end $$;

-- ---------------------------------------------------------------- audit triggers on staff-edited tables
drop trigger if exists audit_site_films on public.site_films;
create trigger audit_site_films after insert or update or delete on public.site_films
  for each row execute function private.audit_row();
drop trigger if exists audit_site_episodes on public.site_episodes;
create trigger audit_site_episodes after insert or update or delete on public.site_episodes
  for each row execute function private.audit_row();
drop trigger if exists audit_social_links on public.site_social_links;
create trigger audit_social_links after insert or update or delete on public.site_social_links
  for each row execute function private.audit_row();
drop trigger if exists audit_content_reports on public.content_reports;
create trigger audit_content_reports after update on public.content_reports
  for each row execute function private.audit_row();
drop trigger if exists audit_review_moderation on public.film_reviews;
create trigger audit_review_moderation after update of moderation_status on public.film_reviews
  for each row execute function private.audit_row();

create or replace function private.audit_source() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare e public.site_episodes; r public.episode_sources;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  select * into e from public.site_episodes where id = r.episode_id;
  perform private.audit(e.site_id, 'episode_sources.' || lower(tg_op), coalesce(e.film_id, '') || ':' || coalesce(e.episode_no::text, ''),
    jsonb_build_object('source_kind', r.source_kind));
  return r;
end $$;
drop trigger if exists audit_episode_sources on public.episode_sources;
create trigger audit_episode_sources after insert or update or delete on public.episode_sources
  for each row execute function private.audit_source();

-- ---------------------------------------------------------------- Level 3 fix: anonymous catalog read
-- level3_completion_v1 policy "site_films_public_published" (to anon, authenticated) references
-- site_staff, which anon cannot read, so every logged-out catalog request failed with
-- "permission denied for table site_staff". Split it: anon sees published rows only.
drop policy if exists site_films_public_published on public.site_films;
drop policy if exists site_films_anon_published on public.site_films;
create policy site_films_anon_published on public.site_films for select to anon using (published);
drop policy if exists site_films_member_read on public.site_films;
create policy site_films_member_read on public.site_films for select to authenticated using (
  published or exists (select 1 from public.site_staff s where s.user_id = (select auth.uid())
    and s.site_id = site_films.site_id and s.role = 'admin')
  or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())));

-- ---------------------------------------------------------------- function privileges
revoke all on all functions in schema private from public, anon, authenticated;

revoke all on function public.claim_daily_checkin(text) from public, anon;
revoke all on function public.unlock_episode(uuid, text) from public, anon;
revoke all on function public.get_playback_source(uuid) from public;
revoke all on function public.log_landing(text, text, text, text, text, text, text) from public;
revoke all on function public.admin_set_reward_rules(boolean, integer, integer, integer, integer) from public, anon;
revoke all on function public.admin_adjust_points(uuid, integer, text, text) from public, anon;
revoke all on function public.admin_refund_unlock(uuid, text) from public, anon;
revoke all on function public.admin_overview(text) from public, anon;
revoke all on function public.admin_member_wallets(text) from public, anon;
revoke all on function public.admin_member_ledger(text, uuid) from public, anon;
revoke all on function public.admin_site_entitlements(text) from public, anon;
revoke all on function public.admin_traffic(text, integer) from public, anon;
revoke all on function public.admin_site_staff(text) from public, anon;

grant execute on function public.claim_daily_checkin(text) to authenticated;
grant execute on function public.unlock_episode(uuid, text) to authenticated;
grant execute on function public.get_playback_source(uuid) to anon, authenticated;
grant execute on function public.log_landing(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_set_reward_rules(boolean, integer, integer, integer, integer) to authenticated;
grant execute on function public.admin_adjust_points(uuid, integer, text, text) to authenticated;
grant execute on function public.admin_refund_unlock(uuid, text) to authenticated;
grant execute on function public.admin_overview(text) to authenticated;
grant execute on function public.admin_member_wallets(text) to authenticated;
grant execute on function public.admin_member_ledger(text, uuid) to authenticated;
grant execute on function public.admin_site_entitlements(text) to authenticated;
grant execute on function public.admin_traffic(text, integer) to authenticated;
grant execute on function public.admin_site_staff(text) to authenticated;

comment on table public.wallets is 'Points wallet. Read-only to its owner; changed only by audited SECURITY DEFINER functions.';
comment on table public.episode_sources is 'Never selectable by viewers. Delivered only via get_playback_source() after entitlement check.';
comment on table public.traffic_events is 'Campaign/referral landings only. No IP, user agent or user id stored.';
commit;
