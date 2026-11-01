// Shared Core gate: every brand in assets/sites.js must be complete and consistent before it is
// rolled out. Adding a sixth website = one new entry in window.SITES; this test tells you what is missing.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const ctx = { window: {}, location: { hostname: "afn-local.pages.dev", search: "" }, URLSearchParams };
vm.createContext(ctx);
for (const f of ["assets/sites.js", "assets/films.js", "assets/films-tuong-lai.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
const { SITES, FILMS, GENRES, AFN_RESOLVE_SITE } = ctx.window;
const PLATFORMS = ["facebook_page", "facebook_group", "tiktok", "youtube", "telegram", "zalo", "instagram", "other"];
const PLACEMENTS = ["footer", "member", "film", "header"];

function luminance(hex) {
  const c = hex.replace("#", "").match(/../g).map(x => parseInt(x, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

test("five brands, unique ids and domains, valid world", () => {
  assert.equal(SITES.length, 5);
  assert.equal(new Set(SITES.map(s => s.id)).size, SITES.length);
  assert.equal(new Set(SITES.map(s => s.domain)).size, SITES.length);
  for (const s of SITES) {
    assert.match(s.id, /^[a-z][a-z0-9]{2,30}$/, s.id);
    assert.match(s.domain, /^[a-z0-9-]+\.ai$/, s.id);
    assert.ok(["co-trang", "tuong-lai", undefined].includes(s.world), s.id + " world");
    for (const k of ["name", "seal", "tagline"]) assert.ok(typeof s[k] === "string" && s[k].trim(), s.id + " " + k);
  }
});

test("brand colours: button text on accent stays readable (WCAG AA ≥ 4.5)", () => {
  for (const s of SITES) {
    assert.match(s.accent, /^#[0-9A-Fa-f]{6}$/, s.id);
    assert.match(s.onAccent, /^#[0-9A-Fa-f]{6}$/, s.id);
    assert.ok(contrast(s.accent, s.onAccent) >= 4.5, s.id + " contrast " + contrast(s.accent, s.onAccent).toFixed(2));
  }
});

test("featured film and every homepage row resolve to real content in the brand's world", () => {
  for (const s of SITES) {
    const world = s.world || "co-trang";
    const films = FILMS.filter(f => (f.world || "co-trang") === world && (!f.sites || f.sites.includes(s.id)));
    const genres = (GENRES[world] || []).map(g => g.name);
    assert.ok(films.length >= 6, s.id + " needs at least 6 films, has " + films.length);
    assert.ok(films.some(f => f.id === s.featured), s.id + " featured film '" + s.featured + "' is not in its catalogue");
    assert.ok(Array.isArray(s.rows) && s.rows.length >= 3, s.id + " rows");
    for (const r of s.rows) {
      const keys = Object.keys(r.filter || {});
      assert.ok(keys.length, s.id + " row without filter: " + r.title);
      for (const k of keys) assert.ok(["trending", "newest", "airing", "completed", "type", "genre"].includes(k), s.id + " unknown filter " + k);
      if (r.filter.genre) assert.ok(genres.includes(r.filter.genre), s.id + " row genre not in world: " + r.filter.genre);
      if (r.filter.type) assert.ok(["bo", "le", "ngan"].includes(r.filter.type), s.id + " row type");
    }
  }
});

test("fallback social links are https and use known platforms/placements", () => {
  for (const s of SITES) {
    assert.ok(Array.isArray(s.social), s.id + " social must be an array ([] until real accounts exist)");
    for (const l of s.social) {
      assert.match(l.url, /^https:\/\//, s.id);
      assert.ok(PLATFORMS.includes(l.platform), s.id + " platform " + l.platform);
      for (const p of l.placements || []) assert.ok(PLACEMENTS.includes(p), s.id + " placement " + p);
    }
  }
});

test("Shared Core resolver maps real domains, www and previews to the right brand", () => {
  for (const s of SITES) {
    assert.equal(AFN_RESOLVE_SITE({ hostname: s.domain, search: "" }).site.id, s.id);
    assert.equal(AFN_RESOLVE_SITE({ hostname: "www." + s.domain, search: "" }).preview, false);
    const pv = AFN_RESOLVE_SITE({ hostname: "level4.web-phim-ai.pages.dev", search: "?site=" + s.id });
    assert.equal(pv.site.id, s.id);
    assert.equal(pv.preview, true);
  }
});

test("no source file hardcodes the list of five site ids outside sites.js and the SQL", () => {
  const ids = SITES.map(s => '"' + s.id + '"');
  for (const f of fs.readdirSync(path.join(ROOT, "assets")).filter(n => n.endsWith(".js") && n !== "sites.js" && n !== "level3-config.js")) {
    const src = fs.readFileSync(path.join(ROOT, "assets", f), "utf8");
    const hits = ids.filter(id => src.includes(id)).length;
    assert.ok(hits < 3, f + " lists " + hits + " site ids; read them from window.SITES instead");
  }
});

test("SEO: functions/_site.js domains match SITES and sitemaps are up to date", async () => {
  const src = fs.readFileSync(path.join(ROOT, "functions/_site.js"), "utf8");
  const mod = await import("data:text/javascript," + encodeURIComponent(src));
  assert.deepEqual(Object.fromEntries(SITES.map(s => [s.domain, s.id])), mod.DOMAINS);
  for (const s of SITES) {
    const xml = fs.readFileSync(path.join(ROOT, "sitemaps", s.id + ".xml"), "utf8");
    const world = s.world || "co-trang";
    const films = FILMS.filter(f => (f.world || "co-trang") === world && (!f.sites || f.sites.includes(s.id)));
    assert.ok(xml.includes("<loc>https://www." + s.domain + "/</loc>"), s.id + " home");
    for (const f of films) assert.ok(xml.includes("https://www." + s.domain + "/phim/" + encodeURIComponent(f.id) + "<"), s.id + " missing " + f.id + " — run node tools/build-sitemaps.cjs");
    assert.equal((xml.match(/<url>/g) || []).length, films.length + 1, s.id + " stale sitemap — run node tools/build-sitemaps.cjs");
  }
  assert.equal(mod.INDEXABLE.size, 0, "indexing gate must stay closed until real content is approved (remove noindex together)");
  const robotsSrc = fs.readFileSync(path.join(ROOT, "functions/robots.txt.js"), "utf8");
  assert.match(robotsSrc, /INDEXABLE\.has\(s\.id\)/, "robots.txt must respect the indexing gate");
  assert.match(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), /<meta name="robots" content="noindex/, "demo site keeps noindex");
  const req = u => ({ url: u });
  assert.deepEqual(mod.siteFor(req("https://www.khophim.ai/x")), { id: "khophim", domain: "khophim.ai", real: true });
  assert.equal(mod.siteFor(req("https://abc.web-phim-ai-5sites.pages.dev/?site=phephim")).real, false);
  assert.equal(mod.siteFor(req("https://abc.web-phim-ai-5sites.pages.dev/?site=evil")).id, "xuongphim");
});

test("privacy policy RC3: owner fields are either unconfirmed (shown honestly) or real values; draft stays noindex", () => {
  const html = fs.readFileSync(path.join(ROOT, "chinh-sach.html"), "utf8");
  const fields = Object.fromEntries([...html.matchAll(/data-owner-input="([a-z-]+)">([^<]*)</g)].map(m => [m[1], m[2].trim()]));
  assert.deepEqual(Object.keys(fields).sort(), ["contact-email", "controller", "retention"]);
  // Không lộ ghi chú nội bộ cho người dùng.
  assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->/g, ""), /CẦN CHỦ WEBSITE|\[CẦN/);
  assert.ok(fields.controller.startsWith("Hungcreator"), "đơn vị vận hành do chủ dự án xác nhận");
  if (fields["contact-email"] !== "Chưa xác định")
    assert.match(fields["contact-email"], /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i, "contact email must be a real address");
  assert.ok(fields.retention.length > 3);
  const unconfirmed = /chưa được xác minh/.test(fields.controller) || fields["contact-email"] === "Chưa xác định" || /Chưa được phê duyệt/.test(fields.retention);
  if (unconfirmed) {
    assert.match(html, /<meta name="robots" content="noindex/, "bản dự thảo phải giữ noindex");
    assert.match(html, /<meta name="policy-version" content="DRAFT RC\d+">/);
    assert.match(html, /Bản dự thảo — chưa phải chính sách chính thức/);
  }
});

test("privacy policy RC3: only discloses third-party hosts the site actually loads", () => {
  const html = fs.readFileSync(path.join(ROOT, "chinh-sach.html"), "utf8");
  const used = new Set();
  for (const f of ["index.html", "account.html", "member.html", ...fs.readdirSync(path.join(ROOT, "assets")).filter(n => n.endsWith(".js")).map(n => "assets/" + n)])
    for (const m of fs.readFileSync(path.join(ROOT, f), "utf8").matchAll(/https:\/\/([a-z0-9.-]+)\//g)) used.add(m[1]);
  const disclose = { "fonts.googleapis.com": /Google Fonts/, "fonts.gstatic.com": /Google Fonts/, "cdn.jsdelivr.net": /jsDelivr/,
    "www.youtube-nocookie.com": /youtube-nocookie/, "www.youtube.com": /YouTube/, "jurvphonehknrxjpowoe.supabase.co": /Supabase/,
    "challenges.cloudflare.com": /Cloudflare Turnstile/ };
  for (const host of used) {
    if (/xuongphim\.ai|khophim\.ai|phephim\.ai|phimhay\.ai|ghienphim\.ai|pages\.dev|download\.blender\.org|img\.youtube\.com|i\.ytimg\.com/.test(host)) continue;
    assert.ok(disclose[host], "chưa khai báo nhà cung cấp: " + host);
    assert.match(html, disclose[host], host);
  }
  assert.doesNotMatch(html, /Một số nhật ký kiểm duyệt và giao dịch điểm có thể được giữ lại/, "giao dịch điểm bị xóa kèm tài khoản (ON DELETE CASCADE)");
});

test("Shared Core package: cả 5 website đạt kiểm tra cấu hình (nhận diện, danh mục, sitemap, tương phản màu)", () => {
  const r = require("node:child_process").spawnSync(process.execPath, [path.join(ROOT, "tools/site-package.cjs"), "check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const id of ["xuongphim", "khophim", "phephim", "phimhay", "ghienphim"]) assert.match(r.stdout, new RegExp("OK\\s+" + id));
});

test("cổng pháp lý: Community Chat chưa mở công khai trên tên miền thật nào (đổi danh sách này cần kết luận pháp lý)", () => {
  const core = fs.readFileSync(path.join(ROOT, "assets/afn-core.js"), "utf8");
  assert.match(core, /var CHAT_PUBLIC_DOMAINS = \[\];/);
  const chat = fs.readFileSync(path.join(ROOT, "assets/community-chat.js"), "utf8");
  assert.match(chat, /AFN\.chatEnabled === false/, "community-chat.js phải tôn trọng cổng chatEnabled");
});

test("Level 4.6: repository contains no secret keys (age secret key, Supabase secret/service key, private JWT)", () => {
  const { execSync } = require("node:child_process");
  const files = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }).split("\n").filter(f => f && !/\.(png|jpg|jpeg|webp|ico|woff2?|zip)$/i.test(f));
  for (const f of files) {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.doesNotMatch(s, /AGE-SECRET-KEY-1[0-9A-Z]{20,}/, f + ": age secret key");
    assert.doesNotMatch(s, /sb_secret_[A-Za-z0-9_-]{10,}/, f + ": Supabase secret key");
    assert.doesNotMatch(s, /eyJhbGciOi[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*cm9sZSI6InNlcnZpY2Vfcm9sZS/, f + ": service_role JWT");
  }
});
