-- AI FILM NETWORK — dữ liệu GIẢ LẬP cho đo tải trên CSDL CÔ LẬP (không bao giờ chạy trên Staging/Production).
-- 1.000 thành viên, 5 website × 20 phim × 10 tập, ví 500 điểm/người, 30 ngày điểm danh, 100.000 tin chat.
\set ON_ERROR_STOP 1
do $$ begin
  if exists (select 1 from public.site_films where film_id = 'qa-test-blender-open-movies') then
    raise exception 'STOP: đây có vẻ là Staging thật (có phim QA) — chỉ chạy trên CSDL cô lập';
  end if;
end $$;
set session_replication_role = replica;   -- nạp nhanh, bỏ trigger nghiệp vụ khi seed
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select ('bbbbbbbb-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'load' || n || '@example.test', now(), jsonb_build_object('display_name', 'Tải ' || n)
from generate_series(1, 1000) n on conflict do nothing;
insert into public.profiles(id, display_name) select id, raw_user_meta_data->>'display_name' from auth.users where email like 'load%@example.test' on conflict do nothing;
insert into public.network_staff(user_id) values ('bbbbbbbb-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.site_films(site_id, film_id, title, source_kind, youtube_id, rights_attested, published, created_by, film_type)
select s, 'phim-' || f, 'Phim ' || s || ' ' || f, 'youtube', 'AAAAAAAAAAA', true, true, 'bbbbbbbb-0000-4000-8000-000000000001', 'bo'
from unnest(array['xuongphim','khophim','phephim','phimhay','ghienphim']) s, generate_series(1, 20) f on conflict do nothing;
insert into public.site_episodes(site_id, film_id, episode_no, title, access_tier, price_points, published, created_by)
select f.site_id, f.film_id, e, 'Tập ' || e, case when e <= 3 then 'free' else 'early' end, case when e <= 3 then 0 else 10 end, true, f.created_by
from public.site_films f, generate_series(1, 10) e where f.film_id like 'phim-%' on conflict do nothing;
insert into public.episode_sources(episode_id, source_kind, youtube_id)
select id, 'youtube', 'BBBBBBBBBBB' from public.site_episodes where film_id like 'phim-%' on conflict do nothing;
insert into public.wallet_ledger(user_id, kind, delta, balance_after, idempotency_key, note)
select id, 'admin_credit', 500, 500, 'load-seed-' || id, 'Điểm giả lập' from auth.users where email like 'load%' on conflict do nothing;
insert into public.wallets(user_id, balance, earned_total) select id, 500, 500 from auth.users where email like 'load%' on conflict do nothing;
insert into public.daily_checkins(user_id, checkin_date, site_id, streak, points)
select u.id, private.vn_today() - d, 'xuongphim', 1, 0 from auth.users u, generate_series(1, 30) d where u.email like 'load%' on conflict do nothing;
insert into public.chat_messages(room, user_id, display_name, body, created_at)
select case when g % 5 = 0 then 'network' else 'film:' || (array['xuongphim','khophim','phephim','phimhay','ghienphim'])[1 + g % 5] || ':phim-' || (1 + g % 20) end,
       ('bbbbbbbb-0000-4000-8000-' || lpad((1 + g % 1000)::text, 12, '0'))::uuid, 'Tải ' || (1 + g % 1000), 'Tin giả lập số ' || g,
       now() - (g || ' seconds')::interval * 25
from generate_series(1, 100000) g;
set session_replication_role = origin;
analyze;
select (select count(*) from auth.users) users, (select count(*) from public.site_episodes) episodes, (select count(*) from public.chat_messages) chat;
