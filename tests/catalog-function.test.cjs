// Pages Function /api/catalog: chỉ cột tối thiểu, chỉ dữ liệu công khai, cache edge, lỗi upstream → 502 không cache.
const test = require("node:test"), assert = require("node:assert");
const path = require("node:path"), { pathToFileURL } = require("node:url");
const load = () => import(pathToFileURL(path.join(__dirname, "..", "functions", "api", "catalog.js")).href);
function fakeFetch(calls, fail) {
  return async (u) => {
    calls.push(u);
    if (fail) return new Response("boom", { status: 503 });
    const t = new URL(u).pathname.split("/").pop();
    const data = { site_films: [{ film_id: "a", title: "Phim A", published: true, rights_attested: true, source_kind: "youtube", youtube_id: "AAAAAAAAAAA" }],
      site_episodes: [{ id: "11111111-1111-4111-8111-111111111111", film_id: "a", episode_no: 1, title: "Tập 1", access_tier: "free", price_points: 0 }],
      site_social_links: [], reward_rules: [{ checkin_enabled: true, checkin_base: 10, streak_step: 2, streak_step_cap: 5, day7_bonus: 30 }] }[t];
    return new Response(JSON.stringify(data), { status: 200 });
  };
}
test("build(): explicit minimal columns, published only, no playback sources", async () => {
  const { build, COLS } = await load(); const calls = [];
  const out = await build("khophim", { fetch: fakeFetch(calls), url: "https://x.supabase.co", key: "sb_publishable_x" });
  assert.equal(calls.length, 4);
  for (const u of calls) { assert.doesNotMatch(u, /select=\*/); assert.match(u, /^https:\/\/x\.supabase\.co\/rest\/v1\//); }
  assert.ok(calls.some(u => u.includes("site_films") && u.includes("site_id=eq.khophim") && u.includes("published=is.true")));
  assert.ok(calls.every(u => !u.includes("episode_sources")), "never touches playback sources");
  assert.doesNotMatch(COLS.episodes, /youtube|video_url|source/);
  assert.equal(out.site, "khophim"); assert.equal(out.films.length, 1); assert.equal(out.reward_rules.checkin_base, 10);
});
test("onRequestGet(): ?site= on Preview, real domain wins, cache HIT on second request, 502 + no-store on upstream error", async () => {
  const mod = await load(); const store = new Map(); let fetches = 0;
  globalThis.caches = { default: { match: async k => store.get(k.url)?.clone(), put: async (k, r) => { store.set(k.url, r); } } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => { fetches++; return fakeFetch([])(u, o); };
  try {
    const r1 = await mod.onRequestGet({ request: new Request("https://feature.web-phim-ai-5sites.pages.dev/api/catalog?site=phephim") });
    assert.equal(r1.status, 200); assert.equal(r1.headers.get("x-afn-catalog"), "MISS");
    assert.match(r1.headers.get("cache-control"), /public, max-age=60/);
    assert.equal((await r1.json()).site, "phephim");
    const r2 = await mod.onRequestGet({ request: new Request("https://feature.web-phim-ai-5sites.pages.dev/api/catalog?site=phephim") });
    assert.equal(r2.headers.get("x-afn-catalog"), "HIT"); assert.equal(fetches, 4, "second request served from edge cache");
    const r3 = await mod.onRequestGet({ request: new Request("https://www.ghienphim.ai/api/catalog?site=xuongphim") });
    assert.equal((await r3.json()).site, "ghienphim", "real domain decides the site");
    const r4 = await mod.onRequestGet({ request: new Request("https://x.pages.dev/api/catalog?site=khongco") });
    assert.equal((await r4.json()).site, "xuongphim", "unknown site falls back to the default brand");
    globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
    globalThis.fetch = async (u) => fakeFetch([], true)(u);
    const r5 = await mod.onRequestGet({ request: new Request("https://x.pages.dev/api/catalog?site=khophim") });
    assert.equal(r5.status, 502); assert.equal(r5.headers.get("cache-control"), "no-store");
  } finally { globalThis.fetch = realFetch; delete globalThis.caches; }
});
test("public config of the function matches the browser auth-config (same project, publishable key only)", () => {
  const fs = require("node:fs");
  const fn = fs.readFileSync(path.join(__dirname, "..", "functions", "_public-config.js"), "utf8");
  const ac = fs.readFileSync(path.join(__dirname, "..", "assets", "auth-config.js"), "utf8");
  const url = s => s.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0], key = s => s.match(/sb_publishable_[\w-]+/)[0];
  assert.equal(url(fn), url(ac)); assert.equal(key(fn), key(ac));
  assert.doesNotMatch(fn, /service_role|sb_secret_|eyJ/);
});
