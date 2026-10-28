// Run with Node.js >= 22 and jsdom installed in a separate QA tools directory (see README).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),ids=['xuongphim','khophim','phephim','phimhay','ghienphim'];
function boot(url='https://preview.example/?site=ghienphim',saved,mutate){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.scrollTo=()=>{};w.InkArt={hydrate(){}};
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
 if(saved)w.localStorage.setItem('pv-site',saved);
 for(const f of ['sites.js','films.js','films-tuong-lai.js'])w.eval(fs.readFileSync(path.join(root,'assets',f),'utf8'));
 if(mutate)mutate(w);
 w.eval(fs.readFileSync(path.join(root,'assets/app.js'),'utf8'));
 const q=s=>w.document.querySelector(s),all=s=>[...w.document.querySelectorAll(s)],click=s=>{assert(q(s),'Missing '+s);q(s).click();};
 const input=value=>{q('#q').value=value;q('#q').dispatchEvent(new w.Event('input',{bubbles:true}))};
 const films=()=>all('#content .card').map(el=>w.FILMS.find(f=>f.id===el.dataset.film));
 return {dom,w,q,all,click,input,films,close:()=>w.close()};
}
for(const id of ids){
 test(id+': newest ordering and selection agree',()=>{const a=boot('https://preview.example/?site='+id);try{a.click('[data-nav="kho"]');assert.equal(a.q('#f-sort').value,'moi');const list=a.films();const score=f=>f.year*1000+(Number.isInteger(f.aired)&&f.aired<f.episodes?500:0)+f.views/1e5;assert(list.every((f,i)=>i===0||score(list[i-1])>=score(f)));const before=list.map(f=>f.id);a.q('#f-sort').dispatchEvent(new a.w.Event('change',{bubbles:true}));assert.deepEqual(a.films().map(f=>f.id),before);}finally{a.close()}});
 test(id+': explicit URL wins over saved brand and hash',()=>{const a=boot('https://preview.example/?site='+id+'#phimhay','khophim');try{assert.equal(a.q('[data-site="'+id+'"]').getAttribute('aria-pressed'),'true');}finally{a.close()}});
 test(id+': real hostname wins over all preview state',()=>{for(const host of [id+'.ai','www.'+id+'.ai']){const a=boot('https://'+host+'/?site=phimhay#khophim','phephim');try{assert(a.w.document.title.startsWith(a.w.SITES.find(s=>s.id===id).name+'.ai'));assert.equal(a.q('#preview-bar').hidden,true);}finally{a.close()}}});
}
test('continuous switches clear search, synchronize URL/storage and survive reload',()=>{let a=boot('https://preview.example/?site=xuongphim&qa=keep#old','ghienphim');try{for(const id of [...ids,...ids.slice().reverse()]){a.input('khong co phim');a.click('[data-site="'+id+'"]');assert.equal(a.q('#q').value,'');assert(a.q('h1'));assert.equal(a.w.localStorage.getItem('pv-site'),id);assert.equal(new URL(a.w.location.href).searchParams.get('site'),id);assert.equal(new URL(a.w.location.href).searchParams.get('qa'),'keep');const reload=boot(a.w.location.href,'phimhay');assert.equal(reload.w.document.title,a.w.document.title);reload.close();}}finally{a.close()}});
for(const [url,saved,expected]of[
 ['https://preview.example/?site=invalid#phephim','khophim','phephim'],
 ['https://preview.example/?site=invalid#invalid','khophim','khophim'],
 ['https://preview.example/','invalid','xuongphim'],
 ['https://preview.example/#ghienphim','phimhay','ghienphim']
])test('valid fallback: '+url+' / '+saved,()=>{const a=boot(url,saved);try{assert.equal(a.q('[aria-pressed="true"].pv-pill').dataset.site,expected)}finally{a.close()}});
const cases=[
 ['explicit complete',{episodes:10,aired:10},true,false,10],
 ['missing aired means complete',{episodes:10},true,false,10],
 ['ongoing',{episodes:10,aired:4},false,true,4],
 ['zero aired',{episodes:10,aired:0},false,true,0],
 ['missing episodes',{aired:4},false,false,0],
 ['zero episodes',{episodes:0},false,false,0],
 ['negative episodes',{episodes:-2},false,false,0],
 ['fraction episodes',{episodes:2.5},false,false,0],
 ['string episodes',{episodes:'10'},false,false,0],
 ['null aired',{episodes:10,aired:null},false,false,0],
 ['negative aired',{episodes:10,aired:-1},false,false,0],
 ['fraction aired',{episodes:10,aired:2.5},false,false,0],
 ['string aired',{episodes:10,aired:'2'},false,false,0],
 ['excess aired',{episodes:10,aired:11},false,false,0],
 ['nonfinite episodes',{episodes:Infinity},false,false,0]
];
for(const [label,values,complete,airing,enabled]of cases)test('series data: '+label,()=>{const a=boot(undefined,undefined,w=>{const f={...w.FILMS.find(f=>f.type==='bo'),id:'qa-fixture',title:'QA fixture'};delete f.episodes;delete f.aired;Object.assign(f,values);w.FILMS.push(f)});try{const select=filter=>{const button=a.all('[data-catalog]').find(e=>{const v=JSON.parse(e.dataset.catalog);return filter==='complete'?v.completed:v.airing});assert(button);button.click()};select('complete');assert.equal(a.films().some(f=>f.id==='qa-fixture'),complete);a.click('[data-nav="home"]');select('airing');assert.equal(a.films().some(f=>f.id==='qa-fixture'),airing);a.click('[data-nav="bo"]');assert(a.films().some(f=>f.id==='qa-fixture'),'must remain in all series');a.click('[data-film="qa-fixture"]');assert.equal(a.all('[data-ep]:not(:disabled)').length,enabled);assert(!a.q('#film-content').textContent.includes('undefined'));assert(!a.q('#film-content').textContent.includes('NaN'));if(enabled===0){a.click('#play-btn');assert(a.q('#player .note'));assert.equal(a.q('#player video'),null);}}finally{a.close()}});
test('leaving completed catalog restores other film types',()=>{const a=boot();try{a.all('[data-catalog]').find(e=>JSON.parse(e.dataset.catalog).completed).click();assert(a.q('h2').textContent.endsWith('Phim bộ trọn bộ'));a.q('#f-type').value='le';a.q('#f-type').dispatchEvent(new a.w.Event('change',{bubbles:true}));assert(a.films().length>0);assert(a.films().every(f=>f.type==='le'));}finally{a.close()}});

test('demo is explicit and temporarily excluded from indexing',()=>{const a=boot('https://www.xuongphim.ai/');try{assert.equal(a.q('meta[name="robots"]').content,'noindex,follow');assert(a.q('.demo-notice').textContent.includes('chưa có video'));assert(a.q('.hero [data-play]').textContent.includes('Xem demo'));a.click('.hero [data-play]');assert(a.q('#player .note').textContent.includes('chưa có video'));assert(!a.q('#player .note').textContent.includes('assets/'));assert.equal(a.q('#player video'),null);}finally{a.close()}});
