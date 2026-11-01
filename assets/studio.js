/* AI Film Network staff console: all authorization lives in Supabase RLS. */
(async()=>{
"use strict";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const element=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x;};
const button=(text,key,value)=>{const b=element("button",text);b.type="button";b.dataset[key]=value;return b;};
const cfg=window.AFN_AUTH_CONFIG||{},brandData=window.SITES||[];
const screen=name=>["loading","denied","app"].forEach(x=>$("#studio-"+x).hidden=x!==name);
const message=(s,err)=>{const el=$("#studio-status");el.textContent=s;el.style.color=err?"#f8b2b5":"var(--cyan)";};
if(!cfg.enabled||!window.supabase?.createClient){screen("denied");return;}
const db=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce",storageKey:cfg.storageKey||"afn-film-auth-v1"}});
let owner=null,roles=[],isNetworkOwner=false,site="xuongphim",films=[],reviews=[],requests=[],members=[];
async function get(table,filters={}){
 let q=db.from(table).select("*");
 for(const [k,v] of Object.entries(filters))q=q.eq(k,v);
 const {data,error}=await q;if(error)throw error;return data||[];
}
const role=()=>roles.find(x=>x.site_id===site)?.role;
const PRIVACY_TYPE={delete_account:"Yêu cầu xóa tài khoản",data_export:"Yêu cầu xuất dữ liệu",delete_activity:"Yêu cầu xóa lịch sử hoạt động"};
const PRIVACY_STATUS={pending:"Chờ xử lý",in_review:"Đang xử lý",completed:"Đã hoàn tất",rejected:"Đã từ chối"};
const PRIVACY_ERR={forbidden:"Bạn không có quyền với yêu cầu của website này.",invalid_transition:"Trạng thái đã thay đổi, hãy tải lại.",note_required:"Cần ghi lý do từ chối (ít nhất 5 ký tự).",
 use_account_deletion:"Yêu cầu xóa tài khoản chỉ hoàn tất khi chủ mạng thực hiện xóa.",email_mismatch:"Email nhập không khớp tài khoản — chưa xóa gì.",target_is_staff:"Tài khoản đang có quyền quản trị: gỡ quyền trước khi xóa.",
 cannot_delete_owner:"Không thể xóa tài khoản chủ mạng.",mfa_required:"Xóa tài khoản thật cần phiên đã xác thực 2 lớp. Mở thẻ Bảo mật để bật 2FA hoặc nhập mã.",invalid_state:"Yêu cầu phải ở trạng thái Đang xử lý.",already_deleted:"Tài khoản đã được xóa trước đó."};
const privacyError=e=>{const m=String(e&&e.message||"");const k=Object.keys(PRIVACY_ERR).find(x=>m.includes(x));return k?PRIVACY_ERR[k]:"Không thể cập nhật. Kiểm tra quyền truy cập.";};
function empty(node,text){node.replaceChildren(element("p",text,"muted"));}
function cards(){
 const out=$("#studio-films");out.replaceChildren();
 if(!films.length)empty(out,"Chưa có phim đã khai báo.");
 films.forEach(f=>{
  const a=element("article",undefined,"studio-item");
  a.append(element("h3",f.title),element("p",f.film_id+" · "+f.source_kind+" · "+(f.published?"Công khai":"Bản nháp"),"muted"));
  const actions=element("div",undefined,"actions");
  actions.append(button(f.published?"Gỡ công khai":"Phát hành","filmToggle",f.id),button("Xóa metadata","filmDelete",f.id));
  a.append(actions);out.append(a);
 });
 const queue=$("#studio-reviews");queue.replaceChildren();
 const pending=reviews.filter(x=>x.moderation_status==="pending");
 if(!pending.length)empty(queue,"Không có đánh giá cần duyệt.");
 pending.forEach(r=>{
  const a=element("article",undefined,"studio-item");
  a.append(element("h3",r.film_id+" · "+r.rating+" sao"),element("blockquote",r.content));
  const acts=element("div",undefined,"actions");
  acts.append(button("Duyệt","reviewAction",r.id+"|approved"),button("Từ chối","reviewAction",r.id+"|rejected"));
  a.append(acts);queue.append(a);
 });
 const list=$("#studio-privacy");list.replaceChildren();
 const visible=requests.slice().sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at)));
 if(!visible.length)empty(list,"Chưa có yêu cầu nào.");
 visible.forEach(r=>{
  const a=element("article",undefined,"studio-item");
  const who=r.user_id?("Thành viên #"+String(r.subject_id||r.user_id).slice(0,8)):("Tài khoản đã xóa #"+String(r.subject_id||"").slice(0,8));
  a.append(element("h3",PRIVACY_TYPE[r.request_type]||r.request_type),
   element("p",who+" · Gửi "+new Date(r.submitted_at).toLocaleString("vi-VN")+" · Trạng thái: "+(PRIVACY_STATUS[r.status]||r.status),"muted"));
  if(r.admin_note)a.append(element("p","Ghi chú: "+r.admin_note,"muted"));
  const actions=element("div",undefined,"actions");
  if(role()==="admin"||isNetworkOwner){
   if(r.status==="pending")actions.append(button("Nhận xử lý","privacyAction",r.id+"|in_review"),button("Từ chối","privacyAction",r.id+"|rejected"));
   if(r.status==="in_review"&&r.request_type!=="delete_account")actions.append(button("Đã xử lý xong","privacyAction",r.id+"|completed"),button("Từ chối","privacyAction",r.id+"|rejected"));
   if(r.status==="in_review"&&r.request_type==="delete_account"){
    if(isNetworkOwner)actions.append(button("Xem trước dữ liệu sẽ xóa","privacyPreview",r.id),button("Xóa tài khoản vĩnh viễn","privacyDelete",r.id),button("Từ chối","privacyAction",r.id+"|rejected"));
    else{actions.append(button("Từ chối","privacyAction",r.id+"|rejected"));a.append(element("p","Chỉ chủ mạng thực hiện xóa tài khoản (ví điểm dùng chung toàn mạng).","muted"));}
   }
  }
  const out=element("p","","muted privacy-preview");out.hidden=true;a.append(actions,out);list.append(a);
 });
 $("#studio-recipients").textContent="Có "+members.length+" thành viên đã tham gia website này.";
 $("#studio-send").disabled=role()!=="admin"||members.length===0;
}
async function refresh(){
 message("Đang tải…");
 [films,reviews,requests,members]=await Promise.all([
  get("site_films",{site_id:site}),get("film_reviews",{site_id:site}),
  get("member_privacy_requests",{site_id:site}),get("site_memberships",{site_id:site})
 ]);
 cards();message("Đã tải dữ liệu.");
}
function setLinks(){
 const brand=brandData.find(b=>b.id===site);
 if(brand){
   document.documentElement.dataset.site=site;
   document.documentElement.dataset.world=brand.world||"co-trang";
   document.documentElement.style.setProperty("--cyan",brand.accent);
   document.documentElement.style.setProperty("--cyan-txt",brand.onAccent);
   document.title="Quản trị nội dung — "+brand.name;
 }
 $("#studio-home").href="./?site="+site;
 $("#studio-return").href="./?site="+site;
 $("#studio-member").href="./member.html?site="+site;
}
try{
 const {data,error}=await db.auth.getUser();if(error)throw error;owner=data?.user;
 if(!owner){screen("denied");$("#studio-denied-reason").textContent="Vui lòng đăng nhập ở trang chủ.";return;}
 // Level 4.6: tài khoản đã bật 2FA → nhập mã (nâng phiên lên AAL2) TRƯỚC khi tải dữ liệu quản trị.
 if(window.AFN_MFA){try{await window.AFN_MFA.gate(db);}catch(_){}}
 roles=await get("site_staff",{user_id:owner.id});
 try{isNetworkOwner=(await get("network_staff",{user_id:owner.id})).length>0;}catch(_){isNetworkOwner=false;}
 if(!roles.length){screen("denied");$("#studio-denied-reason").textContent="Bạn chưa được cấp quyền quản trị.";return;}
 roles.forEach(x=>{$("#studio-site").add(new Option(brandData.find(b=>b.id===x.site_id)?.name||x.site_id,x.site_id));});
 const wanted=new URLSearchParams(location.search).get("site");
 site=roles.some(x=>x.site_id===wanted)?wanted:(roles.some(x=>x.site_id==="xuongphim")?"xuongphim":roles[0].site_id);
 $("#studio-site").value=site;setLinks();screen("app");
 if(window.AFN_MFA)window.AFN_MFA.render(db).catch(()=>{});
 await refresh();
 if(wanted&&wanted!==site){const n=id=>brandData.find(b=>b.id===id)?.name||id;message("Bạn không có quyền quản trị "+n(wanted)+". Đang hiển thị "+n(site)+".",true);}
}catch(_){screen("denied");$("#studio-denied-reason").textContent="Không thể kiểm tra quyền hoặc tải dữ liệu.";return;}
$("#studio-site").addEventListener("change",async e=>{site=e.target.value;setLinks();try{await refresh();}catch(_){message("Không thể tải dữ liệu.",true);}});
$("#studio-reload").addEventListener("click",async()=>{try{await refresh();}catch(_){message("Tải lại thất bại.",true);}});
$$("[data-studio-tab]").forEach(b=>b.addEventListener("click",()=>{
 $$("[data-studio-panel]").forEach(p=>p.hidden=p.dataset.studioPanel!==b.dataset.studioTab);
 $$("[data-studio-tab]").forEach(t=>t.classList.toggle("selected",t===b));
}));
$("#studio-film-form").addEventListener("submit",async e=>{
 e.preventDefault();
 if(role()!=="admin"){message("Bạn không có quyền phát hành.",true);return;}
 const id=$("#studio-film-id").value.trim(),title=$("#studio-film-title").value.trim();
 const source=$("#studio-film-source").value,val=$("#studio-film-video").value.trim();
 if(!/^[a-z0-9][a-z0-9-]{0,119}$/.test(id)||title.length<2||title.length>160){message("Mã hoặc tên phim không hợp lệ.",true);return;}
 if(source==="youtube"&&!/^[A-Za-z0-9_-]{11}$/.test(val)){message("YouTube ID phải có 11 ký tự.",true);return;}
 if(source==="native"&&(!/^https:\/\/\S+$/.test(val))){message("Yêu cầu URL video HTTPS.",true);return;}
 if(!$("#studio-rights").checked){message("Bạn phải có quyền phát hành hợp pháp.",true);return;}
 const payload={site_id:site,film_id:id,title,synopsis:$("#studio-film-synopsis").value.trim(),
  genres:$("#studio-film-genres").value.split(",").map(x=>x.trim()).filter(Boolean).slice(0,12),
  film_type:$("#studio-film-type").value,year:new Date().getFullYear(),
  source_kind:source,youtube_id:source==="youtube"?val:null,video_url:source==="native"?val:null,
  rights_attested:true,published:$("#studio-published").checked,created_by:owner.id};
 const btn=$("#studio-save-film");btn.disabled=true;
 try{const {error}=await db.from("site_films").insert(payload);if(error)throw error; e.target.reset();await refresh();message("Đã lưu phim.");}
 catch(_){message("Lỗi: có thể mã đã trùng hoặc không đủ quyền.",true);}finally{btn.disabled=false;}
});
$("#studio-app").addEventListener("click",async e=>{
 const b=e.target.closest("button");if(!b)return;
 let action=b.dataset.filmToggle||b.dataset.filmDelete||b.dataset.reviewAction||b.dataset.privacyAction||b.dataset.privacyPreview||b.dataset.privacyDelete;
 if(!action)return;b.disabled=true;
 try{
  let response;
  if(b.dataset.filmToggle){
   const f=films.find(x=>x.id===action);
   if(!f||(!f.rights_attested&&!f.published)){message("Chưa xác nhận bản quyền.",true);return;}
   response=await db.from("site_films").update({published:!f.published,updated_at:new Date().toISOString()}).eq("id",f.id).eq("site_id",site);
  }else if(b.dataset.filmDelete){
   if(!confirm("Xóa metadata phim này?"))return;
   response=await db.from("site_films").delete().eq("id",action).eq("site_id",site);
  }else if(b.dataset.reviewAction){
   const [id,status]=action.split("|");
   response=await db.from("film_reviews").update({moderation_status:status}).eq("id",id).eq("site_id",site);
  }else if(b.dataset.privacyAction){
   const [id,status]=action.split("|");
   let note="";
   if(status==="rejected"){note=(prompt("Lý do từ chối (thành viên sẽ thấy ghi chú này):")||"").trim();if(note.length<5){message(PRIVACY_ERR.note_required,true);return;}}
   response=await db.rpc("admin_privacy_request_set_status",{p_id:id,p_status:status,p_note:note});
   if(response.error){message(privacyError(response.error),true);return;}
  }else if(b.dataset.privacyPreview||b.dataset.privacyDelete){
   const id=b.dataset.privacyPreview||b.dataset.privacyDelete,box=b.closest("article").querySelector(".privacy-preview");
   const pre=await db.rpc("admin_execute_account_deletion",{p_request_id:id,p_confirm_email:"",p_dry_run:true});
   if(pre.error){message(privacyError(pre.error),true);return;}
   const c=pre.data.counts||{};
   box.hidden=false;box.textContent="Tài khoản "+pre.data.email_hint+" — sẽ xóa: "+c.chat_messages+" tin nhắn, "+c.wallet_ledger+" giao dịch điểm, "+c.daily_checkins+" lượt điểm danh, "+c.content_entitlements+" tập đã mở, "+c.viewer_profiles+" hồ sơ người xem, "+c.film_reviews+" đánh giá. Bản ghi yêu cầu được giữ ở dạng bút danh.";
   if(b.dataset.privacyPreview){message("Đã tải bản xem trước. Chưa xóa gì.");return;}
   const typed=(prompt("Xóa VĨNH VIỄN tài khoản "+pre.data.email_hint+" và toàn bộ dữ liệu liên quan trên cả mạng lưới.\nGõ đầy đủ email của tài khoản để xác nhận:")||"").trim();
   if(!typed){message("Đã hủy. Chưa xóa gì.");return;}
   response=await db.rpc("admin_execute_account_deletion",{p_request_id:id,p_confirm_email:typed,p_dry_run:false});
   if(response.error){message(privacyError(response.error),true);return;}
  }
  if(response.error)throw response.error;
  await refresh();message("Đã cập nhật.");
 }catch(_){message("Không thể cập nhật. Kiểm tra quyền truy cập.",true);}finally{b.disabled=false;}
});
$("#studio-notice-form").addEventListener("submit",async e=>{
 e.preventDefault();if(role()!=="admin"){message("Cần quyền admin.",true);return;}
 const title=$("#studio-notice-title").value.trim(),body=$("#studio-notice-body").value.trim();
 const users=[...new Set(members.map(x=>x.user_id))];
 if(!title||title.length>150||body.length>1500||users.length<1||users.length>100){message("Dữ liệu không hợp lệ hoặc vượt 100 người nhận.",true);return;}
 if(!confirm("Gửi thông báo trong website cho "+users.length+" thành viên?"))return;
 const btn=$("#studio-send");btn.disabled=true;
 try{const {error}=await db.from("member_notifications").insert(users.map(user_id=>({user_id,site_id:site,title,body})));if(error)throw error;e.target.reset();message("Đã gửi "+users.length+" thông báo.");}
 catch(_){message("Gửi thông báo không thành công.",true);}finally{btn.disabled=false;}
});
})();