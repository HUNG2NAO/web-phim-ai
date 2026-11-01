-- AI FILM NETWORK — PRE-FLIGHT trước khi chạy db/level4_rewards_unlock_social_v1.sql
-- CHỈ ĐỌC: không tạo, sửa hay xóa gì. Chạy trong Supabase → SQL Editor của project STAGING
-- (hoặc ai-film-network nếu bạn chủ động chọn dùng nó làm staging; Production website hiện CHƯA dùng Supabase).
-- Mọi dòng phải có ok = true trước khi chạy migration Level 4.
with checks(item, ok, detail) as (
  select 'Schema auth + auth.uid() có sẵn (Supabase)',
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'auth' and p.proname = 'uid'),
         'Bắt buộc'
  union all
  select 'Level 3: bảng ' || t, to_regclass('public.' || t) is not null, 'Phải chạy các migration Level 3 trước'
  from unnest(array['profiles','site_memberships','viewer_profiles','viewer_preferences','film_library','watch_progress',
                    'film_reviews','member_notifications','site_staff','member_privacy_requests','site_films','approved_reviews']) t
  union all
  select 'Level 4 chưa tồn tại (hoặc đang chạy lại an toàn): ' || t,
         true,
         case when to_regclass('public.' || t) is null then 'chưa có — sẽ được tạo' else 'ĐÃ CÓ — migration chạy lại an toàn (idempotent)' end
  from unnest(array['wallets','wallet_ledger','daily_checkins','site_episodes','episode_sources','content_entitlements',
                    'site_social_links','content_reports','traffic_events','admin_audit_log','reward_rules','network_staff']) t
  union all
  select 'RLS đang bật trên mọi bảng Level 3',
         not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
                       and c.relname in ('profiles','site_memberships','viewer_profiles','viewer_preferences','film_library',
                                         'watch_progress','film_reviews','member_notifications','site_staff',
                                         'member_privacy_requests','site_films','approved_reviews')),
         'Nếu false: kiểm tra lại Level 3 trước khi tiếp tục'
  union all
  select 'Có ít nhất 1 quản trị viên site (site_staff.role = admin)',
         exists (select 1 from public.site_staff where role = 'admin'),
         'Cần để dùng Dashboard Level 4'
  union all
  select 'Chính sách site_films cũ (lỗi đọc của khách) — sẽ được thay',
         true,
         case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'site_films' and policyname = 'site_films_public_published')
              then 'đang có — migration sẽ tách thành chính sách anon/authenticated'
              else 'không có — đã được sửa trước đó' end
)
select item, ok, detail from checks order by ok, item;
