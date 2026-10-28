Chạy kiểm thử hồi quy bằng Node.js >= 22.

Cài `jsdom` trong thư mục công cụ QA ngoài repository; đặt `NODE_PATH` trỏ tới `node_modules` đó rồi chạy:

```powershell
$env:NODE_PATH = 'D:\HUNG_PROJECTS\WEB_PHIM_AI\temp\qa\node_modules'
node --test tests/preview-regressions.cjs
```

Các test dùng DOM để kiểm tra sắp xếp, ưu tiên hostname/URL/hash/localStorage, chuyển thương hiệu liên tục và dữ liệu số tập hợp lệ/không hợp lệ. Không thay thế kiểm thử layout, font, canvas và tương phản trong trình duyệt thật. Không có token hoặc kết nối mạng trong bộ test này.
