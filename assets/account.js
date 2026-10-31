/* AI Film Network — independent member profile page. No admin/secret tokens. */
(async function () {
  "use strict";
  var params = new URLSearchParams(window.location.search);
  var hostname = window.location.hostname.replace(/^www\./, "");
  var brands = Array.isArray(window.SITES) ? window.SITES : [];
  var domainBrand = brands.find(function(b) { return b.domain === hostname; });
  var previewBrand = brands.find(function(b) { return b.id === params.get("site"); });
  var brand = window.AFN_RESOLVE_SITE ? window.AFN_RESOLVE_SITE().site : (domainBrand || previewBrand || brands[0]);
  var isMemberPilot = !!(brand && (window.AFN_LEVEL3_CONFIG?.enabledSites||["xuongphim"]).includes(brand.id));
  var memberShortcut = document.getElementById("afn-member-hub-shortcut");
  if(memberShortcut){
    memberShortcut.hidden = !isMemberPilot;
    if(isMemberPilot){
      var hub=new URL("./member.html",window.location.href);
      if(!domainBrand)hub.searchParams.set("site",brand.id);
      document.getElementById("afn-to-member").href=hub.href;
      document.getElementById("afn-export-link").href=hub.href+"#settings";
      var headline=memberShortcut.querySelector("strong");
      if(headline)headline.textContent="Trung tâm thành viên "+brand.name;
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
    if (brand && (window.SITES||[]).some(function(s){return s.id===brand.id;})) {
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
    if (!user) {
      current = null; setView("signedout");
      if(memberShortcut)memberShortcut.hidden=true;
      document.getElementById("afn-account-security").hidden=true;
      document.getElementById("afn-privacy-panel").hidden=true;
      document.getElementById("afn-admin-shortcut").hidden=true;
      return;
    }
    current = user;
    if(memberShortcut)memberShortcut.hidden=!isMemberPilot;
    document.getElementById("afn-account-security").hidden=false;
    document.getElementById("afn-privacy-panel").hidden=false;
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
      // Staff role is read from RLS-protected server data, never user_metadata.
      try {
        var staff = await supabase.from("site_staff").select("role")
          .eq("user_id",user.id).eq("site_id",brand.id);
        var authorized=!staff.error && (staff.data||[]).length>0;
        document.getElementById("afn-admin-shortcut").hidden=!authorized;
        if(authorized)document.getElementById("afn-to-admin").href="./admin.html?site="+encodeURIComponent(brand.id);
      } catch(_){document.getElementById("afn-admin-shortcut").hidden=true;}
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
  // Account protection: all writes use the user's authenticated JWT.
  var passwordForm=document.getElementById("afn-password-form");
  passwordForm.addEventListener("submit",async function(event){
    event.preventDefault();
    if(!current)return;
    var password=document.getElementById("afn-new-password").value;
    var confirmPassword=document.getElementById("afn-confirm-password").value;
    if(password.length<8||password!==confirmPassword){
      showStatus("Mật khẩu phải đủ 8 ký tự và hai lần nhập phải khớp.",true);return;
    }
    var btn=passwordForm.querySelector('button[type="submit"]');btn.disabled=true;
    try{
      var response=await supabase.auth.updateUser({password:password});
      if(response.error)throw response.error;
      passwordForm.reset();
      showStatus("Đã cập nhật mật khẩu. Nếu hệ thống yêu cầu xác minh bổ sung, hãy thực hiện theo hướng dẫn.",false);
    }catch(_){showStatus("Chưa thể đổi mật khẩu. Phiên đăng nhập có thể cần xác minh bổ sung.",true);}
    finally{btn.disabled=false;}
  });
  var emailForm=document.getElementById("afn-email-form");
  emailForm.addEventListener("submit",async function(event){
    event.preventDefault();if(!current)return;
    var email=document.getElementById("afn-new-email").value.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email===String(current.email||"").toLowerCase()){
      showStatus("Hãy nhập một email hợp lệ khác email đang sử dụng.",true);return;
    }
    var btn=emailForm.querySelector('button[type="submit"]');btn.disabled=true;
    try{
      // Supabase project needs correct Auth URL Configuration for the active Preview/production origin.
      var response=await supabase.auth.updateUser({email:email},{
        emailRedirectTo:window.location.origin+"/?auth=confirm"
      });
      if(response.error)throw response.error;
      emailForm.reset();showStatus("Đã gửi yêu cầu đổi email. Kiểm tra hộp thư để xác nhận trước khi email thay đổi.",false);
    }catch(_){showStatus("Không thể gửi xác nhận đổi email. Kiểm tra cấu hình redirect và SMTP của Supabase.",true);}
    finally{btn.disabled=false;}
  });
  async function loadPrivacyRequests(){
    if(!current)return;
    var box=document.getElementById("afn-privacy-requests");
    var response=await supabase.from("member_privacy_requests").select("request_type,status,submitted_at")
      .eq("user_id",current.id);
    if(response.error){box.textContent="Chưa thể tải trạng thái yêu cầu.";return;}
    box.replaceChildren();
    (response.data||[]).sort((a,b)=>new Date(b.submitted_at)-new Date(a.submitted_at)).slice(0,10).forEach(function(r){
      var p=document.createElement("p");
      p.className="afn-auth-hint";
      p.textContent="Yêu cầu "+(r.request_type==="delete_account"?"xóa tài khoản":r.request_type)+" · "+r.status+" · "+new Date(r.submitted_at).toLocaleDateString("vi-VN");
      box.append(p);
    });
  }
  document.getElementById("afn-request-delete").addEventListener("click",async function(){
    if(!current)return;
    if(!window.confirm("Gửi yêu cầu xóa tài khoản? Quản trị viên sẽ cần xác minh danh tính trước khi thực hiện. Đây chưa phải thao tác xóa ngay."))return;
    var btn=this;btn.disabled=true;
    try{
      var old=await supabase.from("member_privacy_requests").select("id").eq("user_id",current.id)
        .eq("request_type","delete_account").eq("status","pending");
      if(old.error)throw old.error;
      if((old.data||[]).length){showStatus("Yêu cầu xóa tài khoản đang được tiếp nhận.",false);return;}
      var response=await supabase.from("member_privacy_requests").insert({
        user_id:current.id,site_id:brand.id,request_type:"delete_account",status:"pending"
      });
      if(response.error)throw response.error;
      await loadPrivacyRequests();
      showStatus("Đã ghi nhận yêu cầu xóa tài khoản. Quản trị viên sẽ kiểm tra và xác minh.",false);
    }catch(_){showStatus("Chưa thể gửi yêu cầu xóa. Vui lòng thử lại.",true);}
    finally{btn.disabled=false;}
  });
  if(current)loadPrivacyRequests().catch(function(){});
})();
