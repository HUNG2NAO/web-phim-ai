// DOM integration tests: no real Supabase credentials or network requests.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");
const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
function fakeClient(startUser) {
  let user=startUser, subscriber=()=>{};
  const profiles=new Map(), memberships=new Map();
  return {
    from(table) {
      const terms=[];
      const query={
        select(){return query;},
        eq(key,value){terms.push([key,value]);return query;},
        async maybeSingle() {
          if (table==="profiles") return {data:profiles.get(terms.find(x=>x[0]==="id")?.[1])||null,error:null};
          const key=terms.find(x=>x[0]==="user_id")?.[1]+":"+terms.find(x=>x[0]==="site_id")?.[1];
          return {data:memberships.get(key)||null,error:null};
        },
        async insert(data) {
          if(table==="profiles")profiles.set(data.id,data);
          else memberships.set(data.user_id+":"+data.site_id,data);
          return {data,error:null};
        },
        async upsert(data) {
          profiles.set(data.id,data);
          return {data,error:null};
        }
      };
      return query;
    },
    auth:{
      async getUser(){return {data:{user},error:null};},
      onAuthStateChange(callback){subscriber=callback;return {data:{subscription:{unsubscribe(){}}}};},
      async signOut(options) {
        assert.equal(options.scope,"local");
        user=null;subscriber("SIGNED_OUT",null);return {error:null};
      },
      async updateUser({data,password}) {
        if (data) user={...user,user_metadata:{...user.user_metadata,...data}};
        if (password) assert(password.length>=8);
        subscriber("USER_UPDATED",{user});
        return {data:{user},error:null};
      },
      async signInWithPassword(){return {data:{user},error:null};},
      async signUp(){return {data:{user:null,session:null},error:null};},
      async resetPasswordForEmail(){return {error:null};}
    }
  };
}
function domFor(file,url,user) {
  const dom=new JSDOM(read(file),{url,runScripts:"outside-only",pretendToBeVisual:true});
  const win=dom.window;
  win.HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
  win.HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
  win.AFN_AUTH_CONFIG={enabled:true,url:"https://testing.supabase.co",publishableKey:"sb_publishable_test_example_long_valid",storageKey:"test-session"};
  const client=fakeClient(user);
  win.supabase={createClient(){return client;}};
  // Same order as the real pages: Shared Core (sites.js) always loads before auth/account modules.
  win.eval(read("assets/sites.js"));
  win.eval(read(file==="account.html"?"assets/account.js":"assets/auth.js"));
  const q=s=>win.document.querySelector(s);
  return {dom,win,client,q,close(){win.close();}};
}
const user={id:"00000000-0000-4000-8000-000000000001",email:"watcher@example.com",
  email_confirmed_at:"2026-10-28T17:00:00Z",created_at:"2026-10-28T16:00:00Z",
  user_metadata:{display_name:"Người xem phim"}};

test("signed-in viewer: Account opens compact menu, NOT modal",async()=>{
  const a=domFor("index.html","https://feature-auth-first-pilot-202.web-phim-ai-5sites.pages.dev/?site=xuongphim",user);
  try {
    await wait();
    assert.equal(a.q(".afn-account-btn").textContent,"Tài khoản");
    a.q(".afn-account-btn").click();
    assert.equal(a.q("#afn-account-menu").classList.contains("afn-auth-hidden"),false);
    assert.equal(a.q(".afn-auth-dialog").open,false,"Account click should not dim movie screen");
    assert.match(a.q("#afn-menu-profile").href,/\/account\.html\?site=xuongphim$/);
    assert.equal(a.q("#afn-menu-name").textContent,user.user_metadata.display_name);
    a.q(".afn-account-btn").click();
    assert.equal(a.q("#afn-account-menu").classList.contains("afn-auth-hidden"),true);
  } finally {a.close();}
});

test("logged-out viewer: Account opens login/signup dialog",async()=>{
  const a=domFor("index.html","https://www.xuongphim.ai/",null);
  try {
    await wait();
    assert.equal(a.q(".afn-account-btn").textContent,"Đăng nhập");
    a.q(".afn-account-btn").click();
    assert.equal(a.q(".afn-auth-dialog").open,true);
    assert.equal(a.q("#afn-auth-form").classList.contains("afn-auth-hidden"),false);
  } finally {a.close();}
});

test("sign-out in account menu removes session only for current site",async()=>{
  const a=domFor("index.html","https://www.khophim.ai/",user);
  try {
    await wait();
    a.q(".afn-account-btn").click();
    a.q("#afn-menu-signout").click();
    await wait();
    assert.equal(a.q(".afn-account-btn").textContent,"Đăng nhập");
    assert.equal(a.q("#afn-account-menu").classList.contains("afn-auth-hidden"),true);
    assert.equal(a.q(".afn-auth-dialog").open,false);
  } finally {a.close();}
});

test("signed-in profile page shows information and saves display name",async()=>{
  const a=domFor("account.html","https://feature-auth-first-pilot-202.web-phim-ai-5sites.pages.dev/account.html?site=phephim",user);
  try {
    await wait();
    assert.equal(a.q("#afn-account-signedin").hidden,false);
    assert.equal(a.q("#afn-account-signedout").hidden,true);
    assert.equal(a.q("#afn-profile-display").textContent,"Người xem phim");
    assert.equal(a.q("#afn-brand-name").textContent,"PHÊ PHIM");
    assert.match(a.q("#afn-profile-back").href,/\?site=phephim$/);
    a.q("#afn-edit-display").value="Khán giả AI";
    a.q("#afn-profile-form").dispatchEvent(new a.win.Event("submit",{bubbles:true,cancelable:true}));
    await wait();
    assert.equal(a.q("#afn-profile-display").textContent,"Khán giả AI");
    assert.match(a.q("#afn-profile-status").textContent,/Đã cập nhật/);
  } finally {a.close();}
});

test("signed-out profile page provides a useful navigation action",async()=>{
  const a=domFor("account.html","https://www.xuongphim.ai/account.html",null);
  try {
    await wait();
    assert.equal(a.q("#afn-account-signedin").hidden,true);
    assert.equal(a.q("#afn-account-signedout").hidden,false);
    assert.match(a.q("#afn-signin-home").href,/www\.xuongphim\.ai\/$/);
  } finally {a.close();}
});
