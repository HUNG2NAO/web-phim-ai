/* AI FILM NETWORK — LANGUAGE ROUTER (Level 4.7). Dùng chung cho 5 website, không phụ thuộc DOM (kiểm thử bằng Node).
   Nhận kết quả máy chủ get_playback_media (hoặc get_playback_source v1) + ngôn ngữ người xem → quyết định phát nguồn nào,
   bật phụ đề nào. Máy chủ đã kiểm quyền xem trước khi trả nguồn; router chỉ CHỌN trong những gì được phép.

   Thứ tự ưu tiên (đúng định hướng chủ dự án):
   1. Có bản âm thanh đúng ngôn ngữ (bản gốc / lồng tiếng / bản có phụ đề cứng) → phát bản đó.
   2. Không có → phát bản gốc (ưu tiên YouTube) và BẬT PHỤ ĐỀ ngôn ngữ đó:
        • YouTube: track phụ đề có sẵn trong video (một link YouTube + nhiều phụ đề);
        • MP4 (native): tệp WebVTT qua thẻ <track>.
      Facebook / Google Drive không cho chọn track → chỉ đổi ngôn ngữ bằng link riêng từng ngôn ngữ (bước 1).
   3. Không có gì cho ngôn ngữ đó → ngôn ngữ mặc định của website ('vi') → bản gốc.
   Không lưu trữ MP4 trên website, không tự tải lên: chỉ nhúng link bên ngoài đã được quản trị viên khai báo và xuất bản. */
(function (root) {
  "use strict";
  var LANG_NAMES = { vi: "Tiếng Việt", th: "ภาษาไทย", id: "Bahasa Indonesia", en: "English", ko: "한국어", ja: "日本語", zh: "中文", ms: "Bahasa Melayu", lo: "ພາສາລາວ", km: "ខ្មែរ" };
  var STORE_KEY = "afn-lang";
  var YT_ID = /^[A-Za-z0-9_-]{11}$/, DRIVE_ID = /^[A-Za-z0-9_-]{20,100}$/;
  var FB_URL = /^https:\/\/(www\.|m\.|web\.)?facebook\.com\/[^\s]+$/;
  var LANG_RE = /^[a-z]{2,3}(-[A-Z]{2})?$/;

  function base(lang) { return String(lang || "").split("-")[0].toLowerCase(); }
  function name(lang) { return LANG_NAMES[base(lang)] || String(lang || "").toUpperCase(); }
  function uniq(a) { var o = []; a.forEach(function (x) { if (x && o.indexOf(x) === -1) o.push(x); }); return o; }

  // Ngôn ngữ người xem theo thứ tự: ?lang= → lựa chọn đã lưu → ngôn ngữ trình duyệt → mặc định của website → 'vi'.
  function preferred(o) {
    o = o || {};
    var list = [o.urlLang, o.saved].concat(o.browser || []).map(base).filter(function (x) { return LANG_RE.test(x); });
    return uniq(list.concat([base(o.siteDefault || "vi"), "vi"]));
  }

  // Một nguồn → mô tả phát được (đã kiểm tra định dạng lần nữa phía trình duyệt; sai định dạng thì bỏ qua).
  function playable(m) {
    if (!m) return null;
    if ((m.provider === "youtube" || m.provider === "youtube_unlisted") && YT_ID.test(m.external_id || "")) return { kind: "youtube", provider: m.provider, value: m.external_id };
    if (m.provider === "native" && /^https:\/\/\S+$/.test(m.url || "")) return { kind: "native", provider: "native", value: m.url };
    if (m.provider === "facebook" && FB_URL.test(m.url || "")) return { kind: "embed", provider: "facebook", value: embedUrl(m) };
    if (m.provider === "gdrive" && DRIVE_ID.test(m.external_id || "")) return { kind: "embed", provider: "gdrive", value: embedUrl(m) };
    return null;
  }
  function embedUrl(m) {
    if (m.provider === "facebook") return "https://www.facebook.com/plugins/video.php?href=" + encodeURIComponent(m.url) + "&show_text=false";
    if (m.provider === "gdrive") return "https://drive.google.com/file/d/" + m.external_id + "/preview";
    return null;
  }
  function v1Source(p) {   // kết quả get_playback_source v1 (hoặc bản 4.7 'legacy')
    if (p.source_kind === "youtube" && YT_ID.test(p.youtube_id || "")) return { kind: "youtube", provider: "youtube", value: p.youtube_id };
    if (p.source_kind === "native" && /^https:\/\/\S+$/.test(p.video_url || "")) return { kind: "native", provider: "native", value: p.video_url };
    return null;
  }
  function v1Fallback(p) { return p.fallback ? v1Source(p.fallback) : null; }

  function pickSubtitle(subs, lang, kind) {
    var want = (subs || []).filter(function (s) { return base(s.language) === lang; });
    if (kind === "youtube") return want.find(function (s) { return s.source === "youtube"; }) || null;
    if (kind === "native") return want.find(function (s) { return s.source === "vtt" && /^https:\/\/\S+$/.test(s.url || ""); }) || null;
    return null;   // iframe Facebook/Drive: không chọn được track
  }

  /* route(payload, prefs) → {
       status, language (ngôn ngữ đang phục vụ), audioLanguage, mode: 'audio'|'subtitle'|'default'|'legacy',
       source {kind, provider, value}, fallbacks [..], subtitle {language, source, url}|null,
       options [{language, name, audio:bool, subtitle:bool}] (để vẽ nút chọn ngôn ngữ) } */
  function route(payload, prefs) {
    var p = payload || {};
    if (p.status !== "ok") return { status: p.status || "error", raw: p };
    var want = preferred(prefs);
    var media = (p.media || []).filter(function (m) { return playable(m); });
    var subs = p.subtitles || [];
    var opts = {};
    media.forEach(function (m) { var l = base(m.language); (opts[l] = opts[l] || { language: l, name: name(l), audio: false, subtitle: false }).audio = true; });

    if (p.legacy || !media.length) {
      var src = v1Source(p);
      if (!src) return { status: "no_source", raw: p };
      subs.forEach(function (s) { var l = base(s.language); if (pickSubtitle(subs, l, src.kind)) (opts[l] = opts[l] || { language: l, name: name(l), audio: false, subtitle: false }).subtitle = true; });
      var sl = want.find(function (l) { return pickSubtitle(subs, l, src.kind); });
      var fb = v1Fallback(p);
      return { status: "ok", mode: "legacy", language: sl || null, audioLanguage: null, source: src, fallbacks: fb ? [fb] : [],
               subtitle: sl ? pickSubtitle(subs, sl, src.kind) : null, options: Object.keys(opts).sort().map(function (k) { return opts[k]; }) };
    }

    function byLang(l) {
      return media.filter(function (m) { return base(m.language) === l; })
        .sort(function (a, b) { return (a.priority || 0) - (b.priority || 0) || (a.track_kind === "original" ? -1 : 1); });
    }
    var originals = media.filter(function (m) { return m.track_kind === "original"; })
      .sort(function (a, b) { var ay = /youtube/.test(a.provider) ? 0 : 1, by = /youtube/.test(b.provider) ? 0 : 1; return ay - by || (a.priority || 0) - (b.priority || 0); });
    var primary = originals[0] || media.slice().sort(function (a, b) { return (a.priority || 0) - (b.priority || 0); })[0];
    var primaryKind = playable(primary).kind;
    subs.forEach(function (s) {
      var l = base(s.language);
      if (pickSubtitle(subs, l, primaryKind)) (opts[l] = opts[l] || { language: l, name: name(l), audio: false, subtitle: false }).subtitle = true;
    });

    for (var i = 0; i < want.length; i++) {
      var l = want[i], list = byLang(l);
      if (list.length) {                                         // 1. có bản âm thanh / bản phụ đề cứng đúng ngôn ngữ
        var s0 = playable(list[0]);
        return { status: "ok", mode: "audio", language: l, audioLanguage: l, trackKind: list[0].track_kind, source: s0,
                 fallbacks: list.slice(1).map(playable).filter(Boolean).concat(originals.filter(function (m) { return list.indexOf(m) === -1; }).map(playable).filter(Boolean).slice(0, 1)),
                 subtitle: null, options: Object.keys(opts).sort().map(function (k) { return opts[k]; }) };
      }
      var sub = pickSubtitle(subs, l, primaryKind);
      if (sub) {                                                 // 2. bản gốc + phụ đề ngôn ngữ đó
        return { status: "ok", mode: "subtitle", language: l, audioLanguage: base(primary.language), trackKind: primary.track_kind, source: playable(primary),
                 fallbacks: originals.slice(1).map(playable).filter(Boolean), subtitle: { language: l, source: sub.source, url: sub.url || null },
                 options: Object.keys(opts).sort().map(function (k) { return opts[k]; }) };
      }
    }
    return { status: "ok", mode: "default", language: base(primary.language), audioLanguage: base(primary.language), trackKind: primary.track_kind,
             source: playable(primary), fallbacks: originals.slice(1).map(playable).filter(Boolean), subtitle: null,
             options: Object.keys(opts).sort().map(function (k) { return opts[k]; }) };
  }

  /* Video Source Manager: nhận link quản trị viên dán vào → {provider, external_id, url} hoặc {error}.
     Chỉ chấp nhận link bên ngoài (YouTube, Facebook video công khai, Google Drive, MP4 https). Không tải tệp lên. */
  function parseSourceInput(text, opts) {
    var t = String(text || "").trim();
    if (!t) return { error: "Chưa nhập link." };
    if (YT_ID.test(t)) return { provider: (opts && opts.unlisted) ? "youtube_unlisted" : "youtube", external_id: t, url: null };
    var u; try { u = new URL(t); } catch (e) { return { error: "Link không hợp lệ." }; }
    if (u.protocol !== "https:") return { error: "Chỉ chấp nhận link https." };
    var h = u.hostname.replace(/^www\.|^m\./, "");
    var yt = null;
    if (h === "youtu.be") yt = u.pathname.slice(1).split("/")[0];
    else if (h === "youtube.com" || h === "youtube-nocookie.com" || h === "music.youtube.com") {
      yt = u.searchParams.get("v") || (u.pathname.match(/^\/(embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/) || [])[2];
    }
    if (yt !== null && yt !== undefined) {
      if (!YT_ID.test(yt)) return { error: "Không đọc được mã video YouTube." };
      return { provider: (opts && opts.unlisted) ? "youtube_unlisted" : "youtube", external_id: yt, url: null };
    }
    if (h === "facebook.com" || h === "web.facebook.com" || h === "fb.watch") {
      if (h === "fb.watch") return { error: "Hãy dùng link đầy đủ facebook.com/…/videos/… (không dùng fb.watch)." };
      if (!/\/(videos|watch|reel)\b/.test(u.pathname + u.search)) return { error: "Link Facebook phải là video công khai (…/videos/…)." };
      return { provider: "facebook", external_id: null, url: "https://www.facebook.com" + u.pathname + u.search };
    }
    if (h === "drive.google.com") {
      var id = (u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/) || [])[1] || u.searchParams.get("id");
      if (!id || !DRIVE_ID.test(id)) return { error: "Không đọc được mã tệp Google Drive." };
      return { provider: "gdrive", external_id: id, url: null };
    }
    if (/\.(mp4|m3u8|webm)(\?|$)/i.test(u.pathname + u.search)) return { provider: "native", external_id: null, url: u.href };
    return { error: "Chưa hỗ trợ nguồn này. Dùng YouTube, Facebook (video công khai), Google Drive hoặc link MP4 https." };
  }

  function saveChoice(lang) { try { if (LANG_RE.test(lang)) localStorage.setItem(STORE_KEY, lang); } catch (e) {} }
  function savedChoice() { try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; } }

  var api = { route: route, preferred: preferred, parseSourceInput: parseSourceInput, playable: playable, embedUrl: embedUrl,
              name: name, saveChoice: saveChoice, savedChoice: savedChoice, LANG_NAMES: LANG_NAMES };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AFN_LANG = Object.freeze(api);
})(typeof window !== "undefined" ? window : this);
