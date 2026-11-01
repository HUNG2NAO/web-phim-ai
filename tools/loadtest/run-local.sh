#!/usr/bin/env bash
# Đo tải TRÊN CSDL CÔ LẬP cục bộ (afn_load) — không bao giờ trỏ vào Supabase Staging/Production.
# Dùng: PGHOST=... PGPORT=... PGUSER=postgres tools/loadtest/run-local.sh [clients] [seconds]
set -euo pipefail
cd "$(dirname "$0")"
C=${1:-50}; T=${2:-20}; DB=${AFN_LOAD_DB:-afn_load}
[ "$DB" = "afn_load" ] || { echo "Chỉ chạy trên CSDL tên afn_load"; exit 1; }
for s in catalog playback chat-read checkin unlock chat-send; do
  out=$(pgbench -n -M simple -c "$C" -j 2 -T "$T" -f "$s.pgb" "$DB" 2>&1)
  tps=$(echo "$out" | sed -n 's/^tps = \([0-9.]*\).*/\1/p' | head -1)
  lat=$(echo "$out" | sed -n 's/^latency average = \([0-9.]*\) ms/\1/p')
  failed=$(echo "$out" | sed -n 's/^number of failed transactions: \([0-9]*\).*/\1/p')
  printf "%-10s clients=%-4s tps=%-10s avg_ms=%-8s failed=%s\n" "$s" "$C" "$tps" "$lat" "${failed:-0}"
done
