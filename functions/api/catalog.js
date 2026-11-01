// AI FILM NETWORK — catalog công khai theo website, cache ở edge Cloudflare (giảm egress Supabase).
// GET /api/catalog?site=<id>   (tên miền thật: site lấy theo tên miền, bỏ qua ?site=)
// Chỉ dữ liệu CÔNG KHAI đọc bằng publishable key qua RLS (khách): phim/tập đã phát hành (không có nguồn phát của tập),
// Social đang bật, quy tắc điểm danh. Không có dữ liệu cá nhân → cache dùng chung an toàn.
// Supabase chỉ bị gọi khi bản cache 60 giây hết hạn (mỗi POP), thay vì mỗi lượt xem trang.
import { siteFor } from "../_site.js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../_public-config.js";

export const TTL = 60;
export const COLS = {
  films: "film_id,title,synopsis,genres,year,film_type,source_kind,youtube_id,video_url,published,rights_attested,created_at",
  episodes: "id,film_id,episode_no,title,access_tier,price_points,free_from,access_days",
  social: "platform,label,url,placements,sort_order",
  rules: "checkin_enabled,checkin_base,streak_step,streak_step_cap,day7_bonus"
};

export async function build(site, { fetch: f = fetch, url = SUPABASE_URL, key = SUPABASE_PUBLISHABLE_KEY } = {}) {
  const get = async (path) => {
    const r = await f(`${url}/rest/v1/${path}`, { headers: { apikey: key, Accept: "application/json" } });
    if (!r.ok) throw new Error(`upstream ${r.status} ${path.split("?")[0]}`);
    return r.json();
  };
  const s = encodeURIComponent(site);
  const [films, episodes, social, rules] = await Promise.all([
    get(`site_films?select=${COLS.films}&site_id=eq.${s}&published=is.true&order=created_at.desc&limit=200`),
    get(`site_episodes?select=${COLS.episodes}&site_id=eq.${s}&published=is.true&order=film_id.asc,episode_no.asc&limit=3000`),
    get(`site_social_links?select=${COLS.social}&site_id=eq.${s}&enabled=is.true&order=sort_order.asc&limit=50`).catch(() => null),
    get(`reward_rules?select=${COLS.rules}&id=eq.1`).catch(() => null)
  ]);
  return { v: 1, site, generated_at: new Date().toISOString(), ttl: TTL, films, episodes,
    social: Array.isArray(social) ? social : null, reward_rules: Array.isArray(rules) && rules[0] ? rules[0] : null };
}

const json = (body, status, extra) => new Response(JSON.stringify(body), { status,
  headers: { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff", ...extra } });

export async function onRequestGet({ request, env = {}, waitUntil }) {
  const { id } = siteFor(request);
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(`https://afn-catalog.internal/v1/${id}`);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) { const r = new Response(hit.body, hit); r.headers.set("x-afn-catalog", "HIT"); return r; }
  }
  try {
    const body = await build(id, { url: env.SUPABASE_URL || SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY });
    const res = json(body, 200, { "cache-control": `public, max-age=${TTL}, s-maxage=${TTL}, stale-while-revalidate=300`, "x-afn-catalog": "MISS" });
    if (cache) { const p = cache.put(cacheKey, res.clone()); if (waitUntil) waitUntil(p); else await p; }
    return res;
  } catch (e) {
    return json({ error: "catalog_unavailable" }, 502, { "cache-control": "no-store" });   // trình duyệt tự quay về Supabase trực tiếp
  }
}
