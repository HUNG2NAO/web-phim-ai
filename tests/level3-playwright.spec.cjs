const { test, expect } = require("@playwright/test");
const BASE = process.env.AFN_PREVIEW_URL || "https://feature-level3-completion-pr.web-phim-ai-5sites.pages.dev";
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
test("guest is asked to sign in",async({page})=>{
  await setup(page,true);
  await page.goto(BASE+"/member.html?site=xuongphim",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#hub-guest")).toBeVisible();
  await expect(page.locator("#hub-app")).toBeHidden();
});
for(const [site,label] of [
  ["xuongphim","Xưởng Phim"],
  ["khophim","Kho Phim"],
  ["phephim","Phê Phim"],
  ["phimhay","Phim Hay"],
  ["ghienphim","Ghiền Phim"]
]){
  test(site+" renders own branded hub and nonempty matching catalog",async({page})=>{
    await setup(page);
    await page.goto(BASE+"/member.html?site="+site,{waitUntil:"domcontentloaded"});
    await expect(page.locator("#hub-app")).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(label));
    await page.locator('[data-tab="discover"]').click();
    const cards=page.locator("#discover-items article");
    expect(await cards.count()).toBeGreaterThan(0);
    const actual=await page.locator(".brand-mark").textContent();
    expect(actual.length).toBeGreaterThan(0);
    await expect(page.locator("#stat-progress")).toHaveText("0");
  });
}

for(const [site,label] of [
  ["xuongphim","Xưởng Phim"],
  ["khophim","Kho Phim"],
  ["phephim","Phê Phim"],
  ["phimhay","Phim Hay"],
  ["ghienphim","Ghiền Phim"]
]){
  test(site+" connects account dropdown to Member Hub and branded account page",async({page})=>{
    await setup(page);
    await page.goto(BASE+"/?site="+site,{waitUntil:"domcontentloaded"});
    await expect(page.locator(".afn-account-btn")).toHaveText("Tài khoản");
    await page.locator(".afn-account-btn").click();
    const link=page.locator("#afn-menu-member");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href",new RegExp("member\\.html\\?site="+site));
    await link.click();
    await expect(page.locator("#hub-app")).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(label));
    await page.goto(BASE+"/account.html?site="+site,{waitUntil:"domcontentloaded"});
    await expect(page.locator("#afn-account-signedin")).toBeVisible();
    await expect(page.locator("#afn-member-hub-shortcut")).toBeVisible();
    await expect(page.locator("#afn-member-hub-shortcut")).toContainText(label);
  });
}

test("self-service password change and privacy request require signed-in viewer",async({page})=>{
  await setup(page);
  await page.goto(BASE+"/account.html?site=xuongphim",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#afn-account-security")).toBeVisible();
  await page.locator("#afn-new-password").fill("MyLongPrivatePassword2026!");
  await page.locator("#afn-confirm-password").fill("MyLongPrivatePassword2026!");
  await page.locator('#afn-password-form button[type="submit"]').click();
  await expect(page.locator("#afn-profile-status")).toContainText("cập nhật mật khẩu");
  page.on("dialog",d=>d.accept());
  await page.locator("#afn-request-delete").click();
  await expect(page.locator("#afn-privacy-requests")).toContainText("Yêu cầu xóa tài khoản");
});
test("unprivileged viewers cannot access the moderation console",async({page})=>{
  await setup(page);
  await page.goto(BASE+"/admin.html",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#studio-denied")).toBeVisible();
  await expect(page.locator("#studio-app")).toBeHidden();
});
test("staff can save a rights-attested draft and moderate a review",async({page})=>{
  await setup(page);
  await page.addInitScript(()=>{
    const userId="00000000-0000-4000-8000-000000000099";
    localStorage.setItem("__AFN_E2E_ROWS",JSON.stringify({
      site_staff:[{user_id:userId,site_id:"xuongphim",role:"admin"}],
      site_memberships:[{user_id:userId,site_id:"xuongphim"}],
      film_reviews:[{id:"00000000-0000-4000-8000-000000000098",viewer_profile_id:"abc",
        user_id:userId,site_id:"xuongphim",film_id:"phim-thu",content:"Bài bình luận kiểm duyệt thử nghiệm",rating:5,moderation_status:"pending"}]
    }));
  });
  await page.goto(BASE+"/admin.html?site=xuongphim",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#studio-app")).toBeVisible();
  await page.locator("#studio-film-id").fill("phim-demo-duoc-phep");
  await page.locator("#studio-film-title").fill("Phim đã được cấp phép");
  await page.locator("#studio-film-video").fill("dQw4w9WgXcQ");
  await page.locator("#studio-rights").check();
  await page.locator("#studio-save-film").click();
  await expect(page.locator("#studio-films")).toContainText("Phim đã được cấp phép");
  await page.locator('[data-studio-tab="reviews"]').click();
  await expect(page.locator("#studio-reviews")).toContainText("phim-thu");
  await page.locator('[data-review-action*="approved"]').click();
  await expect(page.locator("#studio-reviews")).toContainText("Không có đánh giá cần duyệt");
});
test("member data can be exported as JSON",async({page})=>{
  await setup(page);
  await page.goto(BASE+"/member.html?site=xuongphim",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#hub-app")).toBeVisible();
  await page.locator('[data-tab="settings"]').click();
  const download=page.waitForEvent("download");
  await page.locator("#export-data").click();
  const file=await download;
  expect(file.suggestedFilename()).toBe("ai-film-network-my-data.json");
});
