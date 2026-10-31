-- AI FILM NETWORK — GỠ migration Level 4 (db/level4_rewards_unlock_social_v1.sql).
-- CHỈ dùng trên STAGING, hoặc khi CHƯA có điểm / lượt mở khóa thật. Khi đã có dữ liệu thật:
-- KHÔNG gỡ. Thay vào đó tắt điểm danh trong Dashboard và gỡ phát hành các tập bị khóa.
-- Đưa CSDL về đúng trạng thái Level 3 (kể cả chính sách site_films cũ, vốn có lỗi khách không đọc được phim).
-- Được kiểm thử tự động: tests/sql/run.sh áp migration → gỡ → so sánh schema với Level 3 → áp lại.
begin;

-- 1. Trigger Level 4 gắn trên bảng Level 3
drop trigger if exists audit_site_films on public.site_films;
drop trigger if exists audit_review_moderation on public.film_reviews;

-- 2. Hàm public mới
drop function if exists public.claim_daily_checkin(text);
drop function if exists public.unlock_episode(uuid, text);
drop function if exists public.get_playback_source(uuid);
drop function if exists public.log_landing(text, text, text, text, text, text, text);
drop function if exists public.admin_set_reward_rules(boolean, integer, integer, integer, integer);
drop function if exists public.admin_adjust_points(uuid, integer, text, text);
drop function if exists public.admin_refund_unlock(uuid, text);
drop function if exists public.admin_overview(text);
drop function if exists public.admin_member_wallets(text);
drop function if exists public.admin_member_ledger(text, uuid);
drop function if exists public.admin_site_entitlements(text);
drop function if exists public.admin_traffic(text, integer);
drop function if exists public.admin_site_staff(text);

drop function if exists private.episode_is_open(public.site_episodes);

-- 3. Bảng Level 4 (CASCADE gỡ luôn trigger, chính sách và chỉ mục của chính các bảng này)
drop table if exists public.content_entitlements, public.daily_checkins, public.wallet_ledger, public.wallets,
  public.episode_sources, public.site_episodes, public.site_social_links, public.content_reports,
  public.traffic_events, public.admin_audit_log, public.reward_rules, public.network_staff cascade;

-- 4. Hàm private mới (giữ nguyên schema private và các hàm Level 3 trong đó)
drop function if exists private.audit_row() cascade;
drop function if exists private.audit_source() cascade;
drop function if exists private.limit_reports() cascade;
drop function if exists private.audit(text, text, text, jsonb);
drop function if exists private.lock_wallet(uuid);
drop function if exists private.is_network_admin();
drop function if exists private.is_site_admin(text);
drop function if exists private.is_site_staff(text);
drop function if exists private.valid_site(text);
drop function if exists private.vn_today();

-- 5. Trả lại chính sách đọc site_films của Level 3
drop policy if exists site_films_anon_published on public.site_films;
drop policy if exists site_films_member_read on public.site_films;
drop policy if exists site_films_public_published on public.site_films;
create policy site_films_public_published on public.site_films for select to anon, authenticated using (
  published or exists (select 1 from public.site_staff s where s.user_id = (select auth.uid())
    and s.site_id = site_films.site_id and s.role = 'admin'));

-- 6. Phải không còn đối tượng Level 4 nào
do $$
declare n int;
begin
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where (s.nspname = 'public' and p.proname in ('claim_daily_checkin','unlock_episode','get_playback_source','log_landing')
          or p.proname like 'admin\_%' and s.nspname = 'public')
      or (s.nspname = 'private' and p.proname in ('audit','audit_row','audit_source','limit_reports','lock_wallet','episode_is_open',
          'is_network_admin','is_site_admin','is_site_staff','valid_site','vn_today'));
  if n > 0 then raise exception 'ROLLBACK CHƯA SẠCH: còn % hàm Level 4', n; end if;
  if to_regclass('public.wallets') is not null then raise exception 'ROLLBACK CHƯA SẠCH: còn bảng Level 4'; end if;
  raise notice 'PASS: đã gỡ toàn bộ Level 4, site_films trở về chính sách Level 3';
end $$;
commit;
