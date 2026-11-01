-- AI FILM NETWORK — GỠ Level 4.3 (db/level4_3_isolation_privacy.sql), đưa CSDL về đúng Level 4.2.
-- CHỈ dùng trên STAGING. Muốn gỡ toàn bộ Level 4: chạy file này trước, rồi 99_rollback_level4.sql.
-- Tự dừng nếu đã có tài khoản bị xóa qua quy trình mới (bản ghi yêu cầu user_id NULL)
-- hoặc phim/tập mồ côi người tạo — để không làm mất bằng chứng xử lý.
-- Được kiểm thử tự động trong tests/sql/run.sh (áp 4.3 → gỡ → so sánh schema với 4.2).
begin;
do $$ begin
  if exists (select 1 from public.member_privacy_requests where user_id is null) then
    raise exception 'STOP: có yêu cầu của tài khoản đã xóa — không gỡ 4.3 để giữ bằng chứng';
  end if;
  if exists (select 1 from public.site_films where created_by is null) or exists (select 1 from public.site_episodes where created_by is null) then
    raise exception 'STOP: có phim/tập không còn người tạo — gán lại created_by trước khi gỡ';
  end if;
end $$;

drop function if exists public.admin_privacy_request_set_status(uuid, text, text);
drop function if exists public.admin_execute_account_deletion(uuid, text, boolean);
drop function if exists public.my_data_export();
drop trigger if exists privacy_request_subject on public.member_privacy_requests;
drop function if exists private.privacy_request_subject();
drop index if exists public.privacy_requests_one_open;

-- created_by: về lại NOT NULL + FK mặc định (NO ACTION)
alter table public.site_films drop constraint if exists site_films_created_by_fk;
alter table public.site_episodes drop constraint if exists site_episodes_created_by_fk;
alter table public.site_films alter column created_by set not null;
alter table public.site_episodes alter column created_by set not null;
alter table public.site_films add constraint site_films_created_by_fkey foreign key (created_by) references auth.users(id);
alter table public.site_episodes add constraint site_episodes_created_by_fkey foreign key (created_by) references auth.users(id);

-- member_privacy_requests: về lại xóa dây chuyền + quyền UPDATE trực tiếp của admin site
alter table public.member_privacy_requests drop constraint if exists member_privacy_requests_user_fk;
alter table public.member_privacy_requests alter column user_id set not null;
alter table public.member_privacy_requests add constraint member_privacy_requests_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.member_privacy_requests drop column if exists subject_id;
alter table public.member_privacy_requests drop column if exists handled_by;
grant update (status, handled_at, admin_note) on public.member_privacy_requests to authenticated;
drop policy if exists privacy_read_own_or_staff on public.member_privacy_requests;
create policy privacy_read_own_or_staff on public.member_privacy_requests for select to authenticated
 using (user_id=(select auth.uid()) or exists (
  select 1 from public.site_staff s where s.user_id=(select auth.uid())
  and s.site_id=member_privacy_requests.site_id));
drop policy if exists privacy_manage_by_staff on public.member_privacy_requests;
create policy privacy_manage_by_staff on public.member_privacy_requests for update to authenticated
 using (exists(select 1 from public.site_staff s where s.user_id=(select auth.uid())
  and s.site_id=member_privacy_requests.site_id and s.role='admin'))
 with check (exists(select 1 from public.site_staff s where s.user_id=(select auth.uid())
  and s.site_id=member_privacy_requests.site_id and s.role='admin'));

-- chat: về lại policy 4.2
drop policy if exists chat_reports_read on public.chat_reports;
create policy chat_reports_read on public.chat_reports for select to authenticated
  using (reporter = (select auth.uid()) or (exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))
    or exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()))));
drop policy if exists chat_mutes_read on public.chat_mutes;
create policy chat_mutes_read on public.chat_mutes for select to authenticated
  using (user_id = (select auth.uid()) or (exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))
    or exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()))));
commit;
