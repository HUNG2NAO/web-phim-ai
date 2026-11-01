-- AI FILM NETWORK — NGHIỆM THU Level 4.7 trên Supabase Staging. CHỈ ĐỌC (mọi kiểm tra ghi đều nằm trong giao dịch tự hủy).
-- Trình tự đã duyệt:
--   0. Backup mã hóa trước khi áp (quy trình 16:15: tools/backup-encrypt-age.sh → giải mã thử trên PC).
--   1. Áp db/level4_7_media_languages.sql (apply_migration "level4_7_media_languages") — chỉ khi chủ dự án phê duyệt.
--   2. Chạy tệp này. Mọi dòng phải đạt; nếu không → db/staging/93_rollback_level4_7.sql (chỉ xóa 2 bảng mới + 2 hàm mới).

-- A. Cấu trúc & quyền
select 'tables_rls' k, (select count(*) from pg_tables where schemaname='public' and tablename in ('episode_media','episode_subtitles') and rowsecurity)::text v, '2' expect
union all select 'public_tables_rls_all', (select count(*) from pg_tables where schemaname='public' and not rowsecurity)::text, '0'
union all select 'mfa_gates_total', (select count(*) from pg_policies where policyname like 'mfa_gate_%')::text, '35'
union all select 'dangerous_grants', (select count(*) from private.dangerous_grants())::text, '0'
union all select 'anon_reads_media_table', has_table_privilege('anon','public.episode_media','select')::text, 'false'
union all select 'anon_exec_get_playback_media', has_function_privilege('anon','public.get_playback_media(uuid,text)','execute')::text, 'true'
union all select 'audit_triggers', (select count(*) from pg_trigger where tgname in ('audit_episode_media','audit_episode_subtitles'))::text, '2'
union all select 'legacy_sources_unchanged', (select count(*) from public.episode_sources)::text, '(bằng số trước khi áp)'
union all select 'migrations', (select count(*) from supabase_migrations.schema_migrations)::text, '16';

-- B. Hành vi (giao dịch tự hủy: thêm 1 nguồn YouTube + phụ đề TH cho tập QA miễn phí, đọc như khách, rồi ROLLBACK)
begin;
insert into public.episode_media(episode_id, language, provider, external_id, published, rights_attested)
  select id, 'vi', 'youtube', 'VERIFYxxx01', true, true from public.site_episodes where film_id = 'qa-test-blender-open-movies' and episode_no = 1 and site_id = 'xuongphim';
insert into public.episode_subtitles(episode_id, language, source, published)
  select id, 'th', 'youtube', true from public.site_episodes where film_id = 'qa-test-blender-open-movies' and episode_no = 1 and site_id = 'xuongphim';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select 'free_ep_as_guest' k, public.get_playback_media((select id from public.site_episodes where film_id = 'qa-test-blender-open-movies' and episode_no = 1 and site_id = 'xuongphim'), 'th')::text v,
       'status ok, legacy false, sources[0].external_id VERIFYxxx01, subtitles[th youtube]' expect
union all select 'early_ep_as_guest', public.get_playback_media((select id from public.site_episodes where film_id = 'qa-test-blender-open-movies' and episode_no = 2 and site_id = 'xuongphim'))::text,
       'login_required, KHÔNG có media/sources';
rollback;
-- Sau ROLLBACK: không còn dòng nào
select 'left_after_rollback' k, ((select count(*) from public.episode_media) + (select count(*) from public.episode_subtitles))::text v, '0' expect;
