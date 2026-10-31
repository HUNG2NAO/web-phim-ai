-- AI FILM NETWORK — STAGING ONLY. Cấp quyền quản trị QA cho tài khoản kiểm thử đã được chủ dự án tạo.
-- Chỉ khớp email dạng +qaadmin@ (tài khoản QA), không đụng tài khoản thật. Ghi nhật ký kiểm duyệt (actor = chủ mạng).
-- Gỡ: db/staging/59_qa_cleanup.sql (xóa mọi quyền site_staff của email +qa...).
begin;
do $$
declare v_admin uuid; v_owner uuid;
begin
  select id into v_admin from auth.users where email ~ '\+qaadmin@' and email_confirmed_at is not null;
  if v_admin is null then raise exception 'QA admin account (+qaadmin@) not found or not confirmed'; end if;
  select user_id into v_owner from public.network_staff where role = 'owner' limit 1;
  insert into public.site_staff(user_id, site_id, role) values (v_admin, 'xuongphim', 'admin')
    on conflict (user_id, site_id) do update set role = 'admin';
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform private.audit('xuongphim', 'qa.grant_site_admin', v_admin::text,
    jsonb_build_object('reason', 'QA TEST — quyền quản trị kiểm thử trên staging', 'role', 'admin'));
end $$;
commit;
