# AI FILM NETWORK — kiểm tra bản sao lưu .age trên PC của chủ hệ thống (khóa bí mật không rời máy).
# Chuẩn bị 1 lần: tải age cho Windows tại https://github.com/FiloSottile/age/releases (age-v1.x-windows-amd64.zip),
#   giải nén vào %LOCALAPPDATA%\Programs\age\ ; tạo khóa:  age-keygen.exe -o "$env:USERPROFILE\afn-backup-key.txt"
#   → in ra "Public key: age1…": chép DÒNG age1… vào backups\supabase\recipient.txt (công khai, an toàn).
#   Cất tệp afn-backup-key.txt (khóa BÍ MẬT) vào trình quản lý mật khẩu/USB riêng; không gửi qua chat/email.
#   Tùy chọn: bảo vệ khóa bằng mật khẩu do anh tự đặt:  age-keygen.exe | age.exe -p -o afn-backup-key.age
# Dùng:  powershell -ExecutionPolicy Bypass -File tools\verify-backup-age.ps1 -File backups\supabase\X.json.age -Key $env:USERPROFILE\afn-backup-key.txt
param([Parameter(Mandatory)] [string]$File, [Parameter(Mandatory)] [string]$Key)
$ErrorActionPreference = "Stop"
$age = @("$env:LOCALAPPDATA\Programs\age\age.exe", "age.exe") | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue } | Select-Object -First 1
if (-not $age) { throw "Chưa có age.exe (xem hướng dẫn đầu tệp)" }
$manifest = "$($File -replace '\.age$', '').manifest.txt"
if (-not (Test-Path $manifest)) { $manifest = "$File".Replace(".json.age", ".json.manifest.txt") }
$want = (Select-String -Path $manifest -Pattern "SHA-256 bản rõ\s*:\s*([0-9a-f]{64})").Matches[0].Groups[1].Value
$tmp = Join-Path $env:TEMP ("afn-verify-" + [guid]::NewGuid() + ".json")
try {
  & $age -d -i $Key -o $tmp $File
  if ($LASTEXITCODE) { throw "Giải mã thất bại (sai khóa?)" }
  $got = (Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower()
  if ($got -eq $want) { Write-Host "ĐẠT: giải mã được và SHA-256 khớp manifest ($got)" -ForegroundColor Green }
  else { throw "KHÔNG KHỚP: $got ≠ $want" }
} finally { if (Test-Path $tmp) { Remove-Item $tmp -Force } }   # không để lại bản rõ trên đĩa
