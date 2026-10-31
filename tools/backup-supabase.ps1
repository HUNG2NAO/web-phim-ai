# AI FILM NETWORK — Sao lưu CSDL Supabase bằng pg_dump trên PC Nhân (gói Free KHÔNG có backup tự động).
# Chạy: double-click tools\Backup-Supabase.cmd
#
# YÊU CẦU: pg_dump / pg_restore / psql phiên bản 17 (Supabase đang chạy PostgreSQL 17.11).
#   Cách không cần cài: tải "PostgreSQL 17 Windows x64 binaries (zip)" từ trang chính thức EDB
#   (https://www.enterprisedb.com/download-postgresql-binaries), giải nén thư mục "pgsql" vào tools\pgsql\
#   (tools\pgsql\ đã nằm trong .gitignore). Hoặc cài PostgreSQL 17 (chỉ chọn "Command Line Tools").
#
# BẢO MẬT:
#   - Mật khẩu CSDL nhập qua ô ẩn, chỉ đặt vào biến môi trường PGPASSWORD của CHÍNH tiến trình này rồi xóa ngay.
#   - Không ghi mật khẩu/chuỗi kết nối vào log, tệp, lịch sử lệnh hay GitHub. Repo đang PUBLIC.
#   - Kết quả nằm ở backups\ (đã .gitignore). Tệp auth chứa mật khẩu ĐÃ BĂM của người dùng → cất nơi an toàn.
#
# KẾT QUẢ (backups\afn_<thời điểm>\):
#   schema_app.sql      cấu trúc schema public + private (bảng, hàm, policy, trigger, quyền)
#   data_app.dump       dữ liệu public + private (định dạng custom, khôi phục bằng pg_restore)
#   data_auth.dump      dữ liệu auth.users + auth.identities (tài khoản, KHÔNG gồm cấu hình Auth)
#   row_counts.txt      số dòng từng bảng lúc sao lưu (để đối chiếu sau khôi phục)
#   SHA256SUMS.txt      mã băm các tệp
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Find-Tool($name) {
  $local = Join-Path $root "tools\pgsql\bin\$name.exe"
  if (Test-Path $local) { return $local }
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "Không tìm thấy $name. Xem phần YÊU CẦU ở đầu tệp này."
}
$pgdump = Find-Tool "pg_dump"; $pgrestore = Find-Tool "pg_restore"; $psql = Find-Tool "psql"
$ver = & $pgdump --version
if ($ver -notmatch ' (1[7-9]|[2-9]\d)\.') { throw "Cần pg_dump >= 17 (đang có: $ver)" }
Write-Host "Dùng: $ver"

Write-Host ""
Write-Host "Lấy thông tin tại Supabase → project ai-film-network → Connect → 'Session pooler' (IPv4)."
$hostName = Read-Host "Host (ví dụ aws-0-ap-southeast-1.pooler.supabase.com)"
$user     = Read-Host "User (dạng postgres.jurvphonehknrxjpowoe)"
$port     = Read-Host "Port [5432]"; if (-not $port) { $port = "5432" }
if ($hostName -notmatch '^[a-z0-9.-]+$' -or $user -notmatch '^[a-z0-9._-]+$') { throw "Host/User không hợp lệ" }
$sec = Read-Host -AsSecureString "Mật khẩu CSDL (ẩn)"
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
$env:PGSSLMODE = "require"
$conn = @("--host=$hostName", "--port=$port", "--username=$user", "--dbname=postgres")

$stamp = Get-Date -Format "yyyyMMdd_HHmm"
$dir = Join-Path $root "backups\afn_$stamp"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
try {
  Write-Host "1/4 Schema public + private..."
  & $pgdump @conn --schema-only --no-owner --no-privileges --schema=public --schema=private --file (Join-Path $dir "schema_app.sql")
  if ($LASTEXITCODE) { throw "pg_dump schema lỗi" }
  Write-Host "2/4 Dữ liệu public + private..."
  & $pgdump @conn --data-only --format=custom --schema=public --schema=private --file (Join-Path $dir "data_app.dump")
  if ($LASTEXITCODE) { throw "pg_dump data lỗi" }
  Write-Host "3/4 Tài khoản (auth.users, auth.identities)..."
  & $pgdump @conn --data-only --format=custom --table=auth.users --table=auth.identities --file (Join-Path $dir "data_auth.dump")
  if ($LASTEXITCODE) { throw "pg_dump auth lỗi" }
  Write-Host "4/4 Đếm dòng để đối chiếu..."
  $q = "select schemaname||'.'||relname||'='||n_live_tup from pg_stat_user_tables where schemaname in ('public','private') union all select 'auth.users='||count(*) from auth.users order by 1"
  & $psql @conn -At -c $q | Out-File -Encoding utf8 (Join-Path $dir "row_counts.txt")
  if ($LASTEXITCODE) { throw "psql đếm dòng lỗi" }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

# Kiểm tra tệp đọc được (không cần kết nối)
foreach ($f in "data_app.dump", "data_auth.dump") {
  $n = (& $pgrestore --list (Join-Path $dir $f) | Select-String -Pattern "TABLE DATA").Count
  if ($LASTEXITCODE -or $n -lt 1) { throw "$f không đọc được hoặc rỗng" }
  Write-Host ("  {0}: {1} bảng dữ liệu" -f $f, $n)
}
Get-ChildItem $dir -File | Where-Object Name -ne "SHA256SUMS.txt" | ForEach-Object {
  "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name
} | Out-File -Encoding ascii (Join-Path $dir "SHA256SUMS.txt")
Get-ChildItem $dir -File | ForEach-Object { "{0,-18} {1,12:N0} bytes" -f $_.Name, $_.Length }
Write-Host ""
Write-Host "XONG: $dir"
Write-Host "Gửi cho Claude NỘI DUNG row_counts.txt và SHA256SUMS.txt (không chứa bí mật) để đối chiếu. KHÔNG gửi các tệp .dump/.sql."
