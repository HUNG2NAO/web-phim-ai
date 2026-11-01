-- AI FILM NETWORK — STAGING ONLY. Sao lưu dữ liệu QA vào schema riêng `qa_backup` TRƯỚC khi chạy 59_qa_cleanup.sql.
-- Không xóa gì. Chạy lại an toàn: mỗi lần tạo bảng có hậu tố thời điểm. Khôi phục: xem cuối tệp.
-- Phạm vi: 4 tài khoản QA cố định + phim đánh dấu QA. Không sao lưu mật khẩu / token (auth.users chỉ lấy id, email, thời điểm).
begin;
create schema if not exists qa_backup;
revoke all on schema qa_backup from public, anon, authenticated;
do $$
declare sfx text := to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD_HH24MI'); qa uuid[]; t text; n int; msg text := '';
begin
  select coalesce(array_agg(id), '{}') into qa from auth.users
   where lower(email) in ('hung2nao+qa1@gmail.com','hung2nao+qa2@gmail.com','hung2nao+qaadmin@gmail.com','hung2nao+signup1@gmail.com');
  execute format('create table qa_backup.users_%s as select id, email, created_at, email_confirmed_at from auth.users where id = any($1)', sfx) using qa;
  foreach t in array array['wallets','wallet_ledger','daily_checkins','content_entitlements','site_staff','chat_mutes','viewer_profiles'] loop
    execute format('create table qa_backup.%I as select * from public.%I where user_id = any($1)', t || '_' || sfx, t) using qa;
  end loop;
  execute format('create table qa_backup.chat_messages_%s as select * from public.chat_messages where user_id = any($1) or room = %L', sfx, 'film:xuongphim:qa-test-blender-open-movies') using qa;
  execute format('create table qa_backup.chat_reports_%s as select r.* from public.chat_reports r join public.chat_messages m on m.id = r.message_id where m.user_id = any($1) or r.reporter = any($1)', sfx) using qa;
  execute format('create table qa_backup.site_films_%s as select * from public.site_films where site_id = %L and film_id = %L', sfx, 'xuongphim', 'qa-test-blender-open-movies');
  execute format('create table qa_backup.site_episodes_%s as select * from public.site_episodes where site_id = %L and film_id = %L', sfx, 'xuongphim', 'qa-test-blender-open-movies');
  execute format('create table qa_backup.episode_sources_%s as select s.* from public.episode_sources s join public.site_episodes e on e.id = s.episode_id where e.site_id = %L and e.film_id = %L', sfx, 'xuongphim', 'qa-test-blender-open-movies');
  for t in select table_name from information_schema.tables where table_schema = 'qa_backup' and table_name like '%' || sfx loop
    execute format('select count(*) from qa_backup.%I', t) into n; msg := msg || t || '=' || n || '; ';
  end loop;
  raise notice 'Sao lưu xong: %', msg;
end $$;
commit;
-- KHÔI PHỤC (ví dụ, sau khi tài khoản QA đã được tạo lại với CÙNG id thì mới khôi phục được dữ liệu theo user_id):
--   insert into public.site_films select * from qa_backup.site_films_<sfx>;
--   insert into public.site_episodes select * from qa_backup.site_episodes_<sfx>;
--   insert into public.episode_sources select * from qa_backup.episode_sources_<sfx>;
-- Xóa bản sao lưu khi không cần nữa: drop schema qa_backup cascade;
