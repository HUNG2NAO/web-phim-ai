#!/usr/bin/env bash
# AI FILM NETWORK — mã hóa bản sao lưu bằng KHÓA CÔNG KHAI age (không mật khẩu, không gì bí mật đi qua chat/log).
# Chủ hệ thống tự tạo cặp khóa trên PC (age-keygen); chỉ khóa CÔNG KHAI (age1…) được đưa vào recipient.txt.
# Người mã hóa (kể cả Claude) KHÔNG giải mã được — chỉ người giữ khóa bí mật mới giải mã.
# Dùng: AGE=/path/age tools/backup-encrypt-age.sh recipient.txt plain.json out_dir
#   → out_dir/<tên>.json.age  + out_dir/<tên>.manifest.txt (SHA-256 bản rõ và bản mã, không chứa dữ liệu)
#   Bản rõ bị xóa (shred) sau khi mã hóa xong.
set -euo pipefail
REC=$1; PLAIN=$2; OUT=$3; AGE=${AGE:-age}
KEY=$(grep -v '^#' "$REC" | tr -d '[:space:]')
[[ "$KEY" =~ ^age1[02-9ac-hj-np-z]{58}$ ]] || { echo "recipient.txt phải chứa đúng 1 khóa công khai age1… (KHÔNG phải khóa bí mật AGE-SECRET-KEY)"; exit 1; }
grep -q "AGE-SECRET-KEY" "$REC" && { echo "STOP: recipient.txt chứa KHÓA BÍ MẬT — xóa ngay, chỉ dùng dòng age1…"; exit 1; }
mkdir -p "$OUT"; base=$(basename "$PLAIN")
"$AGE" -r "$KEY" -o "$OUT/$base.age" "$PLAIN"
{
  echo "Tệp mã hóa: $base.age (age v1, X25519 → khóa công khai ${KEY:0:12}…${KEY: -6})"
  echo "SHA-256 bản rõ : $(sha256sum "$PLAIN" | cut -d' ' -f1)"
  echo "SHA-256 bản mã : $(sha256sum "$OUT/$base.age" | cut -d' ' -f1)"
  echo "Tạo lúc       : $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Giải mã + đối chiếu trên PC: nháy đúp tools\\Tao-Khoa-Backup.cmd (tự kiểm tra) hoặc tools\\verify-backup-age.ps1"
  echo "plain_sha256=$(sha256sum "$PLAIN" | cut -d' ' -f1)"
  echo "cipher_sha256=$(sha256sum "$OUT/$base.age" | cut -d' ' -f1)"
} > "$OUT/$base.manifest.txt"
shred -u "$PLAIN" 2>/dev/null || rm -f "$PLAIN"
cat "$OUT/$base.manifest.txt"
