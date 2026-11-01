#!/usr/bin/env bash
# AI FILM NETWORK — dựng môi trường ĐO TẢI CÔ LẬP mô phỏng 1 instance Supabase gói Free/Nano trên máy cục bộ:
#   PostgreSQL + PostgREST cùng nằm trong 1 cgroup (mặc định 512 MB RAM, 1 nhân CPU) — giống Supabase, nơi CSDL và API
#   chạy chung một máy ảo; cấu hình PostgreSQL theo bảng của Supabase cho Nano (max_connections 60, shared_buffers 128 MB…).
#   Dữ liệu 100% giả lập (tools/loadtest/seed-synthetic.sql). KHÔNG kết nối tới Supabase Staging/Production, không phát sinh chi phí.
# Dùng (root, có PostgreSQL 16 + postgrest + python3):
#   NANO_DIR=/tmp/afn-nano PGBIN=/usr/lib/postgresql/16/bin POSTGREST=/path/postgrest tools/loadtest/nano-env.sh up [mem_mb] [cpu_pct]
#   tools/loadtest/nano-env.sh down
# Kết quả: REST tại http://127.0.0.1:3001, tokens.json (1.000 JWT giả lập, ký bằng khóa NGẪU NHIÊN chỉ dùng cục bộ).
set -euo pipefail
cd "$(dirname "$0")/../.."
NANO_DIR=${NANO_DIR:-/tmp/afn-nano}; PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}; POSTGREST=${POSTGREST:-postgrest}
PORT=${NANO_PORT:-54330}; API_PORT=${API_PORT:-3001}; MEM=${2:-512}; CPU=${3:-100}
CG_MEM=/sys/fs/cgroup/memory/afn_nano; CG_CPU=/sys/fs/cgroup/cpu/afn_nano
P="psql -X -q -v ON_ERROR_STOP=1 -h $NANO_DIR -p $PORT -U postgres"

join_cgroup() {   # cgroup v1; nếu không có quyền thì chạy không giới hạn và ghi rõ
  if mkdir -p "$CG_MEM" "$CG_CPU" 2>/dev/null && echo $((MEM*1024*1024)) > "$CG_MEM/memory.limit_in_bytes" 2>/dev/null; then
    echo 100000 > "$CG_CPU/cpu.cfs_period_us"; echo $((CPU*1000)) > "$CG_CPU/cpu.cfs_quota_us"
    echo $$ > "$CG_MEM/cgroup.procs"; echo $$ > "$CG_CPU/cgroup.procs"
    echo "cgroup: RAM ${MEM} MB, CPU ${CPU}% của 1 nhân (PostgreSQL + PostgREST)"
  else echo "CẢNH BÁO: không tạo được cgroup — số đo sẽ cao hơn Nano thật"; fi
}

if [ "${1:-}" = "down" ]; then
  pkill -f "postgrest $NANO_DIR/postgrest.conf" 2>/dev/null || true
  su postgres -c "$PGBIN/pg_ctl -D $NANO_DIR/db -m fast stop" 2>/dev/null || true
  echo "đã dừng (dữ liệu giả lập vẫn ở $NANO_DIR; xóa bằng: rm -rf $NANO_DIR)"; exit 0
fi

mkdir -p "$NANO_DIR"; chown postgres "$NANO_DIR"
if [ ! -d "$NANO_DIR/db" ]; then su postgres -c "$PGBIN/initdb -D $NANO_DIR/db -A trust -U postgres -E UTF8 --locale=C.UTF-8" >/dev/null; fi
cat > "$NANO_DIR/db/conf.d.nano" <<EOF
# Cấu hình Supabase công bố cho compute Nano/Micro (https://supabase.com/docs/guides/platform/compute-and-disk)
max_connections = 60
shared_buffers = 128MB
effective_cache_size = 384MB
work_mem = 2184kB
maintenance_work_mem = 32MB
max_worker_processes = 6
max_parallel_workers = 2
max_parallel_workers_per_gather = 1
EOF
grep -q "conf.d.nano" "$NANO_DIR/db/postgresql.conf" || echo "include = 'conf.d.nano'" >> "$NANO_DIR/db/postgresql.conf"
join_cgroup
su postgres -c "$PGBIN/pg_ctl -D $NANO_DIR/db -l $NANO_DIR/log -o '-p $PORT -k $NANO_DIR -c listen_addresses=' -w start" >/dev/null

if ! $P -d postgres -tAc "select 1 from pg_database where datname='afn_load'" | grep -q 1; then
  $P -d postgres -c "create database afn_load" >/dev/null
  for f in tests/sql/supabase_shim.sql db/auth_v1.sql db/level3_pilot.sql db/level3_completion_v1.sql db/level3_engagement_v1.sql \
           db/level3_policy_performance_cleanup.sql db/level3_fk_indexes.sql db/level4_rewards_unlock_social_v1.sql \
           db/level4_1_playback_fallback.sql db/level4_2_community_chat.sql db/level4_3_isolation_privacy.sql \
           db/level4_4_chat_switch.sql db/level4_5_grant_hardening.sql db/level4_6_staff_mfa.sql; do $P -d afn_load -f "$f" >/dev/null; done
  $P -d afn_load -f tools/loadtest/seed-synthetic.sql >/dev/null
  $P -d afn_load -c "analyze" >/dev/null
fi
$P -d afn_load >/dev/null <<'EOF'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'local-only-authenticator';
  end if;
end $$;
grant anon, authenticated to authenticator;
EOF

SECRET=$(python3 -c "import secrets;print(secrets.token_urlsafe(48))")
cat > "$NANO_DIR/postgrest.conf" <<EOF
db-uri = "postgres://authenticator:local-only-authenticator@/afn_load?host=$NANO_DIR&port=$PORT"
db-schemas = "public"
db-anon-role = "anon"
db-pool = 15
jwt-secret = "$SECRET"
server-host = "127.0.0.1"
server-port = $API_PORT
log-level = "error"
EOF
nohup "$POSTGREST" "$NANO_DIR/postgrest.conf" > "$NANO_DIR/postgrest.log" 2>&1 &
python3 - "$SECRET" "$NANO_DIR/tokens.json" <<'EOF'
import sys, json, hmac, hashlib, base64, time
secret, out = sys.argv[1].encode(), sys.argv[2]
b = lambda x: base64.urlsafe_b64encode(x).rstrip(b"=").decode()
h = b(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
toks = []
for n in range(1, 1001):
    p = b(json.dumps({"sub": "bbbbbbbb-0000-4000-8000-%012d" % n, "role": "authenticated", "aal": "aal1", "exp": int(time.time()) + 86400}).encode())
    s = b(hmac.new(secret, (h + "." + p).encode(), hashlib.sha256).digest())
    toks.append(h + "." + p + "." + s)
json.dump(toks, open(out, "w"))
EOF
for i in $(seq 1 30); do curl -fs "http://127.0.0.1:$API_PORT/reward_rules" >/dev/null 2>&1 && break; sleep 0.5; done
echo "REST: http://127.0.0.1:$API_PORT  tokens: $NANO_DIR/tokens.json"
