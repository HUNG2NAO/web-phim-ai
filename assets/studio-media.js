/* AI FILM NETWORK — VIDEO SOURCE MANAGER (Studio › Nguồn phát & ngôn ngữ, Level 4.7). Dùng chung cho 5 website.
   • Chỉ khai báo LINK BÊN NGOÀI (YouTube công khai / không công khai, Facebook video công khai, Google Drive, MP4 https).
     Không có ô tải tệp: website không lưu trữ MP4, không tự tải lên nền tảng nào.
   • Nguồn mới luôn là BẢN NHÁP. Phát hành cần: (1) quản trị viên xác nhận có quyền phát, (2) bấm xác nhận lần nữa.
   • Quyền thật do máy chủ quyết định: RLS (admin đúng website / nhân sự mạng) + cổng 2FA; mọi thay đổi ghi nhật ký quản trị.
   • Máy chủ chưa áp Level 4.7 → báo rõ, không ghi gì. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var AFN = window.AFN, L = window.AFN_LANG;
  if (!AFN || !L) return;
  var LANGS = ["vi", "th", "id", "en", "ms", "ko", "ja", "zh"];
  var KIND = { original: "Bản gốc", dub: "Lồng tiếng", subtitled: "Phụ đề cứng" };
  var PROV = { youtube: "YouTube", youtube_unlisted: "YouTube (không công khai)", facebook: "Facebook", gdrive: "Google Drive", native: "MP4 (https)" };
  var st = { site: null, episodes: [], ep: null, media: [], subs: [], missing: false };
  function db() { return AFN.client(); }
  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text !== undefined) x.textContent = String(text); return x; }
  function msg(text, bad) { var m = $("#vsm-msg"); if (m) { m.textContent = text || ""; m.dataset.kind = bad ? "error" : "ok"; } }
  function isMissing(e) { return !!e && /42P01|PGRST20[25]|does not exist|could not find/i.test((e.code || "") + " " + (e.message || "")); }
  function explain(e) {
    if (isMissing(e)) return "Máy chủ chưa có Level 4.7 (bảng nguồn đa ngôn ngữ). Chờ chủ hệ thống phê duyệt migration.";
    var m = (e && (e.message || e.code)) || "";
    if (/row-level security|permission|forbidden|42501/i.test(m)) return "Bạn không có quyền quản trị nguồn phát của website này (cần admin website, phiên đã xác thực 2 lớp nếu đã bật 2FA).";
    if (/media_published_needs_rights/.test(m)) return "Cần xác nhận quyền phát trước khi phát hành.";
    if (/media_one_per_slot|subtitle_one_per_language|duplicate key/.test(m)) return "Đã có nguồn/phụ đề cùng ngôn ngữ, loại và thứ tự ưu tiên. Đổi thứ tự ưu tiên hoặc sửa dòng cũ.";
    if (/media_provider_valid|subtitle_source_valid|check constraint/.test(m)) return "Link không đúng định dạng của nhà cung cấp.";
    return "Không thực hiện được. Vui lòng thử lại.";
  }
  function langSelect(id) {
    var s = el("select"); s.id = id;
    LANGS.forEach(function (l) { var o = el("option", null, L.name(l) + " (" + l + ")"); o.value = l; s.append(o); });
    return s;
  }
  function field(label, input) { var w = el("label", "vsm-field"); w.append(el("span", null, label), input); return w; }

  function build(host) {
    host.replaceChildren();
    host.append(el("h2", null, "Nguồn phát & ngôn ngữ"),
      el("p", "muted", "Một tập phim có thể có nhiều ngôn ngữ. Ưu tiên: một link YouTube + nhiều phụ đề có sẵn trong video. Với Facebook/Google Drive (không chọn được phụ đề), thêm link riêng cho từng ngôn ngữ. Chỉ dùng link bên ngoài — website không lưu trữ video."));
    var pick = el("select"); pick.id = "vsm-episode";
    host.append(field("Tập phim", pick));
    var lists = el("div", "vsm-lists"); lists.id = "vsm-lists"; host.append(lists);

    // Form nguồn phát
    var f = el("form", "vsm-form"); f.id = "vsm-media-form"; f.noValidate = true;
    var link = el("input"); link.id = "vsm-link"; link.type = "url"; link.placeholder = "https://www.youtube.com/watch?v=… · https://www.facebook.com/…/videos/… · https://drive.google.com/file/d/…";
    var unl = el("input"); unl.type = "checkbox"; unl.id = "vsm-unlisted";
    var kind = el("select"); kind.id = "vsm-kind"; Object.keys(KIND).forEach(function (k) { var o = el("option", null, KIND[k]); o.value = k; kind.append(o); });
    var pr = el("input"); pr.type = "number"; pr.min = "0"; pr.max = "99"; pr.value = "0"; pr.id = "vsm-priority";
    var lab = el("input"); lab.id = "vsm-label"; lab.maxLength = 60; lab.placeholder = "Ghi chú hiển thị (không bắt buộc)";
    var rights = el("input"); rights.type = "checkbox"; rights.id = "vsm-rights";
    var detected = el("p", "ops-note"); detected.id = "vsm-detected";
    f.append(el("h3", null, "Thêm nguồn phát (bản nháp)"), field("Link video", link), detected,
      field("Ngôn ngữ âm thanh / bản phát", langSelect("vsm-lang")), field("Loại bản", kind), field("Thứ tự ưu tiên (0 = ưu tiên nhất)", pr), field("Ghi chú", lab));
    var ul = el("label", "vsm-check"); ul.append(unl, el("span", null, "Video YouTube không công khai (unlisted)")); f.append(ul);
    var rl = el("label", "vsm-check"); rl.append(rights, el("span", null, "Tôi xác nhận website có quyền phát nguồn này (bắt buộc trước khi phát hành)")); f.append(rl);
    var sb = el("button", "btn", "Lưu bản nháp"); sb.type = "submit"; sb.id = "vsm-media-save"; f.append(sb);
    host.append(f);
    link.addEventListener("input", function () {
      var r = link.value.trim() ? L.parseSourceInput(link.value, { unlisted: unl.checked }) : null;
      detected.textContent = !r ? "" : r.error ? "⚠ " + r.error : "Nhận diện: " + PROV[r.provider] + (r.external_id ? " · mã " + r.external_id : "");
    });

    // Form phụ đề
    var g = el("form", "vsm-form"); g.id = "vsm-sub-form"; g.noValidate = true;
    var src = el("select"); src.id = "vsm-sub-source";
    [["youtube", "Phụ đề có sẵn trong video YouTube"], ["vtt", "Tệp WebVTT (https) — cho MP4"]].forEach(function (x) { var o = el("option", null, x[1]); o.value = x[0]; src.append(o); });
    var vurl = el("input"); vurl.id = "vsm-sub-url"; vurl.type = "url"; vurl.placeholder = "https://…/tap1.th.vtt"; vurl.disabled = true;
    var def = el("input"); def.type = "checkbox"; def.id = "vsm-sub-default";
    src.addEventListener("change", function () { vurl.disabled = src.value !== "vtt"; });
    g.append(el("h3", null, "Thêm phụ đề (bản nháp)"), field("Ngôn ngữ phụ đề", langSelect("vsm-sub-lang")), field("Nguồn phụ đề", src), field("Link WebVTT", vurl));
    var dl = el("label", "vsm-check"); dl.append(def, el("span", null, "Phụ đề mặc định")); g.append(dl);
    var gb = el("button", "btn", "Lưu phụ đề nháp"); gb.type = "submit"; gb.id = "vsm-sub-save"; g.append(gb);
    host.append(g);

    // Xem thử như người xem
    var pv = el("div", "vsm-preview"); pv.append(el("h3", null, "Xem thử như người xem"), field("Ngôn ngữ người xem", langSelect("vsm-preview-lang")));
    var pb = el("button", "btn ghost", "Xem kết quả chọn nguồn"); pb.type = "button"; pb.id = "vsm-preview-btn"; pv.append(pb);
    var out = el("pre", "ops-code"); out.id = "vsm-preview-out"; pv.append(out);
    host.append(pv, Object.assign(el("p", "studio-status"), { id: "vsm-msg" }));

    pick.addEventListener("change", function () { st.ep = pick.value; loadRows(); });
    f.addEventListener("submit", function (e) { e.preventDefault(); addMedia(); });
    g.addEventListener("submit", function (e) { e.preventDefault(); addSub(); });
    pb.addEventListener("click", preview);
    lists.addEventListener("click", rowAction);
  }

  async function load() {
    var host = $("#studio-media"); if (!host) return;
    var site = ($("#studio-site") || {}).value; if (!site) return;
    if (!host.firstChild) build(host);
    st.site = site;
    var r = await db().from("site_episodes").select("id,film_id,episode_no,title").eq("site_id", site).order("film_id", { ascending: true }).order("episode_no", { ascending: true });
    st.episodes = r.data || [];
    var pick = $("#vsm-episode"); pick.replaceChildren();
    if (!st.episodes.length) { var o = el("option", null, "Website chưa có tập phim nào"); o.value = ""; pick.append(o); st.ep = null; $("#vsm-lists").replaceChildren(); return; }
    st.episodes.forEach(function (e) { var o = el("option", null, e.film_id + " · tập " + e.episode_no + (e.title ? " — " + e.title : "")); o.value = e.id; pick.append(o); });
    if (!st.episodes.some(function (e) { return e.id === st.ep; })) st.ep = st.episodes[0].id;
    pick.value = st.ep;
    await loadRows();
  }

  async function loadRows() {
    var box = $("#vsm-lists"); box.replaceChildren();
    if (!st.ep) return;
    var m = await db().from("episode_media").select("*").eq("episode_id", st.ep).order("language", { ascending: true }).order("priority", { ascending: true });
    if (m.error) { st.missing = isMissing(m.error); box.append(el("p", "muted", explain(m.error))); setForms(!st.missing); return; }
    var s = await db().from("episode_subtitles").select("*").eq("episode_id", st.ep).order("language", { ascending: true });
    st.media = m.data || []; st.subs = (s && s.data) || []; st.missing = false; setForms(true);
    box.append(table("Nguồn phát", ["Ngôn ngữ", "Loại", "Nhà cung cấp", "Ưu tiên", "Bản quyền", "Trạng thái", ""], st.media.map(function (x) {
      return { id: x.id, kind: "media", published: x.published, rights: x.rights_attested,
        cells: [L.name(x.language), KIND[x.track_kind] || x.track_kind, PROV[x.provider] + " · " + (x.external_id || x.url || ""), x.priority, x.rights_attested ? "Đã xác nhận" : "Chưa", x.published ? "Đang phát" : "Nháp"] };
    })));
    box.append(table("Phụ đề", ["Ngôn ngữ", "Nguồn", "Mặc định", "Trạng thái", ""], st.subs.map(function (x) {
      return { id: x.id, kind: "sub", published: x.published, rights: true,
        cells: [L.name(x.language), x.source === "youtube" ? "Trong video YouTube" : "WebVTT · " + x.url, x.is_default ? "✓" : "", x.published ? "Đang hiển thị" : "Nháp"] };
    })));
  }
  function setForms(on) { ["#vsm-media-save", "#vsm-sub-save"].forEach(function (s) { var b = $(s); if (b) b.disabled = !on; }); }
  function table(title, head, rows) {
    var w = el("div", "vsm-table"); w.append(el("h3", null, title));
    if (!rows.length) { w.append(el("p", "muted", "Chưa có.")); return w; }
    var t = el("table", "ops-table"), hr = el("tr"); head.forEach(function (h) { hr.append(el("th", null, h)); }); t.append(hr);
    rows.forEach(function (r) {
      var tr = el("tr"); tr.dataset.id = r.id; tr.dataset.kind = r.kind;
      r.cells.forEach(function (c) { tr.append(el("td", null, c)); });
      var td = el("td");
      var pub = el("button", "btn ghost vsm-publish", r.published ? "Gỡ phát hành" : "Phát hành"); pub.type = "button"; pub.dataset.publish = String(!r.published);
      var del = el("button", "btn ghost vsm-delete", "Xóa"); del.type = "button";
      td.append(pub, del); tr.append(td); t.append(tr);
    });
    w.append(t); return w;
  }

  async function addMedia() {
    if (!st.ep) { msg("Chọn tập phim trước.", true); return; }
    var r = L.parseSourceInput($("#vsm-link").value, { unlisted: $("#vsm-unlisted").checked });
    if (r.error) { msg(r.error, true); return; }
    var pr = parseInt($("#vsm-priority").value, 10); if (!(pr >= 0 && pr <= 99)) pr = 0;
    var me = await AFN.getUser();
    var row = { episode_id: st.ep, language: $("#vsm-lang").value, track_kind: $("#vsm-kind").value, provider: r.provider, external_id: r.external_id, url: r.url,
                priority: pr, label: $("#vsm-label").value.trim() || null, published: false, rights_attested: $("#vsm-rights").checked, created_by: me && me.id };
    var res = await db().from("episode_media").insert(row);
    if (res.error) { msg(explain(res.error), true); return; }
    msg("Đã lưu bản nháp " + PROV[r.provider] + " · " + L.name(row.language) + ". Chưa phát hành — người xem chưa thấy.");
    $("#vsm-link").value = ""; $("#vsm-detected").textContent = "";
    await loadRows();
  }
  async function addSub() {
    if (!st.ep) { msg("Chọn tập phim trước.", true); return; }
    var source = $("#vsm-sub-source").value, url = source === "vtt" ? $("#vsm-sub-url").value.trim() : null;
    if (source === "vtt" && !/^https:\/\/\S+$/.test(url || "")) { msg("Link WebVTT phải là https.", true); return; }
    if (source === "youtube" && !st.media.some(function (m) { return /youtube/.test(m.provider); })) { msg("Tập này chưa có nguồn YouTube — phụ đề YouTube sẽ không dùng được. Thêm nguồn YouTube hoặc chọn WebVTT.", true); return; }
    var me = await AFN.getUser();
    var res = await db().from("episode_subtitles").insert({ episode_id: st.ep, language: $("#vsm-sub-lang").value, source: source, url: url,
      is_default: $("#vsm-sub-default").checked, published: false, created_by: me && me.id });
    if (res.error) { msg(explain(res.error), true); return; }
    msg("Đã lưu phụ đề nháp " + L.name($("#vsm-sub-lang").value) + ".");
    await loadRows();
  }
  async function rowAction(e) {
    var b = e.target.closest("button"); if (!b) return;
    var tr = b.closest("tr"), id = tr && tr.dataset.id, table = tr && tr.dataset.kind === "media" ? "episode_media" : "episode_subtitles";
    if (!id) return;
    if (b.classList.contains("vsm-publish")) {
      var on = b.dataset.publish === "true", row = (table === "episode_media" ? st.media : st.subs).find(function (x) { return x.id === id; });
      if (on && table === "episode_media" && !row.rights_attested) {
        if (!confirm("Nguồn này chưa được xác nhận quyền phát.\nXác nhận website có quyền phát nguồn này và PHÁT HÀNH cho người xem?")) return;
        var u = await db().from(table).update({ rights_attested: true, published: true, updated_at: new Date().toISOString() }).eq("id", id);
        if (u.error) { msg(explain(u.error), true); return; }
      } else {
        if (!confirm(on ? "Phát hành cho người xem ngay bây giờ?" : "Gỡ khỏi trình phát của người xem?")) return;
        var u2 = await db().from(table).update({ published: on, updated_at: new Date().toISOString() }).eq("id", id);
        if (u2.error) { msg(explain(u2.error), true); return; }
      }
      msg(on ? "Đã phát hành." : "Đã gỡ phát hành."); await loadRows(); return;
    }
    if (b.classList.contains("vsm-delete")) {
      if (!confirm("Xóa dòng này? (Chỉ xóa khai báo link trên website, không ảnh hưởng video gốc.)")) return;
      var d = await db().from(table).delete().eq("id", id);
      if (d.error) { msg(explain(d.error), true); return; }
      msg("Đã xóa."); await loadRows();
    }
  }
  async function preview() {
    var out = $("#vsm-preview-out"); if (!st.ep) return;
    var lang = $("#vsm-preview-lang").value;
    var r = await db().rpc("get_playback_media", { p_episode_id: st.ep, p_language: lang });
    if (r.error) { out.textContent = explain(r.error); return; }
    var x = L.route(r.data, { urlLang: lang });
    out.textContent = x.status !== "ok" ? "Trạng thái: " + x.status :
      "Chế độ: " + ({ audio: "phát bản đúng ngôn ngữ", subtitle: "bản gốc + phụ đề", default: "ngôn ngữ mặc định", legacy: "nguồn cũ (v1)" }[x.mode] || x.mode) +
      "\nNguồn: " + (PROV[x.source.provider] || x.source.provider) + " · " + x.source.value +
      "\nPhụ đề: " + (x.subtitle ? L.name(x.subtitle.language) + " (" + (x.subtitle.source === "youtube" ? "trong video YouTube" : "WebVTT") + ")" : "không") +
      "\nLựa chọn cho người xem: " + x.options.map(function (o) { return o.name + (o.audio ? "" : " (phụ đề)"); }).join(", ");
  }

  function start() {
    var tab = $('[data-studio-tab="media"]'), sel = $("#studio-site");
    if (!tab || !sel) return;
    tab.addEventListener("click", function () { setTimeout(load, 0); });
    sel.addEventListener("change", function () { if (!$('[data-studio-panel="media"]').hidden) load(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.AFN_VSM = Object.freeze({ load: load });
})();
