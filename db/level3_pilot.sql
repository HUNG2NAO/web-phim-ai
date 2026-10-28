-- AI Film Network Level 3 / Phase A: Xưởng Phim pilot.
-- No changes to HUNGCREATOR; run only on ai-film-network.
-- Data model supports all 5 site_ids, but frontend rollout is restricted to Xưởng Phim.
begin;

create table public.viewer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id text not null check (site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
  nickname text not null check (char_length(btrim(nickname)) between 2 and 40),
  avatar_color text not null default 'cyan' check (avatar_color in ('cyan','green','pink','orange','purple')),
  created_at timestamptz not null default now(),
  unique (id,user_id,site_id)
);
create index viewer_profiles_owner_site on public.viewer_profiles (user_id,site_id);

create table public.viewer_preferences (
  viewer_profile_id uuid primary key,
  user_id uuid not null,
  site_id text not null,
  locale text not null default 'vi' check (locale in ('vi','en','id','th','ms')),
  genres text[] not null default '{}',
  personalization_enabled boolean not null default false,
  watch_tracking_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  foreign key (viewer_profile_id,user_id,site_id) references public.viewer_profiles(id,user_id,site_id) on delete cascade,
  check (coalesce(array_length(genres,1),0) <= 12)
);

create table public.film_library (
  viewer_profile_id uuid not null,
  user_id uuid not null,
  site_id text not null,
  film_id text not null check (film_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  collection text not null check (collection in ('favorite','watchlist','following')),
  added_at timestamptz not null default now(),
  primary key (viewer_profile_id,film_id,collection),
  foreign key (viewer_profile_id,user_id,site_id) references public.viewer_profiles(id,user_id,site_id) on delete cascade
);
create index film_library_recent on public.film_library(viewer_profile_id,added_at desc);

create table public.watch_progress (
  viewer_profile_id uuid not null,
  user_id uuid not null,
  site_id text not null,
  film_id text not null check (film_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  episode integer not null default 1 check (episode between 1 and 10000),
  position_seconds integer not null default 0 check(position_seconds between 0 and 86400),
  duration_seconds integer not null default 0 check(duration_seconds between 0 and 86400),
  watched_at timestamptz not null default now(),
  primary key (viewer_profile_id,film_id,episode),
  foreign key (viewer_profile_id,user_id,site_id) references public.viewer_profiles(id,user_id,site_id) on delete cascade
);
create index watch_progress_recent on public.watch_progress(viewer_profile_id,watched_at desc);

create table public.film_reviews (
  id uuid primary key default gen_random_uuid(),
  viewer_profile_id uuid not null,
  user_id uuid not null,
  site_id text not null,
  film_id text not null check (film_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  rating smallint not null check(rating between 1 and 5),
  content text not null check (char_length(btrim(content)) between 10 and 1200),
  moderation_status text not null default 'pending' check(moderation_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique(viewer_profile_id,film_id),
  foreign key (viewer_profile_id,user_id,site_id) references public.viewer_profiles(id,user_id,site_id) on delete cascade
);
create index film_reviews_moderation on public.film_reviews(moderation_status,created_at);

create table public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id text not null check(site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
  title text not null check(char_length(title) between 1 and 150),
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index member_notifications_inbox on public.member_notifications(user_id,site_id,created_at desc);

alter table public.viewer_profiles enable row level security;
alter table public.viewer_preferences enable row level security;
alter table public.film_library enable row level security;
alter table public.watch_progress enable row level security;
alter table public.film_reviews enable row level security;
alter table public.member_notifications enable row level security;

revoke all on public.viewer_profiles, public.viewer_preferences, public.film_library,
  public.watch_progress, public.film_reviews, public.member_notifications from anon;
grant select,insert,update,delete on public.viewer_profiles to authenticated;
grant select,insert,update,delete on public.viewer_preferences to authenticated;
grant select,insert,delete on public.film_library to authenticated;
grant select,insert,update,delete on public.watch_progress to authenticated;
grant select,insert,delete on public.film_reviews to authenticated;
grant select on public.member_notifications to authenticated;
grant update(read_at) on public.member_notifications to authenticated;

create policy "viewer_profile_read_own" on public.viewer_profiles
  for select to authenticated using (user_id=(select auth.uid()));
create policy "viewer_profile_add_own" on public.viewer_profiles
  for insert to authenticated with check (user_id=(select auth.uid()));
create policy "viewer_profile_edit_own" on public.viewer_profiles
  for update to authenticated using (user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "viewer_profile_delete_own" on public.viewer_profiles
  for delete to authenticated using (user_id=(select auth.uid()));

create policy "prefs_read_own" on public.viewer_preferences
  for select to authenticated using(user_id=(select auth.uid()));
create policy "prefs_add_own" on public.viewer_preferences
  for insert to authenticated with check(user_id=(select auth.uid()));
create policy "prefs_edit_own" on public.viewer_preferences
  for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "prefs_delete_own" on public.viewer_preferences
  for delete to authenticated using(user_id=(select auth.uid()));

create policy "library_read_own" on public.film_library
  for select to authenticated using(user_id=(select auth.uid()));
create policy "library_add_own" on public.film_library
  for insert to authenticated with check(user_id=(select auth.uid()));
create policy "library_delete_own" on public.film_library
  for delete to authenticated using(user_id=(select auth.uid()));

create policy "progress_read_own" on public.watch_progress
  for select to authenticated using(user_id=(select auth.uid()));
create policy "progress_add_own" on public.watch_progress
  for insert to authenticated with check(user_id=(select auth.uid()));
create policy "progress_edit_own" on public.watch_progress
  for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "progress_delete_own" on public.watch_progress
  for delete to authenticated using(user_id=(select auth.uid()));

-- Reviews remain private until manually moderated by an authorized server-side process.
-- Clients can only insert pending reviews and can never approve their own messages.
create policy "reviews_read_own" on public.film_reviews
  for select to authenticated using(user_id=(select auth.uid()));
create policy "reviews_submit_own_pending" on public.film_reviews
  for insert to authenticated with check(user_id=(select auth.uid()) and moderation_status='pending');
create policy "reviews_delete_own" on public.film_reviews
  for delete to authenticated using(user_id=(select auth.uid()));

create policy "notifications_read_own" on public.member_notifications
  for select to authenticated using(user_id=(select auth.uid()));
create policy "notifications_mark_read_own" on public.member_notifications
  for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

comment on table public.viewer_profiles is 'Multiple viewing spaces per account per site. No independent login or PIN, not parental control.';
comment on table public.film_reviews is 'Moderation queue; no public SELECT or user UPDATE.';
comment on table public.watch_progress is 'Playback-derived only. Do not manufacture progress for film demos.';
commit;
