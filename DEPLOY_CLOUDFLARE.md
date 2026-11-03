# Chuyển 5 website phim AI từ Vercel sang Cloudflare Pages

> Trạng thái: RUNBOOK / kế hoạch triển khai. Chưa chuyển DNS, chưa thay hosting Production.
> Ngày lập: 2026-10-28. Thực hiện từng tên miền, kiểm thử trước khi cắt chuyển.
> Kho nguồn: HUNG2NAO/web-phim-ai, nhánh Production: main.

## 1. Kiến trúc đã chốt

Mắt Bão (nhà đăng ký 5 domain) → Cloudflare DNS (5 zone) → Cloudflare Pages (1 project) ← GitHub main.
Video nằm tại nền tảng phát video riêng, không tải video lớn lên GitHub hay Pages.

Các domain:
- xuongphim.ai (Xưởng Phim / tuong-lai / #3FD0F5)
- khophim.ai (Kho Phim / co-trang / #4FB08F)
- phephim.ai (Phê Phim / tuong-lai / #FF4F7B)
- phimhay.ai (Phim Hay / co-trang / #E8673A)
- ghienphim.ai (Ghiền Phim / co-trang / #A68BE0)

Giữ Vercel `web-phim-ai` cho đến khi tất cả kiểm thử đạt. KHÔNG xóa hoặc sửa repository Production khi chưa cần.

## 2. Kiểm tra trước khi thao tác

- [ ] Mở Vercel: kiểm tra tên project, tên miền, giá trị DNS thực tế, tình trạng deployment.
- [ ] Tại Mắt Bão, với TỪNG domain: ghi lại nameserver cũ và chụp màn hình toàn bộ bản ghi DNS.
- [ ] Sao lưu các bản ghi A, AAAA, CNAME, MX, TXT (SPF, DKIM, DMARC), CAA, SRV, bản ghi xác minh nếu có.
- [ ] Kiểm tra DNSSEC tại nhà đăng ký. Không đổi nameserver khi DS cũ không tương thích; xử lý DNSSEC theo hướng dẫn Cloudflare.
- [ ] Không gửi mật khẩu, mã OTP, API token lên GitHub hoặc vào chat.
- [ ] Tránh chuyển tất cả 5 domain cùng lúc.

## 3. Tạo một project Cloudflare Pages (chưa đụng DNS)

1. Vào https://dash.cloudflare.com/, đăng nhập tài khoản Cloudflare đang dùng.
2. Chọn `Workers & Pages` → `Create application` → `Pages` → `Connect to Git` (tên nút có thể đổi đôi chút).
3. Chọn `GitHub`, bấm `Install & Authorize` khi được hỏi, chỉ cấp quyền cho repo cần thiết nếu có lựa chọn.
4. Chọn kho `HUNG2NAO/web-phim-ai`; nhấn `Begin setup`.
5. Điền:
   - Project name: `web-phim-ai-5sites` (nếu đã có người dùng, chọn tên khác và ghi lại chính xác).
   - Production branch: `main`
   - Framework preset: `None` (hoặc `No framework`)
   - Build command: `exit 0` (không có bước build; nếu màn hình cho bỏ trống Build command, cũng được)
   - Build output directory: `.` (dấu chấm, vì index.html nằm ở thư mục gốc)
   - Root directory (advanced): để mặc định `/` hoặc root repository
6. Bấm `Save and Deploy` hoặc `Deploy`.
7. Chờ trạng thái `Success`; mở URL `https://<project>.pages.dev` thực tế do Cloudflare cấp.

Đạt khi: trang chủ hiện, có thanh `Xem thử giao diện`, đủ 5 nút thương hiệu, chuyển đổi 2 phong cách, không lỗi asset 404, responsive trên điện thoại.

## 4. Đưa domain về Cloudflare DNS (từng domain)

Lặp lại theo thứ tự: xuongphim.ai → khophim.ai → phephim.ai → phimhay.ai → ghienphim.ai.

1. Cloudflare `Domains` → `Onboard a domain` → nhập domain gốc (ví dụ `xuongphim.ai`) → `Continue` → chọn `Free`.
2. Kiểm tra bản ghi được tự động nhập. Đối chiếu với ảnh chụp DNS gốc ở Mắt Bão. Bổ sung bản ghi email/xác minh còn thiếu trước khi đổi NS.
3. Cloudflare sẽ hiển thị 2 nameserver được cấp riêng cho domain này. Ghi lại ĐÚNG cặp đó. Không dùng nameserver của domain khác.
4. Ở Mắt Bão: mục quản lý domain → `Name Server` → `Sử dụng Name Server tùy chỉnh` → thay bằng 2 nameserver vừa được Cloudflare cấp → lưu.
5. Quay về Cloudflare chọn `Check nameservers` (nếu có), chờ zone chuyển sang `Active`. Không khẳng định thành công khi chưa có trạng thái Active và DNS thực tế khớp.
6. Nếu domain đang dùng email, xác nhận gửi/nhận email và TXT/MX/SPF/DKIM/DMARC.

LƯU Ý: chưa được xóa DNS Vercel trước khi Pages test đạt. Nếu cấu hình hiện tại Vercel chưa hoạt động, cần ghi nhận điều đó khi so sánh.

## 5. Gắn domain vào Pages và chuyển lần lượt

1. Cloudflare → `Workers & Pages` → project `web-phim-ai-5sites` → `Custom domains` → `Set up a domain`.
2. Gắn `www.xuongphim.ai` và `xuongphim.ai` để bảo toàn hướng canonical hiện tại (apex → www). Hệ thống có thể yêu cầu sửa/xóa bản ghi A/CNAME cũ xung đột; kiểm tra trước khi chấp thuận.
3. Nếu Cloudflare không tự tạo bản ghi đúng, làm theo yêu cầu ngay tại màn hình. Không nhập IP Vercel cũ cho Pages.
4. Kiểm tra cả `https://www.xuongphim.ai` và `https://xuongphim.ai`, giấy chứng nhận HTTPS, logo/màu, ảnh, search, bộ lọc, và tình trạng không hiển thị thanh preview.
5. Chỉ sau khi `www` hoạt động, cấu hình Redirect Rule (301 hoặc 308) cho domain apex → `https://www.<domain>` nếu cần; kiểm tra không vòng lặp. Không tự động áp dụng redirect tất cả domain bằng một biểu thức chưa thử.
6. Tương tự với bốn domain còn lại. Tổng cộng có thể cần 10 custom domains trên 1 project (mỗi domain gốc và `www`).

## 6. Bộ kiểm thử bắt buộc

- [ ] `<project>.pages.dev`: preview 5 thương hiệu hoạt động
- [ ] 5 domain `www` tải qua HTTPS và đúng logo/nhận diện
- [ ] 5 domain apex redirect đúng sang `www` (nếu dùng canonical www)
- [ ] `xuongphim.ai`, `phephim.ai` hiển thị phim tương lai; ba domain còn lại phim cổ trang
- [ ] Màn hình điện thoại không cuộn ngang; chức năng tìm kiếm, bộ lọc, dialog phim hoạt động
- [ ] Các asset JS/CSS trả 200, không lỗi 404; không lỗi script Console
- [ ] Footer dẫn chéo 5 site hoạt động
- [ ] DNS records email không thất lạc
- [ ] Push commit lên `main` sau khi setup và xác nhận Pages tự deploy phiên bản mới

## 7. Khôi phục (rollback)

- KHÔNG xóa project Vercel.
- Nếu lỗi chỉ xảy ra với 1 domain, giữ 4 domain còn lại nguyên trạng.
- Khôi phục các bản ghi DNS đã sao lưu tại Cloudflare về đích Vercel theo GIÁ TRỊ HIỆN TẠI trên Vercel Dashboard, không đoán IP.
- Có thể dùng lại nameserver cũ khi bộ DNS cũ còn nguyên, nhưng cách này có độ trễ lớn hơn. Cần xét DNSSEC trước khi hoàn nguyên.
- Kiểm tra lại SSL/redirect sau rollback.

## 8. Việc KHÔNG bao gồm trong đợt hạ tầng

- Chưa thêm phim thật, player HLS, CMS, sitemap, Open Graph, URL riêng.
- Chưa thay đổi 36 phim mẫu.
- Không đưa video dung lượng lớn lên GitHub/Cloudflare Pages.
- Không sửa giao diện và không chuyển sang framework.

## Tài liệu chính thức

- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/
- https://developers.cloudflare.com/pages/platform/limits/
