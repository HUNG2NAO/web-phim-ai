<#
  AI FILM NETWORK — chạy kiểm thử Level 4 trên Windows (không đường dẫn cứng, không đụng Production).
  Mặc định: kiểm tra cú pháp JS + contract + Auth (chỉ cần Node.js >= 22).
  -Browser : thêm Chromium E2E. Playwright được cài vào thư mục QA NGOÀI repo (mặc định ..\temp\qa-level4).
  Không gửi dữ liệu thật: E2E dùng Supabase giả lập và máy chủ HTTPS cục bộ.
#>
param(
  [switch]$Browser,
  [string]$QaDir = ""
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
if (-not $QaDir) { $QaDir = Join-Path (Split-Path -Parent $repo) "temp\qa-level4" }
Set-Location -LiteralPath $repo

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Chưa cài Node.js >= 22 (https://nodejs.org)." }
$major = [int]((node -p "process.versions.node.split('.')[0]") | Select-Object -First 1)
if ($major -lt 22) { throw "Cần Node.js >= 22 (đang có $major)." }
Write-Host "Repo: $repo"

Write-Host "`n[1/3] Kiểm tra cú pháp JavaScript" -ForegroundColor Cyan
$files = @(Get-ChildItem assets\*.js, tests\*.cjs, tests\e2e\*.cjs -File)
foreach ($f in $files) { node --check $f.FullName; if ($LASTEXITCODE -ne 0) { throw "Lỗi cú pháp: $($f.Name)" } }
Write-Host ("  OK: " + $files.Count + " file")

Write-Host "`n[2/3] Contract + Auth" -ForegroundColor Cyan
node --test tests/level4-contract.test.cjs tests/auth-contract.test.cjs tests/auth-account-menu.test.cjs
if ($LASTEXITCODE -ne 0) { throw "Contract/Auth tests FAILED" }

if ($Browser) {
  Write-Host "`n[3/3] Chromium E2E (QA dir: $QaDir)" -ForegroundColor Cyan
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "Cần npm (đi kèm Node.js) để cài Playwright." }
  New-Item -ItemType Directory -Force -Path $QaDir | Out-Null
  if (-not (Test-Path (Join-Path $QaDir "node_modules\@playwright\test"))) {
    Push-Location $QaDir
    if (-not (Test-Path package.json)) { '{"name":"afn-qa-level4","private":true}' | Set-Content -Encoding UTF8 package.json }
    npm install --no-audit --no-fund @playwright/test@1.64.1
    $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $QaDir "browsers"
    npx playwright install chromium
    Pop-Location
  }
  $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $QaDir "browsers"
  $env:NODE_PATH = Join-Path $QaDir "node_modules"
  node (Join-Path $QaDir "node_modules\@playwright\test\cli.js") test -c playwright.master.config.cjs --reporter=line
  if ($LASTEXITCODE -ne 0) { throw "Browser E2E FAILED" }
} else {
  Write-Host "`n[3/3] Bỏ qua Chromium E2E (thêm -Browser để chạy)."
}
Write-Host "`nTẤT CẢ KIỂM THỬ ĐÃ CHẠY ĐỀU PASS." -ForegroundColor Green
