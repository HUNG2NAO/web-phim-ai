/* AI FILM NETWORK — Community Chat (Level 4.2). Dùng chung cho cả 5 website.
   - Phòng "network": trò chuyện chung toàn mạng · phòng "film:<site>:<phim>": bàn luận theo phim.
   - Đọc/gửi cần đăng nhập. Gửi qua RPC send_chat_message (máy chủ gắn tên người gửi, giới hạn tần suất, chặn khi bị khóa).
   - Cập nhật trực tiếp bằng Supabase Realtime (postgres_changes, vẫn chịu RLS) + Presence cho số người đang xem THẬT.
   - Nội dung luôn hiển thị bằng textContent: không bao giờ chèn HTML từ người dùng. */
(function () {
  "use strict";
  var AFN = window.AFN;
  if (!AFN || !AFN.configured) return;
  var el = AFN.el;
  var ERR = {
    login_required: "Vui lòng đăng nhập để trò chuyện.",
    chat_rate_limited: "Bạn đang gửi quá nhanh. Vui lòng chờ vài giây rồi gửi tiếp.",
    chat_duplicate: "Tin nhắn trùng với tin bạn vừa gửi.",
    chat_muted: "Bạn đang bị tạm khóa chat do vi phạm quy định cộng đồng.",
    message_too_long: "Tin nhắn tối đa 500 ký tự.",
    empty_message: "Tin nhắn đang trống.",
    invalid_message: "Tin nhắn chứa ký tự không hợp lệ.",
    invalid_room: "Phòng chat không hợp lệ.",
    cannot_report_own: "Bạn không thể báo cáo tin của chính mình.",
    report_rate_limited: "Bạn đã gửi quá nhiều báo cáo hôm nay.",
    forbidden: "Bạn không có quyền thực hiện thao tác này.",
    reason_required: "Cần nhập lý do."
  };
  var REASONS = [["spam", "Spam"], ["harassment", "Quấy rối"], ["spoiler", "Tiết lộ nội dung"], ["inappropriate", "Không phù hợp"]];
  function explain(e) {
    var m = (e && (e.message || e.details)) || "";
    for (var k in ERR) if (m.indexOf(k) !== -1) return ERR[k];
    if (/relation .* does not exist|function .* does not exist|schema cache/i.test(m)) return "Chat chưa được bật trên máy chủ này.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "Mất kết nối mạng. Vui lòng thử lại.";
    return "Không thực hiện được. Vui lòng thử lại.";
  }
  function timeVN(iso) {
    try { return new Date(iso).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; }
  }
  var roles = null;            // { owner: bool, sites: {site_id: role} }
  function loadRoles(c, uid) {
    if (roles) return Promise.resolve(roles);
    return Promise.all([
      c.from("network_staff").select("user_id").eq("user_id", uid),
      c.from("site_staff").select("site_id,role").eq("user_id", uid)
    ]).then(function (r) {
      roles = { owner: !!(r[0].data && r[0].data.length), sites: {} };
      (r[1].data || []).forEach(function (x) { roles.sites[x.site_id] = x.role; });
      return roles;
    }).catch(function () { return (roles = { owner: false, sites: {} }); });
  }
  function canModerate(room) {
    if (!roles) return false;
    if (roles.owner) return true;
    if (room === "network") return Object.keys(roles.sites).some(function (k) { return roles.sites[k] === "admin"; });
    return !!roles.sites[room.split(":")[1]];
  }
  function canMute() { return !!roles && (roles.owner || Object.keys(roles.sites).some(function (k) { return roles.sites[k] === "admin"; })); }

  /* ------------------------------------------------------------------ một khung chat */
  function mount(box, room, opts) {
    opts = opts || {};
    var c = AFN.client(), alive = true, channel = null, uid = null, msgs = {}, resync = 0;
    box.replaceChildren(); box.classList.add("afn-chat"); box.dataset.room = room;
    var head = el("div", "afn-chat-head");
    var title = el("h3", "afn-chat-title", opts.title || "Trò chuyện");
    var live = el("span", "afn-chat-live", "Đang kết nối…"); live.setAttribute("aria-live", "polite");
    head.append(title, live);
    var list = el("ol", "afn-chat-list"); list.setAttribute("aria-label", "Tin nhắn"); list.setAttribute("aria-live", "polite");
    var banner = el("p", "afn-chat-banner"); banner.hidden = true;
    var form = el("form", "afn-chat-form");
    var input = el("textarea"); input.rows = 1; input.maxLength = 500; input.placeholder = "Nhập tin nhắn… (Enter để gửi)";
    input.setAttribute("aria-label", "Tin nhắn");
    var send = el("button", "afn-btn primary", "Gửi"); send.type = "submit";
    var count = el("span", "afn-chat-count", "0/500");
    var emo = el("div", "afn-chat-emoji");
    ["👍", "❤️", "😂", "😮", "🔥", "🎬"].forEach(function (e) {
      var b = el("button", "afn-chat-emo", e); b.type = "button"; b.setAttribute("aria-label", "Chèn " + e);
      b.addEventListener("click", function () { input.value = (input.value + " " + e).trimStart().slice(0, 500); input.dispatchEvent(new Event("input")); input.focus(); });
      emo.append(b);
    });
    var status = el("p", "afn-chat-status"); status.setAttribute("role", "status");
    form.append(input, send);
    box.append(head, banner, list, emo, form, count, status);

    function setStatus(t, bad) { status.textContent = t || ""; status.classList.toggle("bad", !!bad); }
    function render() {
      var arr = Object.keys(msgs).map(function (k) { return msgs[k]; })
        .sort(function (a, b) { return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : (a.id < b.id ? -1 : 1); }).slice(-100);
      var nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
      list.replaceChildren();
      if (!arr.length) { list.append(el("li", "afn-chat-empty", "Chưa có tin nhắn. Hãy là người mở lời!")); }
      arr.forEach(function (m) {
        var li = el("li", "afn-chat-msg" + (m.user_id === uid ? " mine" : "") + (m.hidden ? " hidden-msg" : ""));
        li.dataset.id = m.id;
        var meta = el("div", "afn-chat-meta");
        meta.append(el("strong", "afn-chat-who", m.display_name), el("time", "afn-chat-time", timeVN(m.created_at)));
        if (m.user_id === uid) meta.append(el("span", "afn-chat-tag", "Bạn"));
        if (m.hidden) meta.append(el("span", "afn-chat-tag warn", "Đã ẩn"));
        li.append(meta, el("p", "afn-chat-body", m.body));     // textContent → không chèn HTML
        var acts = el("div", "afn-chat-acts");
        if (uid && m.user_id !== uid && !m.hidden) acts.append(btn("Báo cáo", function () { reportUI(li, m); }));
        if (canModerate(room)) {
          acts.append(btn(m.hidden ? "Khôi phục" : "Ẩn", function () { moderate(m, !m.hidden); }));
          if (m.user_id !== uid && canMute()) acts.append(btn("Khóa chat 24h", function () { mute(m); }));
        }
        if (acts.childElementCount) li.append(acts);
        list.append(li);
      });
      if (nearBottom) list.scrollTop = list.scrollHeight;
    }
    function btn(t, fn) { var b = el("button", "afn-chat-act", t); b.type = "button"; b.addEventListener("click", fn); return b; }
    function upsert(m) { if (!m || !m.id) return; if (m.hidden && m.user_id !== uid && !canModerate(room)) delete msgs[m.id]; else msgs[m.id] = m; }
    function load() {
      return c.from("chat_messages").select("id,room,user_id,display_name,body,created_at,hidden").eq("room", room)
        .order("created_at", { ascending: false }).limit(50).then(function (r) {
          if (!alive) return;
          if (r.error) { setStatus(explain(r.error), true); return; }
          var keep = {}; (r.data || []).forEach(function (m) { keep[m.id] = m; });
          msgs = keep; render();
        });
    }
    function reportUI(li, m) {
      if (li.querySelector(".afn-chat-report")) return;
      var f = el("div", "afn-chat-report");
      f.append(el("span", "afn-muted", "Lý do:"));
      REASONS.forEach(function (r) {
        f.append(btn(r[1], function () {
          c.rpc("report_chat_message", { p_message_id: m.id, p_reason: r[0], p_note: "" }).then(function (res) {
            if (res.error) { setStatus(explain(res.error), true); return; }
            f.remove(); AFN.toast("Đã gửi báo cáo. Cảm ơn bạn giúp cộng đồng văn minh!");
          });
        }));
      });
      f.append(btn("Hủy", function () { f.remove(); }));
      li.append(f);
    }
    function moderate(m, hide) {
      var reason = hide ? "Vi phạm quy định cộng đồng" : "Khôi phục sau xem xét";
      c.rpc("chat_moderate_message", { p_message_id: m.id, p_hide: hide, p_reason: reason }).then(function (r) {
        if (r.error) { setStatus(explain(r.error), true); return; }
        m.hidden = hide; render(); AFN.toast(hide ? "Đã ẩn tin nhắn." : "Đã khôi phục tin nhắn.");
      });
    }
    function mute(m) {
      c.rpc("chat_set_mute", { p_user: m.user_id, p_minutes: 1440, p_reason: "Vi phạm quy định cộng đồng (24 giờ)" }).then(function (r) {
        if (r.error) { setStatus(explain(r.error), true); return; }
        AFN.toast("Đã khóa chat " + m.display_name + " trong 24 giờ.");
      });
    }
    function checkMute() {
      return c.from("chat_mutes").select("muted_until").eq("user_id", uid).then(function (r) {
        var row = r.data && r.data[0];
        var muted = !!row && (!row.muted_until || new Date(row.muted_until) > new Date());
        banner.hidden = !muted;
        if (muted) banner.textContent = "Bạn đang bị tạm khóa chat" + (row.muted_until ? " đến " + AFN.vnDateTime(row.muted_until) : "") + ".";
        input.disabled = send.disabled = muted || !navigator.onLine;
      });
    }
    function subscribe() {
      if (typeof c.channel !== "function") { live.textContent = "Không hỗ trợ trực tiếp"; return; }
      channel = c.channel("chat:" + room, { config: { presence: { key: uid } } })
        .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: "room=eq." + room }, function (p) {
          if (!alive) return;
          var row = p.new && p.new.id ? p.new : null;
          if (row) { upsert(row); render(); }
        })
        .on("presence", { event: "sync" }, function () {
          var n = Object.keys(channel.presenceState() || {}).length;
          live.textContent = "● Trực tiếp · " + n + " người đang xem";
        })
        .subscribe(function (st) {
          if (!alive) return;
          if (st === "SUBSCRIBED") { live.textContent = "● Trực tiếp"; live.classList.remove("off"); channel.track({ at: Date.now() }); load(); }
          else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") { live.textContent = "Mất kết nối — đang thử lại…"; live.classList.add("off"); }
        });
    }
    function onNet() {
      if (!alive) return;
      if (!navigator.onLine) { live.textContent = "Mất kết nối mạng"; live.classList.add("off"); input.disabled = send.disabled = true; }
      else { live.classList.remove("off"); live.textContent = "Đang kết nối lại…"; checkMute(); load(); }
    }
    window.addEventListener("online", onNet); window.addEventListener("offline", onNet);

    input.addEventListener("input", function () { count.textContent = input.value.length + "/500"; });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!uid) { AFN.openLogin(); return; }
      if (!text) { setStatus(ERR.empty_message, true); return; }
      send.disabled = true; setStatus("");
      c.rpc("send_chat_message", { p_room: room, p_body: text }).then(function (r) {
        send.disabled = false;
        if (r.error) { setStatus(explain(r.error), true); if (/chat_muted/.test(r.error.message || "")) checkMute(); return; }
        input.value = ""; count.textContent = "0/500";
        upsert(r.data); render(); list.scrollTop = list.scrollHeight;
      }, function (err) { send.disabled = false; setStatus(explain(err), true); });
    });

    AFN.getUser().then(function (u) {
      if (!alive) return;
      if (!u) {
        live.textContent = ""; list.replaceChildren(el("li", "afn-chat-empty", "Đăng nhập miễn phí để đọc và tham gia trò chuyện cùng cộng đồng."));
        var lb = el("button", "afn-btn primary", "Đăng nhập để trò chuyện"); lb.type = "button";
        lb.addEventListener("click", function () { AFN.openLogin(); });
        form.replaceChildren(lb); emo.hidden = true; count.hidden = true;
        return;
      }
      uid = u.id;
      loadRoles(c, uid).then(function () { return checkMute(); }).then(function () { return load(); }).then(subscribe);
      resync = setInterval(function () { if (navigator.onLine) load(); }, 45000);   // gỡ tin bị ẩn mà Realtime không gửi (RLS)
    });

    return { destroy: function () {
      alive = false; clearInterval(resync);
      window.removeEventListener("online", onNet); window.removeEventListener("offline", onNet);
      if (channel) { try { c.removeChannel(channel); } catch (e) {} channel = null; }
    } };
  }

  /* ------------------------------------------------------------------ khung chat cộng đồng (ngăn kéo) */
  var drawer = null, drawerChat = null;
  function openDrawer() {
    if (!drawer) {
      drawer = el("aside", "afn-chat-drawer"); drawer.id = "chat-drawer";
      drawer.setAttribute("aria-label", "Trò chuyện cộng đồng");
      var close = el("button", "afn-chat-close", "×"); close.type = "button"; close.setAttribute("aria-label", "Đóng trò chuyện");
      close.addEventListener("click", closeDrawer);
      var inner = el("div", "afn-chat-wrap");
      drawer.append(close, inner);
      document.body.append(drawer);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && drawer && !drawer.hidden && !document.querySelector("dialog[open]")) closeDrawer(); });
    }
    drawer.hidden = false;
    document.body.classList.add("chat-open");
    if (!drawerChat) drawerChat = mount(drawer.querySelector(".afn-chat-wrap"), "network", { title: "Cộng đồng AI Film Network" });
    var f = drawer.querySelector("textarea, .afn-btn"); if (f) f.focus();
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.hidden = true; document.body.classList.remove("chat-open");
    if (drawerChat) { drawerChat.destroy(); drawerChat = null; }
    var o = document.querySelector("[data-chat-open]"); if (o) o.focus();
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-chat-open]");
    if (t) { e.preventDefault(); if (drawer && !drawer.hidden) closeDrawer(); else openDrawer(); }
  });
  // Nút nổi trên điện thoại (thanh bên ẩn mục "Của tôi").
  var fab = el("button", "afn-chat-fab", "💬"); fab.type = "button"; fab.setAttribute("data-chat-open", "");
  fab.setAttribute("aria-label", "Mở trò chuyện cộng đồng");
  if (document.getElementById("sidebar")) document.body.append(fab);

  /* ------------------------------------------------------------------ chat theo phim (trong cửa sổ phim) */
  var filmChat = null;
  window.addEventListener("afn-film-opened", function (e) {
    if (filmChat) { filmChat.destroy(); filmChat = null; }
    var box = document.getElementById("film-chat"), d = e.detail || {};
    if (!box || !d.site || !d.film || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(d.film)) return;
    box.hidden = false;
    filmChat = mount(box, "film:" + d.site + ":" + d.film, { title: "Bàn luận về phim" });
  });
  window.addEventListener("afn-film-closed", function () { if (filmChat) { filmChat.destroy(); filmChat = null; } });
  // Phim mở bằng đường dẫn trực tiếp trước khi module này nạp xong: gắn chat ngay.
  var openNow = window.AFN_APP && window.AFN_APP.current && window.AFN_APP.current();
  if (openNow && AFN.siteId) window.dispatchEvent(new CustomEvent("afn-film-opened", { detail: { site: AFN.siteId, film: openNow.id } }));

  window.AFN_CHAT = Object.freeze({ mount: mount, open: openDrawer, close: closeDrawer });
})();
