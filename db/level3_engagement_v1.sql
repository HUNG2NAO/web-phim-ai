-- Privacy-respecting public community feed + opt-in release notifications.
-- Scoped to ai-film-network only. All privileged triggers stay in unexposed private schema.
begin;
alter table public.viewer_preferences add column if not exists notify_followed_releases boolean not null default false;
alter table public.member_notifications add column if not exists event_key text;
create unique index if not exists member_notifications_delivery_dedupe
 on public.member_notifications(user_id,site_id,event_key) where event_key is not null;
create table if not exists public.approved_reviews (
 id uuid primary key references public.film_reviews(id) on delete cascade,
 site_id text not null check(site_id in ('xuongphim','khophim','phephim','phimhay','ghienphim')),
 film_id text not null,
 rating smallint not null check(rating between 1 and 5),
 content text not null,
 approved_at timestamptz not null default now()
);
create index if not exists approved_reviews_site_film on public.approved_reviews(site_id,film_id,approved_at desc);
alter table public.approved_reviews enable row level security;
revoke all on public.approved_reviews from anon,authenticated;
grant select on public.approved_reviews to anon,authenticated;
create policy approved_reviews_public_read on public.approved_reviews for select to anon,authenticated using(true);

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create or replace function private.reflect_review_approval()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
 if tg_op='DELETE' then
   delete from public.approved_reviews where id=old.id;
   return old;
 end if;
 if new.moderation_status='approved' then
   insert into public.approved_reviews(id,site_id,film_id,rating,content)
   values(new.id,new.site_id,new.film_id,new.rating,new.content)
   on conflict (id) do update set rating=excluded.rating,content=excluded.content,
    site_id=excluded.site_id,film_id=excluded.film_id;
 else
   delete from public.approved_reviews where id=new.id;
 end if;
 return new;
end;
$$;
revoke all on function private.reflect_review_approval() from public,anon,authenticated;
drop trigger if exists sync_review_public_feed on public.film_reviews;
create trigger sync_review_public_feed after insert or update or delete on public.film_reviews
 for each row execute function private.reflect_review_approval();

-- Backfill only preexisting approved reviews, without exposing user IDs.
insert into public.approved_reviews(id,site_id,film_id,rating,content)
select id,site_id,film_id,rating,content from public.film_reviews where moderation_status='approved'
on conflict(id) do nothing;

create or replace function private.notify_followed_release()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
 if new.published=true and new.rights_attested=true
 and (tg_op='INSERT' or old.published is distinct from true) then
  insert into public.member_notifications(user_id,site_id,title,body,event_key)
  select distinct l.user_id,new.site_id,'Phim bạn theo dõi đã phát hành',
    new.title||' đã có trên website. Bạn có thể mở Tủ phim để xem.',
    'film:'||new.film_id||':published'
  from public.film_library l
  join public.viewer_preferences p on p.viewer_profile_id=l.viewer_profile_id
   and p.user_id=l.user_id and p.site_id=l.site_id
  where l.site_id=new.site_id and l.film_id=new.film_id
   and l.collection='following' and p.notify_followed_releases=true
  on conflict do nothing;
 end if;
 return new;
end;
$$;
revoke all on function private.notify_followed_release() from public,anon,authenticated;
drop trigger if exists notify_followed_film_publish on public.site_films;
create trigger notify_followed_film_publish after insert or update of published on public.site_films
 for each row execute function private.notify_followed_release();
commit;