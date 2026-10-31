import { siteFor } from "./_site.js";
// robots.txt theo tên miền. Bản Preview (*.pages.dev) chặn toàn bộ crawler.
export function onRequestGet({ request }) {
  const s = siteFor(request);
  const body = s.real
    ? "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin.html\nDisallow: /account\nDisallow: /account.html\n\nSitemap: https://" + s.domain + "/sitemap.xml\n"
    : "# Preview build — not for indexing\nUser-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
