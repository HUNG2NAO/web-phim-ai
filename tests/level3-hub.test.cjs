// Simulated Supabase browser tests for Xưởng Phim Level 3. No live emails/users.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const pause=()=>new Promise(r=>setTimeout(r,75));
function mockDb(){
  const records=new Map();
  let counter=1;
  const find=t=>{if(!records.has(t))records.set(t,[]);return records.get(t)};
  return {records,from(table){
    let act="select", filters=[], payload=null;
    const q={
      select(){return q;},
      eq(k,v){filters.push([k,v]);return q;},
      insert(v){act="insert";payload=v;return q;},
      delete(){act="delete";return q;},
      upsert(v){act="upsert";payload=v;return q;},
      update(v){act="update";payload=v;return q;},
      then(ok,fail){
        const arr=find(table);
        const matching=x=>filters.every(([k,v])=>x[k]===v);
        let rows=arr.filter(matching);
        if(act==="select")return Promise.resolve({data:rows.map(x=>({...x})),error:null}).then(ok,fail);
        if(act==="insert"){
          const list=Array.isArray(payload)?payload:[payload];
          list.forEach(v=>arr.push({...v,id:v.id||("00000000-0000-4000-8000-"+String(counter++).padStart(12,"0")),created_at:new Date().toISOString()}));
          return Promise.resolve({data:list,error:null}).then(ok,fail);
        }
        if(act==="delete"){
          for(let i=arr.length-1;i>=0;i--)if(matching(arr[i]))arr.splice(i,1);
          return Promise.resolve({data:[],error:null}).then(ok,fail);
        }
        if(act==="upsert"){
          const key="viewer_profile_id";
          const index=arr.findIndex(x=>x[key]===payload[key]);
          if(index>=0)arr[index]={...arr[index],...payload};else arr.push({...payload});
          return Promise.resolve({data:payload,error:null}).then(ok,fail);
        }
        if(act==="update"){arr.filter(matching).forEach(x=>Object.assign(x,payload));return Promise.resolve({data:rows,error:null}).then(ok,fail);}
      }
    };
    return q;
  }};
}
async function boot(url){
  const dom=new JSDOM(read("member.html"),{url,runScripts:"outside-only",pretendToBeVisual:true});
  const w=dom.window;const db=mockDb();
  w.AFN_AUTH_CONFIG={enabled:true,url:"https://tests.supabase.co",publishableKey:"sb_publishable_testingonly12345678",storageKey:"tests"};
  const user={id:"00000000-0000-4000-8000-000000000099",email:"viewer@example.com",user_metadata:{display_name:"Test viewer"}};
  w.supabase={createClient:()=>({from:db.from,auth:{async getUser(){return {data:{user},error:null}},onAuthStateChange(){}}})};
  ["sites.js","films.js","films-tuong-lai.js"].forEach(s=>w.eval(read("assets/"+s)));
  w.eval(read("assets/level3.js"));
  await pause();
  return {w,dom,db,q:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)],close:()=>dom.window.close()};
}
test("pilot member hub initializes a viewer profile without invented progress",async()=>{
 const a=await boot("https://feature-auth-first-pilot-202.web-phim-ai-5sites.pages.dev/member.html?site=xuongphim");
 try{
  assert.equal(a.q("#hub-app").hidden,false);
  assert.equal(a.db.records.get("viewer_profiles").length,1);
  assert.equal(a.q("#stat-favorites").textContent,"0");
  assert.equal(a.q("#stat-progress").textContent,"0");
  assert.match(a.q("#continue-items").textContent,/Chưa có phim đang xem/);
 }finally{a.close();}
});
test("switching tabs and saving favorite film uses per-profile database rows",async()=>{
 const a=await boot("https://feature-auth-first-pilot-202.web-phim-ai-5sites.pages.dev/member.html?site=xuongphim");
 try{
  a.q('[data-tab="discover"]').click();
  assert.equal(a.q("#tab-discover").hidden,false);
  const btn=a.q('#discover-items [data-action="favorite"]');
  assert(btn);btn.click();await pause();
  assert.equal(a.db.records.get("film_library").length,1);
  assert.equal(a.q("#stat-favorites").textContent,"1");
  a.q('#discover-items [data-action="favorite"]').click();await pause();
  assert.equal(a.db.records.get("film_library").length,0);
 }finally{a.close();}
});
test("privacy settings default off and can be saved per viewer",async()=>{
 const a=await boot("https://feature-auth-first-pilot-202.web-phim-ai-5sites.pages.dev/member.html?site=xuongphim");
 try{
  assert.equal(a.q("#pref-track").checked,false);
  assert.equal(a.q("#pref-personalize").checked,false);
  a.q("#pref-personalize").checked=true;
  a.q("#preferences-form").dispatchEvent(new a.w.Event("submit",{bubbles:true,cancelable:true}));await pause();
  const p=a.db.records.get("viewer_preferences")[0];
  assert.equal(p.personalization_enabled,true);
  assert.equal(p.watch_tracking_enabled,false);
 }finally{a.close();}
});
test("multiple profiles split libraries and do not cross-contaminate data",async()=>{
 const a=await boot("https://feature-auth-first-pilot-202.web-phim-ai-5sites.pages.dev/member.html?site=xuongphim");
 try{
  a.q('#discover-items [data-action="favorite"]').click();await pause();
  a.q("#new-profile-name").value="Second viewer";
  a.q("#new-profile-form").dispatchEvent(new a.w.Event("submit",{bubbles:true,cancelable:true}));await pause();
  assert.equal(a.db.records.get("viewer_profiles").length,2);
  const second=a.db.records.get("viewer_profiles")[1].id;
  a.q("#profile-select").value=second;
  a.q("#profile-select").dispatchEvent(new a.w.Event("change",{bubbles:true}));await pause();
  assert.equal(a.q("#stat-favorites").textContent,"0");
 }finally{a.close();}
});
test("review submissions stay pending rather than public",async()=>{
 const a=await boot("https://feature-auth-first-pilot-202.web-phim-ai-5sites.pages.dev/member.html?site=xuongphim");
 try{
  a.q("#review-content").value="Một bộ phim có ý tưởng rất thú vị.";
  a.q("#review-form").dispatchEvent(new a.w.Event("submit",{bubbles:true,cancelable:true}));await pause();
  const reviews=a.db.records.get("film_reviews");
  assert.equal(reviews.length,1);
  assert.equal(reviews[0].moderation_status,"pending");
  assert.match(a.q("#review-items").textContent,/Chờ kiểm duyệt/);
 }finally{a.close();}
});
test("other four brands are gated until pilot acceptance",async()=>{
 const a=await boot("https://feature-auth-first-pilot-202.web-phim-ai-5sites.pages.dev/member.html?site=khophim");
 try{
  assert.equal(a.q("#hub-guest").hidden,false);
  assert.equal(a.q("#hub-app").hidden,true);
  assert.equal(a.db.records.size,0);
 }finally{a.close();}
});
