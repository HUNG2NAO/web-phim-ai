-- Deterministic fixtures for local SQL tests (fake users, example.test e-mails only).
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-4000-8000-000000000001', 'viewer-a@example.test', now(), '{}'),
 ('aaaaaaaa-0000-4000-8000-000000000002', 'viewer-b@example.test', now(), '{}'),
 ('aaaaaaaa-0000-4000-8000-000000000003', 'owner@example.test',    now(), '{}'),
 ('aaaaaaaa-0000-4000-8000-000000000004', 'kho-admin@example.test', now(), '{}'),
 ('aaaaaaaa-0000-4000-8000-000000000005', 'xp-mod@example.test',  now(), '{}'),
 ('aaaaaaaa-0000-4000-8000-000000000006', 'race-c@example.test',  now(), '{}'),
 ('aaaaaaaa-0000-4000-8000-000000000007', 'race-d@example.test',  now(), '{}'),
 ('aaaaaaaa-0000-4000-8000-000000000008', 'race-e@example.test',  now(), '{}');
insert into public.profiles(id, display_name) values
 ('aaaaaaaa-0000-4000-8000-000000000001', 'Khán giả A'),
 ('aaaaaaaa-0000-4000-8000-000000000002', 'Khán giả B');
insert into public.site_memberships(user_id, site_id) values
 ('aaaaaaaa-0000-4000-8000-000000000001', 'xuongphim'),
 ('aaaaaaaa-0000-4000-8000-000000000001', 'khophim'),
 ('aaaaaaaa-0000-4000-8000-000000000002', 'xuongphim'),
 ('aaaaaaaa-0000-4000-8000-000000000002', 'khophim');
insert into public.network_staff(user_id) values ('aaaaaaaa-0000-4000-8000-000000000003');
insert into public.site_staff(user_id, site_id, role) values
 ('aaaaaaaa-0000-4000-8000-000000000004', 'khophim', 'admin'),
 ('aaaaaaaa-0000-4000-8000-000000000005', 'xuongphim', 'moderator');

insert into public.site_films(site_id, film_id, title, source_kind, youtube_id, rights_attested, published, created_by, film_type) values
 ('xuongphim', 'tin-hieu-47', 'Tín Hiệu 47', 'youtube', 'AAAAAAAAAAA', true, true, 'aaaaaaaa-0000-4000-8000-000000000003', 'bo'),
 ('xuongphim', 'ban-nhap', 'Bản nháp', 'youtube', 'BBBBBBBBBBB', true, false, 'aaaaaaaa-0000-4000-8000-000000000003', 'le'),
 ('khophim', 'kiem-khach', 'Kiếm Khách', 'youtube', 'CCCCCCCCCCC', true, true, 'aaaaaaaa-0000-4000-8000-000000000004', 'bo');

insert into public.site_episodes(id, site_id, film_id, episode_no, title, access_tier, price_points, free_from, access_days, published, created_by) values
 ('eeeeeeee-0000-4000-8000-000000000001', 'xuongphim', 'tin-hieu-47', 1, 'Tập 1', 'free',   0,  null, null, true,  'aaaaaaaa-0000-4000-8000-000000000003'),
 ('eeeeeeee-0000-4000-8000-000000000002', 'xuongphim', 'tin-hieu-47', 2, 'Tập 2', 'early',  50, null, null, true,  'aaaaaaaa-0000-4000-8000-000000000003'),
 ('eeeeeeee-0000-4000-8000-000000000003', 'xuongphim', 'tin-hieu-47', 3, 'Tập 3', 'early',  50, now() - interval '1 hour', null, true, 'aaaaaaaa-0000-4000-8000-000000000003'),
 ('eeeeeeee-0000-4000-8000-000000000004', 'xuongphim', 'tin-hieu-47', 4, 'Tập 4', 'member', 0,  null, null, true,  'aaaaaaaa-0000-4000-8000-000000000003'),
 ('eeeeeeee-0000-4000-8000-000000000005', 'xuongphim', 'tin-hieu-47', 5, 'Tập 5', 'early',  1000, null, null, false, 'aaaaaaaa-0000-4000-8000-000000000003'),
 ('eeeeeeee-0000-4000-8000-000000000006', 'xuongphim', 'tin-hieu-47', 6, 'Tập 6', 'early',  50, null, 3,    true,  'aaaaaaaa-0000-4000-8000-000000000003'),
 ('eeeeeeee-0000-4000-8000-000000000007', 'xuongphim', 'tin-hieu-47', 7, 'Tập 7', 'early',  50, null, null, true,  'aaaaaaaa-0000-4000-8000-000000000003'),
 ('eeeeeeee-0000-4000-8000-000000000011', 'khophim',   'kiem-khach',  1, 'Tập 1', 'early',  30, null, null, true,  'aaaaaaaa-0000-4000-8000-000000000004');
insert into public.episode_sources(episode_id, source_kind, youtube_id, video_url) values
 ('eeeeeeee-0000-4000-8000-000000000001', 'youtube', 'EP1xxxxxxxx', null),
 ('eeeeeeee-0000-4000-8000-000000000002', 'youtube', 'EP2xxxxxxxx', null),
 ('eeeeeeee-0000-4000-8000-000000000003', 'youtube', 'EP3xxxxxxxx', null),
 ('eeeeeeee-0000-4000-8000-000000000004', 'native', null, 'https://media.example.test/ep4.mp4'),
 ('eeeeeeee-0000-4000-8000-000000000005', 'youtube', 'EP5xxxxxxxx', null),
 ('eeeeeeee-0000-4000-8000-000000000006', 'youtube', 'EP6xxxxxxxx', null),
 ('eeeeeeee-0000-4000-8000-000000000007', 'youtube', 'EP7xxxxxxxx', null),
 ('eeeeeeee-0000-4000-8000-000000000011', 'youtube', 'K01xxxxxxxx', null);
-- Level 4.1: episode 2 has a rights-cleared HTTPS backup source.
update public.episode_sources set fallback_kind = 'native', fallback_video_url = 'https://media.example.test/ep2-backup.mp4'
 where episode_id = 'eeeeeeee-0000-4000-8000-000000000002';
insert into public.site_social_links(site_id, platform, label, url, enabled) values
 ('xuongphim', 'facebook_page', 'Fanpage', 'https://www.facebook.com/example-test', true),
 ('xuongphim', 'telegram', 'Kênh ẩn', 'https://t.me/example_test', false);

create schema if not exists t;
grant usage on schema t to public;
create or replace function t.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if c is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'PASS: %', msg;
end $$;
create or replace function t.err(q text, pat text, msg text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm ~* pat then raise notice 'PASS: %', msg; return; end if;
    raise exception 'FAIL: % (got: %)', msg, sqlerrm;
  end;
  raise exception 'FAIL: % (no error raised)', msg;
end $$;
create or replace function t.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema t to public;
