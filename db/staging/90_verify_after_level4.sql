-- AI FILM NETWORK — KIỂM TRA SAU KHI chạy db/level4_rewards_unlock_social_v1.sql trên STAGING.
-- Toàn bộ chạy trong MỘT transaction và kết thúc bằng ROLLBACK: không để lại người dùng, điểm hay dữ liệu nào.
-- Kết quả mong đợi: mọi NOTICE bắt đầu bằng "PASS:"; nếu có lỗi, transaction dừng tại "FAIL: ...".
begin;

do $$
declare n int;
begin
  -- 1. Cấu trúc
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and c.relname in ('wallets','wallet_ledger','daily_checkins','site_episodes','episode_sources','content_entitlements',
                       'site_social_links','content_reports','traffic_events','admin_audit_log','reward_rules','network_staff');
  if n <> 12 then raise exception 'FAIL: chỉ % / 12 bảng Level 4 có RLS', n; end if;
  raise notice 'PASS: 12 bảng Level 4 tồn tại và bật RLS';

  -- 2. Quyền: khách (anon) không được gọi hàm đổi điểm, được gọi hàm phát video
  if has_function_privilege('anon', 'public.claim_daily_checkin(text)', 'execute') then raise exception 'FAIL: anon gọi được claim_daily_checkin'; end if;
  if has_function_privilege('anon', 'public.unlock_episode(uuid,text)', 'execute') then raise exception 'FAIL: anon gọi được unlock_episode'; end if;
  if has_function_privilege('anon', 'public.admin_adjust_points(uuid,integer,text,text)', 'execute') then raise exception 'FAIL: anon gọi được admin_adjust_points'; end if;
  if not has_function_privilege('anon', 'public.get_playback_source(uuid)', 'execute') then raise exception 'FAIL: anon không gọi được get_playback_source'; end if;
  if has_table_privilege('authenticated', 'public.wallets', 'update') or has_table_privilege('authenticated', 'public.wallet_ledger', 'insert') then
    raise exception 'FAIL: người dùng có thể ghi trực tiếp vào ví/sổ cái';
  end if;
  if has_table_privilege('anon', 'public.episode_sources', 'select') then raise exception 'FAIL: anon đọc được nguồn phát'; end if;
  raise notice 'PASS: phân quyền hàm và bảng đúng thiết kế';

  -- 3. Sửa lỗi Level 3: khách đọc được phim đã phát hành
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='site_films' and policyname='site_films_anon_published') then
    raise exception 'FAIL: thiếu chính sách site_films_anon_published';
  end if;
  raise notice 'PASS: chính sách đọc phim cho khách đã có';
  if (select count(*) from public.reward_rules) <> 1 then raise exception 'FAIL: reward_rules phải có đúng 1 dòng'; end if;
  raise notice 'PASS: cấu hình điểm danh có sẵn';
end $$;

-- 4. Khách thật sự đọc được bảng phim (trước đây lỗi "permission denied for table site_staff")
set local role anon;
select count(*) as phim_cong_khai_khach_doc_duoc from public.site_films;
select count(*) as tap_cong_khai_khach_doc_duoc from public.site_episodes;
reset role;

-- 5. Nghiệp vụ điểm danh bằng một người dùng TẠM (bị xóa khi ROLLBACK)
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values ('00000000-0000-4000-8000-00000000cafe', 'staging-check@example.invalid', now(), '{}');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000cafe","role":"authenticated"}', true);
do $$
declare r jsonb; r2 jsonb;
begin
  r := public.claim_daily_checkin('xuongphim');
  if r->>'status' <> 'claimed' then raise exception 'FAIL: điểm danh lần đầu trả về %', r; end if;
  r2 := public.claim_daily_checkin('khophim');
  if r2->>'status' <> 'already' then raise exception 'FAIL: điểm danh lần 2 trong ngày trả về %', r2; end if;
  if (select balance from public.wallets) <> (r->>'points')::int then raise exception 'FAIL: số dư không khớp điểm thưởng'; end if;
  begin
    update public.wallets set balance = 999999;
    raise exception 'FAIL: người dùng sửa được số dư';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: điểm danh 1 lần/ngày toàn mạng, +% điểm, người dùng không sửa được số dư', r->>'points';
end $$;
reset role;

rollback;   -- BẮT BUỘC: không giữ lại bất kỳ dữ liệu kiểm tra nào
