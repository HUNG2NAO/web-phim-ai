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
