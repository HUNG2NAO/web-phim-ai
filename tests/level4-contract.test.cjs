// Static contract checks for Level 4: browser code ↔ SQL functions, money rules, XSS surface, config.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const SQL = read("db/level4_rewards_unlock_social_v1.sql");
const JS = ["assets/rewards.js", "assets/member-rewards.js", "assets/social.js", "assets/studio-ops.js", "assets/afn-core.js"]
  .map(f => [f, read(f)]);

function sqlFunctions() {
  const out = {};
  const re = /create or replace function public\.([a-z_]+)\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(SQL))) {
    out[m[1]] = m[2].split(",").map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
  }
  return out;
}

test("every RPC called from the browser exists in SQL with exactly the same argument names", () => {
  const fns = sqlFunctions();
  let calls = 0;
  for (const [file, src] of JS) {
    const re = /\brpc\("([a-z_]+)",\s*\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(src))) {
      calls++;
      const name = m[1];
      assert.ok(fns[name], `${file}: rpc ${name} has no SQL function`);
      const keys = (m[2].match(/\bp_[a-z0-9_]+(?=\s*:)/g) || []).sort();
      assert.deepEqual(keys, [...fns[name]].sort(), `${file}: rpc ${name} argument names differ from SQL`);
    }
  }
  assert.ok(calls >= 14, "expected the Level 4 UI to call at least 14 RPCs, found " + calls);
});

test("browser code never writes wallet, ledger, check-ins, entitlements or traffic directly", () => {
  for (const [file, src] of JS.concat([["assets/app.js", read("assets/app.js")]])) {
    for (const t of ["wallets", "wallet_ledger", "daily_checkins", "content_entitlements", "traffic_events", "admin_audit_log", "reward_rules"]) {
      const re = new RegExp(`from\\("${t}"\\)[^;]*\\.(insert|update|upsert|delete)\\(`);
      assert.ok(!re.test(src), `${file} writes ${t} directly`);
    }
  }
});

test("all money-changing SQL functions are SECURITY DEFINER with a pinned search_path and lock the wallet", () => {
  for (const fn of ["claim_daily_checkin", "unlock_episode", "admin_adjust_points", "admin_refund_unlock"]) {
    const body = SQL.slice(SQL.indexOf("function public." + fn + "("));
    const head = body.slice(0, 400);
    assert.match(head, /security definer set search_path = pg_catalog, public/, fn);
    assert.match(body.slice(0, 4000), /private\.lock_wallet\(/, fn + " must lock the wallet row");
  }
  assert.match(SQL, /balance bigint not null default 0 check \(balance >= 0\)/);
  assert.match(SQL, /unique \(user_id, idempotency_key\)/);
  assert.match(SQL, /primary key \(user_id, checkin_date\)/);
  assert.match(SQL, /now\(\) at time zone 'Asia\/Ho_Chi_Minh'/);
});

test("viewer-facing RPCs are not executable by anon except playback and campaign logging", () => {
  for (const fn of ["claim_daily_checkin", "unlock_episode", "admin_overview", "admin_adjust_points", "admin_set_reward_rules", "admin_refund_unlock"]) {
    assert.match(SQL, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon;`), fn);
  }
  assert.match(SQL, /grant execute on function public\.get_playback_source\(uuid\) to anon, authenticated;/);
  assert.doesNotMatch(SQL, /grant select[^;]*episode_sources[^;]*to anon/);
});

test("new UI modules do not inject data as HTML", () => {
  for (const [file, src] of JS) {
    const uses = src.match(/\.innerHTML\s*=/g) || [];
    // rewards.js builds one static report form (no user data); everything else uses textContent.
    assert.ok(uses.length <= (file.endsWith("rewards.js") && !file.includes("member") ? 1 : 0), `${file} uses innerHTML ${uses.length}×`);
  }
});

test("sites.js keeps social links empty until real accounts exist", () => {
  const sites = read("assets/sites.js");
  assert.equal((sites.match(/social: \[\]/g) || []).length, 5);
});

test("Cloudflare config: security headers, pretty film links and real 404", () => {
  const h = read("_headers");
  assert.match(h, /Content-Security-Policy: default-src 'self'/);
  assert.match(h, /frame-ancestors 'self'/);
  assert.match(h, /connect-src 'self' https:\/\/jurvphonehknrxjpowoe\.supabase\.co/);
  assert.match(read("_redirects"), /^\/phim\/:slug\s+\/\?film=:slug\s+302$/m);
  assert.match(read("404.html"), /Không tìm thấy trang này/);
});

test("Production branch content guard: index.html still declares noindex and DEMO notice", () => {
  const html = read("index.html");
  assert.match(html, /<meta name="robots" content="noindex,follow">/);
  assert.match(html, /<strong>DEMO<\/strong>/);
});
