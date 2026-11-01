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
  async function allFactors(db) {
    try { var r = await db.auth.mfa.listFactors(); return (r.data && r.data.all) || []; } catch (e) { return []; }
  }
  async function verifiedFactors(db) {
    return (await allFactors(db)).filter(function (f) { return f.status === "verified" && (f.factor_type || "totp") === "totp"; });
  }
  async function verifiedFactor(db) { return (await verifiedFactors(db))[0] || null; }
  function factorName(f) { return (f && f.friendly_name) || ("Thiết bị #" + String(f && f.id).slice(0, 6)); }
  async function securityStatus(db) {
    try { var r = await db.rpc("my_security_status"); return r.error ? null : r.data; } catch (e) { return null; }
  }

  // Hộp thoại nhập mã 6 số. Trả về chuỗi mã, hoặc null nếu người dùng bỏ qua.
  // factors (tùy chọn): danh sách thiết bị để người dùng chọn thiết bị đang cầm → trả {code, factorId}.
  function askCode(title, hint, errorText, factors, selectedId) {
    return new Promise(function (resolve) {
      var d = el("dialog", undefined, "mfa-dialog");
      d.setAttribute("aria-label", title);
      var f = el("form"); f.method = "dialog";
      var input = el("input"); input.id = "mfa-code"; input.inputMode = "numeric"; input.autocomplete = "one-time-code";
      input.maxLength = 7; input.pattern = "[0-9 ]{6,7}"; input.placeholder = "6 chữ số"; input.required = true;
      var label = el("label", "Mã xác thực"); label.htmlFor = "mfa-code";
      var err = el("p", errorText || "", "mfa-error"); err.setAttribute("role", "alert"); err.hidden = !errorText;
      var ok = el("button", "Xác nhận", "btn"); ok.type = "submit"; ok.id = "mfa-submit";
      var skip = el("button", "Để sau", "btn ghost"); skip.type = "button"; skip.id = "mfa-skip";
      var actions = el("div", undefined, "actions"); actions.append(ok, skip);
      f.append(el("h2", title), el("p", hint, "muted"));
      var pick = null;
      if (factors && factors.length > 1) {
        var pl = el("label", "Thiết bị xác thực"); pl.htmlFor = "mfa-factor";
        pick = el("select"); pick.id = "mfa-factor";
        factors.forEach(function (x) { var o = el("option", factorName(x)); o.value = x.id; if (x.id === selectedId) o.selected = true; pick.append(o); });
        f.append(pl, pick);
      }
      f.append(label, input, err, actions);
      d.append(f); document.body.append(d);
      function done(v) { d.close(); d.remove(); resolve(v); }
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = input.value.replace(/\s+/g, "");
        if (!/^\d{6}$/.test(v)) { err.textContent = "Mã gồm đúng 6 chữ số."; err.hidden = false; return; }
        done(factors ? { code: v, factorId: pick ? pick.value : factors[0].id } : v);
      });
      skip.addEventListener("click", function () { done(null); });
      d.addEventListener("cancel", function (e) { e.preventDefault(); done(null); });
      d.showModal(); input.focus();
    });
  }

  // Nâng phiên lên AAL2 bằng factor đã xác minh. true = thành công.
  async function stepUp(db) {
    var factors = await verifiedFactors(db);
    if (!factors.length) return false;
    var errorText = "", sel = factors[0].id;
    for (var i = 0; i < 5; i++) {
      var ans = await askCode("Xác thực 2 lớp", "Mở ứng dụng xác thực trên điện thoại (hoặc thiết bị dự phòng) và nhập mã 6 số của AI Film Network để mở quyền quản trị.", errorText, factors, sel);
      if (ans === null) return false;
      sel = ans.factorId;
      var r = await db.auth.mfa.challengeAndVerify({ factorId: ans.factorId, code: ans.code });
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
    var st = await securityStatus(db), a = await aal(db), factors = await verifiedFactors(db), factor = factors[0] || null;
    var isAal2 = !!(a && a.currentLevel === "aal2");
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
    fact("Thiết bị xác thực", String(factors.length), "mfa-count");
    card.append(dl);
    if (factors.length) {
      var dt = el("table", undefined, "ops-table"); dt.id = "mfa-devices";
      var hr = el("tr"); ["Thiết bị", "Thêm ngày", ""].forEach(function (h) { hr.append(el("th", h)); }); dt.append(hr);
      factors.forEach(function (x) {
        var tr = el("tr"); tr.dataset.factor = x.id;
        tr.append(el("td", factorName(x)), el("td", x.created_at ? new Date(x.created_at).toLocaleDateString("vi-VN") : "—"));
        var td = el("td");
        if (isAal2 && factors.length > 1) {
          var rv = el("button", "Thu hồi", "btn ghost"); rv.type = "button"; rv.className = "btn ghost mfa-revoke"; rv.dataset.factor = x.id; td.append(rv);
        }
        tr.append(td); dt.append(tr);
      });
      card.append(dt);
    }
    var actions = el("div", undefined, "actions");
    if (!factor) {
      var en = el("button", "Bật xác thực 2 lớp", "btn"); en.type = "button"; en.id = "mfa-enroll"; actions.append(en);
    } else if (!isAal2) {
      var su = el("button", "Nhập mã để mở quyền quản trị", "btn"); su.type = "button"; su.dataset.mfaBanner = "stepup"; actions.append(su);
    } else {
      if (factors.length < 10) { var bk = el("button", "Thêm thiết bị dự phòng", "btn"); bk.type = "button"; bk.id = "mfa-add-backup"; actions.append(bk); }
      if (factors.length === 1) { var off = el("button", "Tắt xác thực 2 lớp", "btn ghost"); off.type = "button"; off.id = "mfa-unenroll"; off.dataset.factor = factor.id; actions.append(off); }
    }
    card.append(actions, el("div", undefined, "mfa-enroll-box"));
    if (factor && factors.length === 1) card.append(el("p", "Khuyến nghị: thêm một thiết bị dự phòng (điện thoại/máy tính bảng thứ hai hoặc trình quản lý mật khẩu). Supabase không cấp mã khôi phục — thiết bị dự phòng là cách tự khôi phục khi mất máy.", "mfa-banner info"));
    card.append(el("p", isAal2 || !factor ? "Thêm/thu hồi thiết bị chỉ thực hiện được ở phiên đã xác thực 2 lớp. Thu hồi luôn cần mã từ một thiết bị khác còn giữ lại, nên không thể tự khóa mình. Mất mọi thiết bị: chủ hệ thống gỡ factor bằng db/staging/94_mfa_break_glass.sql (khối B) sau khi xác minh danh tính. Không chia sẻ mã cho bất kỳ ai."
      : "Nhập mã để quản lý thiết bị xác thực.", "ops-note"));
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

  // backup = true: thêm thiết bị dự phòng (phiên phải AAL2; factor đang hoạt động KHÔNG bị đổi/xóa).
  async function enroll(db, btn, backup) {
    var holder = $(".mfa-enroll-box");
    btn.disabled = true;
    try {
      var before = await allFactors(db), verified = before.filter(function (f) { return f.status === "verified"; });
      var name = "AFN Studio " + new Date().toISOString().slice(0, 10);
      if (backup) {
        var lvl = await aal(db);
        if (!verified.length || !lvl || lvl.currentLevel !== "aal2") { say("Cần phiên đã xác thực 2 lớp để thêm thiết bị dự phòng.", true); return; }
        var want = (prompt("Đặt tên cho thiết bị dự phòng (ví dụ: iPad, điện thoại cũ, 1Password):", "Thiết bị dự phòng") || "").trim().slice(0, 40);
        if (!want) return;
        if (!confirm("Thêm thiết bị dự phòng \"" + want + "\"?\nThiết bị hiện tại vẫn giữ nguyên. Sau khi xác nhận mã, Supabase sẽ đăng xuất các phiên khác của tài khoản (phiên này giữ nguyên).")) return;
        name = want;
      }
      var taken = before.map(function (f) { return f.friendly_name; });
      for (var n = 2; taken.indexOf(name) >= 0; n++) name = name.replace(/ \(\d+\)$/, "") + " (" + n + ")";   // tên phải khác nhau
      // Dọn factor CHƯA XÁC MINH từ lần trước (không bao giờ đụng factor đã xác minh).
      var stale = before.filter(function (f) { return f.status !== "verified"; });
      for (var i = 0; i < stale.length; i++) await db.auth.mfa.unenroll({ factorId: stale[i].id });
      var r = await db.auth.mfa.enroll({ factorType: "totp", friendlyName: name });
      if (r.error) throw r.error;
      var id = r.data.id, totp = r.data.totp || {};
      holder.replaceChildren();
      holder.append(el("p", backup ? "1. Trên THIẾT BỊ DỰ PHÒNG, quét mã QR bằng ứng dụng xác thực (hoặc nhập khóa thủ công). 2. Nhập mã 6 số mà thiết bị dự phòng hiển thị."
                                   : "1. Quét mã QR bằng ứng dụng xác thực (hoặc nhập khóa thủ công). 2. Nhập mã 6 số đang hiển thị.", "muted"));
      var img = el("img"); img.src = totp.qr_code; img.alt = "Mã QR đăng ký xác thực 2 lớp"; img.width = 180; img.height = 180; img.id = "mfa-qr";
      var key = el("code", totp.secret || "", "ops-code"); key.id = "mfa-secret";
      holder.append(img, el("p", "Khóa nhập thủ công (chỉ hiển thị một lần, không gửi cho ai):", "ops-note"), key);
      var errorText = "";
      for (var k = 0; k < 5; k++) {
        var code = await askCode(backup ? "Xác nhận thiết bị dự phòng" : "Xác nhận ứng dụng xác thực",
          backup ? "Nhập mã 6 số mà THIẾT BỊ DỰ PHÒNG vừa tạo (không phải thiết bị cũ)." : "Nhập mã 6 số mà ứng dụng vừa tạo cho AI Film Network.", errorText);
        if (code === null) { await db.auth.mfa.unenroll({ factorId: id }); holder.replaceChildren(el("p", backup ? "Đã hủy. Không thêm thiết bị; thiết bị hiện tại giữ nguyên." : "Đã hủy. Chưa bật xác thực 2 lớp.", "muted")); return; }
        var v = await db.auth.mfa.challengeAndVerify({ factorId: id, code: code });
        if (!v.error) {
          holder.replaceChildren();
          // Chỉ báo thành công khi Supabase xác nhận factor mới ở trạng thái verified (và factor cũ vẫn còn).
          var now = await verifiedFactors(db), ids = now.map(function (f) { return f.id; });
          var okNew = ids.indexOf(id) >= 0, okOld = verified.every(function (f) { return ids.indexOf(f.id) >= 0; });
          await render(db);
          if (!okNew || !okOld) { say("Chưa xác nhận được thiết bị mới trên máy chủ. Hãy tải lại trang và kiểm tra danh sách thiết bị.", true); return; }
          say(backup ? "Đã thêm thiết bị dự phòng \"" + name + "\" (đã xác minh). Hiện có " + now.length + " thiết bị xác thực." : "Đã bật xác thực 2 lớp. Từ lần đăng nhập sau, Studio sẽ hỏi mã 6 số.");
          return;
        }
        errorText = explain(v.error);
      }
      await db.auth.mfa.unenroll({ factorId: id });
      holder.replaceChildren(el("p", backup ? "Nhập sai quá nhiều lần. Không thêm thiết bị; thiết bị hiện tại giữ nguyên." : "Nhập sai quá nhiều lần. Hãy thử bật lại.", "muted"));
    } catch (e) { say(explain(e), true); }
    finally { btn.disabled = false; }
  }
  // Xác minh lại bằng mã mới từ một trong các thiết bị cho phép (chứng minh người thao tác đang cầm thiết bị đó).
  async function reverify(db, allowed, title, hint) {
    if (!allowed.length) return false;
    var errorText = "", sel = allowed[0].id;
    for (var i = 0; i < 5; i++) {
      var ans = await askCode(title, hint, errorText, allowed, sel);
      if (ans === null) return false;
      sel = ans.factorId;
      var r = await db.auth.mfa.challengeAndVerify({ factorId: ans.factorId, code: ans.code });
      if (!r.error) return true;
      errorText = explain(r.error);
    }
    return false;
  }
  // Thu hồi một thiết bị: chỉ khi phiên AAL2, còn ≥ 2 thiết bị, và người dùng nhập mã từ THIẾT BỊ KHÁC (thiết bị sẽ giữ lại).
  async function revoke(db, btn) {
    var id = btn.dataset.factor, lvl = await aal(db), factors = await verifiedFactors(db);
    var target = factors.find(function (f) { return f.id === id; }), keep = factors.filter(function (f) { return f.id !== id; });
    if (!target) { say("Thiết bị này không còn trong danh sách.", true); await render(db); return; }
    if (!lvl || lvl.currentLevel !== "aal2") { say("Cần phiên đã xác thực 2 lớp để thu hồi thiết bị.", true); return; }
    if (!keep.length) { say("Không thể thu hồi thiết bị cuối cùng ở đây (dùng \"Tắt xác thực 2 lớp\").", true); return; }
    if (!confirm("Thu hồi thiết bị \"" + factorName(target) + "\"?\nMã từ thiết bị này sẽ không còn dùng được. Bước tiếp theo: nhập mã từ một thiết bị KHÁC mà bạn giữ lại.")) return;
    if (!(await reverify(db, keep, "Xác nhận bằng thiết bị giữ lại", "Nhập mã 6 số từ thiết bị bạn GIỮ LẠI (không phải thiết bị đang thu hồi)."))) { say("Đã hủy thu hồi. Không thay đổi thiết bị nào."); return; }
    btn.disabled = true;
    var r = await db.auth.mfa.unenroll({ factorId: id });
    if (r.error) { say(explain(r.error), true); btn.disabled = false; return; }
    var after = (await verifiedFactors(db)).map(function (f) { return f.id; });
    await render(db);
    if (after.indexOf(id) >= 0 || !keep.every(function (f) { return after.indexOf(f.id) >= 0; })) { say("Chưa xác nhận được việc thu hồi trên máy chủ. Hãy tải lại trang.", true); return; }
    say("Đã thu hồi \"" + factorName(target) + "\". Còn " + after.length + " thiết bị xác thực.");
  }
  function say(text, bad) { var s = $("#studio-status"); if (s) { s.textContent = text; s.style.color = bad ? "#f8b2b5" : "var(--cyan)"; } }

  function wire(db) {
    document.addEventListener("click", async function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.id === "mfa-enroll") return enroll(db, b, false);
      if (b.id === "mfa-add-backup") return enroll(db, b, true);
      if (b.classList.contains("mfa-revoke")) return revoke(db, b);
      if (b.dataset.mfaBanner === "open") { var tab = $('[data-studio-tab="security"]'); if (tab) tab.click(); return; }
      if (b.dataset.mfaBanner === "stepup") { if (await stepUp(db)) location.reload(); return; }
      if (b.id === "mfa-unenroll") {
        var st = await securityStatus(db);
        var warn = st && st.staff_mfa_required ? "\nĐang BẮT BUỘC 2FA cho nhân sự: tắt xong bạn sẽ mất quyền quản trị cho tới khi bật lại." : "";
        if (!confirm("Tắt xác thực 2 lớp cho tài khoản này?" + warn)) return;
        if (!(await reverify(db, (await verifiedFactors(db)), "Xác nhận tắt 2FA", "Nhập mã 6 số hiện tại để xác nhận tắt xác thực 2 lớp."))) return;
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
