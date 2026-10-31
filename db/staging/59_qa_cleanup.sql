-- Gỡ dữ liệu QA (phim thử nghiệm, tin chat & quyền QA). Không đụng tài khoản/dữ liệu không thuộc QA.
begin;
delete from public.site_films where site_id = 'xuongphim' and film_id = 'qa-test-blender-open-movies';   -- cascade: tập, nguồn, quyền xem
delete from public.site_staff where user_id in (select id from auth.users where email ~ '\+qa[a-z0-9]*@');
delete from public.chat_messages where user_id in (select id from auth.users where email ~ '\+qa[a-z0-9]*@');
commit;
