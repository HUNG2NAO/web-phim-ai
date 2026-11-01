#!/usr/bin/env bash
# Đo từng bậc tải cố định trên môi trường cô lập (nano-env.sh phải đang chạy). In bảng: trang/giây → p50/p95/p99, lỗi, CPU/RAM cgroup.
# Dùng: K6=/path/k6 tools/loadtest/run-nano-steps.sh out_dir "20 33 50 65 80 100"
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=${1:-/tmp/afn-nano/steps}; RATES=${2:-"20 33 50 65 80 100"}; K6=${K6:-k6}; mkdir -p "$OUT"
CG=/sys/fs/cgroup/memory/afn_nano
printf "%-6s %-8s %-8s %-8s %-8s %-8s %-9s %-8s\n" rate pages p50_ms p95_ms p99_ms failed writes mem_mb
for r in $RATES; do
  [ -f $CG/memory.max_usage_in_bytes ] && echo 0 > $CG/memory.max_usage_in_bytes 2>/dev/null || true
  "$K6" run --quiet -e MODEL=${MODEL:-full} -e MAX_RATE=${MAX_RATE:-160} -e RATE=$r -e API=http://127.0.0.1:3001 -e TOKENS=/tmp/afn-nano/tokens.json --summary-export="$OUT/r$r.json" tools/loadtest/k6-nano-local.js > "$OUT/r$r.txt" 2>&1 || true
  mem=$(( $(cat $CG/memory.max_usage_in_bytes 2>/dev/null || echo 0) / 1048576 ))
  python3 - "$OUT/r$r.json" "$r" "$mem" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))["metrics"]; pm=d["page_ms"]
it=d["iterations"]["count"]; fail=d.get("http_req_failed",{}).get("value",0); w=d.get("writes_ok",{}).get("count",0)
print(f"{sys.argv[2]:<6} {it/45:<8.1f} {pm['med']:<8.0f} {pm['p(95)']:<8.0f} {pm['p(99)']:<8.0f} {fail*100:<8.2f} {w:<9} {sys.argv[3]:<8}")
PY
  sleep 5
done
