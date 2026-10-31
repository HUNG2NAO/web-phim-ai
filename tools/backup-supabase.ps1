# AI FILM NETWORK — sao lưu CSDL Supabase về máy (PC Nhân). Gói Free KHÔNG có backup tự động.
# Chạy: double-click tools\Backup-Supabase.cmd (hoặc: powershell -ExecutionPolicy Bypass -File tools\backup-supabase.ps1)
# - Hỏi chuỗi kết nối Postgres (Dashboard → Connect → Session pooler / URI). Chuỗi KHÔNG được lưu ở đâu cả.
# - Ghi 3 tệp vào thư mục backups\ (đã nằm trong .gitignore): schema, dữ liệu public/private, dữ liệu auth.
#   Tệp auth chứa mật khẩu ĐÃ BĂM của người dùng → giữ an toàn, KHÔNG commit, KHÔNG gửi lên chat.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "backups"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmm"
$sec = Read-Host -AsSecureString "Dán chuỗi kết nối Postgres (postgresql://...)"
$url = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
if ($url -notmatch '^postgres(ql)?://') { throw "Chuỗi kết nối không hợp lệ" }
Write-Host "Đang sao lưu schema..."
npx --yes supabase@latest db dump --db-url $url -f (Join-Path $dir "afn_schema_$stamp.sql")
Write-Host "Đang sao lưu dữ liệu (public, private)..."
npx --yes supabase@latest db dump --db-url $url --data-only --schema public,private -f (Join-Path $dir "afn_data_$stamp.sql")
Write-Host "Đang sao lưu tài khoản (auth.users, auth.identities)..."
npx --yes supabase@latest db dump --db-url $url --data-only --schema auth -f (Join-Path $dir "afn_auth_$stamp.sql")
$url = $null
Get-ChildItem $dir -Filter "*_$stamp.sql" | ForEach-Object { "{0,-40} {1,10:N0} bytes" -f $_.Name, $_.Length }
Write-Host "Xong. Lưu các tệp này ở nơi an toàn (không đưa lên GitHub — repo đang PUBLIC)."
