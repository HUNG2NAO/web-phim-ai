/* Studio Level 4 — Tổng quan, Tập & quyền xem, Điểm danh & ví, Báo lỗi, Social, Traffic, Nhật ký, Phân quyền.
   Mọi thao tác đi qua RLS hoặc hàm server có kiểm tra quyền; thao tác quan trọng được ghi nhật ký ở server.
   Không render HTML từ dữ liệu: chỉ dùng textContent. */
(function () {
  "use strict";
  var AFN = window.AFN;
  var app = document.getElementById("studio-app");
  if (!AFN || !app) return;
  var $ = function (s) { return document.querySelector(s); };
  var el = AFN.el;
  var db = AFN.client();
  if (!db) return;
  var ctx = { site: null, uid: null, owner: false, siteAdmin: false, films: [], episodes: [], sources: {}, members: [], editing: null, ledgerUser: null };
  var TIER = { free: "Miễn phí", early: "Mở sớm bằng điểm", member: "Thành viên" };
  var REPORT_KIND = { video_error: "Video lỗi", wrong_info: "Sai thông tin", subtitle: "Phụ đề/âm thanh", copyright: "Bản quyền", other: "Khác" };
  var HOSTS = { facebook_page: ["facebook.com", "fb.com", "fb.me"], facebook_group: ["facebook.com", "fb.com"], tiktok: ["tiktok.com"],
    youtube: ["youtube.com", "youtu.be"], telegram: ["t.me", "telegram.me"], zalo: ["zalo.me"], instagram: ["instagram.com"], other: null };
  var PLATFORM_NAME = { facebook_page: "Fanpage", facebook_group: "Nhóm Facebook", tiktok: "TikTok", youtube: "YouTube", telegram: "Telegram", zalo: "Zalo", instagram: "Instagram", other: "Khác" };

  function status(text, err) { var s = $("#studio-status"); if (s) { s.textContent = text; s.style.color = err ? "#f8b2b5" : "var(--cyan)"; } }
  function explain(e) {
    var m = String((e && (e.message || e.details || e.hint)) || e || "");
    if (/forbidden|42501|permission denied|row-level security/i.test(m)) return "Bạn không có quyền thực hiện thao tác này.";
    if (/PGRST202|Could not find the function|does not exist|PGRST205/i.test(m)) return "Máy chủ chưa áp dụng migration Level 4 (db/level4_rewards_unlock_social_v1.sql).";
    if (/reason_required/.test(m)) return "Cần nhập lý do (ít nhất 5 ký tự).";
    if (/duplicate key|unique/i.test(m)) return "Dữ liệu bị trùng (ví dụ số tập đã tồn tại).";
    if (/check constraint/i.test(m)) return "Dữ liệu không hợp lệ (kiểm tra giá, đường dẫn, mã video).";
    return "Thao tác chưa thành công. Vui lòng thử lại.";
  }
  function table(headers, rows) {
    var t = el("table", "ops-table"), thead = el("thead"), tr = el("tr");
    headers.forEach(function (h) { tr.append(el("th", "", h)); });
    thead.append(tr); t.append(thead);
    var tb = el("tbody");
    rows.forEach(function (r) {
      var row = el("tr");
      r.forEach(function (cell) {
        var td = el("td");
        if (cell instanceof Node) td.append(cell);
        else if (cell && typeof cell === "object" && "num" in cell) { td.className = "num"; td.textContent = AFN.formatPoints(cell.num); }
        else td.textContent = cell === null || cell === undefined ? "–" : String(cell);
        row.append(td);
      });
      tb.append(row);
    });
    t.append(tb);
    return t;
  }
  function btn(text, onClick, cls) { var b = el("button", "btn " + (cls || "ghost"), text); b.type = "button"; b.addEventListener("click", onClick); return b; }
  function group() { var d = el("div", "ops-inline"); Array.prototype.slice.call(arguments).forEach(function (x) { if (x) d.append(x); }); return d; }
  function empty(node, text) { node.replaceChildren(el("p", "ops-note", text)); }
  function short(id) { return String(id || "").slice(0, 8); }
  async function rpc(name, args) { var r = await db.rpc(name, args); if (r.error) throw r.error; return r.data; }
  async function rows(q) { var r = await q; if (r.error) throw r.error; return r.data || []; }
  function vnInputToIso(v) { return v ? new Date(v + ":00+07:00").toISOString() : null; }
  function isoToVnInput(iso) {
    if (!iso) return "";
    var d = new Date(new Date(iso).getTime() + 7 * 3600e3);
    return d.toISOString().slice(0, 16);
  }

  // ---------------------------------------------------------------- overview
  var LABELS = [["members", "Thành viên"], ["films_published", "Phim đã phát hành"], ["films_draft", "Phim bản nháp"],
    ["episodes_published", "Tập đã phát hành"], ["episodes_locked", "Tập đang khóa"], ["checkins_today", "Điểm danh hôm nay"],
    ["checkins_7d", "Điểm danh 7 ngày"], ["points_issued_7d", "Điểm phát ra 7 ngày"], ["points_spent_7d", "Điểm dùng mở khóa 7 ngày"],
    ["unlocks_7d", "Lượt mở khóa 7 ngày"], ["reviews_pending", "Đánh giá chờ duyệt"], ["reports_open", "Báo lỗi đang mở"],
    ["campaign_visits_7d", "Lượt vào từ chiến dịch 7 ngày"]];
  async function loadOverview() {
    var box = $("#ops-overview");
    try {
      var d = await rpc("admin_overview", { p_site: ctx.site });
      box.replaceChildren();
      LABELS.forEach(function (l) { var c = el("div", "ops-card"); c.append(el("span", "", l[1]), el("strong", "", AFN.formatPoints(d[l[0]]))); box.append(c); });
      $("#ops-overview-time").textContent = "Cập nhật " + AFN.vnDateTime(d.generated_at || new Date());
    } catch (e) { empty(box, explain(e)); }
  }

  // ---------------------------------------------------------------- episodes
  async function loadEpisodes() {
    var list = $("#ops-episodes"), sel = $("#ops-ep-film");
    try {
      ctx.films = await rows(db.from("site_films").select("film_id,title,published,film_type").eq("site_id", ctx.site).order("created_at", { ascending: false }));
      var keep = sel.value;
      sel.replaceChildren();
      if (!ctx.films.length) { sel.append(new Option("Chưa có phim — thêm ở tab Phim & bản quyền", "")); }
      ctx.films.forEach(function (f) { sel.append(new Option(f.title + (f.published ? "" : " (nháp)"), f.film_id)); });
      if (keep && ctx.films.some(function (f) { return f.film_id === keep; })) sel.value = keep;
      ctx.episodes = await rows(db.from("site_episodes").select("*").eq("site_id", ctx.site).order("film_id", { ascending: true }).order("episode_no", { ascending: true }));
      var src = ctx.siteAdmin ? await rows(db.from("episode_sources").select("episode_id,source_kind")) : [];
      ctx.sources = {}; src.forEach(function (s) { ctx.sources[s.episode_id] = s.source_kind; });
      renderEpisodes();
    } catch (e) { empty(list, explain(e)); }
  }
  function renderEpisodes() {
    var list = $("#ops-episodes"), film = $("#ops-ep-film").value;
    var eps = ctx.episodes.filter(function (e) { return !film || e.film_id === film; });
    if (!eps.length) { empty(list, "Phim này chưa có tập nào."); return; }
    list.replaceChildren(table(["Tập", "Quyền xem", "Giá", "Miễn phí từ", "Hạn xem", "Nguồn", "Trạng thái", ""], eps.map(function (e) {
      return [String(e.episode_no) + (e.title ? " · " + e.title : ""), TIER[e.access_tier] || e.access_tier,
        e.access_tier === "early" ? { num: e.price_points } : "–", e.free_from ? AFN.vnDateTime(e.free_from) : "–",
        e.access_days ? e.access_days + " ngày" : "Vĩnh viễn", ctx.sources[e.id] || "Chưa có",
        e.published ? "Đã phát hành" : "Nháp",
        group(btn("Sửa", function () { editEpisode(e); }),
          btn(e.published ? "Gỡ" : "Phát hành", function (ev) { togglePublish(e, ev.currentTarget); }),
          btn("Xóa", function (ev) { deleteEpisode(e, ev.currentTarget); }))];
    })));
  }
  function syncTier() { $("#ops-early-fields").hidden = $("#ops-ep-tier").value !== "early"; }
  function resetEpisodeForm() {
    ctx.editing = null;
    $("#ops-episode-form").reset();
    $("#ops-episode-heading").textContent = "Thêm tập phim";
    $("#ops-ep-film").disabled = false; $("#ops-ep-no").disabled = false;
    var film = $("#ops-ep-film").value;
    var max = ctx.episodes.filter(function (e) { return e.film_id === film; }).reduce(function (m, e) { return Math.max(m, e.episode_no); }, 0);
    $("#ops-ep-no").value = String(max + 1);
    syncTier();
  }
  function editEpisode(e) {
    ctx.editing = e;
    $("#ops-episode-heading").textContent = "Sửa tập " + e.episode_no;
    $("#ops-ep-film").value = e.film_id; $("#ops-ep-film").disabled = true;
    $("#ops-ep-no").value = String(e.episode_no); $("#ops-ep-no").disabled = true;
    $("#ops-ep-title").value = e.title || "";
    $("#ops-ep-tier").value = e.access_tier;
    $("#ops-ep-price").value = String(e.price_points || 50);
    $("#ops-ep-free").value = isoToVnInput(e.free_from);
    $("#ops-ep-days").value = e.access_days ? String(e.access_days) : "";
    $("#ops-ep-video").value = ""; $("#ops-ep-rights").checked = false;
    $("#ops-ep-published").checked = !!e.published;
    syncTier();
    $("#ops-ep-title").focus();
  }
  async function saveEpisode(ev) {
    ev.preventDefault();
    var tier = $("#ops-ep-tier").value, video = $("#ops-ep-video").value.trim(), kind = $("#ops-ep-source").value;
    var publish = $("#ops-ep-published").checked;
    var fields = { title: $("#ops-ep-title").value.trim().slice(0, 160), access_tier: tier,
      price_points: tier === "early" ? Math.max(1, parseInt($("#ops-ep-price").value, 10) || 0) : 0,
      free_from: tier === "early" ? vnInputToIso($("#ops-ep-free").value) : null,
      access_days: tier === "early" && $("#ops-ep-days").value ? parseInt($("#ops-ep-days").value, 10) : null,
      published: publish, updated_at: new Date().toISOString() };
    if (video) {
      if (kind === "youtube" && !/^[A-Za-z0-9_-]{11}$/.test(video)) { status("YouTube ID phải có đúng 11 ký tự.", true); return; }
      if (kind === "native" && !/^https:\/\/\S+$/.test(video)) { status("Video phải là đường dẫn HTTPS.", true); return; }
      if (!$("#ops-ep-rights").checked) { status("Cần xác nhận quyền phát hành nguồn video.", true); return; }
    }
    var existingSource = ctx.editing && ctx.sources[ctx.editing.id];
    if (publish && !video && !existingSource) { status("Tập chưa có nguồn phát nên chưa thể phát hành.", true); return; }
    var save = $("#ops-ep-save"); save.disabled = true;
    try {
      var id;
      if (ctx.editing) {
        var u = await db.from("site_episodes").update(fields).eq("id", ctx.editing.id).eq("site_id", ctx.site);
        if (u.error) throw u.error;
        id = ctx.editing.id;
      } else {
        var film = $("#ops-ep-film").value;
        if (!film) { status("Hãy chọn phim.", true); return; }
        var row = Object.assign({ site_id: ctx.site, film_id: film, episode_no: parseInt($("#ops-ep-no").value, 10), created_by: ctx.uid }, fields);
        delete row.updated_at;
        if (publish && video) row.published = false;            // publish only after the source is stored
        var ins = await db.from("site_episodes").insert(row).select("id").single();
        if (ins.error) throw ins.error;
        id = ins.data.id;
      }
      if (video) {
        var src = { episode_id: id, source_kind: kind, youtube_id: kind === "youtube" ? video : null, video_url: kind === "native" ? video : null, updated_at: new Date().toISOString() };
        var up = await db.from("episode_sources").upsert(src, { onConflict: "episode_id" });
        if (up.error) throw up.error;
        if (publish && !ctx.editing) {
          var pub = await db.from("site_episodes").update({ published: true, updated_at: new Date().toISOString() }).eq("id", id);
          if (pub.error) throw pub.error;
        }
      }
      status("Đã lưu tập phim.");
      await loadEpisodes(); resetEpisodeForm();
    } catch (e) { status(explain(e), true); }
    finally { save.disabled = false; }
  }
  async function togglePublish(e, b) {
    if (!e.published && !ctx.sources[e.id]) { status("Tập chưa có nguồn phát nên chưa thể phát hành.", true); return; }
    b.disabled = true;
    try {
      var r = await db.from("site_episodes").update({ published: !e.published, updated_at: new Date().toISOString() }).eq("id", e.id).eq("site_id", ctx.site);
      if (r.error) throw r.error;
      status(e.published ? "Đã gỡ tập khỏi website." : "Đã phát hành tập."); await loadEpisodes();
    } catch (err) { status(explain(err), true); b.disabled = false; }
  }
  async function deleteEpisode(e, b) {
    if (!confirm("Xóa tập " + e.episode_no + "? Người đã mở khóa sẽ mất quyền xem tập này.")) return;
    b.disabled = true;
    try {
      var r = await db.from("site_episodes").delete().eq("id", e.id).eq("site_id", ctx.site);
      if (r.error) throw r.error;
      status("Đã xóa tập."); await loadEpisodes();
    } catch (err) { status(explain(err), true); b.disabled = false; }
  }

  // ---------------------------------------------------------------- wallet & check-in
  function rulePreview() {
    var base = +$("#ops-rule-base").value || 0, step = +$("#ops-rule-step").value || 0, cap = +$("#ops-rule-cap").value || 0, d7 = +$("#ops-rule-day7").value || 0;
    var days = [];
    for (var i = 1; i <= 7; i++) days.push("N" + i + ": " + (base + Math.min(i - 1, cap) * step + (i === 7 ? d7 : 0)));
    $("#ops-rule-preview").textContent = "Xem trước 7 ngày liên tiếp → " + days.join(" · ");
  }
  async function loadWallet() {
    try {
      var r = await rows(db.from("reward_rules").select("*").eq("id", 1));
      var rule = r[0];
      if (rule) {
        $("#ops-rule-enabled").checked = !!rule.checkin_enabled;
        $("#ops-rule-base").value = rule.checkin_base; $("#ops-rule-step").value = rule.streak_step;
        $("#ops-rule-cap").value = rule.streak_step_cap; $("#ops-rule-day7").value = rule.day7_bonus;
        rulePreview();
      }
      Array.prototype.forEach.call($("#ops-rules-form").elements, function (x) { x.disabled = !ctx.owner; });
      $("#ops-rules-note").textContent = ctx.owner ? "Áp dụng cho toàn bộ 5 website. Thay đổi được ghi vào nhật ký."
        : "Chỉ chủ hệ thống được thay đổi cấu hình điểm (bạn đang xem ở chế độ chỉ đọc).";
    } catch (e) { $("#ops-rules-note").textContent = explain(e); }
    var box = $("#ops-members");
    if (!ctx.siteAdmin) { empty(box, "Cần quyền admin của website để xem ví thành viên."); empty($("#ops-ents"), "Cần quyền admin."); return; }
    try {
      ctx.members = await rpc("admin_member_wallets", { p_site: ctx.site }) || [];
      if (!ctx.members.length) empty(box, "Chưa có thành viên tham gia website này.");
      else box.replaceChildren(table(["Thành viên", "Số dư", "Đã nhận", "Đã dùng", "Điểm danh gần nhất", ""], ctx.members.map(function (m) {
        return [m.display_name + " · " + short(m.user_id), { num: m.balance }, { num: m.earned_total }, { num: m.spent_total },
          m.last_checkin ? AFN.vnDate(m.last_checkin + "T12:00:00+07:00") + " (chuỗi " + m.streak + ")" : "Chưa",
          btn("Lịch sử", function () { loadLedger(m); })];
      })));
    } catch (e) { empty(box, explain(e)); }
    loadEntitlements();
  }
  async function loadLedger(m) {
    ctx.ledgerUser = m;
    $("#ops-ledger-title").textContent = "Lịch sử điểm · " + m.display_name;
    var box = $("#ops-ledger");
    $("#ops-adjust-form").hidden = !ctx.owner;
    try {
      var list = await rpc("admin_member_ledger", { p_site: ctx.site, p_user: m.user_id }) || [];
      if (!list.length) { empty(box, "Thành viên chưa có giao dịch điểm."); return; }
      box.replaceChildren(table(["Thời gian", "Loại", "Thay đổi", "Số dư sau", "Ghi chú"], list.map(function (x) {
        return [AFN.vnDateTime(x.created_at), x.kind, (x.delta > 0 ? "+" : "") + AFN.formatPoints(x.delta), { num: x.balance_after }, x.note || ""];
      })));
    } catch (e) { empty(box, explain(e)); }
  }
  async function loadEntitlements() {
    var box = $("#ops-ents");
    try {
      var list = await rpc("admin_site_entitlements", { p_site: ctx.site }) || [];
      if (!list.length) { empty(box, "Chưa có lượt mở khóa nào."); return; }
      box.replaceChildren(table(["Thời gian", "Phim · tập", "Thành viên", "Điểm", "Trạng thái", ""], list.map(function (x) {
        var who = (ctx.members.find(function (m) { return m.user_id === x.user_id; }) || {}).display_name || short(x.user_id);
        var action = x.status === "active" && x.points_paid > 0 ? btn("Hoàn điểm", function (ev) { refund(x, ev.currentTarget); }) : "";
        return [AFN.vnDateTime(x.granted_at), x.film_id + " · " + x.episode_no, who, { num: x.points_paid },
          { active: "Đang hiệu lực", expired: "Hết hạn", refunded: "Đã hoàn", revoked: "Thu hồi" }[x.status] || x.status, action];
      })));
    } catch (e) { empty(box, explain(e)); }
  }
  async function refund(x, b) {
    var reason = prompt("Lý do hoàn " + x.points_paid + " điểm (ghi vào nhật ký):", "Video lỗi, hoàn điểm cho thành viên");
    if (!reason) return;
    b.disabled = true;
    try {
      var r = await rpc("admin_refund_unlock", { p_entitlement_id: x.id, p_reason: reason });
      status(r && r.status === "refunded" ? "Đã hoàn " + r.points + " điểm." : "Lượt mở khóa này không thể hoàn.", !(r && r.status === "refunded"));
      loadWallet();
    } catch (e) { status(explain(e), true); b.disabled = false; }
  }

  // ---------------------------------------------------------------- reports
  async function loadReports() {
    var box = $("#ops-reports"), filter = $("#ops-report-filter").value;
    try {
      var list = await rows(db.from("content_reports").select("*").eq("site_id", ctx.site).eq("status", filter).order("created_at", { ascending: false }).limit(200));
      if (!list.length) { empty(box, filter === "open" ? "Không có báo lỗi đang mở." : "Không có mục nào."); return; }
      box.replaceChildren();
      list.forEach(function (r) {
        var a = el("article", "studio-item");
        a.append(el("h3", "", r.film_id + (r.episode_no ? " · tập " + r.episode_no : "") + " — " + (REPORT_KIND[r.kind] || r.kind)),
          el("p", "muted", AFN.vnDateTime(r.created_at) + " · người gửi " + short(r.user_id)));
        if (r.note) a.append(el("blockquote", "", r.note));
        if (r.status === "open") a.append(group(btn("Đã xử lý", function (ev) { handle(r, "resolved", ev.currentTarget); }, "primary"),
          btn("Bỏ qua", function (ev) { handle(r, "dismissed", ev.currentTarget); })));
        box.append(a);
      });
    } catch (e) { empty(box, explain(e)); }
  }
  async function handle(r, s, b) {
    b.disabled = true;
    try {
      var u = await db.from("content_reports").update({ status: s, handled_at: new Date().toISOString(), handled_by: ctx.uid }).eq("id", r.id).eq("site_id", ctx.site);
      if (u.error) throw u.error;
      status("Đã cập nhật báo lỗi."); loadReports();
    } catch (e) { status(explain(e), true); b.disabled = false; }
  }

  // ---------------------------------------------------------------- social
  async function loadSocial() {
    var box = $("#ops-social-list");
    try {
      var list = await rows(db.from("site_social_links").select("*").eq("site_id", ctx.site).order("sort_order", { ascending: true }));
      if (!list.length) { empty(box, "Chưa có liên kết nào. Website sẽ không hiển thị khối Social cho tới khi bạn thêm."); return; }
      box.replaceChildren();
      list.forEach(function (x) {
        var a = el("article", "studio-item");
        a.append(el("h3", "", (PLATFORM_NAME[x.platform] || x.platform) + " · " + x.label),
          el("p", "muted", x.url + " · hiển thị ở: " + (x.placements || []).join(", ") + " · " + (x.enabled ? "đang bật" : "đang tắt")));
        a.append(group(btn(x.enabled ? "Tắt" : "Bật", async function (ev) {
          ev.currentTarget.disabled = true;
          var r = await db.from("site_social_links").update({ enabled: !x.enabled, updated_at: new Date().toISOString() }).eq("id", x.id);
          if (r.error) status(explain(r.error), true); else { status("Đã cập nhật liên kết."); loadSocial(); }
        }), btn("Xóa", async function (ev) {
          if (!confirm("Xóa liên kết " + x.label + "?")) return;
          ev.currentTarget.disabled = true;
          var r = await db.from("site_social_links").delete().eq("id", x.id);
          if (r.error) status(explain(r.error), true); else { status("Đã xóa liên kết."); loadSocial(); }
        })));
        box.append(a);
      });
    } catch (e) { empty(box, explain(e)); }
  }
  async function addSocial(ev) {
    ev.preventDefault();
    var platform = $("#ops-social-platform").value, url = $("#ops-social-url").value.trim(), label = $("#ops-social-label").value.trim();
    var hosts = HOSTS[platform];
    try {
      var u = new URL(url);
      if (u.protocol !== "https:") throw 0;
      if (hosts && !hosts.some(function (h) { return u.hostname === h || u.hostname.endsWith("." + h); })) { status("Đường dẫn không thuộc " + (PLATFORM_NAME[platform] || platform) + ".", true); return; }
    } catch (e) { status("Đường dẫn phải bắt đầu bằng https://", true); return; }
    var placements = Array.prototype.map.call(document.querySelectorAll("#ops-social-form .ops-checks input:checked"), function (x) { return x.value; });
    if (!placements.length) { status("Chọn ít nhất một vị trí hiển thị.", true); return; }
    var r = await db.from("site_social_links").insert({ site_id: ctx.site, platform: platform, label: label, url: url,
      placements: placements, sort_order: parseInt($("#ops-social-sort").value, 10) || 0 });
    if (r.error) { status(explain(r.error), true); return; }
    ev.target.reset(); status("Đã thêm liên kết."); loadSocial();
  }

  // ---------------------------------------------------------------- traffic, audit, staff
  async function loadTraffic() {
    var box = $("#ops-traffic");
    try {
      var list = await rpc("admin_traffic", { p_site: ctx.site, p_days: parseInt($("#ops-traffic-days").value, 10) }) || [];
      if (!list.length) { empty(box, "Chưa có lượt truy cập nào có gắn UTM hoặc mã giới thiệu trong khoảng thời gian này."); return; }
      box.replaceChildren(table(["Nguồn", "Kênh", "Chiến dịch", "Mã giới thiệu", "Lượt vào", "Gần nhất"], list.map(function (x) {
        return [x.utm_source || "–", x.utm_medium || "–", x.utm_campaign || "–", x.ref_code || "–", { num: x.visits }, AFN.vnDateTime(x.last_visit)];
      })));
    } catch (e) { empty(box, explain(e)); }
  }
  function buildUtm(ev) {
    ev.preventDefault();
    var brand = (AFN.sites || []).find(function (s) { return s.id === ctx.site; });
    var u = new URL("https://www." + (brand ? brand.domain : "xuongphim.ai") + "/");
    var film = $("#ops-utm-film").value.trim().toLowerCase();
    if (film && /^[a-z0-9][a-z0-9-]{0,119}$/.test(film)) u.searchParams.set("film", film);
    [["utm_source", "#ops-utm-source"], ["utm_medium", "#ops-utm-medium"], ["utm_campaign", "#ops-utm-campaign"]].forEach(function (p) {
      var v = $(p[1]).value.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 60);
      if (v) u.searchParams.set(p[0], v);
    });
    var out = $("#ops-utm-out"); out.hidden = false; out.textContent = u.href;
    status("Đã tạo đường dẫn.");
    try {
      navigator.clipboard.writeText(u.href).then(function () { status("Đã tạo và sao chép đường dẫn."); }, function () {});
    } catch (e) { /* clipboard unavailable: the link stays visible to copy by hand */ }
  }
  async function loadAudit() {
    var box = $("#ops-audit");
    try {
      var list = await rows(db.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(300));
      list = list.filter(function (x) { return x.site_id === ctx.site || x.site_id === null; });
      if (!list.length) { empty(box, "Chưa có hoạt động quản trị nào được ghi."); return; }
      box.replaceChildren(table(["Thời gian", "Người thực hiện", "Hành động", "Đối tượng", "Chi tiết"], list.slice(0, 200).map(function (x) {
        var details = x.details && x.details.changed ? "Đổi: " + x.details.changed.join(", ") :
          x.details && x.details.reason ? "Lý do: " + x.details.reason : x.details && x.details.delta ? "Điểm: " + x.details.delta : "";
        return [AFN.vnDateTime(x.created_at), x.actor === ctx.uid ? "Bạn" : short(x.actor), x.action, x.target, details];
      })));
    } catch (e) { empty(box, explain(e)); }
  }
  async function loadStaff() {
    var box = $("#ops-staff");
    try {
      var list = await rpc("admin_site_staff", { p_site: ctx.site }) || [];
      box.replaceChildren(table(["Người", "Vai trò", "Từ ngày"], list.map(function (x) {
        return [x.display_name + " · " + short(x.user_id), { admin: "Admin website", moderator: "Kiểm duyệt viên", network_owner: "Chủ hệ thống (5 website)" }[x.role] || x.role, AFN.vnDate(x.added_at)];
      })));
    } catch (e) { empty(box, explain(e)); }
  }

  // ---------------------------------------------------------------- wiring
  async function loadAll() {
    ctx.site = $("#studio-site").value || ctx.site;
    if (!ctx.site) return;
    var me = await AFN.getUser();
    ctx.uid = me && me.id;
    try {
      var own = await rows(db.from("network_staff").select("user_id").eq("user_id", ctx.uid));
      ctx.owner = own.length > 0;
    } catch (e) { ctx.owner = false; }
    try {
      var mine = await rows(db.from("site_staff").select("role").eq("user_id", ctx.uid).eq("site_id", ctx.site));
      ctx.siteAdmin = ctx.owner || mine.some(function (x) { return x.role === "admin"; });
    } catch (e) { ctx.siteAdmin = ctx.owner; }
    await Promise.all([loadOverview(), loadEpisodes(), loadWallet(), loadReports(), loadSocial(), loadTraffic(), loadAudit(), loadStaff()]);
    resetEpisodeForm();
  }
  $("#ops-ep-tier").addEventListener("change", syncTier);
  $("#ops-ep-film").addEventListener("change", function () { renderEpisodes(); if (!ctx.editing) resetEpisodeForm(); });
  $("#ops-ep-reset").addEventListener("click", resetEpisodeForm);
  $("#ops-episode-form").addEventListener("submit", saveEpisode);
  ["#ops-rule-base", "#ops-rule-step", "#ops-rule-cap", "#ops-rule-day7"].forEach(function (s) { $(s).addEventListener("input", rulePreview); });
  $("#ops-rules-form").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    if (!confirm("Áp dụng cấu hình điểm danh mới cho cả 5 website?")) return;
    try {
      await rpc("admin_set_reward_rules", { p_enabled: $("#ops-rule-enabled").checked, p_base: +$("#ops-rule-base").value,
        p_step: +$("#ops-rule-step").value, p_cap: +$("#ops-rule-cap").value, p_day7: +$("#ops-rule-day7").value });
      status("Đã lưu cấu hình điểm danh."); loadWallet(); loadAudit();
    } catch (e) { status(explain(e), true); }
  });
  $("#ops-adjust-form").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var m = ctx.ledgerUser; if (!m) return;
    var delta = parseInt($("#ops-adjust-delta").value, 10), reason = $("#ops-adjust-reason").value.trim();
    if (!delta) { status("Số điểm phải khác 0.", true); return; }
    if (!confirm((delta > 0 ? "Cộng " : "Trừ ") + Math.abs(delta) + " điểm cho " + m.display_name + "?")) return;
    try {
      var r = await rpc("admin_adjust_points", { p_user: m.user_id, p_delta: delta, p_reason: reason, p_key: AFN.idemKey("adm") });
      if (r.status === "insufficient") status("Không thể trừ quá số dư hiện có (" + r.balance + ").", true);
      else { status("Đã điều chỉnh. Số dư mới: " + r.balance + " điểm."); ev.target.reset(); }
      await loadWallet(); loadLedger(m); loadAudit();
    } catch (e) { status(explain(e), true); }
  });
  $("#ops-report-filter").addEventListener("change", loadReports);
  $("#ops-social-form").addEventListener("submit", addSocial);
  $("#ops-traffic-days").addEventListener("change", loadTraffic);
  $("#ops-utm-form").addEventListener("submit", buildUtm);
  $("#studio-site").addEventListener("change", function () { setTimeout(loadAll, 0); });
  $("#studio-reload").addEventListener("click", function () { setTimeout(loadAll, 0); });

  var started = false;
  function start() { if (started || app.hidden || !$("#studio-site").value) return; started = true; loadAll(); }
  start();
  new MutationObserver(start).observe(app, { attributes: true, attributeFilter: ["hidden"] });
  new MutationObserver(start).observe($("#studio-site"), { childList: true });
})();
