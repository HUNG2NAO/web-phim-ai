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

## Cập nhật 01/11/2026 21:50 — ĐỘC LẬP TRIỂN KHAI 5 WEBSITE · LEVEL 4.7 (đa ngôn ngữ, nhiều nguồn video)

**Định hướng đã chốt:**
- Một repository và một Shared Core.
- Mỗi website một Cloudflare project, cùng domain, deployment và rollback riêng.
- Thành viên và ví điểm dùng chung; nội dung và phân quyền cách ly theo website.
- Level 4.7: một phim, nhiều ngôn ngữ, nguồn video bên ngoài.

**Phạm vi đã giữ nguyên:**
- Không đổi DNS, không đụng Production (`web-phim-ai-5sites` vẫn chạy `main` `c6dd520`), không merge `main`.
- Không áp migration lên Staging, không xóa dữ liệu QA.
- Không phát sinh chi phí: Pages Free, không dịch vụ lưu trữ.

### 1. Bản đồ 10 tên miền (Cloudflare, chỉ đọc)
| Zone | `@` | `www` | Bản ghi khác |
|---|---|---|---|
| xuongphim.ai | CNAME Proxied → `web-phim-ai-5sites.pages.dev` | CNAME Proxied → `web-phim-ai-5sites.pages.dev` | Email Resend (`send.mail`, `rsend.mail`, DKIM) |
| khophim.ai | như trên | như trên | — |
| phephim.ai | như trên | như trên | — |
| phimhay.ai | như trên | như trên | — |
| ghienphim.ai | như trên | như trên | — |

- Cả 10 tên miền gắn **một** project `web-phim-ai-5sites`, đều Active.
- Ngoài ra có project `web-phim-ai` từ trước; Claude không đụng tới.

### 2. Năm project Cloudflare độc lập (Preview, không gắn tên miền)
| Project | Production branch | URL | Bản đang chạy | Kiểm chứng (Preview thật) |
|---|---|---|---|---|
| `xuongphim-ai` | `site/xuongphim` | xuongphim-ai.pages.dev | 4.6.1 · core `9767c1e` | Khóa site ✓ (`?site=khophim` bị bỏ qua) · catalog `xuongphim` (1 phim Staging) · robots chặn · sitemap 17 URL đúng domain · noindex |
| `khophim-ai` | `site/khophim` | khophim-ai.pages.dev | 4.6.1 · `9767c1e` | Khóa site ✓ · catalog `khophim` · sitemap 21 ✓ · 17 thẻ phim |
| `phephim-ai` | `site/phephim` | phephim-ai.pages.dev | **4.7.0-pre · `8a0503b`** | Khóa site ✓ · sitemap 17 ✓ · có Language Router · CSP mới |
| `phimhay-ai` | `site/phimhay` | phimhay-ai.pages.dev | 4.6.1 · `9767c1e` | Khóa site ✓ · sitemap 21 ✓ · 38 thẻ phim |
| `ghienphim-ai` | `site/ghienphim` | ghienphim-ai.pages.dev | 4.6.1 · `9767c1e` | Khóa site ✓ · sitemap 21 ✓ · 18 thẻ phim |

- **Cấu hình mỗi project:**
  - không có lệnh build, xuất ra thư mục gốc;
  - Pages Functions chạy (robots, sitemap, `/api/catalog` trả đúng site);
  - **chỉ tự triển khai nhánh `site/<id>` của chính nó** (Preview branches = None, để không tốn lượt build và không chéo site).
- **Bộ nhận diện khóa site:** quy tắc `<id>-ai` đã có từ 20:15. Mỗi project chỉ có `releases/<id>.json` của chính nó (4 tệp còn lại trả 404).

### 3. Chứng minh cập nhật và rollback độc lập — **VERIFIED**
| Bước (giờ VN) | Kho Phim (`khophim-ai`) | 4 website còn lại |
|---|---|---|
| Trước (21:00) | 4.6.1, lớp giao diện `cb2e77…`, đầu trang không viền | 4.6.1, core `9767c1e` |
| **Cập nhật** riêng Kho Phim (21:04): đẩy `site/khophim` `1a4cdfa` (chỉ `themes/khophim.css` + `releases/khophim.json`) | Tự triển khai → **4.6.2**, lớp giao diện `8267a6…`, đầu trang có viền ngọc `rgb(79,176,143)` | Phê Phim kiểm trực tiếp: vẫn 4.6.1, lớp giao diện `14cfc8…`, `app.js`/`sites.js` không đổi, không viền. Các project kia không build bản mới (Production branch khác) |
| **Rollback** trên Cloudflare (21:14, "Rollback to this deployment" → `a74eab88`, hộp xác nhận ghi rõ chỉ ảnh hưởng `khophim-ai.pages.dev`) | Sau ~10 giây: **4.6.1**, lớp giao diện `cb2e77…`, không viền | Không đổi |
| Đồng bộ git (21:19): revert trên `site/khophim` (`6f83376`, giống hệt 4.6.1) | Khớp bản đã rollback | Không đổi |
| **Thăng cấp core riêng** Phê Phim lên `8a0503b` (Level 4.7 client) | 4.6.1 | **Chỉ Phê Phim** lên 4.7.0-pre. Kiểm trực tiếp xuongphim, khophim, phimhay, ghienphim: vẫn 4.6.1, `language-router.js` = 404 |
| Production `web-phim-ai-5sites` | — | Vẫn `main` `c6dd520` suốt quá trình (bản `site/*` chỉ là Preview, bị bỏ qua) |

### 4. Level 4.7 — schema
- **`episode_media`:** nhiều nguồn mỗi tập theo ngôn ngữ (BCP 47).
  - Loại bản: gốc / lồng tiếng / phụ đề cứng.
  - Nhà cung cấp: `youtube`, `youtube_unlisted`, `facebook`, `gdrive`, `native` (https). Mỗi nhà cung cấp có ràng buộc định dạng riêng.
  - Thứ tự ưu tiên dùng làm dự phòng. Xuất bản cần `rights_attested`.
- **`episode_subtitles`:**
  - `source = youtube`: track phụ đề có sẵn trong video YouTube, không cần URL. Đây là mô hình ưu tiên: một link YouTube với nhiều phụ đề.
  - `source = vtt`: tệp WebVTT (https) cho MP4.
  - Chỉ một phụ đề mặc định mỗi tập.
- **`get_playback_media(tập, ngôn ngữ)`:**
  - dùng lại kiểm tra quyền xem của v1, nên tập bị khóa không lộ nguồn;
  - trả toàn bộ media và phụ đề đã xuất bản cho Language Router;
  - tập chưa có media thì trả nguồn v1.
- **RLS và audit:**
  - chỉ admin đúng website hoặc nhân sự mạng được ghi; thêm 8 cổng 2FA (tổng 35);
  - `anon` không đọc trực tiếp bảng;
  - trigger `audit_media` ghi mọi thêm/sửa/xóa vào nhật ký quản trị.
- **Gỡ:** `db/staging/93_rollback_level4_7.sql` chỉ xóa 2 bảng và 2 hàm mới.
- **Kiểm thử cục bộ: 33/33:**
  - phân quyền theo site, ràng buộc, bản nháp ẩn;
  - phụ đề YouTube không có URL, VTT bắt buộc https;
  - audit, khóa quyền xem;
  - fallback v1 không đổi;
  - áp lại 2 lần (idempotent); gỡ rồi áp lại OK; `dangerous_grants` 0.
- **Staging:** chưa áp.
  - Bản chạy thử trong giao dịch tự hủy (21:2x) **không chạy**: hộp xác nhận của Supabase không có người trả lời trong thời hạn, nên không có thay đổi nào.
  - Gói nghiệm thu đã sẵn: backup age, áp migration, chạy `db/staging/92_verify_level4_7.sql`. Script này chỉ đọc; mọi thao tác ghi nằm trong giao dịch tự hủy. Mục tiêu: 35 cổng 2FA, 16 migration, `dangerous_grants` 0.

### 5. Video Source Manager & Language Router — **DESIGNED · IMPLEMENTED · TESTED**
**Language Router** (`assets/language-router.js`, dùng chung 5 site, không phụ thuộc DOM):
- **Ngôn ngữ người xem**, theo thứ tự: `?lang=` → lựa chọn đã lưu → ngôn ngữ trình duyệt → mặc định của site → `vi`.
- **Chọn nguồn:**
  1. Có bản đúng ngôn ngữ (lồng tiếng / phụ đề cứng / bản riêng) thì phát bản đó; bản gốc làm dự phòng.
  2. Không có thì phát bản gốc (ưu tiên YouTube) và **bật phụ đề** ngôn ngữ đó: track YouTube (`cc_lang_pref`) hoặc `<track>` WebVTT cho MP4.
  3. Facebook / Google Drive không chọn được track, nên **mỗi ngôn ngữ một link**; ngôn ngữ không có link thì dùng ngôn ngữ mặc định.
- **Trình phát:**
  - thanh chọn ngôn ngữ (chỉ hiện khi có ≥ 2 lựa chọn); đổi ngôn ngữ thì phát lại **cùng tập**;
  - iframe nhúng chính thức Facebook/Drive (CSP `frame-src` thêm `www.facebook.com`, `drive.google.com`);
  - máy chủ chưa có 4.7 thì tự dùng v1.
  - Đã kiểm trên Staging thật qua `phephim-ai`: `PGRST202` → v1 `ok`; tập mở sớm cho khách → `login_required`, không có nguồn.

**Video Source Manager** (Studio → *Nguồn phát & ngôn ngữ*):
- Chỉ nhận **link bên ngoài**: nhận diện YouTube (watch / youtu.be / shorts / unlisted), Facebook video công khai, Google Drive, MP4 https. Từ chối http, `fb.watch`, bài viết Facebook, link lạ.
- **Không có ô tải tệp**; website không lưu trữ MP4.
- **Không tự phát hành:**
  - mọi nguồn và phụ đề mới đều là **bản nháp**;
  - phát hành phải xác nhận quyền phát và bấm xác nhận lần 2;
  - gỡ hoặc xóa cũng phải xác nhận.
- Có **"Xem thử như người xem"** (chạy router theo từng ngôn ngữ). Phụ đề YouTube bị chặn nếu tập chưa có nguồn YouTube.
- Máy chủ chưa có 4.7 thì báo rõ và khóa nút lưu.
- Chính sách riêng tư bổ sung mục trình phát nhúng Facebook/Google Drive (cần chủ/pháp lý duyệt cùng bản dự thảo).

**Kiểm thử:**
- Router unit **8/8**.
- E2E 4.7: **5**
  - một link YouTube + phụ đề, đổi sang lồng tiếng, lưu lựa chọn;
  - `?lang=`, Drive/Facebook, không vi phạm CSP;
  - fallback v1, tập khóa không lộ nguồn;
  - Studio: bản nháp → phát hành có xác nhận → người xem thấy phụ đề Thái;
  - từ chối link lạ, máy chủ chưa có 4.7.

### 6. Hồi quy Level 3–4.6
- E2E **122/122**: gồm 5 kịch bản 4.7, MFA, multi-site, Studio khóa site, chat, ví, điểm danh, mở khóa, quyền riêng tư.
- Unit: contract 11/11 (thêm hàm 4.7), site-config 14/14 (thêm nhà cung cấp Facebook/Drive), language-router 8/8, catalog, auth.
- SQL: 253 + 23 + khôi phục MFA 23 + Level 4.7 33.
- `site-package check`: 5/5 OK.
- Hai bài jsdom cũ vẫn không chạy được (registry npm bị chặn).

### Kết luận
| Hạng mục | Trạng thái |
|---|---|
| **MULTI-SITE PREVIEW** | **READY**: 5 project riêng, mỗi project đúng một website |
| **INDEPENDENT DEPLOYMENT** | **VERIFIED**: cập nhật + rollback Kho Phim và thăng cấp core riêng Phê Phim, 4 site còn lại không đổi; Production không đổi |
| **LEVEL 4.7 SCHEMA** | **PASS** (cục bộ: 33/33, rollback, idempotent) — **chưa áp Staging**, chờ phê duyệt |
| **VIDEO SOURCE MANAGER** | **DESIGNED · IMPLEMENTED · TESTED** (mock + fallback trên Staging thật) |
| **LANGUAGE ROUTER** | **DESIGNED · IMPLEMENTED · TESTED** |
| **PRODUCTION** | **ON HOLD** |

**Cần anh phê duyệt:**
1. **Áp Level 4.7 lên Staging** theo gói: backup, `apply_migration`, `92_verify_level4_7.sql`. Sau đó kiểm Studio và trình phát trên Supabase thật bằng QA Admin (anh đăng nhập).
2. **Chuyển tên miền từng site** từ `web-phim-ai-5sites` sang `<id>-ai`, theo runbook 20:15:
   - mỗi lần 2 tên miền;
   - thêm Redirect URL vào Supabase Auth;
   - chạy `site-package verify`;
   - rollback = trả tên miền về project cũ.
3. **Pháp lý:** chính sách (thêm mục Facebook/Drive), chat, nội dung phim thật. Vẫn **PENDING OWNER/LEGAL REVIEW**.

---

## Cập nhật 01/11/2026 20:15 — MFA SIGN-OFF · ĐỒNG BỘ 4 WEBSITE (PREVIEW) · TRIỂN KHAI ĐỘC LẬP

Không merge `main`, không đổi DNS, không đụng Production (`c6dd520` vẫn phục vụ 10 tên miền), không áp migration mới, không xóa dữ liệu.

### Phase 1 — Nghiệm thu MFA chủ mạng (đóng phạm vi)
**Thiết bị dự phòng (17:50–18:16):**
- Supabase gói hiện tại hỗ trợ tối đa 10 factor TOTP mỗi người.
- Quy tắc của Supabase:
  - đã có factor thì phải ở phiên AAL2 mới thêm được thiết bị mới;
  - gỡ factor đã xác minh cũng cần AAL2;
  - xác minh một factor mới sẽ đăng xuất các phiên khác.
- Studio → Bảo mật (commit `0054af3`):
  - danh sách thiết bị;
  - **Thêm thiết bị dự phòng**: chỉ ở AAL2, không đụng factor đang hoạt động, tên thiết bị không trùng, chỉ báo thành công khi máy chủ xác nhận factor mới `verified`;
  - **Thu hồi**: chỉ khi còn ≥ 2 thiết bị; phải xác nhận rồi nhập mã từ thiết bị **giữ lại**;
  - chọn thiết bị khi nhập mã (Studio và trang công khai).

| Bằng chứng (Supabase thật, chỉ đọc siêu dữ liệu) | Kết quả |
|---|---|
| 2 factor TOTP `verified` | `38e8…` "AFN Studio 2026-11-01" (chính, không đổi) · `28fb…` "Thiết bị dự phòng" (xác minh 18:03:28) |
| Thêm thiết bị bằng phiên AAL2, không có lệnh gỡ factor nào | Có |
| Phiên **mới** bằng thiết bị chính | Phiên `29e9…`: đăng nhập 18:08:08, nhập mã thiết bị chính lúc 18:08:27 → `aal2` |
| Phiên **mới** bằng thiết bị dự phòng | Phiên `e3a1…`: đăng nhập 18:16:21, nhập mã thiết bị dự phòng lúc 18:16:35 → `aal2` (phiên hiện tại) |
| Quyền quản trị sau MFA | Phiên 17:35 (bản 17:50): token AAL2 → `admin_staff_mfa_status` 200. Token phát hành khi xác minh thiết bị dự phòng (18:03:28) → `admin_staff_mfa_status` 200. **Phiên đăng nhập mới bằng thiết bị dự phòng (`e3a1…`) chưa gọi RPC quản trị nào** |
| `staff_mfa_required` | `false` (giữ nguyên) |

- **Kết luận:** **OWNER MFA DUAL FACTOR VERIFIED** · **PARTIAL ADMIN VERIFICATION**: quyền quản trị trên phiên mới dùng thiết bị dự phòng chưa được kiểm chứng.
- **Bài QA Admin (QA Admin bật 2FA, thao tác quản trị có ghi nhật ký, giả lập mất thiết bị trên Staging): NOT RUN.** QA Admin chưa đăng nhập; chủ dự án quyết định đóng phạm vi.
  - Quy trình mất thiết bị đã kiểm trên CSDL giả lập: `tests/sql/owner_mfa_recovery.sh` 23/23.
  - Thêm/thu hồi thiết bị đã kiểm bằng E2E: 10 kịch bản.
- Lưu ý vận hành:
  - Phiên Hungcreator vẫn đang đăng nhập trong khung trình duyệt của Claude (tab Xưởng Phim). Claude không dùng phiên này. Nên đăng xuất khi tiện.
  - Thiết bị dự phòng đang tên "Thiết bị dự phòng".

### Phase 2 — Bản chuẩn
| Mục | Giá trị |
|---|---|
| Nhánh phát triển | `feature/master-site-xuongphim-2026-10-31` (mới nhất `9767c1e`). Bản RC cũ (`release/xuongphim-l4-rc1/rc3`) **không dùng** |
| Production | `main` `c6dd520` (bản demo tĩnh, không có Supabase) — project Pages `web-phim-ai-5sites`, 10 tên miền Active |
| Supabase Staging | 15 migration, mới nhất `level4_6_staff_mfa` · 28/28 bảng RLS · 86 policy · 27 cổng 2FA · `dangerous_grants` 0 |
| Shared Core | 35 tệp giao diện + 6 Pages Functions, giống hệt nhau cho 5 site (SHA-256 kiểm bằng `tools/site-package.cjs`) |
| Riêng từng site | mục trong `assets/sites.js` (tên, ấn triện, màu, tagline, danh mục, hàng phim, Social dự phòng, cờ tính năng, release) · `assets/themes/<id>.css` · `sitemaps/<id>.xml` · dữ liệu Supabase theo `site_id` |

### Phase 3–4 — Đồng bộ 4 website & phát triển độc lập (`0484f43`, `9767c1e`)
Giữ kiến trúc Shared Core, không tách 4 repository.
1. **Một bộ nhận diện site duy nhất** (`AFN_RESOLVE_SITE`). Trước đây có 6 bản sao logic; nay `afn-core`, `app.js`, Member Hub, Studio và `functions/_site.js` dùng chung quy tắc.
2. **Preview khóa theo site:** host có nhãn `site-<id>` (alias nhánh `site/<id>`), `<id>-ai` hoặc `afn-<id>` (project Pages riêng sau này) chỉ phục vụ đúng site đó:
   - bỏ qua `?site=`, không có thanh chuyển site;
   - `/api/catalog`, robots, sitemap trả về đúng site;
   - vẫn `noindex`.
3. **Lớp giao diện riêng:** `assets/themes/<id>.css` chỉ được tải cho đúng site. Mọi quy tắc phải bắt đầu bằng `[data-site="<id>"]`; `site-package check` **chặn** quy tắc lan sang site khác, `@keyframes` không có tiền tố và `@import`.
   - E2E chứng minh: sửa `khophim.css` thì Xưởng Phim không tải tệp đó và không đổi giao diện.
4. **Cờ tính năng theo site** (`features`: memberHub, rewards, unlock, chat, social). Đây là cờ giao diện; quyền thật vẫn do máy chủ quyết định.
   - E2E: tắt cho riêng Phê Phim thì Xưởng Phim không bị ảnh hưởng.
5. **Phát hành độc lập:**
   - Mỗi site có nhánh `site/<id>` = Shared Core + `releases/<id>.json` (commit core, `core_sha256`, phiên bản, thời điểm thăng cấp).
   - Mỗi nhánh chỉ khác ở tệp của chính nó nên không xung đột; thăng cấp core cho từng site theo lịch riêng.
   - `site-package manifest` có `core_sha256` và tệp riêng của từng site.
6. **Lỗi phát hiện và đã sửa:** trên alias khóa site, Studio vẫn đọc `?site=`, nên admin có thể chuyển sang quản trị site khác.
   - Nay Studio chỉ quản trị đúng site đó và khóa ô chọn site; không có quyền site đó thì báo "chưa được cấp quyền quản trị <site>". E2E đã có.

### Phase 5 — Bảo mật & CSDL (Staging, chỉ đọc)
| # | Kiểm tra | Kết quả |
|---|---|---|
| 1 | RLS | 28/28 bảng bật, 0 bảng tắt; 15 migration, không chạy lại |
| 2 | Cách ly `site_id` | 19 bảng có `site_id`, ràng buộc CHECK theo 5 mã site; tập phim khóa ngoại tới `(site_id, film_id)` |
| 3 | Quyền quản trị | Hàm `private.is_*` đều qua `mfa_ok`; 27 cổng 2FA |
| 4 | Điểm danh 1 lần/ngày toàn mạng | PK `daily_checkins(user_id, checkin_date)`: một dòng mỗi người mỗi ngày, bất kể site |
| 5 | Ví chung | PK `wallets(user_id)`; số dư ≥ 0; sổ cái chống trùng `(user_id, idempotency_key)` |
| 6 | Mở khóa không chuyển nhầm site | `unlock_episode` lấy `site_id` từ chính tập phim; không có policy INSERT/UPDATE cho client; 0 bản ghi lệch site; chỉ 1 quyền `active` mỗi (người, tập) |
| 7 | Chat bật/tắt tại backend | Trigger `chat_guard_message` → `private.chat_open(room)` từ chối khi tắt (`chat_disabled`); hiện cả 6 phạm vi đang bật trên Staging |
| 8 | Quyền nguy hiểm | `dangerous_grants()` = 0 |
| 9 | Backup mã hóa | `afn_data_20261101_1611_pre46.json.age`: giải mã trên PC ĐẠT, khôi phục cô lập 31/31 (mục 16:15) |

### Phase 6 — Preview thật từng website (alias riêng, desktop + di động 375 px)
Alias: `https://site-<id>.web-phim-ai-5sites.pages.dev/`. Bản đang chạy trên cả 4 alias: **release 4.6.1, Shared Core `9767c1e`** (đọc từ `releases/<id>.json` trên chính alias), đã gồm bản sửa Studio. Cả 4 alias không cuộn ngang ở 1365 px và 375 px.
- **Giới hạn cấu hình Cloudflare:** project chỉ tự triển khai một số nhánh Preview, nên nhánh `site/*` bị *skipped*. Claude dùng "Retry deployment" (chỉ Preview) để build, không đổi cài đặt.
- Muốn tự triển khai khi đẩy nhánh `site/*`: chủ thêm `site/*` vào Settings → Builds → Branch control → Preview branches.

| Hạng mục | Kho Phim | Phê Phim | Phim Hay | Ghiền Phim |
|---|---|---|---|---|
| Homepage (thương hiệu, khóa site dù có `?site=` khác) | PASS | PASS | PASS | PASS |
| Shared Core khớp SHA-256 (35 tệp) + lớp giao diện riêng | PASS | PASS | PASS | PASS |
| Movie Catalog (thẻ phim) | PASS (17) | PASS (12) | PASS (38) | PASS (18) |
| Movie Detail + nút phát (Player) | PASS | PASS | PASS | PASS |
| Auth (hộp đăng nhập, email + mật khẩu) | PASS (khách) | PASS (khách) | PASS (khách) | PASS (khách) |
| Daily Check-in / Wallet (chip hiển thị) | PASS (khách) | PASS (khách) | PASS (khách) | PASS (khách) |
| Member Hub / tài khoản / Studio / chính sách (HTTP 200) | PASS | PASS | PASS | PASS |
| Dashboard Permissions (Studio khóa đúng site) | PASS (E2E) | PASS (E2E) | PASS (E2E) | PASS (E2E + Preview thật: đúng site, giao diện khách) |
| SEO/Routes (noindex, robots chặn, sitemap đúng domain, `/phim/<slug>` chuyển hướng) | PASS | PASS | PASS | PASS |
| Cross-site Isolation (`/api/catalog` trả đúng site) | PASS | PASS | PASS | PASS |
| Responsive (không cuộn ngang) | PASS | PASS | PASS | PASS |
| Social Links | N/A (chưa cấu hình, không hiển thị) | N/A | N/A | N/A |
| Critical regression | Không | Không | Không | Không |

- **Giới hạn trung thực:**
  - Danh mục 4 site là **dữ liệu mẫu (fixture)**. Supabase Staging chỉ có 1 phim thật (Xưởng Phim), nên **chưa thể tuyên bố nội dung Production đạt**.
  - Đăng nhập, điểm danh, mở khóa và chat **bằng tài khoản thật** trên 4 site đã kiểm ở mục 13:00 (QA thật, Preview chung). Hôm nay chỉ kiểm phần khách trên alias riêng, còn phần tài khoản kiểm bằng E2E.
  - Hai bài unit jsdom cũ không chạy được vì môi trường chặn registry npm (403).
- Tự động: E2E **117/117** · site-config 14/14 · site-package 5/5 OK · SQL 253 + 23 + 23 + 27.

### Phase 7 — Kế hoạch phát hành Production (CHƯA thực hiện, chờ phê duyệt từng đợt)
- **Hiện trạng thực tế:** **một** project Pages `web-phim-ai-5sites` gắn **cả 10 tên miền**.
  - Triển khai `main` lên project này sẽ đổi **cùng lúc 5 website**, nên **không rollback độc lập được**.
- **Đề xuất (mỗi đợt cần anh phê duyệt):**
  1. Tạo project Pages riêng cho từng site, tên `<id>-ai`. Bộ nhận diện đã khóa site theo nhãn này. Production branch = `site/<id>`.
  2. Thêm `https://www.<id>.ai` vào Supabase Auth Redirect URLs.
  3. Chuyển đúng 2 tên miền của site (apex + www) từ `web-phim-ai-5sites` sang project mới. Các site khác giữ nguyên trên `c6dd520`.
  4. Chạy smoke test: `node tools/site-package.cjs verify https://www.<id>.ai <id>`, trang chủ, đăng nhập, điểm danh, phát phim.
  5. **Rollback** = trả 2 tên miền về `web-phim-ai-5sites`.
  6. **Điều kiện dừng:**
     - `verify` lệch SHA-256;
     - lỗi 5xx;
     - đăng nhập hoặc điểm danh lỗi;
     - lộ chat khi chưa duyệt pháp lý.
- **Điều kiện bắt buộc trước Production (còn mở):**
  - pháp lý (chính sách, chat, Luật Điện ảnh): **PENDING OWNER/LEGAL REVIEW**;
  - nội dung phim thật và quyền phát;
  - chat trên tên miền thật đang tắt ở giao diện (`CHAT_PUBLIC_DOMAINS = []`); cần quyết định công tắc máy chủ cho phạm vi thật;
  - mật khẩu tối thiểu 10 ký tự trong Dashboard Supabase;
  - Production dùng chung project Supabase với Staging hay tách riêng: cần chủ quyết định.

### Phase 8 — Nền dữ liệu đa ngôn ngữ (Level 4.7 — CHUẨN BỊ, CHƯA áp Staging)
- **Hiện trạng:** `episode_sources` chỉ có 1 nguồn + 1 dự phòng mỗi tập, chỉ `youtube`/`native`, không có ngôn ngữ, nên **chưa đáp ứng** đa ngôn ngữ.
- `db/level4_7_media_languages.sql` **chỉ thêm**, không sửa bảng hay hàm cũ:
  - `episode_media`: nhiều nguồn mỗi tập theo ngôn ngữ BCP 47 (vi/th/id…), loại bản gốc / lồng tiếng / phụ đề cứng.
    - Nhà cung cấp: YouTube công khai, YouTube không công khai, Facebook công khai, Google Drive, URL https.
    - Dự phòng theo `priority`; xuất bản phải có cam kết bản quyền.
  - `episode_subtitles`: phụ đề WebVTT VI/TH/ID, một phụ đề mặc định.
  - `get_playback_media(episode, language)`:
    - dùng lại toàn bộ kiểm tra quyền xem của `get_playback_source` (tập bị khóa không lộ nguồn);
    - đổi ngôn ngữ trên cùng Movie ID / tập phim, không tạo lại bản ghi;
    - tập chưa có media thì trả nguồn cũ.
  - RLS: chỉ admin đúng site / nhân sự mạng; thêm 8 cổng 2FA. Gỡ bằng `db/staging/93_rollback_level4_7.sql`.
- Kiểm thử cục bộ: **27/27**, áp lại 2 lần (idempotent), gỡ và áp lại OK, `dangerous_grants` vẫn 0.
- **Chưa làm (đúng phạm vi):**
  - engine xử lý phim và giao diện chọn ngôn ngữ;
  - CSP `frame-src` cho Facebook/Drive (thêm khi làm trình phát).
- Không tạo dịch vụ lưu trữ trả phí.
- Áp lên Staging cần anh phê duyệt.

### Kết luận
| Hạng mục | Trạng thái |
|---|---|
| **OWNER MFA** | **VERIFIED** (2 factor, mỗi thiết bị đã tạo một phiên AAL2 mới) — **PARTIAL ADMIN VERIFICATION** trên phiên mới dùng thiết bị dự phòng; bài QA Admin **NOT RUN** |
| **MASTER WEBSITE** (Xưởng Phim) | **VERIFIED** trên Preview/Staging |
| **KHO PHIM PREVIEW** | **PASS** |
| **PHE PHIM PREVIEW** | **PASS** |
| **PHIM HAY PREVIEW** | **PASS** |
| **GHIEN PHIM PREVIEW** | **PASS** |
| **SHARED CORE** | **READY** |
| **MULTI-SITE DEPLOYMENT** | **READY FOR APPROVAL**: cần phê duyệt tạo project riêng và chuyển tên miền từng đợt |
| **PRODUCTION** | **ON HOLD**: pháp lý, nội dung thật, quyết định Supabase Production |

---

## Cập nhật 01/11/2026 17:50 — OWNER MFA PASS (Hungcreator, Staging/Preview)

Chủ hệ thống tự bật xác thực 2 lớp trên trình duyệt riêng (Preview → Studio → Bảo mật). Claude **không thấy, không lưu, không yêu cầu** QR, khóa bí mật hay mã OTP; mọi kiểm tra dưới đây chỉ đọc siêu dữ liệu (trạng thái, thời điểm, mã phản hồi).

**Phương thức Supabase hỗ trợ trên Staging:** chỉ TOTP (ứng dụng xác thực); tối đa 10 factor/người. SMS cần gói Pro, nên không dùng. "Limit duration of AAL1 sessions" đang bật: tài khoản có 2FA mà không nhập mã sẽ bị ngắt phiên sau khoảng 15 phút.

| # | Kiểm tra (Staging thật) | Kết quả |
|---|---|---|
| 1 | Factor của chủ (`90b8b707…`) | **1 TOTP `verified`**: tạo 10:38:25 UTC, xác minh 10:39:07 UTC (challenge `verified_at` cùng thời điểm) |
| 2 | Phiên đăng nhập | Phiên duy nhất `55753ba4…` = **`aal2`**, AMR = `otp` + `totp`. Các phiên AAL1 cũ không còn |
| 3 | Quyền quản trị sau MFA (phiên thật) | Log API: token phát hành lúc 10:39:07 (đúng lúc xác minh mã) gọi `admin_staff_mfa_status` (cần quyền quản trị mạng + `mfa_ok`) → **200** lúc 10:39:08. Vì tài khoản đã có factor, hàm chỉ trả 200 khi JWT là `aal2`; nếu không sẽ trả `forbidden`/403. Trước đó (10:37) Studio đã tải đủ `admin_overview`, `admin_traffic`, `admin_member_wallets`, `admin_site_staff`, `admin_chat_reports`, `admin_site_entitlements` → đều 200 |
| 4 | Chủ chỉ có AAL1 (JWT mô phỏng, chỉ đọc) | `mfa_ok=false`; chủ mạng, quản trị mạng, nhân sự site và gate đều `false`. `admin_overview` → `forbidden`; `admin_set_staff_mfa_required` → `forbidden`; nhật ký quản trị đọc được 0 dòng. Ví riêng và trạng thái bảo mật vẫn đọc được (không khóa tài khoản). Cùng tài khoản ở AAL2: nhật ký 21 dòng, overview OK, danh sách 2FA nhân sự 7 dòng (theo phạm vi) |
| 5 | Mất thiết bị (CSDL cục bộ giả lập, `tests/sql/owner_mfa_recovery.sh`, khối A/B trích nguyên văn runbook 94) | **23/23 ĐẠT**: mất thiết bị → vẫn đăng nhập và dùng tính năng thành viên, chỉ mất quyền quản trị. Có thiết bị dự phòng → tự khôi phục. Khối B tự dừng khi chưa thay email, email sai hoặc email không phải nhân sự. Gỡ đúng factor của chủ thì được ghi nhật ký và có lại quyền. Nếu đã bật bắt buộc: chạy khối B rồi khối A (có ghi nhật ký). Bật lại 2FA với thiết bị mới thì AAL1 lại bị chặn. Dữ liệu ví và tài khoản không đổi. **MFA thật trên Staging không bị đụng tới** |
| 6 | Hồi quy | SQL chức năng 253 · đồng thời 23 · khôi phục chủ 23 · REST/PostgREST 40 · E2E Playwright **106/106** (thêm 2 kịch bản bước 2FA khi đăng nhập) · unit 5/7. Hai bài jsdom cũ (Level 1–3) không chạy được vì máy kiểm thử không tải được thư viện jsdom (lỗi mạng npm), không phải lỗi mã |
| — | Trạng thái sau kiểm thử | `staff_mfa_required = false` (**không bật bắt buộc cho nhân sự**) · tổng factor 1 (chỉ của chủ) · `dangerous_grants` 0 · 27 gate · 15 migration (không thêm) · nhật ký không có dòng mới từ kiểm thử |

**Mã nguồn (nhánh dev `cd0fdf1`, Preview đã nhận):**
- `assets/auth.js` thêm bước nhập mã 6 số ngay sau đăng nhập và khi mở trang với phiên AAL1 của tài khoản đã bật 2FA. Trước đây thiếu bước này nên phiên sẽ bị Supabase ngắt sau 15 phút. Có chống mở 2 hộp thoại; nút "Để sau" không chặn trang.
- Ô nhập mã chấp nhận dạng "123 456".
- Không đổi `main`, Production hay DNS.

**Kết luận: OWNER MFA PASS.** Đã kiểm chứng trên phiên thật: TOTP đã xác minh, phiên đạt AAL2, quyền quản trị mạng hoạt động sau MFA.

**Việc chủ nên làm (khuyến nghị, không bắt buộc):**
1. Thêm thiết bị xác thực dự phòng. Supabase không cấp recovery code; hiện Studio chỉ cho đăng ký khi chưa có factor, nên cách nhanh là dùng trình quản lý mật khẩu đồng bộ TOTP, hoặc nhờ Claude thêm nút "Thêm thiết bị dự phòng".
2. Bật 2FA cho chính tài khoản Supabase (Dashboard). Đây là chìa khóa của quy trình break-glass.
3. Chỉ bật "bắt buộc 2FA cho nhân sự" khi các nhân sự khác đã đăng ký xong và chủ phê duyệt. Hiện có 2 nhân sự (chủ + QA Admin); QA Admin chưa có factor.

**PRODUCTION: ON HOLD.**

---

## Cập nhật 01/11/2026 16:20 — LEVEL 4.6 STAGING VERIFIED

Chủ hệ thống phê duyệt lúc 16:16. Migration `level4_6_staff_mfa` đã áp lên `jurvphonehknrxjpowoe` (Staging) và được kiểm chứng **trên Supabase thật**.

| Kiểm tra sau migration | Kết quả |
|---|---|
| Migration | 15; mới nhất `level4_6_staff_mfa` |
| Cấu trúc | 27 policy RESTRICTIVE `mfa_gate_*` trên 13 bảng (đều `to authenticated`, qua `afn_staff_gate()`); RLS 28/28; 86 policy; 53 hàm |
| Quyền | `dangerous_grants()` = **0**; role API còn 0 quyền sequence; `service_role` còn 0 TRUNCATE (đã ghi 46 mục trong `grant_hardening_log2` để gỡ chính xác). `anon` chỉ gọi được `get_playback_source`, `log_landing`; 0 hàm `private` lộ ra |
| Cài đặt | `staff_mfa_required = false` (chưa bắt buộc) |
| Dữ liệu | Dấu vân tay trước và sau migration **khớp 31/31**: không dòng nào bị sửa |
| Chức năng (phiên mô phỏng JWT, giao dịch tự hủy, 20/20) | Chủ mạng chưa bật MFA: giữ toàn quyền (ví, danh sách nhân sự, phim); không tự bật "bắt buộc" khi chưa có factor (`mfa_required`). QA Admin chưa bật MFA: quản trị Xưởng Phim bình thường, Kho Phim `forbidden`. QA Admin có factor + AAL1: RPC quản trị, xem tin đã ẩn, khóa chat đều bị chặn; ví riêng vẫn đọc được. Có factor + AAL2: có lại quyền. Thành viên QA2: quản trị `forbidden`; điểm danh `claimed`, sổ cái khớp; `nextval` → `permission denied` |
| Sau giao dịch thử | 0 factor, 5 lượt điểm danh, 9 dòng sổ cái, nhật ký 21 dòng: không còn dấu vết |
| Preview thật (SIGNUP1) | `my_security_status`: thành viên, `mfa_ok=true`; RPC quản trị `forbidden`; ví, catalog, chat (9 tin, 0 tin ẩn) bình thường |
| Advisor bảo mật | Không có cảnh báo mới ngoài nhóm hàm SECURITY DEFINER có chủ đích (mỗi hàm tự kiểm quyền) và Leaked Password Protection (gói Pro) |

**Kết luận:** **LEVEL 4.6 STAGING VERIFIED.** MFA chưa bật cho tài khoản thật nào, chế độ bắt buộc đang tắt.
- **Khôi phục:** `db/staging/94_mfa_break_glass.sql` (mất thiết bị, tắt chế độ bắt buộc) và `db/staging/95_rollback_level4_6.sql` (gỡ toàn bộ, giữ dữ liệu).
- **Backup trước migration:** `afn_data_20261101_1611_pre46.json.age` (giải mã trên PC: ĐẠT).
- **PRODUCTION: ON HOLD.**

---

## Cập nhật 01/11/2026 16:15 — Backup mã hóa age: ĐẠT

| Hạng mục | Kết quả / bằng chứng |
|---|---|
| Khóa riêng | Tạo và giữ **chỉ trên PC** tại `%LOCALAPPDATA%\AFN-Backup-Key\`; không xuất hiện trong chat, log, repo hay báo cáo (đã quét: 0 chuỗi `AGE-SECRET` trong mọi tệp ở `backups\supabase`). Lần chạy thứ hai dùng lại khóa cũ, không tạo mới |
| ACL | Script `icacls /inheritance:r /grant:r <chủ máy>:(F)` cho thư mục và tệp khóa; lệnh này dừng script nếu lỗi, và script đã chạy qua bước này |
| Đồng bộ | Không có `.stfolder` (dấu thư mục Syncthing) ở `C:\`, `C:\Users`, `C:\Users\PC`, `AppData`, `AppData\Local`, `AFN-Backup-Key`. Khóa không nằm dưới `OneDrive` hay `C:\H2N_BRIDGE`. Bản script mới (đã đặt trên PC, hash khớp) còn đọc `config.xml` của Syncthing và ghi ACL vào nhật ký ở các lần chạy sau |
| Khóa công khai | `recipient.txt` = `age1r4qql3ta…csgm8p` (62 ký tự, bech32 hợp lệ) |
| Bản sao lưu | `afn_data_20261101_1611_pre46.json.age` (29.336 byte) + manifest, xuất **chỉ đọc** từ Staging (14 migration). SHA-256 bản rõ `389596c9…f89ff9`, bản mã `2d38f156…8d8471` |
| Khôi phục cô lập | CSDL PostgreSQL mới, schema tới 4.5: **31/31** dấu vân tay khớp (28 bảng + tài khoản + tổng ví + đối soát sổ điểm) |
| Giải mã trên PC | `verify-afn_data_20261101_1611_pre46.txt`: **ĐẠT**. Giải mã bằng khóa riêng trên máy, băm trong bộ nhớ, hai mã SHA-256 khớp manifest |
| Bản cũ | 4 tệp `.zip` giữ nguyên (anh tự quyết việc xóa vì mật khẩu đã lộ) |

**Kết luận:** AGE PRIVATE KEY: **SECURE**. PUBLIC KEY: **VERIFIED**. BACKUP CREATED: **YES**. RESTORE VERIFIED: **PASS**. LEVEL 4.6 MIGRATION: **WAITING FOR APPROVAL** (chưa áp: 14 migration, 0 policy `mfa_gate_*`).

---

## Cập nhật 01/11/2026 15:40 — Level 4.6 (tiếp): giảm egress Supabase, kiểm MFA trên Auth thật, quy trình backup khóa công khai

Chỉ sửa DEV/Preview (`feature/master-site-xuongphim-2026-10-31`). Không nâng gói, không đổi DNS, không merge `main`, không triển khai Production.

**Migration 4.6:** vẫn **CHƯA áp** (Staging 14 migration, 0 policy `mfa_gate_*`, 0 factor). Sẽ chỉ áp sau khi có backup mới theo quy trình khóa công khai và được anh xác nhận.

### 1. Kiểm tra trước migration
- **PostgreSQL cô lập:**
  - SQL 253 + 23 đạt.
  - 27 policy RESTRICTIVE trên 13 bảng.
  - Kịch bản REST 40/40 (mục 14:30 §3).
  - Chủ chưa bật MFA giữ nguyên toàn quyền.
- **Supabase Auth thật** (Preview, tài khoản QA thành viên SIGNUP1, không phải nhân sự):
  - TOTP đã bật sẵn trên project.
  - Đăng ký factor → mã sai bị từ chối → mã đúng nâng phiên lên **AAL2** (`totp` + `password`) → gỡ factor → về AAL1, còn 0 factor (SQL xác nhận).
  - JWT thật có claim `aal`, đúng dữ liệu mà 4.6 dựa vào.
  - Mã TOTP được tính ngay trong trang; khóa bí mật của factor không ra khỏi trình duyệt và không vào log.
- **Khôi phục quyền quản trị** (`db/staging/94_mfa_break_glass.sql`): đã chạy thử việc tắt bắt buộc 2FA và gỡ factor của một nhân sự, có ghi nhật ký. Đăng nhập bằng mật khẩu không bao giờ bị khóa bởi 4.6.

### 2. Giảm egress Supabase (DEV/Preview, đo trên Preview thật)
| Thay đổi | Cách làm |
|---|---|
| Catalog tĩnh ở edge | Pages Function `GET /api/catalog?site=` trả phim, tập, Social, quy tắc điểm đã phát hành, **chỉ các cột cần dùng**, không có nguồn phát của tập. Cache 60 giây ở Cloudflare (Cache API) + `stale-while-revalidate`. Lỗi thì trả 502 không cache, trình duyệt tự quay về Supabase |
| Cache trình duyệt | `AFN.publicData()`: một lần tải cho cả trang + sessionStorage 60 giây |
| Bỏ lời gọi trùng | Social: một promise cho mỗi site. Ví/điểm danh: chỉ tải lại khi người dùng thật sự đổi (đọc phiên cục bộ). `/auth/v1/user`: bộ đệm không bị xóa khi khôi phục phiên phát `SIGNED_IN` cho cùng người dùng |
| Truy vấn tối thiểu | Bỏ `select *` ở catalog và quy tắc điểm |
| Ngắt Realtime khi không dùng | Tab ẩn quá 5 phút → gỡ kênh chat + kênh kiểm duyệt, dừng đồng bộ 45 giây. Quay lại → tải lại tin và kết nối lại. Vòng đồng bộ cũng bỏ qua khi tab đang ẩn |

| Đo trên Preview thật (đã đăng nhập) | Trước | Sau |
|---|---|---|
| Lời gọi Supabase mỗi lần tải trang | **12** (5 cặp trùng) | **3** (`auth/v1/user`, ví, điểm danh) |
| Catalog | 2 truy vấn trực tiếp mỗi lượt xem | `/api/catalog`: lần đầu MISS 541 ms, sau đó **HIT ở edge** 90–126 ms, khoảng 1 KB |

- **Kiểm thử:**
  - E2E **104/104** (+3: không gọi trùng, catalog edge không chạm Supabase, ngắt/nối lại Realtime). Bài "không gọi trùng" chạy trên mã cũ thì **trượt** (2 lời gọi), trên mã mới thì đạt.
  - Catalog function 3/3 (cột tối thiểu, không có nguồn phát, cache HIT, tên miền thật quyết định site, 502 không cache).
  - site-config 12/12, gồm quét repo không có khóa bí mật.
- **Độ tươi dữ liệu:** phim/tập mới phát hành hiện trên trang công khai trong tối đa khoảng 60 giây (edge) + 60 giây (trình duyệt). Studio đọc trực tiếp nên không bị trễ.

### 3. Năng lực sau tối ưu (môi trường giả lập Nano: 0,5 nhân, 512 MB, `MODEL=optimized`)
| Trang/giây | p95 | Ghi chú |
|---|---|---|
| 33 (≈ 1.000 người online) | 3 ms | |
| 200 | 3 ms | |
| 260 | 2,8 s | Bão hòa |
| 400 | 17,9 s, 5,6% lỗi | PostgREST bị hủy vì hết RAM. Vẫn cần giới hạn tần suất ở biên trước khi mở rộng |

- **Tầng CSDL/REST:** đủ khoảng **6.000 người online** (trước tối ưu khoảng 1.600). REST mỗi trang **1,4 KB** (trước 83 KB với danh mục 20 phim/site).
- **Egress ước tính:** khoảng 3 KB/trang, gồm cả Auth. 1.000 người online trong 1 giờ ≈ 0,36 GB (trước ≈ 9,9 GB). Free 5 GB/tháng ≈ **14 giờ cao điểm 1.000 người/tháng** (trước khoảng 30 phút).
- **Realtime:** vẫn giới hạn cứng 200 kết nối trên Free. Ngắt khi tab ẩn chỉ giúp không giữ kết nối thừa, không nâng được giới hạn này.

### 4. Mật khẩu mạnh và Turnstile — tương thích với Auth hiện tại (đọc Dashboard, không lưu thay đổi)
| Thiết lập Supabase (Staging) | Hiện tại | Đề xuất | Tương thích |
|---|---|---|---|
| Minimum password length | 8 | **10** | Có. Frontend đã yêu cầu 10; mật khẩu cũ vẫn đăng nhập được |
| Password requirements | Không yêu cầu | **Letters and digits** | Có |
| Secure password change / Require current password | Tắt | Để vòng sau | Chưa. Trang tài khoản chưa có bước xác thực lại; có thể chặn luồng quên mật khẩu |
| Leaked password protection | Tắt | — | Chỉ có ở gói Pro |
| CAPTCHA (Bot and Abuse Protection) | **Tắt** | Bật sau khi có widget | Có. Frontend gửi `captchaToken` chỉ khi có site key; hiện để trống |

Hai thiết lập đầu do chủ hệ thống bấm trong Dashboard → Authentication → Sign In / Providers → Email.

### 5. Backup mới bằng khóa công khai — tự động hóa trên PC (cập nhật 15:55)
- **`age` trên PC:** chưa cài. Bản dùng là `age-v1.2.1-windows-amd64.zip` (5.526.045 byte) từ github.com/FiloSottile/age. SHA-256 `46DB0DB7…89FB` **trùng** manifest winget của Microsoft (`FiloSottile.age` 1.2.1), được kiểm độc lập qua kho `microsoft/winget-pkgs`. Script **ghim** hash này; sai hash thì không giải nén.
- **Script `tools\afn-backup-key.ps1`** (chạy bằng cách nháy đúp `tools\Tao-Khoa-Backup.cmd`):
  1. Cài age cho riêng tài khoản (`%LOCALAPPDATA%\Programs\age-afn`): không cần admin, không sửa PATH, chỉ dùng `-ExecutionPolicy Bypass` cho tiến trình này.
  2. Tạo khóa riêng tại `%LOCALAPPDATA%\AFN-Backup-Key\afn-backup-key.txt`: ngoài repo, ngoài OneDrive (script dừng nếu đường dẫn nằm trong thư mục đồng bộ). Script gỡ quyền thừa kế và chỉ cấp quyền cho tài khoản Windows hiện tại. Đã có khóa thì giữ nguyên.
  3. Ghi **chỉ khóa công khai** vào `backups\supabase\recipient.txt`.
  4. Chờ tối đa 45 phút cho bản `.json.age` mới, giải mã **ra luồng và băm trong bộ nhớ** (bản rõ không chạm đĩa), so với `plain_sha256`/`cipher_sha256` của manifest, rồi ghi `verify-<tên>.txt` (ĐẠT/KHÔNG ĐẠT, không chứa khóa hay dữ liệu).
- **Rà soát:**
  - Chỉ 1 lệnh mạng (tải age); không có lệnh xóa, `Start-Transcript` hay thay đổi chính sách hệ thống.
  - Khóa riêng chỉ được truyền dưới dạng đường dẫn tệp cho `age`/`age-keygen`.
  - Cú pháp đạt (pwsh). Phần "giải mã ra luồng → băm" đã chạy thử với khóa dùng thử: hash trùng bản rõ.
  - `setup-age-key.ps1` (bản cũ có lệnh dọn tệp tạm) đã được thay bằng tệp chỉ dẫn, không còn thao tác nào.
- **Vì sao vẫn cần một lần nháy đúp:** PC không có shell từ xa. Quyền điều khiển màn hình cho PowerShell/Explorer chỉ ở mức "click", không gõ được, và Claude không vòng qua giới hạn này. Cửa sổ Explorer cũng không hiện được trong ảnh chụp để bấm.
- **Phía Claude:**
  - Đã xuất dữ liệu (chỉ đọc, 14 migration) và thử khôi phục vào CSDL cô lập: **khớp 31/31**.
  - Bản rõ đã **hủy** trong lúc chờ khóa. Khi `recipient.txt` có, Claude xuất lại, thử khôi phục lại, mã hóa bằng `tools/backup-encrypt-age.sh` (bản rõ bị hủy ngay sau đó), rồi ghi `.json.age` + manifest lên PC.
- **Bản cũ:** giữ nguyên toàn bộ 4 tệp `.zip` cho tới khi bản `.age` đã ĐẠT.

### Kết luận vòng này
| Hạng mục | Trạng thái |
|---|---|
| **LEVEL 4.6 STAGING** | **CHƯA VERIFIED**: migration chưa áp; chờ backup `.age` và xác nhận |
| MFA trên Supabase Auth thật | **PASS** (đăng ký, AAL2, gỡ factor; claim `aal` có trong JWT) |
| Giảm egress (DEV/Preview) | **PASS**: 12 → 3 lời gọi mỗi trang; catalog HIT ở edge |
| Năng lực 1.000 người (Free) | **CSDL/REST: đủ, dư khoảng 6 lần.** Egress: đủ khoảng 14 giờ cao điểm/tháng. **Realtime: vẫn giới hạn 200** |
| Mật khẩu / Turnstile | **READY**: chờ chủ hệ thống chỉnh 2 mục trong Dashboard và tạo widget |
| PRODUCTION | **ON HOLD** |

---

## Cập nhật 01/11/2026 14:30 — Level 4.6: MFA quản trị, chính sách mật khẩu, Turnstile, quyền đợt 2, đo năng lực trên gói hiện tại

Quyết định của chủ hệ thống áp dụng cho vòng này:
- Chưa nâng gói Pro.
- Đo tải chỉ trên môi trường cô lập.
- Không phát sinh chi phí.
- Không bật bắt buộc MFA cho tài khoản thật trước khi xác minh phương án khôi phục.

Không thay đổi Production, DNS, `main`. Không đụng project Supabase khác của tài khoản.

**Trạng thái:** mã nguồn DEV và kiểm thử đã xong. **Migration `level4_6_staff_mfa` CHƯA áp lên Staging, đang chờ phê duyệt** (2 lần gửi trước hết hạn vì chưa có người bấm xác nhận; đã kiểm tra lại: không có gì được áp).

### 1. Rà soát lại quyền TRUNCATE/sequence trên mọi vai trò (Staging, chỉ đọc)
| Vai trò | Hiện trạng sau 4.5 | Xử lý ở 4.6 |
|---|---|---|
| `anon`, `authenticated` (bảng public/private) | 0 quyền TRUNCATE/TRIGGER/REFERENCES | Giữ nguyên; thêm hàm giám sát `private.dangerous_grants()` (kỳ vọng 0 dòng) |
| `anon`, `authenticated` (3 sequence identity) | Có quyền `USAGE/SELECT/UPDATE`, tức gọi được `setval` | **Thu hồi**. Cột identity không cần quyền này; mọi ghi đều đi qua RPC |
| `service_role` (khóa máy chủ, ứng dụng không dùng) | TRUNCATE trên 28 bảng | **Thu hồi TRUNCATE** (giữ quyền khác) |
| Quyền mặc định của `postgres` cho bảng/hàm/sequence tạo về sau | Cấp sequence và EXECUTE hàm cho `anon` | **Thu hồi**. Hàm mới phải được cấp quyền tường minh |
| Quyền mặc định của `supabase_admin` | Cấp ALL cho role API | **Không sửa được** (cần quyền superuser của Supabase). Bảng của dự án đều do `postgres` tạo; `dangerous_grants()` sẽ phát hiện nếu có bảng do `supabase_admin` tạo |

- Mọi quyền thu hồi được ghi vào `private.grant_hardening_log2`, để script gỡ cấp lại đúng như cũ.
- Migration 4.3/4.4/4.5 lưu trên Staging khớp với repo. Chỉ khác ở dòng chú thích và `begin/commit`, vì Supabase tự bọc giao dịch.

### 2. MFA (TOTP) cho nhân sự — không khóa tài khoản nào
- **Mức xác thực (AAL):** đọc từ claim `aal` trong JWT do Supabase Auth ký (`auth.jwt() ->> 'aal'`). Thiếu claim thì coi là `aal1`, tức là mặc định an toàn. JWT bị sửa sẽ bị từ chối (401).
- **Quy tắc `private.mfa_ok()`:** đạt khi phiên là AAL2, **hoặc** khi nhân sự chưa đăng ký factor và chủ mạng chưa bật "bắt buộc".
  - Nhân sự đã bật 2FA thì luôn phải nhập mã 6 số mới dùng được quyền quản trị.
- **Áp ở 3 lớp:**
  1. Năm hàm `private.is_*`, dùng cho mọi RPC quản trị.
  2. Ba RPC có kiểm tra quyền viết sẵn trong thân hàm. Thân hàm được sinh từ bản hiện hành bằng `tools/gen/gen_level4_6.py`, không gõ tay.
  3. 27 policy **RESTRICTIVE** `mfa_gate_*` (tất cả `to authenticated`, đều qua `public.afn_staff_gate()`), áp cho cả REST lẫn Realtime.
  - Thành viên thường qua cổng ngay vì không phải nhân sự. Bản ghi của chính người dùng luôn thấy được.
- **Xóa tài khoản thật** (`admin_execute_account_deletion`, `p_dry_run=false`) luôn cần AAL2.
- **Bật "bắt buộc 2FA"** (`admin_set_staff_mfa_required`): chỉ chủ mạng làm được, phải đang ở AAL2 **và** tự mình đã có factor, nên không thể tự khóa mình.
- **Studio → thẻ Bảo mật:**
  - Bật 2FA bằng mã QR hoặc khóa nhập tay. Nhập sai mã sẽ bị từ chối.
  - Nhập mã trước khi tải dữ liệu quản trị.
  - Banner "Quyền quản trị đang tạm khóa" khi cần nhập mã.
  - Chủ mạng xem bảng tình trạng 2FA của nhân sự và bật/tắt "bắt buộc".
- **Tác động lên tài khoản chủ Hungcreator** (đọc trên Staging: owner + admin 5 site, **0 factor**, 4 phiên AAL1, đăng nhập email):
  - Sau khi áp 4.6: **không thay đổi gì**. Đăng nhập và mọi quyền quản trị vẫn như cũ, vì chưa có factor và chưa bắt buộc.
  - Thay đổi duy nhất: **xóa tài khoản thật** cần AAL2, tức là phải bật 2FA trước khi xóa. Xem trước (dry run) vẫn làm được.
  - Nếu sau này chủ bật 2FA rồi mất thiết bị: vẫn **đăng nhập được** (mật khẩu), chỉ tạm mất quyền quản trị. Khôi phục bằng script `db/staging/94_mfa_break_glass.sql`, chạy trong Supabase SQL Editor bằng tài khoản Supabase của chủ (khác tài khoản website).

### 3. Kiểm thử các tình huống anh yêu cầu
Chạy qua **REST thật** (PostgREST 12.2.3 + PostgreSQL có 4.6 + JWT ký như Supabase; `tests/http/mfa_scenarios.py`): **40/40 đạt**, chạy lại lần hai vẫn 40/40.

| Tình huống | Kết quả |
|---|---|
| Admin chưa bật MFA (như Hungcreator) | RPC quản trị, xem bản nháp, đóng/mở chat: như cũ |
| Admin đã bật MFA, phiên AAL1 | RPC quản trị bị từ chối, bản nháp bị ẩn. **Vẫn** đọc ví và điểm danh (quyền thành viên) |
| Admin đã bật MFA, phiên AAL2 | Đủ quyền. AAL2 không mở rộng phạm vi (admin Xưởng Phim vẫn không quản Kho Phim) |
| Thành viên thường | Không có quyền quản trị; xem 20 phim đã phát hành; không thấy bản nháp |
| Moderator chưa bật MFA | Hàng đợi kiểm duyệt chạy; vẫn không khóa chat được (chỉ admin, như trước) |
| Phiên hết hạn / JWT bị sửa thành AAL2 | 401 ngay ở PostgREST, không rơi về quyền khách |
| Mất thiết bị MFA | Chỉ tạm mất quyền quản trị. Gỡ factor bằng SQL thì có lại quyền ở AAL1; ví và lịch sử còn nguyên |
| Bắt buộc 2FA | Chủ chưa có factor thì không bật được. Moderator thiếu factor mất quyền kiểm duyệt nhưng **vẫn đăng nhập**. Script khôi phục khẩn cấp (đã chạy thử) tắt được chế độ bắt buộc và gỡ factor, có ghi nhật ký |
| Hồi quy sau thu hồi sequence/TRUNCATE | Điểm danh, mở khóa (trừ đúng 10 điểm), ví khớp sổ cái 100%, gửi/đọc chat đều chạy. `setval` không gọi được qua API. `dangerous_grants()` = 0 |

- **Cộng thêm:**
  - SQL functional **253** (+39 cho mục 10).
  - Concurrency/rollback **23**, gồm chuỗi gỡ 95 → 96 → 97 → 98 → 99 và áp lại tới 4.6.
  - E2E **101/101** (+5: đăng ký/nhập mã 2FA, bắt buộc 2FA, mật khẩu, Turnstile); contract **11/11**; site-config **11/11**.
  - Shared Core 5/5.
- **Rollback không phá hủy dữ liệu** (`db/staging/95_rollback_level4_6.sql`):
  - Khôi phục nguyên văn các hàm cũ, xóa 27 policy và các hàm mới, cấp lại quyền theo nhật ký.
  - Chỉ xóa 2 bảng cấu hình trong `private`. **Không đụng dữ liệu người dùng và factor 2FA.**
  - Đã thử trên CSDL có dữ liệu: dấu vân tay dữ liệu trước gỡ = sau gỡ = sau áp lại; API và 40 kịch bản vẫn đạt.

### 4. Chính sách mật khẩu và Turnstile (DEV/Preview)
- **Mật khẩu:**
  - Đăng ký và đổi mật khẩu: ít nhất 10 ký tự, có cả chữ và số (`passwordPolicy` trong `auth-config.js`).
  - Mật khẩu cũ yếu hơn **vẫn đăng nhập được** (không khóa tài khoản); người dùng chỉ được nhắc đổi khi Supabase báo `weak_password`.
  - **Việc của chủ hệ thống** (Dashboard, gói Free làm được): Authentication → Providers → Email → Minimum password length = 10 và Password requirements = "Letters and digits". Cài đặt này không khóa tài khoản hiện có.
- **Cloudflare Turnstile:**
  - Đã có sẵn trong form đăng nhập, đăng ký và quên mật khẩu, nhưng **đang tắt** (`turnstileSiteKey` trống).
  - Token dùng một lần, gửi qua `options.captchaToken`. CSP đã cho phép `challenges.cloudflare.com`. Chính sách riêng tư (bản dự thảo) đã ghi Turnstile ở dạng "chỉ khi được bật".
  - **Không bật CAPTCHA trên Staging lúc này**, vì RC1/RC3 dùng chung Staging nhưng chưa có widget, nên đăng nhập ở đó sẽ hỏng.
  - Thứ tự khi bật:
    1. Tạo widget Turnstile (miễn phí) cho các tên miền và hostname Preview.
    2. Đưa site key vào `auth-config.js`, triển khai.
    3. Nhập secret key trong Supabase Auth → Bot and Abuse Protection (chủ hệ thống tự nhập, không qua chat).

### 5. Năng lực theo bằng chứng đo (gói Free hiện tại)
- **Môi trường đo:** cô lập. `tools/loadtest/nano-env.sh` đặt PostgreSQL 16 + PostgREST chung một cgroup, RAM 512 MB, CPU 1 nhân hoặc 0,5 nhân, cấu hình theo bảng Nano của Supabase.
- **Dữ liệu và kịch bản:** 1.000 thành viên giả lập. k6 (`k6-nano-local.js`, `run-nano-steps.sh`): mỗi lượt tải trang gồm 9 lời gọi REST/RPC, cộng 10 lượt ghi/giây (điểm danh, chat).
- Không chạm Staging/Production, không tốn chi phí.

| CPU (RAM 512 MB) | Trang/giây đạt (p95) | Bão hòa | Quá tải |
|---|---|---|---|
| 1 nhân | 120 (179 ms); 110 (10 ms) | 135 (p95 2,1 s) | 150: **PostgREST bị hủy vì hết RAM** (OOM) |
| 0,5 nhân (sát CPU dùng chung của Nano) | 55 (64 ms); 33 (9 ms) | 65 (p95 5,7 s) | 75: PostgREST bị hủy vì hết RAM |

1.000 người online × 2 trang/phút = 33 trang/giây.

| Tầng | Số người hỗ trợ được trên Free (theo bằng chứng) | Ghi chú |
|---|---|---|
| CSDL + REST | khoảng **1.600** online (0,5 nhân) đến khoảng **3.600** (1 nhân) | Quá tải thì **sập** (OOM) chứ không chỉ chậm, nên cần cache và giới hạn |
| Realtime | **200 kết nối đồng thời** (giới hạn cứng của Free) | Khoảng 660 người online nếu 30% mở chat |
| Egress | **5 GB/tháng** | Mô hình trang hiện tại khoảng **83 KB/lượt** (riêng danh sách tập `select *` là 72 KB), tức khoảng 63.000 lượt tải trang/tháng. Với 1.000 người online thì hết hạn mức sau khoảng **30 phút** cao điểm. **Đây là nút thắt thật** |
| Auth | Chưa đo (không mô phỏng được GoTrue cục bộ) | Khoảng 3 lời gọi `/auth/v1/user` mỗi trang, chạy chung CPU với CSDL |

**Kết luận năng lực:** gói Free chịu được tải tính toán của 1.000 người online. Nhưng **không** đủ cho Realtime khi hơn 200 người chat, và **không** đủ egress cho lưu lượng 1.000 người.

**Việc nên làm trước, miễn phí:**
1. Sinh danh mục phim/tập mỗi site thành JSON tĩnh trên Cloudflare Pages (băng thông không tính vào Supabase).
2. Chỉ chọn các cột cần dùng (danh sách tập giảm từ 72 KB còn 31 KB).
3. Chỉ tải tập của phim đang mở.
4. Dùng `getSession` cho phần hiển thị.
5. Tự ngắt Realtime khi tab bị ẩn.

Ước tính các việc trên giảm khoảng 85–90% egress. Chưa triển khai: đây là thay đổi toàn hệ thống, cần một vòng riêng.

**Chi phí đề xuất (chưa phát sinh):**
- Khi chat công khai cần hơn 200 kết nối, hoặc egress vượt 5 GB: lên **Pro (khoảng 25 USD/tháng)**. Gói này gồm 250 GB egress, 500 kết nối Realtime, backup tự động và Leaked Password Protection.
- Egress vượt hạn mức tính 0,09 USD/GB (không cache) và 0,03 USD/GB (có cache).
- Ước tính: sau tối ưu, cao điểm 2 giờ/ngày nằm trong 250 GB (khoảng 25 USD/tháng). Không tối ưu thì khoảng 600 GB/tháng (thêm khoảng 30 USD).

### 6. Backup trước 4.6 và quy trình backup mới
- **Bản `afn_supabase_backup_20261101_1331_pre46.zip`** (thư mục `backups\supabase` trên PC):
  - Tạo vì dữ liệu QA đã đổi sau bản 12:51.
  - Thử khôi phục vào CSDL cô lập: **khớp 31/31**. Đọc lại từ PC trùng từng byte.
  - Script khôi phục đã bổ sung bảng `chat_settings`.
- **Rủi ro đã ghi nhận:** mật khẩu giải nén của các bản `.zip` (12:51, 13:31) đã xuất hiện trong cuộc trò chuyện, nên **coi là không còn an toàn**. Ngoài ra, nội dung bản xuất logic (email của 6 tài khoản QA/chủ, tin chat QA) đã đi qua kết quả truy vấn trong phiên làm việc này.
- **Quy trình mới, không có mật khẩu nào qua chat/log** (chọn một trong hai):
  - **A. Chạy trên PC** (`tools/backup-supabase.ps1`, đã có): `pg_dump` bằng mật khẩu CSDL gõ ẩn; 7-Zip AES-256 với mật khẩu anh tự gõ tại máy. Chỉ gửi cho Claude `row_counts.txt` và `SHA256SUMS.txt` để đối chiếu.
  - **B. Khóa công khai `age`**, cho bản do Claude tạo:
    1. Anh chạy `age-keygen` trên PC. Khóa bí mật không rời máy.
    2. Đặt **khóa công khai** `age1…` vào `backups\supabase\recipient.txt`.
    3. Claude mã hóa bằng `tools/backup-encrypt-age.sh`. Bản rõ bị xóa; script từ chối nếu dán nhầm khóa bí mật.
    4. Anh kiểm tra bằng `tools/verify-backup-age.ps1`. Bản rõ tạm bị xóa ngay sau khi đối chiếu SHA-256.
    - Đã chạy thử trọn vòng với một khóa dùng thử.
  - Sau khi bản mới đã kiểm tra đạt, anh có thể tự xóa hoặc thay hai tệp `.zip` cũ.

### Kết luận vòng 4.6
| Hạng mục | Trạng thái |
|---|---|
| **MIGRATION 4.6 (Staging)** | **CHỜ PHÊ DUYỆT**: preflight đạt (mục 1–3); chưa áp |
| **MFA quản trị** | **READY (DEV)**: không khóa tài khoản; chưa bật bắt buộc |
| **Chính sách mật khẩu** | **READY (DEV)**: cần chủ hệ thống chỉnh Dashboard Supabase |
| **Turnstile** | **READY, ĐANG TẮT**: cần site key và secret (miễn phí) |
| **TRUNCATE / sequence** | **PASS cục bộ + REST**: áp lên Staging cùng migration 4.6 |
| **1.000 USER CAPACITY (Free)** | **CPU/REST: đủ** (khoảng 1.600+). **Realtime và egress: chưa đủ**, cần tối ưu miễn phí trước, sau đó Pro khi mở chat công khai |
| **PRODUCTION** | **ON HOLD** |

---

## Cập nhật 01/11/2026 14:00 — Level 4.4/4.5: công tắc chat phía máy chủ, tăng cứng quyền, năng lực 1.000 người online

Không thay đổi Production, DNS, `main`. Không đồng bộ 4 website Production. Không xóa dữ liệu QA hay người dùng thật.
Pháp lý vẫn **PENDING OWNER/LEGAL REVIEW**. Không làm lại các hạng mục đã PASS.

### 1. Trạng thái Community Chat trên 5 website (trước khi có 4.4)
- **Giao diện:** cổng `CHAT_PUBLIC_DOMAINS = []`. Chat tắt trên 5 tên miền thật, bật trên Preview.
- **Máy chủ:** **chưa có** công tắc. Gọi thẳng API `send_chat_message` vẫn gửi được tin.

### 2. Công tắc chat phía máy chủ (Level 4.4, `db/level4_4_chat_switch.sql`)
- **Bảng `chat_settings`:** 6 phạm vi (`network` và 5 site). Thiếu cấu hình thì coi như **đóng** (an toàn mặc định).
- **Khi một phạm vi đóng:**

| Thao tác | Hành vi | Cơ chế |
|---|---|---|
| Gửi tin (mọi đường ghi, kể cả quản trị viên, ghi thẳng bảng) | `chat_disabled` | Trigger `BEFORE INSERT` trên `chat_messages` |
| Báo cáo tin | `chat_disabled` | Trigger trên `chat_reports` |
| Thành viên đọc / nhận Realtime | Không thấy tin | RLS `chat_read` (Realtime tuân thủ RLS) |
| Kiểm duyệt (đọc, ẩn/khôi phục, bỏ qua báo cáo, khóa/mở khóa) | Vẫn làm được | Giữ quyền nhân sự để dọn nội dung |
| Dữ liệu | Giữ nguyên; mở lại là hiện lại | Không xóa |

- **Quyền đổi** (RPC `admin_set_chat_enabled`, bắt buộc lý do, ghi nhật ký):
  - **Mở:** chỉ chủ mạng.
  - **Đóng:** quản trị viên đóng được site mình hoặc phòng chung.
- **Giao diện:**
  - Khung chat hiện "Trò chuyện ở phòng này đang tạm đóng", ẩn ô nhập.
  - Khung chat đang mở đổi trạng thái ngay khi Dashboard bấm (qua kênh kiểm duyệt).
  - Dashboard → Chat có bảng "Trạng thái chat theo phạm vi".
- **Kiểm thử:**
  - SQL +28 (gồm ghi thẳng bị chặn, phạm vi thiếu cấu hình = đóng, mở lại giữ dữ liệu).
  - E2E +3 (đóng/mở thời gian thực giữa Dashboard và khung chat của thành viên).
  - Script gỡ `97` trả schema về đúng 4.3.
- **Staging** (sau backup mới, có kiểm tra môi trường, anh đã duyệt):
  - Cấu trúc khớp bản cục bộ: 59 policy, RLS 28/28, 221 cột, 12 trigger, 44 hàm.
  - 6 phạm vi đều **mở**, nên Preview giữ nguyên chức năng đã nghiệm thu.
  - **Kiểm thử thật** trong giao dịch tự hủy, 17/17 đạt:
    - Thành viên tự đóng chat → `forbidden`.
    - QA Admin đóng Xưởng Phim → đóng được; đóng Kho Phim hoặc tự mở lại → `forbidden`.
    - Khi đóng: QA2 gửi/báo cáo qua API → `chat_disabled`; đọc 0 tin. QA Admin gửi → `chat_disabled`; đọc đủ 10 tin.
    - Phòng chung vẫn chạy.
    - Chủ mạng mở lại → 9 tin cũ hiện lại, gửi được.
    - Ghi thẳng vào phạm vi đóng → `chat_disabled`.
  - Sau đó xác nhận không có dữ liệu nào thay đổi.
- **Preview thật:**
  - Chat phim nối realtime ("2 người đang xem"), 9 tin, ô nhập mở.
  - Thành viên gọi công tắc → `forbidden`.

### 3. Rà soát RLS và quyền của 28 bảng (Staging, đọc trực tiếp)
- **RLS bật 28/28.**
- **23 hàm SECURITY DEFINER công khai:** đều cố định `search_path`. 22 hàm tự kiểm tra danh tính hoặc quyền.
  - `log_landing` là hàm dành cho khách: kiểm tra đầu vào, không chứa dữ liệu cá nhân, nay **có trần 300 lượt/phút/site**.
  - `get_playback_source` dành cho khách: chỉ trả nguồn của tập miễn phí. Tập bị khóa không lộ nguồn (đã kiểm ở RC1).
- **Schema `private`:** không role API nào có quyền USAGE; 0 hàm private bị lộ.
- **Bảng đọc công khai có chủ đích:** `approved_reviews`, `reward_rules`, `chat_settings`; phim/tập/Social chỉ hiện khi đã phát hành.
- **Phát hiện và sửa (Level 4.5, `db/level4_5_grant_hardening.sql`):**
  - `authenticated` có **TRUNCATE/TRIGGER/REFERENCES** trên 8 bảng (mặc định Supabase; **TRUNCATE bỏ qua RLS**).
  - Có quyền DELETE/UPDATE ở 5 chỗ không có policy.
  - Đã thu hồi **29 quyền**. Áp cả cho bảng tạo về sau. Ghi vào `private.grant_hardening_log`.
  - Script gỡ `96` cấp lại chính xác (đã kiểm thử).
  - **Staging sau 4.5:** 0 quyền nguy hiểm, 0 quyền ghi không có policy.
  - **Preview thật (SIGNUP1):** lưu hồ sơ vẫn được; xóa thành viên hoặc hồ sơ → `permission denied`.
- **Cách ly 5 website:** đã kiểm ở 4.3 trên Staging với các phiên mô phỏng, cộng ma trận E2E 5 site. Bảng chi tiết ở mục 13:00.
- **Ví chung, điểm danh 1 lần/ngày, quyền nội dung theo tập:**
  - Thật: điểm danh ở Phê Phim xong, sang Ghiền Phim báo đã điểm danh.
  - Mở khóa ghi theo `site_id` của tập.
  - Dưới tải: 999 lượt điểm danh không trùng; 31.522 lượt mở khóa không trùng; ví khớp sổ cái 100% (mục 5).
- **Không khẳng định "an toàn tuyệt đối".** Các kiểm thử tự động và kiểm tra thủ công chỉ chứng minh những kịch bản đã viết. Chưa có:
  - Kiểm thử xâm nhập độc lập.
  - Rà soát mã bởi bên thứ ba.
  - Fuzzing API.

### 4. Biện pháp thay thế khi chưa có Leaked Password Protection (gói Free)
| Biện pháp | Chi phí | Trạng thái / đề xuất |
|---|---|---|
| Bắt xác minh email | 0 | **Đang bật** |
| Giới hạn tần suất Auth (đăng nhập/đăng ký 30/5 phút/IP, email 30/giờ) | 0 | **Đang bật** |
| Phát hiện dùng lại refresh token | 0 | **Đang bật** |
| Mật khẩu tối thiểu 10 ký tự + yêu cầu chữ và số (Supabase "Password requirements") | 0 | **Đề xuất** bật trước Production (hiện là 8 ký tự, không yêu cầu loại ký tự) |
| CAPTCHA Cloudflare Turnstile cho đăng ký/đăng nhập/quên mật khẩu (Supabase hỗ trợ sẵn) | 0 | **Đề xuất** trước Production; cần thêm widget ở form |
| **MFA (TOTP) bắt buộc cho chủ mạng và quản trị viên** | 0 | **Đề xuất ưu tiên cao**: tài khoản quản trị mở được xóa tài khoản và đóng/mở chat |
| Chặn mật khẩu phổ biến phía trình duyệt (danh sách cục bộ, không gửi đi đâu) | 0 | Tùy chọn; chỉ hỗ trợ, không thay được kiểm tra phía máy chủ |
| Leaked Password Protection (HaveIBeenPwned) | Gói Pro | Bật khi nâng gói |

### 5. Năng lực 1.000 người online
- **Đo tải trên CSDL cô lập** (PostgreSQL cục bộ 2 vCPU/8 GB, dữ liệu giả lập: 1.000 thành viên, 5 site × 20 phim × 10 tập, 100.000 tin chat; `tools/loadtest/`).
  - Không chạm Staging/Production. Script tự dừng nếu thấy dữ liệu QA thật.
  - 50 kết nối đồng thời (≈ trần pooler gói nhỏ), mỗi bài 20 giây:

| Thao tác (có RLS / RPC thật) | TPS | Độ trễ TB | Ghi chú |
|---|---|---|---|
| Danh mục (khách) | 3.936 | 12,7 ms | 3 truy vấn/lượt |
| Lấy nguồn phát | 3.394 | 14,7 ms | |
| Đọc 50 tin chat (RLS) | 4.178 | 12,0 ms | dùng chỉ mục `chat_messages_room_time`, 0,23 ms/truy vấn |
| Điểm danh | 6.491 | 7,7 ms | 999 thành công, 0 trùng |
| Mở khóa tập | 1.784 | 28,0 ms | 31.522 thành công, 0 trùng, 0 số dư âm |
| Gửi chat | 7.961 | 6,3 ms | 4.995 tin (đúng trần 5 tin/30 giây/người), phần còn lại bị chặn có chủ đích |

  > Máy đo mạnh hơn gói Free/Nano của Supabase (CPU dùng chung, 0,5 GB). Số liệu chỉ để thấy **CSDL và các truy vấn không phải điểm nghẽn**, không phải năng lực thật của Staging.
- **Nhu cầu ước tính cho 1.000 người online** (giả định trong `tools/loadtest/k6-1000-online.js`):
  - ~2 trang/phút/người × ~12 lời gọi Supabase ≈ **~400 request/giây** vào PostgREST/Auth.
  - 30% mở chat ≈ **300 kết nối Realtime**; ~1 tin/2 phút/người ≈ 2–3 tin/giây.
  - Mỗi tin trong phòng có N người đang xem tạo ra N lượt kiểm tra RLS ở Realtime.
- **Điểm nghẽn theo thứ tự** (giới hạn chính thức của Supabase):
  1. **Realtime:** Free **200** kết nối đồng thời / 100 tin/giây; Pro **500** / 500; Pro không giới hạn chi tiêu **10.000** / 2.500.
     - Với 1.000 người online và 30% mở chat, **Free không đủ**; Pro đủ tới ~500 người mở chat cùng lúc.
     - Postgres Changes xử lý **đơn luồng** và kiểm quyền **cho từng người nhận**. Supabase khuyến nghị chuyển sang Broadcast khi > ~3.000 người nhận cùng thay đổi.
  2. **Kết nối CSDL:** Nano/Micro 60 trực tiếp / 200 qua pooler; Small 90/400. REST API dùng pool riêng nên không phải mỗi người một kết nối.
  3. **Auth:** mỗi lần tải trang có ~3 lời gọi `/auth/v1/user`. Có thể giảm bằng cách dùng phiên cục bộ (`getSession`) cho phần hiển thị, chỉ gọi `getUser` trước thao tác nhạy cảm.
  4. **Phát video:** YouTube nhúng (băng thông của YouTube) và tệp MP4 dự phòng (máy chủ nguồn), không đi qua Supabase. Website tĩnh trên Cloudflare Pages không giới hạn băng thông.
- **Đề xuất trước khi phục vụ 1.000 người:**
  1. **Nâng Supabase Pro** (bắt buộc cho Realtime > 200 và để có backup tự động/PITR).
  2. Chỉ mở Realtime khi người dùng mở khung chat (**đã như vậy**). Tự đóng kết nối khi tab ẩn quá 5 phút.
  3. Cache danh mục phim/tập theo site ở trình duyệt 60 giây (dữ liệu công khai, ít đổi). Giảm `getUser` lặp.
  4. Khi chat đông (> vài trăm người cùng phòng): chuyển phân phối tin sang **Broadcast** (trigger → `realtime.send`), giữ RLS ở bước ghi.
  5. Giữ các trần hiện có: 5 tin/30 giây, chống trùng, báo cáo/ngày, `log_landing` 300/phút/site.
  6. Chạy `k6-1000-online.js` trên **project Supabase cô lập** (không phải Staging) trước khi phát hành; ngưỡng p95 < 800 ms, lỗi < 1%.
- **Không** tạo tải lên Staging/Production và **không** phát sinh chi phí trong vòng này.

### 6. Đồng bộ 5 website
- **Shared Core:** `tools/site-package.cjs check` → **5/5 OK** (đã thêm `functions/phim/[[path]].js` vào manifest).
- **Lỗi mới phát hiện và sửa trên Preview:**
  - Link đẹp `/phim/<slug>?site=khophim` bị Cloudflare `_redirects` bỏ `?site=`, nên rơi về Xưởng Phim.
  - Thay bằng Pages Function giữ nguyên toàn bộ tham số.
  - **Đã kiểm thật trên Cloudflare:** `/phim/thanh-pho-khong-ngu?site=khophim` → `/?film=thanh-pho-khong-ngu&site=khophim`. Có thêm E2E.
- **Phân biệt phạm vi thay đổi:**

| Riêng từng website (đổi không ảnh hưởng site khác) | Toàn hệ thống (ảnh hưởng cả 5 site, phải chạy đủ kiểm thử 5 site) |
|---|---|
| Mục của site trong `assets/sites.js`: tên, ấn triện, tagline, `world`, màu nhấn, phim nổi bật, hàng phim, Social dự phòng | Mọi tệp `assets/*.js`, `*.css`, `*.html`, `functions/*`, `_headers`, `_redirects` |
| `sitemaps/<site>.xml` (sinh từ danh mục) | Migration `db/*.sql` (RLS, RPC, ví, điểm danh, chat) |
| Dữ liệu Supabase theo `site_id`: phim, tập, nguồn phát, Social, nhân sự, công tắc chat của site | `reward_rules` (quy tắc điểm danh toàn mạng), ví, sổ điểm |
| Supabase Redirect URLs của tên miền đó; Pages project/tên miền của site đó | Cấu hình Auth/SMTP, mẫu email |

- **SEO / Social riêng:**
  - canonical, Open Graph, tiêu đề theo tên miền của site (`app.js setSeo`); sitemap riêng; Social theo `site_social_links`.
  - Cổng lập chỉ mục `INDEXABLE` bật riêng từng site.
  - Giao diện riêng sâu hơn (CSS riêng một site) chưa có cơ chế. Nếu cần: thêm trường `theme` trong `sites.js` và tệp `assets/themes/<site>.css`, coi là thay đổi toàn hệ thống một lần.
- **Bản Preview độc lập để kiểm thử từng site** (cùng mã, khác site; dùng chung Staging):
  - `https://feature-master-site-xuongphi.web-phim-ai-5sites.pages.dev/?site=<xuongphim|khophim|phephim|phimhay|ghienphim>`. Link đẹp, Member Hub và Dashboard đều giữ đúng site.
  - **Project Pages riêng cho mỗi site** (khi đồng bộ thật): theo runbook ở mục 13:00 §4. **Cần phê duyệt** vì là thay đổi Cloudflare.

### 7. Kiểm thử
- SQL functional **214**.
- Concurrency/staging **21**, gồm chuỗi gỡ 96 → 97 → 98 → 99 về đúng Level 3 và áp lại 4 → 4.5.
- E2E **96/96**; contract **11/11**; site-config **11/11**.
- Kiểm thử hợp đồng phát hiện 2 chỗ cần cập nhật (danh sách site viết cứng trong Studio; RPC mới chưa có trong danh sách quét). Đã sửa.
- Đo tải cục bộ: mục 5.

### 8. Backup trước mỗi migration
- **Trước 4.4:** bản logic mới `afn_supabase_backup_20261101_1251_pre44.zip` (AES-256, cùng mật khẩu).
  - Lưu tại `C:\Users\PC\Downloads\WEB_PHIM_AI\WEB_PHIM_AI\backups\supabase\`. SHA-256 `8ab3acd3…2115`.
  - Thử khôi phục khớp 30/30. Đọc lại từ PC trùng từng byte, giải mã đạt.
- **Trước 4.5:** dữ liệu trùng 30/30 với bản 12:51 (chỉ thêm `chat_settings` mặc định), nên bản đó vẫn có hiệu lực.
- Staging hiện có 14 migration.

### Kết luận
| Hạng mục | Trạng thái |
|---|---|
| **MIGRATION 4.3** | **VERIFIED** (mục 13:00) |
| **CHAT BACKEND SWITCH** | **PASS**: chặn gửi/báo cáo ở máy chủ, ẩn tin với thành viên, giữ dữ liệu, mở lại bình thường; kiểm thật trên Staging |
| **RLS & DATA ISOLATION** | **PASS** cho các kịch bản đã kiểm (không phải bảo đảm tuyệt đối; xem mục 3) |
| **SHARED CORE** | **READY** |
| **1.000 USER CAPACITY PLAN** | **COMPLETE** (kế hoạch, đo CSDL cô lập và kịch bản k6). Lưu ý: **chưa chạy k6** trên project cô lập vì cần tạo project (có thể phát sinh chi phí); gói Free không đủ Realtime cho 1.000 người |
| **MULTI-SITE PREVIEW** | **READY**: 5 site qua `?site=` trên Preview, link đẹp đã giữ đúng site. Project Preview riêng từng site cần phê duyệt |
| **PRODUCTION** | **ON HOLD** |

---

## Cập nhật 01/11/2026 13:00 — Level 4.3: cách ly quản trị theo website, quyền riêng tư, chuẩn bị đồng bộ 5 site

Trạng thái pháp lý (email hỗ trợ, pháp nhân, thời hạn lưu trữ) giữ nguyên **PENDING OWNER/LEGAL REVIEW** theo quyết định của chủ dự án.
Không thay đổi Production, DNS, `main`. Không đồng bộ 4 website Production. Không xóa dữ liệu người dùng.

### 1. Lỗi đã sửa
| # | Lỗi (phát hiện khi kiểm toán) | Sửa |
|---|---|---|
| 1 | **Cách ly quản trị:** `chat_reports_read` cho **mọi** `site_staff` của **mọi** site đọc toàn bộ báo cáo chat | Phòng phim → chỉ nhân sự đúng site; phòng chung → quản trị viên; chủ mạng → tất cả; người báo cáo → báo cáo của mình |
| 2 | `chat_mutes_read` mở cho mọi nhân sự (kể cả moderator) | Chỉ người bị khóa, chủ mạng, quản trị viên (role admin) |
| 3 | Yêu cầu xóa tài khoản chỉ được ghi nhận; admin site UPDATE thẳng trạng thái; bản ghi yêu cầu bị xóa dây chuyền khi xóa tài khoản | Quy trình qua RPC (mục 2); bản ghi giữ lại dạng bút danh (`subject_id`) |
| 4 | Tài khoản từng đăng phim/tập **không xóa được** (`created_by` NO ACTION) | `created_by` → SET NULL |
| 5 | Xuất dữ liệu thiếu ví, sổ điểm, chat | `my_data_export()` đầy đủ 18 mục; giao diện tự lùi về cách cũ nếu CSDL chưa nâng cấp |
| 6 | **Dashboard bỏ qua `?site=`**: mở từ Kho Phim vẫn vào Xưởng Phim | Mở đúng site; không có quyền → báo rõ và hiển thị site được cấp |

### 2. Quy trình yêu cầu quyền riêng tư (Level 4.3)
- **Thành viên:**
  - gửi yêu cầu ở trang Tài khoản;
  - mỗi loại chỉ có 1 yêu cầu đang mở (chặn ở máy chủ);
  - thấy trạng thái tiếng Việt và ghi chú của quản trị viên;
  - nhận thông báo ở mỗi bước.
- **Quản trị viên website** (chỉ site được cấp):
  - Chờ xử lý → Đang xử lý / Từ chối (bắt buộc ghi lý do ≥ 5 ký tự);
  - Đang xử lý → Hoàn tất (với yêu cầu khác yêu cầu xóa) / Từ chối.
  - Mọi bước ghi `admin_audit_log`.
- **Xóa tài khoản: CHỈ chủ mạng** (vì ví điểm dùng chung toàn mạng):
  - Bước 1, "Xem trước dữ liệu sẽ xóa" (chạy thử, không ghi gì): email che một phần và số bản ghi theo từng bảng.
  - Bước 2, gõ đúng toàn bộ email → xóa tài khoản và dữ liệu dây chuyền.
  - Nhật ký chỉ lưu mã bút danh, không lưu email.
  - Tài khoản có quyền quản trị phải được gỡ quyền trước (`target_is_staff`).
- **Chưa có:** email thông báo sau khi xóa (tài khoản đã bị xóa nên không còn hộp thư trong hệ thống); hạn xử lý tự động. Cả hai chờ chính sách lưu trữ được phê duyệt.

### 3. Cổng phát hành Community Chat
- `assets/afn-core.js`: `CHAT_PUBLIC_DOMAINS = []`.
  - Trên **tên miền thật**, chat tự tắt: không có lối vào, không kết nối Realtime.
  - Trên Preview/localhost vẫn bật để kiểm thử.
- Muốn mở trên tên miền nào phải ghi tên miền đó vào danh sách. Test `site-config` sẽ báo đỏ để việc mở là quyết định có chủ đích, sau kết luận pháp lý.
- **Giới hạn:** đây là cổng ở giao diện. API `send_chat_message` vẫn hoạt động vì Preview và Production dự kiến dùng chung một project Supabase. Trước khi phát hành, nếu chat vẫn tắt, nên thêm cờ tắt chat phía máy chủ.

### 4. Gói Shared Core cho 5 website
- `tools/site-package.cjs check` kiểm tra mỗi site:
  - tên miền khớp `functions/_site.js`;
  - nhận diện (tên, ấn triện, tagline);
  - **tương phản màu nhấn ≥ 4.5**;
  - phim nổi bật có trong danh mục;
  - mọi hàng phim có thể loại hợp lệ và có phim;
  - sitemap khớp danh mục;
  - Social dự phòng là https;
  - cổng index và cổng chat đang tắt.

  **Kết quả: 5/5 OK.**

  | Site | Danh mục | Tương phản | URL sitemap |
  |---|---|---|---|
  | xuongphim | 16 | 10.17 | 17 |
  | khophim | 20 | 6.47 | 21 |
  | phephim | 16 | 5.9 | 17 |
  | phimhay | 20 | 5.58 | 21 |
  | ghienphim | 20 | 6.59 | 21 |
- `manifest`: danh sách 40 tệp Shared Core kèm SHA-256. 5 website dùng **cùng một bộ tệp**; khác biệt duy nhất nằm trong `assets/sites.js` và dữ liệu Supabase theo `site_id`.
- `verify <url> <site>`:
  - tải bản đã triển khai và so SHA-256 từng tệp;
  - kiểm tra `robots.txt`/`sitemap.xml` theo site;
  - dùng sau mỗi lần triển khai một site (chạy được trên PC Nhân bằng Node có sẵn).
- **Runbook đồng bộ lần lượt 4 site** (khi có phê duyệt; áp dụng mô hình đã duyệt cho Xưởng Phim):
  1. Tạo project Pages riêng cho site.
  2. Production branch của project đó = nhánh RC.
  3. Chạy `verify` trên `<project>.pages.dev`.
  4. Thêm URL `https://www.<site>.ai/?auth=…` vào Supabase Redirect URLs.
  5. Chuyển đúng 2 tên miền (apex + www) của site đó.
  6. Smoke test.
  7. Rollback = chuyển tên miền về project cũ (`c6dd520`).

### 5. Migration 4.3 trên Staging (đã được chủ dự án phê duyệt lúc 12:30)
- **Điều kiện an toàn trước khi áp:**
  - **Production `main` @ `c6dd520` không chứa bất kỳ tham chiếu Supabase nào**, nên không thể dùng project `ai-film-network`.
  - Project `ai-film-network` (Singapore, PG 17.11) chỉ phục vụ các nhánh Preview.
  - **Dữ liệu trùng 35/35** với bản backup mã hóa lúc 10:39 (đã thử khôi phục đạt), nên không cần backup mới.
  - Phụ thuộc đầy đủ: `is_site_admin`, `audit`, `event_key`, chỉ mục chống trùng thông báo. Không có view phụ thuộc. Tên ràng buộc khớp script gỡ.
  - Đã trình nội dung migration trước khi anh duyệt trên Supabase.
- **Áp dụng:** `apply_migration level4_3_isolation_privacy` → success. Bảng migration có 12 bản ghi.
- **Schema sau migration trùng bản đã kiểm thử cục bộ:**
  - policy 58, RLS 27/27, cột 216, trigger 10: md5 trùng;
  - 39 hàm: 37 trùng tuyệt đối; 2 hàm chỉ khác **chú thích** (logic trùng khi bỏ chú thích).
  - Quyền UPDATE trực tiếp lên `member_privacy_requests` = 0; anon gọi được 3 hàm mới = 0.
- **Dữ liệu không đổi:** 27 bảng (số dòng + md5), 6 tài khoản, tổng ví 60, 0 ví lệch sổ cái.
- **Kiểm thử hành vi thật trên Staging** với các phiên QA mô phỏng (QA1, QA2, QAADMIN, SIGNUP1, chủ mạng). Chạy trong một giao dịch **tự hủy**; đã kiểm tra lại sau đó: không có dữ liệu nào thay đổi.

| Kiểm tra | Kết quả |
|---|---|
| Admin Xưởng Phim đọc báo cáo | 5 (đủ của site mình + phòng chung) |
| QA2 tạm làm **admin Kho Phim** | 4 (3 của mình + 1 phòng chung). Báo cáo phòng phim Xưởng Phim của người khác: **0** (trước 4.3 là 1) |
| QA1 tạm làm **moderator Kho Phim** | Chỉ báo cáo của mình (1); danh sách khóa chat: 0 |
| Điểm danh QA2 ở phephim | `claimed` (+12, số dư 22); ở ghienphim cùng ngày → `already` (**dùng chung toàn mạng**) |
| Mở khóa thiếu điểm / sửa ví trực tiếp | `insufficient` / `permission denied` |
| Gửi trùng yêu cầu / thành viên tự đổi trạng thái | `duplicate key` / `permission denied` |
| Admin Kho Phim xem/xử lý yêu cầu Xưởng Phim | 0 dòng / `forbidden` |
| Admin Xưởng Phim: UPDATE thẳng / qua RPC | `permission denied` / `in_review` + 1 thông báo + 1 dòng nhật ký |
| Hoàn tất yêu cầu xóa không qua chủ mạng | `use_account_deletion`; admin site gọi xóa → `forbidden` |
| Chủ mạng chạy thử / gõ sai email | `dry_run` (hu***@gmail.com, đếm 7 tin, 3 giao dịch…) / `email_mismatch`; vẫn 6 tài khoản |
| Xuất dữ liệu QA1 | Số dư 30, 3 giao dịch, 7 tin nhắn, không chứa email người khác |

- **Công cụ kiểm tra bảo mật của Supabase:** không có phát hiện mới.
  - Hàm SECURITY DEFINER có chủ đích; mỗi hàm tự kiểm tra quyền.
  - Mục tồn tại từ trước: leaked-password protection (gói Free), `traffic_events` không có policy (client không được đọc).

### 6. Kiểm thử trên Preview thật (nhánh phát triển @ `9a48e8d`, SHA-256 5 tệp JS trùng commit)
- **Phiên QA thật: SIGNUP1** (không dùng tài khoản chủ).

| Site | Tên / canonical | Điểm danh (đã điểm danh ở Xưởng Phim) | Lối vào chat | Chân trang pháp lý | Phim QA lẫn vào | Tải trang | Cuộn ngang |
|---|---|---|---|---|---|---|---|
| xuongphim | XưởngPhim.ai / www.xuongphim.ai | đã điểm danh | có | 2 | có (đúng site) | — | không |
| khophim | KhoPhim.ai / www.khophim.ai | **đã điểm danh** | có | 2 | không | 327 ms | không |
| phephim | PhêPhim.ai / www.phephim.ai | **đã điểm danh** | có | 2 | không | 114 ms | không |
| phimhay | PhimHay.ai / www.phimhay.ai | **đã điểm danh** | có | 2 | không | 130 ms | không |
| ghienphim | GhiềnPhim.ai / www.ghienphim.ai | **đã điểm danh** | có | 2 | không | 121 ms | không |

- Mỗi trang ~50 request, 12 lời gọi Supabase.
- Tập 2 đã mua phát được (`get_playback_source` = ok).
- Xuất dữ liệu thật: 18 mục; không có `actor` của giao dịch; không chứa email người khác.
- Gửi yêu cầu xóa trên giao diện → "Yêu cầu xóa tài khoản · Chờ xử lý"; gửi lần 2 bị chặn. Máy chủ có 1 bản ghi đúng `subject_id`.
- Gọi trực tiếp API bằng phiên thành viên:
  - đổi trạng thái → `forbidden`; xóa → `forbidden`; UPDATE → `permission denied`;
  - chỉ đọc được 1 báo cáo của mình, 0 khóa chat, 1 ví.
- Dashboard `?site=khophim` với thành viên thường → "Bạn chưa được cấp quyền quản trị."
- **Dữ liệu QA mới phát sinh:** 1 yêu cầu xóa tài khoản *pending* của SIGNUP1 (tài khoản QA). Sẽ do QA Admin từ chối kèm lý do ở phiên Dashboard kế tiếp, hoặc gom vào đợt dọn dữ liệu QA (R1). **Không** thực thi xóa.

### 7. Kiểm thử tự động
- SQL functional **178** (+44 cho 4.3).
- Concurrency/staging **17** (thêm: 4.3 thay đổi schema; gỡ 98 về đúng 4.2; 98 rồi 99 gỡ hết Level 4; áp lại đủ chuỗi).
- **Đối chứng:** test cách ly **thất bại trên policy 4.2** và đạt trên 4.3.
- E2E **92/92**, gồm:
  - ma trận 5 site (điểm danh, mở khóa + phát, chat phòng phim đúng site, Member Hub, cách ly nội dung, không cuộn ngang, CSP);
  - điểm danh toàn mạng;
  - Dashboard cách ly;
  - quy trình quyền riêng tư;
  - xuất dữ liệu;
  - cổng chat trên `www.xuongphim.ai`.
- site-config **11/11**, contract **11/11**.
- `auth-browser` / `level3-hub` cần `jsdom`, môi trường hiện không có (giới hạn có sẵn, không phải hồi quy).

### Kết luận
| Hạng mục | Trạng thái |
|---|---|
| **MIGRATION 4.3** | **PASS**: schema, RLS, hàm và dữ liệu sau migration được xác minh thực tế trên Staging |
| **RC3 REGRESSION** | **PASS**: E2E 92/92; luồng RC2/RC3 trên Preview thật không đổi |
| **MULTI-SITE FEATURE PARITY** | **PASS**: 5/5 site đạt cùng bộ chức năng (E2E + Preview thật) |
| **DATA ISOLATION** | **PASS**: ví và điểm danh dùng chung; nội dung, báo cáo, yêu cầu quyền riêng tư, Dashboard tách theo site |
| **SECURITY** | **PASS** cho phạm vi kỹ thuật đã kiểm. Còn mở: cờ tắt chat phía máy chủ trước Production; leaked-password protection (gói trả phí) |
| **SHARED CORE PACKAGE** | **READY** |
| **FOUR-SITE PREVIEW** | **READY**: 4 site chạy đúng trên Preview chung qua `?site=`. Project Pages riêng cho từng site chưa tạo (cần phê duyệt) |
| **PRODUCTION** | **ON HOLD**: chờ pháp lý (chính sách, chat, Luật Điện ảnh), phê duyệt R1–R7 |

---

## Cập nhật 01/11/2026 12:10 — RC3: Chính sách riêng tư & sẵn sàng pháp lý

### 1. Nhánh và commit
- **RC3:** nhánh riêng **`release/xuongphim-l4-rc3`** @ **`4efe717`**, tạo từ RC2 `ffb68f8` và chỉ thêm thay đổi RC3.
- **Không bị ghi đè:**
  - Kênh RC2 `release/xuongphim-l4-rc1` vẫn ở `ffb68f8`.
  - `main` vẫn ở `c6dd520`.
  - 4 website còn lại không thay đổi.
- **Nhánh phát triển:** `feature/master-site-xuongphim-2026-10-31` @ `84ae0f0`. Các tệp website của nhánh này trùng RC3.
- Trước khi làm, đã kiểm tra: working tree sạch, HEAD `c5194ad`; nhánh phát triển khác RC2 chỉ ở tools/docs.
- **Bản dự thảo "Chính sách riêng tư Hungcreator":** tệp đính kèm chỉ chứa yêu cầu, không có bản dự thảo riêng. RC3 vì vậy dựng trên `chinh-sach.html` hiện có, giữ phần đúng và sửa theo kiểm toán bên dưới.

### 2. Tệp thay đổi so với RC2 (5 tệp)

| Tệp | Thay đổi |
|---|---|
| `chinh-sach.html` | Viết lại thành **DRAFT RC3** (mục 3) |
| `assets/auth.js` | Thêm 1 dòng thông báo có liên kết Chính sách riêng tư và Quy tắc cộng đồng, **chỉ hiện ở tab Đăng ký**. Không đổi logic đăng ký/đăng nhập (+3 dòng) |
| `assets/auth.css` | Kiểu chữ cho liên kết trong dòng thông báo (+1 dòng) |
| `tests/site-config.test.cjs` | Cổng kiểm tra chính sách RC3; kiểm tra mọi máy chủ bên thứ ba website tải đều đã được khai báo |
| `tests/e2e/master-site.spec.cjs` | +2 E2E: dòng thông báo ở form Đăng ký; trang chính sách trên điện thoại và accessibility |

- Ví, điểm danh, mở khóa, chat, trình phát, Dashboard, SQL và migration **không thay đổi** (`app.js`, `community-chat.js`, `rewards.js`, `afn-core.js`, `db/*`).

### 3. Nội dung chính sách DRAFT RC3
- **Khung trạng thái đầu trang:**
  - "Bản dự thảo — chưa phải chính sách chính thức"
  - Phiên bản **DRAFT RC3**
  - Đơn vị vận hành: **Hungcreator (tên thương hiệu; thông tin pháp nhân chưa được xác minh và công bố)**
  - Email hỗ trợ: **Chưa xác định**
  - Thời hạn lưu trữ: **Chưa được phê duyệt**
- **Không còn ghi chú nội bộ** (`[CẦN CHỦ WEBSITE…]`) trên trang. Có test chặn trường hợp này. Trang giữ `noindex`.
- **Đã bổ sung theo hành vi thật:**
  - IP và loại trình duyệt của phiên đăng nhập (lưu trong `auth.sessions`).
  - Website không đặt cookie.
  - Danh sách khóa localStorage.
  - jsDelivr, Google Fonts, YouTube (tải từ máy chủ Google khi phát).
  - Chuyển dữ liệu ra nước ngoài: Supabase Singapore, Resend Tokyo, Cloudflare toàn cầu.
  - Tiến độ xem **mặc định tắt**.
  - Phạm vi thật của tính năng tải dữ liệu.
  - Hậu quả khi xóa tài khoản (xóa dây chuyền).
  - Tin bị ẩn vẫn được lưu.
  - Đánh giá phim hiển thị công khai, không kèm tên.
  - Giới hạn 500 ký tự mỗi tin.
  - Chưa có xác minh độ tuổi.
  - Thời hạn lưu chưa được phê duyệt; dữ liệu đã xóa còn trong bản sao lưu.
- **Đã sửa câu sai:** xem bảng đối chiếu (mục 4).

### 4. Đối chiếu chính sách với code, database và Dashboard
Nguồn kiểm tra: mã nguồn, SQL chỉ đọc trên Supabase, Dashboard Auth (đọc), trình duyệt trên Preview RC.

| # | Hạng mục | Hành vi thực tế (bằng chứng) | Chính sách RC3 |
|---|---|---|---|
| 1 | Dữ liệu thu thập | Email, tên hiển thị, hồ sơ người xem, sở thích, điểm danh, ví, sổ cái, quyền mở tập, chat, báo cáo, đánh giá | Đúng |
| 2 | Tài khoản | Supabase Auth (Singapore); mật khẩu băm. Bản cũ ghi "mã hóa" | **Đã sửa** thành "băm một chiều" |
| 2b | IP / User-Agent | `auth.sessions`: 12/12 phiên có `ip` và `user_agent`. Bản cũ **không nêu** | **Đã bổ sung** |
| 3 | Điểm danh / ví | RPC `claim_daily_checkin`; ví = tổng sổ cái; không có thanh toán bằng tiền | Đúng |
| 4 | Giao dịch / mở khóa | `wallet_ledger` và `content_entitlements` **ON DELETE CASCADE** theo tài khoản. Bản cũ nói "giao dịch điểm có thể được giữ lại" | **Đã sửa**: bị xóa kèm tài khoản; có test chặn câu cũ |
| 5 | Chat | Chỉ thành viên đăng nhập đọc được (anon không có quyền); tối đa 500 ký tự; 5 tin/30 giây; chặn tin trùng; tin ẩn vẫn lưu | Đúng, đã bổ sung chi tiết |
| 5b | Báo cáo | Người bị báo cáo không đọc được `chat_reports`. **Phát hiện:** mọi `site_staff` **của mọi site** đọc được báo cáo của mọi site | Câu trên trang đúng. Phạm vi quyền: **cần phát triển** (xem 7.b) |
| 6 | Nhật ký kiểm duyệt | `admin_audit_log` gồm actor, mã tài khoản đích, lý do, thời điểm. Không có FK nên **còn lại sau khi xóa tài khoản** (chỉ mã, không có email) | Đã nêu đúng |
| 6b | Khóa chat | DB hỗ trợ cả vĩnh viễn (`-1`); giao diện chỉ có 24 giờ. Bản cũ ghi "khóa vĩnh viễn" | **Đã sửa**: "thường 24 giờ, lâu hơn với vi phạm nghiêm trọng" |
| 7 | Nhật ký bảo mật | `auth.sessions`, `refresh_tokens`; `auth.audit_log_entries` = 0; nhật ký nền tảng do Supabase giữ | Đã nêu |
| 8 | Xóa tài khoản | Nút trong Tài khoản → `member_privacy_requests` (pending) → quản trị viên đánh dấu trong Studio. **Chưa có chức năng thực thi xóa**; phải xóa tay user trong Supabase | Đã nêu "xử lý thủ công". Thực thi xóa: **cần phát triển** |
| 8b | Rào cản xóa | `site_films.created_by` / `site_episodes.created_by` = NO ACTION, nên **không xóa được tài khoản đã đăng phim** (chỉ ảnh hưởng tài khoản quản trị) | Cần phát triển (SET NULL) |
| 9 | Xuất dữ liệu | Trang thành viên tự tải JSON 8 bảng (hồ sơ…thông báo); **không gồm** ví, sổ cái, chat, báo cáo. Loại yêu cầu `data_export` có trong DB nhưng giao diện chưa dùng. Bản cũ chỉ nói "gửi qua email" | **Đã sửa** theo phạm vi thật. Xuất đủ: **cần phát triển** |
| 9b | Ẩn danh hóa | Không có cơ chế; chỉ xóa dây chuyền | Không hứa ẩn danh hóa |
| 10 | Backup | Bản logic mã hóa trên PC Nhân, hủy thủ công; gói Free không có backup tự động | Đã nêu |
| 11 | Cookie / storage / analytics | Trình duyệt thật: **0 cookie**, localStorage `afn-film-auth-v1`, `afn-cw:*`, `afn-side`, `afn-active-viewer:*`, `afn-ref`, sessionStorage `afn-landing:*`. Không có Cloudflare Analytics hay quảng cáo. `traffic_events` không có IP/UA/user id, chỉ ghi khi có utm/ref | Đúng, đã liệt kê |
| 12 | Nhà cung cấp / xuyên biên giới | Supabase SG, Cloudflare, Resend (Tokyo), Google Fonts, YouTube, **jsDelivr (bản cũ thiếu)** | **Đã bổ sung**; có test tự động |
| 13 | Nguồn phim | Phim QA đang đăng là **phim Blender (CC BY), không phải phim AI**, trái với câu "toàn bộ phim… tạo bằng AI" | **Đã sửa câu**; phim QA phải gỡ trước Production (R1) |
| 14 | Đăng ký | Bản cũ: form đăng ký **không liên kết** tới chính sách | **Đã bổ sung** dòng thông báo (chỉ thông báo, chưa có ô tích đồng ý; xem mục 5) |

### 5. Những điểm cần chuyên gia pháp lý xem xét
Claude **không khẳng định** Hungcreator đã được cấp phép hay đáp ứng đủ nghĩa vụ. Các văn bản dưới đây được đối chiếu qua văn bản và bản tóm tắt công khai. Cần luật sư xác nhận.

1. **Community Chat có thể bị coi là "mạng xã hội" theo Nghị định 147/2024/NĐ-CP.** Mức rủi ro: **cao, có thể chặn phát hành chat.** Nếu đúng vậy, theo bản tóm tắt:
   - Chỉ cơ quan, tổ chức, doanh nghiệp thành lập theo pháp luật Việt Nam mới được cung cấp dịch vụ.
   - Dùng tên miền `.vn`, có máy chủ tại Việt Nam.
   - Xác thực tài khoản bằng số điện thoại Việt Nam; chỉ tài khoản đã xác thực mới được bình luận.
   - Lưu thông tin tài khoản, giờ đăng nhập, IP và nhật ký xử lý ít nhất **2 năm**.
   - Tài khoản dưới 16 tuổi do cha mẹ đăng ký.
   - Có nhân sự xử lý yêu cầu 24/7.

   Hiện hệ thống **không đáp ứng** các điều kiện này: tên miền `.ai`, máy chủ Singapore, xác thực bằng email. Phương án an toàn nếu chưa rõ: **tắt Community Chat khi phát hành Production.**
2. **Luật Điện ảnh 2022, Điều 21 (phổ biến phim trên không gian mạng).** Mức rủi ro: **cao.**
   - Chủ thể là doanh nghiệp, đơn vị sự nghiệp hoặc tổ chức.
   - Phải tự phân loại phim, **thông báo danh sách phim và kết quả phân loại cho Bộ VHTTDL trước khi phổ biến**.
   - Có biện pháp để cha mẹ kiểm soát độ tuổi.
   - Có đầu mối liên hệ nhận khiếu nại.
   - Cần xác định Hungcreator (thương hiệu, chưa có pháp nhân) có đủ tư cách hay không, và phim tạo bằng AI có thuộc diện này không.
3. **Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (hiệu lực 01/01/2026) và Nghị định 356/2025/NĐ-CP:**
   - **Căn cứ xử lý và cách lấy đồng ý:** hiện chỉ có dòng thông báo, chưa có ô tích. Cần quyết định có cần đồng ý tách bạch không.
   - **Lưu trữ phía trình duyệt:** dữ liệu localStorage chỉ phục vụ chức năng, không có cookie theo dõi. Cần xác nhận không cần hộp thoại đồng ý cookie.
   - **Thời hạn trả lời yêu cầu** (theo bản tóm tắt NĐ 356): phản hồi trong 2 ngày làm việc; xóa dữ liệu trong 20 ngày. Muốn đáp ứng phải có **kênh liên hệ**, hiện **chưa có**.
   - **Hồ sơ đánh giá tác động xử lý (DPIA) và chuyển dữ liệu ra nước ngoài (CTIA), người phụ trách bảo vệ dữ liệu (DPO):**
     - Hộ kinh doanh và doanh nghiệp siêu nhỏ được miễn.
     - Doanh nghiệp nhỏ và khởi nghiệp được miễn 5 năm.
     - Có thể được miễn hay không **phụ thuộc tư cách pháp lý chưa xác minh**.
     - Dữ liệu đang lưu ở Singapore, Nhật Bản và hạ tầng toàn cầu.
   - **Thông báo khi lộ lọt dữ liệu:** chưa có quy trình.
4. **Người chưa thành niên:**
   - Chưa có cổng xác minh tuổi.
   - Luật 91/2025 có ngưỡng 7 tuổi về sự đồng ý của trẻ và người đại diện.
   - NĐ 147 có quy định riêng với người dưới 16 tuổi.
   - Luật Điện ảnh yêu cầu kiểm soát độ tuổi.
5. **Điểm thưởng:** không mua bằng tiền và không quy đổi ra tiền. Cần xác nhận không thuộc diện ví điện tử hay "trò chơi có thưởng".
6. **Chưa có Điều khoản sử dụng** để người dùng chấp nhận (NĐ 147 yêu cầu thỏa thuận này đối với mạng xã hội).

### 6. Thông tin chủ dự án chưa cung cấp
- Email hỗ trợ / kênh nhận yêu cầu về dữ liệu.
- Tư cách pháp lý (cá nhân / hộ kinh doanh / doanh nghiệp), tên pháp nhân, địa chỉ liên hệ.
- Phê duyệt thời hạn lưu trữ (mục 7).
- Người phụ trách bảo vệ dữ liệu (nếu không được miễn).
- Quyết định có bật Community Chat ở Production hay không (theo kết luận pháp lý).
- Kết quả phân loại và thông báo phim (nếu luật sư xác định thuộc diện).

### 7. Chính sách lưu dữ liệu đề xuất (CHƯA PHÊ DUYỆT, chưa áp dụng xóa tự động)
Ghi chú: nếu Community Chat thuộc diện mạng xã hội theo NĐ 147, các thời hạn nhật ký phải **≥ 2 năm**, thay cho mức đề xuất bên dưới.

| Loại dữ liệu | Mục đích | Căn cứ | Đề xuất | Bắt đầu tính | Cơ chế xóa | Được/phải giữ lâu hơn khi | Sẵn sàng trong code |
|---|---|---|---|---|---|---|---|
| Hồ sơ người dùng (`auth.users`, profiles, viewer_*) | Cung cấp tài khoản | Thực hiện dịch vụ / đồng ý | Suốt thời gian còn tài khoản; xóa **≤ 20 ngày** sau yêu cầu | Ngày nhận yêu cầu xóa | Xóa user → CASCADE | Có tranh chấp hoặc yêu cầu của cơ quan có thẩm quyền | **Một phần:** CASCADE có sẵn; thiếu RPC thực thi xóa, quy trình xử lý và sửa `created_by` |
| Lịch sử xem (`watch_progress`) | Xem tiếp | Đồng ý (opt-in) | 12 tháng từ lần cập nhật cuối, hoặc khi người dùng tắt/xóa | `updated_at` | Người dùng tự xóa; tự động dọn khi quá hạn | — | **Một phần:** có nút xóa và opt-in; chưa có job dọn |
| Ví và giao dịch (`wallets`, `wallet_ledger`, `content_entitlements`, `daily_checkins`) | Điểm thưởng, quyền xem, chống gian lận | Thực hiện dịch vụ | Suốt thời gian còn tài khoản; xóa cùng tài khoản | Ngày xóa tài khoản | CASCADE (hiện trạng) | Nếu muốn giữ để chống gian lận: cần ẩn danh hóa (đổi schema) | **Có** (xóa dây chuyền); giữ có ẩn danh: chưa có |
| Nhật ký kiểm duyệt (`admin_audit_log`) | Truy vết quyết định kiểm duyệt và quản trị | Lợi ích hợp pháp / nghĩa vụ quản lý nội dung | 24 tháng | Thời điểm thao tác | Job xóa theo `created_at` | Đang khiếu nại, tranh chấp, theo yêu cầu cơ quan | **Chưa có** job; đã có chỉ mã tài khoản (bút danh) |
| Nội dung chat (`chat_messages`, `chat_reports`) | Trò chuyện cộng đồng, xử lý vi phạm | Thực hiện dịch vụ / lợi ích hợp pháp | Tin thường 12 tháng; tin bị ẩn/báo cáo 24 tháng | `created_at` | Job xóa; xóa cùng tài khoản | Đang điều tra, theo yêu cầu cơ quan (NĐ 147: ≥ 2 năm nếu áp dụng) | **Chưa có** job |
| Nhật ký đăng nhập/bảo mật (`auth.sessions`, `refresh_tokens`, log nền tảng) | Bảo vệ tài khoản | Lợi ích hợp pháp | Theo vòng đời phiên; log nền tảng theo gói Supabase | Khi đăng xuất / hết hạn | Supabase tự quản | NĐ 147 (nếu áp dụng): lưu IP và giờ đăng nhập ≥ 2 năm | **Phụ thuộc nhà cung cấp**; muốn lưu 2 năm phải phát triển thêm |
| Lượt truy cập chiến dịch (`traffic_events`) | Đo hiệu quả chiến dịch | Lợi ích hợp pháp (không định danh) | 13 tháng, sau đó chỉ giữ số tổng | `landed_at` | Job gộp và xóa | — | **Chưa có** job |
| Yêu cầu quyền riêng tư (`member_privacy_requests`) | Chứng minh đã xử lý yêu cầu | Nghĩa vụ pháp lý | 3 năm sau khi hoàn tất | `handled_at` | Job xóa | Đang tranh chấp | **Chưa có** (hiện bị xóa dây chuyền cùng tài khoản; cần chuyển sang lưu bút danh) |
| Backup | Khôi phục sự cố | Lợi ích hợp pháp / an toàn | Giữ luân phiên **30 ngày** (bản mới nhất + bản tuần) | Ngày tạo bản | Hủy tệp mã hóa quá hạn | Có sự cố đang điều tra | **Thủ công** (script có sẵn, chưa có lịch luân phiên) |
| Dữ liệu tranh chấp | Giải quyết khiếu nại | Nghĩa vụ pháp lý / bảo vệ quyền | Đến khi giải quyết xong, cộng thời hiệu theo tư vấn luật sư | Ngày phát sinh | Gắn cờ "legal hold", gỡ khi kết thúc | Theo yêu cầu cơ quan | **Chưa có** cơ chế legal hold |

### 8. Kiểm thử RC3 (chạy trên chính nhánh `release/xuongphim-l4-rc3`)
- E2E **78/78** (76 cũ + 2 mới)
- contract **11/11**
- site-config **9/9**
- SQL functional **133**, concurrency/staging **13/13**
- **Preview thật** (`feature-master-site-xuongphi…pages.dev`, SHA-256 của 5 tệp trùng RC3):
  - Footer có 2 liên kết.
  - Dòng thông báo chính sách hiện ở tab Đăng ký và ẩn ở tab Đăng nhập.
  - Trang chính sách là DRAFT RC3, `noindex`, không lộ ghi chú nội bộ.
  - Canonical `https://www.xuongphim.ai/`, robots.txt không đổi, danh mục 42 thẻ phim, phiên đăng nhập hiện có vẫn hoạt động.
- **Accessibility và hiển thị:** heading không nhảy cấp, vùng chạm ≥ 44px, không cuộn ngang ở 360px. Đã xem ảnh chụp desktop 1280px và mobile 360px.

### 9. Bảo toàn RC2
- `git diff ffb68f8 4efe717` chỉ gồm 5 tệp ở mục 2.
- Không có thay đổi nào ở ví, chat, trình phát, SQL hay migration.
- Mọi test RC2 vẫn đạt.
- Supabase không bị thay đổi: chỉ chạy SELECT trong giao dịch read only và đọc Dashboard.

### 10. Điều kiện còn thiếu trước Production
1. Chủ dự án cung cấp email hỗ trợ và tư cách pháp lý; phê duyệt thời hạn lưu trữ.
2. Luật sư kết luận mục 5.1 (chat / NĐ 147) và 5.2 (Luật Điện ảnh). Nếu chưa có kết luận: phát hành **không kèm Community Chat**.
3. Phát triển trước khi chính thức hóa chính sách:
   - quy trình và RPC thực thi xóa tài khoản trong 20 ngày;
   - sửa `created_by` sang SET NULL;
   - thu hẹp quyền đọc báo cáo theo site;
   - (tùy kết luận pháp lý) ô tích đồng ý, cổng độ tuổi, Điều khoản sử dụng.
4. Bỏ `noindex` và nhãn dự thảo **chỉ sau khi** có bản chính sách được phê duyệt.
5. R1: dọn dữ liệu QA, gồm phim QA Blender (không phải phim AI).
6. R2–R7: project `xuongphim-ai`, URL Supabase cho www, chuyển tên miền, phê duyệt cuối.

### Kết luận RC3
| Hạng mục | Trạng thái |
|---|---|
| **RC3 TECHNICAL** | **PASS** |
| **PRIVACY DRAFT** | **INCOMPLETE**: nội dung đã khớp hệ thống thật, nhưng thiếu email hỗ trợ, pháp nhân, thời hạn lưu trữ |
| **LEGAL REVIEW** | **REQUIRED** |
| **SUPPORT CONTACT** | **MISSING** |
| **DATA RETENTION POLICY** | **PROPOSED** |
| **PRODUCTION RELEASE** | **NOT READY** |

Nguồn pháp lý đã tham khảo (bản tóm tắt / văn bản công khai):
- Luật 91/2025/QH15: GV Lawyers legal alert; pbgdpl.cantho.gov.vn
- NĐ 356/2025/NĐ-CP: EY Vietnam
- NĐ 147/2024/NĐ-CP: luatvietnam.vn, lsvn.vn
- Luật Điện ảnh 2022, Điều 21: hethongphapluat.com

---

## Cập nhật 01/11/2026 11:15 — RC2: xác minh bản backup cuối, khôi phục từ chính tệp đó, kiểm kê Auth đầy đủ

Mã ứng dụng RC2 (`ffb68f8`) **giữ nguyên**: vòng này không phát hiện lỗi ứng dụng. Không xóa dữ liệu QA, không đổi Production, không merge main, không thay đổi cấu hình Supabase (chỉ đọc Dashboard và chạy SQL `read only`).

### 1. Bản backup hiện có
- Tệp `afn_supabase_backup_20261101.zip` (bản 10:39) lấy lại từ PC Nhân: SHA-256 `8ac50551…e522` khớp; giải mã được; 5/5 tệp khớp `SHA256SUMS`.
- **Bản cuối cùng:** `backups\supabase\afn_supabase_backup_20261101_final.zip` (11.219 byte).
  - SHA-256 `986257ad5dda0510b5edb94042bfa464c1e7abb2a6e8c4de50a5a2b0a0031831`.
  - Cùng dữ liệu (md5 `d09517ca…86ee`) và cùng mật khẩu đã gửi anh.
  - Bổ sung bản kiểm kê Auth/cấu hình đầy đủ (mục 4).
  - Bản 10:39 vẫn được giữ, không xóa.
- **Dữ liệu chưa thay đổi kể từ lúc sao lưu:** fingerprint chạy trên Supabase lúc 11:00 trùng với bản sao lưu (27/27 bảng).

### 2–3. Công cụ và cách kết nối
- **7-Zip:** **đã có sẵn** trên PC Nhân (`C:\Program Files\7-Zip`, kèm WinRAR), không cần cài.
- **PostgreSQL 17 client:** vẫn **chưa có**, và chưa cài được một cách hợp lệ:
  - Phiên này không có shell trên PC Nhân.
  - Container không phân giải DNS ra ngoài: `apt.postgresql.org`, `get.enterprisedb.com`, `*.pooler.supabase.com:5432` đều không tới được. Vì vậy pg_dump cũng **không chạy được từ container**.
- **Kết nối dùng cho sao lưu:** Supabase MCP đã được cấp quyền.
  - Mọi truy vấn của vòng này chạy trong `set transaction read only`.
  - Không có mật khẩu hay connection string trong mã nguồn, log, báo cáo.
- **Bản pg_dump đầy đủ** (có cả mật khẩu đã băm) là tùy chọn, cần anh tự làm trên PC Nhân:
  1. Giải nén gói PostgreSQL 17 vào `%LOCALAPPDATA%\Programs\pgsql17\`.
  2. Chạy `tools\Backup-Supabase.cmd` và tự nhập mật khẩu DB vào ô ẩn.
  3. Script tự mã hóa bằng 7-Zip đã có.

### 4. Kiểm kê Storage, Auth và cấu hình — đầy đủ, đọc trực tiếp lúc 11:00
- **Storage:** 0 bucket, 0 object.
- **Trong database nhưng ngoài các bảng:**
  - Vault: 0 secret. Không có pg_cron, pg_net hay Database Webhooks.
  - Edge Functions: 0. Không có role tùy biến. Không có trigger trên `auth.users`.
  - Realtime publication: chỉ có `public.chat_messages`.
  - Extensions: pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp.
  - Grants: anon 5, authenticated 86 (bản khôi phục cũng ra **5/86**).
- **Auth:**
  - **Đăng nhập:** chỉ bật Email provider; cho đăng ký; bắt buộc xác minh email; tắt anonymous và manual linking. Không có OAuth, SSO, SAML, third-party hay custom provider. 0 MFA factor.
  - **Email provider:** secure email change bật; độ dài mật khẩu tối thiểu 8; OTP email 8 ký tự, hết hạn 3600 giây; leaked-password protection tắt.
  - **Phiên:** access token 3600 giây; phát hiện dùng lại refresh token bật, khoảng 10 giây; time-box và inactivity = 0 (gói Free). 12 phiên đang hoạt động không được sao lưu; khi khôi phục, người dùng đăng nhập lại.
  - **Bảo vệ:** CAPTCHA tắt, Auth Hooks không có.
  - **Rate limit:** email 30/giờ, SMS 30, refresh token 150, verify 30, anonymous 30, sign-in/sign-up 30, web3 30. Khoảng cách tối thiểu mỗi người dùng 60 giây. IP forwarding tắt.
  - **SMTP:** Resend `smtp.resend.com:465`, user `resend`, `no-reply@mail.xuongphim.ai`, tên "xưởng phim". Mật khẩu **không lưu**.
  - **URL:** Site URL = preview cũ, 6 Redirect URL (liệt kê đủ trong gói).
  - **Mẫu email:** "Confirm sign up" và "Reset password" trên Supabase **trùng từng ký tự** với `docs/email-templates/*.html` (đã bỏ phần comment đầu tệp; SHA-256 `71ff4c00…` và `a85182c5…`). Các mẫu còn lại giữ mặc định.
- **Ghi nhận:** alias RC `release-xuongphim-l4-rc1` **chưa có** trong Redirect URLs.
  - Hiện chưa ảnh hưởng: email đăng ký/đặt lại đã nghiệm thu trên alias Level 4.
  - Khi phát hành, sẽ thêm `https://www.xuongphim.ai/?auth=confirm|recovery|callback` theo bước R-Supabase đã lên kế hoạch.
  - Không đổi lúc này, theo chỉ thị.

### 5. Khôi phục từ chính tệp backup cuối — PASS
- **Quy trình:**
  1. Xóa sạch mọi bản tạm trong container.
  2. Lấy **tệp `_final.zip` từ PC Nhân**; SHA-256 trùng.
  3. Giải mã bằng libarchive: mật khẩu sai bị từ chối; 5/5 tệp khớp `SHA256SUMS`; tệp zip không còn chuỗi email ở dạng rõ.
  4. Tạo DB cô lập mới, áp shim và 10 migration, chạy `restore-logical-backup.sql` **lấy từ trong gói**.
- **So sánh với Supabase thật bằng `tools/schema-fingerprint.sql` (mới): 35/35 hạng mục trùng.**

| Hạng mục | Supabase = Bản khôi phục |
|---|---|
| Hàm public/private (định nghĩa đầy đủ) | 35 · `dc3627c7…` |
| Policy (nội dung USING/WITH CHECK) | 59 · `da4254ea…` |
| RLS bật | 27/27 · `eb7f03cd…` |
| Cột | 214 · `c65acbb5…` |
| Trigger | 9 · `8364ddb2…` |
| Dữ liệu 27 bảng (số dòng + md5 nội dung) | trùng toàn bộ |
| Tổng số dư ví / từng ví | 60 · `06d7514f…` |
| Ví lệch sổ cái | 0 |
| auth.users | 6 · `f91e6ea5…` |

- **Realtime:** trên PostgreSQL cục bộ, publication không có sẵn. Đã tạo publication rồi chạy lại đoạn mã của migration 4.2 → `public.chat_messages` được thêm đúng như trên Supabase.
- **Nghiệp vụ trên DB khôi phục** (danh tính qa1, sau đó rollback):
  - Chỉ thấy ví của mình (30 điểm).
  - Mở lại tập đã mua → `already_unlocked`, không trừ điểm lần hai.
  - Sửa trực tiếp `wallets` → `permission denied`.
- **Dọn dẹp:** đã drop DB cô lập; đã shred bản giải mã và tệp khóa trong container.

### 6. Chính sách riêng tư
- `chinh-sach.html` giữ nguyên nội dung đã đối chiếu với hệ thống thật.
- 3 ô pháp lý **để trống có đánh dấu**, chờ anh xác nhận:
  1. Người chịu trách nhiệm.
  2. Email hỗ trợ.
  3. Số ngày lưu nhật ký sau khi xóa tài khoản.
- Có test chặn phát hành khi còn ô trống.

### Kết luận
| Hạng mục | Trạng thái |
|---|---|
| **BACKUP CREATED** | **YES**: bản sao lưu logic từ Supabase thật (27 bảng + 6 tài khoản), lưu ở `backups\supabase\afn_supabase_backup_20261101_final.zip` trên PC Nhân, ngoài Git repo |
| **BACKUP ENCRYPTED** | **YES**: AES-256 (mở bằng 7-Zip đã có trên máy); mật khẩu chỉ gửi anh, không nằm trong repo, log hay cạnh tệp |
| **RESTORE FROM FINAL BACKUP** | **PASS**: 35/35 hạng mục schema, RLS, policy, dữ liệu, số dư ví trùng Supabase |
| **AUTH/CONFIG INVENTORY** | **COMPLETE**: đọc trực tiếp Dashboard và SQL; chỉ các bí mật (SMTP key, JWT, mật khẩu DB) cố ý không lưu |
| **PRIVACY POLICY** | **NEEDS OWNER INPUT**: 3 thông tin pháp lý |
| **PRODUCTION RELEASE** | **NOT READY**: chờ 3 thông tin chính sách (→ RC3 chỉ đổi `chinh-sach.html`), rồi phê duyệt R1–R7 |

Giới hạn còn lại: bản sao lưu không gồm mật khẩu đã băm. Nếu phải khôi phục, người dùng dùng "Quên mật khẩu". Bản pg_dump đầy đủ là tùy chọn và cần anh tự nhập mật khẩu DB.

---

## Cập nhật 01/11/2026 10:50 — RC2: sao lưu Supabase thật, thử khôi phục, chính sách

Không merge main, không sửa DNS, không dọn dữ liệu QA, không triển khai Production. Supabase chỉ nhận **câu SELECT** (không đổi schema hay dữ liệu).

### 1–2. PostgreSQL 17 client trên PC Nhân
- Đã rà `C:\Program Files`, `C:\Program Files (x86)`, `%LOCALAPPDATA%\Programs`, `C:\Tools`, `C:\`: **không có** pg_dump, pg_restore hay psql nào.
- **Chưa cài được từ phía Claude:**
  - Phiên này không có shell trên PC Nhân (chỉ đọc và ghi file).
  - Máy chủ đám mây không tải được gói Windows của EDB hay postgresql.org (proxy chặn, 403).
- **Việc cần anh làm:**
  - Tải "PostgreSQL 17 Windows x64 binaries (zip)" từ https://www.enterprisedb.com/download-postgresql-binaries.
  - Giải nén vào `%LOCALAPPDATA%\Programs\pgsql17\`. Thư mục này **ngoài Git repo**; script tự tìm ở đây hoặc theo biến `AFN_PGBIN`.
- Sao lưu dưới đây **không phụ thuộc** bước này.

### 4. Rà soát `Backup-Supabase.cmd` / `backup-supabase.ps1`
- **Không phá dữ liệu:** chỉ có `pg_dump`, `pg_restore --list` (đọc file cục bộ) và 1 câu SELECT đếm dòng. Không có drop, truncate, delete hay restore lên Supabase.
- **Không lộ mật khẩu:** nhập qua ô ẩn; không có `Start-Transcript`; không ghi chuỗi kết nối ra tệp.
- **Đã sửa 3 điểm:**
  1. Mật khẩu giờ chỉ được giải mã **bên trong** `try/finally`. BSTR được xóa ngay, `PGPASSWORD` được gỡ và `SecureString` được hủy kể cả khi lỗi.
  2. Có 7-Zip thì tự **mã hóa AES-256 (.7z, mã hóa cả tên tệp)**. 7-Zip tự hỏi mật khẩu, script không thấy mật khẩu. Kiểm tra giải mã đạt thì mới xóa bản chưa mã hóa do chính script vừa tạo. `row_counts`/`SHA256SUMS` được giữ cạnh tệp. Chưa có 7-Zip thì hiện cảnh báo rõ.
  3. Tìm pg_dump ở thư mục công cụ ngoài repo trước.
- `backups/`, `tools/pgsql/` vẫn nằm trong `.gitignore`. Không có binary, mật khẩu hay bản sao lưu nào trong Git.

### 5. Sao lưu Supabase thật (kết nối chỉ đọc qua Supabase MCP)
- **Phương pháp:**
  - Một câu `SELECT json_build_object(...)` lấy toàn bộ **27 bảng public** cùng `auth.users` và `auth.identities`.
  - Với `auth`, chỉ lấy các cột không bí mật: id, email, thời điểm xác minh, metadata, `created_at`, `last_sign_in_at`.
  - **Không lấy** mật khẩu đã băm hay token. Sau khi khôi phục, người dùng đặt lại mật khẩu bằng "Quên mật khẩu".
- **Thời điểm:** `2026-11-01T03:39:41Z` (10:39 giờ VN).
- **Toàn vẹn khi tải về:** md5 do máy chủ tính `d09517ca…86ee` **trùng** md5 của tệp nhận về. Độ dài 29.621 ký tự cũng trùng.
- **Số dòng:**
  - Có dữ liệu: admin_audit_log 21, chat_messages 18, chat_reports 5, content_entitlements 2, daily_checkins 5, episode_sources 3, network_staff 1, profiles 1, reward_rules 1, site_episodes 3, site_films 1, site_memberships 1, site_staff 6, viewer_preferences 1, viewer_profiles 4, wallet_ledger 9, wallets 5.
  - Tài khoản: auth.users 6, auth.identities 6.
  - 10 bảng còn lại: 0.
- **Lỗi phát hiện và đã sửa trong quá trình này:**
  - Lần xuất đầu dùng `query_to_xml/xpath`. Cách này **giữ nguyên ký tự thoát XML**, nên `<b>` thành `&lt;b&gt;`.
  - Lần thử khôi phục bắt được lỗi: checksum `chat_messages` lệch đúng 1 dòng (tin QA chứa HTML).
  - Bản đó đã bị hủy và xuất lại bằng JSON trực tiếp.
- **Phạm vi:** đây là bản sao lưu **logic dữ liệu**.
  - Schema tái tạo từ `db/*.sql`; đã đối chiếu fingerprint (35 hàm, 59 policy) ở vòng trước.
  - Bản `pg_dump` đầy đủ (gồm mật khẩu đã băm) vẫn chờ anh cài client 17.

### 6. Lưu trữ có mã hóa
- **Vị trí:** `C:\Users\PC\Downloads\WEB_PHIM_AI\WEB_PHIM_AI\backups\supabase\afn_supabase_backup_20261101.zip`.
  - Nằm ngoài repo `source-level4`. Không thấy dấu hiệu thư mục này được Syncthing đồng bộ.
  - Kích thước 10.179 byte; SHA-256 `8ac505510a3c9e7efd30941d5e4a11ba918f642ff7948931d2035b673e0ce522`.
- **Mã hóa:** **AES-256 (WinZip AE-2)**, mở bằng 7-Zip.
  - Mật khẩu ngẫu nhiên khoảng 148 bit, gửi riêng cho anh trong chat một lần. **Không nằm** trong báo cáo, repo hay cạnh tệp. Bản trong container đã xóa.
- **Nội dung gói:**
  - `afn_data_20261101.json`
  - `restore-logical-backup.sql`
  - `row_counts.txt`
  - `auth_storage_inventory.json`
  - `README_KHOI_PHUC.txt`
  - `SHA256SUMS.txt`
- **Kiểm chứng:**
  - Đọc lại tệp từ PC: SHA-256 trùng từng byte.
  - Giải mã độc lập bằng **libarchive** (engine của bsdtar): SHA-256 cả 6 tệp khớp.
  - Sai mật khẩu → `Incorrect passphrase`.
  - Không còn chuỗi email ở dạng rõ trong tệp zip.
- **Dọn container:** đã xóa (shred) bản JSON chưa mã hóa và đã drop DB thử khôi phục.
- **Kiểm soát truy cập:** phiên này không đặt được ACL NTFS (không có shell). Khuyến nghị:
  - Chép thêm 1 bản ra ổ ngoài hoặc kho lưu trữ đám mây riêng (tệp đã mã hóa).
  - Lưu mật khẩu vào trình quản lý mật khẩu.

### 7. Thử khôi phục vào database cô lập — PASS
- **Môi trường:** PostgreSQL cục bộ trong container, DB mới `afn_restore_real`. Không kết nối tới Supabase.
- **Các bước:**
  1. Áp shim và 10 migration theo `tests/sql/run.sh`.
  2. Chạy **`tools/restore-logical-backup.sql`** (công cụ mới, không chứa dữ liệu). Script này:
     - tự dừng nếu DB đích đã có dữ liệu (đã thử chạy lần 2 → `STOP`);
     - nạp với `session_replication_role=replica`;
     - đặt lại sequence.
- **Kết quả:**
  - **27/27 bảng khớp checksum nội dung** với Supabase (md5 của từng dòng JSON đã sắp xếp, tính ở cả hai phía).
  - auth.users 6.
  - Ví = tổng sổ cái (0 lệch).
  - RLS 27/27, 59 policy.
  - Không có báo cáo mồ côi.
  - Sequence audit tiếp tục ở 104.
- **Chạy thử nghiệp vụ** trên DB khôi phục, bằng danh tính qa2, sau đó rollback:
  - Điểm danh nối chuỗi **ngày 2** (+12 điểm, số dư 22).
  - RLS chỉ cho thấy 1 ví (ví của qa2).
  - Mở khóa tập 30 điểm → `insufficient`.

### 8. Kiểm kê Storage và Auth (lưu trong gói, không có bí mật)
- **Storage:** 0 bucket, 0 object (storage.migrations 74). Không có tệp nào cần sao lưu.
- **Auth cần cấu hình lại tay khi khôi phục:**
  - Email provider, xác minh email bật. Không bật provider khác.
  - Site URL đang là preview cũ (đổi sang `https://www.xuongphim.ai` khi phát hành).
  - 6 Redirect URL, chỉ có preview.
  - SMTP Resend: `smtp.resend.com:465`, user `resend`, người gửi `no-reply@mail.xuongphim.ai`. **Mật khẩu/API key không lưu**, khi khôi phục phải tạo key mới.
  - Rate limit: email 30/giờ, refresh 150/5 phút, verify 30, OTP 30, anonymous 30, sms 30, web3 30. SMTP tần suất tối thiểu 60 giây.
  - Mẫu email nằm ở `docs/email-templates/`.
  - Leaked-password protection và CAPTCHA đang tắt.
- **DNS Resend:** 3 bản ghi (đã liệt kê ở mục 31/10 23:55).

### 9. Chính sách riêng tư
- Nội dung `chinh-sach.html` khớp hệ thống thật, đã nêu Resend.
- Vẫn còn **3 ô cần chủ website điền**. Claude không tự điền:
  1. Đơn vị hoặc cá nhân chịu trách nhiệm.
  2. Email hỗ trợ.
  3. Số ngày lưu nhật ký sau khi xóa tài khoản.
- Có test chặn phát hành khi còn ô trống. Trang giữ noindex.

### 10. Kiểm thử chạy lại
- E2E **76/76**
- contract **11/11**
- site-config **8/8**
- SQL functional **133**, concurrency/staging **13/13**
- Mã website RC2 (`ffb68f8`) không đổi trong vòng này; chỉ thay đổi công cụ sao lưu và báo cáo.

### Kết luận
| Hạng mục | Trạng thái |
|---|---|
| **RC2 QA** | **PASS**: thay đổi RC2 đã kiểm chứng thật (khóa chat phòng phim 2,7 giây, mở 1,0 giây); toàn bộ test xanh |
| **SUPABASE BACKUP** | **VERIFIED** (bản logic dữ liệu: 27 bảng + tài khoản, md5 khớp máy chủ, mã hóa AES-256, lưu ngoài repo). Giới hạn: không gồm mật khẩu đã băm; bản pg_dump đầy đủ chờ cài client 17 |
| **RESTORE TEST** | **PASS**: 27/27 bảng khớp checksum, nghiệp vụ chạy đúng trên DB khôi phục |
| **PRIVACY POLICY** | **NEEDS OWNER INPUT**: 3 thông tin ở mục 9 |
| **PRODUCTION RELEASE** | **NOT READY**: chờ 3 thông tin chính sách (→ RC3 chỉ đổi `chinh-sach.html` và smoke test), rồi phê duyệt R1–R7 (dọn QA, tạo project `xuongphim-ai`, URL Supabase production, chuyển tên miền) |

---

## Cập nhật 01/11/2026 02:10 (vòng 2) — RC1 QA Admin, alias ổn định, sao lưu, chính sách

### Alias Preview ổn định (anh đã đồng ý)
- Thêm nhánh `release/xuongphim-l4-rc1` vào danh sách Preview của `web-phim-ai-5sites`. Production branch vẫn là `main` (đã đọc lại cấu hình), Production deployment vẫn `c6dd520`.
- Alias cố định: **`https://release-xuongphim-l4-rc1.web-phim-ai-5sites.pages.dev`**, luôn trỏ vào commit mới nhất của nhánh RC. qaadmin đăng nhập ở đây **một lần** và giữ được phiên qua các vòng RC.
- Nhánh này là **kênh Release Candidate cố định**; số RC được xác định bằng commit (RC1 = `27760a4`, RC2 = `ffb68f8`).

### Phiên QA vòng này
- Tái sử dụng **3 phiên hợp lệ**: signup1 (alias Level 4), qa2 (`0d8d5ae6`), qaadmin (alias RC sau khi đăng nhập). **0 phiên hết hạn.**
- Anh đăng nhập **1 lần** (qaadmin), vì không còn phiên qaadmin ở bất kỳ origin nào.

### RC1 QA Admin (mã RC1 `27760a4` trên alias RC, hash 6 tệp JS khớp)

| Kiểm thử | Kết quả | Bằng chứng |
|---|---|---|
| Nút kiểm duyệt trong khung chat | PASS | Tin của qa2 có "Báo cáo · Ẩn · Khóa chat 24h"; "3 người đang xem" |
| Ẩn tin trong khung chat | **PASS** | Toast "Đã ẩn tin nhắn."; qaadmin thấy nhãn "Đã ẩn"; khung chat của signup1 mất tin sau **1,16 giây** |
| Khóa chat trong khung chat (dòng mã mới của RC1) | **PASS** | Toast "Đã khóa chat…"; khung chat của qa2 bị khóa sau **1,22 giây**, banner "tạm khóa chat đến 01:59 02-11"; gửi qua RPC → `chat_muted` |
| Mở khóa từ Dashboard | PASS phía máy chủ | "Đã mở khóa chat."; bảng khóa rỗng. **Phát hiện:** qa2 đang ở **phòng phim** nên phải chờ **13,6 giây** (lần đồng bộ định kỳ) mới mở lại |
| Nhật ký kiểm duyệt | **PASS** | `chat.hide` (xuongphim) 01:59:25, `chat.mute` 01:59:39, `chat.unmute` 02:00:01, đúng actor qaadmin và lý do. Site admin chỉ đọc được dòng của site mình (`chat.hide`); dòng cấp mạng do chủ đọc |
| Giới hạn quyền qaadmin | **PASS** | khóa chat chủ → `forbidden`; tự khóa → `cannot_mute_self`; cộng điểm → `forbidden`; đổi quy tắc điểm danh → `forbidden`; xem tổng quan hay ví khophim → `forbidden`; tự thêm `network_staff` hay `site_staff` → `permission denied`; tổng quan xuongphim → ok |

### Lỗi mới và bản sửa → RC2 `ffb68f8`
- **Lỗi:** khóa và mở khóa trên Dashboard chỉ báo cho phòng chung, nên thành viên đang chat ở **phòng phim** bị trễ tới 45 giây.
- **Sửa:** thêm kênh kiểm duyệt toàn mạng `chat:moderation`. Mọi khung chat đều nghe kênh này; Dashboard và nút khóa trong khung chat đều phát lên đó.
- **Kiểm thử tự động:** thêm 1 E2E (đã xác nhận **thất bại trên mã RC1**); E2E **76/76**; contract 11/11; site-config 8/8; CI xanh.
- **Kiểm chứng thật trên RC2** (alias RC và alias Level 4 đều chạy `ffb68f8`, hash khớp):
  - qaadmin bấm "Khóa chat 24h" trên Dashboard → khung chat **phòng phim** của signup1 bị khóa sau **2,7 giây**.
  - Bấm "Mở khóa" → mở lại sau **1,0 giây**.
- RC2 khác RC1 ở `community-chat.js`, `studio-ops.js`, `chinh-sach.html` (thêm Resend và các ô chủ website cần điền), công cụ và test. `app.js`, `auth.js`, `rewards.js`, `afn-core.js` giữ nguyên, nên điểm danh, mở khóa và email đã nghiệm thu không bị ảnh hưởng.

### Sao lưu Supabase bằng pg_dump (PC Nhân)
- **Supabase là PostgreSQL 17.11** (CSDL 14 MB, extensions: plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault). Cần **pg_dump 17**.
- **PC Nhân chưa có PostgreSQL client** (`C:\Program Files` không có thư mục PostgreSQL).
- **Công cụ:** `tools/Backup-Supabase.cmd` → `tools/backup-supabase.ps1`.
  - Tìm pg_dump 17 trong `tools\pgsql\bin` (gói zip chính thức của EDB, giải nén tại chỗ, đã nằm trong `.gitignore`) hoặc trong PATH; dừng nếu phiên bản thấp hơn 17.
  - Mật khẩu nhập qua ô ẩn, chỉ đặt `PGPASSWORD` cho tiến trình rồi xóa; dùng `PGSSLMODE=require`; không ghi chuỗi kết nối ra log hay tệp.
  - Kết quả trong `backups\afn_<thời điểm>\`:
    - `schema_app.sql` (public và private)
    - `data_app.dump` (định dạng custom)
    - `data_auth.dump` (`auth.users`, `auth.identities`)
    - `row_counts.txt`
    - `SHA256SUMS.txt`
  - Tự kiểm tra bằng `pg_restore --list`.
- **Diễn tập khôi phục (cục bộ, PG16, CSDL kiểm thử Level 4):** dump bằng đúng các lệnh của script, khôi phục vào CSDL trống có shim Supabase.
  - Khôi phục được 27 bảng dữ liệu, **RLS 27/27, 59 policy**, số dòng ledger, users và films **khớp tuyệt đối**.
  - Lỗi duy nhất là `schema "public" already exists`, vô hại.
- **Phạm vi:**
  - Có: schema và dữ liệu app (public, private), tài khoản (auth.users, auth.identities).
  - Không có trong dump, đã lưu ở nơi khác:
    - Migration: thư mục `db/` trong repo.
    - Mẫu email: `docs/email-templates/`.
    - Cấu hình Auth (SMTP, Site URL, Redirect URLs, rate limit): danh sách giá trị ở mục 01/11 02:00.
    - Publication Realtime của `chat_messages`: nằm trong migration 4.2.
    - DNS Resend: Cloudflare.
- **Khôi phục khi có sự cố:**
  1. Tạo project mới.
  2. Áp migration trong `db/` theo thứ tự (hoặc `schema_app.sql`).
  3. `pg_restore --data-only data_auth.dump`, rồi `pg_restore --data-only --disable-triggers data_app.dump`.
  4. Đối chiếu `row_counts.txt`.
  5. Cấu hình lại Auth theo danh sách.
- **Chưa VERIFIED trên Supabase thật:** cần anh tải gói pg_dump 17 và chạy script một lần với mật khẩu CSDL. Claude không có mật khẩu CSDL và không được nhập.

### Chính sách riêng tư (`chinh-sach.html`)
- Đã rà nội dung đối chiếu với hệ thống thật. **Đã bổ sung** việc gửi email qua Resend (từ `no-reply@mail.xuongphim.ai`), trước đây chưa nêu.
- Đánh dấu **chính xác 3 thông tin chủ website phải cung cấp** (`data-owner-input`, có test chặn):
  1. **`controller`**: tên cá nhân hoặc đơn vị chịu trách nhiệm xử lý dữ liệu.
  2. **`contact-email`**: email hỗ trợ và yêu cầu về dữ liệu.
  3. **`retention`**: số ngày lưu nhật ký giao dịch điểm và kiểm duyệt sau khi xóa tài khoản.
- Trang vẫn là **bản nháp, giữ noindex**. Khuyến nghị nhờ tư vấn pháp lý duyệt (Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân).

### Kế hoạch phát hành độc lập (đã rà lại)
- Không thay đổi: project riêng `xuongphim-ai`, production branch là nhánh RC (nay ở `ffb68f8`), chuyển đúng 2 tên miền xuongphim, 4 site còn lại giữ `c6dd520` trên project cũ.
- Đã xác minh: 4 zone kia (khophim, phephim, phimhay, ghienphim) không có redirect rule hay DNS liên quan tới xuongphim, nên chuyển tên miền xuongphim không chạm vào chúng.
- Điều kiện tự dừng ở mục 02:10 §D vẫn áp dụng. Thêm điều kiện: hash JS trên `xuongphim-ai.pages.dev` phải khớp commit RC đã duyệt.

### Kết luận vòng này

| Hạng mục | Trạng thái |
|---|---|
| **RC1 QA ADMIN** | **PASS** (ẩn tin, khóa/mở khóa, audit, giới hạn quyền trên mã RC1; độ trễ mở khóa ở phòng phim đã sửa ở RC2 và kiểm chứng thật) |
| **BACKUP** | **NOT VERIFIED**: công cụ pg_dump 17 sẵn sàng và đã diễn tập khôi phục cục bộ, nhưng chưa chạy với Supabase thật (cần gói pg_dump 17 và mật khẩu CSDL do anh nhập) |
| **PRIVACY POLICY** | **BLOCKED**: thiếu 3 thông tin chủ website (người chịu trách nhiệm, email liên hệ, thời hạn lưu) |
| **PRODUCTION RELEASE** | **NOT READY**: chờ BACKUP VERIFIED và PRIVACY POLICY READY; sau đó tạo RC3 (chỉ đổi `chinh-sach.html`) và smoke trên alias RC |


## Cập nhật 01/11/2026 02:10 — FINAL RELEASE CANDIDATE AUDIT (`release/xuongphim-l4-rc1`)

### A. Đối chiếu RC1

- `release/xuongphim-l4-rc1` = **`27760a4`**.
- So với nhánh Level 4 (`5ba11c2`), RC1 chỉ khác ở `docs/` và bộ sinh test staging; **không khác dòng mã chạy nào**.
- RC1 chứa đủ các bản sửa đã nghiệm thu: `44df4cb` (request ví), `47119b7` (client dùng chung, UX, SEO), `0897e31` và `0f18701` (kiểm duyệt chat tức thì), `f03d95b` và `5bc36b9` (email/đăng ký/đặt lại mật khẩu).
- Cloudflare Preview:
  - `b2cb38aa` (commit 27760a4) và `d14d6d23` (5ba11c2): SHA-256 của 6 tệp JS chính **trùng nhau và trùng `git show 27760a4`**.
  - Cloudflare tự tạo bản `329c9ff9` cho nhánh `release/…`, ở trạng thái *idle* vì nhánh không nằm trong danh sách Preview. **Không ảnh hưởng Production.**
- `auth.js` và `afn-core.js` giữ nguyên từ `5bc36b9` đến RC1 (`de1a8e3…`, `e45226f8…`). Vì vậy các lần kiểm thử email thật lúc 01:09–01:25 chạy **đúng mã RC1**.

### B. Kiểm thử lại trên RC1 (Real User)

| Luồng | Kết quả | Bằng chứng |
|---|---|---|
| Đăng nhập | **PASS** | `+signup1` đăng nhập trên alias đang chạy mã RC1 (hash khớp) |
| Điểm danh | **PASS** | Ô điểm 0 → 10, toast "+10 điểm · chuỗi 1 ngày"; lần 2 (xuongphim) và 3 lần đồng thời (khophim) trả `already` |
| Ví điểm | **PASS** | balance 10 = ledger; sửa ví trực tiếp bị chặn: `permission denied for table wallets` |
| Cấp điểm QA | Đã làm | `admin_adjust_points` +20 dưới danh tính chủ mạng, key `qa-test-grant-signup1-rc1`, lý do "QA TEST — RC1…" (có audit) |
| Mở khóa tập | **PASS** | Màn khóa "Tập 2 đang mở sớm với 30 điểm. Số dư của bạn: 30 điểm."; bấm 3 lần → trừ **đúng 1 lần** (30 → 0); 5 yêu cầu đồng thời → `already_unlocked:0`; 1 quyền xem, 1 dòng `unlock −30` |
| Quyền xem sau mở khóa | **PASS** | Nguồn `ok` (Sintel kèm nguồn dự phòng); player phát thật (`currentTime` 5,77 → 6,56 giây) |
| Xác thực email (đăng ký, xác minh, đặt lại mật khẩu) | **PASS** | Thực hiện 01:09–01:25 trên chính mã `auth.js` của RC1 (mục 01/11 01:09) |
| Chat theo phim 2 người (signup1 trên **RC1** ↔ qa2) | **PASS** | Hiện "2 người đang xem"; tin của signup1 tới qa2 sau **0,52 giây**; qa2 trả lời, signup1 nhận trên RC1 sau **0,76 giây**; tên hiển thị lấy từ lúc đăng ký ("hungcreator") |
| Báo cáo tin (giao diện RC1) | **PASS** | signup1 báo cáo tin của qa2 với lý do Spam, toast "Đã gửi báo cáo…"; 1 báo cáo `open` |
| Quyền thành viên trên RC1 | **PASS** | ẩn tin, khóa chat, xem danh sách báo cáo → `forbidden`; insert giả mạo → `permission denied`; tin người khác chỉ có nút "Báo cáo" |
| Chống spam trên RC1 | **PASS** | trùng → `chat_duplicate`; trống → `empty_message`; quá 5 tin/30 giây → `chat_rate_limited` |
| Kiểm duyệt (qaadmin) trên RC1 | **Chờ 1 lần đăng nhập** | Xem mục E |

### E. Quản lý phiên QA (tái sử dụng, không bắt đăng nhập lại)

**Kiểm kê thực tế** (dùng `auth.getUser()` phía máy chủ, không đọc hay in token):

| Origin | Mã | Tài khoản | Trạng thái |
|---|---|---|---|
| alias `feature-master-site-xuongphi` | **RC1** (hash khớp) | `+signup1` | AUTHENTICATED (còn khoảng 52 phút, tự refresh) → **đã dùng làm thành viên A trên RC1** |
| `0d8d5ae6` | 0897e31 (chat cũ) | `+qa2` | AUTHENTICATED → **đã dùng làm thành viên B** |
| `c2c36a78` | ca130ed | `+qa2` | AUTHENTICATED (dự phòng) |
| `a674307d`, `1d159f95`, `d05fc4d1` | bản cũ | `+qa1` | AUTHENTICATED (không cần cho RC1) |
| `b2cb38aa` (RC1), `d14d6d23` (= RC1) | RC1 | — | NO SESSION |
| (mọi origin) | — | `+qaadmin` | **NO SESSION**: phiên qaadmin nằm ở alias và đã bị thay khi anh đăng nhập signup1 ở tab đó |

**Nguyên nhân kỹ thuật** khiến phải đăng nhập lại nhiều lần:
- Phiên Supabase lưu theo **origin** (localStorage, `storageKey afn-film-auth-v1`).
- Mỗi lần deploy, Cloudflare tạo một origin mới (`<hash>.pages.dev`), nên phiên cũ không theo sang.
- Chỉ alias của nhánh giữ nguyên origin, nhưng một origin chỉ chứa được một tài khoản.
- Chuyển token giữa các origin là **giả mạo phiên**, nên không làm.

**Cách giảm thao tác cho các vòng sau** (đề xuất, chưa làm):
- Tạo 3 nhánh alias cố định `qa/member-a`, `qa/member-b`, `qa/admin`, cùng trỏ vào commit cần kiểm thử, và thêm vào danh sách Preview. Mỗi tài khoản QA có một origin ổn định; mỗi vòng chỉ cần push nhánh, phiên được giữ nguyên.
- Thay đổi này là cấu hình Preview của Cloudflare, không đụng Production, nhưng cần anh đồng ý.

**Thống kê vòng này:**
- Tái sử dụng **2 phiên hợp lệ** (signup1, qa2).
- **0 phiên hết hạn.**
- Cần anh xác thực đúng **1 lần** (qaadmin), vì không còn phiên qaadmin nào và không được dùng tài khoản chủ thay thế.

**Phạm vi phải kiểm lại trên RC1:**
- `studio-ops.js` (Dashboard kiểm duyệt) của RC1 **trùng hash** với bản đã nghiệm thu thật lúc 23:30 (`46d1de7a…`).
- `community-chat.js` của RC1 chỉ thêm **1 dòng** so với bản đã nghiệm thu: phát tín hiệu khi khóa chat **ngay trong khung chat**.
- Vì vậy chỉ cần kiểm lại kiểm duyệt với **mã RC1**: ẩn tin, khóa và mở khóa (cả trong khung chat và trong Dashboard), audit log, giới hạn quyền của qaadmin.

### C. Phát hiện mới

1. **Supabase gói Free không có sao lưu tự động.** Trang Backups ghi "Free Plan does not include project backups".
   - Production sẽ có điểm thưởng và quyền xem thật, nên **phải có bản sao lưu trước khi phát hành**.
   - Đã chuẩn bị `tools/Backup-Supabase.cmd` + `tools/backup-supabase.ps1`: hỏi chuỗi kết nối (không lưu), dùng `supabase db dump` xuất schema, dữ liệu public/private và auth vào `backups/`. Thư mục này đã nằm trong `.gitignore`.
   - Lựa chọn khác: nâng Pro (khoảng 25 USD/tháng, có 7 ngày backup và PITR tùy chọn). **Cần anh quyết.**
2. **Repo GitHub đang PUBLIC.**
   - Đã quét RC1: không có secret, service key, chuỗi kết nối hay API key. Publishable key được phép công khai.
   - Tuyệt đối không đưa bản sao lưu lên repo.

### D. Kế hoạch phát hành từng bước, có kiểm tra và điều kiện tự dừng

| Bước | Việc | Kiểm tra trước | Kiểm tra sau | **TỰ DỪNG khi** |
|---|---|---|---|---|
| R0 | Anh phê duyệt R1–R7 | Báo cáo này | — | Thiếu phê duyệt bất kỳ mục nào |
| R1 | **Sao lưu CSDL** (`Backup-Supabase.cmd`, anh chạy) | `auth.users` = 6 | 3 tệp `.sql` > 0 byte | Lệnh dump lỗi hoặc tệp rỗng |
| R2 | Dọn QA: `58_qa_backup.sql` → `59_qa_cleanup.sql` (chạy thử → chạy thật) → anh xóa 4 tài khoản QA | Chạy thử khớp: 4 tài khoản QA, dữ liệu người khác = 0 | `site_films` = 0, `site_staff` QA = 0, ví và lượt điểm danh của chủ không đổi (10 / 1) | Chạy thử khác số đã duyệt, hoặc đụng dữ liệu không phải QA |
| R3 | RC2 = RC1 + email liên hệ trong `chinh-sach.html` (đổi đúng 1 tệp) | Anh gửi email | CI xanh; diff RC1..RC2 chỉ có `chinh-sach.html` | Diff có tệp khác |
| R4 | Tạo Pages project `xuongphim-ai` (production branch `release/xuongphim-l4-rc1`) | Project cũ: 10 tên miền active | `xuongphim-ai.pages.dev`: 200, có header CSP/HSTS, hash JS = RC | Build/deploy lỗi, hoặc hash khác RC |
| R5 | Supabase: thêm Redirect URLs `https://www.xuongphim.ai/?auth=confirm\|recovery\|callback` (giữ URL Preview), đổi Site URL thành `https://www.xuongphim.ai`, tên người gửi "Xưởng Phim" | Ghi lại giá trị cũ | Đọc lại cấu hình | Lưu lỗi |
| R6 | **Chuyển 2 tên miền** `xuongphim.ai` và `www` sang `xuongphim-ai` | R1–R5 xong; khophim.ai trả bản `c6dd520` | Cert active; `www.xuongphim.ai` trả hash RC; 4 site kia **không đổi** | Cert lỗi quá 15 phút, 5xx, hoặc bất kỳ site nào trong 4 site kia thay đổi → **rollback ngay** |
| R7 | Smoke test 10 bước (mục 01/11 02:00 §7) và theo dõi 24 giờ | — | Đăng ký, email, điểm danh, mở khóa, chat, kiểm duyệt trên tên miền thật | Bất kỳ bước nào FAIL → rollback frontend (R-FE) |

**Rollback frontend (R-FE, khoảng 5 phút):**
1. Gỡ 2 tên miền khỏi `xuongphim-ai`, gắn lại vào `web-phim-ai-5sites`.
2. Kiểm tra CNAME trỏ về `web-phim-ai-5sites.pages.dev`.
3. Kiểm tra `www.xuongphim.ai` trả bản `c6dd520`.
- Không cần đổi `main`. Pages giữ lịch sử các bản deploy (4f786bd6, 29604a78).

**Sự cố CSDL: không xóa dữ liệu giao dịch.**
- Ledger, quyền xem và lượt điểm danh là dữ liệu **chỉ thêm**, không bao giờ xóa hay sửa tay.
- Lỗi điểm danh: tắt bằng `admin_set_reward_rules(false, …)` (có audit).
- Lỗi mở khóa hoặc video: gỡ phát hành tập và hoàn điểm bằng `admin_refund_unlock` (có audit, ghi dòng `refund`).
- Cộng hoặc trừ sai: dùng `admin_adjust_points` với lý do (ghi dòng bù, không sửa dòng cũ).
- Lỗi chat: ẩn tin, khóa chat; hoặc gỡ các nút chat ở frontend (rollback R-FE).
- Lỗi schema nghiêm trọng: khôi phục từ bản dump R1 vào **project mới** (Restore to new project), đối chiếu rồi chuyển. **Không** chạy `99_rollback_level4.sql` khi đã có dữ liệu thật.


## Cập nhật 01/11/2026 02:00 — LEVEL 4 PRODUCTION RELEASE PREPARATION (Xưởng Phim)

> **Chưa merge `main`, chưa deploy Production, chưa sửa DNS, chưa xóa dữ liệu QA, chưa phát sinh chi phí.** Dừng ở cổng phê duyệt.

### 1. Phiên bản (Release Candidate)

| Mục | Giá trị |
|---|---|
| Repo / nhánh phát triển | `HUNG2NAO/web-phim-ai` · `feature/master-site-xuongphim-2026-10-31` (git status sạch, HEAD = origin) |
| **RC1 (mã nguồn)** | commit **`27760a4`**, ghim bằng nhánh **`release/xuongphim-l4-rc1`**. Proxy chặn đẩy tag, nên dùng nhánh thay tag. Commit sau RC chỉ sửa tài liệu |
| Preview của RC | `https://b2cb38aa.web-phim-ai-5sites.pages.dev` và alias `feature-master-site-xuongphi…`, deploy `success` |
| Khớp mã nguồn ↔ Preview | SHA-256 của `app.js`, `auth.js`, `community-chat.js`, `afn-core.js`, `rewards.js`, `studio-ops.js` tải từ Preview **trùng 100%** với `git show 27760a4` |
| CI trên RC | Cloudflare Pages ✓, SQL security & concurrency ✓, Contract + Chromium E2E ✓ |
| So với Production (`main` `c6dd520`) | 164 commit, 99 tệp (+12.100 / −54 dòng) |
| Chuỗi PR | #3 → #4 → #5 → #6 → #7 → #8 → #9 (đều draft), **tất cả đã nằm trong RC**. PR #1 (`ops/cloudflare-pages-migration`) chỉ thêm `DEPLOY_CLOUDFLARE.md`, không ảnh hưởng phát hành |
| Shared Core | `sites.js` (5 thương hiệu), `afn-core.js` (một client Supabase dùng chung), site-config test 7/7 (đã thêm kiểm tra cổng lập chỉ mục) |

### 2. Sửa lỗi an toàn trong RC (commit `27760a4`)

1. **Canonical sai tên miền.** Cloudflare có Redirect Rule "Canonical www HTTPS for xuongphim.ai" chuyển 301 từ `xuongphim.ai` sang `https://www.xuongphim.ai`. Canonical, og:url và sitemap trước đây trỏ về apex, tức là trỏ vào một địa chỉ chuyển hướng. Nay dùng `https://www.<domain>`, trùng với `AFN.filmUrl`.
2. **Cổng lập chỉ mục.** `functions/_site.js` có `INDEXABLE = new Set([])`. Khi chưa được duyệt, tên miền thật trả robots `Disallow: /` và sitemap có `X-Robots-Tag: noindex`. Thẻ `noindex` trong `index.html` giữ nguyên; test sẽ fail nếu ai mở cổng mà không gỡ noindex.
3. **Lượt xem giả.** Kho phim mẫu không còn hiển thị "2,6 triệu lượt xem". Mục "Bảng xếp hạng · Theo lượt xem" đổi thành "Phim nổi bật · Gợi ý của biên tập"; sắp xếp "Xem nhiều" đổi thành "Nổi bật". Lượt xem chỉ hiện khi dữ liệu có `viewsVerified: true`.
4. **Sao lưu QA:** thêm `db/staging/58_qa_backup.sql`. `59_qa_cleanup.sql` nay bao gồm cả `+signup1`.

### 3. Dữ liệu QA (chỉ đọc, chưa xóa)

| Tài khoản | Loại | Dữ liệu |
|---|---|---|
| `90b8b707` hung…@gmail.com | **CHỦ: giữ** | ví 10, 1 điểm danh, admin 5 site, network owner |
| `01143faf` ngos…@gmail.com | **Không phải QA: giữ, chờ anh quyết** | tạo bằng Dashboard 22:55, chưa đăng nhập, không có dữ liệu |
| `0e41cb4f` +qa1 | QA | ví 30, ledger 3, 1 điểm danh, 1 quyền xem, 7 tin chat, 1 báo cáo |
| `c4bdb583` +qa2 | QA | ví 10, 1 điểm danh, 3 tin chat, 2 báo cáo |
| `ca41544b` +qaadmin | QA | ví 10, 1 điểm danh, `site_staff(xuongphim, admin)` |
| `f183e257` +signup1 | QA | chưa có ví hay dữ liệu |

- Nội dung QA: phim `qa-test-blender-open-movies` (đã phát hành, 3 tập, 3 nguồn video Blender CC BY), 10 tin chat, 3 báo cáo chat.
- `admin_audit_log` có 15 dòng (QA + seed). **Giữ lại** vì là nhật ký kiểm toán.
- **Sao lưu:** đã chạy thử `58_qa_backup.sql` trên staging (rollback). Sẽ chép 4 tài khoản QA, ví, ledger, điểm danh, quyền xem, staff, hồ sơ người xem, 10 tin chat, 3 báo cáo, phim, tập và nguồn QA vào schema `qa_backup`. Đã xác nhận sau khi chạy thử không còn schema `qa_backup`.
- **Dọn:** `59_qa_cleanup.sql` mặc định chỉ chạy thử. Script dừng nếu có dữ liệu của người không phải QA dính vào. Xóa 4 tài khoản QA trong Dashboard sẽ tự xóa ví, ledger và điểm danh (FK cascade).

### 4. Kiểm toán Supabase (`ai-film-network`, Singapore, gói Free)

| Hạng mục | Kết quả |
|---|---|
| Có phục vụ Production? | **Không.** Nhật ký API 24 giờ: 100% referer là `*.pages.dev` (Preview), supabase.com và mail.google.com (link email). 5 tên miền thật không gọi Supabase; `main` không chứa chuỗi `supabase` |
| Auth | Email bật, cho đăng ký mới, **Confirm email bật**, ẩn danh tắt, manual linking tắt, Google tắt |
| Custom SMTP Resend | Bật; `no-reply@mail.xuongphim.ai` qua `smtp.resend.com:465`; giới hạn 30 email/giờ. Đăng ký, xác minh và đặt lại mật khẩu thật: PASS |
| Mẫu email | Tiếng Việt, liên kết token_hash (dùng được trên mọi trình duyệt) |
| Site URL | Vẫn là Preview cũ `feature-auth-first-pilot-202…`, **không đổi sang Preview** theo chỉ thị. Đổi sang `https://www.xuongphim.ai` lúc phát hành (bước R4) |
| Redirect URLs | 6 URL Preview. **Thiếu** `https://www.xuongphim.ai/?auth=confirm\|recovery\|callback`, cần thêm lúc phát hành |
| Leaked Password Protection | Tắt. Trang Attack Protection ghi "Configure in email provider"; nhiều khả năng chỉ có ở gói trả phí (cần xác nhận). Không bật được trên Free nếu đúng vậy |
| CAPTCHA | Tắt. Đề xuất bật Cloudflare Turnstile sau phát hành (P1) |
| RLS | 27/27 bảng public bật RLS; `anon` chỉ SELECT dữ liệu công khai, không INSERT được bảng nào |
| Schema đã kiểm thử ↔ staging | Fingerprint **35 hàm** public/private và **59 policy** trên staging **trùng md5** với CSDL kiểm thử cục bộ đã qua 133 + 13 bài SQL. 11 migration đã áp |
| Phân quyền | network owner: chủ. Site admin: chủ (5 site) + qaadmin (xuongphim, sẽ gỡ khi dọn QA) |
| Advisor | Security: các RPC SECURITY DEFINER là có chủ đích (tự kiểm tra `auth.uid()` và quyền, đã test); `traffic_events` không có policy (chỉ ghi qua RPC). Performance: 8 index chưa dùng, 1 bảng có 2 policy SELECT. Mức INFO/WARN, không chặn phát hành |
| Check-in, Wallet, Entitlements, Chat, Audit | Real User PASS trên Preview (mục 31/10 23:30 và 01/11). Bất biến balance = tổng ledger đúng với mọi ví |

### 5. Kiểm toán Cloudflare

| Hạng mục | Kết quả |
|---|---|
| Pages project | `web-phim-ai-5sites`, production branch **`main`** (`c6dd520`, 28/10), không có build, output `.` |
| Tên miền | 10 tên miền (5 apex + 5 www) **cùng gắn vào một project**, đều active, SSL active |
| Hệ quả | **Merge `main` sẽ cập nhật cả 5 website cùng lúc**, trái với yêu cầu chỉ phát hành Xưởng Phim. Xem kế hoạch R ở mục 7 |
| Production hiện tại | Không có CSP/HSTS/X-Frame-Options; `robots.txt` trả về HTML của SPA. RC bổ sung đầy đủ header (`_headers`) và robots/sitemap theo tên miền |
| Preview đã QA | `b2cb38aa` (RC1), có CSP, HSTS, nosniff, XFO, Referrer-Policy, Permissions-Policy; `/admin`, `/account` no-store; 404 đúng |
| Zone `xuongphim.ai` | SSL Full; Always Use HTTPS tắt, nhưng Redirect Rule đã ép `http://www` → `https://www`; TLS tối thiểu 1.0 (đề xuất 1.2) |
| DNS | Website: `xuongphim.ai` và `www` là CNAME (proxied) tới `web-phim-ai-5sites.pages.dev`. Email: 3 bản ghi Resend (DNS only), domain Verified. Không có MX hay DMARC |
| Rollback | Production cũ `c6dd520` (deployment `4f786bd6`) và trước đó `7fb08dc` vẫn còn trong lịch sử Pages, có thể rollback 1 click |

### 6. SEO và nội dung

| Hạng mục | Kết quả |
|---|---|
| URL riêng | Trang chủ `/`; phim `/phim/<id>` (302 sang `/?film=<id>`); tập `/phim/<id>/tap/<n>` |
| Canonical, OG | `https://www.xuongphim.ai/...` theo trang và theo phim (E2E và đo trên RC) |
| Sitemap | `/sitemap.xml` theo tên miền, 17 URL, dùng www; test chặn sitemap lỗi thời |
| Robots | Preview và tên miền thật đều `Disallow: /` cho tới khi mở cổng lập chỉ mục |
| 404 | `404.html` (noindex, nút về trang chủ), trả 404 thật |
| Lượt xem giả | Đã gỡ (mục 2) |
| Demo và nội dung thật | Banner "DEMO · Phim mẫu do AI tạo, chưa có video để phát" luôn hiện; `noindex` giữ nguyên |
| Quyền khai thác | Phim mẫu là ảnh AI, không có video. Phim QA dùng video Blender (CC BY) và **sẽ bị gỡ khi dọn QA**. Chưa có phim thật nào cần quyền phát hành |
| Chính sách và quy tắc | `chinh-sach.html` là **bản nháp**, còn trống email liên hệ, cần anh điền và cần pháp lý duyệt |

### 7. Kế hoạch phát hành CHỈ Xưởng Phim

**Cách làm đề xuất:** tạo **Pages project riêng** cho Xưởng Phim, rồi chuyển 2 tên miền `xuongphim.ai` và `www` sang project mới. Bốn website kia vẫn chạy `main` cũ, không bị ảnh hưởng. `main` chưa cần merge.

| Bước | Việc | Ai làm / phê duyệt |
|---|---|---|
| R0 | Anh phê duyệt kế hoạch và các mục ở dưới | Anh |
| R1 | Sao lưu và dọn dữ liệu QA: chạy `58_qa_backup.sql`, `59_qa_cleanup.sql` (chạy thử rồi mới chạy thật), xóa 4 tài khoản QA trong Dashboard | Claude chạy SQL sau khi anh duyệt; anh xóa tài khoản |
| R2 | Điền email liên hệ trong `chinh-sach.html` → RC2 (chỉ đổi tệp này) | Anh cung cấp email, Claude commit |
| R3 | Tạo Pages project `xuongphim-ai` (Git `HUNG2NAO/web-phim-ai`, production branch `release/xuongphim-l4-rc1`, không build, output `.`), kiểm tra `xuongphim-ai.pages.dev` (smoke) | Claude qua giao diện Cloudflare (miễn phí) |
| R4 | Supabase: thêm Redirect URLs `https://www.xuongphim.ai/?auth=confirm\|recovery\|callback`; đổi Site URL thành `https://www.xuongphim.ai`; sửa tên người gửi thành "Xưởng Phim" | Claude sau khi anh duyệt |
| R5 | **Chuyển tên miền:** gỡ `xuongphim.ai` và `www.xuongphim.ai` khỏi `web-phim-ai-5sites` rồi thêm vào `xuongphim-ai`. Cloudflare tự trỏ CNAME về `xuongphim-ai.pages.dev`. Có thể gián đoạn vài phút khi cấp chứng chỉ | **Thay đổi Production/DNS: cần anh duyệt riêng** |
| R6 | Smoke test trên `https://www.xuongphim.ai` (danh sách dưới) | Claude + anh đăng nhập tài khoản thật |
| R7 | Theo dõi 24 giờ: nhật ký Supabase, Resend, lỗi console | Claude |

**Smoke test sau R5:**
1. `https://xuongphim.ai` và `http://www…` chuyển 301 về `https://www.xuongphim.ai/`.
2. Header có CSP, HSTS, XFO.
3. `/robots.txt` là `Disallow: /`; trang có `noindex`.
4. Không lỗi console; ảnh và banner DEMO hiện.
5. Tìm kiếm, lọc, mở phim; canonical là www.
6. Đăng ký mới → nhận thư (`no-reply@mail.xuongphim.ai`) → xác minh → đăng nhập.
7. Quên mật khẩu → đặt lại.
8. Điểm danh +10, bấm lần 2 bị chặn.
9. Chat chung: gửi, nhận Realtime; báo cáo.
10. Dashboard `/admin` bằng tài khoản chủ; khophim.ai và 3 site còn lại **không đổi** (vẫn bản `c6dd520`).

**Rollback:**
- **Website (vài phút):** gỡ 2 tên miền khỏi `xuongphim-ai`, gắn lại vào `web-phim-ai-5sites`, CNAME trỏ lại `web-phim-ai-5sites.pages.dev`. Xưởng Phim trở về bản `c6dd520` như hiện nay.
- **CSDL:** bản `c6dd520` không dùng Supabase, nên rollback website không cần đụng CSDL. Migration Level 4 chỉ thêm, không sửa dữ liệu cũ. `99_rollback_level4.sql` (đã test) chỉ dùng khi chưa có điểm hay quyền xem thật.
- **Email:** tắt Custom SMTP; bản ghi DNS của Resend để nguyên, vô hại.

**Chi phí:** 0đ (Cloudflare Pages Free, Supabase Free, Resend Free khoảng 3.000 email/tháng). Không tạo dịch vụ trả phí.

### 8. Kết luận (01/11 02:00)

| # | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | MASTER WEBSITE | **VERIFIED** | Toàn bộ hành trình Real User PASS trên Preview (31/10 23:30 → 01/11 01:25) |
| 2 | GITHUB | **READY** | RC1 `27760a4` (`release/xuongphim-l4-rc1`), CI xanh, Preview khớp SHA từng tệp |
| 3 | SUPABASE | **READY** | Schema = bản đã test (md5), RLS 27/27, không phục vụ Production; Redirect URL và Site URL www cập nhật ở bước R4 |
| 4 | CLOUDFLARE | **READY** | Kế hoạch project riêng cho Xưởng Phim, không đụng 4 site; rollback 1 bước |
| 5 | RESEND SMTP | **READY** | Domain Verified; đăng ký, xác minh, đặt lại mật khẩu thật PASS |
| 6 | SECURITY | **PASS** | RLS, chống trừ điểm 2 lần, chống spam, quyền kiểm duyệt, XSS, header bảo mật. Leaked-password chưa bật được (có thể cần gói trả phí) |
| 7 | SEO | **READY** | Canonical www, sitemap, robots theo cổng, 404, không lượt xem giả. Vẫn noindex có chủ đích |
| 8 | QA CLEANUP | **PREPARED** | Đã chạy thử sao lưu và dọn dẹp; chờ anh duyệt |
| 9 | ROLLBACK | **READY** | Website: chuyển tên miền về project cũ (`c6dd520`); CSDL: không cần (bản cũ không dùng Supabase) |
| 10 | PRODUCTION RELEASE | **NOT READY → chờ 1 bước** | Còn **kiểm thử đăng nhập lại trên đúng RC1** (cần anh đăng nhập qa1/qa2 ở 2 tab RC). Tài liệu chính sách còn thiếu email liên hệ (bước R2) |

Mã liên quan tới đăng nhập trên RC1 trùng với bản đã kiểm thử thật: `rewards.js` (44df4cb), `auth.js` (5bc36b9), `studio-ops.js` (0897e31). Khác biệt duy nhất là `community-chat.js` thêm 1 lệnh phát tín hiệu khi khóa chat trong khung chat (0f18701, đã có E2E). Bộ hồi quy đăng nhập trên RC chỉ để xác nhận lần cuối.


## Cập nhật 31/10/2026 23:55 — DNS email Resend cho `mail.xuongphim.ai`

**Phạm vi anh duyệt:** 3 bản ghi bắt buộc của Resend (TXT DKIM và 2 CNAME). Không thêm DMARC.

**Đối chiếu trước khi ghi** (đọc DNS bằng API của Cloudflare dashboard):
- Zone `xuongphim.ai` (`fe5819c8…`, tài khoản Hung2nao, gói Free, active) chỉ có 2 bản ghi website.
- Không có MX, TXT, SPF, DKIM, `_dmarc` hay bản ghi nào dưới `*.mail.xuongphim.ai`, nên không xung đột.
- Giá trị lấy trực tiếp từ dữ liệu trang Resend (domain `760159a0…`, vùng Tokyo `ap-northeast-1`), đọc lại ngay trước khi ghi. DKIM dài 218 ký tự, không dùng bản hiển thị bị rút gọn "[…]".

**Cách ghi:** API ghi DNS của dashboard trả 403 nên **không tạo được gì** qua API. Tôi tạo từng bản ghi bằng form "Add record" trên giao diện Cloudflare. Trước khi lưu, tôi đối chiếu nội dung ô DKIM với giá trị Resend (khớp 218/218).

**Đọc lại DNS sau khi ghi:**

| Bản ghi | Loại | Nội dung | Proxy | Khớp Resend |
|---|---|---|---|---|
| `resend._domainkey.mail.xuongphim.ai` | TXT | `p=MIGfMA0GCSqGSIb3DQEBAQ…` (218 ký tự) | — | ✓ |
| `rsend.mail.xuongphim.ai` | CNAME | `rsend-apne1.forge.rmta.net` | **DNS only** | ✓ |
| `send.mail.xuongphim.ai` | CNAME | `send.forge.rmta.net` | **DNS only** | ✓ |
| `xuongphim.ai` | CNAME | `web-phim-ai-5sites.pages.dev` | Proxied | giữ nguyên |
| `www.xuongphim.ai` | CNAME | `web-phim-ai-5sites.pages.dev` | Proxied | giữ nguyên |

- Không đụng zone của 4 website còn lại, không thêm MX hay DMARC, không đổi Supabase SMTP.
- Chưa tạo API key Resend, chưa phát sinh dịch vụ tính phí.

**Resend:** đã bấm "Verify DNS records" lúc 23:53.
- Trạng thái lúc 23:54: domain `pending`; DKIM `pending`; `rsend.mail` `pending`; `send.mail` `not_started`; không có `failed_reasons`.
- Kết quả theo dòng thời gian sự kiện của Resend:
  - 23:54: `send.mail` verified.
  - 23:54: "DNS verified".
  - 23:55: DKIM và `rsend.mail` verified.
  - **23:55: "Domain verified — Your domain is ready to send emails."**
- Trạng thái domain trong Resend: **Verified**, Resend Forge Enabled, TLS Opportunistic.

**Chuẩn bị kết nối SMTP cho Supabase Auth** (chưa thực hiện, chờ anh duyệt):

| Mục | Giá trị |
|---|---|
| Nơi cấu hình | Supabase → project `ai-film-network` → Authentication → Emails → SMTP Settings → Enable custom SMTP |
| Sender email | `no-reply@mail.xuongphim.ai` |
| Sender name | `Xưởng Phim` |
| Host | `smtp.resend.com` |
| Port | `465` (SSL) |
| Username | `resend` |
| Password | API key Resend mới, quyền **Sending access**, chỉ cho domain `mail.xuongphim.ai`. **Anh tự tạo và tự dán.** Không ghi key vào báo cáo, repo hay chat |
| Giới hạn | Đặt Authentication → Rate Limits khoảng 30 email/giờ. Gói Free của Resend khoảng 100 email/ngày, 3.000/tháng |

**Sau khi bật SMTP:**
1. Đổi Site URL sang alias Preview.
2. Bật Leaked password protection.
3. Dán mẫu email tiếng Việt (mục 2, cập nhật 21:00).
4. Đăng ký thử một tài khoản thật bằng địa chỉ ngoài nhóm. Kiểm tra thư đến hộp thư chính, header có `dkim=pass` cho `mail.xuongphim.ai`, link xác minh đưa về `/?auth=confirm`.
5. Thử đặt lại mật khẩu.

Làm xong các bước này mới đóng được mục "Đăng ký mới qua email xác minh: BLOCKED".

**Kiểm tra SMTP (01/11, chỉ đọc):** Custom SMTP đã bật. Sender `no-reply@mail.xuongphim.ai`, host `smtp.resend.com:465`, user `resend`, mật khẩu đã lưu (ẩn). Rate limit email đổi từ 2/giờ thành 30/giờ (nhật ký Auth 00:32). Site URL vẫn là Preview cũ.

**Lần đăng ký thử 00:59 bằng `hung2nao@gmail.com`:**
- Email này **đã là tài khoản chủ**. Nhật ký Auth ghi 2 sự kiện `user_repeated_signup`, HTTP 200.
- Supabase cố ý trả thành công giả để chống dò tài khoản và **không gửi thư, không tạo tài khoản mới**. Không có dòng mới trong `auth.users`; tài khoản chủ không bị đổi.
- Giao diện báo "Kiểm tra email để xác minh…" là gây hiểu nhầm. Đã sửa trong DEV: thông báo trung lập, nêu cả hai khả năng (chưa có tài khoản thì chờ thư; đã có thì Đăng nhập hoặc Quên mật khẩu). E2E 71/71.
- Kết quả: **chưa kiểm thử được gửi thư**. Cần đăng ký bằng một địa chỉ **chưa có** trong hệ thống, ví dụ `hung2nao+signup1@gmail.com`.

**Đăng ký thật bằng `hung2nao+signup1@gmail.com` (01:09): PASS gửi thư và xác minh**

| Bước | Bằng chứng |
|---|---|
| Đăng ký trên Preview alias | Auth log `user_confirmation_requested` (`/signup`, 200) lúc 01:09:06. Tạo tài khoản `f183e257` (tên hiển thị "hungcreator"), `confirmation_sent_at` 01:09:04 |
| Gửi thư qua Resend | Resend Emails: tới `hung2nao+signup1@gmail.com`, **Delivered**, tiêu đề "Confirm your email address" |
| Nhận thư | Gmail **Hộp thư đến** (không phải Spam), người gửi `xưởng phim <no-reply@mail.xuongphim.ai>`, 01:09 (ảnh anh gửi) |
| Bấm link xác minh | Auth log `user_signedup` (`/verify`, 303) lúc 01:09:25; `email_confirmed_at` = 01:09:25 |
| Lần bấm thứ hai (01:09:32) | `403: Email link is invalid or has expired`, đúng vì link chỉ dùng 1 lần |

**Còn lại:**
1. Chưa có lần đăng nhập đầu (`last_sign_in_at` trống) và chưa có dòng `profiles`. Link được mở ở trình duyệt khác với nơi đăng ký; luồng PKCE cần cùng trình duyệt để tự đăng nhập. Người dùng cần đăng nhập bằng mật khẩu sau khi xác minh.
2. Thư dùng **mẫu tiếng Anh mặc định** của Supabase; nên dán mẫu tiếng Việt.
3. Tên người gửi đang viết thường "xưởng phim".
4. Chưa kiểm tra header DKIM của thư (Gmail → "Hiện thư gốc") và chưa thử thư đặt lại mật khẩu.

**Đăng nhập lần đầu và đặt lại mật khẩu (01:13–01:15):**
- Đăng nhập bằng mật khẩu thành công (Auth log `login`, `grant_type=password`, 01:13:38). Bước **đăng nhập sau xác minh: PASS**.
- Yêu cầu "Quên mật khẩu" lúc 01:13:57: thư "Reset your password" **đến Hộp thư đến** từ `no-reply@mail.xuongphim.ai`. **Gửi thư đặt lại mật khẩu: PASS.**
- Bấm liên kết đặt lại mật khẩu: **FAIL, tìm ra 2 lỗi thật**
  1. **01:14:11:** `/verify` thành công nhưng không có bước đổi mã lấy phiên. Liên kết mặc định của Supabase dùng PKCE, chỉ hoạt động ở **đúng trình duyệt đã yêu cầu**. Anh yêu cầu ở trình duyệt tích hợp nhưng mở thư bằng Chrome, nên không có phiên.
  2. **01:14:17 và 01:15:12:** bấm lại thì Supabase trả `One-time token not found` / `otp_expired` và chuyển về `/?auth=recovery&error=…`. Web không báo gì: dialog không mở, người dùng thấy trang chủ như chưa có chuyện gì (ảnh anh gửi).
- **Đã sửa trong DEV** (`assets/auth.js`):
  - Liên kết có `error` / `error_code` (trong query hoặc `#hash`): mở dialog với thông báo rõ "Liên kết … đã hết hạn hoặc đã được sử dụng (mỗi liên kết chỉ dùng được 1 lần)". Với đặt lại mật khẩu, mở sẵn form xin liên kết mới. Xóa tham số lỗi khỏi URL.
  - Hỗ trợ liên kết `token_hash` (`verifyOtp`), **dùng được ở mọi trình duyệt và điện thoại**.
  - Liên kết PKCE mở ở trình duyệt khác: báo "cần mở trong cùng trình duyệt…" thay vì im lặng.
  - Thêm 4 E2E (link hết hạn ở query và ở hash; token_hash hợp lệ; token_hash sai). E2E **75/75**, auth contract 9/9, level4 contract 11/11.
- **Mẫu email tiếng Việt dùng token_hash:** `docs/email-templates/confirm-signup.html` và `docs/email-templates/reset-password.html`, mỗi tệp ghi kèm tiêu đề thư. Lúc 01:25, theo yêu cầu của anh, tôi đã dán 2 mẫu này vào Supabase → Authentication → Emails → Templates ("Confirm sign up" và "Reset password", project staging `ai-film-network`).
  - Tải lại trang để kiểm tra: tiêu đề "Xác minh email tài khoản Xưởng Phim" và "Đặt lại mật khẩu Xưởng Phim" đã lưu.
  - Liên kết đã lưu: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` (xác minh) và `…&type=recovery` (đặt lại mật khẩu).
  - Các mẫu khác giữ nguyên. Preview alias đã chạy `auth.js` mới (có `verifyOtp`).

**Kiểm chứng lại với mẫu token_hash (01:24, thật, link mở bằng Chrome): PASS**

| Thời điểm | Sự kiện (Auth log) |
|---|---|
| 01:24:22 | `user_recovery_requested` (`/recover`, 200) cho `+signup1` |
| 01:24:41 | `/verify` **POST 200**, action `login`: `verifyOtp(token_hash)` từ web tạo phiên ngay trên Chrome, không cần đúng trình duyệt đã yêu cầu |
| 01:24:49 | Một yêu cầu `/verify` thứ hai bị từ chối `One-time token not found` (403). Link chỉ dùng 1 lần; không ảnh hưởng kết quả |
| 01:24:59 | `user_modified` (`PUT /user`, 200): **đổi mật khẩu thành công**. Anh xác nhận giao diện báo "Đặt lại mật khẩu thành công" |

→ **Đăng ký, xác minh email, đăng nhập lần đầu và đặt lại mật khẩu qua email thật (Resend, `mail.xuongphim.ai`): Real User PASS.** Mục BLOCKED cuối cùng đã đóng.

**Đề xuất (chưa làm):** sau khi gửi ổn định, thêm `_dmarc.mail.xuongphim.ai` TXT `v=DMARC1; p=none;`. Không đụng `_dmarc.xuongphim.ai`.

## Cập nhật 31/10/2026 23:30 — Nghiệm thu thật bằng 3 tài khoản QA (Real User)

**Tài khoản:** `+qa1` (0e41cb4f, thành viên A), `+qa2` (c4bdb583, thành viên B), `+qaadmin` (ca41544b).
- Anh tạo bằng Dashboard → Add user + Auto Confirm và tự đăng nhập. Mỗi tài khoản đăng nhập ở một origin Preview riêng, nên các phiên độc lập.
- Đã kiểm tra danh tính từng tab bằng `auth.getUser()`.

**Chuẩn bị:**
- Chạy `51_qa_roles.sql`: qaadmin thành admin Xưởng Phim (audit `qa.grant_site_admin`).
- Cộng điểm cho qa1 bằng `admin_adjust_points` dưới danh tính chủ mạng: +50 điểm, idempotency key `qa-test-grant-qa1-20261031`, audit `wallet.adjust`, lý do "QA TEST — cấp điểm kiểm thử mở khóa tập trên staging".

| # | Kiểm thử (thật trên Preview) | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | qa1 bấm "Điểm danh nhận +10 điểm" | **PASS** | Toast "Điểm danh thành công: +10 điểm · chuỗi 1 ngày"; ô điểm 50 → 60; nút chuyển thành "Đã điểm danh hôm nay ✓ (+10)" và bị vô hiệu |
| 2 | Gửi yêu cầu điểm danh lần 2 cùng ngày: 1 lần cho xuongphim, 1 lần cho khophim, 5 lần đồng thời | **PASS** | Cả 7 yêu cầu trả `already`, số dư giữ 60; ledger chỉ có 1 dòng `checkin` |
| 3 | qa1 tự sửa ví / ghi ledger / tự cộng điểm | **PASS** (bị chặn) | Lần lượt trả `permission denied for table wallets`, `permission denied for table wallet_ledger`, `forbidden` |
| 4 | Trước khi mở khóa: tập 2 (sớm, 30 điểm) | **PASS** | Màn khóa "Tập 2 đang mở sớm với 30 điểm. Số dư của bạn: 60 điểm." `get_playback_source` trả `locked`, không có nguồn; bảng `episode_sources` trả 0 dòng |
| 5 | qa1 bấm "MỞ KHÓA · 30 ĐIỂM" **3 lần liên tiếp** | **PASS** | Toast "Đã mở khóa tập 2 (−30 điểm)"; số dư 60 → **30** (trừ đúng 1 lần) |
| 6 | Gửi thêm 5 yêu cầu mở khóa đồng thời, mỗi yêu cầu một khóa mới | **PASS** | Cả 5 trả `already_unlocked:30`; có 1 quyền xem (active, 30 điểm); ledger có 1 dòng `unlock −30` |
| 7 | Quyền xem sau mở khóa | **PASS** | Nguồn `ok` (YouTube Sintel kèm nguồn dự phòng); player phát thật, `currentTime` tăng 4,06 → 5,13 giây |
| 8 | qa2 (chưa mở khóa) xem tập 2 | **PASS** | `locked`; qa2 thấy 0 quyền xem của người khác |
| 9 | Ví sau toàn bộ thao tác | **PASS** | qa1: balance 30 = tổng ledger 30 (earned 60, spent 30); ví chủ không đổi (10) |
| 10 | Chat theo phim giữa qa1 ↔ qa2 | **PASS** | Hiện "● Trực tiếp · 2 người đang xem"; tin qa1 gõ bằng bàn phím tới qa2 qua Realtime; tin qa2 tới qa1 sau **~0,3 giây** |
| 11 | Phòng chung: qa1 ↔ qa2 | **PASS** | Hiện 2 người xem; qa2 thấy đủ 5 tin của qa1 |
| 12 | Chống spam: tin trùng, quá 5 tin/30 giây, tin trống, quá 500 ký tự, phòng sai | **PASS** | Lần lượt hiện: "Tin nhắn trùng với tin bạn vừa gửi.", "Bạn đang gửi quá nhanh…", "Tin nhắn đang trống.", `message_too_long`, `invalid_room` |
| 13 | HTML/XSS trong tin nhắn | **PASS** | `<b>…<img onerror>` hiện dạng chữ thường ở cả khung chat và Dashboard, không tạo phần tử HTML |
| 14 | Giả mạo / sửa tin, member tự kiểm duyệt | **PASS** (bị chặn) | Insert trực tiếp và sửa tin: `permission denied`; member ẩn tin, khóa chat, xem danh sách báo cáo: `forbidden` |
| 15 | qa2 báo cáo tin qa1 qua giao diện (lý do "Không phù hợp"), rồi báo cáo lại | **PASS** | 1 báo cáo `open`; báo cáo lần 2 không tạo thêm (vẫn 1) |
| 16 | qaadmin xử lý trong Dashboard → Chat cộng đồng | **PASS** | Thấy báo cáo; bấm "Ẩn tin" → "Đã ẩn tin nhắn."; danh sách báo cáo mở rỗng; DB `hidden=true`; qa1 (tác giả) thấy nhãn "Đã ẩn"; qa2 đọc DB được 0 dòng |
| 17 | qaadmin "Khóa chat 24h" qa1 | **PASS** | Bảng khóa có 1 dòng; giao diện qa1 hiện "Bạn đang bị tạm khóa chat đến 23:17 01-11.", ô nhập bị vô hiệu; gọi RPC trực tiếp → `chat_muted` |
| 18 | Giới hạn quyền của qaadmin | **PASS** | Khóa chat chủ mạng → `forbidden`; tự khóa mình → `cannot_mute_self`; cộng điểm → `forbidden`; xem tổng quan khophim → `forbidden`; xem tổng quan xuongphim → ok |
| 19 | qaadmin "Mở khóa" | **PASS** phía máy chủ | "Đã mở khóa chat."; bảng khóa rỗng |
| 20 | Nhật ký kiểm duyệt | **PASS** | `qa.grant_site_admin`, `wallet.adjust`, `chat.hide`, `chat.mute`, `chat.unmute` đều ghi đúng người thực hiện và lý do |

**Lỗi thật phát hiện và đã sửa trong DEV** (commit `0897e31`):
1. **Tin bị ẩn vẫn hiện với người đang mở chat.**
   - Nguyên nhân: Realtime không gửi sự kiện cho dòng mà RLS đã ẩn, nên qa2 vẫn thấy tin cho tới lần đồng bộ 45 giây (đo được: 20 giây).
   - Sửa: kiểm duyệt viên, cả trong khung chat lẫn Dashboard, phát tín hiệu `moderated` vào kênh của phòng; mọi người trong phòng tải lại ngay.
2. **Sau khi mở khóa chat, khung chat đang mở của thành viên vẫn bị khóa** (chờ hơn 40 giây vẫn khóa, phải tải lại trang).
   - Sửa: tín hiệu `moderated` và lần đồng bộ định kỳ đều kiểm tra lại trạng thái khóa. Dashboard phát tín hiệu sau khi khóa hoặc mở khóa.

**Kiểm thử sau khi sửa:**
- Đã thêm assert hồi quy vào E2E: tin biến mất trong vòng 5 giây, ô nhập mở lại trong vòng 5 giây. **Đã xác nhận assert thất bại trên code cũ.**
- E2E 71/71, contract test đạt.

**Ghi nhận UX (không sửa):** tài khoản tạo bằng Dashboard chưa có tên hiển thị nên hiện "Thành viên". Bảng khóa chat hiện mã người dùng (`0e41cb4f`). Đăng ký thật có ô tên hiển thị nên không gặp vấn đề này.

| 21 | qa1 đăng xuất (bấm "Đăng xuất" trên giao diện) rồi đăng nhập lại (23:22) | **PASS** | Trước khi đăng xuất ô điểm hiện "★30điểm"; sau khi đăng xuất: không còn phiên, ô hiện "Điểm danh". Sau khi đăng nhập lại: ví balance 30 = ledger 30 (earned 60, spent 30), không có điểm danh trùng |
| 22 | qa2 và qaadmin tự điểm danh trên giao diện (anh thao tác lúc 23:24) | **PASS** | Mỗi tài khoản có 1 lượt điểm danh +10, balance 10 = ledger 10 |

| 23 | **Kiểm chứng bản sửa 1** (thật, 23:30): qa1 gửi tin vào phòng chung; qa2 (bản `0d8d5ae6`) báo cáo Spam qua giao diện; qaadmin (alias, bản mới nhất) bấm "Ẩn tin" trong Dashboard | **PASS** | Tin biến mất khỏi khung chat đang mở của qa2 sau **1,8 giây** (trước khi sửa: khoảng 20 giây, tối đa 45 giây) |
| 24 | **Kiểm chứng bản sửa 2**: qa2 gửi tin, qa1 báo cáo, qaadmin bấm "Khóa chat 24h" rồi "Mở khóa" | **PASS** | Khung chat đang mở của qa2 bị khóa sau **1,6 giây** (banner "Bạn đang bị tạm khóa chat đến 23:30 01-11."); mở lại sau **1,1 giây** khi được mở khóa; gửi tin "gửi lại được sau khi mở khóa" thành công, không cần tải lại trang |

Thêm commit sau kiểm chứng: nút "Khóa chat" ngay trong khung chat của kiểm duyệt viên cũng phát tín hiệu, giống Dashboard.

**Regression sau các bản sửa:** E2E Chromium **71/71**, contract test 11/11, site-config 7/7, SQL **133 chức năng + 13 đồng thời/rollback** (PostgreSQL 16 cục bộ).

**Kiểm tra dọn dữ liệu QA** (`59_qa_cleanup.sql`, chỉ chạy thử, **chưa xóa gì**):
- Khớp đúng 3 tài khoản QA. Dữ liệu người khác liên quan: quyền xem 0, báo cáo 0. Tin chat của người không phải QA: 0.
- Nếu chạy thật sẽ xóa: 1 phim QA, 3 tập, 1 quyền xem, 1 dòng `site_staff` (qaadmin), 10 tin chat QA, 0 khóa chat.
- Ví, lịch sử điểm và lượt điểm danh của QA chỉ mất khi anh xóa 3 tài khoản trong Dashboard (cascade).
- Không chạm tới tài khoản chủ (10 điểm) và tài khoản `ngos…@gmail.com`.
- Chỉ chạy thật khi anh đồng ý.

### Kết luận nghiệm thu Xưởng Phim Level 4

| Hạng mục | Kết quả |
|---|---|
| Khách: tìm kiếm, lọc, xem thông tin, phát video | Real User PASS |
| Đăng nhập, đăng xuất, đăng nhập lại (tài khoản QA tạo bằng Dashboard) | Real User PASS |
| Đăng ký mới qua email xác minh, đặt lại mật khẩu | Real User PASS (01/11 01:09–01:25: Resend `mail.xuongphim.ai` Verified, thư vào Hộp thư đến, link token_hash dùng được trên mọi trình duyệt) |
| Điểm danh, chống điểm danh trùng, ví điểm | Real User PASS |
| Mở khóa tập, chống trừ điểm hai lần, quyền xem sau mở khóa | Real User PASS |
| Community Chat: phòng chung và theo phim, Realtime, số người đang xem | Real User PASS |
| Chống spam, báo cáo, kiểm duyệt (ẩn, khóa, mở khóa), giới hạn quyền, nhật ký | Real User PASS (sau 2 bản sửa đã kiểm chứng) |
| Giao diện desktop/mobile | Real User PASS (đo ở 375/768/1366 px) |
| RLS, Production không bị ảnh hưởng | PASS |

**MASTER WEBSITE READY (Xưởng Phim, trên Preview + Supabase staging):** cập nhật 01/11 01:30, toàn bộ hành trình người dùng đã có Real User PASS, gồm đăng ký và đặt lại mật khẩu qua email thật.
- Chưa merge `main`, chưa đồng bộ 4 website còn lại.
- `main` vẫn là `c6dd520`, Production và DNS không đổi.

## Cập nhật 31/10/2026 23:10 — Xác minh môi trường trước khi chạy script QA

**Project `ai-film-network` không phục vụ Production.** Bằng chứng (chỉ đọc):
- Code `main` (`c6dd520`, đang chạy Production) không có chuỗi `supabase` hay `jurvphonehknrxjpowoe` trong `.js`, `.html` hay `_headers`.
- 5 tên miền thật (xuongphim.ai, khophim.ai, phephim.ai, phimhay.ai, ghienphim.ai): tải HTML và cả 5 script của mỗi trang lúc 23:00 → không trang nào tham chiếu Supabase.
- Nhật ký API Supabase 24 giờ qua (476 request): toàn bộ referer là `*.web-phim-ai-5sites.pages.dev` (Preview, từ VN). Số còn lại không có referer, đến từ SG (Dashboard/MCP). Không có request nào từ tên miền thật.

**Đã rà lại script QA** (commit `0b1ca59`):
- `51_qa_roles.sql` chỉ khớp **đúng** email `hung2nao+qaadmin@gmail.com`. Script dừng nếu:
  - không thấy phim đánh dấu QA (dấu hiệu không phải staging);
  - số tài khoản khớp khác 1;
  - email chưa xác minh;
  - tài khoản đã là network staff.
- `51_qa_roles.sql` chỉ cấp `site_staff(xuongphim, admin)` và ghi audit `qa.grant_site_admin` với lý do "QA TEST". Script **chưa chạy** vì tài khoản chưa tồn tại.
- `59_qa_cleanup.sql` chỉ khớp 3 email QA cố định (trước đây là regex `+qa*`) và mặc định **chạy thử**: chỉ đếm bản ghi rồi dừng.
- Khi đặt `v_apply := true`, `59_qa_cleanup.sql` vẫn dừng nếu có quyền xem phim QA hoặc báo cáo thuộc người không phải QA.
- `59_qa_cleanup.sql` không xóa tài khoản và không đụng audit log.
- Chạy thử `59_qa_cleanup.sql` trên staging lúc 23:05 (rollback):
  - 0 tài khoản QA khớp; dữ liệu người khác liên quan: 0.
  - Bản ghi sẽ xóa: 1 phim QA, 3 tập, 0 quyền xem, 0 staff, 0 tin chat, 0 khóa chat.
  - **Không xóa gì.**

**Tài khoản hiện có trên staging:**
- Tài khoản chủ (hung…, owner).
- Một tài khoản **mới tạo lúc 22:55 bằng địa chỉ Gmail cá nhân `ngos…@gmail.com`**, không phải 3 email QA đã thống nhất, chưa đăng nhập lần nào. Script QA không áp vào tài khoản này. Tôi không dùng nó cho kiểm thử khi chưa có xác nhận.

**Trạng thái nghiệm thu:** điểm danh trùng, đăng nhập lại, cấp điểm QA, mở khóa, chat 2 tài khoản, báo cáo/spam và kiểm duyệt đều vẫn **BLOCKED**, chờ 3 tài khoản QA.

## Cập nhật 31/10/2026 21:40 — Nghiệm thu vòng 3 (không dùng tài khoản)

**Phạm vi:** anh chọn "chỉ nghiệm thu không cần tài khoản". Staging vẫn chỉ có 1 tài khoản là tài khoản chủ Hungcreator (`network_staff: owner`, admin cả 5 site). Chưa có tài khoản QA. Kết luận vẫn **CHƯA READY**.

### Điểm danh và ví điểm: anh tự thao tác bằng tài khoản chủ, 20:44 giờ VN

Đây là **Real User PASS cho lần điểm danh đầu tiên**, có bằng chứng chỉ đọc từ staging:
- 1 dòng `daily_checkins` ngày 2026-10-31, +10 điểm, chuỗi 1 ngày.
- 1 dòng `wallet_ledger`: `checkin`, `delta 10`, `balance_after 10`, có idempotency key. Dòng `daily_checkins.ledger_id` trỏ đúng tới dòng ledger này.
- Ví: `balance 10 = tổng ledger 10`, `earned 10`, `spent 0`.
- Mở lại trang Thành viên (tải lại trang): nút hiện "Đã điểm danh hôm nay ✓ (+10)" và bị **vô hiệu hóa**.

Phần chưa có Real User:

| Hạng mục | Kết quả | Căn cứ |
|---|---|---|
| Không điểm danh trùng ngày | Staging DB PASS · Real User **chưa thử** | Khóa chính `(user_id, checkin_date)`, RPC trả `already` cả khi đổi site (bộ staging 95/95). Giao diện khóa nút sau khi tải lại. Chưa gửi yêu cầu điểm danh lần 2 thật |
| Số dư đúng sau khi đăng nhập lại | **BLOCKED** | Phải đăng xuất rồi đăng nhập lại tài khoản; tôi không nhập mật khẩu |
| Mở khóa bằng điểm, chống trừ 2 lần, quyền xem sau mở khóa | Staging DB PASS · Real User **BLOCKED** | Tập QA rẻ nhất cần 30 điểm, ví hiện có 10. Cộng điểm hoặc dùng tài khoản chủ không nằm trong phạm vi được duyệt |
| Chat chung và chat theo phim giữa 2 tài khoản | Mock + Staging DB PASS · Real User **BLOCKED** | Cần 2 tài khoản QA |
| Báo cáo, chống spam, kiểm duyệt | Mock + Staging DB PASS · Real User **BLOCKED** | Cần tài khoản QA. Tài khoản kiểm duyệt có thể là tài khoản chủ |

### Giao diện desktop/mobile: Real User PASS (khách, Preview `d05fc4d1`, đo trên PC Nhân)

| Kiểm tra | 375 px | 768 px | 1366 px |
|---|---|---|---|
| Cuộn ngang | Không | Không | Không |
| Tìm "cyber" | 5 kết quả | 5 | 5 |
| Cửa sổ phim | 375×812, không tràn, có nút đóng, nút ≥ 36 px | 717×1000 | 1180×744 |
| Canonical khi mở phim | `xuongphim.ai/phim/thanh-pho-khong-ngu` | như 375 px | như 375 px |
| Chat theo phim (khách) | Hiện "Đăng nhập miễn phí để đọc và tham gia…" | như 375 px | như 375 px |
| Ngăn kéo chat | Toàn màn hình, Esc đóng | 420 px | 420 px |
| Nút chat nổi che nút hero | Không, ở cả 3 vị trí cuộn | (không có nút nổi) | (không có nút nổi) |
| Hộp đăng nhập | 339 px, ô nhập cao 46 px | 440 px | 440 px |
| Thanh điều hướng | 54 px | 44 px | 44 px |
| Chân trang | Liên kết chính sách nằm trên thanh tab, không bị che | — | — |

**Lỗi thực tế đã sửa trong DEV:**
- Nhãn thanh tab dưới cùng tăng từ 11 lên 12 px.
- Liên kết 5 site ở chân trang tăng chiều cao từ 30 lên 40 px.
- Thêm assert vào E2E. E2E **71/71**.

Ký hiệu "seal" 10,5–11 px là biểu tượng trang trí (`aria-hidden`), giữ nguyên.

**Cần anh làm để hoàn tất:** tạo 2 tài khoản QA. Cách nhanh: Supabase → Authentication → Users → Add user + Auto Confirm cho `hung2nao+qa1@gmail.com` và `hung2nao+qa2@gmail.com`. Đăng nhập mỗi tài khoản ở một tab Preview, rồi báo "QA sẵn sàng". Để kiểm thử mở khóa, anh cần đồng ý cho tài khoản chủ cộng điểm QA vào tài khoản qa1 (có ghi nhật ký và lý do "QA TEST").

## Cập nhật 31/10/2026 21:00 — Level 4 Finalization (Xưởng Phim)

**Kết luận: CHƯA đạt MASTER WEBSITE READY.**
- Toàn bộ phần kỹ thuật làm được trong DEV đã xong và có bằng chứng.
- Hành trình có đăng nhập vẫn **BLOCKED** vì Supabase staging chưa có tài khoản QA (`auth.users` = 1, là tài khoản chủ).
- Lý do gốc: email mặc định của Supabase chỉ gửi được 2 email/giờ và chỉ tới thành viên nhóm, chưa bật Custom SMTP.

Commit trên nhánh `feature/master-site-xuongphim-2026-10-31`: `44df4cb`, `47119b7` và commit báo cáo này. Preview mới nhất: `d05fc4d1` (commit `47119b7`).

### 1. Nghiệm thu: Mock PASS và Real User PASS

| Hạng mục | Mock / local | Staging DB | Real User trên Preview |
|---|---|---|---|
| Khách: tìm, lọc, xem thông tin, phát YouTube | PASS (E2E) | — | **PASS** (đo thật) |
| Đăng nhập / đăng ký / xác minh email | PASS (E2E mock) | — | **BLOCKED** (chưa có tài khoản QA, chưa có SMTP) |
| Điểm danh, ví điểm | PASS | PASS (95/95 transaction rollback) | **BLOCKED** |
| Mở khóa tập, nguồn dự phòng | PASS | PASS | **BLOCKED** (cần tài khoản) |
| Lưu tiến độ / xem tiếp | PASS | PASS | PASS phần cục bộ; đồng bộ tài khoản **BLOCKED** |
| Chat giữa 2 tài khoản, realtime | PASS (mock realtime) | PASS (36/36) | **BLOCKED** |
| Báo cáo, chống spam, kiểm duyệt | PASS | PASS (gồm 20 luồng song song) | **BLOCKED** |
| RLS | PASS (SQL 133 + 13) | PASS (xem mục 5) | Khách không đọc được ví hay chat (401 / permission denied, đo thật) |

Không dùng tài khoản thật của chủ để điểm danh, mở khóa hay chat. Không bỏ qua bước xác minh email.

**Quy trình tạo tài khoản QA an toàn** (người làm: chủ dự án, vì Claude không nhập mật khẩu và không tạo tài khoản):
1. Ưu tiên bật Custom SMTP (mục 2). Sau đó đăng ký thật trên Preview bằng `hung2nao+qa1@gmail.com` và `hung2nao+qa2@gmail.com`, rồi bấm link xác minh trong hộp thư. Đây là cách đạt chuẩn Real User PASS cho cả bước đăng ký.
2. Nếu chưa bật SMTP: vào Supabase Dashboard → Authentication → Users → **Add user**, chọn *Auto Confirm*. Cách này hợp lệ cho QA nhưng báo cáo sẽ ghi "đăng ký thật: chưa kiểm thử".
3. Đăng nhập QA1 ở tab alias `feature-master-site-xuongphi…` và QA2 ở một tab Preview có mã hash khác origin (hai localStorage độc lập).
4. Sau khi kiểm thử: chạy `db/staging/59_qa_cleanup.sql`, rồi xóa 2 người dùng QA trong Dashboard.

### 2. Dịch vụ email (Supabase Auth)

**Hiện trạng** (đọc trong Dashboard, không thay đổi gì):
- Custom SMTP: **tắt**.
- Site URL: `https://feature-auth-first-pilot-202.web-phim-ai-5sites.pages.dev` (Preview cũ).
- Redirect URLs (6): `?auth=confirm|recovery|callback` cho cả `feature-auth-first-pilot-202…` và `feature-master-site-xuongphi…`. Khớp với mã nguồn: `auth.js` gửi `emailRedirectTo`/`redirectTo` = `origin + /?auth=confirm|recovery|callback`.
- Leaked password protection: **tắt** (cảnh báo của Supabase advisor).

**Đề xuất ngân sách thấp:**

| Nhà cung cấp | Gói miễn phí (tham khảo, cần xác nhận lại trên trang giá) | Gói trả phí đầu | Ghi chú |
|---|---|---|---|
| **Resend** (khuyến nghị) | ~3.000 email/tháng, 1 tên miền | ~20 USD/tháng | SMTP `smtp.resend.com:465`, cấu hình đơn giản, đủ cho giai đoạn đầu |
| Brevo | ~300 email/ngày | theo gói | SMTP `smtp-relay.brevo.com:587`, mật khẩu là SMTP key |

**Cấu hình đề xuất:**
- Gửi từ tên miền phụ `mail.xuongphim.ai` (không ảnh hưởng website).
- Người gửi `Xưởng Phim <no-reply@mail.xuongphim.ai>`.
- Cần thêm bản ghi SPF/DKIM do nhà cung cấp đưa ra. Đây là **thay đổi DNS, cần anh phê duyệt** và anh tự thực hiện.
- Sau khi bật SMTP, Supabase nâng giới hạn mặc định lên khoảng 30 email/giờ. Điều chỉnh thêm ở Authentication → Rate Limits nếu cần.

**Mẫu email tiếng Việt** (dán vào Authentication → Emails → Templates):
- *Confirm signup*, tiêu đề "Xác minh email Xưởng Phim":
  - Nội dung: "Chào bạn, bấm nút dưới đây để kích hoạt tài khoản. Link có hiệu lực 24 giờ."
  - Nút "Xác minh email" với `href="{{ .ConfirmationURL }}"`.
  - Dòng cuối: "Nếu bạn không đăng ký, hãy bỏ qua email này."
- *Reset password*, tiêu đề "Đặt lại mật khẩu Xưởng Phim":
  - Nút "Đặt mật khẩu mới" với `{{ .ConfirmationURL }}`.
  - Thêm dòng "Link chỉ dùng được một lần."

**Thao tác anh cần làm** (theo thứ tự):
1. Tạo tài khoản Resend, thêm tên miền `mail.xuongphim.ai`.
2. Thêm các bản ghi DNS mà Resend hiển thị vào Cloudflare DNS của `xuongphim.ai` (cần anh phê duyệt).
3. Tạo API key, rồi dán vào Supabase → Authentication → Emails → SMTP Settings: host `smtp.resend.com`, port `465`, user `resend`, password là API key.
4. Bật Leaked password protection.
5. Đổi Site URL sang `https://feature-master-site-xuongphi.web-phim-ai-5sites.pages.dev`.

### 3. Giao diện tiếng Việt: đã sửa và đã đo lại trên Preview

| Vấn đề (đánh giá 19:00) | Đã sửa | Đo lại trên Preview `d05fc4d1` |
|---|---|---|
| 29 request Supabase mỗi lần mở trang (`/auth/v1/user` ×10) | Debounce nạp ví. Mọi module dùng chung **một** client Supabase (`AFN.client()`). `AFN.getUser` gom các lần gọi trong 1,5 giây và xóa cache khi phiên đổi | **13 request**, `/auth/v1/user` ×3; không có cảnh báo "Multiple GoTrueClient" mới; vẫn giữ phiên đăng nhập |
| Nhãn poster 10,5–11 px | `.badge` 12 px | 12 px |
| "Xem tất cả" / "Vào kho phim" cao 22 px | Vùng chạm 40 px | 40 px |
| Nút chat nổi che "Thông tin phim" (375 / 390 px) | Hàng nút hero chừa 62 px bên phải | Không chồng lấn ở mọi vị trí cuộn 0–600 px; không cuộn ngang |
| Không có canonical / og | Canonical và Open Graph theo trang và theo phim, trỏ về tên miền thật (apex) | Trang chủ `https://xuongphim.ai/`; phim `…/phim/thanh-pho-khong-ngu`, title "Thành Phố Không Ngủ · Xưởng Phim.ai"; đóng phim thì trở về trang chủ |
| `/sitemap.xml` 404 | Pages Function chọn `sitemaps/<site>.xml` theo tên miền; `tools/build-sitemaps.cjs` sinh tệp; test kiểm tra tệp còn khớp kho phim | 200 `application/xml`, `X-Robots-Tag: noindex` trên Preview |
| robots.txt mặc định | Theo tên miền: tên miền thật cho phép lập chỉ mục (trừ `/admin`, `/account`) và khai báo sitemap; `*.pages.dev` chặn toàn bộ | Preview: `Disallow: /` |
| Không có trang chính sách / quy tắc | `chinh-sach.html` (bản nháp, noindex): dữ liệu thu thập, nơi lưu, quyền xóa tài khoản (đã có trong trang Tài khoản), quy tắc cộng đồng, báo cáo/kiểm duyệt. Có link ở chân trang và trong khung chat | 200; còn thiếu email liên hệ (chủ website bổ sung) và cần pháp lý duyệt |
| Trang 404 | Đã có sẵn (`404.html`, noindex, nút về trang chủ) | 404 đúng |

**Kiểm thử:**
- E2E Chromium **71/71** (thêm 4 bài: 375/390 px, SEO/chính sách, một client dùng chung).
- Contract test và site-config test (7/7) đạt.
- Bộ `playwright.config.cjs` (Level 3) chạy vào một Preview cũ nên không chạy được từ môi trường này; không có thay đổi Level 3.

**Lưu ý khi merge sau này:** thư mục `functions/` sẽ chạy trên Production. Trang vẫn giữ `noindex` cho đến khi anh duyệt nội dung thật.

### 4. Đặc tả nền tảng đa ngôn ngữ (chỉ thiết kế, chưa triển khai)

**Thứ tự thị trường:** Việt Nam → Indonesia → Thái Lan.

**URL**
- `/{lang}/`, `/{lang}/phim/{slug}`, `/{lang}/phim/{slug}/tap/{n}`, với `lang ∈ {vi,id,th}`.
- `/` chuyển 302 theo cookie `afn-lang`, rồi theo `Accept-Language`, mặc định `vi`. Bot không bị chuyển hướng.
- `slug` dùng chung giữa các ngôn ngữ (id phim), nên một phim là một thực thể.

**Dữ liệu (một catalog chung):**
```
film_translations(site_id, film_id, lang, title, synopsis, seo_title, seo_description, status draft|published, updated_at)
  PK(site_id, film_id, lang); RLS: đọc khi published, ghi bởi site admin
episode_translations(episode_id, lang, title)
media_tracks(episode_id, kind subtitle|audio, lang, label, url, is_default)   -- WebVTT cho phụ đề
i18n/{vi,id,th}.json                                                          -- chuỗi giao diện, khóa phẳng "chat.send"
```
- Thiếu bản dịch thì hiện bản `vi` kèm nhãn "Chưa có bản dịch". Trang đó không đưa vào sitemap của ngôn ngữ ấy.

**Tài khoản và ví:**
- Một tài khoản, một ví cho mọi ngôn ngữ (không đổi schema `wallets`).
- Thêm `profiles.locale` và `profiles.timezone`.
- `claim_daily_checkin` tính "ngày" theo `site.timezone` (mặc định Asia/Ho_Chi_Minh). Indonesia WITA/WIT cần ghi rõ mốc giờ trong giao diện.

**SEO:**
- Mỗi trang có `<html lang>`, canonical cùng ngôn ngữ, `hreflang` cho vi/id/th và `x-default` → `/vi/`.
- Sitemap index trỏ tới `sitemap-vi.xml`, `sitemap-id.xml`, `sitemap-th.xml`, có `xhtml:link`.
- Pages Functions chèn title, description và og vào HTML phía máy chủ, vì bot mạng xã hội không chạy JS. Mở rộng từ hàm `functions/` đã có.

**Hiển thị:**
- Thêm Noto Sans Thai (subset) cho `th`.
- Kiểm tra độ dài chuỗi tiếng Indonesia (thường dài hơn tiếng Việt 15–25%) ở nút và thanh tab di động.

**Tìm kiếm:** chuẩn hóa NFKC, chữ thường, bỏ dấu tiếng Việt; tiếng Thái so khớp theo chuỗi con (không có khoảng trắng giữa từ); tìm trên `title` và `synopsis` của ngôn ngữ hiện tại cộng với `vi`.

**Community Chat:**
- Phòng `network:{lang}` và `film:{site}:{film}:{lang}`.
- Mở rộng check trên `chat_messages.room`. Giữ chung rate limit, báo cáo và kiểm duyệt.
- Thêm `chat_moderators.langs` để giao kiểm duyệt viên theo ngôn ngữ.
- Danh sách từ cấm theo ngôn ngữ (bảng `chat_blocklist(lang, pattern)`), xử lý trong `send_chat_message`.

**Pháp lý:**
- Trang chính sách cho từng ngôn ngữ.
- Đồng ý xử lý dữ liệu khi đăng ký: PDPA (Thái Lan), UU PDP (Indonesia).

**Ước tính:** khoảng 3–5 tuần cho một người làm kỹ thuật. Chi phí lớn nhất là dịch metadata, phụ đề và kiểm duyệt viên bản địa.

### 5. RLS và an toàn Production

- **RLS:** 27/27 bảng public bật RLS.
  - `anon` chỉ có quyền SELECT trên dữ liệu công khai: `site_films`, `site_episodes`, `site_social_links`, `reward_rules`, `approved_reviews`.
  - `anon` không có quyền INSERT trên bảng nào.
  - `traffic_events` không có policy (chỉ ghi qua RPC `log_landing`); đúng thiết kế.
- **Advisor:** các cảnh báo "SECURITY DEFINER callable" là RPC có chủ đích; mỗi hàm tự kiểm tra `auth.uid()` và quyền, đã kiểm thử. Còn một việc cần làm: bật Leaked password protection (thao tác của anh).
- **Production không bị ảnh hưởng** (đã xác minh):
  - `main` vẫn là `c6dd520`.
  - Production deployment của Cloudflare vẫn là `c6dd520` (28/10).
  - Tên miền thật không đổi.
  - Không thay đổi DNS hay cấu hình thanh toán.
  - Không đồng bộ sang bốn website còn lại.

## Cập nhật 31/10/2026 19:00 — Đánh giá trải nghiệm Đông Nam Á (Việt Nam · Thái Lan · Indonesia)

**Phạm vi bằng chứng:**
- *Kiểm thử thật:* trình duyệt trên PC Nhân, mạng Việt Nam, Cloudflare Preview `6c43730b` / `41633f19` và alias `feature-master-site-xuongphi`.
- *Mô phỏng:* đánh giá theo chân dung người dùng Thái Lan và Indonesia. **Không** kiểm thử từ IP Thái Lan hay Indonesia.
- Chưa có tài khoản QA, nên các bước cần đăng nhập là **BLOCKED**. Tài khoản đang đăng nhập trên alias là tài khoản thật của chủ (Hungcreator), nên **không** dùng để điểm danh, mở khóa hay chat.

### Hành trình người dùng (Preview, thật)

| # | Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|---|
| 1 | Vào lần đầu | PASS | TTFB 61 ms, DOMContentLoaded ~675 ms (mạng VN); 0 lỗi console |
| 2 | Tìm kiếm | PASS (tiếng Việt) | "blender" → 1, "cyber" → 5. Từ khóa Thái/Indonesia ("ภาพยนตร์", "ไซเบอร์", "fiksi ilmiah", "kota", "film") → 0 kết quả |
| 3 | Lọc thể loại | PASS | Cyberpunk → 5 phim |
| 4 | Thông tin phim | PASS | Hộp thoại phim, player 16:9, danh sách tập, chat theo phim |
| 5 | Đăng nhập QA | BLOCKED | Chưa có tài khoản QA (auth.users = 1, là chủ) |
| 6 | Điểm danh | BLOCKED | Cần tài khoản QA |
| 7 | Mở khóa | BLOCKED | Cần tài khoản QA |
| 8 | Phát video | PASS (tập miễn phí) | YouTube trạng thái PLAYING sau 5,2 s |
| 9 | Chuyển tập | PASS phần khách | Nút trước/sau và cổng khóa hiện đúng; tập bị khóa cần tài khoản |
| 10 | Community Chat | BLOCKED gửi tin | Khách thấy "Đăng nhập để trò chuyện" đúng thiết kế; gửi tin thật cần QA |
| 11 | Lưu yêu thích | BLOCKED | Cần tài khoản QA |
| 12 | Quay lại xem tiếp | PASS (local) | "Xem tiếp" lưu theo trình duyệt (`afn-cw:<site>`); đồng bộ đa thiết bị chưa có |

### Mobile first (đo thật, giả lập viewport)

| Kích thước | Cuộn ngang | Popup phim | Player | Chat | Ghi chú |
|---|---|---|---|---|---|
| 375 | Không | Toàn màn hình 375×812 | 375×211 | Nút nổi → toàn màn hình | Nút chat nổi che một phần nút "Thông tin phim" ở hero |
| 390 | Không | 390×844 | 390×219 | Toàn màn hình | Như trên |
| 768 | Không | 717×1000 | 700×394 | Ngăn kéo 420 px | Sidebar dạng rail 76 px |
| 1366 | Không | 1180×744 | 1163×654 | Ngăn kéo 420 px | — |
| 1920 | Không | 1180×1056 | 1163×654 | Ngăn kéo 420 px | Hộp thoại giới hạn 1180 px, hợp lý |

- **Chữ nhỏ:** cỡ chữ nhỏ nhất là 10,5 px, có khoảng 110 phần tử chữ dưới 12 px (nhãn, meta). Cần tăng lên ≥12 px trên điện thoại.
- **Vùng chạm nhỏ:** 15 vùng chạm cao dưới 32 px. Gồm thanh "Xem thử giao diện" (29 px, chỉ có trên Preview) và các liên kết "Vào kho phim" / "Xem tất cả" (22 px).
- **Ô tìm kiếm:** placeholder bị cắt ở 375 px.
- **Điểm danh trên mobile:** BLOCKED, cần tài khoản để mở popover.

### Lỗi đã sửa trong DEV (nhỏ, đã xác minh)

**Trang chủ gọi Supabase lặp:** `rewards.js` tải lại ví, quy tắc và điểm danh mỗi lần nút tài khoản đổi DOM.
- Commit `44df4cb`: chỉ tải lại khi nhãn tài khoản thực sự đổi, có debounce.
- E2E 67/67, contract test đạt.
- Đo lại trên Preview: wallets/reward_rules/daily_checkins giảm từ 5× xuống 2× mỗi bảng; tổng request Supabase giảm từ 29 xuống 19.
- **Còn lại:** `/auth/v1/user` vẫn 9 lần, vì nhiều module tự gọi `auth.getUser()`. Ghi là P1, cần gom về `AFN.getUser()` dùng chung, không sửa vội trong lượt này.

### SEO đa ngôn ngữ (đánh giá, chưa triển khai)

| Hạng mục | Hiện trạng (đo trên Preview) |
|---|---|
| URL `/vi/` `/th/` `/id/` | Cả ba trả 404 — NOT IMPLEMENTED |
| `<html lang>` | Luôn `vi` |
| Title / description | Có, chỉ tiếng Việt |
| hreflang | 0 thẻ |
| canonical, og:* | Không có |
| sitemap.xml | 404 |
| robots | Preview đặt `noindex` (đúng cho DEMO); robots.txt là bản mặc định của Cloudflare |
| URL phim | `?film=<id>` trên Preview; `/phim/<id>` chuyển hướng (302) trên domain thật |
| Nội dung phim bản địa hóa | Không có (tên, mô tả chỉ tiếng Việt) |
| Phụ đề, audio theo ngôn ngữ | Không có (chỉ YouTube embed hoặc MP4; không có track VTT) |

**Thiết kế đề xuất (chưa làm):**
- Đường dẫn dạng `/{lang}/phim/{slug}`, với `vi` là mặc định và `x-default`.
- Bảng `film_translations(film_id, lang, title, synopsis, slug)` và `episode_tracks(episode_id, lang, kind[subtitle|audio], url)`.
- File chuỗi giao diện `i18n/{vi,th,id}.json`.
- Sitemap theo từng ngôn ngữ, có `xhtml:link hreflang`.
- Pages Functions hoặc pre-render để mỗi URL có title/description/og riêng, vì site hiện render bằng JS.

### Community Chat theo thị trường

- **Tìm phòng:** PASS. Có nút "Trò chuyện" ở sidebar, nút nổi trên mobile, và chat trong cửa sổ phim.
- **Ô nhập, emoji:** đã kiểm thử bằng E2E mock (67/67). Chữ Thái và Indonesia lưu được vì dùng UTF-8 và giới hạn 500 ký tự. **Chưa kiểm thử với tài khoản thật.**
- **Phòng theo ngôn ngữ:** NOT IMPLEMENTED. Chỉ có `network` và `film:<site>:<film>`.
- **Chống spam:**
  - Đã có: giới hạn 5 tin/30 giây, chặn tin trùng trong 60 giây, khóa chat.
  - Chưa có: lọc từ ngữ xấu tiếng Thái và Indonesia.
  - Thông báo spam chỉ bằng tiếng Việt.
- **Báo cáo vi phạm:** có (lý do bằng tiếng Việt), Dashboard xử lý được.
- **Quyền riêng tư:**
  - Chỉ hiện tên hiển thị, không hiện email.
  - Khách không đọc được tin, do RLS.
  - Chưa có trang chính sách hoặc điều khoản cộng đồng. Thái Lan có PDPA, Indonesia có UU PDP, nên cần trang đồng ý xử lý dữ liệu.

### Bảng kết luận

| Hạng mục | Việt Nam | Thái Lan | Indonesia | Đề xuất |
|---|---|---|---|---|
| Giao diện, ngôn ngữ | PASS | NOT IMPLEMENTED | NOT IMPLEMENTED | P1 — tách chuỗi ra i18n, thêm th/id |
| Font, hiển thị chữ | PASS | NEEDS IMPROVEMENT (Be Vietnam Pro không có chữ Thái → font hệ thống) | PASS (Latin) | P1 — thêm Noto Sans Thai |
| Tìm kiếm | PASS | NOT IMPLEMENTED (0 kết quả) | NOT IMPLEMENTED (0 kết quả) | P1 — tìm theo bản dịch, chuẩn hóa Unicode |
| Tốc độ tải | PASS (đo thật VN) | Chưa đo thật (Supabase Singapore, CDN Cloudflare: kỳ vọng tốt) | Chưa đo thật (như Thái Lan) | P2 — đo từ TH/ID bằng WebPageTest |
| Số request Supabase | NEEDS IMPROVEMENT → đã giảm 29→19 | như VN | như VN | P1 — gom `auth.getUser` |
| Mobile 375/390 | NEEDS IMPROVEMENT (chữ 10,5 px, vùng chạm 22 px, nút chat che CTA) | như VN | như VN | P1 |
| Tablet / Desktop | PASS | PASS | PASS | — |
| Đăng nhập, đăng ký | BLOCKED (chưa có QA; email giới hạn 2/giờ) | BLOCKED | BLOCKED | **P0** — Custom SMTP + tài khoản QA |
| Điểm danh | BLOCKED | BLOCKED; ngày theo UTC+7 trùng giờ Thái | BLOCKED; WIB trùng, WITA/WIT lệch 1–2 giờ | P2 — múi giờ theo site |
| Mở khóa, ví điểm | BLOCKED | BLOCKED | BLOCKED | P0 — nghiệm thu với QA |
| Phát video | PASS | NEEDS IMPROVEMENT (không phụ đề Thái) | NEEDS IMPROVEMENT (không phụ đề Indonesia) | P1 — track VTT theo ngôn ngữ |
| Community Chat | BLOCKED gửi tin thật | NOT IMPLEMENTED (phòng, thông báo tiếng Thái) | NOT IMPLEMENTED (như Thái Lan) | P1 sau nghiệm thu P0 |
| Kiểm duyệt, an toàn | PASS (mock + staging) | NEEDS IMPROVEMENT (không lọc từ Thái) | NEEDS IMPROVEMENT (không lọc từ Indonesia) | P2 |
| Quyền riêng tư, pháp lý | NEEDS IMPROVEMENT (chưa có trang chính sách) | NEEDS IMPROVEMENT (PDPA) | NEEDS IMPROVEMENT (UU PDP) | P1 |
| SEO đa ngôn ngữ | NEEDS IMPROVEMENT (không có sitemap, canonical, og) | NOT IMPLEMENTED | NOT IMPLEMENTED | P1 (sitemap, canonical cho VN); P2 cho th/id |
| Thanh toán, thói quen | Ngoài phạm vi (không thay đổi cấu hình thanh toán) | — | — | — |

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
