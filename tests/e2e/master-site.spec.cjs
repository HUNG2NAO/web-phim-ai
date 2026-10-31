// Master website (Xưởng Phim) acceptance: check-in, wallet, unlock, playback gate, social,
// share/save/report, deep links, dashboard, second-site isolation, mobile, security headers.
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const MOCK = fs.readFileSync(path.join(__dirname, "supabase-mock.js"), "utf8");

const VIEWER = { id: "00000000-0000-4000-8000-000000000001", email: "viewer@example.test", created_at: "2026-10-01T00:00:00Z",
  email_confirmed_at: "2026-10-01T00:05:00Z", user_metadata: { display_name: "Khán giả thử" }, app_metadata: { providers: ["email"] } };
const OWNER = { id: "00000000-0000-4000-8000-0000000000aa", email: "owner@example.test", created_at: "2026-10-01T00:00:00Z",
  email_confirmed_at: "2026-10-01T00:05:00Z", user_metadata: { display_name: "Chủ hệ thống" }, app_metadata: { providers: ["email"] } };
const EP = { e1: "11111111-1111-4111-8111-000000000001", e2: "11111111-1111-4111-8111-000000000002", e3: "11111111-1111-4111-8111-000000000003" };

function vnToday(offset = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(Date.now() + offset * 864e5));
}
function seed({ user = null, balance = 0, checkedInToday = false, entitlement = false, missing = [] } = {}) {
  const t = {
    reward_rules: [{ id: 1, checkin_enabled: true, checkin_base: 10, streak_step: 2, streak_step_cap: 5, day7_bonus: 30 }],
    site_films: [{ id: "f1", site_id: "xuongphim", film_id: "tin-hieu-47", title: "Tín Hiệu 47 (thử nghiệm)", synopsis: "Phim thử nghiệm có tập mở sớm.",
      genres: ["Viễn tưởng"], year: 2026, film_type: "bo", source_kind: "youtube", youtube_id: "AAAAAAAAAAA", rights_attested: true, published: true, created_at: "2026-10-30T00:00:00Z" }],
    site_episodes: [
      { id: EP.e1, site_id: "xuongphim", film_id: "tin-hieu-47", episode_no: 1, title: "Khởi động", access_tier: "free", price_points: 0, free_from: null, access_days: null, published: true },
      { id: EP.e2, site_id: "xuongphim", film_id: "tin-hieu-47", episode_no: 2, title: "Tín hiệu lạ", access_tier: "early", price_points: 50, free_from: null, access_days: null, published: true },
      { id: EP.e3, site_id: "xuongphim", film_id: "tin-hieu-47", episode_no: 3, title: "Hội viên", access_tier: "member", price_points: 0, free_from: null, access_days: null, published: true }],
    episode_sources: [
      { episode_id: EP.e1, source_kind: "youtube", youtube_id: "EP1xxxxxxxx", video_url: null },
      { episode_id: EP.e2, source_kind: "youtube", youtube_id: "EP2xxxxxxxx", video_url: null },
      { episode_id: EP.e3, source_kind: "youtube", youtube_id: "EP3xxxxxxxx", video_url: null }],
    site_social_links: [
      { id: "s1", site_id: "xuongphim", platform: "facebook_page", label: "Fanpage Xưởng Phim", url: "https://www.facebook.com/example-test", placements: ["footer", "film", "member"], enabled: true, sort_order: 0 },
      { id: "s2", site_id: "xuongphim", platform: "youtube", label: "Nút giả mạo", url: "https://evil.example.com/watch", placements: ["footer"], enabled: true, sort_order: 1 }],
    wallets: [], wallet_ledger: [], daily_checkins: [], content_entitlements: [], content_reports: [], traffic_events: [], admin_audit_log: [],
    site_memberships: [{ user_id: VIEWER.id, site_id: "xuongphim", joined_at: "2026-10-02T00:00:00Z" }, { user_id: VIEWER.id, site_id: "khophim", joined_at: "2026-10-02T00:00:00Z" }],
    profiles: [{ id: VIEWER.id, display_name: "Khán giả thử" }],
    network_staff: [{ user_id: OWNER.id, role: "owner" }],
    site_staff: [{ user_id: OWNER.id, site_id: "xuongphim", role: "admin" }, { user_id: OWNER.id, site_id: "khophim", role: "admin" }],
    viewer_profiles: [], viewer_preferences: [], film_library: [], watch_progress: [], film_reviews: [], member_notifications: [], approved_reviews: [], member_privacy_requests: []
  };
  if (balance) {
    t.wallets.push({ user_id: VIEWER.id, balance, earned_total: balance, spent_total: 0 });
    t.wallet_ledger.push({ id: 1, user_id: VIEWER.id, site_id: null, kind: "admin_credit", delta: balance, balance_after: balance, idempotency_key: "seed-0001", note: "Điểm khởi tạo thử nghiệm", created_at: "2026-10-30T01:00:00Z" });
  }
  if (checkedInToday) t.daily_checkins.push({ user_id: VIEWER.id, checkin_date: vnToday(), site_id: "xuongphim", streak: 1, points: 10 });
  if (entitlement) t.content_entitlements.push({ id: "22222222-2222-4222-8222-000000000001", user_id: VIEWER.id, episode_id: EP.e2, site_id: "xuongphim",
    film_id: "tin-hieu-47", episode_no: 2, points_paid: 50, status: "active", granted_at: "2026-10-30T02:00:00Z", expires_at: null });
  return { tables: t, user, missing };
}
async function setup(page, opts = {}) {
  const issues = [];
  await page.addInitScript(s => {
    window.__AFN_MOCK_SEED = s; window.__csp = [];
    document.addEventListener("securitypolicyviolation", e => window.__csp.push(e.violatedDirective + " " + e.blockedURI));
  }, seed(opts));
  await page.route("**/supabase.min.js", r => r.fulfill({ status: 200, contentType: "application/javascript", body: MOCK }));
  await page.route("**/assets/auth-config.js", r => r.fulfill({ status: 200, contentType: "application/javascript",
    body: 'window.AFN_AUTH_CONFIG={enabled:true,googleEnabled:false,url:"https://jurvphonehknrxjpowoe.supabase.co",publishableKey:"sb_publishable_e2e_key_123456789",storageKey:"afn-e2e"};' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route(/(youtube|youtube-nocookie|ytimg)\.com/, r => r.abort());
  page.on("pageerror", e => issues.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) issues.push("console: " + m.text()); });
  page.on("dialog", d => d.accept(d.type() === "prompt" ? d.defaultValue() : undefined));
  return issues;
}
async function cspViolations(page) { return page.evaluate(() => window.__csp || []); }
async function mock(page) { return page.evaluate(() => window.__AFN_MOCK.db); }

test.describe("Website mẫu — khách chưa đăng nhập", () => {
  test("trang chủ: nút điểm danh, Social an toàn, không lỗi, không vi phạm CSP", async ({ page }) => {
    const issues = await setup(page);
    const res = await page.goto("/?site=xuongphim");
    expect(res.headers()["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    await expect(page.locator(".afn-reward-chip")).toContainText("Điểm danh");
    const social = page.locator(".site-footer .afn-social");
    await expect(social.locator(".afn-social-link")).toHaveCount(1);
    await expect(social.locator(".afn-social-link")).toHaveAttribute("href", "https://www.facebook.com/example-test");
    await expect(social.locator(".afn-social-link")).toHaveAttribute("rel", "noopener noreferrer");
    await expect(page.locator(".afn-reward-pop")).toBeHidden();
    await page.locator(".afn-reward-chip").click();
    await expect(page.locator(".afn-reward-pop")).toBeVisible();
    await expect(page.locator(".afn-streak li")).toHaveCount(7);
    await expect(page.locator(".afn-reward-pop")).toContainText("Đăng nhập để điểm danh");
    expect(await cspViolations(page)).toEqual([]);
    expect(issues).toEqual([]);
  });

  test("đường dẫn đẹp /phim/…/tap/2 mở đúng phim, tập khóa không lộ nguồn phát", async ({ page }) => {
    const issues = await setup(page);
    await page.goto("/phim/tin-hieu-47/tap/2");
    await expect(page).toHaveURL(/film=tin-hieu-47&tap=2/);
    await expect(page.locator("#film-dialog")).toBeVisible();
    await expect(page.locator("#film-title")).toHaveText("Tín Hiệu 47 (thử nghiệm)");
    await expect(page.locator(".episodes button")).toHaveCount(3);
    await expect(page.locator('.episodes [data-ep="2"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('.episodes [data-ep="2"] .ep-badge.early')).toHaveText("Sớm 50");
    await page.locator("#play-btn").click();
    await expect(page.locator(".player-gate")).toContainText("mở sớm cho thành viên với 50 điểm");
    await expect(page.locator(".player-gate button")).toHaveText("Đăng nhập để xem");
    expect(await page.locator("#player iframe").count()).toBe(0);
    await page.locator('.episodes [data-ep="1"]').click();
    await expect(page.locator('#player iframe[src*="youtube-nocookie.com/embed/EP1xxxxxxxx"]')).toHaveCount(1);
    await expect(page).toHaveURL(/film=tin-hieu-47(?!&tap)/);
    await page.locator('.episodes [data-ep="3"]').click();
    await expect(page.locator(".player-gate")).toContainText("dành cho thành viên");
    await page.keyboard.press("Escape");
    await expect(page.locator("#film-dialog")).toBeHidden();
    await expect(page).not.toHaveURL(/film=/);
    expect(await cspViolations(page)).toEqual([]);
    expect(issues).toEqual([]);
  });

  test("trang không tồn tại trả 404 thật", async ({ page }) => {
    const r = await page.goto("/khong-ton-tai-xyz.html");
    expect(r.status()).toBe(404);
    expect(await r.text()).toContain("Không tìm thấy trang này");
    await page.goto("/khong-ton-tai");
    await expect(page.locator("h1")).toHaveText("Không tìm thấy trang này");
  });

  test("Social → Website: ghi nhận chiến dịch UTM một lần, làm sạch địa chỉ", async ({ page }) => {
    await setup(page);
    await page.goto("/?site=xuongphim&utm_source=facebook&utm_medium=social&utm_campaign=ra-mat&ref=nhom_a&film=tin-hieu-47");
    await expect(page.locator("#film-dialog")).toBeVisible();
    await expect(page).not.toHaveURL(/utm_|ref=/);
    await expect(page).toHaveURL(/film=tin-hieu-47/);
    let db = await mock(page);
    expect(db.traffic_events).toHaveLength(1);
    expect(db.traffic_events[0]).toMatchObject({ site_id: "xuongphim", utm_source: "facebook", utm_campaign: "ra-mat", ref_code: "nhom_a", film_id: "tin-hieu-47" });
    await page.goto("/?site=xuongphim&utm_source=facebook&utm_medium=social&utm_campaign=ra-mat&ref=nhom_a&film=tin-hieu-47");
    db = await mock(page);
    expect(db.traffic_events).toHaveLength(1);
  });
});

test.describe("Website mẫu — thành viên", () => {
  test("điểm danh từ header: +10 điểm, không điểm danh lần hai", async ({ page }) => {
    const issues = await setup(page, { user: VIEWER });
    await page.goto("/?site=xuongphim");
    const chip = page.locator(".afn-reward-chip");
    await expect(chip.locator(".afn-chip-points")).toHaveText("0");
    await expect(chip.locator(".afn-chip-dot")).toHaveCount(1);
    await chip.click();
    await page.locator(".afn-checkin-btn").click();
    await expect(page.locator(".afn-toast")).toContainText("+10 điểm");
    await expect(chip.locator(".afn-chip-points")).toHaveText("10");
    await expect(chip.locator(".afn-chip-dot")).toHaveCount(0);
    await chip.click();
    await expect(page.locator(".afn-checkin-btn")).toBeDisabled();
    await expect(page.locator(".afn-checkin-btn")).toContainText("Đã điểm danh hôm nay");
    const db = await mock(page);
    expect(db.daily_checkins).toHaveLength(1);
    expect(db.wallet_ledger.filter(x => x.kind === "checkin")).toHaveLength(1);
    expect(issues).toEqual([]);
  });

  test("không đủ điểm: báo thiếu, không trừ điểm, mời điểm danh", async ({ page }) => {
    await setup(page, { user: VIEWER, balance: 30 });
    await page.goto("/?site=xuongphim&film=tin-hieu-47&tap=2");
    await page.locator("#play-btn").click();
    await expect(page.locator(".player-gate")).toContainText("Số dư của bạn: 30 điểm");
    await page.locator(".player-gate button").click();
    await expect(page.locator(".player-gate")).toContainText("cần thêm 20 điểm");
    await expect(page.locator(".player-gate button")).toHaveText("Điểm danh hôm nay");
    const db = await mock(page);
    expect(db.wallets[0].balance).toBe(30);
    expect(db.content_entitlements).toHaveLength(0);
  });

  test("mở khóa tập bằng điểm: trừ một lần, phát được, mở lại không trừ thêm", async ({ page }) => {
    const issues = await setup(page, { user: VIEWER, balance: 120 });
    await page.goto("/?site=xuongphim&film=tin-hieu-47&tap=2");
    await page.locator("#play-btn").click();
    await page.locator(".player-gate button", { hasText: "Mở khóa · 50 điểm" }).click();
    await expect(page.locator('#player iframe[src*="EP2xxxxxxxx"]')).toHaveCount(1);
    await expect(page.locator(".afn-toast")).toContainText("Đã mở khóa tập 2");
    await expect(page.locator(".afn-reward-chip .afn-chip-points")).toHaveText("70");
    await page.keyboard.press("Escape");
    await page.goto("/?site=xuongphim&film=tin-hieu-47&tap=2");
    await page.locator("#play-btn").click();
    await expect(page.locator('#player iframe[src*="EP2xxxxxxxx"]')).toHaveCount(1);
    const db = await mock(page);
    expect(db.wallet_ledger.filter(x => x.kind === "unlock")).toHaveLength(1);
    expect(db.wallets[0].balance).toBe(70);
    const unlockCalls = await page.evaluate(() => window.__AFN_MOCK.calls.filter(c => c.rpc === "unlock_episode").length);
    expect(unlockCalls).toBe(0);
    expect(issues).toEqual([]);
  });

  test("lưu phim, chia sẻ liên kết, báo lỗi", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await setup(page, { user: VIEWER });
    await page.goto("/?site=xuongphim&film=tin-hieu-47");
    const save = page.locator(".film-actions .afn-act", { hasText: "Lưu phim" });
    await save.click();
    await expect(page.locator(".film-actions .afn-act").first()).toHaveText("♥ Đã lưu");
    await page.locator(".film-actions .afn-act", { hasText: "Chia sẻ" }).click();
    await expect(page.locator(".afn-toast")).toContainText("Đã sao chép liên kết phim");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("film=tin-hieu-47");
    expect(copied).toContain("site=xuongphim");
    await expect(page.locator(".afn-report")).toBeHidden();
    await page.locator(".film-actions .afn-act", { hasText: "Báo lỗi" }).click();
    await expect(page.locator(".afn-report")).toBeVisible();
    await page.locator(".afn-report select").selectOption("video_error");
    await page.locator(".afn-report textarea").fill("Tập 1 bị giật");
    await page.locator(".afn-report button[type=submit]").click();
    await expect(page.locator(".afn-toast")).toContainText("Báo lỗi đã được gửi");
    await expect(page.locator("#film-social .afn-social-link")).toHaveCount(1);
    const db = await mock(page);
    expect(db.film_library).toHaveLength(1);
    expect(db.film_library[0]).toMatchObject({ film_id: "tin-hieu-47", collection: "favorite", site_id: "xuongphim" });
    expect(db.viewer_profiles).toHaveLength(1);
    expect(db.content_reports[0]).toMatchObject({ film_id: "tin-hieu-47", kind: "video_error", note: "Tập 1 bị giật", site_id: "xuongphim" });
  });

  test("Member Hub: tab Điểm thưởng hiển thị ví, lịch sử, nội dung đã mở khóa; điểm danh tại hub", async ({ page }) => {
    const issues = await setup(page, { user: VIEWER, balance: 80, entitlement: true });
    await page.goto("/member.html?site=xuongphim#rewards");
    await expect(page.locator("#tab-rewards")).toBeVisible();
    await expect(page.locator(".rw-card").first()).toContainText("80");
    await expect(page.locator("#rewards-root")).toContainText("tin-hieu-47 · Tập 2");
    await page.locator("#rewards-root .btn.primary", { hasText: "Điểm danh nhận" }).click();
    await expect(page.locator(".rw-card").first()).toContainText("90");
    await expect(page.locator("#rewards-root")).toContainText("Lịch sử điểm danh");
    await expect(page.locator("#rewards-root .rw-row").filter({ hasText: "Điểm danh" }).first()).toContainText("+10");
    await page.locator('[data-tab="community"]').click();
    await expect(page.locator("#member-social .afn-social-link")).toHaveText(/Fanpage Xưởng Phim/);
    expect(issues).toEqual([]);
  });
});

test.describe("Đồng bộ đa website — site Preview thứ hai (Kho Phim)", () => {
  test("cùng ví, điểm danh 1 lần toàn mạng, nội dung & Social tách riêng", async ({ page }) => {
    const issues = await setup(page, { user: VIEWER, balance: 40, checkedInToday: true });
    await page.goto("/?site=khophim");
    await expect(page.locator("#logo")).toContainText("KhoPhim");
    await expect(page.locator(".afn-reward-chip .afn-chip-points")).toHaveText("40");
    await expect(page.locator(".site-footer .afn-social")).toBeHidden();
    await page.locator(".afn-reward-chip").click();
    await expect(page.locator(".afn-checkin-btn")).toBeDisabled();
    await page.locator("#q").fill("Tín Hiệu");
    await expect(page.locator("#content")).toContainText("0 phim");
    await page.goto("/member.html?site=khophim#rewards");
    await expect(page.locator(".rw-card").first()).toContainText("40");
    await expect(page.locator("#rewards-root")).toContainText("Đã điểm danh hôm nay");
    expect(issues).toEqual([]);
  });
});

test.describe("Dashboard quản trị", () => {
  test("tổng quan, thêm tập mở sớm, cấu hình điểm danh, Social, traffic, nhật ký, phân quyền", async ({ page }) => {
    const issues = await setup(page, { user: OWNER });
    await page.goto("/admin.html?site=xuongphim");
    await expect(page.locator("#studio-app")).toBeVisible();
    await expect(page.locator("#ops-overview .ops-card")).toHaveCount(13);
    await expect(page.locator("#ops-overview")).toContainText("Tập đang khóa");

    await page.locator('[data-studio-tab="episodes"]').click();
    await expect(page.locator("#ops-episodes tbody tr")).toHaveCount(3);
    await expect(page.locator("#ops-ep-no")).toHaveValue("4");
    await page.locator("#ops-ep-title").fill("Tập mới");
    await page.locator("#ops-ep-tier").selectOption("early");
    await page.locator("#ops-ep-price").fill("30");
    await page.locator("#ops-ep-video").fill("EP4xxxxxxxx");
    await page.locator("#ops-ep-published").check();
    await page.locator("#ops-ep-save").click();
    await expect(page.locator("#studio-status")).toContainText("Cần xác nhận quyền phát hành");
    await page.locator("#ops-ep-rights").check();
    await page.locator("#ops-ep-save").click();
    await expect(page.locator("#studio-status")).toContainText("Đã lưu tập phim");
    await expect(page.locator("#ops-episodes tbody tr")).toHaveCount(4);
    await expect(page.locator("#ops-episodes tbody tr").nth(3)).toContainText("Đã phát hành");

    await page.locator('[data-studio-tab="wallet"]').click();
    await expect(page.locator("#ops-rule-preview")).toContainText("N7: 50");
    await page.locator("#ops-rule-base").fill("15");
    await page.locator("#ops-rules-save").click();
    await expect(page.locator("#studio-status")).toContainText("Đã lưu cấu hình điểm danh");

    await page.locator('[data-studio-tab="social"]').click();
    await page.locator("#ops-social-platform").selectOption("tiktok");
    await page.locator("#ops-social-label").fill("TikTok giả");
    await page.locator("#ops-social-url").fill("https://tiktok.evil.example/@x");
    await page.locator("#ops-social-form button[type=submit]").click();
    await expect(page.locator("#studio-status")).toContainText("không thuộc TikTok");
    await page.locator("#ops-social-url").fill("https://www.tiktok.com/@xuongphim-test");
    await page.locator("#ops-social-label").fill("TikTok Xưởng Phim");
    await page.locator("#ops-social-form button[type=submit]").click();
    await expect(page.locator("#ops-social-list")).toContainText("TikTok Xưởng Phim");

    await page.locator('[data-studio-tab="traffic"]').click();
    await page.locator("#ops-utm-source").fill("tiktok");
    await page.locator("#ops-utm-campaign").fill("Ra mắt tập 4");
    await page.locator("#ops-utm-film").fill("tin-hieu-47");
    await page.locator("#ops-utm-form button[type=submit]").click();
    await expect(page.locator("#ops-utm-out")).toHaveText("https://www.xuongphim.ai/?film=tin-hieu-47&utm_source=tiktok&utm_campaign=ra-m%E1%BA%AFt-t%E1%BA%ADp-4");

    await page.locator('[data-studio-tab="audit"]').click();
    await page.locator("#studio-reload").click();
    await expect(page.locator("#ops-audit")).toContainText("reward_rules.update");
    await page.locator('[data-studio-tab="staff"]').click();
    await expect(page.locator("#ops-staff")).toContainText("Chủ hệ thống (5 website)");
    const db = await mock(page);
    expect(db.reward_rules[0].checkin_base).toBe(15);
    expect(db.site_episodes.find(e => e.episode_no === 4)).toMatchObject({ access_tier: "early", price_points: 30, published: true });
    expect(db.episode_sources.find(s => s.youtube_id === "EP4xxxxxxxx")).toBeTruthy();
    expect(issues).toEqual([]);
  });

  test("ví thành viên: xem lịch sử, điều chỉnh có lý do, hoàn điểm lượt mở khóa", async ({ page }) => {
    await setup(page, { user: OWNER, balance: 60, entitlement: true });
    await page.goto("/admin.html?site=xuongphim");
    await page.locator('[data-studio-tab="wallet"]').click();
    await expect(page.locator("#ops-members tbody tr")).toHaveCount(1);
    await page.locator("#ops-members button", { hasText: "Lịch sử" }).click();
    await expect(page.locator("#ops-ledger")).toContainText("Điểm khởi tạo thử nghiệm");
    await page.locator("#ops-adjust-delta").fill("25");
    await page.locator("#ops-adjust-reason").fill("Thưởng sự kiện cộng đồng");
    await page.locator("#ops-adjust-form button[type=submit]").click();
    await expect(page.locator("#studio-status")).toContainText("Số dư mới: 85");
    await page.locator("#ops-ents button", { hasText: "Hoàn điểm" }).click();
    await expect(page.locator("#studio-status")).toContainText("Đã hoàn 50 điểm");
    const db = await mock(page);
    expect(db.wallets[0].balance).toBe(135);
    expect(db.content_entitlements[0].status).toBe("refunded");
  });

  test("người xem thường không vào được Dashboard", async ({ page }) => {
    await setup(page, { user: VIEWER });
    await page.goto("/admin.html?site=xuongphim");
    await expect(page.locator("#studio-denied")).toBeVisible();
    await expect(page.locator("#studio-app")).toBeHidden();
  });
});

test.describe("Responsive & hồi quy", () => {
  test("Supabase chưa chạy migration Level 4: ẩn nút điểm danh, trang vẫn hoạt động", async ({ page }) => {
    const issues = await setup(page, { user: VIEWER, missing: ["reward_rules", "wallets", "daily_checkins", "site_episodes", "site_social_links"] });
    await page.goto("/?site=xuongphim");
    await expect(page.locator("#content .card").first()).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator(".afn-reward-slot")).toBeHidden();
    await expect(page.locator(".site-footer .afn-social")).toBeHidden();
    expect(issues).toEqual([]);
  });
  test("điện thoại 375px: không cuộn ngang ở trang chủ, cửa sổ phim, Member Hub", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const issues = await setup(page, { user: VIEWER, balance: 20 });
    for (const url of ["/?site=xuongphim", "/?site=xuongphim&film=tin-hieu-47&tap=2", "/member.html?site=xuongphim#rewards"]) {
      await page.goto(url);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, url).toBeLessThanOrEqual(0);
    }
    await page.goto("/?site=xuongphim&film=tin-hieu-47");
    await expect(page.locator(".film-actions .afn-act")).toHaveCount(3);
    const chip = await page.locator(".afn-reward-chip").boundingBox();
    expect(chip.width).toBeLessThan(120);
    expect(chip.height).toBeGreaterThanOrEqual(38);
    expect(issues).toEqual([]);
  });

  test("phim mẫu cũ vẫn hoạt động: điều hướng, tìm kiếm, mở/đóng phim, URL riêng", async ({ page }) => {
    const issues = await setup(page);
    await page.goto("/?site=phimhay");
    await page.locator('[data-nav="kho"]').click();
    expect(await page.locator("#content .card").count()).toBeGreaterThan(5);
    await page.locator("#q").fill("kiếm");
    await expect(page.locator("#content")).toContainText("Kết quả cho");
    await page.locator("#q").fill("");
    await page.locator("#content .card").first().click();
    await expect(page.locator("#film-dialog")).toBeVisible();
    await expect(page).toHaveURL(/film=/);
    await page.locator("#play-btn").click();
    await expect(page.locator("#player .note")).toContainText("chưa có video");
    await page.locator("#close-film").click();
    await expect(page).not.toHaveURL(/film=/);
    expect(issues).toEqual([]);
  });
});

test.describe("Giao diện website mẫu — sidebar, poster 16:9, trải nghiệm xem phim", () => {
  test("sidebar thu gọn: giữ tên truy cập được, ghi nhớ trạng thái, liên kết Của tôi mang theo site", async ({ page }) => {
    const issues = await setup(page);
    await page.goto("/?site=xuongphim");
    const side = page.locator("#sidebar");
    await expect(side).toBeVisible();
    expect(Math.round((await side.boundingBox()).width)).toBeGreaterThan(200);
    await expect(page.locator('#side-me [data-member-tab="rewards"]')).toHaveAttribute("href", "member.html?site=xuongphim#rewards");
    await expect(page.locator("#side-network a")).toHaveCount(5);
    await page.locator("#side-toggle").click();
    await expect(page.locator("#side-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect.poll(async () => Math.round((await side.boundingBox()).width)).toBeLessThan(90);
    await expect(page.getByRole("button", { name: "Kho phim", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-side", "collapsed");
    await page.getByRole("button", { name: "Phim bộ", exact: true }).click();
    await expect(page.locator('[data-nav="bo"]')).toHaveAttribute("aria-current", "true");
    await page.locator("#side-toggle").click();
    await expect(page.locator("body")).toHaveAttribute("data-side", "expanded");
    expect(issues).toEqual([]);
  });

  test("poster 16:9 ở trang chủ, kho phim và bảng xếp hạng", async ({ page }) => {
    const issues = await setup(page);
    await page.goto("/?site=khophim");
    const ratios = await page.evaluate(() => [...document.querySelectorAll("#content .card .poster, #content .rank .poster")].slice(0, 12)
      .map(p => { const r = p.getBoundingClientRect(); return r.width / r.height; }));
    expect(ratios.length).toBeGreaterThan(8);
    for (const r of ratios) expect(Math.abs(r - 16 / 9)).toBeLessThan(0.03);
    await page.locator('[data-nav="kho"]').click();
    const cols = await page.evaluate(() => getComputedStyle(document.querySelector("#content .grid")).gridTemplateColumns.split(" ").length);
    expect(cols).toBeGreaterThanOrEqual(3);
    expect(issues).toEqual([]);
  });

  test("xem phim: thanh tập trước/tiếp, danh sách tập có tên, cổng mở khóa, Xem tiếp trên trang chủ", async ({ page }) => {
    const issues = await setup(page, { user: VIEWER, balance: 120 });
    await page.goto("/phim/tin-hieu-47?site=xuongphim");
    await expect(page.locator("#film-dialog")).toBeVisible();
    await expect(page.locator(".episodes [data-ep]")).toHaveCount(3);
    await expect(page.locator('.episodes [data-ep="2"] .ep-name')).toHaveText("Tín hiệu lạ");
    await expect(page.locator("#pb-now")).toContainText("Tập 01 / 03");
    await expect(page.locator('[data-ep-step="-1"]')).toBeDisabled();
    await page.locator("#play-btn").click();
    await expect(page.locator("#player .youtube-player")).toBeVisible();
    await page.locator('[data-ep-step="1"]').click();
    await expect(page.locator("#pb-now")).toContainText("Tập 02 / 03 · Tín hiệu lạ");
    await expect(page).toHaveURL(/tap=2/);
    await expect(page.locator("#player .player-gate")).toContainText("50 điểm");
    // Tập 3 dành cho thành viên đã đăng nhập: phát được ngay, nút "Tập tiếp" bị vô hiệu ở tập cuối.
    await page.locator('[data-ep-step="1"]').click();
    await expect(page.locator('[data-ep-step="1"]')).toBeDisabled();
    await expect(page.locator("#player .youtube-player")).toBeVisible();
    await page.locator("#close-film").click();
    await page.goto("/?site=xuongphim");
    const row = page.locator(".continue-row");
    await expect(row).toBeVisible();
    await expect(row.locator(".card")).toHaveCount(1);
    // Tập 2 bị khóa nên không được ghi là "đang xem"; tập cuối đã phát là tập 3.
    await expect(row.locator(".cw-badge")).toHaveText("Tập 3");
    await row.locator(".card").click();
    await expect(page.locator("#film-dialog")).toBeVisible();
    await expect(page.locator('.episodes [data-ep="3"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/tap=3/);
    // Lịch sử xem chỉ lưu trên site này: site khác không thấy.
    await page.goto("/?site=khophim");
    await expect(page.locator(".continue-row")).toHaveCount(0);
    expect(issues).toEqual([]);
  });

  test("điện thoại: thanh tab dưới thay sidebar, cửa sổ phim toàn màn hình, không che nội dung", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const issues = await setup(page);
    await page.goto("/?site=xuongphim");
    await expect(page.locator("#side-toggle")).toBeHidden();
    await expect(page.locator("#side-me")).toBeHidden();
    const bar = await page.locator("#sidebar").boundingBox();
    expect(bar.y + bar.height).toBeGreaterThanOrEqual(811);
    expect(bar.height).toBeLessThan(80);
    const sizes = await page.locator("#sidebar .nav button").evaluateAll(bs => bs.map(b => b.getBoundingClientRect().height));
    expect(sizes).toHaveLength(5);
    for (const h of sizes) expect(h).toBeGreaterThanOrEqual(44);
    await page.locator('[data-nav="ngan"]').click();
    await expect(page.locator('[data-nav="ngan"]')).toHaveAttribute("aria-current", "true");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const fine = await page.locator(".fineprint").boundingBox();
    expect(fine.y + fine.height).toBeLessThanOrEqual(bar.y + 1);
    await page.locator("#content .card").first().click();
    const dlg = await page.locator("#film-dialog").boundingBox();
    expect(Math.round(dlg.width)).toBe(375);
    await expect(page.locator("#close-film")).toBeInViewport();
    expect(issues).toEqual([]);
  });
});

test.describe("Shared Core — cùng một khung giao diện cho cả 5 website", () => {
  for (const [id, name] of [["xuongphim", "XưởngPhim"], ["khophim", "KhoPhim"], ["phephim", "PhêPhim"], ["phimhay", "PhimHay"], ["ghienphim", "GhiềnPhim"]]) {
    test(id + ": sidebar, poster 16:9, cửa sổ phim, đánh dấu đúng site, không lỗi", async ({ page }) => {
      const issues = await setup(page, { user: VIEWER, balance: 30 });
      await page.goto("/?site=" + id);
      await expect(page.locator("#logo .name")).toContainText(name);
      await expect(page.locator('#side-network a[aria-current="true"]')).toHaveCount(1);
      await expect(page.locator('#side-network a[aria-current="true"]')).toHaveAttribute("href", new RegExp(id + "\\.ai"));
      await expect(page.locator(".afn-reward-chip")).toBeVisible();
      const poster = await page.locator("#content .card .poster").first().boundingBox();
      expect(Math.abs(poster.width / poster.height - 16 / 9)).toBeLessThan(0.03);
      await page.locator("#content .card").first().click();
      await expect(page.locator("#film-dialog")).toBeVisible();
      await expect(page.locator("#film-actions .afn-act")).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      expect(await cspViolations(page)).toEqual([]);
      expect(issues).toEqual([]);
    });
  }
});
