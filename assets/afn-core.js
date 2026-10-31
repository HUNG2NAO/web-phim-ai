/* AI Film Network — Shared Core (dùng chung cho 5 website).
   Nhận diện thương hiệu, một Supabase client duy nhất cho các module mới,
   tiện ích URL phim, khóa chống trùng (idempotency) và thông báo nhỏ (toast).
   Không chứa khóa bí mật. Mọi quyền hạn được kiểm tra ở Supabase (RLS + hàm server). */
(function () {
  "use strict";
  var SITES = window.SITES || [];
  var cfg = window.AFN_AUTH_CONFIG || {};

  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }
  function hostBrand() {
    var host = location.hostname.toLowerCase().replace(/^www\./, "");
    return SITES.find(function (s) { return host === s.domain || host.endsWith("." + s.domain); }) || null;
  }
  // Same precedence as app.js: real domain → ?site= → #hash → last preview choice → first brand.
  function currentBrand() {
    var b = hostBrand();
    if (b) return b;
    var candidates = [new URLSearchParams(location.search).get("site"), location.hash.slice(1), store("pv-site")];
    return candidates.map(function (id) { return SITES.find(function (s) { return s.id === id; }); }).find(Boolean) || SITES[0] || null;
  }
  var configured = cfg.enabled === true
    && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url || "")
    && /^sb_publishable_[\w-]+$/.test(cfg.publishableKey || "")
    && !!(window.supabase && typeof window.supabase.createClient === "function");
  var clientInstance = null;
  function client() {
    if (!configured) return null;
    if (!clientInstance) {
      clientInstance = window.supabase.createClient(cfg.url, cfg.publishableKey, { auth: {
        persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce",
        storageKey: cfg.storageKey || "afn-film-auth-v1"
      } });
    }
    return clientInstance;
  }
  var userPromise = null;
  function getUser(force) {
    var c = client();
    if (!c) return Promise.resolve(null);
    if (!userPromise || force) {
      userPromise = c.auth.getUser().then(function (r) { return (r && r.data && r.data.user) || null; })
        .catch(function () { return null; });
    }
    return userPromise;
  }
  function idemKey(prefix) {
    var rnd = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() :
      Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    return (prefix + "-" + rnd).replace(/[^A-Za-z0-9_:-]/g, "").slice(0, 100);
  }
  // Share link: pretty /phim/<id> on real domains (Cloudflare _redirects), ?film= on previews.
  function filmUrl(filmId, episode) {
    var b = currentBrand();
    if (hostBrand() && b) {
      return "https://www." + b.domain + "/phim/" + encodeURIComponent(filmId) + (episode > 1 ? "/tap/" + episode : "");
    }
    var u = new URL(location.origin + location.pathname.replace(/[^/]*$/, ""));
    if (b) u.searchParams.set("site", b.id);
    u.searchParams.set("film", filmId);
    if (episode > 1) u.searchParams.set("tap", String(episode));
    return u.href;
  }
  function memberUrl(tab) {
    var u = new URL("./member.html", location.href);
    var b = currentBrand();
    if (!hostBrand() && b) u.searchParams.set("site", b.id);
    if (tab) u.hash = tab;
    return u.href;
  }
  var toastEl = null, toastTimer = 0;
  function toast(message, isError) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "afn-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.dataset.error = isError ? "true" : "false";
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 4200);
  }
  function openLogin() {
    var btn = document.querySelector(".afn-account-btn");
    if (btn) { btn.click(); return true; }
    toast("Vui lòng đăng nhập ở trang chủ của website.", true);
    return false;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }
  function formatPoints(n) { return Number(n || 0).toLocaleString("vi-VN"); }
  function vnDate(d) {
    try { return new Date(d).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }); }
    catch (e) { return String(d); }
  }
  function vnDateTime(d) {
    try { return new Date(d).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return String(d); }
  }
  // Vietnam calendar date (YYYY-MM-DD) of a moment — for display only; the server decides check-ins.
  function vnDayKey(d) {
    var parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date());
    return parts;
  }

  window.AFN = Object.freeze({
    sites: SITES,
    get brand() { return currentBrand(); },
    get siteId() { var b = currentBrand(); return b ? b.id : null; },
    get preview() { return !hostBrand(); },
    configured: configured,
    client: client,
    getUser: getUser,
    idemKey: idemKey,
    filmUrl: filmUrl,
    memberUrl: memberUrl,
    toast: toast,
    openLogin: openLogin,
    el: el,
    formatPoints: formatPoints,
    vnDate: vnDate,
    vnDateTime: vnDateTime,
    vnDayKey: vnDayKey
  });
})();
