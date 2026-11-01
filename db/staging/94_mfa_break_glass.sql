-- AI FILM NETWORK — KHÔI PHỤC KHẨN CẤP 2FA nhân sự (Level 4.6). Chạy trong Supabase Dashboard → SQL Editor bởi CHỦ PROJECT
-- (tài khoản Supabase của chủ, KHÁC tài khoản đăng nhập website — nên bật 2FA riêng cho tài khoản Supabase).
-- Không xóa dữ liệu người dùng. Mỗi bước tự ghi nhật ký quản trị. Chạy TỪNG khối, đọc kết quả rồi mới chạy khối sau.
--
-- Tình huống:
--   (1) Nhân sự mất điện thoại / ứng dụng xác thực → chỉ đăng nhập được 1 lớp → tạm mất quyền QUẢN TRỊ (vẫn đăng nhập, xem phim, ví bình thường).
--   (2) Đã bật "bắt buộc 2FA" và cần mở lại tạm thời cho cả đội.
-- Đăng nhập (mật khẩu email) KHÔNG bao giờ bị khóa bởi Level 4.6 — cơ chế này chỉ quyết định quyền quản trị.

-- ===== Khối 0 — CHỈ ĐỌC: hiện trạng
select s.scope, s.role, left(s.user_id::text, 8) as user_short, u.email,
       (select count(*) from auth.mfa_factors f where f.user_id = s.user_id and f.status::text = 'verified') as verified_factors
  from (select user_id, 'network' as scope, role from public.network_staff
        union all select user_id, site_id, role from public.site_staff) s
  join auth.users u on u.id = s.user_id
 order by s.scope, s.role;
select staff_mfa_required, updated_at from private.security_settings;

-- ===== Khối A — tình huống (2): TẮT "bắt buộc 2FA cho nhân sự" (không đụng factor nào; bật lại trong Studio → Bảo mật)
-- begin;
-- update private.security_settings set staff_mfa_required = false, updated_at = now(), updated_by = null where id;
-- insert into public.admin_audit_log(actor, site_id, action, target, details)
--   values (null, null, 'security.mfa_required_off', 'break-glass', jsonb_build_object('reason', 'Khôi phục khẩn cấp từ SQL Editor'));
-- commit;

-- ===== Khối B — tình huống (1): GỠ factor 2FA của MỘT tài khoản nhân sự (sau khi đã xác minh danh tính người yêu cầu)
-- Thay email ở dòng v_email rồi bỏ dấu "--" của cả khối. Nhân sự đăng nhập lại → có lại quyền quản trị (nếu chưa bắt buộc 2FA),
-- rồi tự bật 2FA lại với thiết bị mới trong Studio → Bảo mật.
-- do $$
-- declare v_email text := 'THAY-EMAIL-NHAN-SU@example.com'; v_user uuid; v_n int;
-- begin
--   if v_email like 'THAY-EMAIL%' then raise exception 'Chưa thay email'; end if;
--   select id into v_user from auth.users where lower(email) = lower(v_email);
--   if v_user is null then raise exception 'Không tìm thấy tài khoản %', v_email; end if;
--   if not exists (select 1 from public.network_staff where user_id = v_user) and not exists (select 1 from public.site_staff where user_id = v_user) then
--     raise exception 'Tài khoản này không phải nhân sự — không dùng khối này';
--   end if;
--   delete from auth.mfa_factors where user_id = v_user;          -- chỉ factor 2FA; không đụng mật khẩu, ví, lịch sử
--   get diagnostics v_n = row_count;
--   insert into public.admin_audit_log(actor, site_id, action, target, details)
--     values (null, null, 'security.mfa_factor_reset', v_user::text, jsonb_build_object('factors_removed', v_n, 'via', 'break-glass SQL'));
--   raise notice 'Đã gỡ % factor của %', v_n, v_email;
-- end $$;
-- (Cách tương đương qua giao diện: Dashboard → Authentication → Users → chọn người → mục MFA → xóa factor.)

-- ===== Khối C — sự cố nghiêm trọng hơn: gỡ toàn bộ Level 4.6 (giữ nguyên dữ liệu) → chạy db/staging/95_rollback_level4_6.sql
