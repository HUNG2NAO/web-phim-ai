/* Approved releases only. Metadata fetched via Supabase RLS using publishable key. */
(function(){
"use strict";
const cfg=window.AFN_AUTH_CONFIG||{};
const brands=window.SITES||[];
if(!cfg.enabled||!window.supabase?.createClient)return;
const host=location.hostname.replace(/^www\./,"");
const params=new URLSearchParams(location.search);
const brand=window.AFN_RESOLVE_SITE?window.AFN_RESOLVE_SITE().site:(host.endsWith(".pages.dev")?
 (brands.find(x=>x.id===params.get("site"))||brands[0]):brands.find(x=>x.domain===host));
if(!brand)return;
const client=(window.AFN&&window.AFN.client&&window.AFN.client())||window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{
 persistSession:true,autoRefreshToken:true,storageKey:cfg.storageKey||"afn-film-auth-v1"
}});
function valid(row){
 return row&&row.published===true&&row.rights_attested===true
   &&/^[a-z0-9][a-z0-9-]{0,119}$/.test(row.film_id||"")
   &&typeof row.title==="string"&&row.title.length>=2
   &&((row.source_kind==="youtube"&&/^[A-Za-z0-9_-]{11}$/.test(row.youtube_id||""))
    ||(row.source_kind==="native"&&/^https:\/\/\S+$/.test(row.video_url||"")));
}
(async()=>{
 try{
  const {data,error}=await client.from("site_films").select("*").eq("site_id",brand.id).eq("published",true);
  if(error)throw error;
  // Level 4: public episode metadata (tier, price). Sources are never part of this response.
  const episodesByFilm=new Map();
  try{
   const ep=await client.from("site_episodes")
    .select("id,film_id,episode_no,title,access_tier,price_points,free_from,access_days")
    .eq("site_id",brand.id).eq("published",true).order("episode_no",{ascending:true});
   if(!ep.error)(ep.data||[]).forEach(e=>{
    if(!/^[0-9a-f-]{36}$/i.test(e.id||"")||!Number.isInteger(e.episode_no))return;
    if(!["free","early","member"].includes(e.access_tier))return;
    if(!episodesByFilm.has(e.film_id))episodesByFilm.set(e.film_id,[]);
    episodesByFilm.get(e.film_id).push({id:e.id,episode_no:e.episode_no,title:String(e.title||"").slice(0,160),
     access_tier:e.access_tier,price_points:Math.max(0,Number(e.price_points)||0),free_from:e.free_from||null,access_days:e.access_days||null});
   });
  }catch(_){/* Level 4 tables may not be migrated yet; film-level playback still works */}
  const films=window.FILMS||[];
  for(const row of (data||[]).filter(valid)){
   const genres=Array.isArray(row.genres)?row.genres.filter(x=>typeof x==="string").slice(0,12):[];
   const film={id:row.film_id,title:row.title,synopsis:row.synopsis||"",genres,
    year:row.year||new Date().getFullYear(),type:row.film_type||"le",
    duration:"Theo video",age:"Chưa phân loại",quality:"HD",views:0,
    world:brand.world||"co-trang",sites:[brand.id],live:true,
    art:{motif:brand.world==="tuong-lai"?"pho":"truc",hue:200}};
   if(row.source_kind==="youtube")film.youtube=row.youtube_id;
   else film.video=row.video_url;
   const eps=episodesByFilm.get(row.film_id);
   if(eps&&eps.length){film.episodeList=eps.sort((a,b)=>a.episode_no-b.episode_no);
    if(film.type==="bo")film.episodes=eps.length,film.aired=eps.length;}
   const idx=films.findIndex(x=>x.id===film.id);
   if(idx>=0)films[idx]=film;else films.push(film);
  }
  window.dispatchEvent(new CustomEvent("afn-catalog-updated",{detail:{site_id:brand.id,count:(data||[]).filter(valid).length}}));
 }catch(e){window.dispatchEvent(new CustomEvent("afn-catalog-error"));}
})();
})();