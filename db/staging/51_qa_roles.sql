-- AI FILM NETWORK — STAGING ONLY (project ai-film-network / jurvphonehknrxjpowoe).
-- Cấp quyền admin Xưởng Phim cho đúng MỘT tài khoản QA: hung2nao+qaadmin@gmail.com.
-- Không đụng tài khoản nào khác. Ghi nhật ký (actor = chủ mạng, lý do "QA TEST"). Gỡ bằng 59_qa_cleanup.sql.
-- Rào chắn: chỉ chạy khi CSDL có phim đánh dấu QA (50_qa_seed.sql) — tức là đúng staging đã seed.
begin;
do $$
declare v_admin uuid; v_owner uuid; n int;
begin
  if not exists (select 1 from public.site_films where site_id = 'xuongphim' and film_id = 'qa-test-blender-open-movies') then
    raise exception 'STOP: không thấy phim đánh dấu QA — đây có thể không phải staging';
  end if;
  select count(*) into n from auth.users where lower(email) = 'hung2nao+qaadmin@gmail.com';
  if n <> 1 then raise exception 'STOP: cần đúng 1 tài khoản hung2nao+qaadmin@gmail.com, thấy %', n; end if;
  select id into v_admin from auth.users where lower(email) = 'hung2nao+qaadmin@gmail.com' and email_confirmed_at is not null;
  if v_admin is null then raise exception 'STOP: tài khoản QA admin chưa xác minh email'; end if;
  if exists (select 1 from public.network_staff where user_id = v_admin) then raise exception 'STOP: tài khoản đã là network staff'; end if;
  select user_id into v_owner from public.network_staff where role = 'owner' limit 1;
  insert into public.site_staff(user_id, site_id, role) values (v_admin, 'xuongphim', 'admin')
    on conflict (user_id, site_id) do update set role = 'admin';
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform private.audit('xuongphim', 'qa.grant_site_admin', v_admin::text,
    jsonb_build_object('reason', 'QA TEST — quyền quản trị kiểm thử trên staging', 'role', 'admin', 'site', 'xuongphim'));
  raise notice 'OK: % là admin QA của xuongphim', v_admin;
end $$;
commit;
