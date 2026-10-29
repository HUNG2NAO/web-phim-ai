/* AI Film Network — independent member profile page. No admin/secret tokens. */
(async function () {
  "use strict";
  var params = new URLSearchParams(window.location.search);
  var hostname = window.location.hostname.replace(/^www\./, "");
  var brands = Array.isArray(window.SITES) ? window.SITES : [];
  var domainBrand = brands.find(function(b) { return b.domain === hostname; });
  var previewBrand = brands.find(function(b) { return b.id === params.get("site"); });
  var brand = domainBrand || previewBrand || brands[0];
  var isMemberPilot = !!(brand && (window.AFN_LEVEL3_CONFIG?.enabledSites||["xuongphim"]).includes(brand.id));
  var memberShortcut = document.getElementById("afn-member-hub-shortcut");
  if(memberShortcut){
    memberShortcut.hidden = !isMemberPilot;
    if(isMemberPilot){
      var hub=new URL("./member.html",window.location.href);
      if(!domainBrand)hub.searchParams.set("site",brand.id);
      document.getElementById("afn-to-member").href=hub.href;
    }
  }
  var home = new URL("./", window.location.href);
  if (!domainBrand && brand) home.searchParams.set("site", brand.id);
  ["afn-brand-home","afn-back-top","afn-signin-home","afn-profile-back"].forEach(function(id) {
    document.getElementById(id).href = home.href;
  });
  if (brand) {
    document.documentElement.style.setProperty("--accent", brand.accent);
    document.documentElement.style.setProperty("--on-accent", brand.onAccent);
    document.documentElement.dataset.world = brand.world || "co-trang";
    document.getElementById("afn-brand-seal").textContent = brand.seal || "";
    document.getElementById("afn-brand-name").textContent = (brand.name || "Phim AI").toUpperCase();
    document.title = "Hồ sơ cá nhân — " + brand.name;
  }
  var loading = document.getElementById("afn-account-loading");
  var signedout = document.getElementById("afn-account-signedout");
  var signedin = document.getElementById("afn-account-signedin");
  var status = document.getElementById("afn-profile-status");
  function showStatus(value, isError) {
    status.textContent = value;
    status.hidden = !value;
    status.dataset.error = String(!!isError);
  }
  function setView(view) {
    loading.hidden = view !== "loading";
    signedin.hidden = view !== "signedin";
    signedout.hidden = view !== "signedout";
  }
  var cfg = window.AFN_AUTH_CONFIG || {};
  var usable = cfg.enabled === true && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url || "")
    && /^sb_publishable_[\w-]+$/.test(cfg.publishableKey || "")
    && window.supabase && typeof window.supabase.createClient === "function";
  if (!usable) {
    setView("signedout");
    signedout.querySelector("p").textContent = "Tính năng thành viên chưa được bật tại website này.";
    return;
  }
  var supabase = window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{
    persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce",
    storageKey:cfg.storageKey || "afn-film-auth-v1"
  }});
  var current = null;
  // Auth owns identity and sessions; public.profiles stores the shared member profile.
  // All operations use the user's JWT and are subject to the existing RLS policies.
  async function syncMemberRecords(user) {
    if (!user || !user.id) return;
    var metadata = user.user_metadata || {};
    var raw = String(metadata.display_name || metadata.full_name || "Thành viên").trim();
    var name = raw.length >= 2 && raw.length <= 60 ? raw : "Thành viên";
    var existing = await supabase.from("profiles").select("id,display_name").eq("id",user.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) {
      var created = await supabase.from("profiles").insert({id:user.id,display_name:name});
      if (created.error && created.error.code !== "23505") throw created.error;
    }
    if (brand && ["xuongphim","khophim","phephim","phimhay","ghienphim"].includes(brand.id)) {
      var found = await supabase.from("site_memberships").select("site_id")
        .eq("user_id",user.id).eq("site_id",brand.id).maybeSingle();
      if (found.error) throw found.error;
      if (!found.data) {
        var joined = await supabase.from("site_memberships").insert({user_id:user.id,site_id:brand.id});
        if (joined.error && joined.error.code !== "23505") throw joined.error;
      }
    }
  }
  function present(user) {
    if (!user) { current = null; setView("signedout"); return; }
    current = user;
    var m = user.user_metadata || {};
    var name = m.display_name || m.full_name || "Thành viên";
    document.getElementById("afn-profile-display").textContent = name;
    document.getElementById("afn-profile-email").textContent = user.email || "";
    document.getElementById("afn-avatar").textContent = name.trim().charAt(0).toUpperCase() || "T";
    document.getElementById("afn-edit-display").value = m.display_name || m.full_name || "";
    document.getElementById("afn-member-since").textContent =
      user.created_at ? new Intl.DateTimeFormat("vi-VN",{dateStyle:"medium"}).format(new Date(user.created_at)) : "—";
    var verified = !!user.email_confirmed_at;
    document.getElementById("afn-verified").textContent = verified ? "Email đã xác minh" : "Email chưa xác minh";
    var providers = (user.app_metadata && user.app_metadata.providers) || [];
    document.getElementById("afn-login-method").textContent =
      providers.includes("google") ? "Google" : providers.includes("email") ? "Email" : "Tài khoản thành viên";
    setView("signedin");
  }
  supabase.auth.onAuthStateChange(function(event,session) {
    if (event === "SIGNED_OUT") queueMicrotask(function(){ present(null); });
    if (event === "USER_UPDATED" && session && session.user) {
      queueMicrotask(function(){ present(session.user); });
    }
    if (event === "SIGNED_IN" && !current && session && session.user) {
      queueMicrotask(function(){ present(session.user); });
    }
  });
  var response = await supabase.auth.getUser();
  if (response.error) { setView("signedout"); signedout.querySelector("p").textContent = "Chưa thể xác nhận phiên đăng nhập. Hãy về trang chủ và thử lại."; }
  else {
    var user = response.data && response.data.user;
    present(user);
    if (user) {
      try { await syncMemberRecords(user); }
      catch (error) {
        showStatus("Hồ sơ hiển thị bình thường nhưng chưa thể đồng bộ dữ liệu thành viên. Vui lòng tải lại trang.",true);
      }
    }
  }
  document.getElementById("afn-profile-form").addEventListener("submit",async function(event) {
    event.preventDefault();
    if (!current) return;
    var input = document.getElementById("afn-edit-display");
    var name = input.value.trim();
    if (name.length < 2 || name.length > 60) {
      showStatus("Tên hiển thị cần từ 2 đến 60 ký tự.",true);return;
    }
    var btn = document.getElementById("afn-save-profile");
    btn.disabled = true;
    showStatus("",false);
    try {
      var updated = await supabase.auth.updateUser({data:{display_name:name}});
      if (updated.error) throw updated.error;
      present(updated.data.user);
      var synced = await supabase.from("profiles").upsert({
        id:current.id,display_name:name,updated_at:new Date().toISOString()
      },{onConflict:"id"});
      if (synced.error) {
        showStatus("Tên hiển thị đã đổi nhưng chưa đồng bộ vào hồ sơ chung. Vui lòng nhấn Lưu thay đổi lần nữa.",true);
      } else showStatus("Đã cập nhật tên hiển thị.",false);
    } catch(e) {
      showStatus("Không thể lưu tên hiển thị. Vui lòng thử lại.",true);
    } finally { btn.disabled = false; }
  });
  document.getElementById("afn-page-signout").addEventListener("click",async function() {
    var btn = this;
    btn.disabled = true;
    showStatus("",false);
    try {
      var result = await supabase.auth.signOut({scope:"local"});
      if (result.error) throw result.error;
      present(null);
      signedout.querySelector("p").textContent = "Bạn đã đăng xuất khỏi website này.";
    } catch(e) { showStatus("Không thể đăng xuất. Vui lòng thử lại.",true); }
    finally { btn.disabled = false; }
  });
})();