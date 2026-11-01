// Đường dẫn đẹp để chia sẻ: /phim/<slug> và /phim/<slug>/tap/<n> → /?film=<slug>&tap=<n> (302).
// Thay cho quy tắc trong _redirects vì Cloudflare bỏ query gốc khi đích đã có query → bản Preview mất ?site=<id>.
// Giữ nguyên mọi tham số khác (site, utm_*, ref…). Đường dẫn không khớp → để Pages phục vụ bình thường (404).
export function prettyTarget(url) {
  const m = url.pathname.match(/^\/phim\/([^/]+)(?:\/tap\/([^/]+))?\/?$/);
  if (!m) return null;
  let slug, ep;
  try { slug = decodeURIComponent(m[1]); ep = m[2] && decodeURIComponent(m[2]); } catch (e) { return null; }
  const to = new URL("/", url);
  to.searchParams.set("film", slug);
  if (ep) to.searchParams.set("tap", ep);
  for (const [k, v] of url.searchParams) if (k !== "film" && k !== "tap") to.searchParams.append(k, v);
  return to;
}
export function onRequestGet({ request, next }) {
  const to = prettyTarget(new URL(request.url));
  return to ? Response.redirect(to.toString(), 302) : next();
}
