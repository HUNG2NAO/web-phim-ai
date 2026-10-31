/* Member Hub → tab "Điểm thưởng": số dư, điểm danh 7 ngày, lịch sử giao dịch,
   nội dung đã mở khóa, lịch sử điểm danh. Chỉ đọc dữ liệu của chính người dùng (RLS). */
(function () {
  "use strict";
  var AFN = window.AFN;
  var root = document.getElementById("rewards-root");
  if (!AFN || !root) return;
  var el = AFN.el;
  var KIND = { checkin: "Điểm danh", unlock: "Mở khóa tập", refund: "Hoàn điểm", admin_credit: "Quản trị cộng điểm", admin_debit: "Quản trị trừ điểm" };
  var S = { user: null, rules: null, wallet: null, ledger: [], checkins: [], ents: [], busy: false };

  function today() { return AFN.vnDayKey(new Date()); }
  function yesterday() { return AFN.vnDayKey(new Date(Date.now() - 864e5)); }
  function last() { return S.checkins[0] || null; }
  function doneToday() { return !!(last() && last().checkin_date === today()); }
  function nextStreak() {
    var l = last();
    if (!l) return 1;
    if (l.checkin_date === today()) return l.streak;
    if (l.checkin_date === yesterday()) return l.streak + 1;
    return 1;
  }
  function pts(streak) {
    var r = S.rules; if (!r) return null;
    return r.checkin_base + Math.min(streak - 1, r.streak_step_cap) * r.streak_step + (streak % 7 === 0 ? r.day7_bonus : 0);
  }

  async function load() {
    var c = AFN.client();
    if (!c) { root.replaceChildren(el("p", "muted", "Tính năng điểm thưởng chưa được cấu hình trên bản này.")); return; }
    S.user = await AFN.getUser(true);
    if (!S.user) return;
    try {
      var res = await Promise.all([
        c.from("reward_rules").select("*").eq("id", 1).maybeSingle(),
        c.from("wallets").select("balance,earned_total,spent_total").eq("user_id", S.user.id).maybeSingle(),
        c.from("wallet_ledger").select("id,kind,delta,balance_after,note,site_id,created_at").eq("user_id", S.user.id).order("created_at", { ascending: false }).limit(50),
        c.from("daily_checkins").select("checkin_date,streak,points,site_id").eq("user_id", S.user.id).order("checkin_date", { ascending: false }).limit(30),
        c.from("content_entitlements").select("id,site_id,film_id,episode_no,points_paid,status,granted_at,expires_at").eq("user_id", S.user.id).order("granted_at", { ascending: false }).limit(50)
      ]);
      var failed = res.find(function (r) { return r && r.error; });
      if (failed) throw failed.error;
      S.rules = res[0].data; S.wallet = res[1].data || { balance: 0, earned_total: 0, spent_total: 0 };
      S.ledger = res[2].data || []; S.checkins = res[3].data || []; S.ents = res[4].data || [];
      render();
    } catch (e) {
      root.replaceChildren(el("p", "muted", "Chưa tải được ví điểm. Có thể hệ thống điểm thưởng chưa được kích hoạt trên máy chủ."));
    }
  }

  function card(label, value) { var d = el("div", "rw-card"); d.append(el("span", "", label), el("strong", "", AFN.formatPoints(value))); return d; }
  function section(title, nodes, emptyText) {
    var s = el("section", "");
    s.append(el("div", "section-top"));
    s.firstChild.append(el("h3", "", title));
    var list = el("div", "rw-list");
    if (!nodes.length) list.append(el("p", "muted", emptyText)); else nodes.forEach(function (n) { list.append(n); });
    s.append(list);
    return s;
  }
  function render() {
    var cards = el("div", "rw-cards");
    cards.append(card("Số dư hiện tại", S.wallet.balance), card("Đã nhận", S.wallet.earned_total), card("Đã sử dụng", S.wallet.spent_total));

    var box = el("div", "rw-checkin");
    var head = el("div", "section-top");
    var streak = nextStreak(), cycle = ((streak - 1) % 7) + 1, done = doneToday();
    head.append(el("h3", "", "Điểm danh hằng ngày"), el("span", "muted", done ? "Chuỗi hiện tại: " + streak + " ngày" : (streak > 1 ? "Giữ chuỗi: hôm nay là ngày " + streak : "Bắt đầu chuỗi mới")));
    box.append(head);
    var strip = el("ol", "afn-streak");
    strip.setAttribute("aria-label", "Chuỗi điểm danh 7 ngày");
    for (var i = 1; i <= 7; i++) {
      var li = el("li", (done ? i <= cycle : i < cycle) ? "done" : (!done && i === cycle ? "today" : ""));
      if (i === 7) li.classList.add("bonus");
      var p = pts(streak - cycle + i);
      li.append(el("span", "d", "Ngày " + i), el("span", "p", p === null ? "–" : "+" + p));
      strip.append(li);
    }
    box.append(strip);
    var btn = el("button", "btn primary"); btn.type = "button";
    if (S.rules && S.rules.checkin_enabled === false) { btn.textContent = "Điểm danh đang tạm dừng"; btn.disabled = true; }
    else if (done) { btn.textContent = "Đã điểm danh hôm nay ✓ (+" + AFN.formatPoints(last().points) + ")"; btn.disabled = true; }
    else { btn.textContent = S.busy ? "Đang điểm danh…" : "Điểm danh nhận +" + AFN.formatPoints(pts(streak)) + " điểm"; btn.disabled = S.busy; btn.addEventListener("click", claim); }
    box.append(btn);
    if (S.rules) {
      box.append(el("p", "rw-rules", "Mỗi ngày: +" + S.rules.checkin_base + " điểm, cộng thêm " + S.rules.streak_step +
        " điểm cho mỗi ngày liên tiếp (tối đa " + S.rules.streak_step_cap + " lần), ngày thứ 7 thưởng thêm " + S.rules.day7_bonus +
        " điểm. Mỗi tài khoản điểm danh 1 lần/ngày trên toàn mạng lưới, tính theo giờ Việt Nam."));
    }

    var ledger = S.ledger.map(function (x) {
      var r = el("div", "rw-row"), left = el("div", "");
      left.append(el("strong", "", KIND[x.kind] || x.kind), el("small", "", (x.note ? x.note + " · " : "") + AFN.vnDateTime(x.created_at)));
      r.append(left, el("span", x.delta > 0 ? "plus" : "minus", (x.delta > 0 ? "+" : "−") + AFN.formatPoints(Math.abs(x.delta))));
      return r;
    });
    var ents = S.ents.map(function (x) {
      var r = el("div", "rw-row"), left = el("div", "");
      var brand = (AFN.sites || []).find(function (s) { return s.id === x.site_id; });
      var stateText = x.status === "active" ? (x.expires_at ? "Xem được đến " + AFN.vnDateTime(x.expires_at) : "Xem không giới hạn")
        : x.status === "refunded" ? "Đã hoàn điểm" : x.status === "expired" ? "Đã hết hạn" : "Đã thu hồi";
      left.append(el("strong", "", x.film_id + " · Tập " + x.episode_no), el("small", "", (brand ? brand.name + " · " : "") + stateText));
      var link = el("a", "text-btn", "Xem"); link.href = AFN.filmUrl(x.film_id, x.episode_no);
      r.append(left, x.status === "active" && x.site_id === AFN.siteId ? link : el("span", "muted", "−" + AFN.formatPoints(x.points_paid)));
      return r;
    });
    var hist = S.checkins.map(function (x) {
      var r = el("div", "rw-row"), left = el("div", "");
      left.append(el("strong", "", AFN.vnDate(x.checkin_date + "T12:00:00+07:00")), el("small", "", "Chuỗi " + x.streak + " ngày"));
      r.append(left, el("span", "plus", "+" + AFN.formatPoints(x.points)));
      return r;
    });
    root.replaceChildren(cards, box,
      section("Lịch sử giao dịch điểm", ledger, "Chưa có giao dịch. Điểm danh hôm nay để nhận điểm đầu tiên."),
      section("Nội dung đã mở khóa", ents, "Bạn chưa mở khóa tập nào. Tập mở sớm có nhãn “Sớm” trong danh sách tập."),
      section("Lịch sử điểm danh (30 ngày gần nhất)", hist, "Chưa có lần điểm danh nào."));
  }

  async function claim() {
    var c = AFN.client(); if (!c || S.busy) return;
    S.busy = true; render();
    try {
      var r = await c.rpc("claim_daily_checkin", { p_site: AFN.siteId });
      if (r.error) throw r.error;
      var d = r.data || {};
      if (d.status === "claimed") AFN.toast("Điểm danh thành công: +" + AFN.formatPoints(d.points) + " điểm" + (d.day7 ? " · thưởng ngày thứ 7!" : ""));
      else if (d.status === "already") AFN.toast("Hôm nay bạn đã điểm danh rồi.");
      else if (d.status === "disabled") AFN.toast("Điểm danh đang tạm dừng.", true);
    } catch (e) { AFN.toast("Chưa điểm danh được. Vui lòng thử lại.", true); }
    S.busy = false;
    await load();
  }

  // Community tab: social links for this brand (placement "member").
  if (window.AFN_SOCIAL) window.AFN_SOCIAL.render(document.getElementById("member-social"), "member", { title: "Tham gia cộng đồng " + (AFN.brand ? AFN.brand.name : "") });
  // Load once the hub has confirmed a signed-in member (level3.js shows #hub-app).
  var app = document.getElementById("hub-app");
  function ready() { return app && !app.hidden; }
  if (ready()) load();
  else if (app) {
    var mo = new MutationObserver(function () { if (ready()) { mo.disconnect(); load(); } });
    mo.observe(app, { attributes: true, attributeFilter: ["hidden"] });
  }
})();
