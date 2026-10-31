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
  var accountMenu = document.createElement("div");
  accountMenu.className = "afn-account-menu afn-auth-hidden";
  accountMenu.id = "afn-account-menu";
  accountMenu.innerHTML = [
    '<div class="afn-menu-identity">',
      '<strong id="afn-menu-name"></strong>',
      '<span id="afn-menu-email"></span>',
    '</div>',
    '<a href="./member.html" class="afn-auth-hidden" id="afn-menu-member">Trung tâm thành viên</a>',
    '<a href="./account.html" id="afn-menu-profile">Hồ sơ cá nhân</a>',
    '<button type="button" id="afn-menu-signout">Đăng xuất</button>'
  ].join("");
  accountMenu.setAttribute("aria-label", "Tùy chọn tài khoản");
  var accountURL = new URL("./account.html", window.location.href);
  var previewBrand = new URL(window.location.href).searchParams.get("site");
  var afnResolved = window.AFN_RESOLVE_SITE ? window.AFN_RESOLVE_SITE() : null;   // Shared Core
  var afnPreview = afnResolved ? afnResolved.preview : window.location.hostname.endsWith(".pages.dev");
  if (afnPreview && (window.SITES||[]).some(function (s) { return s.id === previewBrand; })) {
    accountURL.searchParams.set("site", previewBrand);
  }
  accountMenu.querySelector("#afn-menu-profile").href = accountURL.href;
  const memberURL = new URL("./member.html", window.location.href);
  const hostBrand = window.location.hostname.replace(/^www\./,"");
  const activeBrand = afnResolved ? afnResolved.site : (afnPreview
    ? (window.SITES||[]).find(s=>s.id===(previewBrand||"xuongphim"))
    : (window.SITES||[]).find(s=>s.domain===hostBrand));
  if (afnPreview) {
    memberURL.searchParams.set("site",activeBrand?activeBrand.id:(previewBrand||"xuongphim"));
  }
  const siteId = activeBrand?.id;
  const isXuongPilot = (window.AFN_LEVEL3_CONFIG?.enabledSites||["xuongphim"]).includes(siteId);
  const memberLink = accountMenu.querySelector("#afn-menu-member");
  memberLink.href = memberURL.href;
  memberLink.classList.toggle("afn-auth-hidden",!isXuongPilot);
  slot.appendChild(accountMenu);
  trigger.setAttribute("aria-expanded", "false");
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
      '<p class="afn-auth-hint">Đăng nhập để quản lý tài khoản thành viên của bạn.</p>',
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
      '<section class="afn-auth-success afn-auth-hidden" id="afn-reset-success" role="status" aria-live="polite">',
        '<span class="afn-auth-success-icon" aria-hidden="true">✓</span>',
        '<h3>Đặt lại mật khẩu thành công</h3>',
        '<p>Mật khẩu mới đã được lưu. Tài khoản của bạn đã sẵn sàng sử dụng.</p>',
        '<button type="button" class="afn-auth-primary" id="afn-success-continue">Quay lại website</button>',
        '<button type="button" class="afn-auth-google" id="afn-success-account">Tài khoản của tôi</button>',
      '</section>',
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
  var visibilityButton = document.createElement("button");
  visibilityButton.type = "button";
  visibilityButton.className = "afn-password-visibility";
  visibilityButton.textContent = "Hiện mật khẩu";
  visibilityButton.setAttribute("aria-label", "Hiện mật khẩu đã nhập");
  visibilityButton.setAttribute("aria-pressed", "false");
  dialog.querySelector(".afn-password-wrap").appendChild(visibilityButton);
  visibilityButton.addEventListener("click", function () {
    var showing = passEl.type === "text";
    passEl.type = showing ? "password" : "text";
    visibilityButton.textContent = showing ? "Hiện mật khẩu" : "Ẩn mật khẩu";
    visibilityButton.setAttribute("aria-label", showing ? "Hiện mật khẩu đã nhập" : "Ẩn mật khẩu đã nhập");
    visibilityButton.setAttribute("aria-pressed", String(!showing));
  });
  var nameWrap = dialog.querySelector(".afn-name-wrap");
  var emailWrap = dialog.querySelector(".afn-email-wrap");
  var passwordWrap = dialog.querySelector(".afn-password-wrap");
  var successPanel = dialog.querySelector("#afn-reset-success");
  var msg = dialog.querySelector("#afn-auth-message");
  var mode = "login";
  var busy = false;
  var currentUser = null;
  var postResetSuccess = false;
  var passwordUpdatePending = false;
  // Recovery links can create a valid session before PASSWORD_RECOVERY is dispatched.
  // Keep the reset-password form above the normal account view until the user finishes.
  var recovering = new URL(window.location.href).searchParams.get("auth") === "recovery";

  function closeAccountMenu() {
    accountMenu.classList.add("afn-auth-hidden");
    trigger.setAttribute("aria-expanded", "false");
  }
  function openAccountMenu() {
    if (!currentUser) return;
    var meta = currentUser.user_metadata || {};
    var display = meta.display_name || meta.full_name || "Thành viên";
    accountMenu.querySelector("#afn-menu-name").textContent = display;
    accountMenu.querySelector("#afn-menu-email").textContent = currentUser.email || "";
    accountMenu.classList.remove("afn-auth-hidden");
    trigger.setAttribute("aria-expanded", "true");
    accountMenu.querySelector("#afn-menu-profile").focus();
  }
  function message(text, isError) {
    msg.textContent = text || "";
    msg.dataset.kind = isError ? "error" : "info";
    msg.classList.toggle("afn-auth-hidden", !text);
  }
  function setBusy(v) {
    busy = v;
    Array.prototype.forEach.call(dialog.querySelectorAll("button, input"), function (el) { el.disabled = v; });
  }
  function resetPasswords() { passEl.value = ""; passEl.type = "password"; visibilityButton.textContent = "Hiện mật khẩu"; visibilityButton.setAttribute("aria-pressed", "false"); visibilityButton.setAttribute("aria-label", "Hiện mật khẩu đã nhập"); }
  function setMode(next) {
    mode = next;
    message("", false);
    resetPasswords();
    tabs.classList.toggle("afn-auth-hidden", !["login", "signup"].includes(mode));
    Array.prototype.forEach.call(tabs.querySelectorAll("[data-mode]"), function (b) {
      b.setAttribute("aria-selected", String(b.dataset.mode === mode));
    });
    nameWrap.classList.toggle("afn-auth-hidden", mode !== "signup");
    emailWrap.classList.toggle("afn-auth-hidden", mode === "update");
    passwordWrap.classList.toggle("afn-auth-hidden", mode === "recover");
    passEl.autocomplete = mode === "login" ? "current-password" : "new-password";
    passEl.required = mode !== "recover";
    emailEl.required = mode !== "update";
    google.classList.toggle("afn-auth-hidden", cfg.googleEnabled !== true || !["login", "signup"].includes(mode));
    forgot.classList.toggle("afn-auth-hidden", mode !== "login");
    submit.textContent = ({login:"Đăng nhập",signup:"Tạo tài khoản",recover:"Gửi email đặt lại mật khẩu",update:"Lưu mật khẩu mới"})[mode];
    dialog.querySelector("#afn-auth-title").textContent =
      ({login:"Đăng nhập",signup:"Đăng ký",recover:"Quên mật khẩu",update:"Đặt lại mật khẩu"})[mode];
    form.classList.remove("afn-auth-hidden");
    successPanel.classList.add("afn-auth-hidden");
  }
  function showResetSuccess() {
    if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
    form.classList.add("afn-auth-hidden");
    tabs.classList.add("afn-auth-hidden");
    google.classList.add("afn-auth-hidden");
    forgot.classList.add("afn-auth-hidden");
    successPanel.classList.remove("afn-auth-hidden");
    dialog.querySelector("#afn-auth-title").textContent = "Hoàn tất khôi phục";
    trigger.textContent = "Tài khoản";
    message("", false);
  }
  async function refreshUser() {
    if (!client) return;
    try {
      var result = await client.auth.getUser();
      currentUser = result.data && result.data.user;
      if (currentUser) {
        trigger.textContent = "Tài khoản";
        trigger.setAttribute("aria-haspopup", "menu");
        trigger.setAttribute("aria-controls", "afn-account-menu");
        if (postResetSuccess) showResetSuccess();
        else if (recovering || passwordUpdatePending) {
          if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
          if (mode !== "update") setMode("update");
        } else if (dialog.open && mode === "login") {
          dialog.close();
        }
      } else {
        trigger.textContent = "Đăng nhập";
        trigger.setAttribute("aria-haspopup", "dialog");
        trigger.removeAttribute("aria-controls");
        closeAccountMenu();
        if (recovering) {
          // A recovery URL without an established session must not display a working reset form.
          setMode("login");
          message("Liên kết khôi phục chưa được xác thực hoặc đã hết hạn. Hãy yêu cầu liên kết mới.", true);
        } else setMode("login");
      }
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
    } else if (postResetSuccess) showResetSuccess();
    else if (recovering && currentUser) setMode("update");
    else if (currentUser) window.location.assign(accountURL.href);
    else setMode("login");
  }
  trigger.addEventListener("click", function () {
    if (ready && currentUser && !recovering && !postResetSuccess) {
      if (accountMenu.classList.contains("afn-auth-hidden")) openAccountMenu();
      else closeAccountMenu();
    } else {
      closeAccountMenu();
      reveal();
    }
  });
  accountMenu.querySelector("#afn-menu-profile").addEventListener("click", closeAccountMenu);
  document.addEventListener("pointerdown", function (event) {
    if (!slot.contains(event.target)) closeAccountMenu();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !accountMenu.classList.contains("afn-auth-hidden")) {
      closeAccountMenu();
      trigger.focus();
    }
  });
  dialog.querySelector(".afn-auth-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });
  tabs.addEventListener("click", function (event) {
    var b = event.target.closest("button[data-mode]");
    if (b && !busy) setMode(b.dataset.mode);
  });
  forgot.addEventListener("click", function () { if (!busy) setMode("recover"); });
   dialog.querySelector("#afn-success-continue").addEventListener("click", function () {
    postResetSuccess = false;
    message("", false);
    dialog.close();
  });
  dialog.querySelector("#afn-success-account").addEventListener("click", function () {
    postResetSuccess = false;
    message("", false);
    dialog.close();
    window.location.assign(accountURL.href);
  });
  async function signOutSite() {
    if (!client || busy) return;
    closeAccountMenu();
    setBusy(true);
    try {
      var result = await client.auth.signOut({scope:"local"});
      if (result.error) throw result.error;
      currentUser = null;
      trigger.textContent = "Đăng nhập";
      trigger.removeAttribute("aria-controls");
      setMode("login");
      if (dialog.open) message("Đã đăng xuất tại website này.", false);
    } catch (error) {
      if (dialog.open) message("Không thể đăng xuất. Vui lòng thử lại.", true);
      else {
        reveal();
        message("Không thể đăng xuất. Vui lòng thử lại.", true);
      }
    } finally { setBusy(false); }
  }
  accountMenu.querySelector("#afn-menu-signout").addEventListener("click", signOutSite);
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
    if (/invalid login credentials/i.test(raw)) return "Không thể đăng nhập bằng email và mật khẩu này. Hãy kiểm tra lại hoặc chọn Quên mật khẩu? để đặt mật khẩu mới.";
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
      else if (mode === "update") {
        passwordUpdatePending = true;
        result = await client.auth.updateUser({password:password});
      }
      if (result.error) throw result.error;
      resetPasswords();
      if (mode === "recover") message("Nếu email hợp lệ, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.", false);
      else if (mode === "signup" && !result.data.session) message("Kiểm tra email để xác minh tài khoản trước khi đăng nhập.", false);
      else if (mode === "update") {
        postResetSuccess = true;
        recovering = false;
        passwordUpdatePending = false;
        var cleanURL = new URL(window.location.href);
        cleanURL.searchParams.delete("auth");
        window.history.replaceState(window.history.state, "", cleanURL.href);
        await refreshUser();
        showResetSuccess();
      }
      else if (mode === "login") {
        await refreshUser();
        if (dialog.open) dialog.close();
      } else {
        await refreshUser();
        message("Đăng nhập thành công.", false);
      }
    } catch (e) {
      passwordUpdatePending = false;
      message(friendlyAuthError(e, mode), true);
    } finally { setBusy(false); }
  });

  if (client) {
    client.auth.onAuthStateChange(function (event) {
      if (event === "PASSWORD_RECOVERY") {
        recovering = true;
        queueMicrotask(function () { refreshUser(); });
      } else if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queueMicrotask(function () { refreshUser(); });
      }
    });
    refreshUser().then(function () {
      var url = new URL(location.href);
      if (url.searchParams.get("auth") === "callback" || url.searchParams.get("auth") === "confirm") {
        url.searchParams.delete("auth");
        window.history.replaceState(window.history.state, "", url.href);
      }
      // ?auth=recovery is intentionally kept until a password was updated.
    });
  }
})();
