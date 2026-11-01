#!/usr/bin/env bash
# Runs the Level 4 SQL suite against a THROWAWAY local PostgreSQL (16+).
# Usage: PGHOST=/tmp/pgdata PGPORT=54329 PGUSER=postgres tests/sql/run.sh
# Never point this at a real Supabase project: it drops and recreates database "afn_test".
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=afn_test
P="psql -X -q -v ON_ERROR_STOP=1"
$P -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
for f in tests/sql/supabase_shim.sql db/auth_v1.sql db/level3_pilot.sql db/level3_completion_v1.sql \
         db/level3_engagement_v1.sql db/level3_policy_performance_cleanup.sql db/level3_fk_indexes.sql \
         db/level4_rewards_unlock_social_v1.sql db/level4_1_playback_fallback.sql db/level4_2_community_chat.sql db/level4_3_isolation_privacy.sql db/level4_4_chat_switch.sql db/level4_5_grant_hardening.sql db/level4_6_staff_mfa.sql tests/sql/seed.sql; do
  $P -d $DB -f "$f" >/dev/null 2>&1 || { echo "APPLY FAILED: $f"; $P -d $DB -f "$f"; exit 1; }
done
# Re-applying the Level 4 migration must be safe (idempotent).
$P -d $DB -f db/level4_rewards_unlock_social_v1.sql >/dev/null 2>&1 || { echo "RE-APPLY FAILED"; exit 1; }
$P -d $DB -f db/level4_1_playback_fallback.sql >/dev/null 2>&1 || { echo "RE-APPLY 4.1 FAILED"; exit 1; }
$P -d $DB -f db/level4_2_community_chat.sql >/dev/null 2>&1 || { echo "RE-APPLY 4.2 FAILED"; exit 1; }
$P -d $DB -f db/level4_3_isolation_privacy.sql >/dev/null 2>&1 || { echo "RE-APPLY 4.3 FAILED"; exit 1; }
$P -d $DB -f db/level4_4_chat_switch.sql >/dev/null 2>&1 || { echo "RE-APPLY 4.4 FAILED"; exit 1; }
$P -d $DB -f db/level4_5_grant_hardening.sql >/dev/null 2>&1 || { echo "RE-APPLY 4.5 FAILED"; exit 1; }
$P -d $DB -f db/level4_6_staff_mfa.sql >/dev/null 2>&1 || { echo "RE-APPLY 4.6 FAILED"; exit 1; }

$P -d $DB -f tests/sql/level4_tests.sql 2>&1 | grep -E "PASS|FAIL|ERROR" | sed 's/^.*NOTICE:  //' | tee /tmp/afn_sql_results.txt
grep -q "FAIL\|ERROR" /tmp/afn_sql_results.txt && { echo "SQL FUNCTIONAL TESTS FAILED"; exit 1; }

# ---- concurrency: many simultaneous requests from one account -----------------------
call(){ # $1=user $2=sql
  $P -d $DB -t -A -c "begin; set local role authenticated; select t.as_user('$1'); $2; commit;" >/dev/null 2>&1 || true
}
C=aaaaaaaa-0000-4000-8000-000000000006; D=aaaaaaaa-0000-4000-8000-000000000007; E=aaaaaaaa-0000-4000-8000-000000000008
q(){ $P -d $DB -t -A -c "$1"; }
pass=0; fail=0
check(){ if [ "$1" = "$2" ]; then echo "PASS: $3"; pass=$((pass+1)); else echo "FAIL: $3 (expected $2, got $1)"; fail=$((fail+1)); fi; }

for i in $(seq 1 30); do call $C "select public.claim_daily_checkin('xuongphim')" & done; wait
check "$(q "select count(*) from daily_checkins where user_id='$C'")" 1 "30 simultaneous check-ins → exactly 1 recorded"
check "$(q "select balance from wallets where user_id='$C'")" "$(q "select points from daily_checkins where user_id='$C'")" "balance equals the single check-in reward"

q "insert into wallets(user_id,balance,earned_total) values ('$D',60,60) on conflict (user_id) do update set balance=60, earned_total=60" >/dev/null
q "insert into wallet_ledger(user_id,kind,delta,balance_after,idempotency_key) values ('$D','admin_credit',60,60,'seed-d-0001')" >/dev/null
for i in $(seq 1 10); do call $D "select public.unlock_episode('eeeeeeee-0000-4000-8000-000000000002','race-d-ep2-$i')" &
                        call $D "select public.unlock_episode('eeeeeeee-0000-4000-8000-000000000007','race-d-ep7-$i')" & done; wait
check "$(q "select count(*) from content_entitlements where user_id='$D'")" 1 "double-spend race (2 episodes x 10 requests, balance for 1) → only 1 unlock"
check "$(q "select balance from wallets where user_id='$D'")" 10 "balance after race = 60 - 50 = 10, never negative"

q "insert into wallets(user_id,balance,earned_total) values ('$E',500,500) on conflict (user_id) do update set balance=500, earned_total=500" >/dev/null
q "insert into wallet_ledger(user_id,kind,delta,balance_after,idempotency_key) values ('$E','admin_credit',500,500,'seed-e-0001')" >/dev/null
for i in $(seq 1 30); do call $E "select public.unlock_episode('eeeeeeee-0000-4000-8000-000000000002','race-e-$((i%3))-key')" & done; wait
check "$(q "select count(*) from wallet_ledger where user_id='$E' and kind='unlock'")" 1 "30 simultaneous unlocks of one episode (mixed keys) → charged once"
check "$(q "select balance from wallets where user_id='$E'")" 450 "balance after duplicate requests = 450"
check "$(q "select count(*) from wallets w where balance <> (select coalesce(sum(delta),0) from wallet_ledger l where l.user_id=w.user_id)")" 0 "ledger reconciles with every wallet after races"

# ---- staging helper scripts must stay valid against the migrated schema ------------------
pre=$($P -d $DB -t -A -f db/staging/00_preflight_readonly.sql | grep -c '|f|' || true)
check "$pre" 0 "staging preflight script: no failing prerequisite"
ver=$($P -d $DB -f db/staging/90_verify_after_level4.sql 2>&1 | grep -c "PASS:" || true)
check "$ver" 5 "staging verify script: 5 PASS checks, then ROLLBACK"
check "$(q "select count(*) from auth.users where email like 'staging-check%'")" 0 "staging verify script leaves no data behind"

# ---- rollback script: Level 4 → gỡ → phải trùng khớp Level 3, rồi áp lại được ---------------
sig(){ $P -d $1 -t -A -c "select string_agg(x, E'\n' order by x) from (
  select 'table '||tablename x from pg_tables where schemaname='public'
  union all select 'policy '||tablename||'.'||policyname||' '||array_to_string(roles,',')||' '||coalesce(qual,'')||' '||coalesce(with_check,'') from pg_policies where schemaname='public'
  union all select 'fn '||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
  union all select 'trigger '||tgrelid::regclass||'.'||tgname from pg_trigger where not tgisinternal) s"; }
RB=afn_rollback
$P -d postgres -c "drop database if exists $RB" -c "create database $RB" >/dev/null 2>&1
for f in tests/sql/supabase_shim.sql db/auth_v1.sql db/level3_pilot.sql db/level3_completion_v1.sql db/level3_engagement_v1.sql \
         db/level3_policy_performance_cleanup.sql db/level3_fk_indexes.sql; do $P -d $RB -f "$f" >/dev/null 2>&1; done
before=$(sig $RB)
$P -d $RB -f db/level4_rewards_unlock_social_v1.sql >/dev/null 2>&1
$P -d $RB -f db/level4_1_playback_fallback.sql >/dev/null 2>&1
$P -d $RB -f db/level4_2_community_chat.sql >/dev/null 2>&1
$P -d $RB -f db/staging/99_rollback_level4.sql >/dev/null 2>&1 || { echo "ROLLBACK SCRIPT FAILED"; $P -d $RB -f db/staging/99_rollback_level4.sql; }
after=$(sig $RB)
[ "$before" = "$after" ] && check same same "rollback script returns the schema exactly to Level 3" || { check differ same "rollback script returns the schema exactly to Level 3"; diff <(echo "$before") <(echo "$after") | head -20; }
$P -d $RB -f db/level4_rewards_unlock_social_v1.sql >/dev/null 2>&1 && $P -d $RB -f db/level4_1_playback_fallback.sql >/dev/null 2>&1 && $P -d $RB -f db/level4_2_community_chat.sql >/dev/null 2>&1 && check ok ok "Level 4 migration re-applies cleanly after rollback" || check fail ok "Level 4 migration re-applies cleanly after rollback"

# ---- Level 4.3 rollback: áp 4.3 → gỡ bằng 98 → schema (kể cả cột, ràng buộc, quyền) trùng 4.2 → áp lại 4.3 ------
sig43(){ $P -d $1 -t -A -c "select string_agg(x, E'\n' order by x) from (
  select 'policy '||tablename||'.'||policyname||' '||cmd||' '||coalesce(qual,'')||' '||coalesce(with_check,'') x from pg_policies where schemaname='public'
  union all select 'fn '||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
  union all select 'col '||table_name||'.'||column_name||' '||is_nullable from information_schema.columns where table_schema='public'
  union all select 'con '||conrelid::regclass||' '||pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace
  union all select 'idx '||indexname from pg_indexes where schemaname='public'
  union all select 'grant '||table_name||' '||grantee||' '||privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role')
  union all select 'seqacl '||c.relname||' '||pg_get_userbyid(a.grantee)||' '||a.privilege_type from pg_class c, aclexplode(c.relacl) a where c.relkind='S' and c.relnamespace='public'::regnamespace
  union all select 'defacl '||d.defaclobjtype::text||' '||pg_get_userbyid(a.grantee)||' '||a.privilege_type from pg_default_acl d, aclexplode(d.defaclacl) a
  union all select 'colgrant '||table_name||'.'||column_name||' '||grantee||' '||privilege_type from information_schema.column_privileges where table_schema='public' and grantee='authenticated' and privilege_type='UPDATE'
  union all select 'trigger '||tgrelid::regclass||'.'||tgname from pg_trigger where not tgisinternal) s"; }
R3=afn_rollback43
$P -d postgres -c "drop database if exists $R3" -c "create database $R3" >/dev/null 2>&1
for f in tests/sql/supabase_shim.sql db/auth_v1.sql db/level3_pilot.sql db/level3_completion_v1.sql db/level3_engagement_v1.sql \
         db/level3_policy_performance_cleanup.sql db/level3_fk_indexes.sql db/level4_rewards_unlock_social_v1.sql \
         db/level4_1_playback_fallback.sql db/level4_2_community_chat.sql; do $P -d $R3 -f "$f" >/dev/null 2>&1; done
b43=$(sig43 $R3)
$P -d $R3 -f db/level4_3_isolation_privacy.sql >/dev/null 2>&1
mid43=$(sig43 $R3)
$P -d $R3 -f db/staging/98_rollback_level4_3.sql >/dev/null 2>&1 || { echo "ROLLBACK 4.3 FAILED"; $P -d $R3 -f db/staging/98_rollback_level4_3.sql; }
a43=$(sig43 $R3)
[ "$b43" != "$mid43" ] && check ok ok "4.3 actually changes the schema" || check same differ "4.3 actually changes the schema"
[ "$b43" = "$a43" ] && check same same "98 rollback returns the schema exactly to Level 4.2" || { check differ same "98 rollback returns the schema exactly to Level 4.2"; diff <(echo "$b43") <(echo "$a43") | head -20; }
# 4.4 → gỡ bằng 97 → về đúng 4.3
$P -d $R3 -f db/level4_3_isolation_privacy.sql >/dev/null 2>&1; b44=$(sig43 $R3)
$P -d $R3 -f db/level4_4_chat_switch.sql >/dev/null 2>&1; m44=$(sig43 $R3)
$P -d $R3 -f db/staging/97_rollback_level4_4.sql >/dev/null 2>&1 || { echo "ROLLBACK 4.4 FAILED"; $P -d $R3 -f db/staging/97_rollback_level4_4.sql; }
a44=$(sig43 $R3)
[ "$b44" != "$m44" ] && check ok ok "4.4 actually changes the schema" || check same differ "4.4 actually changes the schema"
[ "$b44" = "$a44" ] && check same same "97 rollback returns the schema exactly to Level 4.3" || { check differ same "97 rollback returns the schema exactly to Level 4.3"; diff <(echo "$b44") <(echo "$a44") | head -20; }
# 4.5 → gỡ bằng 96 → quyền về đúng 4.4
$P -d $R3 -f db/level4_4_chat_switch.sql >/dev/null 2>&1; b45=$(sig43 $R3)
$P -d $R3 -f db/level4_5_grant_hardening.sql >/dev/null 2>&1; m45=$(sig43 $R3)
$P -d $R3 -f db/staging/96_rollback_level4_5.sql >/dev/null 2>&1 || { echo "ROLLBACK 4.5 FAILED"; $P -d $R3 -f db/staging/96_rollback_level4_5.sql; }
a45=$(sig43 $R3)
[ "$b45" != "$m45" ] && check ok ok "4.5 actually changes privileges" || check same differ "4.5 actually changes privileges"
[ "$b45" = "$a45" ] && check same same "96 rollback restores privileges exactly to Level 4.4" || { check differ same "96 rollback restores privileges exactly to Level 4.4"; diff <(echo "$b45") <(echo "$a45") | head -20; }
$P -d $R3 -f db/level4_5_grant_hardening.sql >/dev/null 2>&1; b46=$(sig43 $R3)
$P -d $R3 -f db/level4_6_staff_mfa.sql >/dev/null 2>&1 || { echo "APPLY 4.6 FAILED"; $P -d $R3 -f db/level4_6_staff_mfa.sql; }; m46=$(sig43 $R3)
$P -d $R3 -f db/staging/95_rollback_level4_6.sql >/dev/null 2>&1 || { echo "ROLLBACK 4.6 FAILED"; $P -d $R3 -f db/staging/95_rollback_level4_6.sql; }
a46=$(sig43 $R3)
[ "$b46" != "$m46" ] && check ok ok "4.6 actually changes the schema" || check same differ "4.6 actually changes the schema"
[ "$b46" = "$a46" ] && check same same "95 rollback returns the schema exactly to Level 4.5" || { check differ same "95 rollback returns the schema exactly to Level 4.5"; diff <(echo "$b46") <(echo "$a46") | head -20; }
$P -d $R3 -f db/staging/96_rollback_level4_5.sql >/dev/null 2>&1
$P -d $R3 -f db/staging/97_rollback_level4_4.sql >/dev/null 2>&1
$P -d $R3 -f db/staging/98_rollback_level4_3.sql >/dev/null 2>&1
$P -d $R3 -f db/staging/99_rollback_level4.sql >/dev/null 2>&1 && check ok ok "95 → 96 → 97 → 98 → 99 removes all of Level 4" || check fail ok "95 → 96 → 97 → 98 → 99 removes all of Level 4"
$P -d $R3 -f db/level4_rewards_unlock_social_v1.sql >/dev/null 2>&1 && $P -d $R3 -f db/level4_1_playback_fallback.sql >/dev/null 2>&1 && $P -d $R3 -f db/level4_2_community_chat.sql >/dev/null 2>&1 && $P -d $R3 -f db/level4_3_isolation_privacy.sql >/dev/null 2>&1 && $P -d $R3 -f db/level4_4_chat_switch.sql >/dev/null 2>&1 && $P -d $R3 -f db/level4_5_grant_hardening.sql >/dev/null 2>&1 && $P -d $R3 -f db/level4_6_staff_mfa.sql >/dev/null 2>&1 && check ok ok "Level 4 → 4.6 re-applies cleanly after full rollback" || check fail ok "Level 4 → 4.6 re-applies cleanly after full rollback"

for i in $(seq 1 20); do call $C "select public.send_chat_message('network','race chat $i')" & done; wait
check "$(q "select count(*) from chat_messages where user_id='$C'")" 5 "20 simultaneous chat sends from one user → rate limit holds at 5"

echo "Concurrency/staging: $pass passed, $fail failed"
total=$(grep -c PASS /tmp/afn_sql_results.txt)
echo "Functional: $total passed"
[ "$fail" = 0 ] || exit 1
# Khôi phục 2FA của chủ mạng khi mất thiết bị (trích nguyên văn khối A/B của db/staging/94_mfa_break_glass.sql)
tests/sql/owner_mfa_recovery.sh | tail -1
# Level 4.7 — nền đa ngôn ngữ (chỉ thêm): áp 2 lần (idempotent), kiểm thử, gỡ bằng 93_rollback rồi áp lại
for i in 1 2; do $P -d $DB -f db/level4_7_media_languages.sql >/dev/null 2>&1 || { echo "APPLY 4.7 FAILED"; $P -d $DB -f db/level4_7_media_languages.sql; exit 1; }; done
{ $P -d $DB -f tests/sql/level4_7_tests.sql 2>&1 || true; } | grep -E "PASS|FAIL|ERROR" | sed 's/^.*NOTICE:  //' > /tmp/afn_sql_47.txt || true
grep -q "FAIL\|ERROR" /tmp/afn_sql_47.txt && { cat /tmp/afn_sql_47.txt | grep "FAIL\|ERROR"; echo "LEVEL 4.7 TESTS FAILED"; exit 1; }
$P -d $DB -f db/staging/93_rollback_level4_7.sql >/dev/null && [ "$($P -d $DB -t -A -c "select count(*) from pg_tables where tablename in ('episode_media','episode_subtitles')")" = 0 ] \
  && [ "$($P -d $DB -t -A -c "select count(*) from public.episode_sources")" = 8 ] || { echo "ROLLBACK 4.7 FAILED"; exit 1; }
$P -d $DB -f db/level4_7_media_languages.sql >/dev/null 2>&1 || { echo "RE-APPLY 4.7 FAILED"; exit 1; }
echo "LEVEL 4.7: $(grep -c PASS /tmp/afn_sql_47.txt) passed, rollback + re-apply OK"
