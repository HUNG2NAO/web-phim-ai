(function () {
  "use strict";
  var SITES = window.SITES || [];
  var ALL_FILMS = window.FILMS || [];
  var TYPE_LABEL = { le: "Phim lẻ", bo: "Phim bộ", ngan: "Phim ngắn" };
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---------- 1. Nhận diện site theo tên miền ---------- */
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }
  function detectSite() {
    var host = location.hostname.toLowerCase().replace(/^www\./, "");
    var byHost = SITES.find(function (s) { return host === s.domain || host.endsWith("." + s.domain); });
    if (byHost) return { site: byHost, preview: false };
    var wanted = new URLSearchParams(location.search).get("site") || location.hash.slice(1) || store("pv-site");
    var site = SITES.find(function (s) { return s.id === wanted; }) || SITES[0];
    return { site: site, preview: true };
  }

  var state = detectSite();
  var site = state.site;
  var films = [];
  var view = { kind: "home" };

  function filmsFor(s) {
    return ALL_FILMS.filter(function (f) { return !f.sites || f.sites.indexOf(s.id) !== -1; });
  }
  function byId(id) { return films.find(function (f) { return f.id === id; }); }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function norm(t) { return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }

  function applyFilter(filter) {
    var list = films.slice();
    if (filter.trending) list = list.filter(function (f) { return f.trending; });
    if (filter.type) list = list.filter(function (f) { return f.type === filter.type; });
    if (filter.genre) list = list.filter(function (f) { return f.genres.indexOf(filter.genre) !== -1; });
    if (filter.newest) list.sort(function (a, b) { return b.year - a.year; });
    return list;
  }

  /* ---------- 2. Áp thương hiệu ---------- */
  function applyBrand() {
    films = filmsFor(site);
    var root = document.documentElement.style;
    root.setProperty("--accent", site.accent);
    root.setProperty("--on-accent", site.onAccent);
    document.title = site.name + ".ai – " + site.tagline;
    var meta = $('meta[name="description"]'); if (meta) meta.setAttribute("content", site.name + ".ai: " + site.tagline + ".");
    var theme = $('meta[name="theme-color"]'); if (theme) theme.setAttribute("content", "#0E0D0C");
    $("#logo").innerHTML = '<span>' + esc(site.name.replace(/\s+/g, "")) + '</span><span class="tld">.ai</span>';
    $("#logo").setAttribute("aria-label", site.name + ".ai, về trang chủ");
    $("#tagline").textContent = site.tagline;
    renderNetwork();
    renderPreviewBar();
  }

  function renderPreviewBar() {
    var bar = $("#preview-bar");
    bar.hidden = !state.preview;
    if (!state.preview) return;
    $("#pv-pills").innerHTML = SITES.map(function (s) {
      return '<button class="pv-pill" type="button" data-site="' + s.id + '" aria-pressed="' + (s.id === site.id) + '" style="--c:' + s.accent + '">' +
        '<span class="dot"></span>' + esc(s.domain) + '</button>';
    }).join("");
  }

  function renderNetwork() {
    $("#network").innerHTML = SITES.map(function (s) {
      return '<a href="https://' + s.domain + '" style="--c:' + s.accent + '"' + (s.id === site.id ? ' aria-current="true"' : "") + '>' +
        '<span class="dot"></span>' + esc(s.domain) + '</a>';
    }).join("");
  }

  /* ---------- 3. Thành phần giao diện ---------- */
  function posterHTML(f, opts) {
    opts = opts || {};
    var style = "--h1:" + f.hue[0] + ";--h2:" + f.hue[1] + ";";
    if (f.poster) style += "background-image:url('" + encodeURI(f.poster) + "');";
    var badges = opts.badges === false ? "" :
      '<div class="p-badges"><span class="badge">' + esc(f.quality) + '</span>' +
      (f.type === "bo" ? '<span class="badge accent">' + f.episodes + ' tập</span>' : f.type === "ngan" ? '<span class="badge accent">Ngắn</span>' : "") + '</div>';
    return '<div class="poster' + (f.poster ? " has-img" : "") + '" style="' + style + '">' + badges +
      '<div class="p-title">' + esc(f.title) + '</div></div>';
  }

  function cardHTML(f) {
    return '<button class="card" type="button" data-film="' + f.id + '" aria-label="' + esc(f.title) + '">' +
      posterHTML(f) +
      '<span class="c-title">' + esc(f.title) + '</span>' +
      '<span class="c-meta">' + f.year + ' · ' + esc(f.duration.split(" · ")[0]) + ' · ' + esc(f.genres[0]) + '</span>' +
      '</button>';
  }

  function heroHTML(f) {
    var cells = [
      ["Thể loại", TYPE_LABEL[f.type]],
      ["Năm", f.year],
      ["Thời lượng", f.duration.split(" · ")[0]],
      ["Khung hình", f.ratio],
      ["Chất lượng", f.quality]
    ];
    return '<section class="hero" aria-label="Phim nổi bật">' +
      '<div class="hero-art">' + posterHTML(f, { badges: false }).replace('class="poster', 'class="poster hero-poster') + '</div>' +
      '<div class="wrap"><div class="hero-inner">' +
      '<div class="slate" aria-hidden="true"><span class="stripes"></span><span class="cells">' +
      cells.map(function (c) { return '<span class="cell"><b>' + esc(c[0]) + '</b>' + esc(c[1]) + '</span>'; }).join("") +
      '</span></div>' +
      '<h1>' + esc(f.title) + '</h1>' +
      '<div class="tags"><span class="tag age">' + esc(f.age) + '</span>' +
      f.genres.map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join("") + '</div>' +
      '<p class="synopsis">' + esc(f.synopsis) + '</p>' +
      '<div class="actions">' +
      '<button class="btn primary" type="button" data-film="' + f.id + '" data-play="1">' + playIcon(18) + 'Xem ngay</button>' +
      '<button class="btn ghost" type="button" data-film="' + f.id + '">Thông tin phim</button>' +
      '</div></div></div></section>';
  }

  function rowHTML(title, list, filter) {
    if (!list.length) return "";
    return '<section><div class="row-head"><h2>' + esc(title) + '</h2>' +
      '<button class="more" type="button" data-more="' + esc(JSON.stringify(filter)) + '" data-title="' + esc(title) + '">Xem tất cả</button></div>' +
      '<div class="scroller">' + list.map(cardHTML).join("") + '</div></section>';
  }

  function gridHTML(title, list) {
    return '<section><div class="row-head"><h2>' + esc(title) + '</h2><span class="count">' + list.length + ' phim</span></div>' +
      (list.length ? '<div class="grid">' + list.map(cardHTML).join("") + '</div>' :
        '<p class="empty">Chưa có phim phù hợp. Thử từ khoá khác hoặc chọn thể loại khác.</p>') + '</section>';
  }

  function genresHTML(active) {
    var all = [];
    films.forEach(function (f) { f.genres.forEach(function (g) { if (all.indexOf(g) === -1) all.push(g); }); });
    all.sort(function (a, b) { return a.localeCompare(b, "vi"); });
    return '<section><div class="row-head"><h2>Khám phá theo thể loại</h2></div><div class="genres">' +
      all.map(function (g) { return '<button class="chip" type="button" data-genre="' + esc(g) + '" aria-pressed="' + (g === active) + '">' + esc(g) + '</button>'; }).join("") +
      '</div></section>';
  }

  function playIcon(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>';
  }

  /* ---------- 4. Hiển thị trang ---------- */
  function render() {
    var out = "";
    var heroSlot = $("#hero-slot");
    document.querySelectorAll(".nav button").forEach(function (b) {
      var on = (view.kind === "home" && b.dataset.nav === "home") || (view.kind === "type" && b.dataset.nav === view.type);
      b.setAttribute("aria-current", on ? "true" : "false");
    });

    if (view.kind === "home") {
      var featured = byId(site.featured) || films[0];
      heroSlot.innerHTML = featured ? heroHTML(featured) : "";
      out = site.rows.map(function (r) { return rowHTML(r.title, applyFilter(r.filter), r.filter); }).join("") + genresHTML();
    } else {
      heroSlot.innerHTML = "";
      if (view.kind === "type") out = gridHTML(TYPE_LABEL[view.type], applyFilter({ type: view.type }));
      if (view.kind === "genre") out = genresHTML(view.genre) + gridHTML(view.genre, applyFilter({ genre: view.genre }));
      if (view.kind === "list") out = gridHTML(view.title, applyFilter(view.filter));
      if (view.kind === "search") {
        var q = norm(view.q);
        out = gridHTML('Kết quả cho “' + view.q + '”', films.filter(function (f) {
          return norm(f.title + " " + f.genres.join(" ")).indexOf(q) !== -1;
        }));
      }
    }
    $("#content").innerHTML = out;
  }

  function go(v) { view = v; render(); window.scrollTo({ top: 0 }); }

  /* ---------- 5. Cửa sổ chi tiết + trình phát ---------- */
  var dlg = $("#film-dialog");
  function openFilm(id, autoplay) {
    var f = byId(id); if (!f) return;
    var specs = [
      ["Loại", TYPE_LABEL[f.type]], ["Năm", f.year], ["Thời lượng", f.duration],
      ["Khung hình", f.ratio], ["Chất lượng", f.quality], ["Độ tuổi", f.age]
    ];
    var eps = f.type === "bo" ? '<div class="episodes" role="group" aria-label="Chọn tập">' +
      Array.from({ length: f.episodes }, function (_, i) {
        return '<button type="button" data-ep="' + (i + 1) + '" aria-pressed="' + (i === 0) + '">' + String(i + 1).padStart(2, "0") + '</button>';
      }).join("") + '</div>' : "";
    $("#film-content").innerHTML =
      '<div class="player" id="player">' + posterHTML(f, { badges: false }).replace('<div class="p-title">' + esc(f.title) + '</div>', "") +
      '<button class="play" type="button" id="play-btn" aria-label="Phát phim">' + playIcon(30) + '</button></div>' +
      '<div class="film-body"><h3 id="film-title">' + esc(f.title) + '</h3>' +
      '<div class="tags"><span class="tag age">' + esc(f.age) + '</span>' + f.genres.map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join("") + '</div>' +
      '<p>' + esc(f.synopsis) + '</p>' + eps +
      '<dl class="specs">' + specs.map(function (s) { return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join("") + '</dl></div>';
    $("#play-btn").addEventListener("click", function () { play(f); });
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    if (autoplay) play(f);
  }
  function play(f) {
    var p = $("#player");
    if (f.video) {
      p.innerHTML = '<video controls autoplay playsinline src="' + encodeURI(f.video) + '"></video>';
    } else {
      var note = p.querySelector(".note") || document.createElement("p");
      note.className = "note";
      note.textContent = "Phim mẫu chưa có video. Thêm đường dẫn video cho phim này trong assets/films.js.";
      p.appendChild(note);
    }
  }
  function closeFilm() {
    var v = dlg.querySelector("video"); if (v) v.pause();
    if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
  }

  /* ---------- 6. Sự kiện ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, a"); if (!t) return;
    if (t.dataset.site) {
      site = SITES.find(function (s) { return s.id === t.dataset.site; }) || site;
      store("pv-site", site.id);
      applyBrand(); go({ kind: "home" }); return;
    }
    if (t.dataset.film) { openFilm(t.dataset.film, !!t.dataset.play); return; }
    if (t.dataset.nav) { $("#q").value = ""; go(t.dataset.nav === "home" ? { kind: "home" } : { kind: "type", type: t.dataset.nav }); return; }
    if (t.dataset.genre) { go({ kind: "genre", genre: t.dataset.genre }); return; }
    if (t.dataset.more) { go({ kind: "list", title: t.dataset.title, filter: JSON.parse(t.dataset.more) }); return; }
    if (t.dataset.ep) {
      t.parentElement.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b === t ? "true" : "false"); });
      return;
    }
    if (t.id === "logo") { e.preventDefault(); $("#q").value = ""; go({ kind: "home" }); return; }
    if (t.id === "close-film") closeFilm();
  });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) closeFilm(); });
  dlg.addEventListener("cancel", function () { var v = dlg.querySelector("video"); if (v) v.pause(); });
  $("#search-form").addEventListener("submit", function (e) { e.preventDefault(); });
  $("#q").addEventListener("input", function (e) {
    var q = e.target.value.trim();
    go(q ? { kind: "search", q: q } : { kind: "home" });
  });

  applyBrand();
  render();
})();
