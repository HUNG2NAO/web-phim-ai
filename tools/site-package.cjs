#!/usr/bin/env node
// AI FILM NETWORK — Shared Core package: kiểm tra cấu hình từng website + manifest để đồng bộ lần lượt.
//
//   node tools/site-package.cjs check [site]          Kiểm tra nhận diện, danh mục, SEO, cổng chat/index của 1 hoặc cả 5 site.
//   node tools/site-package.cjs manifest [--out f]    Liệt kê tệp Shared Core + SHA-256 (đối chiếu bản đã triển khai).
//   node tools/site-package.cjs verify <baseUrl> <site>
//        Tải từ bản đã triển khai (Preview hoặc project riêng của site) và so SHA-256 với mã nguồn hiện tại,
//        kiểm tra robots.txt / sitemap.xml trả đúng theo site. Không ghi gì lên máy chủ.
// Thoát với mã 1 nếu có lỗi chặn (BLOCK). Cảnh báo (WARN) không chặn.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

function load() {
  const ctx = { window: { location: { hostname: "build", search: "" } }, location: { hostname: "build", search: "" }, URLSearchParams };
  ctx.window.window = ctx.window; vm.createContext(ctx);
  for (const f of ["assets/sites.js", "assets/films.js", "assets/films-tuong-lai.js"]) vm.runInContext(read(f), ctx, { filename: f });
  return { SITES: ctx.window.SITES, FILMS: ctx.window.FILMS, GENRES: ctx.window.GENRES };
}
function lum(hex) {
  const c = hex.replace("#", "").match(/../g).map(x => parseInt(x, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function rowFilms(films, filter) {
  return films.filter(f => {
    if (filter.trending || filter.newest) return true;
    if (filter.airing) return f.type === "bo" && f.aired && f.aired < f.episodes;
    if (filter.completed) return f.type === "bo" && (!f.aired || f.aired >= f.episodes);
    if (filter.type) return f.type === filter.type;
    if (filter.genre) return (f.genres || []).includes(filter.genre);
    return true;
  });
}

// Tệp Shared Core: giống hệt nhau cho cả 5 website (khác biệt duy nhất nằm trong sites.js + dữ liệu Supabase theo site_id).
const SHARED = ["index.html", "account.html", "member.html", "admin.html", "chinh-sach.html", "404.html", "_headers", "_redirects",
  "functions/_site.js", "functions/_public-config.js", "functions/api/catalog.js", "functions/robots.txt.js", "functions/sitemap.xml.js", "functions/phim/[[path]].js",
  ...fs.readdirSync(path.join(root, "assets")).filter(f => /\.(js|css)$/.test(f)).sort().map(f => "assets/" + f)]
  .filter(f => fs.existsSync(path.join(root, f)));
const sha = f => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");

function check(only) {
  const { SITES, FILMS, GENRES } = load();
  const results = [];
  const site_js = read("functions/_site.js");
  const domains = JSON.parse("{" + site_js.match(/DOMAINS = \{([\s\S]*?)\}/)[1].replace(/\s+/g, " ") + "}");
  const indexable = site_js.match(/INDEXABLE = new Set\(\[(.*?)\]\)/)[1].trim();
  const chatAllow = read("assets/afn-core.js").match(/CHAT_PUBLIC_DOMAINS = \[(.*?)\]/)[1].trim();
  const policy = read("chinh-sach.html");
  for (const s of SITES.filter(x => !only || x.id === only)) {
    const r = { site: s.id, domain: s.domain, block: [], warn: [], info: {} };
    const world = s.world || "co-trang";
    const films = FILMS.filter(f => (f.world || "co-trang") === world && (!f.sites || f.sites.includes(s.id)));
    r.info.world = world; r.info.catalog = films.length;
    if (domains[s.domain] !== s.id) r.block.push("functions/_site.js DOMAINS không khớp " + s.domain + " → " + s.id);
    if (!/^#[0-9a-f]{6}$/i.test(s.accent || "") || !/^#[0-9a-f]{6}$/i.test(s.onAccent || "")) r.block.push("thiếu màu accent/onAccent");
    else { const c = contrast(s.accent, s.onAccent); r.info.accentContrast = +c.toFixed(2); if (c < 4.5) r.block.push("tương phản accent/onAccent " + c.toFixed(2) + " < 4.5"); }
    if (!s.name || !s.seal || !s.tagline) r.block.push("thiếu name/seal/tagline");
    if (!films.length) r.block.push("danh mục rỗng");
    if (!films.some(f => f.id === s.featured)) r.block.push("phim nổi bật '" + s.featured + "' không có trong danh mục của site");
    (s.rows || []).forEach(row => {
      if (row.filter.genre && !(GENRES[world] || []).some(g => (g.name || g) === row.filter.genre)) r.block.push("hàng '" + row.title + "': thể loại không có trong GENRES." + world);
      const n = rowFilms(films, row.filter).length; if (!n) r.warn.push("hàng '" + row.title + "' không có phim");
    });
    r.info.rows = (s.rows || []).length;
    (s.social || []).forEach(x => { if (!/^https:\/\//.test(x.url)) r.block.push("social không phải https: " + x.url); });
    r.info.socialFallback = (s.social || []).length;
    const sm = path.join(root, "sitemaps", s.id + ".xml");
    if (!fs.existsSync(sm)) r.block.push("thiếu sitemaps/" + s.id + ".xml");
    else {
      const locs = [...fs.readFileSync(sm, "utf8").matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
      const expect = ["https://www." + s.domain + "/"].concat(films.map(f => "https://www." + s.domain + "/phim/" + encodeURIComponent(f.id)));
      if (locs.join("|") !== expect.join("|")) r.block.push("sitemap lệch danh mục (chạy lại node tools/build-sitemaps.cjs)");
      r.info.sitemapUrls = locs.length;
    }
    r.info.indexable = new RegExp("[\"']" + s.id + "[\"']").test(indexable);
    r.info.chatPublic = new RegExp("[\"']" + s.domain.replace(".", "\\.") + "[\"']").test(chatAllow);
    if (r.info.indexable) r.warn.push("đang cho lập chỉ mục — chỉ bật khi nội dung thật đã duyệt");
    if (r.info.chatPublic) r.warn.push("Community Chat công khai đang bật trên tên miền thật — cần kết luận pháp lý");
    if (!/content="DRAFT RC\d+"/.test(policy) && !/policy-version/.test(policy)) r.warn.push("chính sách không có phiên bản");
    if (/content="DRAFT/.test(policy)) r.warn.push("chính sách riêng tư vẫn là bản dự thảo (PENDING OWNER/LEGAL REVIEW)");
    results.push(r);
  }
  return results;
}

async function verify(base, siteId) {
  const https = require("https");
  const get = u => new Promise((res, rej) => https.get(u, { rejectUnauthorized: !process.env.AFN_INSECURE }, r => {
    const chunks = []; r.on("data", c => chunks.push(c)); r.on("end", () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks) }));
  }).on("error", rej));
  const out = { base, site: siteId, mismatched: [], missing: [], checked: 0 };
  for (const f of SHARED.filter(f => !f.startsWith("functions/") && !f.startsWith("_"))) {
    const r = await get(base.replace(/\/$/, "") + "/" + f + (f.endsWith(".html") ? "?site=" + siteId : ""));
    out.checked++;
    if (r.status !== 200) { out.missing.push(f + " → " + r.status); continue; }
    if (crypto.createHash("sha256").update(r.body).digest("hex") !== sha(f)) out.mismatched.push(f);
  }
  const robots = await get(base.replace(/\/$/, "") + "/robots.txt?site=" + siteId);
  out.robots = robots.body.toString().split("\n").filter(Boolean).slice(0, 3);
  const smap = await get(base.replace(/\/$/, "") + "/sitemap.xml?site=" + siteId);
  const locs = [...smap.body.toString().matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  const { SITES } = load(); const domain = SITES.find(s => s.id === siteId).domain;
  out.sitemap = { urls: locs.length, allOnDomain: locs.length > 0 && locs.every(u => u.startsWith("https://www." + domain + "/")), noindexHeader: smap.headers["x-robots-tag"] || null };
  out.functionsServed = !/^\s*<!doctype/i.test(robots.body.toString());
  if (!out.functionsServed) out.note = "robots.txt/sitemap.xml trả HTML: máy chủ không chạy Pages Functions (chỉ gặp ở máy chủ tĩnh cục bộ)";
  else out.robotsDisallowAll = /Disallow:\s*\/\s*$/m.test(robots.body.toString());
  out.ok = !out.mismatched.length && !out.missing.length && out.functionsServed && out.sitemap.allOnDomain;
  return out;
}

(async () => {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "check") {
    const res = check(a); let blocked = false;
    for (const r of res) {
      blocked = blocked || r.block.length > 0;
      console.log((r.block.length ? "BLOCK" : "OK   ") + " " + r.site.padEnd(10) + JSON.stringify(r.info));
      r.block.forEach(x => console.log("   ✗ " + x)); r.warn.forEach(x => console.log("   ! " + x));
    }
    process.exit(blocked ? 1 : 0);
  } else if (cmd === "manifest") {
    const m = { generated_at: new Date().toISOString(), files: Object.fromEntries(SHARED.map(f => [f, sha(f)])) };
    const s = JSON.stringify(m, null, 2);
    if (a === "--out" && b) fs.writeFileSync(b, s + "\n"); else console.log(s);
  } else if (cmd === "verify" && a && b) {
    const r = await verify(a, b); console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1);
  } else {
    console.log("Dùng: node tools/site-package.cjs check [site] | manifest [--out file] | verify <baseUrl> <site>"); process.exit(2);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
