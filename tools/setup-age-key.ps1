# AI FILM NETWORK — tạo cặp khóa age cho sao lưu Supabase (chạy MỘT LẦN trên PC của chủ hệ thống).
# - Khóa BÍ MẬT lưu ở  %USERPROFILE%\afn-backup-key.txt  (NGOÀI thư mục dự án → không bao giờ vào repository).
# - Chỉ khóa CÔNG KHAI (age1…) được ghi vào  backups\supabase\recipient.txt  để Claude mã hóa bản sao lưu.
# - Script KHÔNG in khóa bí mật ra màn hình, KHÔNG gửi đi đâu.
# Sau khi chạy: cất bản sao của afn-backup-key.txt vào trình quản lý mật khẩu hoặc USB riêng (mất khóa = không giải mã được).
# Dùng (PowerShell, trong thư mục dự án):  powershell -ExecutionPolicy Bypass -File tools\setup-age-key.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$ageDir = Join-Path $env:LOCALAPPDATA "Programs\age"
$keyFile = Join-Path $env:USERPROFILE "afn-backup-key.txt"
$recipient = Join-Path $root "backups\supabase\recipient.txt"

if (-not (Test-Path (Join-Path $ageDir "age.exe"))) {
  # Bản phát hành chính thức của age (github.com/FiloSottile/age). Có thể tự tải và giải nén vào $ageDir nếu muốn kiểm tra thủ công.
  $zip = Join-Path $env:TEMP "age-v1.2.1-windows-amd64.zip"
  Invoke-WebRequest -UseBasicParsing "https://github.com/FiloSottile/age/releases/download/v1.2.1/age-v1.2.1-windows-amd64.zip" -OutFile $zip
  Expand-Archive $zip -DestinationPath $env:TEMP\age-extract -Force
  New-Item -ItemType Directory -Force $ageDir | Out-Null
  Copy-Item "$env:TEMP\age-extract\age\*" $ageDir -Force
  Remove-Item $zip, "$env:TEMP\age-extract" -Recurse -Force
}
$keygen = Join-Path $ageDir "age-keygen.exe"
if (Test-Path $keyFile) {
  Write-Host "Đã có khóa: $keyFile (giữ nguyên, không tạo đè)." -ForegroundColor Yellow
} else {
  & $keygen -o $keyFile 2>$null | Out-Null
  if ($LASTEXITCODE) { throw "age-keygen lỗi" }
  # Chỉ tài khoản Windows hiện tại đọc được tệp khóa bí mật.
  icacls $keyFile /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
}
$pub = (& $keygen -y $keyFile).Trim()
if ($pub -notmatch '^age1[0-9a-z]{58}$') { throw "Không đọc được khóa công khai" }
New-Item -ItemType Directory -Force (Split-Path $recipient) | Out-Null
Set-Content -Path $recipient -Value $pub -Encoding ascii -NoNewline
Write-Host "Xong. Khóa công khai (an toàn để chia sẻ) đã ghi vào: $recipient" -ForegroundColor Green
Write-Host "Khóa BÍ MẬT: $keyFile — hãy sao lưu riêng, KHÔNG gửi qua chat/email, KHÔNG đặt trong thư mục dự án."
