# AI FILM NETWORK — PC HƯNG → PC NHÂN RESUME AUDIT

## CẬP NHẬT 31/10/2026, 12:55 — Rà soát cuối trước khi chạy Setup-Level4-Worktree.ps1

| Hạng mục | Kết luận | Bằng chứng |
|---|---|---|
| ORIGINAL SOURCE | **SAFE** | `source` không đổi (main `c6dd520`). Script chỉ đọc `source` và thêm 1 ref Level 4 vào `.git` |
| LEVEL 4 WORKTREE | **BLOCKED** — chờ chạy script trên PC Nhân | Claude không có shell trên máy, không được ghi `.git`, terminal không cho gõ phím |
| WINDOWS SCRIPT | **NOT VERIFIED trên Windows** (đã VERIFIED trên PowerShell 7.4.6 cô lập) | 7 tình huống chạy thật bằng PowerShell 7 + Git trên bản sao repo `source` của PC Nhân, tất cả đạt. Hash bản trên máy = bản đã kiểm thử `071b005` |
| GIT BRANCH | **VERIFIED** (GitHub + mô phỏng) | Nhánh `feature/master-site-xuongphim-2026-10-31` → worktree `dev/pc-nhan-level4` đúng commit vừa fetch |
| BUILD & TESTS | **NOT RUN trên PC Nhân** (cloud: PASS) | Script sẽ tự chạy `tools/run-level4-tests.ps1` |
| PC NHÂN DEVELOPMENT | **NOT READY** | Chờ log chạy thật |

**Môi trường PC Nhân** (đọc từ file cài đặt, chỉ đọc):
- Git for Windows **v2.56.0**.
- Node.js với npm **11.19.0** (dòng Node 24, đủ yêu cầu ≥ 22).
- Windows PowerShell 5.1 có sẵn.
- Thư mục dự án được cấp quyền. Không còn phụ thuộc ổ D trong Level 4.

**Lỗi tìm thấy và đã sửa trong lần rà soát:**
1. File trên PC Nhân là bản cũ: công cụ ghi lưu đệm theo tên file nguồn. Đã ghi lại bằng tên nguồn mới và xác nhận hash.
2. BOM UTF-8 bị nhân đôi, khiến PowerShell báo ParserError ngay dòng đầu.

**Gia cố thêm:**
- `trap` bắt lỗi bất ngờ và giữ cửa sổ mở.
- Đổi tên thư mục trong `try/catch`.
- Chỉ tái sử dụng worktree của chính `source`.
- Dừng nếu nhánh dev đã tồn tại mà mất thư mục.
- Xác minh `source` không đổi sau khi chạy.

**Các lệnh có thể ghi trong script** (không có lệnh xóa, `reset`, `clean` hay `--force`):
- `Add-Content` vào log.
- `Rename-Item` cho thư mục chép dở.
- `git fetch` một ref.
- `git worktree add -b`.
- `git merge --ff-only` khi chạy lại.

**Lưu ý:** worktree dùng chung kho object với `source/.git`. Commit, nhánh và file làm việc hoàn toàn tách biệt (đã kiểm chứng), nhưng **không được xóa thư mục `source`** khi còn dùng `source-level4`.

---

## CẬP NHẬT 31/10/2026, 12:30 — Thiết lập Level 4 an toàn trên PC Nhân

| Hạng mục | Kết luận | Bằng chứng / lý do |
|---|---|---|
| **SOURCE ORIGINAL** | **SAFE** | `source/` được liệt kê lại trước và sau phiên: cùng file, kích thước, thời gian sửa. Vẫn ở `main` `c6dd520`, không có thay đổi thật. Không có lệnh ghi nào nhắm vào `source/` |
| **LEVEL 4 WORKTREE** | **BLOCKED** (đã chuẩn bị đủ, chờ 1 thao tác của bạn) | Công cụ từ xa **cấm ghi vào `.git` và `.github`**; terminal chỉ cho bấm chuột, không cho gõ. Vì vậy Claude không tự tạo được repo/worktree trên máy. Đã ghi `Setup-Level4-Worktree.ps1` vào thư mục dự án; script đã được mô phỏng trên bản sao repo `source` của PC Nhân: tạo worktree đúng `1927ba0`, status sạch, `source` không đổi, test PASS |
| **GITHUB SYNC** | **VERIFIED** | `feature/master-site-xuongphim-2026-10-31` = `1927ba0` (đã chứa `ebd36c7`). CI GitHub: SQL ✓, Contract + Chromium ✓ |
| **BUILD & TESTS** | **PASS** (chạy trên cloud, cùng commit) | Không có bước build (site tĩnh). SQL: 88 chức năng + 10 tranh chấp/staging. Node: 23/23. Chromium E2E: 47/47. Chưa chạy trên chính PC Nhân; script sẽ tự chạy `tools/run-level4-tests.ps1` |
| **SUPABASE STAGING** | **BLOCKED** (script đã sẵn sàng và đã kiểm thử) | Phiên này không có quyền vào Supabase, và chưa có project staging riêng. `db/staging/00_preflight_readonly.sql` (chỉ đọc) và `90_verify_after_level4.sql` (BEGIN…ROLLBACK) đều PASS trên PostgreSQL tạm và có trong CI |
| **CLOUDFLARE PREVIEW** | **BLOCKED** | Alias `feature-master-site-xuongphi.web-phim-ai-5sites.pages.dev` vẫn báo "Deployment Not Found". Trình duyệt tích hợp chưa đăng nhập Cloudflare, và Claude không nhập mật khẩu. Cần bật Preview cho nhánh `feature/master-site-*` trong Branch control |
| **DEVELOPMENT RESUME** | **NOT READY trên PC Nhân** → thành READY ngay sau khi chạy script | Phát triển trên GitHub/cloud vẫn tiếp tục (Shared Core đã xong trong phiên này). Trên máy, chỉ thiếu bước tạo worktree |

### Đã thực hiện trong phiên

1. **Đường dẫn ổ D (chỉ trong Level 4):**
   - `tests/README.md` và `tools/check-local-copy.ps1` không còn đường dẫn cứng.
   - Thêm `tools/run-level4-tests.ps1`: mọi đường dẫn tính từ repo; Playwright cài vào `..\temp\qa-level4`, ngoài repo.
   - Các file vận hành cũ (`Enter-Project.ps1`, `AGENTS.md`) nằm ngoài Level 4 nên **không sửa**.
2. **Shared Core:**
   - Thêm `window.AFN_RESOLVE_SITE` trong `sites.js`, là nguồn duy nhất để nhận diện website.
   - 6 module dùng chung: `level3.js`, `live-catalog.js`, `level3-video.js`, `youtube-player.js`, `account.js`, `auth.js`.
   - Hành vi trên 5 tên miền thật và `*.pages.dev` giữ nguyên. Nay chạy đúng cả trên localhost và preview của Vercel.
   - Có test chống tên miền giả mạo (ví dụ `evilxuongphim.ai`) và test thứ tự nạp script.
   - Thêm website mới chỉ cần thêm một mục vào `window.SITES`.
3. **Supabase Staging:** 2 script ở trên, kèm 3 kiểm tra tự động trong `tests/sql/run.sh`. Đánh giá migration Level 4:
   - Chỉ thêm, không xóa dữ liệu; chạy lại nhiều lần vẫn an toàn.
   - Có thay chính sách `site_films` (sửa lỗi khách không đọc được phim).
   - Hàm đổi điểm dùng `SECURITY DEFINER`, cố định `search_path`, khóa ví khi giao dịch.
4. **PC Nhân:**
   - Ghi `C:\Users\PC\Downloads\WEB_PHIM_AI\WEB_PHIM_AI\Setup-Level4-Worktree.ps1` (bản gốc ở `tools/setup-level4-worktree.ps1`).
   - Trong lần thử ghi bản clone đầy đủ, 28 file mã nguồn (không có `.git`) đã vào thư mục mới `source-level4`. Script sẽ **đổi tên** thư mục này sang `source-level4.partial-<thời gian>` (không xóa) trước khi tạo worktree thật.

### Cách hoàn tất (khoảng 1 phút)

Chuột phải `Setup-Level4-Worktree.ps1` → **Run with PowerShell**. Script sẽ:
1. Kiểm tra `source` (chỉ đọc).
2. Đổi tên thư mục chép dở.
3. `git fetch` nhánh Level 4.
4. `git worktree add ..\source-level4 -b dev/pc-nhan-level4`.
5. Xác minh commit, chạy test và ghi `Setup-Level4-Worktree.log`.

Script không dùng `reset --hard`, `clean`, force push hay xóa nhánh. Nếu có bất thường, nó dừng an toàn.

---

## CẬP NHẬT 31/10/2026, 11:45 — Đã xác minh bản sao chuyển sang PC Nhân

**Kết luận mới: READY TO RESUME — WITH CONDITIONS.** Phần "BLOCKED" ở bản 11:30 (bên dưới) đã được gỡ.

- **Bản sao kiểm tra:** `C:\Users\PC\Downloads\WEB_PHIM_AI\WEB_PHIM_AI`, chép nguyên từ `D:\HUNG_PROJECTS\WEB_PHIM_AI` trên PC Hưng.
- **Cách kiểm tra:** chỉ đọc qua cầu nối thiết bị. Repo Git được chép lên cloud để chạy git; không có file nào trên máy bị sửa, xóa hay di chuyển.

### A. Bản sao trên PC Nhân

| # | Câu hỏi | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Thư mục tồn tại? | Có. Bên trong có thêm một thư mục `WEB_PHIM_AI` | `device_list_dir` |
| 2 | Đủ frontend/backend? | Frontend tĩnh có đủ ở mức **Production `main`** (`index.html`, 6 file `assets`, `tests`). Không có backend riêng. **Không có** file Level 3/4: `account.html`, `member.html`, `admin.html`, `db/`, `auth.js`, `level3.js`… | Danh sách `source/` |
| 3 | Có `.git`? | Có, **duy nhất** ở `source/.git`. Đây là shallow clone, mốc nông `7fb08dc` | `.git/shallow` |
| 4 | Remote | `https://github.com/HUNG2NAO/web-phim-ai.git`. Chỉ fetch 2 nhánh: `main` và `qa/visual-2026-10-28` | `.git/config` |
| 5 | Branch / commit | `main` @ **`c6dd520`**, trùng `main` trên GitHub và Production | `.git/HEAD`, `refs/heads/main` |
| 6 | File chưa commit? | **Không có thay đổi thật.** Git liệt kê 10 file "modified", nhưng chỉ khác ký tự xuống dòng CRLF/LF; nội dung giống hệt `c6dd520` (đã so hash sau khi bỏ `\r`). Không có stash, không có file untracked | `git diff --ignore-cr-at-eol` rỗng |
| 7 | File ignored/untracked quan trọng | `source/AGENTS.md` bị loại khỏi Git bằng `.git/info/exclude`. Đây là quy tắc làm việc trên máy local | `.git/info/exclude` |
| 8 | Dữ liệu riêng từ PC Hưng | **Có**, nhưng là **tài sản vận hành**, không phải mã nguồn (xem mục B) | Danh sách thư mục |
| 9 | Còn tham chiếu ổ D? | **Có**: `Enter-Project.ps1` (gán cứng `D:\HUNG_PROJECTS\WEB_PHIM_AI` và báo lỗi nếu không thấy), `AGENTS.md`, `temp/qa/smoke-v6.cjs`, `reports/HOW_TO_UPDATE_WEBSITES.md`. Vì vậy `Run-Verification.ps1` **sẽ báo lỗi trên PC Nhân** | `grep` |
| 10 | Module/tài liệu/migration chưa lên GitHub? | **Mã nguồn và migration: không có.** Chỉ có công cụ QA, báo cáo và nhật ký ở mục B | Như trên |

**Mốc thời gian:** mọi file trong bản sao có thời gian sửa từ **28/10, 10:07 đến 12:20** (giờ Việt Nam). Level 3 bắt đầu từ 29/10 01:28, tức **sau** mốc này. Bản sao là ảnh chụp không gian làm việc trên PC Hưng ở giai đoạn V4–V6 (QA, chuyển Cloudflare, DNS).

### B. Tài sản chỉ có ở local (giữ nguyên, không đưa lên GitHub)

| Thư mục / file | Nội dung | Có trên GitHub? | Đề xuất |
|---|---|---|---|
| `AGENTS.md`, `Enter-Project.ps1`, `Run-Verification.ps1` | Quy tắc làm việc, biến môi trường, wrapper QA V5 (trỏ ổ D) | Không | Giữ. Muốn dùng trên PC Nhân thì đổi đường dẫn sang `C:\Users\PC\Downloads\WEB_PHIM_AI\WEB_PHIM_AI` |
| `temp/qa/` (43 script + `package.json`: jsdom, playwright, @napi-rs/canvas) | Bộ QA giai đoạn V4–V6: visual, contrast, DNS, smoke | Không | Giữ làm lưu trữ. Level 3/4 đã có bộ test riêng trong repo |
| `reports/` (57 file) | Báo cáo QA, chuyển Cloudflare, DNS V4–V6, rollback, hướng dẫn cập nhật | Không | Giữ. Phần trạng thái DNS trong đó **đã cũ** (DNS hiện đã xanh) |
| `backups/` (34 file) | Ảnh chụp DNS 5 domain, manifest chuyển dữ liệu, script trước khi sửa | Không | **Giữ.** Hữu ích khi cần rollback DNS |
| `logs/` (~2,4 GB), `screenshots/` (~340 MB) | Bằng chứng kiểm thử V4–V6 | Không | Giữ hoặc lưu trữ ngoài. Không đưa vào Git |
| `temp/browsers`, `runtime`, `cache` (~720 MB) | Trình duyệt Playwright và cache | Không | Có thể xóa sau này nếu bạn đồng ý; mình không tự xóa |

- Không tìm thấy secret: các chữ "token" chỉ là câu chữ trong báo cáo.
- Danh sách đệ quy dừng ở 2.000 mục. Các thư mục lớn (`logs`, `screenshots`, `temp`) đã được kiểm tra riêng ở cấp 1–2.

### C. Đối chiếu Level 4

| | Bản PC Nhân (`source/`) | GitHub Level 4 (`36da1d7` → nay `df4caf1`) |
|---|---|---|
| Production `main` (`c6dd520`) | ✓ | ✓ (tổ tiên) |
| Level 3 (PR #3–#8) | ✗ | ✓ (đủ, 31/31 test cũ PASS) |
| Level 4 (PR #9) | ✗ | ✓ |
| 7 migration `db/` | ✗ | ✓ |
| Bộ test SQL / contract / E2E | ✗ (chỉ có `preview-regressions.cjs`) | ✓ (88+7 SQL, 21 Node, 47 Chromium) |

→ GitHub Level 4 **chứa toàn bộ** mã nguồn của bản PC Nhân. **Không có code nào cần tích hợp ngược** từ PC Nhân vào Level 4.

### D. Môi trường phát triển chính trên PC Nhân

Tạo worktree Level 4 **bên cạnh** `source/`. Thư mục gốc không bị ghi đè; `.git` chỉ được thêm thông tin nhánh và worktree. Chạy trong PowerShell:

```powershell
cd C:\Users\PC\Downloads\WEB_PHIM_AI\WEB_PHIM_AI\source
git fetch origin feature/master-site-xuongphim-2026-10-31:refs/remotes/origin/feature/master-site-xuongphim-2026-10-31
git worktree add ..\source-level4 -b dev/pc-nhan-level4 origin/feature/master-site-xuongphim-2026-10-31
```

- **Thư mục làm việc chính:** `C:\Users\PC\Downloads\WEB_PHIM_AI\WEB_PHIM_AI\source-level4`.
- Nếu `git status` trong `source/` hiện 10 file "modified", đó chỉ là ký tự xuống dòng. **Không commit, không reset.**

**Điều kiện còn lại để hoàn tất website mẫu** (không thay đổi so với báo cáo bàn giao):
1. Chạy migration Level 4 trên Supabase.
2. Bật Preview Cloudflare cho nhánh `feature/master-site-*`.
3. Nghiệm thu bằng tài khoản thật.

---

## Bản 11:30 (lưu lại làm lịch sử)

- **Ngày:** 31/10/2026, 11:30 (giờ Việt Nam)
- **Phạm vi:** chỉ đọc. Không xóa, reset, pull hay merge. Không đụng `main` và Production.
- **Kết luận lúc đó: BLOCKED — MISSING DATA OR SAFETY ISSUE.**
  - Phía GitHub đã được xác minh đầy đủ.
  - Phía PC Hưng **chưa truy cập được**, nên chưa thể khẳng định máy đó không có dữ liệu riêng chưa đưa lên GitHub.
  - Muốn gỡ chặn: chạy script `tools/check-local-copy.ps1` trên PC Hưng (xem mục 12).

## 1. Project Root

| Hạng mục | Kết quả |
|---|---|
| Máy đang liên kết với phiên này | `desktop-h0vfv7o` (Windows). Đây là **cùng máy** mà phiên trước gọi là "PC Nhân" |
| Thư mục được cấp quyền | Không có |
| `D:\HUNG_PROJECTS` (đường dẫn PC Hưng ghi trong `tests/README.md`) | **Không cấp quyền được.** Hệ thống báo thư mục không thể cấp cho phiên này: có thể nó không tồn tại trên máy này, hoặc đây không phải PC Hưng |
| Desktop / Documents / Du Lieu | Không có thư mục con chứa dự án |

→ **Project root trên PC Hưng: CHƯA XÁC ĐỊNH (BLOCKED).**

## 2. Git Status

| Nơi | Trạng thái |
|---|---|
| PC Hưng | BLOCKED (không có quyền truy cập, không có shell trên máy) |
| GitHub `main` | `c6dd520`, đang chạy trên 5 domain, không thay đổi |
| GitHub Level 4 | `feature/master-site-xuongphim-2026-10-31` @ **`36da1d7`**, PR #9 (nháp) |
| Bản làm việc trên cloud | Sạch, khớp `36da1d7`, không có gì chưa push |

## 3. Local vs GitHub Comparison (phần GitHub đã xác minh)

- **Lịch sử liên tục:** cả 7 nhánh `main`, `qa/visual`, `auth-first-pilot`, `level3-xuongphim-pilot`, `level3-five-brands-preview`, `level3-completion-preview`, `level3-premium-uiux`, `homepage-font-speed` đều là **tổ tiên** của Level 4. Không có commit nào của các nhánh này nằm ngoài Level 4. Bằng chứng: `git merge-base --is-ancestor` và `rev-list --count`.
- **Ngoại lệ duy nhất:** nhánh `ops/cloudflare-pages-migration-2026-10-28` (PR #1) có 1 commit chỉ chứa tài liệu `DEPLOY_CLOUDFLARE.md`, chưa được gộp vào. Không mất chức năng; việc chuyển sang Cloudflare thực tế đã xong.
- **Không có file nào bị xóa** trong lịch sử từ `main` đến Level 4 (`git log --diff-filter=D`).
- Level 4 chỉ **sửa** 9 file cũ, phần lớn là thêm mới:
  - `app.js` +165/−9, `admin.html` +112/−4, `level3.js` +1/−1. Các dòng bị gỡ đều là phiên bản cũ của hàm hoặc dòng được thay thế có chủ đích: `openFilm`, danh sách tab, liên kết phim trực tiếp, tab mặc định của Dashboard.
  - Còn lại chỉ thêm dòng.
- **So sánh với PC Hưng:** BLOCKED.

## 4. Uncommitted / Unpushed Assets

| Nguồn | Kết quả |
|---|---|
| PC Hưng: thay đổi chưa commit, file chưa theo dõi, stash, worktree, commit chưa push | **CHƯA BIẾT** (BLOCKED) |
| Dấu vết cho thấy PC Hưng có tài sản ngoài Git | `tests/README.md` nhắc thư mục công cụ QA `D:\HUNG_PROJECTS\WEB_PHIM_AI\temp\qa` (jsdom, nằm ngoài repo). Tài liệu Level 3 nhắc "ảnh chụp workflow đã lưu trữ". Có thể đây chỉ là file công cụ, không phải mã nguồn, nhưng cần xác minh |
| GitHub có nhưng PC Hưng có thể **chưa có** | Toàn bộ Level 4 (commit `93a2f2f`, `36da1d7`), nếu PC Hưng chưa fetch từ 31/10 |

## 5. Level 3 Inheritance

**Level 4 đã kế thừa đầy đủ Level 3**, chuỗi PR #3 → #8:
- Mọi file của Level 3 đều có mặt.
- 6 migration Level 3 còn nguyên trong `db/`.
- 2 workflow CI cũ vẫn giữ.
- **31/31 test Chromium cũ của Level 3 PASS** trên mã Level 4.

## 6. Level 4 Inheritance

Level 4 = Level 3 + các phần mới:
- Điểm danh, ví điểm, mở khóa tập, Social Hub.
- 8 tab Dashboard mới.
- Shared Core, cấu hình Cloudflare (`_headers`, `_redirects`, `404.html`).
- Bản sửa RLS cho khách chưa đăng nhập.
- Migration `level4_rewards_unlock_social_v1.sql`.

Chi tiết ở `docs/AI_FILM_NETWORK_MASTER_DELIVERY.md`.

## 7. Missing Features (so với yêu cầu, không do mất mát)

- Lưới poster 16:9, sidebar thể loại thu gọn, nguồn phát dự phòng, nhiệm vụ Social có thưởng.
- Migration Level 4 **chưa chạy** trên Supabase.
- Preview Cloudflare cho nhánh Level 4 **chưa được tạo**.
- Chưa có tài liệu `DEPLOY_CLOUDFLARE.md` (nằm ở PR #1).

## 8. Feature Parity

| Chức năng | PC Hưng | GitHub | Level 4 | Bản đầy đủ hơn | Nguy cơ mất khi hợp nhất |
|---|---|---|---|---|---|
| 1. Hệ thống 5 website | ? | ✓ | ✓ | Level 4 | Không |
| 2. Authentication | ? | ✓ (PR #3) | ✓ | Level 4 | Không |
| 3. Member Hub | ? | ✓ (PR #4–#7) | ✓ + tab Điểm thưởng | Level 4 | Không |
| 4. Dashboard | ? | ✓ (PR #6–#7) | ✓ + 8 tab | Level 4 | Không |
| 5. Premium UI/UX Level 3 | ? | ✓ (PR #7–#8) | ✓ | Ngang nhau | Không |
| 6. Movie Catalog | ? | ✓ | ✓ + danh sách tập | Level 4 | Không |
| 7. Movie Player | ? | ✓ | ✓ + kiểm tra quyền, khung khóa | Level 4 | Không |
| 8–11. Điểm danh, Ví, Mở khóa, Social | ? | Chỉ Level 4 | ✓ | Level 4 | **Có**, nếu tiếp tục từ bản PC Hưng cũ mà không lấy Level 4 về |
| 12. Supabase schema/RLS | ? | 7 migration | 7 migration | Level 4 | Không |
| 13. Cloudflare config | ? | Runbook (PR #1) | `_headers`, `_redirects`, `404` | Bổ trợ nhau | Runbook PR #1 chỉ là tài liệu |
| 14. SEO / URL / routing | ? | `?film=` | `?film=&tap=`, `/phim/…`, 404 | Level 4 | Không |
| 15. Automated tests | ? (có thư mục QA ngoài repo) | 5 bộ test + 2 workflow | + SQL, E2E, contract, workflow mới | Level 4 | Không |
| 16. Tài liệu/công cụ chỉ có ở local | **Chưa biết** | — | — | — | **Cần script kiểm tra** |

## 9. Build / Test Results (chạy lại trên `36da1d7`, môi trường cô lập)

| Bộ | Kết quả |
|---|---|
| SQL: 7 migration áp dụng từ đầu trên PostgreSQL 16 tạm, chạy lại Level 4 lần hai (idempotent) | PASS |
| SQL chức năng, RLS, phân quyền | **88/88 PASS** |
| SQL tranh chấp đồng thời, double-spend | **7/7 PASS** |
| `node --check` toàn bộ JS | PASS |
| Contract + Auth (Node) | **21/21 PASS** |
| Chromium E2E: Level 4 + Level 3 cũ | **47/47 PASS** |
| CI GitHub trên PR #9 | Xanh |
| Build | Không áp dụng: site tĩnh, không có bước build |
| Supabase thật / Preview Cloudflare / PC Hưng | BLOCKED |

## 10. Recommended Integration Strategy

**Phương án B, kèm C nếu cần:**
- **B.** Lấy `origin/feature/master-site-xuongphim-2026-10-31` làm nền và tạo **worktree mới** trên PC Hưng. Không đụng thư mục gốc.
- **C.** Nếu script phát hiện commit hoặc file chỉ có trên PC Hưng: đưa chúng lên một nhánh riêng `backup/pc-hung-<ngày>`, rồi hợp nhất có chọn lọc vào nhánh phát triển. Không ghi đè Level 4.

Không chọn A, vì bản PC Hưng (nếu là bản cũ) không có Level 4. Không chọn D, vì chưa có bằng chứng thiếu file.

Lệnh an toàn trên PC Hưng, **sau khi** script xác nhận không có dữ liệu riêng:

```powershell
cd D:\HUNG_PROJECTS\WEB_PHIM_AI
git fetch origin
git worktree add ..\WEB_PHIM_AI_L4 -b dev/pc-hung-2026-10-31 origin/feature/master-site-xuongphim-2026-10-31
```

Lệnh này tạo thư mục mới `WEB_PHIM_AI_L4`. Thư mục gốc giữ nguyên.

## 11. Safety Assessment

- **GitHub:** an toàn. Lịch sử liên tục, không mất file, test đều xanh, `main` không bị đổi.
- **Rủi ro chính:**
  1. Phát triển tiếp trên bản PC Hưng cũ, chưa fetch Level 4: sau này sẽ xung đột, hoặc vô tình bỏ mất Level 4.
  2. PC Hưng có commit, stash hoặc file chưa push mà chưa ai kiểm kê.
  3. Nhầm lẫn giữa các máy: máy đang liên kết mang tên `desktop-h0vfv7o` nhưng đã được gọi bằng hai tên khác nhau.
- Script `tools/check-local-copy.ps1` **chỉ đọc**:
  - Thao tác duy nhất là `git fetch`, chỉ cập nhật thông tin nhánh từ GitHub.
  - Chỉ in tên file, không in nội dung hay khóa bí mật.
  - Chưa chạy thử trên Windows vì phiên này không có PowerShell, nhưng đã rà soát thủ công.

## 12. Development Resume Decision

**BLOCKED — MISSING DATA OR SAFETY ISSUE**, vì chưa xác minh được PC Hưng.

Cách gỡ chặn (khoảng 2 phút):
1. Trên PC Hưng, tải `tools/check-local-copy.ps1` từ nhánh Level 4 trên GitHub.
2. Chạy lệnh:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\check-local-copy.ps1 -Path "D:\HUNG_PROJECTS\WEB_PHIM_AI"
   ```
3. Gửi lại file `AFN_LOCAL_AUDIT_<tên máy>.txt` được tạo trên Desktop.

Cách khác: mở phiên Claude trên PC Hưng bằng ứng dụng desktop và chọn **"+" → Add folder** cho thư mục dự án.

- Nếu script cho thấy không có commit hoặc file riêng → chuyển thành **READY TO RESUME — WITH CONDITIONS** và tạo worktree theo mục 10.
- Nếu có → **INTEGRATION REQUIRED** theo phương án C.
