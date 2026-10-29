-- Level 3 completion: staff-moderated catalog, privacy support, and notice delivery.
-- ONLY on Supabase ai-film-network; avoids original HUNGCREATOR project.
begin;
create table if not exists public.site_staff (
 user_id uuid not null references auth.users(id) on delete cascade,
 site_id text not null check (site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
 role text not null default 'moderator' check (role in ('moderator','admin')),
 added_at timestamptz not null default now(),
 primary key (user_id,site_id)
);
alter table public.site_staff enable row level security;
revoke all on public.site_staff from anon,authenticated;
grant select on public.site_staff to authenticated;
create policy staff_self on public.site_staff for select to authenticated
 using (user_id=(select auth.uid()));

-- Seed only the already-verified, existing owner of this new film-network Supabase project.
insert into public.site_staff(user_id,site_id,role)
select u.id, sites.site_id, 'admin'
from auth.users u
cross join (values ('xuongphim'),('khophim'),('phephim'),('phimhay'),('ghienphim')) as sites(site_id)
where u.id = '90b8b707-2a3d-4fa3-95e1-b34974230673'::uuid
and u.email='hung2nao@gmail.com' and u.email_confirmed_at is not null
on conflict (user_id,site_id) do nothing;

create table if not exists public.member_privacy_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 site_id text not null check (site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
 request_type text not null check(request_type in ('delete_account','data_export','delete_activity')),
 status text not null default 'pending' check(status in ('pending','in_review','completed','rejected')),
 submitted_at timestamptz not null default now(),
 handled_at timestamptz,
 admin_note text not null default ''
);
create index if not exists privacy_requests_site_status on public.member_privacy_requests(site_id,status,submitted_at);
create index if not exists privacy_requests_user on public.member_privacy_requests(user_id,submitted_at desc);
alter table public.member_privacy_requests enable row level security;
revoke all on public.member_privacy_requests from anon,authenticated;
grant select,insert on public.member_privacy_requests to authenticated;
grant update (status,handled_at,admin_note) on public.member_privacy_requests to authenticated;
create policy privacy_read_own_or_staff on public.member_privacy_requests for select to authenticated
 using (user_id=(select auth.uid()) or exists (
  select 1 from public.site_staff s where s.user_id=(select auth.uid())
  and s.site_id=member_privacy_requests.site_id));
create policy privacy_request_own on public.member_privacy_requests for insert to authenticated
 with check (user_id=(select auth.uid()) and status='pending' and handled_at is null and admin_note='');
create policy privacy_manage_by_staff on public.member_privacy_requests for update to authenticated
 using (exists(select 1 from public.site_staff s where s.user_id=(select auth.uid())
  and s.site_id=member_privacy_requests.site_id and s.role='admin'))
 with check (exists(select 1 from public.site_staff s where s.user_id=(select auth.uid())
  and s.site_id=member_privacy_requests.site_id and s.role='admin'));

-- Client RLS: approved public catalog only. Creation/publishing reserved for owner staff.
create table if not exists public.site_films (
 id uuid primary key default gen_random_uuid(),
 site_id text not null check(site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
 film_id text not null check(film_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
 title text not null check(char_length(btrim(title)) between 2 and 160),
 synopsis text not null default '',
 genres text[] not null default '{}',
 year integer not null default 2026 check(year between 1900 and 2100),
 film_type text not null default 'le' check(film_type in ('le','bo','ngan')),
 source_kind text not null check(source_kind in ('youtube','native')),
 youtube_id text check(youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
 video_url text,
 rights_attested boolean not null default false,
 published boolean not null default false,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(site_id,film_id),
 constraint valid_video_source check (
  (source_kind='youtube' and youtube_id is not null and video_url is null)
  or
  (source_kind='native' and youtube_id is null and video_url ~ '^https://[^[:space:]]+$')
 ),
 constraint no_publish_without_rights check(not published or rights_attested)
);
create index if not exists site_films_site_pub on public.site_films(site_id,published,created_at desc);
alter table public.site_films enable row level security;
revoke all on public.site_films from anon,authenticated;
grant select on public.site_films to anon, authenticated;
grant insert,delete on public.site_films to authenticated;
grant update (title,synopsis,genres,year,film_type,source_kind,youtube_id,video_url,rights_attested,published,updated_at) on public.site_films to authenticated;
create policy site_films_public_published on public.site_films for select to anon,authenticated
 using (published or exists(select 1 from public.site_staff s where s.user_id=(select auth.uid()) and s.site_id=site_films.site_id and s.role='admin'));
create policy site_films_admin_create on public.site_films for insert to authenticated
 with check(created_by=(select auth.uid()) and exists(
  select 1 from public.site_staff s where s.user_id=(select auth.uid()) and s.site_id=site_films.site_id and s.role='admin'));
create policy site_films_admin_edit on public.site_films for update to authenticated
 using (exists(select 1 from public.site_staff s where s.user_id=(select auth.uid()) and s.site_id=site_films.site_id and s.role='admin'))
 with check(exists(select 1 from public.site_staff s where s.user_id=(select auth.uid()) and s.site_id=site_films.site_id and s.role='admin'));
create policy site_films_admin_delete on public.site_films for delete to authenticated
 using (exists(select 1 from public.site_staff s where s.user_id=(select auth.uid()) and s.site_id=site_films.site_id and s.role='admin'));

-- Moderation never exposes pending review text to non-staff viewers.
grant update (moderation_status) on public.film_reviews to authenticated;
create policy reviews_staff_read on public.film_reviews for select to authenticated
 using(exists(select 1 from public.site_staff s where s.user_id=(select auth.uid()) and s.site_id=film_reviews.site_id));
create policy reviews_staff_moderate on public.film_reviews for update to authenticated
 using(exists(select 1 from public.site_staff s where s.user_id=(select auth.uid()) and s.site_id=film_reviews.site_id))
 with check(exists(select 1 from public.site_staff s where s.user_id=(select auth.uid()) and s.site_id=film_reviews.site_id));

-- Secure admin notices. Recipients can only read and mark own notification as read.
grant insert on public.member_notifications to authenticated;
create policy notices_staff_send on public.member_notifications for insert to authenticated
 with check(exists(select 1 from public.site_staff s where s.user_id=(select auth.uid()) and s.site_id=member_notifications.site_id and s.role='admin'));
-- Admin can discover opted-in member ids, never expose raw auth table.
create policy memberships_admin_read on public.site_memberships for select to authenticated
 using(exists(select 1 from public.site_staff s where s.user_id=(select auth.uid()) and s.site_id=site_memberships.site_id and s.role='admin'));
grant select on public.site_memberships to authenticated;
commit;