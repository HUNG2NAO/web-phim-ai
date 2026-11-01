/*
 * CẤU HÌNH 5 THƯƠNG HIỆU
 * world: "co-trang" (mặc định, phim cổ trang) hoặc "tuong-lai" (phim viễn tưởng, giao diện neon).
 *        Đổi phong cách một site chỉ cần sửa dòng này.
 * Cả 5 tên miền dùng chung một mã nguồn. Trang tự nhận tên miền đang mở
 * và lấy đúng tên, ấn triện, màu nhấn, phim nổi bật và các hàng phim.
 *
 * rows[].filter có thể là:
 *   { trending: true }        – xem nhiều nhất
 *   { newest: true }          – mới cập nhật
 *   { airing: true }          – phim bộ đang chiếu
 *   { completed: true }       – phim bộ đã chiếu đủ tập
 *   { type: "bo" | "le" | "ngan" }
 *   { genre: "Tu tiên" }      – theo thể loại (viết đúng như trong GENRES)
 *
 * social: liên kết mạng xã hội DỰ PHÒNG khi Dashboard chưa cấu hình (bảng site_social_links).
 *   Mỗi mục: { platform: "facebook_page|facebook_group|tiktok|youtube|telegram|zalo|instagram|other",
 *              label: "Tên hiển thị", url: "https://…", placements: ["footer","member","film","header"] }
 *   Để trống [] cho tới khi có tài khoản thật — trang sẽ không hiện khối Social.
 */
window.SITES = [
  {
    id: "xuongphim", domain: "xuongphim.ai", world: "tuong-lai",
    name: "Xưởng Phim", seal: "XP",
    tagline: "Xưởng phim khoa học viễn tưởng AI",
    accent: "#3FD0F5", onAccent: "#03161D",
    featured: "thanh-pho-khong-ngu",
    social: [],
    features: {},                       // cờ riêng site (trống = mặc định: tất cả bật)
    release: { channel: "preview", version: "4.6.0" },
    rows: [
      { title: "Mới ra lò", filter: { newest: true } },
      { title: "Cyberpunk", filter: { genre: "Cyberpunk" } },
      { title: "Không gian", filter: { genre: "Không gian" } },
      { title: "Phim ngắn", filter: { type: "ngan" } }
    ]
  },
  {
    id: "khophim", domain: "khophim.ai",
    name: "Kho Phim", seal: "库",
    tagline: "Kho phim cổ trang AI, tìm là có",
    accent: "#4FB08F", onAccent: "#04201A",
    featured: "phuong-te-cung",
    social: [],
    features: {},                       // cờ riêng site (trống = mặc định: tất cả bật)
    release: { channel: "preview", version: "4.6.0" },
    rows: [
      { title: "Phim bộ đang chiếu", filter: { airing: true } },
      { title: "Cung đấu", filter: { genre: "Cung đấu" } },
      { title: "Lịch sử", filter: { genre: "Lịch sử" } },
      { title: "Phim lẻ", filter: { type: "le" } }
    ]
  },
  {
    id: "phephim", domain: "phephim.ai", world: "tuong-lai",
    name: "Phê Phim", seal: "PP",
    tagline: "Phim hành động tương lai AI xem là phê",
    accent: "#FF4F7B", onAccent: "#2B0410",
    featured: "duong-dua-neon",
    social: [],
    features: {},                       // cờ riêng site (trống = mặc định: tất cả bật)
    release: { channel: "preview", version: "4.6.0" },
    rows: [
      { title: "Hành động", filter: { genre: "Hành động" } },
      { title: "Phim bộ đang chiếu", filter: { airing: true } },
      { title: "AI & Robot", filter: { genre: "AI & Robot" } },
      { title: "Hậu tận thế", filter: { genre: "Hậu tận thế" } }
    ]
  },
  {
    id: "phimhay", domain: "phimhay.ai",
    name: "Phim Hay", seal: "好",
    tagline: "Tuyển chọn phim cổ trang AI đáng xem",
    accent: "#E8673A", onAccent: "#2A0C02",
    featured: "kiem-khach-vo-danh",
    social: [],
    features: {},                       // cờ riêng site (trống = mặc định: tất cả bật)
    release: { channel: "preview", version: "4.6.0" },
    rows: [
      { title: "Xem nhiều nhất", filter: { trending: true } },
      { title: "Tâm lý", filter: { genre: "Tâm lý" } },
      { title: "Tình cảm", filter: { genre: "Tình cảm" } },
      { title: "Phim lẻ", filter: { type: "le" } }
    ]
  },
  {
    id: "ghienphim", domain: "ghienphim.ai",
    name: "Ghiền Phim", seal: "迷",
    tagline: "Phim bộ cổ trang AI cày hoài không chán",
    accent: "#A68BE0", onAccent: "#140A33",
    featured: "ho-ly-nui-tuyet",
    social: [],
    features: {},                       // cờ riêng site (trống = mặc định: tất cả bật)
    release: { channel: "preview", version: "4.6.0" },
    rows: [
      { title: "Phim bộ đang chiếu", filter: { airing: true } },
      { title: "Phim bộ trọn bộ", filter: { type: "bo", completed: true } },
      { title: "Tu tiên", filter: { genre: "Tu tiên" } },
      { title: "Huyền huyễn", filter: { genre: "Huyền huyễn" } }
    ]
  }
];

/*
 * SHARED CORE — nhận diện website (dùng chung cho MỌI trang, module và Pages Functions — xem functions/_site.js).
 * Thứ tự:
 *   1. Tên miền thật (kể cả www./tên miền con)                    → site đó, preview=false.
 *   2. Preview KHÓA THEO SITE: host có nhãn "site-<id>", "<id>-ai"  → site đó, preview=true, locked=true
 *      hoặc "afn-<id>" (alias nhánh site/<id> hoặc project Pages riêng) — bỏ qua ?site= và thanh chọn site,
 *      để mỗi website có bản Preview độc lập, phát hành theo lịch riêng.
 *   3. Preview chung (*.pages.dev khác, localhost…): ?site=<id> → #<id> → lựa chọn trước đó → site đầu tiên.
 * Thêm website mới: thêm một mục vào window.SITES (+ functions/_site.js, sitemaps/, assets/themes/<id>.css).
 */
window.AFN_SITE_LOCK_LABEL = function (id) { return ["site-" + id, id + "-ai", "afn-" + id]; };
window.AFN_RESOLVE_SITE = function (loc) {
  loc = loc || window.location;
  var sites = window.SITES || [];
  var host = String(loc.hostname || "").toLowerCase().replace(/^www\./, "");
  var real = sites.find(function (s) { return host === s.domain || host.endsWith("." + s.domain); });
  if (real) return { site: real, preview: false, locked: true };
  var labels = host.split(".");
  var lockedSite = sites.find(function (s) {
    var want = window.AFN_SITE_LOCK_LABEL(s.id);
    return labels.some(function (l) { return want.indexOf(l) !== -1; });
  });
  if (lockedSite) return { site: lockedSite, preview: true, locked: true };
  var stored = null;
  try { stored = window.localStorage ? localStorage.getItem("pv-site") : null; } catch (e) {}
  var candidates = [new URLSearchParams(loc.search || "").get("site"), String(loc.hash || "").slice(1), stored];
  var chosen = candidates.map(function (id) { return sites.find(function (s) { return s.id === id; }); }).find(Boolean);
  return { site: chosen || sites[0] || null, preview: true, locked: false };
};

/*
 * CỜ TÍNH NĂNG THEO WEBSITE (mặc định bật). Tắt một tính năng cho riêng một site: thêm features: { chat: false } vào mục site đó.
 * Đây là cờ GIAO DIỆN — quyền thật vẫn do máy chủ quyết định (vd. công tắc chat phía máy chủ chat_settings).
 *   memberHub · rewards (điểm danh/ví) · unlock (mở khóa tập) · chat · social
 */
window.AFN_FEATURE_DEFAULTS = Object.freeze({ memberHub: true, rewards: true, unlock: true, chat: true, social: true });
window.AFN_SITE_FEATURE = function (name, site) {
  site = site || (window.AFN_RESOLVE_SITE() || {}).site;
  var f = (site && site.features) || {};
  return Object.prototype.hasOwnProperty.call(f, name) ? f[name] !== false : window.AFN_FEATURE_DEFAULTS[name] !== false;
};

/*
 * LỚP GIAO DIỆN RIÊNG TỪNG WEBSITE: assets/themes/<id>.css chỉ được tải cho đúng site đó và mọi quy tắc trong tệp
 * phải bắt đầu bằng [data-site="<id>"] (tools/site-package.cjs kiểm tra). Sửa giao diện Kho Phim → chỉ sửa
 * assets/themes/khophim.css; Xưởng Phim không tải tệp này nên không thể bị ảnh hưởng.
 */
(function () {
  try {
    var r = window.AFN_RESOLVE_SITE();
    if (!r || !r.site || typeof document === "undefined" || !document.documentElement) return;
    var html = document.documentElement;
    html.dataset.site = r.site.id;
    if (!html.dataset.world) html.dataset.world = r.site.world || "co-trang";
    if (r.preview) html.dataset.preview = r.locked ? "locked" : "shared";
    if (document.querySelector('link[data-site-theme]')) return;
    var l = document.createElement("link");
    l.rel = "stylesheet"; l.href = "assets/themes/" + r.site.id + ".css" + (r.site.release && r.site.release.version ? "?v=" + encodeURIComponent(r.site.release.version) : "");
    l.setAttribute("data-site-theme", r.site.id);
    (document.head || html).appendChild(l);
  } catch (e) {}
})();
