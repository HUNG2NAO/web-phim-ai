-- AI FILM NETWORK — nạp bản sao lưu logic (JSON) vào một database MỚI, CÔ LẬP.
-- KHÔNG chạy trên staging/production đang hoạt động. Không chứa dữ liệu; dữ liệu nằm trong file JSON đã mã hóa.
-- Điều kiện: database đích đã có schema (supabase_shim + db/*.sql theo thứ tự tests/sql/run.sh,
-- hoặc project Supabase mới đã chạy cùng các migration).
-- Cách dùng (psql):
--   psql -d <db_moi> -v ON_ERROR_STOP=1 -v backup_file=/duong/dan/afn_data_YYYYMMDD.json -f tools/restore-logical-backup.sql
-- Mật khẩu người dùng KHÔNG có trong bản sao lưu: sau khi khôi phục, người dùng dùng "Quên mật khẩu".
\set ON_ERROR_STOP 1
\set content `cat :backup_file`
begin;
set local session_replication_role = replica;  -- tắt trigger/FK khi nạp, giữ nguyên dữ liệu gốc
create temp table _afn_backup(j jsonb) on commit drop;
insert into _afn_backup values (:'content'::jsonb);

do $$
declare
  b jsonb := (select j from _afn_backup);
  t text;
  tables text[] := array['profiles','site_memberships','network_staff','site_staff','reward_rules','site_films',
    'site_episodes','episode_sources','site_social_links','wallets','wallet_ledger','daily_checkins',
    'content_entitlements','viewer_profiles','viewer_preferences','film_library','watch_progress','film_reviews',
    'approved_reviews','member_notifications','member_privacy_requests','content_reports','traffic_events',
    'chat_messages','chat_reports','chat_mutes','admin_audit_log'];
  r record;
begin
  if exists (select 1 from public.wallet_ledger) or exists (select 1 from public.chat_messages) then
    raise exception 'STOP: database đích đã có dữ liệu — chỉ khôi phục vào database mới';
  end if;
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at)
    select id, email, email_confirmed_at, coalesce(raw_user_meta_data, '{}'), created_at
    from jsonb_to_recordset(b->'auth_users') as x(id uuid, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb, created_at timestamptz)
    on conflict (id) do nothing;
  delete from public.reward_rules;  -- migration tạo sẵn 1 dòng mặc định; thay bằng bản sao lưu
  foreach t in array tables loop
    execute format('insert into public.%I overriding system value select * from jsonb_populate_recordset(null::public.%I, $1)', t, t)
      using b->t;
  end loop;
  for r in select c.relname tbl, a.attname col, pg_get_serial_sequence('public.'||quote_ident(c.relname), a.attname) seq
    from pg_attribute a join pg_class c on c.oid = a.attrelid
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and a.attnum > 0
      and pg_get_serial_sequence('public.'||quote_ident(c.relname), a.attname) is not null
  loop
    execute format('select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)', r.seq, r.col, r.tbl);
  end loop;
  raise notice 'OK: đã nạp % bảng; auth.identities (%) chỉ nạp khi khôi phục lên Supabase thật', array_length(tables,1), jsonb_array_length(b->'auth_identities');
end $$;
commit;
