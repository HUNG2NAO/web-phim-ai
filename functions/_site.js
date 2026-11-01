// Tên miền thật → mã site. Phải khớp assets/sites.js (kiểm tra bởi tests/site-config.test.cjs).
export const DOMAINS = {
  "xuongphim.ai": "xuongphim", "khophim.ai": "khophim", "phephim.ai": "phephim",
  "phimhay.ai": "phimhay", "ghienphim.ai": "ghienphim"
};
// Cổng lập chỉ mục: CHỈ thêm mã site vào đây khi nội dung thật đã được duyệt và gỡ <meta name="robots" content="noindex">.
// Trống = mọi tên miền thật trả robots "Disallow: /" và sitemap có X-Robots-Tag: noindex.
export const INDEXABLE = new Set([]);
// Preview KHÓA THEO SITE — cùng quy tắc với AFN_SITE_LOCK_LABEL trong assets/sites.js:
// một nhãn của host là "site-<id>" (alias nhánh site/<id>), "<id>-ai" hoặc "afn-<id>" (project Pages riêng).
export function lockedSiteFor(host) {
  const labels = String(host || "").toLowerCase().split(".");
  return Object.values(DOMAINS).find(id => labels.some(l => l === "site-" + id || l === id + "-ai" || l === "afn-" + id)) || null;
}
// Trả về { id, domain, real, locked } — real=false cho *.pages.dev / localhost (bản Preview, không cho lập chỉ mục).
export function siteFor(request) {
  const url = new URL(request.url), host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (DOMAINS[host]) return { id: DOMAINS[host], domain: host, real: true, locked: true };
  const sub = Object.keys(DOMAINS).find(d => host.endsWith("." + d));
  if (sub) return { id: DOMAINS[sub], domain: sub, real: true, locked: true };
  const lock = lockedSiteFor(host);
  if (lock) return { id: lock, domain: Object.keys(DOMAINS).find(d => DOMAINS[d] === lock), real: false, locked: true };
  const q = url.searchParams.get("site");
  const id = Object.values(DOMAINS).includes(q) ? q : "xuongphim";
  const domain = Object.keys(DOMAINS).find(d => DOMAINS[d] === id);
  return { id, domain, real: false, locked: false };
}
