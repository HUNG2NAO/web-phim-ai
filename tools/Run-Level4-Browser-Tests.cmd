@echo off
chcp 65001 >nul
rem AI FILM NETWORK - chay toan bo kiem thu Level 4 tren Windows, gom Chromium E2E.
rem Nhap dup file nay. Lan dau se tai Playwright + Chromium vao ..\temp\qa-level4 (ngoai repo, khoang 200 MB).
rem Ket qua: Run-Level4-Browser-Tests.console.log va .junit.xml o thu muc chua source-level4.
cd /d "%~dp0.."
set "OUT=%~dp0..\.."
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "Start-Transcript -LiteralPath '%OUT%\Run-Level4-Browser-Tests.console.log' -Force | Out-Null; try { & '%~dp0run-level4-tests.ps1' -Browser -ReportFile '%OUT%\Run-Level4-Browser-Tests.junit.xml' | Out-Host; $code = $LASTEXITCODE; if ($null -eq $code) { $code = 0 } } catch { Write-Host ('LOI: ' + $_.Exception.Message); $code = 3 } finally { Stop-Transcript | Out-Null }; exit $code"
echo Ket thuc voi ma: %ERRORLEVEL%
pause
