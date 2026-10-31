#!/usr/bin/env node
// Sinh sitemaps/<site>.xml cho từng website từ assets/sites.js + kho phim tĩnh.
// Chạy lại mỗi khi thêm/bớt phim:  node tools/build-sitemaps.cjs
// functions/sitemap.xml.js chọn đúng tệp theo tên miền của request.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const ctx = { window: { location: { hostname: "build", search: "" } }, location: { hostname: "build", search: "" }, URLSearchParams };
ctx.window.window = ctx.window; vm.createContext(ctx);
for (const f of ["assets/sites.js", "assets/films.js", "assets/films-tuong-lai.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}
const SITES = ctx.window.SITES, FILMS = ctx.window.FILMS;
if (!Array.isArray(SITES) || !Array.isArray(FILMS)) throw new Error("Không đọc được SITES/FILMS");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const today = process.env.SITEMAP_DATE || new Date().toISOString().slice(0, 10);
const out = {};
for (const site of SITES) {
  const world = site.world || "co-trang";
  const films = FILMS.filter(f => (f.world || "co-trang") === world && (!f.sites || f.sites.includes(site.id)));
  const base = "https://" + site.domain;
  const urls = [base + "/"].concat(films.map(f => base + "/phim/" + encodeURIComponent(f.id)));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => "  <url><loc>" + esc(u) + "</loc><lastmod>" + today + "</lastmod></url>").join("\n") + "\n</urlset>\n";
  fs.writeFileSync(path.join(root, "sitemaps", site.id + ".xml"), xml);
  out[site.id] = urls.length;
}
console.log(JSON.stringify(out));
