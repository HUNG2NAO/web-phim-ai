Chạy kiểm thử bằng Node.js >= 22. Không có đường dẫn cứng tới ổ đĩa nào: mọi đường dẫn tính từ thư mục repo.

## Windows (PC Nhân hoặc bất kỳ máy nào)

```powershell
# trong thư mục repo, ví dụ C:\Users\PC\Downloads\WEB_PHIM_AI\WEB_PHIM_AI\source-level4
powershell -ExecutionPolicy Bypass -File .\tools\run-level4-tests.ps1            # cú pháp + contract + Auth
powershell -ExecutionPolicy Bypass -File .\tools\run-level4-tests.ps1 -Browser   # thêm Chromium E2E (cài Playwright vào thư mục QA ngoài repo)
```

- Thư mục công cụ QA mặc định là `..\temp\qa-level4`, nằm cạnh repo. Có thể đổi bằng `-QaDir <đường dẫn>`.
- `node_modules` không bao giờ được đặt trong repo.

## Linux / macOS / CI

```bash
node --test tests/level4-contract.test.cjs tests/auth-contract.test.cjs tests/auth-account-menu.test.cjs
npx playwright test -c playwright.master.config.cjs            # cần @playwright/test + chromium
PGHOST=... PGPORT=... PGUSER=postgres bash tests/sql/run.sh     # chỉ dùng PostgreSQL TẠM, không bao giờ trỏ vào Supabase
```

## Các bộ test cũ dùng jsdom

Các bộ `tests/preview-regressions.cjs`, `tests/level3-hub.test.cjs`, `tests/auth-browser.test.cjs` cần `jsdom`. Cài vào thư mục QA rồi đặt `NODE_PATH` trỏ tới `node_modules` của thư mục đó. Ví dụ trên Windows:

```powershell
$env:NODE_PATH = (Resolve-Path ..\temp\qa-level4\node_modules).Path
node --test tests/preview-regressions.cjs
```

Các test này dùng DOM để kiểm tra:
- sắp xếp phim;
- thứ tự ưu tiên hostname / URL / hash / localStorage;
- chuyển thương hiệu liên tục;
- dữ liệu số tập hợp lệ và không hợp lệ.

Chúng không thay thế kiểm thử layout, font, canvas và độ tương phản trong trình duyệt thật. Bộ test không dùng token và không cần kết nối mạng.
