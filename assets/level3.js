/* Shared Level 3 Member Hub — staged five-brand Preview candidate.
   Public code, per-site access and user-owned RLS policies. */
(async function(){
  "use strict";
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
  const ALL=Array.isArray(window.FILMS)?window.FILMS:[];
  const BRANDS=Array.isArray(window.SITES)?window.SITES:[];
  const params=new URL(window.location.href).searchParams;
  const hostname=window.location.hostname.replace(/^www\./,"");
  const preview=hostname.endsWith(".pages.dev");
  const brand=preview
    ? (BRANDS.find(b=>b.id===params.get("site"))||BRANDS[0])
    : BRANDS.find(b=>b.domain===hostname);
  const SITE=brand?.id||"unknown";
  const flags=window.AFN_LEVEL3_CONFIG?.enabledSites||["xuongphim"];
  const isPilot=flags.includes(SITE);
  const FILMS=ALL.filter(f=>(f.world||"co-trang")===(brand?.world||"co-trang"));
  const byId=new Map(ALL.map(f=>[f.id,f]));
  const cfg=window.AFN_AUTH_CONFIG||{};
  const configured=cfg.enabled===true&&/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url||"")
    &&/^sb_publishable_[\w-]+$/.test(cfg.publishableKey||"")
    &&window.supabase&&typeof window.supabase.createClient==="function";
  const home=new URL("./",window.location.href);
  const account=new URL("./account.html",window.location.href);
  if(preview){home.searchParams.set("site",SITE);account.searchParams.set("site",SITE);}
  $("#home-link").href=home.href;
  $("#account-link").href=account.href;
  $("#security-link").href=account.href;
  if(brand) {
    document.title="Trung tâm thành viên — "+brand.name;
    $(".brand-mark").textContent=brand.seal;
    const headerName=$(".brand>span:nth-child(2)");
    headerName.replaceChildren(document.createTextNode(brand.name.toUpperCase()),Object.assign(document.createElement("span"),{className:"brand-dot",textContent:".AI"}));
    document.documentElement.style.setProperty("--cyan",brand.accent);
    document.documentElement.style.setProperty("--cyan-txt",brand.onAccent);
    $(".member-hero .eyebrow").textContent="KHÔNG GIAN "+brand.name.toUpperCase();
    $("#pilot-notice").textContent="Bản thử nghiệm: phim hiện vẫn là nội dung mẫu, chưa có video phát. Không tạo giả tiến độ xem.";
    $("#tab-discover h2").textContent="Khám phá phim "+(brand.world==="tuong-lai"?"viễn tưởng":"cổ trang");
    $(".foot span:first-child").textContent=brand.name.toUpperCase()+".AI · MEMBER HUB";
  }
  const state={user:null,profiles:[],profile:null,prefs:null,library:[],progress:[],reviews:[],approved:[],inbox:[],tab:"overview",collection:"favorite",genre:"",busy:false};
  let client=null;
  function announce(message,error){
    const toast=$("#toast");
    toast.textContent=message;toast.hidden=!message;
    toast.dataset.error=error?"true":"false";
  }
  function clearToast(){announce("");}
  function errorText(){return "Không thể hoàn thành. Vui lòng kiểm tra kết nối và thử lại.";}
  function show(section){
    $("#hub-loading").hidden=section!=="loading";
    $("#hub-guest").hidden=section!=="guest";
    $("#hub-app").hidden=section!=="app";
  }
  if(!isPilot){
    show("guest");
    $("#hub-guest h1").textContent="Trung tâm thành viên đang thử nghiệm theo từng website";
    $("#hub-guest p").textContent="Bốn thương hiệu còn lại sẽ được cập nhật sau khi nghiệm thu website mẫu.";
    return;
  }
  if(!configured){
    show("guest");$("#hub-guest p").textContent="Tính năng thành viên chưa được cấu hình trên bản thử nghiệm này.";return;
  }
  client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{
    persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce",
    storageKey:cfg.storageKey||"afn-film-auth-v1"
  }});
  function savedKey(){return "afn-active-viewer:"+state.user.id+":"+SITE;}
  function setActiveProfile(profile){
    state.profile=profile;
    try{window.localStorage.setItem(savedKey(),profile.id);}catch(_){}
    $("#active-profile-name").textContent=profile.nickname;
    const sel=$("#profile-select");sel.replaceChildren();
    state.profiles.forEach(p=>{const opt=new Option(p.nickname,p.id);sel.add(opt);});
    sel.value=profile.id;
  }
  async function getRows(table,filters){
    let q=client.from(table).select("*");
    Object.entries(filters).forEach(([key,value])=>{q=q.eq(key,value);});
    const {data,error}=await q;
    if(error)throw error;
    return data||[];
  }
  async function ensureProfiles(){
    let list=await getRows("viewer_profiles",{user_id:state.user.id,site_id:SITE});
    if(!list.length){
      const base=(state.user.user_metadata&&state.user.user_metadata.display_name)||"Hồ sơ chính";
      const name=String(base).trim().slice(0,40);
      const {error}=await client.from("viewer_profiles").insert({
        user_id:state.user.id,site_id:SITE,nickname:name.length>=2?name:"Hồ sơ chính"
      });
      if(error)throw error;
      list=await getRows("viewer_profiles",{user_id:state.user.id,site_id:SITE});
    }
    state.profiles=list.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    let desired=null;try{desired=window.localStorage.getItem(savedKey());}catch(_){}
    setActiveProfile(list.find(p=>p.id===desired)||list[0]);
  }
  async function loadSelected(){
    if(!state.profile)return;
    const k={user_id:state.user.id,site_id:SITE,viewer_profile_id:state.profile.id};
    const [prefs,lib,progress,reviews,inbox,approved]=await Promise.all([
      getRows("viewer_preferences",k),
      getRows("film_library",k),
      getRows("watch_progress",k),
      getRows("film_reviews",k),
      getRows("member_notifications",{user_id:state.user.id,site_id:SITE}),
      getRows("approved_reviews",{site_id:SITE})
    ]);
    state.prefs=prefs[0]||null;
    state.library=lib;state.progress=progress;state.reviews=reviews;
    state.inbox=inbox.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));state.approved=approved;
    renderAll();
  }
  function make(tag,cls,text){
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(text!==undefined)e.textContent=String(text);
    return e;
  }
  function empty(container,title,description){
    container.replaceChildren();
    const b=make("div","empty");
    b.append(make("strong","",title),make("p","",description));
    container.append(b);
  }
  function has(filmId,collection){
    return state.library.some(row=>row.film_id===filmId&&row.collection===collection);
  }
  function card(f,variant){
    const el=make("article","film-card");el.dataset.filmId=f.id;
    const lbl=make("div","movie-type",(f.world==="tuong-lai"?"VIỄN TƯỞNG":"CỔ TRANG")+" · DEMO");
    const title=make("h4","",f.title||f.id);
    const genres=make("div","genre",(f.genres||[]).join(" · "));
    const info=make("div","meta",f.year?("Phim mẫu · "+f.year):"Phim mẫu chưa phát hành");
    const controls=make("div","film-controls");
    for(const [action,label] of [["favorite","♡ Yêu thích"],["watchlist","＋ Xem sau"],["following","◉ Theo dõi"]]){
      const b=make("button",has(f.id,action)?"is-saved":"",has(f.id,action)?("✓ "+label.slice(2)):label);
      b.type="button";b.dataset.film=f.id;b.dataset.action=action;
      b.setAttribute("aria-pressed",String(has(f.id,action)));
      controls.append(b);
    }
    el.append(lbl,title,genres,info,controls);
    if(f.live){
      const dest=new URL(home.href);dest.searchParams.set("film",f.id);
      const watch=make("a","btn primary","Xem phim");
      watch.href=dest.href;watch.setAttribute("aria-label","Xem phim "+f.title);
      el.append(watch);
    }
    if(variant==="progress"){
      const record=state.progress.filter(p=>p.film_id===f.id).sort((a,b)=>new Date(b.watched_at)-new Date(a.watched_at))[0];
      if(record){
        const progress=record.duration_seconds?Math.min(100,Math.round(record.position_seconds/record.duration_seconds*100)):0;
        el.append(make("div","meta","Tập "+record.episode+" · "+Math.floor(record.position_seconds/60)+" phút · "+progress+"%"));
      }
    }
    return el;
  }
  function renderItems(id,films,emptyTitle,description,variant){
    const target=$(id);target.replaceChildren();
    if(!films.length){empty(target,emptyTitle,description);return;}
    films.forEach(f=>target.append(card(f,variant)));
  }
  function recommendations(){
    const pref=state.prefs;
    if(!pref||!pref.personalization_enabled){
      $("#recommend-context").textContent="Chưa bật cá nhân hóa. Đây là phim mẫu để khám phá giao diện.";
      return FILMS.slice(0,3);
    }
    const genres=pref.genres||[];
    const liked=new Set(state.library.filter(x=>x.collection==="favorite").map(x=>x.film_id));
    const likedGenres=new Set([...liked].flatMap(id=>(byId.get(id)?.genres)||[]));
    $("#recommend-context").textContent="Gợi ý theo thể loại và danh sách đã lưu; chưa sử dụng dịch vụ AI bên ngoài.";
    return FILMS.map(f=>{
      let score=(f.genres||[]).filter(g=>genres.includes(g)).length*4+
        (f.genres||[]).filter(g=>likedGenres.has(g)).length*2;
      if(liked.has(f.id))score-=20;
      return {f,score};
    }).sort((a,b)=>b.score-a.score||a.f.title.localeCompare(b.f.title)).slice(0,6).map(x=>x.f);
  }
  function renderOverview(){
    const counts=col=>state.library.filter(x=>x.collection===col).length;
    $("#stat-favorites").textContent=counts("favorite");
    $("#stat-watchlist").textContent=counts("watchlist");
    $("#stat-following").textContent=counts("following");
    const progress=state.progress.filter(x=>x.duration_seconds>0&&x.position_seconds>0&&x.position_seconds<x.duration_seconds*0.95);
    $("#stat-progress").textContent=progress.length;
    renderItems("#continue-items",[...new Set(progress.map(x=>x.film_id))].map(id=>byId.get(id)).filter(Boolean),
      "Chưa có phim đang xem","Khi bạn phát phim thật và bật ghi nhớ tiến độ, nội dung sẽ xuất hiện ở đây.","progress");
    renderItems("#recommend-items",recommendations(),"Chưa có gợi ý","Hãy chọn sở thích hoặc khám phá thêm phim mẫu.");
  }
  function renderLibrary(){
    const rows=state.library.filter(x=>x.collection===state.collection);
    const films=rows.map(x=>byId.get(x.film_id)).filter(Boolean);
    renderItems("#library-items",films,"Danh sách này còn trống","Khám phá phim mẫu và lưu những bộ bạn quan tâm.");
    $$("[data-collection-filter]").forEach(b=>b.classList.toggle("selected",b.dataset.collectionFilter===state.collection));
  }
  function renderDiscover(){
    const films=FILMS.filter(f=>!state.genre||(f.genres||[]).includes(state.genre));
    renderItems("#discover-items",films,"Không có phim thuộc thể loại này","Thử chọn thể loại khác.");
  }
  function renderProfiles(){
    const root=$("#viewer-profile-items");root.replaceChildren();
    state.profiles.forEach(p=>{
      const card=make("div","viewer-box"+(p.id===state.profile.id?" current":""));
      card.append(make("div","profile-icon",p.nickname.slice(0,1).toUpperCase()),make("strong","",p.nickname),
        make("span","",p.id===state.profile.id?"Đang sử dụng":"Hồ sơ riêng"));
      const btn=make("button","",p.id===state.profile.id?"Đang chọn":"Chuyển sang hồ sơ này");
      btn.type="button";btn.disabled=p.id===state.profile.id;btn.dataset.pickProfile=p.id;
      card.append(btn);
      if(p.id!==state.profile.id){
        const remove=make("button","remove-profile","Xóa hồ sơ này");
        remove.type="button";
        remove.dataset.deleteProfile=p.id;
        remove.title="Xóa hồ sơ và toàn bộ dữ liệu xem, sở thích, danh sách đã lưu riêng của hồ sơ.";
        card.append(remove);
      }
      root.append(card);
    });
    $("#new-profile-name").disabled=state.profiles.length>=5;
    $$("#new-profile-form button").forEach(b=>b.disabled=state.profiles.length>=5);
  }
  function renderCommunity(){
    const root=$("#review-items");root.replaceChildren();
    if(!state.reviews.length)empty(root,"Chưa có đánh giá","Đánh giá đầu tiên của bạn sẽ được giữ riêng để kiểm duyệt.");
    else state.reviews.forEach(x=>{
      const box=make("article","review-item");
      box.append(make("strong","",(byId.get(x.film_id)?.title||x.film_id)+" · "+x.rating+" sao"),
        make("p","",x.content),make("span","muted small",x.moderation_status==="approved"?"Đã duyệt":x.moderation_status==="rejected"?"Không được duyệt":"Chờ kiểm duyệt"));
      root.append(box);
    });
    const publicFeed=$("#approved-review-items");
    if(publicFeed){
      publicFeed.replaceChildren();
      if(!state.approved.length)empty(publicFeed,"Chưa có đánh giá được duyệt","Đánh giá đang chờ quản trị viên kiểm duyệt.");
      else state.approved.slice(0,40).forEach(r=>{
        const box=make("article","review-item");
        box.append(make("strong","",(byId.get(r.film_id)?.title||r.film_id)+" · "+r.rating+" sao"),
          make("p","",r.content));
        publicFeed.append(box);
      });
    }
    const badges=[
      ["★","Bước đầu sưu tầm",state.library.some(x=>x.collection==="favorite"),"Lưu ít nhất một phim yêu thích"],
      ["♧","Người khám phá",state.library.some(x=>x.collection==="watchlist"),"Thêm phim vào danh sách xem sau"],
      ["✎","Người đóng góp",state.reviews.length>0,"Gửi đánh giá đầu tiên"],
      ["▶","Khán giả thực thụ",state.progress.some(x=>x.position_seconds>0),"Xem một video thật và cho phép lưu tiến độ"]
    ];
    const target=$("#achievement-items");target.replaceChildren();
    badges.forEach(([symbol,title,unlocked,hint])=>{
      const line=make("div","badge-item");
      line.append(make("span","badge-symbol",symbol),make("span","",title+" — "+(unlocked?"Đã đạt":"Chưa đạt")));
      line.title=hint;target.append(line);
    });
  }
  function renderInbox(){
    const root=$("#inbox-items");root.replaceChildren();
    if(!state.inbox.length){empty(root,"Chưa có thông báo","Thông báo về tập mới sẽ xuất hiện khi có phim được phát hành thật.");return;}
    state.inbox.forEach(x=>{
      const line=make("article","notice-item");
      line.append(make("strong","",x.title),make("p","",x.body||""));
      const date=make("span","muted small",new Date(x.created_at).toLocaleDateString("vi-VN"));line.append(date);
      if(!x.read_at){const btn=make("button","text-btn","Đánh dấu đã đọc");btn.dataset.readNotification=x.id;line.append(btn);}
      root.append(line);
    });
  }
  function renderPrefs(){
    const p=state.prefs||{locale:"vi",genres:[],personalization_enabled:false,watch_tracking_enabled:false,notify_followed_releases:false};
    $("#pref-locale").value=p.locale||"vi";
    $("#pref-personalize").checked=!!p.personalization_enabled;
    $("#pref-track").checked=!!p.watch_tracking_enabled;
    $("#pref-release-alert").checked=!!p.notify_followed_releases;
    $$("#pref-genres input").forEach(e=>e.checked=(p.genres||[]).includes(e.value));
  }
  function renderAll(){
    $("#hero-name").textContent=state.profile.nickname;
    $("#hero-avatar").textContent=state.profile.nickname.trim().slice(0,1).toUpperCase();
    renderOverview();renderLibrary();renderDiscover();renderProfiles();renderCommunity();renderInbox();renderPrefs();
  }
  async function selectProfile(id){
    const p=state.profiles.find(x=>x.id===id);if(!p)return;
    setActiveProfile(p);await loadSelected();announce("Đã chuyển sang hồ sơ "+p.nickname);
  }
  function setTab(name){
    if(!["overview","library","discover","community","profiles","inbox","settings"].includes(name))return;
    state.tab=name;$$("[data-panel]").forEach(p=>p.hidden=p.dataset.panel!==name);
    $$("[data-tab]").forEach(b=>{const active=b.dataset.tab===name;b.classList.toggle("active",active);if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});
    if(window.location.hash!=="#"+name)window.history.replaceState(window.history.state,"","#"+name);
    clearToast();
  }
  function initStaticSelects(){
    const genres=[...new Set(FILMS.flatMap(f=>f.genres||[]))].sort();
    genres.forEach(g=>{
      $("#genre-filter").add(new Option(g,g));
      const l=make("label");const input=make("input");input.type="checkbox";input.value=g;l.append(input,document.createTextNode(g));$("#pref-genres").append(l);
    });
    FILMS.forEach(f=>$("#review-film").add(new Option(f.title,f.id)));
  }
  document.addEventListener("click",async e=>{
    const tab=e.target.closest("[data-tab],[data-tab-go]");
    if(tab){setTab(tab.dataset.tab||tab.dataset.tabGo);return;}
    const collection=e.target.closest("[data-collection-filter]");
    if(collection){state.collection=collection.dataset.collectionFilter;renderLibrary();return;}
    const pick=e.target.closest("[data-pick-profile]");
    if(pick){try{await selectProfile(pick.dataset.pickProfile);}catch(err){announce(errorText(),true);}return;}
    const remove=e.target.closest("[data-delete-profile]");
    if(remove){
      const id=remove.dataset.deleteProfile;
      if(!state.profiles.some(p=>p.id===id)||id===state.profile.id||state.profiles.length<=1)return;
      if(!window.confirm("Xóa hồ sơ xem này và toàn bộ dữ liệu riêng của hồ sơ? Thao tác không thể hoàn tác."))return;
      remove.disabled=true;
      try{
        const {error}=await client.from("viewer_profiles").delete().eq("id",id).eq("user_id",state.user.id);
        if(error)throw error;
        await ensureProfiles();await loadSelected();announce("Đã xóa hồ sơ phụ và dữ liệu liên quan.");
      }catch(_){remove.disabled=false;announce(errorText(),true);}
      return;
    }
    const act=e.target.closest("[data-film][data-action]");
    if(act){
      if(state.busy)return;
      const film=act.dataset.film,collection=act.dataset.action;
      if(!byId.has(film)||!FILMS.some(f=>f.id===film))return;
      const filter={viewer_profile_id:state.profile.id,film_id:film,collection};
      state.busy=true;act.disabled=true;
      try{
        if(has(film,collection)){
          let q=client.from("film_library").delete();
          Object.entries(filter).forEach(([k,v])=>q=q.eq(k,v));
          const {error}=await q;if(error)throw error;
        }else{
          const {error}=await client.from("film_library").insert({...filter,user_id:state.user.id,site_id:SITE});
          if(error)throw error;
        }
        await loadSelected();announce("Đã cập nhật tủ phim.");
      }catch(err){announce(errorText(),true);}
      finally{state.busy=false;}
      return;
    }
    const mark=e.target.closest("[data-read-notification]");
    if(mark){
      const {error}=await client.from("member_notifications").update({read_at:new Date().toISOString()})
        .eq("id",mark.dataset.readNotification).eq("user_id",state.user.id);
      if(error)announce(errorText(),true);else{await loadSelected();announce("Đã đánh dấu thông báo.");}
    }
  });
  $("#profile-select").addEventListener("change",async e=>{
    try{await selectProfile(e.target.value);}catch(_){announce(errorText(),true);}
  });
  $("#genre-filter").addEventListener("change",e=>{state.genre=e.target.value;renderDiscover();});
  $("#new-profile-form").addEventListener("submit",async e=>{
    e.preventDefault();const input=$("#new-profile-name");const name=input.value.trim();
    if(name.length<2||name.length>40||state.profiles.length>=5){announce("Tên hồ sơ cần 2–40 ký tự và tối đa 5 hồ sơ.",true);return;}
    const btn=e.target.querySelector("button");btn.disabled=true;
    try{
      const {error}=await client.from("viewer_profiles").insert({user_id:state.user.id,site_id:SITE,nickname:name});
      if(error)throw error;
      await ensureProfiles();await loadSelected();input.value="";announce("Đã thêm hồ sơ xem.");
    }catch(_){announce(errorText(),true);}finally{btn.disabled=false;}
  });
  $("#preferences-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const selected=$$("#pref-genres input:checked").map(n=>n.value);
    const payload={viewer_profile_id:state.profile.id,user_id:state.user.id,site_id:SITE,
      locale:$("#pref-locale").value,genres:selected,
      personalization_enabled:$("#pref-personalize").checked,
      watch_tracking_enabled:$("#pref-track").checked,
      notify_followed_releases:$("#pref-release-alert").checked,updated_at:new Date().toISOString()};
    const btn=e.target.querySelector('button[type="submit"]');btn.disabled=true;
    try{
      const {error}=await client.from("viewer_preferences").upsert(payload,{onConflict:"viewer_profile_id"});
      if(error)throw error;
      await loadSelected();announce("Đã lưu tùy chỉnh riêng cho hồ sơ này.");
    }catch(_){announce(errorText(),true);}finally{btn.disabled=false;}
  });
  $("#review-form").addEventListener("submit",async e=>{
    e.preventDefault();const film=$("#review-film").value;
    const content=$("#review-content").value.trim();
    if(!FILMS.some(f=>f.id===film)||content.length<10||content.length>1200){announce("Hãy nhập nhận xét 10–1200 ký tự.",true);return;}
    if(state.reviews.some(r=>r.film_id===film)){announce("Hồ sơ này đã gửi đánh giá cho phim đó.",true);return;}
    const btn=e.target.querySelector('button[type="submit"]');btn.disabled=true;
    try{
      const {error}=await client.from("film_reviews").insert({viewer_profile_id:state.profile.id,
        user_id:state.user.id,site_id:SITE,film_id:film,rating:Number($("#review-rating").value),
        content,moderation_status:"pending"});
      if(error)throw error;
      e.target.reset();await loadSelected();announce("Đánh giá đã được gửi, đang chờ kiểm duyệt.");
    }catch(_){announce(errorText(),true);}finally{btn.disabled=false;}
  });
  $("#erase-progress").addEventListener("click",async()=>{
    if(!window.confirm("Xóa toàn bộ lịch sử xem của hồ sơ này? Thao tác không thể hoàn tác."))return;
    const {error}=await client.from("watch_progress").delete().eq("viewer_profile_id",state.profile.id).eq("user_id",state.user.id);
    if(error)announce(errorText(),true);else{await loadSelected();announce("Đã xóa tiến độ xem của hồ sơ.");}
  });
  $("#export-data").addEventListener("click",async function(){
    this.disabled=true;
    try{
      const owned=["profiles","site_memberships","viewer_profiles","viewer_preferences","film_library","watch_progress","film_reviews","member_notifications"];
      const exports={exported_at:new Date().toISOString(),source:"AI Film Network",viewer_account:state.user.email||"",data:{}};
      for(const table of owned){
        const key=table==="profiles"?"id":"user_id";
        exports.data[table]=await getRows(table,{[key]:state.user.id});
      }
      const payload=new Blob([JSON.stringify(exports,null,2)],{type:"application/json;charset=utf-8"});
      const link=document.createElement("a");
      const url=URL.createObjectURL(payload);
      link.href=url;link.download="ai-film-network-my-data.json";
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      announce("Đã chuẩn bị tệp dữ liệu cá nhân trên thiết bị của bạn.");
    }catch(_){announce("Chưa thể xuất dữ liệu. Vui lòng thử lại.",true);}
    finally{this.disabled=false;}
  });
  // Load releases after Supabase's network response; never mix live films between sites.
  window.addEventListener("afn-catalog-updated",function(event){
    if(event.detail?.site_id!==SITE)return;
    const incoming=(window.FILMS||[]).filter(f=>f.live&&f.sites?.includes(SITE));
    incoming.forEach(f=>{
      byId.set(f.id,f);
      const index=FILMS.findIndex(x=>x.id===f.id);
      if(index>=0)FILMS[index]=f;else FILMS.push(f);
      if(!Array.from($("#review-film").options).some(opt=>opt.value===f.id))
        $("#review-film").add(new Option(f.title,f.id));
      (f.genres||[]).forEach(g=>{
        if(!Array.from($("#genre-filter").options).some(opt=>opt.value===g)){
          $("#genre-filter").add(new Option(g,g));
          const wrap=make("label");const input=make("input");
          input.type="checkbox";input.value=g;
          wrap.append(input,document.createTextNode(g));$("#pref-genres").append(wrap);
        }
      });
    });
    if(state.profile)renderAll();
  });
  initStaticSelects();
  try{
    const resp=await client.auth.getUser();
    if(resp.error||!resp.data?.user){show("guest");return;}
    state.user=resp.data.user;
    await ensureProfiles();
    await loadSelected();
    show("app");
    setTab(window.location.hash.slice(1)||"overview");
    client.auth.onAuthStateChange((event)=>{
      if(event==="SIGNED_OUT")queueMicrotask(()=>show("guest"));
    });
  }catch(err){
    show("guest");
    $("#hub-guest h1").textContent="Không thể tải Trung tâm thành viên";
    $("#hub-guest p").textContent="Có thể do kết nối hoặc quyền truy cập dữ liệu. Bạn hãy quay lại sau hoặc mở lại website.";
  }
})();
