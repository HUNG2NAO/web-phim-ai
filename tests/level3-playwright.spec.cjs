const { test, expect } = require("@playwright/test");
const BASE = "https://feature-level3-xuongphim-pil.web-phim-ai-5sites.pages.dev";
function installMock() {
  var user=window.__AFN_GUEST?null:{id:"00000000-0000-4000-8000-000000000099",email:"test-viewer@example.test",created_at:"2026-10-28T16:00:00Z",email_confirmed_at:"2026-10-28T16:02:00Z",user_metadata:{display_name:"Khán giả kiểm thử"},app_metadata:{providers:["email"]}};
  var key="__AFN_E2E_ROWS",memory={},next=0;
  try{memory=JSON.parse(localStorage.getItem(key)||"{}");}catch(_){}
  function persist(){try{localStorage.setItem(key,JSON.stringify(memory));}catch(_){}}
  function list(t){return memory[t]||(memory[t]=[]);}
  function table(t){
    var filters=[],op="select",body=null;
    function matching(x){return filters.every(p=>x[p[0]]===p[1]);}
    const q={
      select(){return q;},eq(k,v){filters.push([k,v]);return q;},
      insert(x){op="insert";body=x;return q;},
      delete(){op="delete";return q;},
      update(x){op="update";body=x;return q;},
      upsert(x){op="upsert";body=x;return q;},
      maybeSingle(){return Promise.resolve({data:list(t).find(matching)||null,error:null});},
      then(done,fail){
        var all=list(t),data=[];
        if(op==="select")data=all.filter(matching).map(x=>({...x}));
        if(op==="insert"){
          (Array.isArray(body)?body:[body]).forEach(x=>all.push({...x,id:x.id||("00000000-0000-4000-8000-"+String(++next).padStart(12,"0")),created_at:new Date().toISOString()}));
          data=[body];persist();
        }
        if(op==="delete"){for(var i=all.length-1;i>=0;i--)if(matching(all[i]))all.splice(i,1);persist();}
        if(op==="upsert"){const i=all.findIndex(x=>x.viewer_profile_id===body.viewer_profile_id);if(i>=0)all[i]={...all[i],...body};else all.push({...body});persist();}
        if(op==="update"){all.filter(matching).forEach(x=>Object.assign(x,body));persist();}
        return Promise.resolve({data,error:null}).then(done,fail);
      }
    };
    return q;
  }
  window.supabase={createClient:function(){return {from:table,auth:{
    getUser:async()=>({data:{user},error:null}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
    signOut:async()=>{user=null;return {error:null};},
    updateUser:async x=>{if(x.data&&user)Object.assign(user.user_metadata,x.data);return {data:{user},error:null};}
  }};}};
}
async function setup(page,guest=false){
  await page.addInitScript(value=>{window.__AFN_GUEST=value;},guest);
  await page.route("**/assets/auth-config.js",route=>route.fulfill({status:200,contentType:"application/javascript",body:'window.AFN_AUTH_CONFIG={enabled:true,url:"https://qa.supabase.co",publishableKey:"sb_publishable_e2e_key_123456789",storageKey:"afn-e2e"};'}));
  await page.route("**/supabase.min.js",route=>route.fulfill({status:200,contentType:"application/javascript",body:"("+installMock.toString()+")()"}));
}
test("desktop loads with no fake watch history",async({page})=>{
  await setup(page);
  await page.goto(BASE+"/member.html?site=xuongphim",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#hub-app")).toBeVisible();
  await expect(page.locator("#hero-name")).toHaveText("Khán giả kiểm thử");
  await expect(page.locator("#stat-progress")).toHaveText("0");
  await expect(page.locator("#continue-items")).toContainText("Chưa có phim đang xem");
  await page.screenshot({path:"test-results/level3-desktop.png",fullPage:true});
});
test("favorites persist across reload and can be removed",async({page})=>{
  await setup(page);
  await page.goto(BASE+"/member.html?site=xuongphim",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#hub-app")).toBeVisible();
  await page.locator('[data-tab="discover"]').click();
  await page.locator('#discover-items [data-action="favorite"]').first().click();
  await expect(page.locator("#stat-favorites")).toHaveText("1");
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.locator("#stat-favorites")).toHaveText("1");
  await page.locator('[data-tab="library"]').click();
  await expect(page.locator("#library-items article")).toHaveCount(1);
  await page.locator('#library-items [data-action="favorite"]').first().click();
  await expect(page.locator("#stat-favorites")).toHaveText("0");
});
test("different viewer profiles have independent favorites",async({page})=>{
  await setup(page);
  await page.goto(BASE+"/member.html?site=xuongphim",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#hub-app")).toBeVisible();
  await page.locator('[data-tab="discover"]').click();
  await page.locator('#discover-items [data-action="favorite"]').first().click();
  await expect(page.locator("#stat-favorites")).toHaveText("1");
  await page.locator('[data-tab="profiles"]').click();
  await page.locator("#new-profile-name").fill("Gia đình");
  await page.locator('#new-profile-form button[type="submit"]').click();
  await expect(page.locator("#profile-select option")).toHaveCount(2);
  await page.locator("#profile-select").selectOption({label:"Gia đình"});
  await expect(page.locator("#stat-favorites")).toHaveText("0");
});
test("mobile fits within viewport",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await setup(page);
  await page.goto(BASE+"/member.html?site=xuongphim",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#hub-app")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
  await page.screenshot({path:"test-results/level3-mobile.png",fullPage:true});
});
test("guest and other brands remain outside Level 3 pilot",async({page})=>{
  await setup(page,true);
  await page.goto(BASE+"/member.html?site=xuongphim",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#hub-guest")).toBeVisible();
  await page.goto(BASE+"/member.html?site=khophim",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#hub-guest")).toBeVisible();
  await expect(page.locator("#hub-app")).toBeHidden();
});
