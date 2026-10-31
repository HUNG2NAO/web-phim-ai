// Tên miền thật → mã site. Phải khớp assets/sites.js (kiểm tra bởi tests/site-config.test.cjs).
export const DOMAINS = {
  "xuongphim.ai": "xuongphim", "khophim.ai": "khophim", "phephim.ai": "phephim",
  "phimhay.ai": "phimhay", "ghienphim.ai": "ghienphim"
};
// Trả về { id, domain, real } — real=false cho *.pages.dev / localhost (bản Preview, không cho lập chỉ mục).
export function siteFor(request) {
  const url = new URL(request.url), host = url.hostname.replace(/^www\./, "");
  if (DOMAINS[host]) return { id: DOMAINS[host], domain: host, real: true };
  const q = url.searchParams.get("site");
  const id = Object.values(DOMAINS).includes(q) ? q : "xuongphim";
  const domain = Object.keys(DOMAINS).find(d => DOMAINS[d] === id);
  return { id, domain, real: false };
}
