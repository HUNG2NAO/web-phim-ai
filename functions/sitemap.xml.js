import { siteFor } from "./_site.js";
// /sitemap.xml của từng website: phục vụ tệp tĩnh sitemaps/<site>.xml (sinh bởi tools/build-sitemaps.cjs).
export async function onRequestGet({ request, env }) {
  const s = siteFor(request);
  const res = await env.ASSETS.fetch(new URL("/sitemaps/" + s.id + ".xml", request.url));
  if (!res.ok) return new Response("Not found", { status: 404 });
  return new Response(res.body, { headers: {
    "content-type": "application/xml; charset=utf-8",
    "cache-control": "public, max-age=3600",
    ...(s.real ? {} : { "x-robots-tag": "noindex" })
  } });
}
