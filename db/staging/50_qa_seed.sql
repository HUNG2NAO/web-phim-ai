-- AI FILM NETWORK — DỮ LIỆU QA CHO STAGING (không bao giờ chạy trên Production).
-- Một phim thử nghiệm "QA TEST" trên Xưởng Phim, dùng video mã nguồn mở của Blender Foundation
-- (Big Buck Bunny · Sintel · Tears of Steel — giấy phép Creative Commons Attribution, © Blender Foundation).
-- Tập 1 miễn phí · Tập 2 mở sớm 30 điểm (có nguồn dự phòng MP4) · Tập 3 dành cho thành viên.
-- Gỡ toàn bộ bằng db/staging/59_qa_cleanup.sql.
begin;
insert into public.site_films(site_id, film_id, title, synopsis, genres, year, film_type, source_kind, youtube_id,
  rights_attested, published, created_by)
select 'xuongphim', 'qa-test-blender-open-movies', 'QA TEST · Phim mở Blender',
  'PHIM THỬ NGHIỆM QA (không phải nội dung chính thức). Video: Blender Foundation, giấy phép CC BY. Dùng để nghiệm thu điểm danh, mở khóa, trình phát và chat.',
  array['Viễn tưởng'], 2026, 'bo', 'youtube', 'aqz-KE-bpKQ', true, true, u.id
from auth.users u where u.id = '90b8b707-2a3d-4fa3-95e1-b34974230673'::uuid
on conflict (site_id, film_id) do nothing;

insert into public.site_episodes(site_id, film_id, episode_no, title, access_tier, price_points, published, created_by)
select 'xuongphim', 'qa-test-blender-open-movies', e.no, e.title, e.tier, e.price, true, '90b8b707-2a3d-4fa3-95e1-b34974230673'::uuid
from (values (1, 'Big Buck Bunny (miễn phí)', 'free', 0), (2, 'Sintel (mở sớm 30 điểm)', 'early', 30), (3, 'Tears of Steel (thành viên)', 'member', 0)) e(no, title, tier, price)
on conflict (site_id, film_id, episode_no) do nothing;

insert into public.episode_sources(episode_id, source_kind, youtube_id, fallback_kind, fallback_video_url)
select e.id, 'youtube', s.yt, s.fk, s.fu
from public.site_episodes e join (values
  (1, 'aqz-KE-bpKQ', 'native', 'https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4'),
  (2, 'eRsGyueVLvQ', 'native', 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4'),
  (3, 'R6MlUcmOul8', null, null)) s(no, yt, fk, fu) on s.no = e.episode_no
where e.site_id = 'xuongphim' and e.film_id = 'qa-test-blender-open-movies'
on conflict (episode_id) do nothing;
commit;
