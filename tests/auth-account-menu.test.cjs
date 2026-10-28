// Fast offline regression checks for the film-network account UX.
// Does not hit Supabase or create real users.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const js = fs.readFileSync(path.join(__dirname, "../assets/auth.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../assets/auth.css"), "utf8");

test("logged-in users get a compact account menu", () => {
  assert.match(js, /accountMenu\.id\s*=\s*"afn-account-menu"/);
  assert.match(js, /function openAccountMenu\(\)/);
  assert.match(js, /function closeAccountMenu\(\)/);
  assert.match(js, /#afn-menu-profile/);
  assert.match(js, /#afn-menu-signout/);
  assert.match(css, /\.afn-account-menu\s*\{/);
});

test("return-to-film action is not a duplicate in the profile dialog", () => {
  assert.doesNotMatch(js, /afn-profile-continue/);
  assert.match(js, /#afn-success-continue/);
  assert.match(js, /#afn-success-account/);
});

test("password recovery and login still coexist with menu", () => {
  assert.match(js, /postResetSuccess\s*=\s*true/);
  assert.match(js, /PASSWORD_RECOVERY/);
  assert.match(js, /resetPasswordForEmail/);
  assert.match(js, /signInWithPassword/);
  assert.match(js, /scope:"local"/);
});

test("safe account menu actions do not embed user-generated HTML", () => {
  assert.match(js, /#afn-menu-name"\)\.textContent/);
  assert.match(js, /#afn-menu-email"\)\.textContent/);
  assert.match(js, /if \(!slot\.contains\(event\.target\)\) closeAccountMenu\(\)/);
});
