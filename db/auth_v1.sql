-- AI FILM NETWORK — Auth v1. Apply ONLY to a NEW Supabase project,
-- NOT the existing HUNGCREATOR database. Review before applying.
-- Shared auth.users identities, per-site memberships, independent browser sessions.
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Thành viên'
    check (char_length(display_name) between 2 and 60),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id text not null check(site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
  joined_at timestamptz not null default now(),
  primary key (user_id, site_id)
);

alter table public.profiles enable row level security;
alter table public.site_memberships enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.site_memberships from anon;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert on table public.site_memberships to authenticated;

create policy "profile_read_self" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profile_create_self" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profile_update_self" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "membership_read_self" on public.site_memberships
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "membership_join_self" on public.site_memberships
  for insert to authenticated with check ((select auth.uid()) = user_id);

comment on table public.profiles is 'Publicly unexposed: user can read and edit only their own profile.';
comment on table public.site_memberships is 'Shared identity across five independent sites. No session sharing.';
commit;
