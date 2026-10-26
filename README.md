# Hệ thống web phim AI (5 tên miền, 1 giao diện)

Một mã nguồn dùng chung cho cả 5 website:

| Tên miền | Thương hiệu | Phong cách |
|---|---|---|
| xuongphim.ai | Xưởng Phim | Tương lai (viễn tưởng, neon xanh) |
| khophim.ai | Kho Phim | Cổ trang (ngọc bích) |
| phephim.ai | Phê Phim | Tương lai (hành động, neon hồng) |
| phimhay.ai | Phim Hay | Cổ trang (son cam) |
| ghienphim.ai | Ghiền Phim | Cổ trang (tím) |

Đổi phong cách một site: sửa dòng `world` trong `assets/sites.js` (`"co-trang"` hoặc `"tuong-lai"`).

Trang tự nhận tên miền đang mở và đổi tên, màu, phim nổi bật, các hàng phim.
Sửa giao diện **một lần**, cả 5 site cập nhật cùng lúc.

## Cấu trúc

```
index.html          Khung trang (dùng chung)
assets/style.css    Giao diện (dùng chung)
assets/app.js       Xử lý trang (dùng chung)
assets/sites.js     Cấu hình riêng từng thương hiệu
assets/films.js     Phim cổ trang
assets/films-tuong-lai.js  Phim tương lai
assets/art.js       Tranh vẽ tự động khi chưa có poster
```

## Thêm phim của bạn

Mở `assets/films.js`, sao chép một khối phim và sửa:
- `video`: đường dẫn file .mp4 (ví dụ `videos/ten-phim.mp4`) hoặc link video bạn sở hữu.
- `poster`: ảnh poster (ví dụ `posters/ten-phim.jpg`). Không có ảnh thì trang tự vẽ poster theo `hue`.
- `sites`: nếu phim chỉ muốn hiện trên vài site, ví dụ `["khophim", "phimhay"]`.

Video dung lượng lớn nên để trên dịch vụ lưu trữ video (Cloudflare Stream, Bunny Stream…) rồi dán link vào `video`.

## Xem thử trên máy

Mở `index.html` bằng trình duyệt. Thanh trên cùng cho phép chuyển giữa 5 thương hiệu.
Có thể thêm `?site=khophim` vào cuối địa chỉ để mở thẳng một thương hiệu.

## Đưa lên 5 tên miền (Vercel, miễn phí)

1. Vào vercel.com, đăng nhập bằng GitHub, bấm **Add New → Project**, chọn kho `web-phim-ai`, bấm **Deploy** (không cần chỉnh gì).
2. Trong project: **Settings → Domains**, thêm lần lượt 5 tên miền.
3. Vercel hiện bản ghi DNS cần thêm cho từng tên miền (thường là bản ghi **A** cho `@` và **CNAME** cho `www`).
4. Vào trang quản lý tên miền Mắt Bão → **Quản lý DNS** của từng tên miền, thêm đúng các bản ghi Vercel yêu cầu.
5. Chờ 5–30 phút để DNS cập nhật. Vercel tự cấp chứng chỉ HTTPS.

Từ đó, mỗi lần mã nguồn trên GitHub thay đổi, cả 5 site tự cập nhật.
