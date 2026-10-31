<#
  AI FILM NETWORK — tạo môi trường phát triển Level 4 an toàn trên PC Nhân (hoặc bất kỳ máy Windows nào).
  Cách chạy: chuột phải file này → "Run with PowerShell"
         hoặc: powershell -ExecutionPolicy Bypass -File .\Setup-Level4-Worktree.ps1

  Script làm gì (theo thứ tự, DỪNG AN TOÀN ngay khi có gì bất thường):
   1. Kiểm tra repo gốc "source": remote, nhánh, commit, thay đổi local. KHÔNG sửa file nào của source.
   2. Nếu đã có "source-level4":
        - là worktree Level 4 của chính "source" và sạch → tái sử dụng (chỉ fast-forward);
        - là thư mục thường (không phải repo) → ĐỔI TÊN sang source-level4.partial-<thời gian> (không xóa);
        - là repo khác hoặc có thay đổi chưa commit → dừng, không đụng vào.
   3. git fetch đúng nhánh Level 4 từ GitHub (chỉ thêm 1 ref vào .git của source, không đổi nhánh/file của source).
   4. git worktree add ..\source-level4 trên nhánh dev/pc-nhan-level4 dựa trên commit Level 4 vừa lấy.
   5. Xác minh nhánh, commit, trạng thái sạch, source không đổi; chạy tools\run-level4-tests.ps1 nếu có Node.js >= 22.
  Chạy lại bất cứ lúc nào để lấy Level 4 mới nhất.
  Không dùng reset --hard, clean, force, xóa nhánh hay xóa file. Không đụng Production, Supabase, Cloudflare, DNS.
  Kết quả ghi vào Setup-Level4-Worktree.log cạnh script — gửi file log này cho Claude để xác minh.
#>
param(
  [string]$Root = $PSScriptRoot,
  [string]$Branch = "feature/master-site-xuongphim-2026-10-31",
  [string]$DevBranch = "dev/pc-nhan-level4",
  [switch]$NoPause,
  [switch]$SkipTests
)
$ErrorActionPreference = "Stop"
$log = Join-Path $Root "Setup-Level4-Worktree.log"
function Log([string]$m, [string]$c = "Gray") { $line = (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  " + $m; Add-Content -LiteralPath $log -Value $line -Encoding UTF8; Write-Host $line -ForegroundColor $c }
function Pause-End { if (-not $NoPause) { Read-Host "Nhấn Enter để đóng" | Out-Null } }
# git ghi tiến trình ra stderr: không coi là lỗi, chỉ xét exit code.
function G { $ErrorActionPreference = "Continue"; $out = & git @args 2>&1; $code = $LASTEXITCODE; return @{ out = @($out | ForEach-Object { "$_" }); code = $code } }
function One($r) { return (($r.out | Select-Object -First 1) -as [string]) }
function Stop-Safe([string]$m) { Log ("DỪNG AN TOÀN: " + $m) "Red"; Write-Host "`nKhông có gì bị xóa hay ghi đè. Gửi file log cho Claude: $log" -ForegroundColor Yellow; Pause-End; exit 1 }
trap { Log ("LỖI KHÔNG LƯỜNG TRƯỚC: " + $_.Exception.Message) "Red"; Write-Host "`nKhông có gì bị xóa. Gửi file log cho Claude: $log" -ForegroundColor Yellow; Pause-End; exit 2 }

Log "=== AI FILM NETWORK — Level 4 worktree setup ===" "Cyan"
Log ("Máy: " + $env:COMPUTERNAME + " · PowerShell " + $PSVersionTable.PSVersion + " · Thư mục: " + $Root)
$source = Join-Path $Root "source"
$target = Join-Path $Root "source-level4"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Stop-Safe "Chưa cài Git cho Windows (https://git-scm.com)." }
Log ("Git: " + (One (G --version)))
if (-not (Test-Path -LiteralPath (Join-Path $source ".git"))) { Stop-Safe "Không thấy repo gốc: $source" }

# ---------------------------------------------------------------- 1) Repo gốc: chỉ đọc
$remote = One (G -C $source remote get-url origin)
if ($remote -notmatch "github\.com[/:]HUNG2NAO/web-phim-ai") { Stop-Safe ("Remote của source không phải HUNG2NAO/web-phim-ai: " + $remote) }
$srcBranch = One (G -C $source rev-parse --abbrev-ref HEAD)
$srcHead = One (G -C $source rev-parse HEAD)
Log ("source  remote=" + $remote + "  nhánh=" + $srcBranch + "  commit=" + $srcHead)
$st = @((G -C $source -c core.autocrlf=true status --porcelain=v1).out | Where-Object { $_ })
$real = @((G -C $source diff --ignore-cr-at-eol --name-only).out | Where-Object { $_ })
$untracked = @((G -C $source ls-files --others --exclude-standard).out | Where-Object { $_ })
Log ("source  status: " + $st.Count + " dòng · thay đổi THẬT (bỏ qua xuống dòng): " + $real.Count + " · file chưa theo dõi: " + $untracked.Count)
if ($real.Count -gt 0) { Log ("  Được giữ nguyên trong source: " + ($real -join ", ")) "Yellow" }

# ---------------------------------------------------------------- 2) Thư mục đích
$reuse = $false
if (Test-Path -LiteralPath $target) {
  if (Test-Path -LiteralPath (Join-Path $target ".git")) {
    $common = One (G -C $target rev-parse --path-format=absolute --git-common-dir)
    $srcGit = One (G -C $source rev-parse --path-format=absolute --git-common-dir)
    $tBranch = One (G -C $target rev-parse --abbrev-ref HEAD)
    $tDirty = @((G -C $target status --porcelain=v1).out | Where-Object { $_ })
    Log ("source-level4 đã là repo · nhánh=" + $tBranch + " · thay đổi local=" + $tDirty.Count)
    if ($common -ne $srcGit) { Stop-Safe "source-level4 là một repo KHÁC (không phải worktree của source) — không đụng vào." }
    if ($tBranch -ne $DevBranch) { Stop-Safe ("source-level4 đang ở nhánh " + $tBranch + ", không phải " + $DevBranch + " — không đụng vào.") }
    if ($tDirty.Count -gt 0) { Stop-Safe "source-level4 có thay đổi chưa commit — không tự cập nhật để tránh mất dữ liệu." }
    $reuse = $true
  } else {
    $n = @(Get-ChildItem -LiteralPath $target -Recurse -File -Force -ErrorAction SilentlyContinue).Count
    $asideName = "source-level4.partial-" + (Get-Date -Format "yyyyMMdd-HHmmss")
    if (Test-Path -LiteralPath (Join-Path $Root $asideName)) { Stop-Safe ("Đã có thư mục " + $asideName) }
    try { Rename-Item -LiteralPath $target -NewName $asideName }
    catch { Stop-Safe ("Không đổi tên được source-level4 (đang mở trong Explorer/editor?). Đóng các cửa sổ đó rồi chạy lại. Chi tiết: " + $_.Exception.Message) }
    Log ("source-level4 cũ (" + $n + " file, không có Git) đã được ĐỔI TÊN, KHÔNG xóa → " + $asideName) "Yellow"
  }
}

# ---------------------------------------------------------------- 3) Lấy nhánh Level 4 mới nhất
$refspec = "+refs/heads/" + $Branch + ":refs/remotes/origin/" + $Branch
$f = G -C $source fetch origin $refspec
if ($f.code -ne 0) { Stop-Safe ("git fetch thất bại (kiểm tra mạng/GitHub): " + ($f.out -join " ")) }
$remoteHead = One (G -C $source rev-parse ("refs/remotes/origin/" + $Branch))
if ($remoteHead -notmatch "^[0-9a-f]{40}$") { Stop-Safe "Không đọc được commit Level 4 sau khi fetch." }
Log ("GitHub " + $Branch + " = " + $remoteHead) "Green"

# ---------------------------------------------------------------- 4) Tạo hoặc tái sử dụng worktree
if ($reuse) {
  $ff = G -C $target merge --ff-only $remoteHead
  if ($ff.code -ne 0) { Stop-Safe ("Không cập nhật fast-forward được (nhánh dev có commit riêng?): " + ($ff.out -join " ")) }
  Log "Đã cập nhật source-level4 (fast-forward)." "Green"
} else {
  $hasBranch = (G -C $source rev-parse --verify --quiet ("refs/heads/" + $DevBranch)).code -eq 0
  if ($hasBranch) { Stop-Safe ("Nhánh " + $DevBranch + " đã tồn tại nhưng không có thư mục source-level4. Kiểm tra 'git -C source worktree list' trước khi tạo lại.") }
  $w = G -C $source worktree add -b $DevBranch $target $remoteHead
  if ($w.code -ne 0) { Stop-Safe ("git worktree add thất bại: " + ($w.out -join " ")) }
  Log ("Đã tạo worktree source-level4 · nhánh " + $DevBranch + " từ " + $remoteHead) "Green"
}

# ---------------------------------------------------------------- 5) Xác minh
$head = One (G -C $target rev-parse HEAD)
$tb = One (G -C $target rev-parse --abbrev-ref HEAD)
$dirty = @((G -C $target status --porcelain=v1).out | Where-Object { $_ })
$srcAfter = One (G -C $source rev-parse HEAD)
$srcBranchAfter = One (G -C $source rev-parse --abbrev-ref HEAD)
$ok = ($head -eq $remoteHead) -and ($tb -eq $DevBranch) -and ($dirty.Count -eq 0) -and ($srcAfter -eq $srcHead) -and ($srcBranchAfter -eq $srcBranch)
Log ("KIỂM TRA  source-level4: nhánh=" + $tb + " commit=" + $head + " sạch=" + ($dirty.Count -eq 0))
Log ("KIỂM TRA  source gốc: nhánh=" + $srcBranchAfter + " commit=" + $srcAfter + " (trước: " + $srcBranch + " " + $srcHead + ")")
G -C $source worktree list | ForEach-Object { $_.out } | ForEach-Object { Log ("  worktree: " + $_) }
if (-not $ok) { Stop-Safe "Kết quả xác minh không khớp — xem các dòng KIỂM TRA ở trên." }
Log "XÁC MINH GIT: ĐẠT" "Green"

if ($SkipTests) { Log "Bỏ qua kiểm thử theo yêu cầu (-SkipTests)." "Yellow" }
elseif (Get-Command node -ErrorAction SilentlyContinue) {
  Log ("Node.js " + (& node --version) + " — chạy kiểm thử Level 4 (cú pháp + contract + Auth)…") "Cyan"
  $shell = if (Get-Command powershell -ErrorAction SilentlyContinue) { "powershell" } else { "pwsh" }
  $ErrorActionPreference = "Continue"
  & $shell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $target "tools\run-level4-tests.ps1") 2>&1 | ForEach-Object { Log ("  " + $_) }
  $testCode = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($testCode -eq 0) { Log "KIỂM THỬ: PASS" "Green" } else { Log ("KIỂM THỬ: FAIL (mã " + $testCode + ") — xem log") "Red" }
} else { Log "Chưa thấy Node.js trong PATH — bỏ qua kiểm thử (cài Node.js >= 22 rồi chạy tools\run-level4-tests.ps1)." "Yellow" }

Log ("=== HOÀN TẤT. Thư mục phát triển chính: " + $target + " ===") "Cyan"
Pause-End
