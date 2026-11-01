-- Level 4.7 — nền đa ngôn ngữ / nhiều nguồn phát. Chạy trên CSDL thử "afn_test" sau tests/sql/run.sh (dùng t.ok / t.err / t.as_aal).
\set ON_ERROR_STOP 1
\set B '''aaaaaaaa-0000-4000-8000-000000000002'''
\set OWNER '''aaaaaaaa-0000-4000-8000-000000000003'''
\set KADMIN '''aaaaaaaa-0000-4000-8000-000000000004'''
\set XMOD '''aaaaaaaa-0000-4000-8000-000000000005'''
\set EP1 '''eeeeeeee-0000-4000-8000-000000000001'''
\set EP2 '''eeeeeeee-0000-4000-8000-000000000002'''
\set EP3 '''eeeeeeee-0000-4000-8000-000000000003'''
\set K1 '''eeeeeeee-0000-4000-8000-000000000011'''

select t.ok((select count(*) from pg_tables where schemaname = 'public' and tablename in ('episode_media', 'episode_subtitles') and rowsecurity) = 2, '4.7: 2 new tables, RLS on');
select t.ok((select count(*) from private.dangerous_grants()) = 0, '4.7: dangerous_grants() still 0');
select t.ok((select count(*) from pg_policies where tablename in ('episode_media', 'episode_subtitles') and policyname like 'mfa_gate_%' and permissive = 'RESTRICTIVE') = 8, '4.7: 8 restrictive 2FA gates');
select t.ok(not has_table_privilege('anon', 'public.episode_media', 'select'), '4.7: anon cannot read media table directly');
select t.ok((select count(*) from public.episode_sources) = 8, '4.7: legacy episode_sources untouched');

-- Quản trị viên Kho Phim: ghi được cho tập của Kho Phim, KHÔNG ghi được cho Xưởng Phim
begin; set local role authenticated; select t.as_aal(:KADMIN, 'aal1');
insert into public.episode_media(episode_id, language, provider, external_id, published, rights_attested) values (:K1, 'vi', 'youtube', 'KVIxxxxxxxx', true, true);
select t.ok((select count(*) from public.episode_media where episode_id = :K1) = 1, 'Kho admin adds a Vietnamese source to a Kho Phim episode');
select t.err($$insert into public.episode_media(episode_id, language, provider, external_id) values ('eeeeeeee-0000-4000-8000-000000000001', 'vi', 'youtube', 'XXXXXXXXXXX')$$, 'row-level security', 'Kho admin cannot add media to a Xưởng Phim episode');
commit;
-- Thành viên / moderator: không đọc, không ghi bảng
begin; set local role authenticated; select t.as_aal(:B, 'aal1');
select t.ok((select count(*) from public.episode_media) = 0, 'member reads 0 media rows directly');
select t.err($$insert into public.episode_media(episode_id, language, provider, external_id) values ('eeeeeeee-0000-4000-8000-000000000011', 'th', 'youtube', 'XXXXXXXXXXX')$$, 'row-level security', 'member cannot insert media');
commit;
begin; set local role authenticated; select t.as_aal(:XMOD, 'aal1');
select t.err($$insert into public.episode_subtitles(episode_id, language, url) values ('eeeeeeee-0000-4000-8000-000000000001', 'vi', 'https://x.test/a.vtt')$$, 'row-level security', 'moderator (not admin) cannot add subtitles');
commit;

-- Ràng buộc nguồn phát (chủ mạng, aal2)
begin; set local role authenticated; select t.as_aal(:OWNER, 'aal2');
select t.err($$insert into public.episode_media(episode_id, language, provider, external_id) values ('eeeeeeee-0000-4000-8000-000000000001', 'vi', 'youtube', 'bad id')$$, 'media_provider_valid', 'invalid YouTube id rejected');
select t.err($$insert into public.episode_media(episode_id, language, provider, url) values ('eeeeeeee-0000-4000-8000-000000000001', 'vi', 'facebook', 'https://evil.example/video')$$, 'media_provider_valid', 'Facebook source must be a facebook.com URL');
select t.err($$insert into public.episode_media(episode_id, language, provider, url) values ('eeeeeeee-0000-4000-8000-000000000001', 'vi', 'native', 'http://insecure.test/a.mp4')$$, 'media_provider_valid', 'native source must be https');
select t.err($$insert into public.episode_media(episode_id, language, provider, external_id, published) values ('eeeeeeee-0000-4000-8000-000000000001', 'vi', 'youtube', 'AAAAAAAAAAA', true)$$, 'media_published_needs_rights', 'cannot publish without rights attestation');
select t.err($$insert into public.episode_media(episode_id, language, provider, external_id) values ('eeeeeeee-0000-4000-8000-000000000001', 'Vietnamese', 'youtube', 'AAAAAAAAAAA')$$, 'language_check', 'language must be a BCP 47 code');
-- Tập 1 (miễn phí): vi (YouTube công khai + Drive dự phòng), th (lồng tiếng YouTube không công khai), id (Facebook), phụ đề vi/th/id
insert into public.episode_media(episode_id, language, track_kind, provider, external_id, url, priority, published, rights_attested) values
 (:EP1, 'vi', 'original', 'youtube', 'VIxxxxxxxxx', null, 0, true, true),
 (:EP1, 'vi', 'original', 'gdrive', '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', null, 1, true, true),
 (:EP1, 'th', 'dub', 'youtube_unlisted', 'THxxxxxxxxx', null, 0, true, true),
 (:EP1, 'id', 'subtitled', 'facebook', null, 'https://www.facebook.com/afn/videos/123456789', 0, true, true),
 (:EP1, 'en', 'dub', 'youtube', 'ENxxxxxxxxx', null, 0, false, false);                        -- bản nháp: không hiện
insert into public.episode_subtitles(episode_id, language, url, is_default, published) values
 (:EP1, 'vi', 'https://cdn.example.test/ep1.vi.vtt', true, true),
 (:EP1, 'th', 'https://cdn.example.test/ep1.th.vtt', false, true),
 (:EP1, 'id', 'https://cdn.example.test/ep1.id.vtt', false, true);
insert into public.episode_media(episode_id, language, provider, external_id, published, rights_attested) values (:EP2, 'th', 'youtube', 'T2xxxxxxxxx', true, true);
select t.err($$insert into public.episode_subtitles(episode_id, language, url, is_default) values ('eeeeeeee-0000-4000-8000-000000000001', 'en', 'https://x.test/en.vtt', true)$$, 'one_default', 'only one default subtitle per episode');
commit;

-- Người xem (khách, anon): chọn ngôn ngữ trên CÙNG một tập phim
begin; set local role anon; select set_config('request.jwt.claims', '{"role":"anon"}', true);
select t.ok((public.get_playback_media(:EP1)->>'language') = 'vi', 'default language = vi');
select t.ok((public.get_playback_media(:EP1)->'languages') = '["id", "th", "vi"]'::jsonb, 'available languages: id, th, vi (unpublished en hidden)');
select t.ok(jsonb_array_length(public.get_playback_media(:EP1, 'vi')->'sources') = 2
        and (public.get_playback_media(:EP1, 'vi')->'sources'->0->>'provider') = 'youtube'
        and (public.get_playback_media(:EP1, 'vi')->'sources'->1->>'provider') = 'gdrive', 'vi: YouTube first, Drive as fallback (priority)');
select t.ok((public.get_playback_media(:EP1, 'th')->'sources'->0->>'provider') = 'youtube_unlisted'
        and (public.get_playback_media(:EP1, 'th')->'sources'->0->>'track_kind') = 'dub', 'switch to Thai dub without a new film record');
select t.ok((public.get_playback_media(:EP1, 'id')->'sources'->0->>'provider') = 'facebook', 'Indonesian: Facebook public video');
select t.ok((public.get_playback_media(:EP1, 'en')->>'language') = 'vi', 'unpublished language falls back to vi');
select t.ok(jsonb_array_length(public.get_playback_media(:EP1)->'subtitles') = 3, 'subtitles VI/TH/ID listed');
select t.ok((public.get_playback_media(:EP2)->>'status') = 'login_required' and not (public.get_playback_media(:EP2) ? 'sources'), 'locked episode: no media leaked to guests');
select t.ok((public.get_playback_media(:EP3)->>'legacy')::boolean and (public.get_playback_media(:EP3)->>'youtube_id') = 'EP3xxxxxxxx', 'episode without media: legacy v1 source still served');
select t.ok((public.get_playback_source(:EP1)->>'youtube_id') = 'EP1xxxxxxxx', 'get_playback_source v1 unchanged');
commit;
begin; set local role authenticated; select t.as_aal(:B, 'aal1');
select t.ok((public.get_playback_media(:EP2, 'th')->>'status') = 'locked', 'member without entitlement: locked, no media');
commit;

delete from public.episode_subtitles; delete from public.episode_media;
