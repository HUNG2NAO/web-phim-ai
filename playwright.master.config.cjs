// Local, offline browser acceptance for the master website (Level 4) + legacy Level 3 suite.
// Serves the repo over HTTPS at https://afn-local.pages.dev:4173 (mapped to 127.0.0.1) so every
// module behaves exactly as on a Cloudflare *.pages.dev Preview. Supabase is an in-browser mock.
const { defineConfig } = require("@playwright/test");
const BASE = "https://afn-local.pages.dev:4173";
process.env.AFN_PREVIEW_URL = process.env.AFN_PREVIEW_URL || BASE;
module.exports = defineConfig({
  testDir: "./tests",
  testMatch: ["**/e2e/*.spec.cjs", "**/level3-playwright.spec.cjs"],
  timeout: 30000,
  expect: { timeout: 8000 },
  retries: 0,
  workers: 3,
  reporter: [["line"]],
  use: {
    baseURL: BASE,
    ignoreHTTPSErrors: true,
    viewport: { width: 1365, height: 900 },
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    // Talk to the local server directly even when the machine has an outbound HTTP(S) proxy.
    launchOptions: { args: ["--host-resolver-rules=MAP afn-local.pages.dev 127.0.0.1"],
      env: Object.assign({}, process.env, { HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "", ALL_PROXY: "", all_proxy: "" }) },
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: { command: "node tests/e2e/server.cjs", port: 4173, reuseExistingServer: true, env: { PORT: "4173" } },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }]
});
