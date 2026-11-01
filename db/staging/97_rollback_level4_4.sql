-- AI FILM NETWORK — GỠ Level 4.4 (db/level4_4_chat_switch.sql), đưa CSDL về đúng Level 4.3.
-- CHỈ dùng trên STAGING. Không xóa tin nhắn/báo cáo. Sau khi gỡ, mọi phòng chat MỞ như Level 4.3.
-- Muốn gỡ toàn bộ Level 4: chạy 97 → 98 → 99.
begin;
drop trigger if exists chat_guard_message on public.chat_messages;
drop trigger if exists chat_guard_report on public.chat_reports;
drop function if exists private.chat_guard_message();
drop function if exists private.chat_guard_report();
drop function if exists public.admin_set_chat_enabled(text, boolean, text);
drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages for select to authenticated
  using (not hidden or user_id = (select auth.uid())
    or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid()))
    or (room <> 'network' and exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.site_id = split_part(room, ':', 2)))
    or (room = 'network' and exists (select 1 from public.site_staff s where s.user_id = (select auth.uid()) and s.role = 'admin')));
drop function if exists private.chat_open(text);
drop function if exists private.chat_scope(text);
drop table if exists public.chat_settings;
commit;
