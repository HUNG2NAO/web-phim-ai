# AI FILM NETWORK — MASTER DELIVERY (Website mẫu Xưởng Phim)

- **Ngày:** 31/10/2026 (giờ Việt Nam)
- **Thực hiện:** Claude (Opus 5.5)
- **Nhánh:** `feature/master-site-xuongphim-2026-10-31`, PR nháp **#9**, nối tiếp chuỗi #3 → #8
- **Không đụng tới:** `main` (`c6dd520`), 5 website Production, DNS, dữ liệu thật trên Supabase, PC Hưng, các dự án H2N khác.

**Kết luận: PARTIALLY COMPLETE.** Toàn bộ mã nguồn của website mẫu đã viết xong và đạt hết các kiểm thử trong môi trường cô lập. Còn hai việc bị chặn vì cần quyền truy cập mà phiên làm việc này không có:
1. Chạy migration trên Supabase.
2. Bật Preview Cloudflare cho nhánh mới.

Ngoài ra còn vài hạng mục giao diện chưa làm (xem mục 18).

---

## Cập nhật 31/10/2026 17:30 — QA người dùng thật, Community Chat

### Kết luận

| Hạng mục | Kết luận | Bằng chứng / lý do |
|---|---|---|
| AUTHENTICATION | **BLOCKED** | Chưa có tài khoản QA. Claude không tự tạo tài khoản và không vượt bước xác minh email. Đã kiểm qua API thật: Auth bật email, bắt buộc xác nhận email, khách bị chặn ở mọi RPC cần đăng nhập |
| DAILY CHECK-IN | **BLOCKED** (UI) · PASS (DB staging) | 131/131 kiểm thử trên PostgreSQL và staging, gồm cả 30 yêu cầu điểm danh đồng thời → đúng 1 lần |
| WALLET | **BLOCKED** (UI) · PASS (DB staging) | Ví chỉ đọc; không tự cộng được; sổ cái khớp số dư |
| MOVIE UNLOCK | **BLOCKED** (UI) · PASS (DB staging) | Trừ điểm đúng 1 lần, không đủ điểm không bị trừ, hết hạn, hoàn điểm |
| VIDEO PLAYBACK | **PASS** cho khách xem tập miễn phí · BLOCKED cho tập khóa/thành viên | Trên Preview thật: tập 1 phim QA phát YouTube chính thức của Blender, trình phát báo `PLAYING`, đã chạy 5,2 giây. Tập 2/3 hiện đúng cổng "Đăng nhập để xem", không lộ nguồn |
| COMMUNITY CHAT | **Đã xây** · BLOCKED nghiệm thu đa tài khoản thật | Trước đây **NOT IMPLEMENTED**. Nay có Realtime + Presence thật trên Supabase. Staging 36/36 PASS. Mock đa tab 6/6. Còn cần ≥ 2 tài khoản QA để thử Realtime thật giữa người dùng |
| ADMIN MODERATION | **BLOCKED** (UI) · PASS (DB staging + mock) | Ẩn/khôi phục, khóa/mở chat, phân quyền theo site, nhật ký |
| REAL USER JOURNEY | **BLOCKED** | Phụ thuộc tài khoản QA |

### Môi trường thử nghiệm

- **Preview:** https://feature-master-site-xuongphi.web-phim-ai-5sites.pages.dev. Lưu ý: Cloudflare cắt tên nhánh còn 28 ký tự, nên `…xuongphim.web-phim-ai-5sites…` **không tồn tại**.
- **Supabase staging:** `ai-film-network`, đã xác minh lại không phục vụ Production. Migration đã chạy: 4, 4.1, 4.2 + 2 bản sửa nhỏ. Mã hàm và policy trên staging khớp md5 với bản đã kiểm thử.
- **Dữ liệu QA:** `db/staging/50_qa_seed.sql` tạo phim **"QA TEST · Phim mở Blender"** với 3 tập:
  - Tập 1: Big Buck Bunny, miễn phí, có nguồn dự phòng MP4.
  - Tập 2: Sintel, mở sớm 30 điểm, có nguồn dự phòng.
  - Tập 3: Tears of Steel, dành cho thành viên.
  Video thuộc Blender Foundation, giấy phép CC BY. Gỡ bằng `59_qa_cleanup.sql`.
- **Số tài khoản QA đã tạo: 0.** Đang chờ chủ hệ thống tự đăng ký 3 thành viên + 1 admin bằng alias Gmail (`+qa1`, `+qa2`, `+qa3`, `+qaadmin`) và tự xác minh email.

### Khách lần đầu trên Preview thật (Phase 2, phần không cần tài khoản): PASS

- Trang chủ hiện phim QA. Tìm "blender" ra đúng 1 phim, "cyber" ra 5 phim. Lọc thể loại Cyberpunk ra 5 phim.
- Mở chi tiết phim: hiện thanh tập trước/tiếp; danh sách tập có tên và nhãn Sớm 30 / TV.
- Chat theo phim mời đăng nhập; khách không đọc được tin.
- 0 lỗi console. Mọi lệnh gọi REST Supabase trả 200.

### Community Chat (Level 4.2)

| Hạng mục | Thiết kế đã triển khai |
|---|---|
| Phòng | `network` chung cho 5 site · `film:<site>:<phim>` theo từng phim |
| Đọc/gửi | Chỉ thành viên đã đăng nhập. Gửi **chỉ** qua RPC; tên người gửi do máy chủ gắn: hồ sơ → tên lúc đăng ký → "Thành viên"; không bao giờ dùng email |
| Realtime | Supabase Realtime `postgres_changes` (vẫn tuân RLS), cộng Presence để đếm **người đang xem thật** (không có số giả). Tự đồng bộ lại sau khi mất mạng và mỗi 45 giây, để gỡ tin vừa bị ẩn |
| Chống lạm dụng | Tối đa 500 ký tự · 5 tin / 30 giây · chặn tin trùng trong 60 giây. Có khóa tư vấn (advisory lock) theo người, nên 20 yêu cầu đồng thời vẫn chỉ ghi 5 tin. Báo cáo tối đa 30 lần/ngày |
| An toàn hiển thị | Luôn dùng textContent: HTML/script hiển thị như chữ thường. Đã test với `<img onerror>` |
| Kiểm duyệt | Ẩn/khôi phục tin (nhân sự đúng site; phòng chung cần admin) · khóa/mở chat toàn mạng (chỉ admin, không khóa được chủ mạng) · tab **Chat cộng đồng** trong Dashboard · mọi thao tác ghi `admin_audit_log` |
| Giao diện | Nút "Trò chuyện" ở sidebar · nút nổi 💬 trên điện thoại (khung chat toàn màn hình) · khung "Bàn luận về phim" trong cửa sổ phim · emoji · trạng thái Trực tiếp / Mất kết nối |

### Lỗi tìm thấy và đã sửa trong đợt này

1. **Chưa có chat:** đã xây Level 4.2 như trên.
2. **Lỗi bảo mật được test chặn lại trước khi phát hành:** policy RLS của chat gọi hàm trong schema `private` → thành viên sẽ gặp lỗi "permission denied". Đã viết lại policy theo kiểu inline, và thêm contract test cấm lặp lại lỗi này.
3. **Người mới đăng ký chat hiện "Thành viên"** thay vì tên đã nhập, do hồ sơ chỉ được tạo khi vào trang Tài khoản. Đã sửa: lấy tên từ lúc đăng ký. Có test.
4. **Phim mở bằng link trực tiếp không gắn được chat phim** (module nạp sau). Đã sửa. Có E2E.
5. **Contract test chỉ đọc migration Level 4 gốc:** đã mở rộng sang 4.1 và 4.2. Nhờ đó bắt được RPC `admin_chat_reports` chưa được khai báo trong phạm vi kiểm tra.

### Kiểm thử đợt này

| Loại | Kết quả |
|---|---|
| SQL cục bộ (chức năng + đồng thời + gỡ/áp lại) | 133 + 13 PASS |
| Staging thật (transaction tự rollback) | Chat 36/36 PASS. Trước đó toàn bộ suite 95/95 PASS |
| Contract | 30/30 |
| E2E mock (Chromium) | 67/67, có 6 kịch bản chat nhiều tab/nhiều tài khoản |
| Preview thật | Khách lần đầu PASS · phát video thật PASS |

### Việc còn lại, cần chủ hệ thống

1. Đăng ký và xác minh email cho 4 tài khoản QA. Nếu link xác minh mở ra trang lỗi hoặc localhost, cần thêm URL Preview vào **Supabase → Auth → URL Configuration → Redirect URLs**.
2. Đăng nhập QA1 trong trình duyệt của Claude app. Claude sẽ nghiệm thu điểm danh, ví, mở khóa, phát tập khóa, chat.
3. Đăng nhập QA2 trong Chrome. Khi đó có 2 người thật để nghiệm thu Realtime.
4. Báo khi QA ADMIN đã xác minh. Claude sẽ cấp quyền admin **chỉ trên staging** để nghiệm thu kiểm duyệt; gỡ bằng `59_qa_cleanup.sql`.

---

## Cập nhật 31/10/2026 16:40 — Nghiệm thu tích hợp Staging/Preview

### Kết luận

| Hạng mục | Kết luận | Cơ sở |
|---|---|---|
| LOCAL LEVEL 4 | **PASS** | SQL 95 chức năng + 12 đồng thời/rollback · contract 29/29 · Chromium E2E 61/61 (mock) · GitHub Actions xanh |
| SUPABASE STAGING | **PASS** | Migration 4 + 4.1 đã áp lên `ai-film-network`. Schema khớp tuyệt đối bản đã test (vân tay md5 7/7 nhóm). Bộ tích hợp **95/95 PASS** trên Supabase thật, tự rollback |
| CLOUDFLARE PREVIEW | **PASS** | https://feature-master-site-xuongphi.web-phim-ai-5sites.pages.dev deploy thành công (check "Cloudflare Pages" xanh). Đã kiểm thử bằng trình duyệt thật |
| AUTHENTICATION | **BLOCKED** (phần trình duyệt) | Đã kiểm qua API thật: Auth bật email, chưa bật Google, đăng ký cần xác nhận email; khách bị chặn ở mọi RPC cần đăng nhập (401). Phần còn thiếu là luồng đăng nhập thật trên Preview: cần một **tài khoản test** do chủ hệ thống tự tạo. Claude không tạo tài khoản và không nhập mật khẩu |
| WALLET & UNLOCK | **PASS ở DB** / **BLOCKED ở trình duyệt** | Điểm danh, ví, mở khóa, idempotency, hoàn điểm, hết hạn, cách ly site: PASS trên Supabase thật (giả lập JWT trong transaction). Luồng bấm nút trên Preview cần tài khoản test nói trên |
| MASTER WEBSITE | **NOT READY** (chờ 1 bước) | Giao diện, database và luồng khách đã chạy thật trên Preview. Chỉ còn nghiệm thu bằng tài khoản thành viên thật |
| MULTI-SITE PACKAGE | **READY** | 5 site chạy thật trên Preview: đúng logo, đúng site trong sidebar, có nút điểm danh, mọi gọi Supabase trả 200, không lỗi console. Cổng `site-config.test.cjs` PASS |
| PRODUCTION | **NOT READY** | Chưa merge `main`, chưa deploy Production (đúng yêu cầu). Cần xong nghiệm thu thành viên, bật leaked-password protection, rồi chủ hệ thống duyệt |

### Phân loại bằng chứng (không dùng mock để kết luận Production)

| Loại | Đã chạy | Kết quả |
|---|---|---|
| Mock test | Chromium E2E với Supabase giả lập, trên Linux/CI và PC Nhân | 61/61 (PC Nhân lần trước 56/56) |
| Local browser/DB test | PostgreSQL 16 tạm: chức năng, RLS, tranh chấp đồng thời, gỡ/áp lại migration | 95 + 12 PASS |
| Staging integration | Supabase `ai-film-network` thật: 95 kiểm thử trong 1 transaction rollback. Gọi REST/RPC thật từ Preview bằng khóa publishable | PASS · không để lại dữ liệu (users=1, t schema không còn, ví/sổ cái = 0) |
| Preview (trình duyệt thật) | Built-in browser trên PC Nhân, 1280px và 375px: 5 site, mở phim, trình phát, popover điểm danh (đọc quy tắc thật +10…+50), hộp đăng nhập, kho phim, 404, header bảo mật | PASS · 0 lỗi console khi tải sạch |
| Production acceptance | — | **Chưa thực hiện** (không thuộc phạm vi, không merge `main`) |

### 1. `ai-film-network` không phục vụ Production (đã xác minh lại trước khi thay đổi tiếp)

- `main` (c6dd520) không có `auth-config.js`, không nạp Supabase.
- Kiểm tra trực tiếp 5 tên miền thật (www.xuongphim.ai … www.ghienphim.ai): chỉ nạp `sites.js, films.js, films-tuong-lai.js, art.js, app.js`. Không có Supabase.
- Dữ liệu project: 1 tài khoản (chủ hệ thống), 0 phim. Gói Free đã đủ 2 project, nên không tạo được project staging riêng mà không phát sinh phí.

### 2. Migration đã áp và ảnh hưởng

- **Migration đã chạy:** `level4_rewards_unlock_social_v1`, `level4_1_playback_fallback` (sau 6 migration Level 3).
- **Bảng mới (12, đều bật RLS):** wallets, wallet_ledger, daily_checkins, site_episodes, episode_sources, content_entitlements, site_social_links, content_reports, traffic_events, admin_audit_log, reward_rules (1 dòng mặc định), network_staff (1 dòng: chủ hệ thống, chỉ khi đúng id + email đã xác nhận).
- **Hàm:** 13 hàm public (RPC), 11 hàm private mới. 2 hàm Level 3 (`notify_followed_release`, `reflect_review_approval`) được giữ nguyên, chỉ bị thu quyền EXECUTE trực tiếp. Trigger vẫn chạy bình thường.
- **Thay đổi trên bảng Level 3:**
  - `site_films`: chính sách `site_films_public_published` (lỗi khách bị "permission denied") được thay bằng `site_films_anon_published` + `site_films_member_read`. Đã tái hiện lỗi cũ trên Supabase thật trước khi sửa.
  - Thêm trigger nhật ký `audit_site_films` và `audit_review_moderation`.
- **Dữ liệu hiện hữu:** không đổi. Trước và sau đều là auth_users 1, profiles 1, site_memberships 1, site_staff 5, viewer_profiles 1, site_films 0, film_reviews 0.
- **Rollback:** `db/staging/99_rollback_level4.sql`, được test tự động. Gỡ xong, schema trùng khớp Level 3; áp lại được. Chỉ dùng khi chưa có điểm thật.
- **Supabase Advisors:** chỉ còn cảnh báo theo thiết kế (RPC SECURITY DEFINER tự kiểm quyền bên trong; `traffic_events` không có policy nghĩa là chặn toàn bộ truy cập trực tiếp). Việc cần chủ tài khoản: bật **Leaked password protection** trong Auth.

### 3. Cloudflare Preview: nguyên nhân và cách sửa

- **Nguyên nhân:** project `web-phim-ai-5sites` (tài khoản Cloudflare Hung2nao) để Preview ở chế độ *Custom branches*. Danh sách chỉ gồm 7 nhánh cũ, nên mọi commit của nhánh Level 4 bị xếp hàng `queued:idle` và không bao giờ build.
- **Đã sửa:** thêm đúng 1 nhánh `feature/master-site-xuongphim-2026-10-31` vào *Include Preview branches*. Production branch vẫn là `main`, Production deploy vẫn bật, 11 tên miền giữ nguyên, các nhánh Preview cũ giữ nguyên.
- **Kết quả:** commit `c4c742f` deploy thành công. URL cố định: https://feature-master-site-xuongphi.web-phim-ai-5sites.pages.dev

### 4. Xử lý lỗi video và nguồn phát dự phòng (Level 4.1)

- Mỗi tập có thể có 1 nguồn dự phòng: **YouTube Video ID** hoặc **URL HTTPS** mà chủ site có quyền phát. CSDL chặn mọi định dạng khác (`fallback_valid`).
- Nguồn dự phòng **chỉ được trả về sau cùng bước kiểm tra quyền xem** như nguồn chính. Tập khóa không lộ cả nguồn chính lẫn nguồn dự phòng.
- **Trình phát:**
  - Tự chuyển sang nguồn dự phòng khi YouTube báo lỗi (video đã gỡ, riêng tư, chủ video tắt nhúng 101/150) hoặc khi video HTTPS lỗi tải. Có thông báo cho người xem.
  - Nếu hết nguồn: hiện "Không phát được… (đã thử cả nguồn dự phòng)" kèm nút **Thử lại** và **Báo lỗi** (mở form báo lỗi).
  - Không có DRM giả, không vượt giới hạn nền tảng.
- **Dashboard:**
  - Thêm ô nguồn dự phòng. Kiểm tra định dạng, bắt buộc xác nhận quyền phát hành; nhập `-` để xóa.
  - Ô tự ẩn khi CSDL chưa có 4.1.
  - Mọi thay đổi nguồn đều ghi nhật ký.

### 5. Sửa lỗi giao diện tìm thấy khi rà tablet

Ở 768–860px, danh mục bị đẩy xuống dưới cùng thanh bên thu gọn, do luật header cũ `order:3`. Đã sửa và thêm E2E cho 768px.

### Việc còn lại để kết luận READY

1. Chủ hệ thống tạo **1 tài khoản test**. Ví dụ: đăng ký trên Preview bằng email phụ rồi xác nhận email. Đăng nhập tài khoản này trong trình duyệt của Claude app. Claude sẽ tự nghiệm thu:
   - điểm danh;
   - ví;
   - mở khóa;
   - hoàn điểm;
   - Dashboard (nếu cấp quyền admin staging).
2. Thêm 1 phim/tập thử nghiệm có video được phép phát vào staging, để nghiệm thu trình phát với nguồn thật.
3. Bật Leaked password protection (Supabase → Auth).

---

## Cập nhật 31/10/2026 15:30 — Hoàn thiện website mẫu, kiểm thử trên PC Nhân

**Trạng thái website mẫu: HOÀN TẤT ở môi trường kiểm thử.** Có bằng chứng chạy thật trên PC Nhân (Windows) và GitHub Actions. Nghiệm thu trên Supabase thật và Cloudflare Preview vẫn chờ chủ tài khoản (xem cuối mục này).

**Git (đọc trực tiếp trên PC Nhân trước khi làm):** worktree `source-level4` ở nhánh `dev/pc-nhan-level4` tại commit `465d75f`, không có file nào bị sửa sau khi checkout; `source` vẫn ở `main` `c6dd520`. Sau khi xong, chạy `Setup-Level4-Worktree.cmd` để fast-forward lên `4b272dc` (log ghi "sạch=True", `source` không đổi). Commit sau đó chỉ sửa CI/test.

**Giao diện website mẫu (dùng chung cho cả 5 site):**

| Hạng mục | Đã làm |
|---|---|
| Sidebar thu gọn | Desktop: thanh bên gồm Danh mục, Của tôi (Tủ phim, Điểm thưởng, Cộng đồng) và Hệ thống 5 site. Nút ☰ thu gọn thành thanh biểu tượng 76px, trạng thái được nhớ trên trình duyệt. Từ 700px trở xuống mặc định thu gọn. Điện thoại: chuyển thành thanh tab dưới 5 mục, nút cao ≥ 44px |
| Lưới poster 16:9 | Áp dụng cho hàng phim, Kho phim, Bảng xếp hạng và Xem tiếp. Tranh tự vẽ ở kích thước 640×360, vẫn tải lười. Khi rê chuột hiện nút phát |
| Trải nghiệm xem phim | Cửa sổ rộng 1180px, chia 2 cột (thông tin phim / danh sách tập có tên tập, nhãn Sớm/TV). Thanh "‹ Tập trước · Tập 02/03 · Tên tập · Tập tiếp ›" tự bỏ qua tập chưa phát. Trên điện thoại, cửa sổ phim toàn màn hình, trình phát dính trên đầu |
| Xem tiếp | Lưu trên trình duyệt theo từng site (chỉ mã phim + số tập, không gửi đi đâu). Chỉ ghi khi video thật sự bắt đầu phát, nên tập bị khóa không bị ghi nhầm |
| CSS | Tách sang `assets/site-shell.css`, chỉ nạp ở trang chủ, để Member Hub và Dashboard không bị ảnh hưởng |

**Thành viên, điểm danh, ví điểm, mở khóa, Social Hub:** giữ nguyên logic Level 4 đã được kiểm thử. Bổ sung thêm E2E cho ba luồng:
- tập có giá → hiện cổng mở khóa 50 điểm;
- tập dành cho thành viên → phát được ngay khi đã đăng nhập;
- 5 site đều có nút điểm danh, hành động phim và Social.

**Shared Core cho 4 site còn lại:**
- `tests/site-config.test.cjs`: cổng kiểm cấu hình 6 mục. Gồm: id/tên miền không trùng; tương phản màu nút ≥ 4.5 (WCAG AA); phim nổi bật và mọi hàng phim tồn tại đúng thế giới; Social chỉ https; resolver nhận đúng tên miền/www/preview; không file JS nào liệt kê cứng 5 site.
- Đã bỏ danh sách cứng trong `account.js`.
- E2E chạy đủ 5 site: sidebar, poster 16:9, cửa sổ phim, đánh dấu đúng site, không lỗi console/CSP, không cuộn ngang.

**Kiểm thử — bằng chứng thực tế:**

| Bộ | Kết quả | Nơi chạy |
|---|---|---|
| Cú pháp 29 file + contract/Auth/cấu hình 5 site | **29/29 PASS** | PC Nhân (Windows PS 5.1, Node 24.21) · cloud · CI |
| **Chromium E2E trên PC Nhân** | **56/56 PASS** (27,4 giây) | PC Nhân, Chrome for Testing 156. Log: `Run-Level4-Browser-Tests.console.log`, `Run-Level4-Browser-Tests.junit.xml` (tests=56, failures=0) |
| Chromium E2E (cloud + CI) | 56/56 PASS | Linux, GitHub Actions |
| SQL chức năng/RLS + tranh chấp đồng thời | 88/88 + 10/10 PASS | PostgreSQL 16 tạm · CI |
| jsdom (auth, Member Hub, preview 5 site) | PASS trên CI | Đã đưa vào workflow Level 4. Harness cũ nạp thiếu `sites.js` cho `index.html` → đã sửa cho đúng thứ tự trang thật |

**Công cụ cho PC Nhân (nhấp đúp, không cần gõ lệnh):**
- `Setup-Level4-Worktree.cmd`: cập nhật worktree.
- `source-level4\tools\Run-Level4-Browser-Tests.cmd`: chạy toàn bộ test, gồm cả Chromium. Playwright được cài ngoài repo tại `temp\qa-level4`. Máy chủ test tự dùng OpenSSL của Git for Windows.

**Chuẩn bị nghiệm thu Supabase Staging / Cloudflare Preview:**
- **Supabase `ai-film-network`:** đã chạy `db/staging/00_preflight_readonly.sql` (chỉ đọc) → **28/28 ok = true**. Level 3 đủ bảng, RLS bật, có admin, 12 bảng Level 4 chưa tồn tại. Chính sách `site_films_public_published` (lỗi khách không đọc được phim) **vẫn đang có** và sẽ được migration thay. **Chưa chạy migration**: đây là project dùng chung, nên cần chủ tài khoản quyết định dùng nó làm staging hay tạo project staging riêng.
- **Thứ tự nghiệm thu khi được phép:**
  1. Chạy `db/level4_rewards_unlock_social_v1.sql`.
  2. Chạy `db/staging/90_verify_after_level4.sql`: mong đợi 5 dòng PASS, kết thúc bằng ROLLBACK.
  3. Trên Preview, dùng 2 tài khoản thật: điểm danh; mở khóa 1 tập có video thật; mở lại không trừ điểm; hoàn điểm từ Dashboard; tài khoản thường không vào được Dashboard; đổi `?site=khophim` → cùng ví, điểm danh không lặp.
- **Cloudflare Preview:** cần chủ tài khoản bật Branch control cho `feature/master-site-*` (Workers & Pages → `web-phim-ai-5sites` → Settings → Builds). Vercel Preview của nhánh vẫn build thành công.

---

## 1. PC Nhân Environment Verification

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| Máy | Windows x64, tên `desktop-h0vfv7o`, Claude desktop 4.4212.0 | `get_device_info` |
| Thư mục được cấp quyền | **Không có** | `connectedFolders: []` |
| Bản dự án trên PC Nhân | **BLOCKED**: không tìm thấy trong Desktop, Documents, Du Lieu; các ổ khác không có quyền xem | `device_list_dir` chỉ trả về tên, không có thư mục con |
| Nguồn chuẩn dùng thay thế | GitHub `HUNG2NAO/web-phim-ai`, commit `dac2dd3` khớp điểm dừng trong báo cáo kiểm toán | `git ls-remote` |
| Phụ thuộc PC Hưng | `tests/README.md` có nhắc đường dẫn `D:\HUNG_PROJECTS\…` (chỉ là ví dụ chạy test). Mã ứng dụng không có đường dẫn tuyệt đối | `grep` |

**Rủi ro:** nếu PC Nhân đang giữ thay đổi chưa push, các thay đổi đó **không** nằm trong bản bàn giao này. Hãy push lên một nhánh riêng trước khi merge.

## 2. Legacy Inventory (kế thừa)

| Chức năng | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện 5 thương hiệu, 2 phong cách (Production) | ALREADY WORKING · REUSABLE | Giữ nguyên |
| Supabase Auth: đăng ký, đăng nhập, quên mật khẩu, hồ sơ | REUSABLE · PARTIALLY IMPLEMENTED | Chưa có SMTP riêng, Google OAuth tắt |
| Member Hub: tủ phim, hồ sơ xem, tùy chỉnh, thông báo, đánh giá | REUSABLE | Thêm tab Điểm thưởng |
| Studio: đăng phim, kiểm duyệt, thông báo, yêu cầu dữ liệu | REUSABLE | Mở rộng thêm 8 tab |
| Premium UI Level 3, tối ưu font | REUSABLE | Giữ nguyên |
| Đọc phim công khai khi **chưa đăng nhập** | **NEEDS FIX → ĐÃ SỬA** | Xem mục 17 |
| Trình phát YouTube và MP4, lưu tiến độ | REUSABLE | Tập có khóa đi qua kiểm tra quyền ở server |

Không xóa chức năng nào. Không đóng PR cũ nào.

## 3. Git / PR Status

- `main` = `c6dd520`, không thay đổi. Production vẫn chạy đúng bản này.
- PR #1 → #8 giữ nguyên.
- **PR #9 (nháp):** `feature/master-site-xuongphim-2026-10-31` → `feature/homepage-font-speed-2026-10-29`.
- CI GitHub trên PR #9: **SQL ✓, Contract + Chromium E2E ✓**. Workflow: `.github/workflows/level4-master-site.yml`.

## 4. Master Website Selection

Chọn **xuongphim.ai**. Lý do dựa trên bằng chứng:
- Level 3 bắt đầu thử nghiệm tại đây (`docs/LEVEL3_PILOT_RELEASE_READINESS.md`).
- Có đủ quyền quản trị trong `site_staff`.
- Dashboard mặc định mở đúng website này.
- Phong cách "tương lai" là giao diện phức tạp hơn, nên làm mẫu cho 4 site còn lại phù hợp hơn.

## 5. Architecture Decisions

| Quyết định | Lý do |
|---|---|
| Giữ HTML/JS thuần + Supabase, **không** chuyển sang monorepo hay framework | Hệ thống hiện có đã là "một mã nguồn cho 5 site". Đổi framework là viết lại toàn bộ và tăng rủi ro không cần thiết |
| Logic điểm đặt trong **hàm PostgreSQL SECURITY DEFINER**, không dùng Edge Functions | Giao dịch nguyên tử, khóa hàng và RLS nằm ngay trong cơ sở dữ liệu. Không thêm dịch vụ, không phát sinh chi phí |
| **Một ví cho toàn mạng lưới**, sổ cái ghi `site_id` | Đúng yêu cầu "1 lần điểm danh/ngày trên toàn mạng lưới". Thống kê vẫn tách được theo từng site |
| Nguồn phát nằm ở bảng riêng `episode_sources`, người xem không đọc được | Người xem chỉ nhận nguồn qua `get_playback_source()` sau khi máy chủ kiểm tra quyền |
| Thêm Shared Core `afn-core.js` cho các module mới | Các module Level 3 cũ chưa được refactor để tránh hồi quy (xem mục 18) |

## 6. Feature Completion

| Hạng mục | Mã nguồn | Kiểm thử cô lập | Môi trường thật |
|---|---|---|---|
| Điểm danh hằng ngày | Xong | PASS (SQL + E2E) | NOT TESTED (chưa chạy migration) |
| Ví điểm | Xong | PASS | NOT TESTED |
| Mở khóa tập (Free / Early / Member) | Xong | PASS | NOT TESTED |
| Social Hub + UTM/ref | Xong | PASS | NOT TESTED |
| Lưu phim · Chia sẻ · Báo lỗi | Xong | PASS | NOT TESTED |
| URL riêng cho phim/tập + `/phim/…` + 404 thật | Xong | PASS (máy chủ mô phỏng Cloudflare) | BLOCKED (chưa có Preview) |
| Dashboard 8 tab mới | Xong | PASS | NOT TESTED |
| Header bảo mật CSP | Xong | PASS (0 vi phạm CSP) | BLOCKED (chưa có Preview) |
| Site thứ hai (Kho Phim): dùng chung ví, tách nội dung và Social | Xong | PASS | BLOCKED |

## 7. UX/UI Implementation

**Đã làm:**
- Header: nút ★ hiển thị điểm, có chấm báo "chưa điểm danh". Bấm vào mở bảng 7 ngày, ngày 7 được làm nổi bật.
- Cửa sổ phim:
  - Danh sách tập có nhãn **Sớm 50** hoặc **TV**.
  - Khung khóa ngay trên trình phát: báo số dư, có nút "Mở khóa · N điểm", báo thiếu điểm kèm nút "Điểm danh hôm nay".
  - Ba nút Lưu, Chia sẻ, Báo lỗi; liên kết cộng đồng.
- Member Hub: tab **Điểm thưởng** gồm số dư, đã nhận, đã dùng, chuỗi 7 ngày, lịch sử giao dịch, nội dung đã mở khóa, lịch sử điểm danh.
- Chất lượng: kiểm tra ở bề rộng 375px không có cuộn ngang. Hỗ trợ bàn phím (Esc đóng popover và cửa sổ phim), nút cao tối thiểu 38–44px.

**Đã làm thêm (31/10 15:30):** lưới poster 16:9, sidebar thu gọn, cửa sổ xem phim 2 cột với thanh Tập trước/Tập tiếp, Xem tiếp (xem mục Cập nhật ở đầu báo cáo).
**Chưa làm:** nguồn phát dự phòng khi YouTube lỗi.

## 8. Member System

- Kế thừa Supabase Auth: một danh tính chung cho cả mạng lưới, phiên đăng nhập tách riêng theo từng tên miền (không dùng cookie chung).
- Tier "Member" = mọi tài khoản đã đăng nhập.
- Còn thiếu:
  - SMTP riêng.
  - Google OAuth.
  - Bật chống mật khẩu bị lộ.
  - Danh sách Redirect URL cho 5 domain và các bản `www`.

## 9. Daily Check-in

- Công thức điểm = `base + min(chuỗi−1, cap) × step + (ngày thứ 7 ? bonus : 0)`.
- Mặc định **10 / +2 / tối đa 5 lần / +30**. Đây là giá trị tạm, đổi được ngay trong Dashboard.
- Ngày được tính theo giờ Việt Nam bằng đồng hồ server. Khóa chính `(user_id, checkin_date)` bảo đảm mỗi người chỉ điểm danh 1 lần/ngày trên toàn mạng lưới.
- Kiểm thử gửi 30 yêu cầu cùng lúc: chỉ **1** lần được ghi nhận.

## 10. Points Wallet

- **Trình duyệt chỉ đọc**, không có quyền INSERT/UPDATE vào ví hay sổ cái.
- Có 4 hàm đổi điểm: điểm danh, mở khóa, điều chỉnh của admin, hoàn điểm. Mỗi hàm đều:
  - khóa hàng ví (`FOR UPDATE`);
  - dùng idempotency key duy nhất cho mỗi người;
  - dựa vào `CHECK (balance >= 0)` để số dư không thể âm.
- Bất biến đã kiểm thử: **số dư = tổng sổ cái** với mọi ví, kể cả sau các kịch bản tranh chấp.
- Điều chỉnh tay chỉ chủ hệ thống làm được, bắt buộc ghi lý do, và được ghi nhật ký.

## 11. Content Unlocking

- **Free:** ai cũng xem được.
- **Early Access:** mở bằng điểm. Có thể tự chuyển thành miễn phí từ một ngày đặt trước, và có thể giới hạn số ngày được xem sau khi mở.
- **Member:** cần đăng nhập.
- Điểm chỉ bị trừ **trong cùng giao dịch** cấp quyền xem. Nếu lỗi thì không trừ.
- Gửi lại cùng một yêu cầu thì không bị trừ lần hai.
- Có hoàn điểm, ghi nhật ký. Quyền xem tách riêng theo từng website.
- **Giới hạn:** khi đã nhận được YouTube ID, người dùng có thể chia sẻ lại ID đó. Muốn chặn thật cần URL ký thời hạn (Cloudflare Stream hoặc Bunny), dự kiến cho giai đoạn sau.

## 12. Social Hub

- **Website → Social:**
  - Liên kết quản lý trong Dashboard, chọn được vị trí hiển thị (footer, cửa sổ phim, Member Hub, header).
  - Đường dẫn phải đúng tên miền nền tảng (chống link giả mạo).
  - Mở tab mới với `noopener`.
  - Hiện chưa có liên kết thật, nên website không hiển thị khối Social.
- **Social → Website:**
  - Hỗ trợ deep link `?film=…&tap=…` và `/phim/…`.
  - Ghi nhận lượt vào có UTM hoặc ref, không lưu IP, user agent hay user id. Chỉ ghi 1 lần mỗi phiên, sau đó xóa tham số khỏi URL.
  - Có công cụ tạo link UTM.
- **Nhiệm vụ nhận điểm từ Social:** chưa làm. Lý do: chưa có cách xác minh follow/subscribe đáng tin cậy.

## 13. Dashboard

Các tab mới, toàn bộ bằng tiếng Việt và chỉ hiển thị số liệu thật:
- **Tổng quan:** 13 chỉ số.
- **Tập & quyền xem.**
- **Điểm danh & ví:** cấu hình mức thưởng, ví của thành viên, lịch sử điểm, điều chỉnh, danh sách lượt mở khóa, hoàn điểm.
- **Báo lỗi.**
- **Social.**
- **Traffic:** kèm công cụ tạo link UTM.
- **Nhật ký:** trigger tự ghi khi có thay đổi phim, tập, nguồn phát, Social, kiểm duyệt, báo lỗi, cấu hình, điểm.
- **Phân quyền:** chỉ xem. Việc cấp quyền làm trong SQL Editor để tránh tự cấp quyền từ trình duyệt.

## 14. Shared Core

`assets/afn-core.js` cung cấp: nhận diện thương hiệu, một Supabase client duy nhất, URL chia sẻ, idempotency key, toast, định dạng ngày giờ Việt Nam. Các module `rewards.js`, `social.js`, `member-rewards.js`, `studio-ops.js` đều dùng chung lõi này cho cả 5 site.

## 15. Multi-site Packaging

**Cách bật cho một site mới:**
1. Cấu hình trong `assets/sites.js` (tên, màu, `social`), rồi chạy `node --test tests/site-config.test.cjs`: test sẽ chỉ ra mục còn thiếu.
2. Thêm site id vào `assets/level3-config.js → enabledSites`.
3. Thêm liên kết Social trong Dashboard.

Không cần sao chép mã nguồn.

**Site thứ hai (Kho Phim):** kiểm thử E2E PASS (dùng chung ví, điểm danh 1 lần toàn mạng, phim và Social tách riêng). Kiểm thử SQL về cách ly dữ liệu cũng PASS (admin Kho Phim không sửa được Xưởng Phim, quyền xem không chuyển chéo giữa site).

## 16. Test Results

| Bộ kiểm thử | Kết quả | Chạy ở đâu |
|---|---|---|
| `tests/sql/run.sh`: chức năng, RLS, phân quyền, cách ly | **88/88 PASS** | PostgreSQL 16 tạm (cục bộ và GitHub Actions) |
| `tests/sql/run.sh`: tranh chấp đồng thời, double-spend, trùng yêu cầu | **7/7 PASS** | Như trên |
| `tests/level4-contract.test.cjs` + test Auth cũ | **21/21 PASS** | Node 22 |
| E2E website mẫu (`tests/e2e/master-site.spec.cjs`) | **16/16 PASS** | Chromium, HTTPS, Supabase giả lập |
| E2E Level 3 cũ chạy lại (hồi quy) | **31/31 PASS** | Như trên |
| Test jsdom cũ (3 bộ) | NOT TESTED | Không cài được npm trong môi trường này. CI GitHub cũ vẫn chạy được |
| Trên Supabase thật, tài khoản thật, domain thật | **NOT TESTED** | Thiếu quyền truy cập |
| TypeScript / ESLint | NOT APPLICABLE | Dự án JS thuần, không có cấu hình. Đã chạy `node --check` cho mọi file |

Trong quá trình kiểm thử, mình phát hiện và đã sửa 4 lỗi:
1. Thuộc tính `hidden` bị CSS ghi đè, làm popover và form báo lỗi luôn hiện.
2. Nút Lưu/Chia sẻ không xuất hiện khi mở phim bằng link trực tiếp.
3. Lỗi chưa xử lý khi trình duyệt chặn clipboard.
4. Ký tự ⚿ không hiển thị được.

## 17. Security Findings

- **Đã sửa (lỗi thật của Level 3):** chính sách RLS của `site_films` dành cho anon tham chiếu bảng `site_staff`. Mọi truy vấn của khách chưa đăng nhập đều lỗi `permission denied`, và lỗi bị nuốt mất, nên khách **không bao giờ thấy phim đã phát hành**. Đã tách thành chính sách riêng cho anon và cho thành viên. Tái hiện và kiểm thử trên PostgreSQL thật.
- Đã thêm:
  - CSP, `X-Frame-Options`, `Permissions-Policy`, HSTS.
  - Không dùng `innerHTML` cho dữ liệu người dùng; có test kiểm tra.
  - Giới hạn 20 báo lỗi/người/24 giờ.
  - Mọi hàm admin đều kiểm tra quyền ở server.
- **Còn lại:**
  - Ai cũng gọi được `log_landing`, nên có thể bị spam số liệu Traffic (rủi ro thấp, không có dữ liệu cá nhân).
  - Kho mã công khai, và Cloudflare Pages phục vụ cả thư mục `db/` và `tests/`. Không có secret nào trong đó, nhưng nên đặt thư mục build riêng.

## 18. Known Issues

1. ~~Migration Level 4 chưa chạy~~ → **đã áp lên staging `ai-film-network` ngày 31/10, 95/95 PASS** (xem mục Cập nhật 16:40). Ghi chú cũ: Trước khi chạy, các tab Dashboard mới sẽ báo "chưa áp dụng migration". Trang người xem tự ẩn nút điểm danh, ẩn khối Social và không hiện tập khóa (đã có test kiểm chứng).
2. ~~Preview Cloudflare chưa tạo~~ → **đã bật và deploy thành công ngày 31/10** (xem mục Cập nhật 16:40). Ghi chú cũ: **Preview Cloudflare của nhánh mới chưa được tạo** ("Deployment Not Found"). Cần mở Cloudflare → Workers & Pages → `web-phim-ai-5sites` → Settings → Builds → Branch control, rồi cho phép nhánh `feature/master-site-*`.
3. Vercel vẫn còn nối với kho và vẫn build Preview cho mỗi nhánh. Production hiện chạy trên Cloudflare, nên nên tắt Vercel để tránh nhầm lẫn.
4. Logic nhận diện thương hiệu đang lặp lại ở 6 file Level 3 cũ. Nên chuyển dần sang `afn-core.js`.
5. Các hạng mục chưa làm: nguồn phát dự phòng, nhiệm vụ Social có thưởng, thưởng giới thiệu bạn bè. (Lưới 16:9 và sidebar đã xong ngày 31/10.)

## 19. Rollback Plan

- **Mã nguồn:** chỉ cần không merge PR #9, hoặc revert. `main` và Production không bị ảnh hưởng.
- **Cơ sở dữ liệu:** migration chỉ thêm bảng và hàm mới. Nếu cần gỡ trước khi có điểm thật:
  - Xóa các hàm `public.claim_daily_checkin`, `unlock_episode`, `get_playback_source`, `log_landing`, `admin_*` mới.
  - Xóa các bảng Level 4 theo thứ tự phụ thuộc.
  - Tạo lại chính sách cũ `site_films_public_published`. Lưu ý: chính sách cũ này mang theo lỗi đọc phim của khách.

  **Không** gỡ khi đã có điểm hoặc lượt mở khóa thật. Khi đó tắt điểm danh trong Dashboard và gỡ phát hành các tập bị khóa.
- **Cloudflare:** `_headers` / `_redirects` / `404.html` chỉ có tác dụng trên nhánh này.

## 20. Production Readiness

**Chưa sẵn sàng cho Production.** Thứ tự để đưa lên:
1. Chạy migration Level 4 trên `ai-film-network`.
2. Bật Preview Cloudflare cho nhánh mới.
3. Nghiệm thu bằng 2 tài khoản thật:
   - điểm danh;
   - mở khóa một tập có video thật;
   - hoàn điểm;
   - thử bằng tài khoản không phải admin.
4. Cấu hình Supabase Auth: SMTP, Redirect URL, chống mật khẩu bị lộ.
5. Gộp PR #3 → #9 và merge vào `main` với Level 3/4 **chỉ bật cho xuongphim**.
6. Bật lần lượt 4 site còn lại qua `enabledSites`.

**TÔI ĐỀ XUẤT BƯỚC TIẾP THEO LÀ:** chạy `db/level4_rewards_unlock_social_v1.sql` trong Supabase SQL Editor và bật Preview cho nhánh `feature/master-site-*` trên Cloudflare. Sau đó nghiệm thu bằng tài khoản thật.
