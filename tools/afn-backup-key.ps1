# AI FILM NETWORK — tạo khóa sao lưu age và tự kiểm tra bản sao lưu mới (chạy trên PC của chủ hệ thống).
# Chạy bằng cách NHÁY ĐÚP tools\Tao-Khoa-Backup.cmd (không cần gõ lệnh). Script làm, theo thứ tự:
#   1. Cài age v1.2.1 cho riêng tài khoản này vào %LOCALAPPDATA%\Programs\age-afn (không cần quyền admin, không sửa PATH,
#      không đổi chính sách bảo mật hệ thống). Tệp tải về PHẢI có SHA-256 đúng giá trị ghim bên dưới (trùng manifest winget
#      của Microsoft) — sai là dừng, không giải nén.
#   2. Tạo khóa BÍ MẬT tại %LOCALAPPDATA%\AFN-Backup-Key\afn-backup-key.txt (ngoài repo, ngoài OneDrive); gỡ quyền thừa kế,
#      chỉ tài khoản Windows hiện tại đọc/ghi. Đã có khóa thì GIỮ NGUYÊN, không tạo đè.
#   3. Ghi DUY NHẤT khóa CÔNG KHAI (age1…) vào backups\supabase\recipient.txt.
#   4. Chờ (tối đa 45 phút) bản sao lưu .json.age mới do Claude tạo, giải mã TRONG BỘ NHỚ (không ghi bản rõ ra đĩa),
#      so SHA-256 với manifest, ghi kết quả (không chứa khóa hay dữ liệu) vào backups\supabase\verify-<tên>.txt.
# Script KHÔNG: in/ghi khóa bí mật ra màn hình hay log, gửi khóa đi đâu, xóa bất kỳ tệp nào, dùng Start-Transcript,
# kết nối mạng ngoài 1 lần tải age từ github.com.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$ageUrl = "https://github.com/FiloSottile/age/releases/download/v1.2.1/age-v1.2.1-windows-amd64.zip"
$ageSha = "46DB0DB71F146061F7C8FFFA912CB806AEF1BC8450E27A3ABC1744F0591B89FB"   # = winget-pkgs FiloSottile.age 1.2.1
$ageDir = Join-Path $env:LOCALAPPDATA "Programs\age-afn"
$keyDir = Join-Path $env:LOCALAPPDATA "AFN-Backup-Key"
$keyFile = Join-Path $keyDir "afn-backup-key.txt"
$bk = Join-Path $root "backups\supabase"
$recipient = Join-Path $bk "recipient.txt"
# Nhật ký tiến trình (CHỈ tên bước / thông báo lỗi — không bao giờ có nội dung khóa) để Claude đọc được khi có sự cố.
$runLog = Join-Path $bk "afn-backup-key-run.log"
New-Item -ItemType Directory -Force $bk | Out-Null
function Log($t) { Add-Content -Path $runLog -Value ((Get-Date).ToString("yyyy-MM-dd HH:mm:ss") + "  " + $t) -Encoding utf8 }
function Step($t) { Write-Host ""; Write-Host "== $t" -ForegroundColor Cyan; Log $t }
trap {
  $m = ($_.Exception.Message -replace 'AGE-SECRET-KEY-1[0-9A-Z]+', '[đã che]')
  Log ("LỖI tại dòng " + $_.InvocationInfo.ScriptLineNumber + ": " + $m)
  Write-Host "LỖI: $m" -ForegroundColor Red
  break
}
Log ("Bắt đầu — PowerShell " + $PSVersionTable.PSVersion + ", người dùng " + [Environment]::UserName)

# Khóa không được nằm trong thư mục đồng bộ (OneDrive, Syncthing, H2N bridge…) hay trong dự án
$blocked = @($env:OneDrive, $env:OneDriveConsumer, $env:OneDriveCommercial, $root, "C:\tools\h2n_bridge_manager",
  (Join-Path $env:USERPROFILE "Google Drive"), (Join-Path $env:USERPROFILE "Dropbox")) | Where-Object { $_ }
$stCfg = Join-Path $env:LOCALAPPDATA "Syncthing\config.xml"
$stCount = 0
if (Test-Path $stCfg) {
  try {
    [xml]$stXml = [IO.File]::ReadAllText($stCfg)
    foreach ($f in @($stXml.configuration.folder)) {
      if (-not $f.path) { continue }
      $fp = [Environment]::ExpandEnvironmentVariables(($f.path -replace '^~', $env:USERPROFILE)).TrimEnd('\')
      $blocked += $fp; $stCount++
    }
  } catch { throw "Không đọc được cấu hình Syncthing ($stCfg) — dừng để an toàn." }
}
foreach ($sync in $blocked) {
  $sp = $sync.TrimEnd('\')
  if ($keyDir.StartsWith($sp + '\', [StringComparison]::OrdinalIgnoreCase) -or $keyDir -ieq $sp -or $sp.StartsWith($keyDir, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Thư mục khóa nằm trong (hoặc chứa) thư mục đồng bộ/dự án: $sync — dừng."
  }
  # Thư mục cha của khóa (vd. cả AppData\Local) bị đồng bộ cũng bị chặn
  if ($env:LOCALAPPDATA.StartsWith($sp + '\', [StringComparison]::OrdinalIgnoreCase) -or $env:LOCALAPPDATA -ieq $sp) { throw "AppData\Local nằm trong thư mục đồng bộ $sync — dừng." }
}
Log ("Kiểm tra đồng bộ: OneDrive/Google Drive/Dropbox/H2N bridge/dự án + " + $stCount + " thư mục Syncthing — khóa KHÔNG nằm trong thư mục nào")

Step "1/4 Công cụ age"
$age = Join-Path $ageDir "age.exe"; $keygen = Join-Path $ageDir "age-keygen.exe"
if (-not (Test-Path $age) -or -not (Test-Path $keygen)) {
  $dl = Join-Path $env:TEMP ("age-v1.2.1-" + [guid]::NewGuid() + ".zip")
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing $ageUrl -OutFile $dl
  $got = (Get-FileHash $dl -Algorithm SHA256).Hash
  if ($got -ne $ageSha) { throw "SHA-256 của age KHÔNG khớp ($got) — không cài." }
  $tmpDir = Join-Path $env:TEMP ("age-extract-" + [guid]::NewGuid())
  Expand-Archive $dl -DestinationPath $tmpDir
  New-Item -ItemType Directory -Force $ageDir | Out-Null
  Copy-Item (Join-Path $tmpDir "age\*") $ageDir -Force
  Write-Host "Đã cài age v1.2.1 (SHA-256 khớp manifest winget) vào $ageDir"
} else { Write-Host "Đã có age: $ageDir" }
$ver = (& $age --version).Trim(); Write-Host "Phiên bản: $ver"

Step "2/4 Khóa bí mật (chỉ trên máy này)"
if (Test-Path $keyFile) {
  Write-Host "Đã có khóa — giữ nguyên, không tạo đè."; Log "Khóa đã tồn tại — dùng lại, không tạo mới"
} else {
  New-Item -ItemType Directory -Force $keyDir | Out-Null
  # Windows PowerShell 5.1: age-keygen in khóa CÔNG KHAI ra stderr; với ErrorActionPreference=Stop, chuyển hướng stderr
  # của lệnh ngoài sẽ bị coi là lỗi và dừng script → tạm dùng Continue cho riêng lệnh này.
  $ErrorActionPreference = "Continue"
  & $keygen -o $keyFile *> $null
  $kgExit = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($kgExit -or -not (Test-Path $keyFile)) { throw "age-keygen lỗi" }
  Write-Host "Đã tạo khóa bí mật (nội dung không hiển thị)."
}
$me = [Security.Principal.WindowsIdentity]::GetCurrent().Name
foreach ($p in @($keyDir, $keyFile)) {
  icacls $p /inheritance:r /grant:r "${me}:(F)" | Out-Null
  if ($LASTEXITCODE) { throw "Không đặt được quyền cho $p" }
}
$aclF = (Get-Acl $keyFile); $aclD = (Get-Acl $keyDir)
$who = @($aclF.Access + $aclD.Access) | ForEach-Object { $_.IdentityReference.Value } | Sort-Object -Unique
$inh = $aclF.AreAccessRulesProtected -and $aclD.AreAccessRulesProtected
Write-Host ("Quyền trên khóa: " + ($who -join ", ") + " | chặn thừa kế: " + $inh)
Log ("ACL khóa: " + ($who -join ", ") + " | chặn thừa kế: " + $inh)
if (@($who | Where-Object { $_ -ne $me }).Count -gt 0 -or -not $inh) { throw "ACL chưa đúng (chỉ được có $me)" }

Step "3/4 Khóa công khai → recipient.txt"
$ErrorActionPreference = "Continue"
$pub = ((& $keygen -y $keyFile 2>$null) | Out-String).Trim()
$ErrorActionPreference = "Stop"
# Khóa cũ hỏng → DỪNG (không tạo đè, để chủ hệ thống quyết định)
if ($pub -notmatch '^age1[02-9ac-hj-np-z]{58}$') { throw "Khóa riêng hiện có không trích được khóa công khai hợp lệ — KHÔNG tạo đè, cần kiểm tra thủ công" }
Log ("Khóa riêng hợp lệ; khóa công khai " + $pub.Substring(0,12) + "…" + $pub.Substring($pub.Length-6))
New-Item -ItemType Directory -Force $bk | Out-Null
Set-Content -Path $recipient -Value $pub -Encoding ascii -NoNewline
Write-Host "Đã ghi khóa công khai: $recipient ($($pub.Substring(0,12))…)"; Log "recipient.txt đã ghi"
$since = (Get-Item $recipient).LastWriteTime

Step "4/4 Chờ bản sao lưu mã hóa mới để kiểm tra (tối đa 45 phút; có thể để cửa sổ này chạy)"
$deadline = (Get-Date).AddMinutes(45); $done = $false
while (-not $done -and (Get-Date) -lt $deadline) {
  $cands = Get-ChildItem $bk -Filter "*.json.age" | Where-Object { $_.LastWriteTime -ge $since.AddMinutes(-1) }
  foreach ($f in $cands) {
    $man = $f.FullName -replace '\.age$', '.manifest.txt'
    $out = Join-Path $bk ("verify-" + ($f.Name -replace '\.json\.age$', '') + ".txt")
    if ((Test-Path $out) -or -not (Test-Path $man)) { continue }
    $mtxt = [IO.File]::ReadAllText($man, [Text.Encoding]::UTF8)   # đọc rõ UTF-8; so bằng các dòng ASCII của manifest
    $want = ([regex]::Match($mtxt, 'plain_sha256=([0-9a-f]{64})').Groups[1].Value).ToLower()
    $wantC = ([regex]::Match($mtxt, 'cipher_sha256=([0-9a-f]{64})').Groups[1].Value).ToLower()
    if (-not $want -or -not $wantC) { continue }
    $gotC = (Get-FileHash $f.FullName -Algorithm SHA256).Hash.ToLower()
    # Giải mã ra luồng, băm ngay trong bộ nhớ — bản rõ không bao giờ chạm đĩa
    $psi = New-Object Diagnostics.ProcessStartInfo $age, ("-d -i `"$keyFile`" `"$($f.FullName)`"")
    $psi.UseShellExecute = $false; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true; $psi.CreateNoWindow = $true
    $proc = [Diagnostics.Process]::Start($psi)
    $sha = [Security.Cryptography.SHA256]::Create()
    $got = ([BitConverter]::ToString($sha.ComputeHash($proc.StandardOutput.BaseStream)) -replace '-', '').ToLower()
    $proc.WaitForExit(); $err = $proc.StandardError.ReadToEnd()
    $ok = ($proc.ExitCode -eq 0) -and ($got -eq $want) -and ($gotC -eq $wantC)
    @(
      "Kết quả: " + $(if ($ok) { "ĐẠT" } else { "KHÔNG ĐẠT" }),
      "Tệp: $($f.Name)",
      "SHA-256 bản mã  (manifest/thực tế): $wantC / $gotC",
      "SHA-256 bản rõ  (manifest/giải mã): $want / $got",
      "Giải mã: " + $(if ($proc.ExitCode -eq 0) { "thành công bằng khóa riêng trên máy này" } else { "lỗi (" + $err.Split("`n")[0] + ")" }),
      "Thời điểm: " + (Get-Date).ToString("yyyy-MM-dd HH:mm:ss zzz"),
      "Ghi chú: bản rõ chỉ được băm trong bộ nhớ, không ghi ra đĩa; tệp này không chứa khóa hay dữ liệu."
    ) | Set-Content -Path $out -Encoding utf8
    Log ("Kiểm tra " + $f.Name + ": " + $(if ($ok) { "ĐẠT" } else { "KHÔNG ĐẠT" }))
    Write-Host ($(if ($ok) { "ĐẠT" } else { "KHÔNG ĐẠT" }) + ": $($f.Name) → $out") -ForegroundColor $(if ($ok) { "Green" } else { "Red" })
    $done = $true
  }
  if (-not $done) { Start-Sleep -Seconds 10 }
}
if (-not $done) { Write-Host "Chưa thấy bản sao lưu mới trong 45 phút. Có thể nháy đúp lại tệp .cmd sau (khóa cũ được giữ nguyên)." -ForegroundColor Yellow }
Write-Host ""
Write-Host "NHẮC: sao lưu tệp khóa bí mật ($keyFile) vào trình quản lý mật khẩu hoặc USB riêng. Mất khóa = không giải mã được." -ForegroundColor Yellow
