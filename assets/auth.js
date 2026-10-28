/* AI Film Network Auth v1 — shared identity, per-origin login sessions.
   This file never grants admin privileges and never contains secret keys. */
(function () {
  "use strict";
  var cfg = window.AFN_AUTH_CONFIG || {};
  var ready = cfg.enabled === true
    && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url || "")
    && typeof cfg.publishableKey === "string"
    && cfg.publishableKey.length > 15
    && !/service_role|sb_secret_/i.test(cfg.publishableKey)
    && window.supabase && typeof window.supabase.createClient === "function";
  var client = ready ? window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: cfg.storageKey || "afn-film-auth-v1"
    }
  }) : null;
  var slot = document.createElement("div");
  slot.className = "afn-account-slot";
  var trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "afn-account-btn";
  trigger.textContent = "Đăng nhập";
  trigger.setAttribute("aria-haspopup", "dialog");
  slot.appendChild(trigger);
  var header = document.querySelector(".site-header .wrap");
  if (!header) return;
  header.appendChild(slot);

  var dialog = document.createElement("dialog");
  dialog.className = "afn-auth-dialog";
  dialog.setAttribute("aria-label", "Tài khoản thành viên");
  dialog.innerHTML = [
    '<div class="afn-auth-panel">',
      '<div class="afn-auth-header"><h2 id="afn-auth-title">Tài khoản thành viên</h2>',
      '<button class="afn-auth-close" type="button" aria-label="Đóng">×</button></div>',
      '<p class="afn-auth-hint">Một tài khoản chung cho 5 website. Mỗi website có phiên đăng nhập độc lập.</p>',
      '<div class="afn-auth-tabs" role="tablist" aria-label="Đăng nhập hoặc đăng ký">',
      '<button class="afn-auth-tab" type="button" role="tab" data-mode="login" aria-selected="true">Đăng nhập</button>',
      '<button class="afn-auth-tab" type="button" role="tab" data-mode="signup" aria-selected="false">Đăng ký</button></div>',
      '<form class="afn-auth-form" id="afn-auth-form" novalidate>',
        '<div class="afn-field afn-name-wrap afn-auth-hidden"><label for="afn-name">Tên hiển thị</label>',
        '<input id="afn-name" name="displayName" maxlength="60" autocomplete="nickname"></div>',
        '<div class="afn-field afn-email-wrap"><label for="afn-email">Email</label>',
        '<input id="afn-email" type="email" name="email" autocomplete="email" required></div>',
        '<div class="afn-field afn-password-wrap"><label for="afn-password">Mật khẩu</label>',
        '<input id="afn-password" type="password" name="password" minlength="8" autocomplete="current-password" required></div>',
        '<button class="afn-auth-primary" id="afn-submit" type="submit">Đăng nhập</button>',
      '</form>',
      '<button type="button" class="afn-auth-google" id="afn-google">Tiếp tục với Google</button>',
      '<button type="button" class="afn-auth-link" id="afn-forgot">Quên mật khẩu?</button>',
      '<div class="afn-auth-profile afn-auth-hidden" id="afn-profile">',
        '<div><div class="afn-auth-hint">Đang đăng nhập</div>',
        '<div class="afn-auth-profile-name" id="afn-profile-name"></div></div>',
        '<button type="button" class="afn-auth-primary" id="afn-edit">Đổi tên hiển thị</button>',
        '<button type="button" class="afn-auth-google" id="afn-signout">Đăng xuất website này</button>',
      '</div>',
      '<p class="afn-auth-message afn-auth-hidden" id="afn-auth-message" role="status" aria-live="polite"></p>',
      '<p class="afn-auth-hint">Bạn có thể xem phim miễn phí mà không cần đăng nhập.</p>',
    '</div>'
  ].join("");
  document.body.appendChild(dialog);

  var form = dialog.querySelector("#afn-auth-form");
  var tabs = dialog.querySelector(".afn-auth-tabs");
  var google = dialog.querySelector("#afn-google");
  var forgot = dialog.querySelector("#afn-forgot");
  var submit = dialog.querySelector("#afn-submit");
  var emailEl = dialog.querySelector("#afn-email");
  var passEl = dialog.querySelector("#afn-password");
  var nameEl = dialog.querySelector("#afn-name");
  var nameWrap = dialog.querySelector(".afn-name-wrap");
  var emailWrap = dialog.querySelector(".afn-email-wrap");
  var passwordWrap = dialog.querySelector(".afn-password-wrap");
  var profile = dialog.querySelector("#afn-profile");
  var profileName = dialog.querySelector("#afn-profile-name");
  var msg = dialog.querySelector("#afn-auth-message");
  var mode = "login";
  var busy = false;
  var currentUser = null;

  function message(text, isError) {
    msg.textContent = text || "";
    msg.dataset.kind = isError ? "error" : "info";
    msg.classList.toggle("afn-auth-hidden", !text);
  }
  function setBusy(v) {
    busy = v;
    Array.prototype.forEach.call(dialog.querySelectorAll("button, input"), function (el) { el.disabled = v; });
  }
  function resetPasswords() { passEl.value = ""; }
  function setMode(next) {
    mode = next;
    message("", false);
    resetPasswords();
    tabs.classList.toggle("afn-auth-hidden", !["login", "signup"].includes(mode));
    Array.prototype.forEach.call(tabs.querySelectorAll("[data-mode]"), function (b) {
      b.setAttribute("aria-selected", String(b.dataset.mode === mode));
    });
    nameWrap.classList.toggle("afn-auth-hidden", mode !== "signup" && mode !== "edit");
    emailWrap.classList.toggle("afn-auth-hidden", mode === "update" || mode === "edit");
    passwordWrap.classList.toggle("afn-auth-hidden", mode === "recover" || mode === "edit");
    passEl.autocomplete = mode === "login" ? "current-password" : "new-password";
    passEl.required = mode !== "recover" && mode !== "edit";
    emailEl.required = mode !== "update" && mode !== "edit";
    google.classList.toggle("afn-auth-hidden", cfg.googleEnabled !== true || !["login", "signup"].includes(mode));
    forgot.classList.toggle("afn-auth-hidden", mode !== "login");
    submit.textContent = ({login:"Đăng nhập",signup:"Tạo tài khoản",recover:"Gửi email đặt lại mật khẩu",update:"Lưu mật khẩu mới",edit:"Lưu tên hiển thị"})[mode];
    dialog.querySelector("#afn-auth-title").textContent =
      ({login:"Đăng nhập",signup:"Đăng ký",recover:"Quên mật khẩu",update:"Đặt lại mật khẩu",edit:"Đổi tên hiển thị"})[mode];
    form.classList.remove("afn-auth-hidden");
    profile.classList.add("afn-auth-hidden");
  }
  function showProfile(user) {
    currentUser = user;
    form.classList.add("afn-auth-hidden");
    tabs.classList.add("afn-auth-hidden");
    google.classList.add("afn-auth-hidden");
    forgot.classList.add("afn-auth-hidden");
    profile.classList.remove("afn-auth-hidden");
    dialog.querySelector("#afn-auth-title").textContent = "Tài khoản của bạn";
    profileName.textContent = (user.user_metadata && (user.user_metadata.display_name || user.user_metadata.full_name))
      || user.email || "Thành viên";
    nameEl.value = (user.user_metadata && user.user_metadata.display_name) || "";
    trigger.textContent = "Tài khoản";
  }
  async function refreshUser() {
    if (!client) return;
    try {
      var result = await client.auth.getUser();
      currentUser = result.data && result.data.user;
      if (currentUser) showProfile(currentUser);
      else { trigger.textContent = "Đăng nhập"; setMode("login"); }
    } catch (e) {
      trigger.textContent = "Đăng nhập";
      message("Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại.", true);
    }
  }
  function callbackURL(kind) { return window.location.origin + "/?auth=" + kind; }
  function reveal() {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    if (!ready) {
      setMode("login");
      form.classList.add("afn-auth-hidden");
      tabs.classList.add("afn-auth-hidden");
      google.classList.add("afn-auth-hidden");
      forgot.classList.add("afn-auth-hidden");
      message("Chức năng thành viên đang được cấu hình trên môi trường thử nghiệm. Chưa thể đăng nhập.", false);
    } else if (currentUser) showProfile(currentUser);
    else setMode("login");
  }
  trigger.addEventListener("click", reveal);
  dialog.querySelector(".afn-auth-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });
  tabs.addEventListener("click", function (event) {
    var b = event.target.closest("button[data-mode]");
    if (b && !busy) setMode(b.dataset.mode);
  });
  forgot.addEventListener("click", function () { if (!busy) setMode("recover"); });
  dialog.querySelector("#afn-edit").addEventListener("click", function () { if (!busy) setMode("edit"); });
  dialog.querySelector("#afn-signout").addEventListener("click", async function () {
    if (!client || busy) return;
    setBusy(true);
    var result = await client.auth.signOut({scope:"local"});
    setBusy(false);
    if (result.error) message("Không thể đăng xuất: " + result.error.message, true);
    else { currentUser = null; trigger.textContent = "Đăng nhập"; setMode("login"); message("Đã đăng xuất tại website này.", false); }
  });
  google.addEventListener("click", async function () {
    if (!client || busy) return;
    setBusy(true);
    try {
      var result = await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:callbackURL("callback")}});
      if (result.error) throw result.error;
    } catch (e) { message("Chưa thể đăng nhập Google: " + e.message, true); setBusy(false); }
  });
  function friendlyAuthError(error, currentMode) {
    var raw = String((error && error.message) || "");
    var status = error && error.status;
    var seconds = raw.match(/after\s+(\d+)\s+seconds?/i);
    if (status === 429 || /For security purposes|rate limit|too many requests/i.test(raw)) {
      return "Bạn đang gửi yêu cầu quá nhanh. " +
        (seconds ? "Có thể thử lại sau " + seconds[1] + " giây. " : "Vui lòng thử lại sau. ") +
        (currentMode === "signup" ? "Nếu bạn đã đăng ký trước đó, hãy kiểm tra email xác minh thay vì tạo lại tài khoản." : "");
    }
    if (/email not confirmed/i.test(raw)) return "Email chưa được xác minh. Hãy mở hộp thư, kiểm tra cả Spam rồi nhấn liên kết xác minh.";
    if (/invalid login credentials/i.test(raw)) return "Email hoặc mật khẩu chưa đúng, hoặc tài khoản chưa xác minh. Hãy kiểm tra lại thông tin.";
    if (/email address not authorized/i.test(raw)) return "Dịch vụ email thử nghiệm chưa được cấp quyền gửi tới địa chỉ này. Quản trị viên cần cấu hình SMTP.";
    if (/user already registered/i.test(raw)) return "Địa chỉ email này đã có tài khoản. Hãy đăng nhập hoặc sử dụng Quên mật khẩu.";
    if (/password/i.test(raw) && /weak|short/i.test(raw)) return "Mật khẩu chưa đáp ứng yêu cầu bảo mật. Hãy dùng ít nhất 8 ký tự.";
    return "Không thể hoàn thành thao tác. Vui lòng kiểm tra thông tin hoặc thử lại.";
  }
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!client || busy) return;
    var email = emailEl.value.trim();
    var password = passEl.value;
    var displayName = nameEl.value.trim();
    if (mode === "signup" && (displayName.length < 2 || displayName.length > 60)) {
      message("Tên hiển thị cần từ 2 đến 60 ký tự.", true); return;
    }
    if (["signup","update"].includes(mode) && password.length < 8) {
      message("Mật khẩu phải có ít nhất 8 ký tự.", true); return;
    }
    setBusy(true);
    try {
      var result;
      if (mode === "login") result = await client.auth.signInWithPassword({email:email,password:password});
      else if (mode === "signup") result = await client.auth.signUp({
        email:email,password:password,
        options:{emailRedirectTo:callbackURL("confirm"),data:{display_name:displayName}}
      });
      else if (mode === "recover") result = await client.auth.resetPasswordForEmail(email,{redirectTo:callbackURL("recovery")});
      else if (mode === "update") result = await client.auth.updateUser({password:password});
      else if (mode === "edit") result = await client.auth.updateUser({data:{display_name:displayName}});
      if (result.error) throw result.error;
      resetPasswords();
      if (mode === "recover") message("Nếu email hợp lệ, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.", false);
      else if (mode === "signup" && !result.data.session) message("Kiểm tra email để xác minh tài khoản trước khi đăng nhập.", false);
      else if (mode === "update") { await refreshUser(); message("Mật khẩu đã được cập nhật.", false); }
      else if (mode === "edit") { await refreshUser(); message("Tên hiển thị đã được cập nhật.", false); }
      else { await refreshUser(); message("Đăng nhập thành công.", false); }
    } catch (e) { message(friendlyAuthError(e, mode), true); }
    finally { setBusy(false); }
  });

  if (client) {
    client.auth.onAuthStateChange(function (event) {
      if (event === "PASSWORD_RECOVERY") {
        queueMicrotask(function () { reveal(); setMode("update"); });
      } else if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queueMicrotask(function () { refreshUser(); });
      }
    });
    refreshUser().then(function () {
      var url = new URL(location.href);
      if (url.searchParams.get("auth") === "recovery") { reveal(); setMode("update"); }
      else if (url.searchParams.get("auth") === "callback" || url.searchParams.get("auth") === "confirm") {
        url.searchParams.delete("auth");
        window.history.replaceState(window.history.state, "", url.href);
      }
    });
  }
})();
