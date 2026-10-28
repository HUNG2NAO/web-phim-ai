// Static-contract smoke checks only; NOT a substitute for browser/OAuth integration tests.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const html = read("index.html");
const auth = read("assets/auth.js");
const cfg = read("assets/auth-config.js");
const sql = read("db/auth_v1.sql");

test("auth is only active on preview and cannot connect to HUNGCREATOR", () => {
  assert.match(cfg, /enabled:\s*true/);
  assert.match(cfg, /googleEnabled:\s*false/);
  assert.match(cfg, /publishableKey:\s*"sb_publishable_[A-Za-z0-9_-]+"/);
  assert.doesNotMatch(cfg, /noiuubqnrklsfbehorbe/); // Existing Supabase project ref.
});
test("same shared UI is mounted once on every site", () => {
  assert.equal((html.match(/src="assets\/auth\.js"/g) || []).length, 1);
  assert.match(html, /assets\/auth\.css/);
  assert.match(auth, /site-header \.wrap/);
  assert.match(html, /assets\/app\.js/);
});
test("each site has isolated sessions and local-only signout", () => {
  assert.match(auth, /storageKey:/);
  assert.match(auth, /scope:"local"/);
  assert.doesNotMatch(auth, /auth\.signOut\(\s*\)/);
  assert.match(auth, /persistSession:\s*true/);
});
test("login, signup, Google OAuth, confirmation and recovery are present", () => {
  for (const method of ["signInWithPassword","signUp","signInWithOAuth","resetPasswordForEmail","updateUser"]) {
    assert(auth.includes(method), method + " missing");
  }
  assert.match(auth, /emailRedirectTo/);
});
test("schema protects profiles and memberships with RLS", () => {
  assert.match(sql, /alter table public\.profiles enable row level security/);
  assert.match(sql, /alter table public\.site_memberships enable row level security/);
  assert.match(sql, /\(select auth\.uid\(\)\) = id/);
  assert.match(sql, /\(select auth\.uid\(\)\) = user_id/);
  assert.doesNotMatch(sql, /grant all on table public\.profiles to anon/);
});
test("Production demo content stays unchanged", () => {
  assert.match(html, /noindex,follow/);
  assert.match(html, /assets\/films-tuong-lai\.js/);
});
