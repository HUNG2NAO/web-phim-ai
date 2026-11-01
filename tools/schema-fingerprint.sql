-- AI FILM NETWORK — dấu vân tay schema + dữ liệu (CHỈ ĐỌC). Chạy trên Supabase và trên DB khôi phục rồi so sánh từng dòng.
-- Không in dữ liệu, chỉ in số lượng và md5. Dùng: psql -At -F ' ' -f tools/schema-fingerprint.sql
begin transaction read only;
select 'fn', count(*), md5(string_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'||md5(pg_get_functiondef(p.oid)), '|' order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind in ('f','p')
union all select 'policy', count(*), md5(string_agg(tablename||':'||policyname||':'||cmd||':'||array_to_string(roles,',')||':'||coalesce(qual,'')||':'||coalesce(with_check,''), '|' order by tablename, policyname)) from pg_policies where schemaname='public'
union all select 'rls_on', count(*) filter (where c.relrowsecurity), md5(string_agg(c.relname||':'||c.relrowsecurity, '|' order by c.relname)) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r'
union all select 'columns', count(*), md5(string_agg(table_name||'.'||column_name||':'||data_type||':'||is_nullable, '|' order by table_name, ordinal_position)) from information_schema.columns where table_schema='public'
union all select 'triggers', count(*), md5(string_agg(c.relname||':'||t.tgname, '|' order by c.relname, t.tgname)) from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relnamespace='public'::regnamespace and not t.tgisinternal
union all select 'wallet_sum', sum(balance)::bigint, md5(string_agg(user_id||':'||balance, '|' order by user_id)) from public.wallets
union all select 'ledger_mismatch', (select count(*) from public.wallets w where w.balance <> coalesce((select sum(delta) from public.wallet_ledger l where l.user_id=w.user_id),0)), ''
union all select 'auth_users', count(*), md5(string_agg(id||':'||email, '|' order by id)) from auth.users
union all select 'data_'||relname, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', relname), false, true, '')))[1]::text::bigint, md5(coalesce((xpath('/row/h/text()', query_to_xml(format('select string_agg(to_jsonb(t)::text, chr(10) order by to_jsonb(t)::text) h from public.%I t', relname), false, true, '')))[1]::text,'')) from pg_stat_user_tables where schemaname='public'
order by 1;
commit;
