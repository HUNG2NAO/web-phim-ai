@echo off
rem AI FILM NETWORK - chay Setup-Level4-Worktree.ps1 an toan (khong doi execution policy he thong).
rem Ghi TOAN BO dau ra (ke ca loi cu phap PowerShell) vao Setup-Level4-Worktree.console.log va giu cua so mo.
chcp 65001 >nul
cd /d "%~dp0"
echo AI FILM NETWORK - Level 4 setup dang chay... (log: %~dp0Setup-Level4-Worktree.console.log)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "Start-Transcript -LiteralPath '%~dp0Setup-Level4-Worktree.console.log' -Force | Out-Null; try { & '%~dp0Setup-Level4-Worktree.ps1' -Root '%~dp0.' -NoPause; $code = $LASTEXITCODE } catch { Write-Host ('LOI: ' + $_.Exception.Message); $code = 3 } finally { Stop-Transcript | Out-Null }; exit $code"
echo.
echo Ket thuc voi ma: %ERRORLEVEL%   (0 = thanh cong)
echo Ket qua chi tiet: Setup-Level4-Worktree.log va Setup-Level4-Worktree.console.log
pause
