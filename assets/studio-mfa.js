/* AI Film Network — Level 4.6: xác thực 2 lớp (TOTP) cho nhân sự trong Studio.
   Máy chủ mới là nơi quyết định quyền (private.mfa_ok + policy RESTRICTIVE). File này chỉ giúp:
   • nhập mã 6 số khi tài khoản đã bật 2FA (nâng phiên lên AAL2) trước khi tải dữ liệu quản trị;
   • tự đăng ký / tắt 2FA bằng ứng dụng xác thực (Google Authenticator, Microsoft Authenticator, 1Password…);
   • chủ mạng xem tình trạng 2FA của nhân sự và bật/tắt "bắt buộc 2FA cho nhân sự".
   Không khóa tài khoản: thiếu 2FA chỉ làm mất quyền QUẢN TRỊ, vẫn đăng nhập và xem phim bình thường. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, text, cls) { var x = document.createElement(tag); if (text !== undefined) x.textContent = String(text); if (cls) x.className = cls; return x; }
  var ERR = {
    mfa_required: "Cần phiên đã xác thực 2 lớp và tài khoản của bạn phải đã bật 2FA.",
    forbidden: "Chỉ chủ mạng (đã xác thực 2 lớp) được thay đổi cài đặt này.",
    reason_required: "Cần ghi lý do (ít nhất 5 ký tự).",
    mfa_verification_failed: "Mã chưa đúng hoặc đã hết hạn. Hãy nhập mã mới đang hiển thị trong ứng dụng.",
    invalid: "Mã chưa đúng hoặc đã hết hạn. Hãy nhập mã mới đang hiển thị trong ứng dụng."
  };
  function explain(e) {
    var m = String((e && (e.code || e.message)) || "");
    var k = Object.keys(ERR).find(function (x) { return m.toLowerCase().indexOf(x) >= 0; });
    if (!k && /totp|code|challenge/i.test(m)) k = "invalid";
    return k ? ERR[k] : "Không thực hiện được. Vui lòng thử lại.";
  }
  async function aal(db) {
    try { var r = await db.auth.mfa.getAuthenticatorAssuranceLevel(); return r.data || null; } catch (e) { return null; }
  }
  async function verifiedFactor(db) {
    try { var r = await db.auth.mfa.listFactors(); return ((r.data && r.data.totp) || []).find(function (f) { return f.status === "verified"; }) || null; }
    catch (e) { return null; }
  }
  async function securityStatus(db) {
    try { var r = await db.rpc("my_security_status"); return r.error ? null : r.data; } catch (e) { return null; }
  }

  // Hộp thoại nhập mã 6 số. Trả về chuỗi mã, hoặc null nếu người dùng bỏ qua.
  function askCode(title, hint, errorText) {
    return new Promise(function (resolve) {
      var d = el("dialog", undefined, "mfa-dialog");
      d.setAttribute("aria-label", title);
      var f = el("form"); f.method = "dialog";
      var input = el("input"); input.id = "mfa-code"; input.inputMode = "numeric"; input.autocomplete = "one-time-code";
      input.maxLength = 6; input.pattern = "\\d{6}"; input.placeholder = "6 chữ số"; input.required = true;
      var label = el("label", "Mã xác thực"); label.htmlFor = "mfa-code";
      var err = el("p", errorText || "", "mfa-error"); err.setAttribute("role", "alert"); err.hidden = !errorText;
      var ok = el("button", "Xác nhận", "btn"); ok.type = "submit"; ok.id = "mfa-submit";
      var skip = el("button", "Để sau", "btn ghost"); skip.type = "button"; skip.id = "mfa-skip";
      var actions = el("div", undefined, "actions"); actions.append(ok, skip);
      f.append(el("h2", title), el("p", hint, "muted"), label, input, err, actions);
      d.append(f); document.body.append(d);
      function done(v) { d.close(); d.remove(); resolve(v); }
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = input.value.replace(/\s+/g, "");
        if (!/^\d{6}$/.test(v)) { err.textContent = "Mã gồm đúng 6 chữ số."; err.hidden = false; return; }
        done(v);
      });
      skip.addEventListener("click", function () { done(null); });
      d.addEventListener("cancel", function (e) { e.preventDefault(); done(null); });
      d.showModal(); input.focus();
    });
  }

  // Nâng phiên lên AAL2 bằng factor đã xác minh. true = thành công.
  async function stepUp(db) {
    var factor = await verifiedFactor(db);
    if (!factor) return false;
    var errorText = "";
    for (var i = 0; i < 5; i++) {
      var code = await askCode("Xác thực 2 lớp", "Mở ứng dụng xác thực trên điện thoại và nhập mã 6 số của AI Film Network để mở quyền quản trị.", errorText);
      if (code === null) return false;
      var r = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code });
      if (!r.error) return true;
      errorText = explain(r.error);
    }
    return false;
  }
  // Gọi TRƯỚC khi tải dữ liệu quản trị: nếu tài khoản đã bật 2FA mà phiên mới 1 lớp → hỏi mã.
  async function gate(db) {
    var a = await aal(db);
    if (a && a.nextLevel === "aal2" && a.currentLevel !== "aal2") return stepUp(db);
    return true;
  }

  function banner(st) {
    var host = $("#studio-mfa-banner");
    if (!host) return;
    host.replaceChildren(); host.hidden = true;
    if (!st || !st.is_staff) return;
    if (!st.mfa_ok) {
      host.hidden = false; host.className = "mfa-banner warn";
      host.append(el("strong", "Quyền quản trị đang tạm khóa. "),
        el("span", st.has_factor ? "Tài khoản đã bật xác thực 2 lớp — hãy nhập mã để tiếp tục." : "Chủ mạng đã bật bắt buộc xác thực 2 lớp — hãy bật 2FA ở thẻ Bảo mật."));
      var b = el("button", st.has_factor ? "Nhập mã xác thực" : "Mở thẻ Bảo mật", "btn"); b.type = "button"; b.id = "mfa-banner-action";
      b.dataset.mfaBanner = st.has_factor ? "stepup" : "open";
      host.append(b);
    } else if (!st.has_factor) {
      host.hidden = false; host.className = "mfa-banner info";
      host.append(el("span", "Khuyến nghị: bật xác thực 2 lớp cho tài khoản quản trị (thẻ Bảo mật)."));
    }
  }

  async function render(db) {
    var box = $("#studio-security");
    if (!box) return;
    var st = await securityStatus(db), a = await aal(db), factor = await verifiedFactor(db);
    banner(st);
    box.replaceChildren();
    if (!st) { box.append(el("p", "Chưa đọc được trạng thái bảo mật (máy chủ chưa có Level 4.6 hoặc mất kết nối).", "muted")); return; }
    var card = el("div", undefined, "panel-card");
    card.append(el("h2", "Xác thực 2 lớp của bạn"));
    var dl = el("dl", undefined, "mfa-facts");
    function fact(k, v, id) { var dt = el("dt", k), dd = el("dd", v); if (id) dd.id = id; dl.append(dt, dd); }
    fact("Trạng thái", st.has_factor ? "Đã bật" : "Chưa bật", "mfa-state");
    fact("Phiên hiện tại", (a && a.currentLevel === "aal2") || st.aal === "aal2" ? "Đã xác thực 2 lớp" : "Một lớp (mật khẩu)", "mfa-session");
    fact("Chính sách nhân sự", st.staff_mfa_required ? "Bắt buộc 2FA" : "Khuyến nghị (chưa bắt buộc)", "mfa-policy");
    card.append(dl);
    var actions = el("div", undefined, "actions");
    if (!factor) {
      var en = el("button", "Bật xác thực 2 lớp", "btn"); en.type = "button"; en.id = "mfa-enroll"; actions.append(en);
    } else if (!(a && a.currentLevel === "aal2")) {
      var su = el("button", "Nhập mã để mở quyền quản trị", "btn"); su.type = "button"; su.dataset.mfaBanner = "stepup"; actions.append(su);
    } else {
      var off = el("button", "Tắt xác thực 2 lớp", "btn ghost"); off.type = "button"; off.id = "mfa-unenroll"; off.dataset.factor = factor.id; actions.append(off);
    }
    card.append(actions, el("div", undefined, "mfa-enroll-box"));
    card.append(el("p", "Mất điện thoại/ứng dụng xác thực: liên hệ chủ hệ thống để gỡ factor trong Supabase (Authentication → Users → MFA) sau khi xác minh danh tính. Không chia sẻ mã cho bất kỳ ai.", "ops-note"));
    box.append(card);

    if (st.is_owner) {
      var oc = el("div", undefined, "panel-card");
      oc.append(el("h2", "Bắt buộc 2FA cho nhân sự (toàn mạng)"));
      var list = el("div", undefined, "ops-scroll"); list.id = "mfa-staff";
      oc.append(list);
      try {
        var r = await db.rpc("admin_staff_mfa_status");
        if (r.error) throw r.error;
        var t = el("table", undefined, "ops-table"), head = el("tr");
        ["Nhân sự", "Phạm vi", "Vai trò", "2FA"].forEach(function (h) { head.append(el("th", h)); });
        t.append(head);
        (r.data || []).forEach(function (x) {
          var tr = el("tr");
          [x.display_name || ("#" + String(x.user_id).slice(0, 8)), x.scope === "network" ? "Toàn mạng" : x.scope, x.role, x.has_factor ? "Đã bật" : "Chưa bật"]
            .forEach(function (v) { tr.append(el("td", v)); });
          t.append(tr);
        });
        list.append(t);
      } catch (e) { list.append(el("p", explain(e), "muted")); }
      var can = !!factor && a && a.currentLevel === "aal2";
      var tg = el("button", st.staff_mfa_required ? "Tắt bắt buộc 2FA" : "Bật bắt buộc 2FA cho nhân sự", st.staff_mfa_required ? "btn ghost" : "btn");
      tg.type = "button"; tg.id = "mfa-require-toggle"; tg.dataset.required = String(!st.staff_mfa_required); tg.disabled = !can;
      oc.append(el("div", undefined, "actions"));
      oc.lastChild.append(tg);
      oc.append(el("p", can ? "Khi bật: nhân sự chưa có 2FA vẫn đăng nhập được nhưng tạm mất quyền quản trị cho tới khi tự bật 2FA. Mọi thay đổi được ghi nhật ký."
                            : "Để đổi cài đặt này, bạn cần bật 2FA cho chính mình và đang ở phiên đã xác thực 2 lớp (không thể tự khóa mình).", "ops-note"));
      box.append(oc);
    }
  }

  async function enroll(db, btn) {
    var holder = $(".mfa-enroll-box");
    btn.disabled = true;
    try {
      // Dọn factor chưa hoàn tất từ lần trước (Supabase giới hạn số factor chưa xác minh).
      var lf = await db.auth.mfa.listFactors();
      var stale = ((lf.data && lf.data.all) || []).filter(function (f) { return f.status !== "verified"; });
      for (var i = 0; i < stale.length; i++) await db.auth.mfa.unenroll({ factorId: stale[i].id });
      var r = await db.auth.mfa.enroll({ factorType: "totp", friendlyName: "AFN Studio " + new Date().toISOString().slice(0, 10) });
      if (r.error) throw r.error;
      var id = r.data.id, totp = r.data.totp || {};
      holder.replaceChildren();
      holder.append(el("p", "1. Quét mã QR bằng ứng dụng xác thực (hoặc nhập khóa thủ công). 2. Nhập mã 6 số đang hiển thị.", "muted"));
      var img = el("img"); img.src = totp.qr_code; img.alt = "Mã QR đăng ký xác thực 2 lớp"; img.width = 180; img.height = 180; img.id = "mfa-qr";
      var key = el("code", totp.secret || "", "ops-code"); key.id = "mfa-secret";
      holder.append(img, el("p", "Khóa nhập thủ công (chỉ hiển thị một lần, không gửi cho ai):", "ops-note"), key);
      var errorText = "";
      for (var k = 0; k < 5; k++) {
        var code = await askCode("Xác nhận ứng dụng xác thực", "Nhập mã 6 số mà ứng dụng vừa tạo cho AI Film Network.", errorText);
        if (code === null) { await db.auth.mfa.unenroll({ factorId: id }); holder.replaceChildren(el("p", "Đã hủy. Chưa bật xác thực 2 lớp.", "muted")); return; }
        var v = await db.auth.mfa.challengeAndVerify({ factorId: id, code: code });
        if (!v.error) { holder.replaceChildren(); await render(db); say("Đã bật xác thực 2 lớp. Từ lần đăng nhập sau, Studio sẽ hỏi mã 6 số."); return; }
        errorText = explain(v.error);
      }
      await db.auth.mfa.unenroll({ factorId: id });
      holder.replaceChildren(el("p", "Nhập sai quá nhiều lần. Hãy thử bật lại.", "muted"));
    } catch (e) { say(explain(e), true); }
    finally { btn.disabled = false; }
  }
  function say(text, bad) { var s = $("#studio-status"); if (s) { s.textContent = text; s.style.color = bad ? "#f8b2b5" : "var(--cyan)"; } }

  function wire(db) {
    document.addEventListener("click", async function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.id === "mfa-enroll") return enroll(db, b);
      if (b.dataset.mfaBanner === "open") { var tab = $('[data-studio-tab="security"]'); if (tab) tab.click(); return; }
      if (b.dataset.mfaBanner === "stepup") { if (await stepUp(db)) location.reload(); return; }
      if (b.id === "mfa-unenroll") {
        var st = await securityStatus(db);
        var warn = st && st.staff_mfa_required ? "\nĐang BẮT BUỘC 2FA cho nhân sự: tắt xong bạn sẽ mất quyền quản trị cho tới khi bật lại." : "";
        if (!confirm("Tắt xác thực 2 lớp cho tài khoản này?" + warn)) return;
        b.disabled = true;
        var r = await db.auth.mfa.unenroll({ factorId: b.dataset.factor });
        if (r.error) { say(explain(r.error), true); b.disabled = false; return; }
        try { await db.auth.refreshSession(); } catch (_) {}
        await render(db); say("Đã tắt xác thực 2 lớp.");
        return;
      }
      if (b.id === "mfa-require-toggle") {
        var on = b.dataset.required === "true";
        var reason = (prompt(on ? "Lý do bật bắt buộc 2FA cho toàn bộ nhân sự:" : "Lý do tắt bắt buộc 2FA:") || "").trim();
        if (reason.length < 5) { say(ERR.reason_required, true); return; }
        b.disabled = true;
        var rr = await db.rpc("admin_set_staff_mfa_required", { p_required: on, p_reason: reason });
        if (rr.error) { say(explain(rr.error), true); b.disabled = false; return; }
        await render(db);
        say(on ? "Đã bật bắt buộc 2FA. Nhân sự chưa có 2FA: " + rr.data.staff_without_factor + "." : "Đã tắt bắt buộc 2FA.");
      }
    });
  }
  var wired = false;
  window.AFN_MFA = {
    gate: gate, stepUp: stepUp, explain: explain,
    render: function (db) { if (!wired) { wired = true; wire(db); } return render(db); }
  };
})();
