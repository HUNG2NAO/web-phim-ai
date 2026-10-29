begin;
create index if not exists site_films_owner_index on public.site_films(created_by);
drop policy if exists reviews_read_own on public.film_reviews;
drop policy if exists reviews_staff_read on public.film_reviews;
create policy reviews_read_own_or_staff on public.film_reviews for select to authenticated
 using (user_id=(select auth.uid()) or exists(
 select 1 from public.site_staff s where s.user_id=(select auth.uid()) and s.site_id=film_reviews.site_id));
drop policy if exists membership_read_self on public.site_memberships;
drop policy if exists memberships_admin_read on public.site_memberships;
create policy memberships_read_self_or_admin on public.site_memberships for select to authenticated
 using (user_id=(select auth.uid()) or exists(
 select 1 from public.site_staff s where s.user_id=(select auth.uid())
 and s.site_id=site_memberships.site_id and s.role='admin'));
commit;