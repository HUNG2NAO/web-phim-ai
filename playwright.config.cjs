const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  testMatch: ["**/level3-playwright.spec.cjs"],
  timeout: 30000,
  expect: { timeout: 12000 },
  retries: 1,
  use: { headless: true, viewport: {width: 1365,height: 900},
    ignoreHTTPSErrors: false, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }]
});
