<#
  AI FILM NETWORK — tạo môi trường phát triển Level 4 an toàn trên PC Nhân (hoặc bất kỳ máy Windows nào).
  Cách chạy: chuột phải file này → "Run with PowerShell"
         hoặc: powershell -ExecutionPolicy Bypass -File .\Setup-Level4-Worktree.ps1

  Script làm gì (theo thứ tự, dừng ngay nếu có gì bất thường):
   1. Kiểm tra repo gốc "source": remote, nhánh, commit, thay đổi local. KHÔNG sửa file nào của source.
   2. Nếu đã có "source-level4":
        - là worktree hợp lệ của Level 4 → tái sử dụng (chỉ fetch, không ghi đè);
        - là thư mục thường (không phải repo) → ĐỔI TÊN sang source-level4.partial-<thời gian> (không xóa).
   3. git fetch nhánh Level 4 từ GitHub (chỉ thêm thông tin nhánh vào .git của source).
   4. git worktree add ..\source-level4 trên nhánh mới dev/pc-nhan-level4 dựa trên Level 4.
   5. Kiểm tra commit và git status; chạy tools\run-level4-tests.ps1 nếu có Node.js >= 22.
  Chạy lại script bất cứ lúc nào để lấy Level 4 mới nhất (chỉ fast-forward, dừng nếu có thay đổi chưa commit).
  Không dùng reset --hard, clean, force push, xóa nhánh hay xóa file. Không đụng Production.
  Kết quả được ghi vào Setup-Level4-Worktree.log cạnh script.
#>
param(
  [string]$Root = $PSScriptRoot,
  [string]$Branch = "feature/master-site-xuongphim-2026-10-31",
  [string]$DevBranch = "dev/pc-nhan-level4"
)
$ErrorActionPreference = "Stop"
$log = Join-Path $Root "Setup-Level4-Worktree.log"
function Log([string]$m, [string]$c = "Gray") { $line = (Get-Date -Format "HH:mm:ss") + "  " + $m; Add-Content -LiteralPath $log -Value $line -Encoding UTF8; Write-Host $line -ForegroundColor $c }
function G { $ErrorActionPreference = "Continue"; $out = & git @args 2>&1; $code = $LASTEXITCODE; return @{ out = ($out | ForEach-Object { "$_" }); code = $code } }   # git ghi tiến trình ra stderr: không coi là lỗi
function Stop-Safe([string]$m) { Log ("DỪNG AN TOÀN: " + $m) "Red"; Write-Host "`nKhông có gì bị xóa hay ghi đè. Gửi file log cho Claude." -ForegroundColor Yellow; Read-Host "Nhấn Enter để đóng"; exit 1 }

Log "=== AI FILM NETWORK — Level 4 worktree setup ===" "Cyan"
$source = Join-Path $Root "source"
$target = Join-Path $Root "source-level4"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Stop-Safe "Chưa cài Git cho Windows (https://git-scm.com)." }
if (-not (Test-Path (Join-Path $source ".git"))) { Stop-Safe "Không thấy repo gốc: $source" }

# 1) Repo gốc: chỉ đọc
$r = G -C $source remote get-url origin
if ($r.code -ne 0 -or ($r.out -join "") -notmatch "github\.com[/:]HUNG2NAO/web-phim-ai") { Stop-Safe ("Remote không đúng: " + ($r.out -join " ")) }
Log ("source remote : " + ($r.out -join ""))
Log ("source nhánh  : " + ((G -C $source rev-parse --abbrev-ref HEAD).out -join ""))
Log ("source commit : " + ((G -C $source rev-parse HEAD).out -join ""))
$st = (G -C $source -c core.autocrlf=true status --porcelain=v1).out | Where-Object { $_ }
$real = (G -C $source diff --ignore-cr-at-eol --name-only).out | Where-Object { $_ }
Log ("source thay đổi (git status): " + @($st).Count + " file; thay đổi THẬT (bỏ qua xuống dòng): " + @($real).Count)
if (@($real).Count -gt 0) { Log ("  Giữ nguyên các file này trong source: " + ($real -join ", ")) "Yellow" }

# 2) Thư mục đích
if (Test-Path $target) {
  $isRepo = Test-Path (Join-Path $target ".git")
  if ($isRepo) {
    $tb = (G -C $target rev-parse --abbrev-ref HEAD).out -join ""
    $tdirty = (G -C $target status --porcelain=v1).out | Where-Object { $_ }
    Log ("source-level4 đã là repo, nhánh $tb, thay đổi local: " + @($tdirty).Count)
    if (@($tdirty).Count -gt 0) { Stop-Safe "source-level4 có thay đổi chưa commit — không tự cập nhật để tránh mất dữ liệu." }
    $reuse = $true
  } else {
    $aside = $target + ".partial-" + (Get-Date -Format "yyyyMMdd-HHmmss")
    Rename-Item -LiteralPath $target -NewName (Split-Path $aside -Leaf)
    Log ("Thư mục source-level4 (bản chép tay, không có Git) đã được ĐỔI TÊN thành: " + $aside) "Yellow"
    $reuse = $false
  }
} else { $reuse = $false }

# 3) Lấy nhánh Level 4 mới nhất (chỉ thêm ref vào .git của source)
$f = G -C $source fetch origin ("+refs/heads/" + $Branch + ":refs/remotes/origin/" + $Branch)
if ($f.code -ne 0) { Stop-Safe ("git fetch thất bại: " + ($f.out -join " ")) }
$remoteHead = ((G -C $source rev-parse ("origin/" + $Branch)).out -join "")
Log ("GitHub $Branch = $remoteHead") "Green"

# 4) Tạo hoặc tái sử dụng worktree
if ($reuse) {
  $ff = G -C $target merge --ff-only ("origin/" + $Branch)
  if ($ff.code -ne 0) { Stop-Safe ("Không cập nhật fast-forward được (có commit riêng?): " + ($ff.out -join " ")) }
  Log "Đã cập nhật source-level4 bằng fast-forward." "Green"
} else {
  $exists = (G -C $source rev-parse --verify --quiet ("refs/heads/" + $DevBranch)).code -eq 0
  if ($exists) { $w = G -C $source worktree add $target $DevBranch }
  else { $w = G -C $source worktree add -b $DevBranch $target ("origin/" + $Branch) }
  if ($w.code -ne 0) { Stop-Safe ("git worktree add thất bại: " + ($w.out -join " ")) }
  # Không gắn upstream: cấu hình fetch của repo gốc chỉ có nhánh main và ta không sửa cấu hình gốc.
  # Muốn cập nhật Level 4 mới nhất về sau: chạy lại script này (nhánh tái sử dụng, chỉ fast-forward).
  Log "Đã tạo worktree source-level4 trên nhánh $DevBranch." "Green"
}

# 5) Xác minh
$head = (G -C $target rev-parse HEAD).out -join ""
$dirty = (G -C $target status --porcelain=v1).out | Where-Object { $_ }
Log ("source-level4 HEAD = $head (GitHub: $remoteHead) → " + $(if ($head -eq $remoteHead) { "KHỚP" } else { "KHÁC — kiểm tra lại" }))
Log ("source-level4 git status: " + $(if (@($dirty).Count -eq 0) { "sạch" } else { "" + @($dirty).Count + " thay đổi" }))
$srcAfter = (G -C $source rev-parse HEAD).out -join ""
Log ("source gốc vẫn ở: $srcAfter (không bị đổi)")

if (Get-Command node -ErrorAction SilentlyContinue) {
  Log "Chạy kiểm thử Level 4 (cú pháp + contract + Auth)…" "Cyan"
  & powershell -ExecutionPolicy Bypass -File (Join-Path $target "tools\run-level4-tests.ps1") 2>&1 | ForEach-Object { Log ("  " + $_) }
  Log $(if ($LASTEXITCODE -eq 0) { "KIỂM THỬ: PASS" } else { "KIỂM THỬ: FAIL (xem log)" }) $(if ($LASTEXITCODE -eq 0) { "Green" } else { "Red" })
} else { Log "Chưa có Node.js >= 22 — bỏ qua kiểm thử (cài từ https://nodejs.org rồi chạy tools\run-level4-tests.ps1)." "Yellow" }

Log "=== HOÀN TẤT. Thư mục phát triển chính: $target ===" "Cyan"
Read-Host "Nhấn Enter để đóng"
