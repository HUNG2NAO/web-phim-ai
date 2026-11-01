# AI FILM NETWORK — Sao lưu CSDL Supabase bằng pg_dump trên PC Nhân (gói Free KHÔNG có backup tự động).
# Chạy: double-click tools\Backup-Supabase.cmd
#
# YÊU CẦU: pg_dump / pg_restore / psql phiên bản 17 (Supabase đang chạy PostgreSQL 17.11).
#   Cách không cần cài: tải "PostgreSQL 17 Windows x64 binaries (zip)" từ trang chính thức EDB
#   (https://www.enterprisedb.com/download-postgresql-binaries), giải nén vào %LOCALAPPDATA%\Programs\pgsql17\
#   (NGOÀI Git repo; script tự tìm ở đó, hoặc đặt biến AFN_PGBIN). Hoặc cài PostgreSQL 17 (chỉ chọn "Command Line Tools").
#
# BẢO MẬT:
#   - Mật khẩu CSDL nhập qua ô ẩn, chỉ đặt vào biến môi trường PGPASSWORD của CHÍNH tiến trình này rồi xóa ngay.
#   - Không ghi mật khẩu/chuỗi kết nối vào log, tệp, lịch sử lệnh hay GitHub. Repo đang PUBLIC.
#   - Kết quả nằm ở backups\ (đã .gitignore). Có 7-Zip: tự mã hóa AES-256 (.7z) rồi xóa bản chưa mã hóa sau khi kiểm tra giải mã đạt.
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
  # Ưu tiên thư mục công cụ riêng NGOÀI Git repo.
  $dirs = @($env:AFN_PGBIN, (Join-Path $env:LOCALAPPDATA "Programs\pgsql17\pgsql\bin"), (Join-Path $env:LOCALAPPDATA "Programs\pgsql17\bin"), (Join-Path $root "tools\pgsql\bin"))
  foreach ($d in $dirs) { if ($d -and (Test-Path (Join-Path $d "$name.exe"))) { return (Join-Path $d "$name.exe") } }
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
$env:PGSSLMODE = "require"
$conn = @("--host=$hostName", "--port=$port", "--username=$user", "--dbname=postgres")
$stamp = Get-Date -Format "yyyyMMdd_HHmm"
$dir = Join-Path $root "backups\afn_$stamp"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$sec = Read-Host -AsSecureString "Mật khẩu CSDL (ẩn)"
try {
  # Chỉ đọc: pg_dump và một câu SELECT; không có lệnh ghi/xóa nào gửi tới Supabase.
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
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
  $sec.Dispose()
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
# Mã hóa (bản sao lưu chứa email và mật khẩu đã băm). 7-Zip tự hỏi mật khẩu — script không nhìn thấy mật khẩu.
$7z = @("$env:ProgramFiles\7-Zip\7z.exe", "${env:ProgramFiles(x86)}\7-Zip\7z.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($7z) {
  $zip = "$dir.7z"
  Write-Host "Mã hóa AES-256 bằng 7-Zip: đặt mật khẩu mới và lưu vào trình quản lý mật khẩu (không lưu cạnh tệp)."
  & $7z a -t7z -mhe=on -p $zip "$dir\*" | Out-Null
  if ($LASTEXITCODE) { throw "7-Zip mã hóa lỗi — giữ nguyên thư mục $dir" }
  Write-Host "Kiểm tra giải mã (nhập lại mật khẩu)..."
  & $7z t $zip -p | Out-Null
  if ($LASTEXITCODE) { throw "Kiểm tra $zip thất bại — giữ nguyên thư mục $dir" }
  # Giữ lại 2 tệp đối chiếu không chứa dữ liệu cá nhân, cạnh tệp .7z.
  Copy-Item (Join-Path $dir "row_counts.txt") "$dir.row_counts.txt"
  Copy-Item (Join-Path $dir "SHA256SUMS.txt") "$dir.SHA256SUMS.txt"
  # Chỉ xóa bản chưa mã hóa do CHÍNH script này vừa tạo, sau khi bản mã hóa đã kiểm tra đạt.
  Remove-Item -LiteralPath $dir -Recurse -Force
  Write-Host "XONG (đã mã hóa): $zip"
} else {
  Write-Host "CẢNH BÁO: chưa có 7-Zip nên thư mục $dir CHƯA MÃ HÓA. Cài 7-Zip (7-zip.org) rồi nén có mật khẩu, hoặc cất vào ổ đĩa mã hóa BitLocker." -ForegroundColor Yellow
  Write-Host "XONG: $dir"
}
Write-Host "Gửi cho Claude NỘI DUNG row_counts.txt và SHA256SUMS.txt (không chứa bí mật) để đối chiếu. KHÔNG gửi các tệp .dump/.sql/.7z hay mật khẩu."
