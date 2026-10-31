-- AI FILM NETWORK — STAGING ONLY. Gỡ dữ liệu QA sau nghiệm thu.
-- Mặc định là CHẠY THỬ (dry run): chỉ liệt kê số bản ghi sẽ bị xóa rồi dừng, không xóa gì.
-- Muốn xóa thật: đổi dòng `v_apply boolean := false` thành true SAU KHI đã đối chiếu số liệu.
-- Phạm vi: đúng 3 tài khoản QA cố định + phim đánh dấu QA. Tài khoản QA trong auth.users KHÔNG bị xóa
-- ở đây (xóa thủ công trong Dashboard → Users; ví/điểm/chat của chúng tự xóa theo ON DELETE CASCADE).
begin;
do $$
declare
  v_apply boolean := false;
  qa uuid[];
  other_ent int; other_reports int; r record; msg text := '';
begin
  select coalesce(array_agg(id), '{}') into qa from auth.users
   where lower(email) in ('hung2nao+qa1@gmail.com', 'hung2nao+qa2@gmail.com', 'hung2nao+qaadmin@gmail.com');
  msg := 'QA khớp=' || cardinality(qa);

  -- Đối chiếu: dữ liệu NGƯỜI KHÁC (không phải QA) có dính tới phim QA không? Có thì dừng, không xóa.
  select count(*) into other_ent from public.content_entitlements
   where site_id = 'xuongphim' and film_id = 'qa-test-blender-open-movies' and not (user_id = any(qa));
  select count(*) into other_reports from public.chat_reports cr join public.chat_messages m on m.id = cr.message_id
   where m.user_id = any(qa) and not (cr.reporter = any(qa));
  msg := msg || '; quyền xem phim QA của người KHÔNG phải QA=' || other_ent || '; báo cáo của người khác trên tin QA=' || other_reports;

  for r in
    select 'site_films (phim QA)' t, count(*) n from public.site_films where site_id = 'xuongphim' and film_id = 'qa-test-blender-open-movies'
    union all select 'site_episodes (phim QA)', count(*) from public.site_episodes where site_id = 'xuongphim' and film_id = 'qa-test-blender-open-movies'
    union all select 'content_entitlements (phim QA)', count(*) from public.content_entitlements where site_id = 'xuongphim' and film_id = 'qa-test-blender-open-movies'
    union all select 'site_staff (QA)', count(*) from public.site_staff where user_id = any(qa)
    union all select 'chat_messages (QA)', count(*) from public.chat_messages where user_id = any(qa)
    union all select 'chat_mutes (QA)', count(*) from public.chat_mutes where user_id = any(qa)
  loop msg := msg || '; sẽ xóa ' || r.t || '=' || r.n; end loop;

  if not v_apply then raise exception 'DRY RUN — chưa xóa gì. %. Đối chiếu rồi đặt v_apply := true.', msg; end if;
  if other_ent > 0 or other_reports > 0 then raise exception 'STOP: có dữ liệu người không phải QA liên quan — xử lý thủ công'; end if;

  delete from public.chat_mutes where user_id = any(qa);
  delete from public.chat_messages where user_id = any(qa);          -- cascade: chat_reports trên các tin này
  delete from public.site_staff where user_id = any(qa);
  delete from public.site_films where site_id = 'xuongphim' and film_id = 'qa-test-blender-open-movies';  -- cascade: tập, nguồn, quyền xem
  raise notice 'ĐÃ XÓA dữ liệu QA: %', msg;
end $$;
commit;
