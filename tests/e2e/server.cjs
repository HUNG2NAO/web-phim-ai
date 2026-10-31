// Tiny static server that behaves like Cloudflare Pages for this repo:
// applies _headers (global "/*" block + exact paths), _redirects (with :placeholders),
// serves 404.html with status 404, and maps /member → member.html (Pages "pretty URLs").
const http = require("node:http");
const https = require("node:https");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "../..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };

function parseHeaders() {
  const rules = [];
  let cur = null;
  for (const raw of fs.readFileSync(path.join(ROOT, "_headers"), "utf8").split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (!/^\s/.test(raw)) { cur = { pattern: raw.trim(), headers: {} }; rules.push(cur); continue; }
    const i = raw.indexOf(":");
    if (cur && i > 0) cur.headers[raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
  }
  return rules;
}
function parseRedirects() {
  return fs.readFileSync(path.join(ROOT, "_redirects"), "utf8").split(/\r?\n/)
    .filter(l => l.trim() && !l.trim().startsWith("#"))
    .map(l => { const [from, to, code] = l.trim().split(/\s+/); return { from, to, code: Number(code || 301) }; });
}
function matchRedirect(rules, pathname) {
  for (const r of rules) {
    const names = [];
    const re = new RegExp("^" + r.from.replace(/:[a-z]+/g, m => { names.push(m.slice(1)); return "([^/]+)"; }) + "/?$");
    const m = pathname.match(re);
    if (m) { let to = r.to; names.forEach((n, i) => { to = to.replace(":" + n, m[i + 1]); }); return { to, code: r.code }; }
  }
  return null;
}
// Self-signed certificate for https://afn-local.pages.dev (mapped to 127.0.0.1 by the browser),
// so every module sees the same "*.pages.dev preview" environment as Cloudflare Preview.
function tlsOptions() {
  const dir = path.join(os.tmpdir(), "afn-e2e-cert");
  const key = path.join(dir, "key.pem"), cert = path.join(dir, "cert.pem");
  if (!fs.existsSync(cert)) {
    fs.mkdirSync(dir, { recursive: true });
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "30", "-subj", "/CN=afn-local.pages.dev",
      "-addext", "subjectAltName=DNS:afn-local.pages.dev,DNS:localhost,IP:127.0.0.1", "-keyout", key, "-out", cert], { stdio: "ignore" });
  }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}
function start(port = 0, secure = process.env.AFN_E2E_TLS !== "0") {
  const headerRules = parseHeaders(), redirectRules = parseRedirects();
  const handler = (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const red = matchRedirect(redirectRules, url.pathname);
    if (red) { res.writeHead(red.code, { Location: red.to }); res.end(); return; }
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
    const headers = {};
    for (const r of headerRules) {
      if (r.pattern === "/*" || r.pattern === url.pathname) Object.assign(headers, r.headers);
    }
    // Repo internals are not part of the site, mirror what a Pages build would expose minimally.
    const blocked = /^\/(\.git|node_modules)\//.test(rel);
    if (blocked || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, Object.assign({ "Content-Type": TYPES[".html"] }, headers));
      res.end(fs.readFileSync(path.join(ROOT, "404.html")));
      return;
    }
    res.writeHead(200, Object.assign({ "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }, headers));
    res.end(fs.readFileSync(file));
  };
  const server = secure ? https.createServer(tlsOptions(), handler) : http.createServer(handler);
  return new Promise(resolve => server.listen(port, "127.0.0.1", () => resolve(server)));
}
module.exports = { start };
if (require.main === module) start(Number(process.env.PORT || 4173)).then(s => console.log("listening on " + s.address().port));
