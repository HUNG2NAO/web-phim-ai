@echo off
rem Sao lưu CSDL Supabase AI FILM NETWORK về thư mục backups\ (không lưu mật khẩu).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-supabase.ps1"
pause
