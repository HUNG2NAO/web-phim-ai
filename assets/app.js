(function () {
  "use strict";
  var SITES = window.SITES || [];
  var ALL_FILMS = window.FILMS || [];
  var GENRES = [];
  var TYPE_LABEL = { bo: "Phim bộ", le: "Phim lẻ", ngan: "Phim ngắn" };
  var SORTS = { moi: "Mới cập nhật", xem: "Xem nhiều", ten: "Tên A–Z" };
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---------- 1. Nhận diện site theo tên miền ---------- */
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }
  function detectSite() {
    var host = location.hostname.toLowerCase().replace(/^www\./, "");
    var byHost = SITES.find(function (s) { return host === s.domain || host.endsWith("." + s.domain); });
    if (byHost) return { site: byHost, preview: false };
    var candidates = [new URLSearchParams(location.search).get("site"), location.hash.slice(1), store("pv-site")];
    var chosen = candidates.map(function (id) { return SITES.find(function (s) { return s.id === id; }); }).find(Boolean);
    return { site: chosen || SITES[0], preview: true };
  }

  var state = detectSite();
  var site = state.site;
  var films = [];
  var view = { kind: "home" };

  function byId(id) { return films.find(function (f) { return f.id === id; }); }
  function genreChar(name) { var g = GENRES.find(function (x) { return x.name === name; }); return g ? g.char : (isFuture() ? "SF" : "影"); }
  function isFuture() { return site.world === "tuong-lai"; }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function norm(t) { return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }
  function fmtViews(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " triệu";
    if (n >= 1e3) return Math.round(n / 1e3) + " nghìn";
    return String(n);
  }
  // Missing aired means complete by the film data contract; malformed counts are unknown.
  function seriesProgress(f) {
    if (f.type !== "bo" || !Number.isSafeInteger(f.episodes) || f.episodes <= 0) return null;
    var aired = f.aired === undefined ? f.episodes : f.aired;
    if (!Number.isSafeInteger(aired) || aired < 0 || aired > f.episodes) return null;
    return { total: f.episodes, aired: aired, completed: aired === f.episodes };
  }
  function isAiring(f) { var p = seriesProgress(f); return !!p && !p.completed; }
  function isCompleted(f) { var p = seriesProgress(f); return !!p && p.completed; }
  function status(f) {
    if (f.type === "bo") {
      var p = seriesProgress(f);
      if (!p) return "Chưa rõ tiến độ";
      return p.completed ? "Trọn bộ " + p.total + " tập" : p.aired === 0 ? "Chưa có tập phát hành" : "Tập " + p.aired + "/" + p.total;
    }
    return f.type === "ngan" ? "Phim ngắn" : "Phim lẻ";
  }
  function newestScore(f) { return f.year * 1000 + (isAiring(f) ? 500 : 0) + (f.views / 1e5); }

  function query(filter) {
    var list = films.slice();
    if (filter.genre) list = list.filter(function (f) { return f.genres.indexOf(filter.genre) !== -1; });
    if (filter.type) list = list.filter(function (f) { return f.type === filter.type; });
    if (filter.year) list = list.filter(function (f) { return String(f.year) === String(filter.year); });
    if (filter.airing) list = list.filter(isAiring);
    if (filter.completed) list = list.filter(isCompleted);
    if (filter.q) {
      var q = norm(filter.q);
      list = list.filter(function (f) { return norm(f.title + " " + f.genres.join(" ")).indexOf(q) !== -1; });
    }
    var sort = filter.sort || (filter.trending ? "xem" : filter.newest ? "moi" : null);
    if (sort === "xem") list.sort(function (a, b) { return b.views - a.views; });
    if (sort === "moi") list.sort(function (a, b) { return newestScore(b) - newestScore(a); });
    if (sort === "ten") list.sort(function (a, b) { return a.title.localeCompare(b.title, "vi"); });
    return list;
  }

  /* ---------- 2. Áp thương hiệu ---------- */
  function applyBrand() {
    var world = site.world || "co-trang";
    document.documentElement.setAttribute("data-world", world);
    GENRES = (window.GENRES || {})[world] || [];
    films = ALL_FILMS.filter(function (f) { return (f.world || "co-trang") === world && (!f.sites || f.sites.indexOf(site.id) !== -1); });
    var root = document.documentElement.style;
    root.setProperty("--accent", site.accent);
    root.setProperty("--on-accent", site.onAccent);
    document.title = site.name + ".ai · " + site.tagline;
    var meta = $('meta[name="description"]'); if (meta) meta.setAttribute("content", site.name + ".ai: " + site.tagline + ".");
    $("#logo").innerHTML = '<span class="seal" aria-hidden="true">' + site.seal + '</span><span class="name">' +
      esc(site.name.replace(/\s+/g, "")) + '<span class="tld">.ai</span></span>';
    $("#logo").setAttribute("aria-label", site.name + ".ai, về trang chủ");
    $("#tagline").textContent = site.tagline;
    $("#network").innerHTML = SITES.map(function (s) {
      return '<a href="https://' + s.domain + '" style="--c:' + s.accent + '"' + (s.id === site.id ? ' aria-current="true"' : "") + '>' +
        '<span class="seal" aria-hidden="true">' + s.seal + '</span><span class="n">' + esc(s.domain) + '</span></a>';
    }).join("");
    var bar = $("#preview-bar");
    bar.hidden = !state.preview;
    if (state.preview) {
      $("#pv-pills").innerHTML = SITES.map(function (s) {
        return '<button class="pv-pill" type="button" data-site="' + s.id + '" aria-pressed="' + (s.id === site.id) + '" style="--c:' + s.accent + '">' +
          '<span class="dot"></span>' + esc(s.domain) + '</button>';
      }).join("");
    }
  }

  /* ---------- 3. Thành phần ---------- */
  function posterHTML(f) {
    var bg = f.poster ? ' style="background-image:url(\'' + encodeURI(f.poster) + '\')"' : ' data-art="' + f.id + '" data-size="320x480"';
    var progress = seriesProgress(f);
    var right = f.type === "bo" ? (!progress ? '<span class="badge">Phim bộ</span>' : !progress.completed ? '<span class="badge accent">' + (progress.aired ? "Tập " + progress.aired : "Sắp chiếu") + '</span>' : '<span class="badge">' + progress.total + ' tập</span>') :
      f.type === "ngan" ? '<span class="badge">' + esc(f.duration) + '</span>' : "";
    return '<div class="poster"' + bg + '><div class="p-badges"><span class="badge">' + esc(f.quality) + '</span>' + right + '</div>' +
      '<span class="seal" aria-hidden="true">' + genreChar(f.genres[0]) + '</span></div>';
  }

  function cardHTML(f) {
    return '<button class="card" type="button" data-film="' + f.id + '">' + posterHTML(f) +
      '<span class="c-title">' + esc(f.title) + '</span>' +
      '<span class="c-meta">' + f.year + ' · ' + esc(f.genres.join(", ")) + '</span></button>';
  }

  function heroHTML(f) {
    var hasVideo = Array.isArray(f.video) ? f.video.some(Boolean) : !!f.video;
    var artAttr = f.poster ? ' style="background-image:url(\'' + encodeURI(f.poster) + '\')"' : ' data-art="' + f.id + '" data-size="1200x600"';
    return '<section class="hero" aria-label="Phim nổi bật">' +
      '<div class="hero-art"' + artAttr + '></div><div class="mist" aria-hidden="true"></div>' +
      '<div class="watermark" aria-hidden="true">' + genreChar(f.genres[0]) + '</div>' +
      '<div class="wrap"><div class="hero-inner">' +
      '<div class="kicker"><span class="seal" aria-hidden="true">' + genreChar(f.genres[0]) + '</span><b>' + esc(f.genres.join(" · ")) + '</b>' +
      '<span class="sep"></span><span>' + esc(status(f)) + '</span><span class="sep"></span><span>' + f.year + '</span>' +
      '<span class="sep"></span><span>' + esc(f.quality) + '</span></div>' +
      '<h1>' + esc(f.title) + '</h1>' +
      '<p class="synopsis">' + esc(f.synopsis) + '</p>' +
      '<div class="tags"><span class="tag age">' + esc(f.age) + '</span><span class="tag">' + esc(f.duration) + '</span>' +
      '<span class="tag">' + fmtViews(f.views) + ' lượt xem</span></div>' +
      '<div class="actions">' +
      '<button class="btn primary" type="button" data-film="' + f.id + '" data-play="1">' + playIcon(18) + (!hasVideo ? "Xem demo" : f.type === "bo" ? "Xem tập 1" : "Xem ngay") + '</button>' +
      '<button class="btn ghost" type="button" data-film="' + f.id + '">Thông tin phim</button>' +
      '</div></div></div></section>';
  }

  function headHTML(title, cn, right) {
    return '<div class="row-head"><h2>' + (cn ? '<span class="cn" aria-hidden="true">' + cn + '</span>' : "") + esc(title) + '</h2>' + (right || "") + '</div>';
  }

  function rowHTML(r) {
    var list = query(r.filter);
    if (!list.length) return "";
    var cn = r.filter.genre ? genreChar(r.filter.genre) : null;
    return '<section>' + headHTML(r.title, cn,
      '<button class="more" type="button" data-catalog=\'' + esc(JSON.stringify(r.filter)) + '\'>Xem tất cả</button>') +
      '<div class="scroller">' + list.map(cardHTML).join("") + '</div></section>';
  }

  function genresHTML() {
    return '<section>' + headHTML("Thể loại", null, '<button class="more" type="button" data-catalog="{}">Vào kho phim</button>') +
      '<div class="genre-grid">' + GENRES.map(function (g) {
        var n = films.filter(function (f) { return f.genres.indexOf(g.name) !== -1; }).length;
        return '<button class="genre" type="button" data-catalog=\'' + esc(JSON.stringify({ genre: g.name })) + '\'>' +
          '<span class="big" aria-hidden="true">' + g.char + '</span><span class="g-name">' + esc(g.name) + '</span>' +
          '<span class="g-count">' + n + ' phim</span></button>';
      }).join("") + '</div></section>';
  }

  function rankingHTML() {
    var top = query({ sort: "xem" }).slice(0, 10);
    return '<section>' + headHTML("Bảng xếp hạng", isFuture() ? "TOP" : "榜", '<span class="count">Theo lượt xem</span>') +
      '<div class="rank-list">' + top.map(function (f, i) {
        return '<button class="rank" type="button" data-film="' + f.id + '" aria-label="Hạng ' + (i + 1) + ': ' + esc(f.title) + '">' +
          '<span class="num" aria-hidden="true">' + (i + 1) + '</span>' + posterHTML(f) + '</button>';
      }).join("") + '</div></section>';
  }

  function catalogHTML(v) {
    var sort = v.sort || (v.trending ? "xem" : "moi");
    var list = query(Object.assign({}, v, { sort: sort }));
    var years = films.map(function (f) { return f.year; }).filter(function (y, i, a) { return a.indexOf(y) === i; }).sort().reverse();
    var title = v.q ? "Kết quả cho “" + v.q + "”" : v.genre || (v.completed ? "Phim bộ trọn bộ" : v.type ? TYPE_LABEL[v.type] : v.airing ? "Phim bộ đang chiếu" : "Kho phim");
    function opt(val, label, cur) { return '<option value="' + val + '"' + (String(cur || "") === String(val) ? " selected" : "") + '>' + esc(label) + '</option>'; }
    return '<section>' + headHTML(title, v.genre ? genreChar(v.genre) : (isFuture() ? "ALL" : "库"), '<span class="count">' + list.length + ' phim</span>') +
      '<div class="filters" role="group" aria-label="Bộ lọc kho phim">' +
      '<div class="filter-row"><span class="f-label">Thể loại</span>' +
      '<button class="chip" type="button" data-f-genre="" aria-pressed="' + !v.genre + '">Tất cả</button>' +
      GENRES.map(function (g) {
        return '<button class="chip" type="button" data-f-genre="' + esc(g.name) + '" aria-pressed="' + (v.genre === g.name) + '"><span class="cn" aria-hidden="true">' + g.char + '</span>' + esc(g.name) + '</button>';
      }).join("") + '</div>' +
      '<div class="selects">' +
      '<label for="f-type">Loại phim<select id="f-type">' + opt("", "Tất cả", v.type) + opt("bo", "Phim bộ", v.type) + opt("le", "Phim lẻ", v.type) + opt("ngan", "Phim ngắn", v.type) + '</select></label>' +
      '<label for="f-year">Năm<select id="f-year">' + opt("", "Tất cả", v.year) + years.map(function (y) { return opt(y, y, v.year); }).join("") + '</select></label>' +
      '<label for="f-sort">Sắp xếp<select id="f-sort">' + Object.keys(SORTS).map(function (k) { return opt(k, SORTS[k], sort); }).join("") + '</select></label>' +
      '</div></div></section>' +
      '<section>' + (list.length ? '<div class="grid">' + list.map(cardHTML).join("") + '</div>' :
        '<p class="empty">Chưa có phim phù hợp. Bỏ bớt bộ lọc hoặc thử từ khoá khác.</p>') + '</section>';
  }

  function playIcon(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>';
  }

  /* ---------- 4. Hiển thị ---------- */
  function render() {
    document.querySelectorAll(".nav button").forEach(function (b) {
      var n = b.dataset.nav, on = false;
      if (view.kind === "home") on = n === "home";
      else if (view.type) on = n === view.type;
      else on = n === "kho" && !view.q;
      b.setAttribute("aria-current", on ? "true" : "false");
    });
    if (view.kind === "home") {
      var featured = byId(site.featured) || films[0];
      $("#hero-slot").innerHTML = featured ? heroHTML(featured) : "";
      var rows = site.rows.map(rowHTML);
      rows.splice(1, 0, rankingHTML());
      $("#content").innerHTML = genresHTML() + rows.join("");
    } else {
      $("#hero-slot").innerHTML = "";
      $("#content").innerHTML = catalogHTML(view);
    }
    window.InkArt.hydrate(document, byId);
  }

  function go(v) { view = v; render(); window.scrollTo({ top: 0 }); }
  function catalog(patch) {
    var base = view.kind === "catalog" ? view : { kind: "catalog" };
    var next = Object.assign({}, base, patch, { kind: "catalog" });
    Object.keys(next).forEach(function (k) { if (next[k] === "" || next[k] == null) delete next[k]; });
    view = next; render();
  }

  /* ---------- 5. Chi tiết phim + trình phát ---------- */
  var dlg = $("#film-dialog");
  var current = null;
  function openFilm(id, autoplay) {
    var f = byId(id); if (!f) return;
    current = f;
    var specs = [["Thể loại", f.genres.join(", ")], ["Loại", TYPE_LABEL[f.type]], ["Tình trạng", status(f)], ["Năm", f.year],
      ["Thời lượng", f.duration], ["Chất lượng", f.quality], ["Độ tuổi", f.age], ["Lượt xem", fmtViews(f.views)]];
    var eps = "";
    if (f.type === "bo") {
      var progress = seriesProgress(f);
      eps = progress ? '<div class="ep-head">Danh sách tập</div><div class="episodes" role="group" aria-label="Chọn tập">' +
        Array.from({ length: progress.total }, function (_, i) {
          var n = i + 1, off = n > progress.aired;
          return '<button type="button" data-ep="' + n + '" aria-pressed="' + (n === 1 && !off) + '"' + (off ? ' disabled title="Sắp chiếu"' : "") + '>Tập ' + String(n).padStart(2, "0") + '</button>';
        }).join("") + '</div>' : '<p class="ep-head">Chưa có thông tin số tập hợp lệ.</p>';
    }
    var art = f.poster ? ' style="background-image:url(\'' + encodeURI(f.poster) + '\')"' : ' data-art="' + f.id + '" data-size="960x540"';
    $("#film-content").innerHTML =
      '<div class="player" id="player"' + art + '><button class="play" type="button" id="play-btn" aria-label="Phát phim">' + playIcon(30) + '</button></div>' +
      '<div class="film-body"><h3 id="film-title">' + esc(f.title) + '</h3>' +
      '<div class="tags"><span class="tag age">' + esc(f.age) + '</span>' + f.genres.map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join("") + '</div>' +
      '<p>' + esc(f.synopsis) + '</p>' + eps +
      '<dl class="specs">' + specs.map(function (s) { return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join("") + '</dl></div>';
    window.InkArt.hydrate($("#film-content"), byId);
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    if (autoplay) play();
  }
  function play() {
    var p = $("#player"), f = current; if (!p || !f) return;
    var progress = seriesProgress(f);
    if (f.type === "bo" && (!progress || progress.aired === 0)) {
      if (!p.querySelector(".note")) {
        var pending = document.createElement("p"); pending.className = "note";
        pending.textContent = progress ? "Chưa có tập phát hành." : "Chưa có thông tin số tập hợp lệ.";
        p.appendChild(pending);
      }
      return;
    }
    var ep = $(".episodes [aria-pressed='true']");
    var src = Array.isArray(f.video) ? f.video[(ep ? +ep.dataset.ep : 1) - 1] : f.video;
    var yt = Array.isArray(f.youtube) ? f.youtube[(ep ? +ep.dataset.ep : 1) - 1] : f.youtube;
    if (f.live && typeof yt === "string" && /^[A-Za-z0-9_-]{11}$/.test(yt)) {
      p.replaceChildren();
      var holder=document.createElement("div");
      holder.className="youtube-player";
      holder.style.cssText="width:100%;aspect-ratio:16/9;background:#000";
      p.appendChild(holder);
      if (typeof window.AFN_PLAY_YOUTUBE === "function") {
        window.AFN_PLAY_YOUTUBE({holder:holder,filmId:f.id,videoId:yt,
          episode:ep?Number(ep.dataset.ep)||1:1});
      } else {
        var iframe=document.createElement("iframe");
        iframe.src="https://www.youtube-nocookie.com/embed/"+yt+"?rel=0";
        iframe.title=f.title;
        iframe.setAttribute("allow","accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture");
        iframe.setAttribute("allowfullscreen","");
        iframe.style.cssText="width:100%;height:100%;border:0";
        holder.appendChild(iframe);
      }
    } else if (src) {
      p.innerHTML = '<video controls autoplay playsinline src="' + encodeURI(src) + '"></video>';
      // Progress is recorded only for actually playing native video, with explicit viewer consent.
      if ((window.AFN_LEVEL3_CONFIG?.enabledSites||["xuongphim"]).includes(site.id) && typeof window.AFN_TRACK_VIDEO === "function") {
        window.AFN_TRACK_VIDEO({
          video: p.querySelector("video"), filmId: f.id,
          episode: ep ? Number(ep.dataset.ep) || 1 : 1
        });
      }
    } else if (!p.querySelector(".note")) {
      var note = document.createElement("p"); note.className = "note";
      note.textContent = "Phim mẫu do AI tạo, chưa có video để phát. Bạn có thể khám phá thông tin phim và giao diện demo.";
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
    var d = t.dataset;
    if (d.site && state.preview) {
      site = SITES.find(function (s) { return s.id === d.site; }) || site;
      store("pv-site", site.id);
      $("#q").value = "";
      if (state.preview) {
        var previewUrl = new URL(location.href);
        previewUrl.searchParams.set("site", site.id);
        previewUrl.hash = "";
        history.replaceState(history.state, "", previewUrl.href);
      }
      applyBrand(); go({ kind: "home" }); return;
    }
    if (d.film) { openFilm(d.film, !!d.play); return; }
    if (d.nav) {
      $("#q").value = "";
      if (d.nav === "home") go({ kind: "home" });
      else if (d.nav === "kho") go({ kind: "catalog" });
      else go({ kind: "catalog", type: d.nav });
      return;
    }
    if (d.catalog !== undefined) { $("#q").value = ""; go(Object.assign({ kind: "catalog" }, JSON.parse(d.catalog || "{}"))); return; }
    if (d.fGenre !== undefined) { catalog({ genre: d.fGenre }); return; }
    if (d.ep) {
      if (t.disabled) return;
      t.parentElement.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b === t ? "true" : "false"); });
      if ($("#player video") || (current && current.video)) play();
      return;
    }
    if (t.id === "play-btn") { play(); return; }
    if (t.id === "logo") { e.preventDefault(); $("#q").value = ""; go({ kind: "home" }); return; }
    if (t.id === "close-film") closeFilm();
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "f-type") catalog({ type: e.target.value, airing: null, completed: null });
    if (e.target.id === "f-year") catalog({ year: e.target.value });
    if (e.target.id === "f-sort") catalog({ sort: e.target.value });
  });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) closeFilm(); });
  dlg.addEventListener("cancel", function () { var v = dlg.querySelector("video"); if (v) v.pause(); });
  $("#search-form").addEventListener("submit", function (e) { e.preventDefault(); });
  $("#q").addEventListener("input", function (e) {
    var q = e.target.value.trim();
    if (q) { view = { kind: "catalog", q: q }; render(); } else go({ kind: "home" });
  });

  applyBrand();
  render();
  // Published metadata loads asynchronously. Refresh catalog without replacing the viewer's session.
  window.addEventListener("afn-catalog-updated",function(){
    applyBrand();render();
  });
  var requestFilm=new URLSearchParams(location.search).get("film");
  if(requestFilm && /^[a-z0-9][a-z0-9-]{0,119}$/.test(requestFilm)) {
    if(byId(requestFilm))openFilm(requestFilm,false);
    else window.addEventListener("afn-catalog-updated",function(){
      if(byId(requestFilm))openFilm(requestFilm,false);
    },{once:true});
  }
})();
