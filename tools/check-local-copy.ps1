<#
  AI FILM NETWORK — kiểm tra bản sao trên máy (CHỈ ĐỌC).
  Không checkout, reset, clean, pull, merge hay xóa bất cứ thứ gì.
  Thao tác duy nhất chạm vào Git là "git fetch" để cập nhật thông tin nhánh trên GitHub
  (chỉ đổi refs/remotes, không đụng file làm việc).

  Cách chạy (PowerShell, trên PC Hưng):
    powershell -ExecutionPolicy Bypass -File .\check-local-copy.ps1 -Path "D:\HUNG_PROJECTS\WEB_PHIM_AI"
  Kết quả: Desktop\AFN_LOCAL_AUDIT_<tên máy>.txt  → gửi file này lại cho Claude.
  Báo cáo chỉ liệt kê TÊN file, không in nội dung, không in khóa/mật khẩu.
#>
param(
  [string]$Path = "D:\HUNG_PROJECTS\WEB_PHIM_AI",
  [string]$Level4Branch = "feature/master-site-xuongphim-2026-10-31"
)
$ErrorActionPreference = "Continue"
$out = Join-Path ([Environment]::GetFolderPath("Desktop")) ("AFN_LOCAL_AUDIT_" + $env:COMPUTERNAME + ".txt")
$lines = New-Object System.Collections.Generic.List[string]
function Say([string]$t) { $lines.Add($t) | Out-Null; Write-Host $t }
function GitOut([string]$repo) { $a = $args; $r = & git -C $repo @a 2>&1; return ($r | ForEach-Object { "$_" }) }

Say "AI FILM NETWORK — LOCAL COPY AUDIT (read-only)"
Say ("Máy: " + $env:COMPUTERNAME + " · Thời gian: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"))
Say ("Thư mục kiểm tra: " + $Path)
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Say "LỖI: máy chưa cài Git."; $lines | Set-Content -Encoding UTF8 $out; exit 1 }
if (-not (Test-Path $Path)) { Say "LỖI: không tìm thấy thư mục. Hãy chạy lại với -Path <đường dẫn đúng>."; $lines | Set-Content -Encoding UTF8 $out; exit 1 }

# 1) Tìm mọi repo Git (kể cả bản sao, worktree) trong tối đa 4 cấp thư mục.
$repos = @()
Get-ChildItem -LiteralPath $Path -Force -Recurse -Depth 4 -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -eq ".git" -and $_.FullName -notmatch "node_modules" } |
  ForEach-Object { $repos += (Split-Path $_.FullName -Parent) }
if (Test-Path (Join-Path $Path ".git")) { $repos = @($Path) + $repos }
$repos = $repos | Select-Object -Unique
Say ""; Say ("== Số repo Git tìm thấy: " + $repos.Count); $repos | ForEach-Object { Say ("  " + $_) }

# 2) Thư mục dự án không phải Git (bản copy tay) có thể chứa mã chưa đưa lên GitHub.
Say ""; Say "== Thư mục cấp 1 (đánh dấu [NO-GIT] nếu không thuộc repo nào)"
Get-ChildItem -LiteralPath $Path -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
  $d = $_.FullName; $inRepo = $repos | Where-Object { $d -eq $_ -or $d.StartsWith($_ + "\") }
  $n = (Get-ChildItem -LiteralPath $d -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object).Count
  Say ("  " + ($(if ($inRepo) { "[git]    " } else { "[NO-GIT] " })) + $_.Name + "  (" + $n + " file, sửa lần cuối " + $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm") + ")")
}

foreach ($repo in $repos) {
  Say ""; Say ("################ REPO: " + $repo)
  Say "-- remote:"; GitOut $repo remote -v | ForEach-Object { Say ("   " + ($_ -replace "://[^@/]+@", "://***@")) }
  Say "-- fetch (chỉ cập nhật thông tin nhánh từ GitHub):"; GitOut $repo fetch --all --prune | ForEach-Object { Say ("   " + $_) }
  Say "-- nhánh hiện tại & HEAD:"; GitOut $repo status -sb | Select-Object -First 1 | ForEach-Object { Say ("   " + $_) }
  GitOut $repo log -1 --format="   HEAD %H %ci %s" | ForEach-Object { Say $_ }
  Say "-- thay đổi CHƯA COMMIT (file đã theo dõi):"; $m = GitOut $repo status --porcelain=v1 --untracked-files=no
  if ($m) { $m | ForEach-Object { Say ("   " + $_) } } else { Say "   (không có)" }
  Say "-- file CHƯA THEO DÕI (untracked, không tính file bị .gitignore):"; $u = GitOut $repo ls-files --others --exclude-standard
  if ($u) { $u | Select-Object -First 300 | ForEach-Object { Say ("   " + $_) }; Say ("   Tổng: " + @($u).Count) } else { Say "   (không có)" }
  Say "-- file bị .gitignore (chỉ cấp thư mục, bỏ node_modules):"
  GitOut $repo status --ignored --porcelain=v1 | Where-Object { $_ -like "!!*" -and $_ -notmatch "node_modules" } | Select-Object -First 100 | ForEach-Object { Say ("   " + $_) }
  Say "-- stash:"; $s = GitOut $repo stash list; if ($s) { $s | ForEach-Object { Say ("   " + $_) } } else { Say "   (không có)" }
  Say "-- worktree:"; GitOut $repo worktree list | ForEach-Object { Say ("   " + $_) }
  Say "-- các nhánh local và trạng thái so với GitHub:"; GitOut $repo branch -vv | ForEach-Object { Say ("   " + $_) }
  Say "-- COMMIT CHỈ CÓ TRÊN MÁY NÀY (chưa có trên GitHub ở bất kỳ nhánh nào):"
  $only = GitOut $repo log --branches --tags --not --remotes=origin --format="%h %ci %an | %s"
  if ($only) { $only | ForEach-Object { Say ("   " + $_) }; Say ("   Tổng: " + @($only).Count) } else { Say "   (không có)" }
  Say ("-- So với Level 4 (origin/" + $Level4Branch + "):")
  $hasL4 = GitOut $repo rev-parse --verify --quiet ("origin/" + $Level4Branch)
  if ($hasL4) {
    $head = (GitOut $repo rev-parse HEAD) | Select-Object -First 1
    $isAnc = & git -C $repo merge-base --is-ancestor HEAD ("origin/" + $Level4Branch) 2>$null; $anc = ($LASTEXITCODE -eq 0)
    Say ("   HEAD local là tổ tiên của Level 4: " + $(if ($anc) { "CÓ (Level 4 đã chứa toàn bộ lịch sử của bản này)" } else { "KHÔNG — có lịch sử riêng, cần đối chiếu" }))
    $l4files = GitOut $repo ls-tree -r --name-only ("origin/" + $Level4Branch)
    $local = @(GitOut $repo ls-files) + @(GitOut $repo ls-files --others --exclude-standard)
    $missing = $local | Where-Object { $l4files -notcontains $_ } | Sort-Object -Unique
    Say "   File có ở máy này nhưng KHÔNG có trong Level 4:"
    if ($missing) { $missing | Select-Object -First 300 | ForEach-Object { Say ("     " + $_) }; Say ("     Tổng: " + @($missing).Count) } else { Say "     (không có)" }
    Say "   File đã theo dõi có nội dung KHÁC Level 4 (tên file + số dòng thêm/bớt):"
    GitOut $repo diff --numstat ("origin/" + $Level4Branch) -- . | Select-Object -First 300 | ForEach-Object { Say ("     " + $_) }
  } else { Say "   Không tìm thấy nhánh Level 4 trên remote (kiểm tra remote có đúng HUNG2NAO/web-phim-ai)." }
}
Say ""; Say "== HẾT. Không có file nào bị sửa, xóa hay ghi đè bởi script này."
$lines | Set-Content -Encoding UTF8 $out
Write-Host ""; Write-Host ("Đã lưu kết quả: " + $out) -ForegroundColor Green
