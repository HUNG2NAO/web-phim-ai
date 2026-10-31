/* Social Hub: liên kết website ↔ mạng xã hội, theo dõi chiến dịch (UTM/ref) không thu dữ liệu cá nhân.
   Nguồn liên kết: bảng site_social_links (quản trị trong Dashboard); dự phòng: sites.js → social.
   Không hiển thị gì khi website chưa cấu hình liên kết nào (không bịa tài khoản). */
(function () {
  "use strict";
  var AFN = window.AFN;
  if (!AFN) return;
  var el = AFN.el;
  var PLATFORM = {
    facebook_page: { name: "Fanpage Facebook", icon: "f", hosts: ["facebook.com", "fb.com", "fb.me"] },
    facebook_group: { name: "Nhóm Facebook", icon: "f", hosts: ["facebook.com", "fb.com"] },
    tiktok: { name: "TikTok", icon: "♪", hosts: ["tiktok.com"] },
    youtube: { name: "YouTube", icon: "▶", hosts: ["youtube.com", "youtu.be"] },
    telegram: { name: "Telegram", icon: "✈", hosts: ["t.me", "telegram.me"] },
    zalo: { name: "Zalo", icon: "Z", hosts: ["zalo.me"] },
    instagram: { name: "Instagram", icon: "◎", hosts: ["instagram.com"] },
    other: { name: "Cộng đồng", icon: "✦", hosts: null }
  };
  function safeUrl(link) {
    try {
      var u = new URL(link.url);
      if (u.protocol !== "https:") return null;
      var p = PLATFORM[link.platform] || PLATFORM.other;
      // A "YouTube" button must really point to YouTube, etc. (blocks look-alike phishing links).
      if (p.hosts && !p.hosts.some(function (h) { return u.hostname === h || u.hostname.endsWith("." + h); })) return null;
      return u.href;
    } catch (e) { return null; }
  }
  var cache = {};
  async function links(site) {
    if (cache[site]) return cache[site];
    var list = [];
    var c = AFN.client();
    if (c) {
      try {
        var r = await c.from("site_social_links").select("platform,label,url,placements,sort_order,enabled")
          .eq("site_id", site).eq("enabled", true).order("sort_order", { ascending: true });
        if (!r.error && Array.isArray(r.data)) list = r.data;
      } catch (e) {}
    }
    if (!list.length) {
      var brand = (AFN.sites || []).find(function (s) { return s.id === site; });
      list = (brand && Array.isArray(brand.social) ? brand.social : []).map(function (x, i) {
        return { platform: x.platform, label: x.label, url: x.url, placements: x.placements || ["footer", "member"], sort_order: i };
      });
    }
    cache[site] = list.filter(function (x) { return safeUrl(x); });
    return cache[site];
  }
  function linkNode(x, compact) {
    var p = PLATFORM[x.platform] || PLATFORM.other;
    var a = el("a", "afn-social-link" + (compact ? " compact" : ""));
    a.href = safeUrl(x);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    var i = el("span", "afn-social-icon", p.icon); i.setAttribute("aria-hidden", "true");
    a.append(i, el("span", "afn-social-text", x.label || p.name));
    a.setAttribute("aria-label", (x.label || p.name) + " (mở trong thẻ mới)");
    a.dataset.platform = x.platform;
    return a;
  }
  // placement: footer | header | film | member. Returns the number of links rendered.
  async function render(container, placement, opts) {
    if (!container) return 0;
    var site = AFN.siteId;
    var list = (await links(site)).filter(function (x) { return (x.placements || []).indexOf(placement) !== -1; });
    container.replaceChildren();
    container.hidden = !list.length;
    if (!list.length) return 0;
    if (opts && opts.title) container.append(el("div", "afn-social-title", opts.title));
    var row = el("div", "afn-social-row");
    list.slice(0, (opts && opts.max) || 6).forEach(function (x) { row.append(linkNode(x, opts && opts.compact)); });
    container.append(row);
    return list.length;
  }

  // ---------------------------------------------------------------- campaign landing (Social → Website)
  function captureCampaign() {
    var url = new URL(location.href);
    var p = url.searchParams;
    var source = (p.get("utm_source") || "").slice(0, 60), medium = (p.get("utm_medium") || "").slice(0, 60);
    var campaign = (p.get("utm_campaign") || "").slice(0, 100), ref = p.get("ref") || "";
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(ref)) ref = "";
    if (!source && !medium && !campaign && !ref) return;
    if (ref) { try { localStorage.setItem("afn-ref", JSON.stringify({ code: ref, at: Date.now() })); } catch (e) {} }
    var film = p.get("film");
    var onceKey = "afn-landing:" + [AFN.siteId, source, medium, campaign, ref, film].join("|");
    var seen = false;
    try { seen = sessionStorage.getItem(onceKey) === "1"; sessionStorage.setItem(onceKey, "1"); } catch (e) {}
    var c = AFN.client();
    if (c && !seen) {
      c.rpc("log_landing", { p_site: AFN.siteId, p_path: location.pathname.slice(0, 200), p_film: film,
        p_source: source, p_medium: medium, p_campaign: campaign, p_ref: ref }).then(function () {}, function () {});
    }
    // Clean the address bar so shared links do not carry someone else's campaign tags.
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "fbclid", "gclid", "ttclid"].forEach(function (k) { url.searchParams.delete(k); });
    try { history.replaceState(history.state, "", url.href); } catch (e) {}
  }

  window.AFN_SOCIAL = Object.freeze({ render: render, links: links, platforms: PLATFORM, safeUrl: safeUrl });

  captureCampaign();
  var openFilmSocial = document.getElementById("film-social");
  if (openFilmSocial && !openFilmSocial.childElementCount && window.AFN_APP && window.AFN_APP.current()) {
    render(openFilmSocial, "film", { title: "Bàn luận phim cùng cộng đồng" });
  }
  // Homepage footer: rendered once and again whenever the preview brand switcher changes site.
  var footer = document.querySelector(".site-footer .wrap");
  if (footer) {
    var box = el("section", "afn-social");
    box.setAttribute("aria-label", "Cộng đồng trên mạng xã hội");
    box.hidden = true;
    var fine = footer.querySelector(".fineprint");
    footer.insertBefore(box, fine || null);
    var draw = function () { render(box, "footer", { title: "Theo dõi " + (AFN.brand ? AFN.brand.name : "chúng tôi") }); };
    draw();
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-site]")) setTimeout(draw, 0);
    });
  }
  var header = document.querySelector(".site-header .wrap");
  if (header) {
    var hbox = el("div", "afn-social-header");
    hbox.hidden = true;
    var search = header.querySelector(".search");
    header.insertBefore(hbox, search ? search.nextSibling : null);
    render(hbox, "header", { compact: true, max: 2 });
  }
})();
