# AI FILM NETWORK — Báo cáo khôi phục & thiết lập Level 4 trên PC Nhân

- Ngày: 31/10/2026 (giờ máy PC Nhân)
- Máy: DESKTOP-H0VFV7O · Windows 10.0.22631 · Windows PowerShell 5.1.22621.6133
- Thư mục: `C:\Users\PC\Downloads\WEB_PHIM_AI\WEB_PHIM_AI`
- Cách thực hiện: Claude điều khiển trực tiếp PC Nhân. Claude mở File Explorer và nhấp đúp `Setup-Level4-Worktree.cmd`, sau đó đọc log từ máy về. Người dùng không phải gõ lệnh nào.

## Trạng thái cuối: PC NHÂN LEVEL 4 — READY TO DEVELOP

Bằng chứng nằm trên máy: `Setup-Level4-Worktree.log` và `Setup-Level4-Worktree.console.log` (bản transcript của PowerShell), chạy lúc 14:27:47–14:27:51.

## 1. Nguyên nhân PowerShell "chớp rồi tắt"

Lần chạy trước không để lại file log nào. Vậy script đã dừng trước dòng ghi log đầu tiên, tức là ngay ở bước khởi động. Có hai nguyên nhân cộng lại:

1. **Thư mục gốc bị rỗng.** Bản cũ lấy thư mục gốc qua `param([string]$Root = $PSScriptRoot)`. Khi chạy bằng menu "Run with PowerShell" của Windows PowerShell 5.1, `$PSScriptRoot` trong `param()` có thể rỗng. Khi đó đường dẫn log và đường dẫn `source` đều sai, nên script lỗi ngay lúc khởi động.
2. **Cửa sổ tự đóng.** Menu "Run with PowerShell" đóng cửa sổ ngay khi script kết thúc. Lỗi khởi động lại xảy ra trước khi `trap` và `Read-Host` có tác dụng. Kết quả là không thấy thông báo lỗi và cũng không có log.

## 2. Đã sửa gì

| Sửa | Tác dụng |
|---|---|
| Xác định `$Root` trong thân script, có 3 phương án dự phòng: `$PSScriptRoot` → `$MyInvocation.MyCommand.Path` → thư mục hiện tại | Không còn phụ thuộc vào `param()` của PS 5.1 |
| Thêm `Setup-Level4-Worktree.cmd`, chạy bằng nhấp đúp | Gọi `powershell.exe -NoProfile -ExecutionPolicy Bypass` **chỉ cho lần chạy này**, không đổi execution policy của hệ thống |
| `.cmd` bật `Start-Transcript` → `Setup-Level4-Worktree.console.log` | Mọi lỗi, kể cả lỗi khởi động, đều được ghi lại |
| `.cmd` kết thúc bằng `pause` và in mã thoát | Cửa sổ không tự đóng nữa |
| Giữ đúng 1 BOM UTF-8 trong `.ps1` (bản trước bị trùng BOM) | Tránh ParserError trên PS 5.1 |

Hai file này đã được commit vào nhánh Level 4: `tools/setup-level4-worktree.ps1` và `tools/Setup-Level4-Worktree.cmd`.

## 3. Kết quả chạy thực tế (trích log)

```
source  remote=https://github.com/HUNG2NAO/web-phim-ai.git  nhánh=main  commit=c6dd520…
source  status: 0 dòng · thay đổi THẬT: 0 · file chưa theo dõi: 0
source-level4 cũ (28 file, không có Git) đã được ĐỔI TÊN, KHÔNG xóa → source-level4.partial-20261031-142748
GitHub feature/master-site-xuongphim-2026-10-31 = 465d75f1e070…
Đã tạo worktree source-level4 · nhánh dev/pc-nhan-level4 từ 465d75f1e070…
KIỂM TRA  source-level4: nhánh=dev/pc-nhan-level4 commit=465d75f… sạch=True
KIỂM TRA  source gốc: nhánh=main commit=c6dd520… (trước: main c6dd520…)
XÁC MINH GIT: ĐẠT
Node.js v24.21.0 … [1/3] OK: 28 file · [2/3] tests 23 · pass 23 · fail 0
KIỂM THỬ: PASS
```

Claude cũng kiểm tra lại bằng cách liệt kê thư mục từ xa:

- `source-level4\.git` là file con trỏ worktree (90 byte). Thư mục có đủ `db/`, `docs/`, `tests/`, `tools/`, `.github/`.
- `source-level4.partial-20261031-142748\` vẫn còn đủ **28 file** cũ. Không file nào bị xóa.
- Các thư mục `backups/`, `logs/`, `reports/`, `screenshots/`, `temp/` cùng `AGENTS.md`, `Enter-Project.ps1`, `Run-Verification.ps1` vẫn còn nguyên.

## 4. Môi trường

| Thành phần | Giá trị |
|---|---|
| Git | 2.56.0.windows.3 |
| PowerShell | 5.1.22621.6133 (Desktop) |
| Node.js / npm | v24.21.0 / 11.x (đạt yêu cầu ≥ 22) |
| Remote | `https://github.com/HUNG2NAO/web-phim-ai.git` |
| Worktree | `source` → c6dd520 [main] · `source-level4` → 465d75f [dev/pc-nhan-level4] |

## 5. An toàn

- Không dùng `reset --hard`, `clean`, force push hay xóa nhánh/file.
- Không đổi execution policy của hệ thống.
- `source` giữ nguyên: vẫn ở nhánh, commit và trạng thái sạch như trước. Thay đổi duy nhất là Git thêm metadata worktree và 1 ref remote vào `source\.git`.
- Không đụng Supabase Production, Cloudflare Production, DNS, License hay dự án H2N.
- Không ghi secret vào log hay báo cáo.

## 6. Còn mở (không chặn việc phát triển)

- Chromium E2E chưa chạy trên PC Nhân. Muốn chạy thì dùng lệnh `tools\run-level4-tests.ps1 -Browser`; lệnh này cài Playwright vào `..\temp\qa-level4`. Trên CI và môi trường của Claude, phần này đạt 47/47.
- Supabase staging và Cloudflare Preview cần chủ tài khoản đăng nhập. Các mục này không liên quan đến việc thiết lập PC Nhân.
- Worktree đang ở 465d75f, chưa có file `.cmd` mới. Nhấp đúp `Setup-Level4-Worktree.cmd` thêm một lần nữa sẽ fast-forward lên commit mới nhất, và script đã tự bảo vệ nếu worktree có thay đổi chưa commit.

## 7. Làm việc hằng ngày trên PC Nhân

- Mở `C:\Users\PC\Downloads\WEB_PHIM_AI\WEB_PHIM_AI\source-level4` bằng editor.
- Commit lên nhánh `dev/pc-nhan-level4`.
- Push lên GitHub rồi mở PR vào nhánh Level 4. Không merge vào `main`.
