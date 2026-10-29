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
let owner=null,roles=[],site="xuongphim",films=[],reviews=[],requests=[],members=[];
async function get(table,filters={}){
 let q=db.from(table).select("*");
 for(const [k,v] of Object.entries(filters))q=q.eq(k,v);
 const {data,error}=await q;if(error)throw error;return data||[];
}
const role=()=>roles.find(x=>x.site_id===site)?.role;
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
 if(!requests.length)empty(list,"Chưa có yêu cầu nào.");
 requests.forEach(r=>{
  const a=element("article",undefined,"studio-item");
  a.append(element("h3",r.request_type),element("p","Người yêu cầu: "+r.user_id+" · Trạng thái: "+r.status,"muted"));
  const actions=element("div",undefined,"actions");
  if(r.status==="pending")actions.append(button("Nhận xử lý","privacyAction",r.id+"|in_review"));
  if(r.status==="in_review"&&r.request_type!=="delete_account")actions.append(button("Đã xử lý","privacyAction",r.id+"|completed"));
  if(r.request_type==="delete_account")a.append(element("p","Không tự động xóa tài khoản. Chỉ quản trị viên mới thực hiện xóa trong Supabase sau khi xác minh danh tính.","muted"));
  a.append(actions);list.append(a);
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
 $("#studio-home").href="./?site="+site;
 $("#studio-return").href="./?site="+site;
 $("#studio-member").href="./member.html?site="+site;
}
try{
 const {data,error}=await db.auth.getUser();if(error)throw error;owner=data?.user;
 if(!owner){screen("denied");$("#studio-denied-reason").textContent="Vui lòng đăng nhập ở trang chủ.";return;}
 roles=await get("site_staff",{user_id:owner.id});
 if(!roles.length){screen("denied");$("#studio-denied-reason").textContent="Bạn chưa được cấp quyền quản trị.";return;}
 roles.forEach(x=>{$("#studio-site").add(new Option(brandData.find(b=>b.id===x.site_id)?.name||x.site_id,x.site_id));});
 site=roles.some(x=>x.site_id==="xuongphim")?"xuongphim":roles[0].site_id;
 $("#studio-site").value=site;setLinks();screen("app");await refresh();
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
 let action=b.dataset.filmToggle||b.dataset.filmDelete||b.dataset.reviewAction||b.dataset.privacyAction;
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
   if(role()!=="admin")throw Error("admin required");
   response=await db.from("member_privacy_requests").update({status,handled_at:status==="completed"?new Date().toISOString():null}).eq("id",id).eq("site_id",site);
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