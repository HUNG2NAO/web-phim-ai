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
         db/level4_rewards_unlock_social_v1.sql tests/sql/seed.sql; do
  $P -d $DB -f "$f" >/dev/null 2>&1 || { echo "APPLY FAILED: $f"; $P -d $DB -f "$f"; exit 1; }
done
# Re-applying the Level 4 migration must be safe (idempotent).
$P -d $DB -f db/level4_rewards_unlock_social_v1.sql >/dev/null 2>&1 || { echo "RE-APPLY FAILED"; exit 1; }

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

echo "Concurrency: $pass passed, $fail failed"
total=$(grep -c PASS /tmp/afn_sql_results.txt)
echo "Functional: $total passed"
[ "$fail" = 0 ]
