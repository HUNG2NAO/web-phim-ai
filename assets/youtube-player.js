/* YouTube IFrame API playback with optional Supabase progress. No fake play events.
   Only used for admin-published, rights-attested video IDs. */
(function(){
"use strict";
let loader=null,activePlayer=null,activeInterval=null;
function ready(){
 if(window.YT&&window.YT.Player)return Promise.resolve(window.YT);
 if(loader)return loader;
 loader=new Promise((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=function(){try{if(typeof previous==="function")previous();}catch(_){}resolve(window.YT);};
  const script=document.createElement("script");script.src="https://www.youtube.com/iframe_api";
  script.onerror=()=>reject(new Error("YouTube IFrame API unavailable"));
  document.head.appendChild(script);
 });
 return loader;
}
function offlineEmbed(holder,id,title){
 if(!holder.isConnected)return;
 const frame=document.createElement("iframe");
 frame.src="https://www.youtube-nocookie.com/embed/"+id+"?rel=0";
 frame.title=title||"Phim YouTube";
 frame.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
 frame.allowFullscreen=true;frame.style.cssText="width:100%;height:100%;border:0";
 holder.replaceChildren(frame);
}
function playbackClient(){
 const cfg=window.AFN_AUTH_CONFIG||{};
 if(!cfg.enabled||!window.supabase?.createClient||!/^sb_publishable_[\w-]+$/.test(cfg.publishableKey||""))return null;
 return window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{
  persistSession:true,autoRefreshToken:true,storageKey:cfg.storageKey||"afn-film-auth-v1"
 }});
}
function currentSite(){
 const host=location.hostname.replace(/^www\./,""),p=new URLSearchParams(location.search);
 const sites=window.SITES||[];
 return host.endsWith(".pages.dev")?(sites.find(x=>x.id===p.get("site"))||sites[0])?.id:sites.find(x=>x.domain===host)?.id;
}
window.AFN_PLAY_YOUTUBE=async function({holder,filmId,videoId,episode=1}){
 if(!holder||!/^[A-Za-z0-9_-]{11}$/.test(videoId||"")||!/^[a-z0-9][a-z0-9-]{0,119}$/.test(filmId||""))return;
 if(activeInterval)clearInterval(activeInterval);
 if(activePlayer){try{activePlayer.destroy();}catch(_){}activePlayer=null;}
 const site=currentSite(),client=playbackClient();
 const flags=window.AFN_LEVEL3_CONFIG?.enabledSites||["xuongphim"];
 let user=null,viewer=null,allowed=false,restored=0,dirty=false,writeBusy=false;
 async function prepare(){
  if(!client||!site||!flags.includes(site))return;
  try{
   const result=await client.auth.getUser();user=result.data?.user;
   if(!user)return;
   const current=localStorage.getItem("afn-active-viewer:"+user.id+":"+site);
   if(!current||!/^[0-9a-f-]{36}$/i.test(current))return;
   const p=await client.from("viewer_profiles").select("id").eq("id",current).eq("user_id",user.id).eq("site_id",site).maybeSingle();
   if(p.error||!p.data)return;
   const prefs=await client.from("viewer_preferences").select("watch_tracking_enabled").eq("viewer_profile_id",current).eq("user_id",user.id).maybeSingle();
   if(prefs.error||!prefs.data?.watch_tracking_enabled)return;
   allowed=true;viewer=current;
   const old=await client.from("watch_progress").select("position_seconds,duration_seconds")
    .eq("viewer_profile_id",viewer).eq("film_id",filmId).eq("episode",episode).maybeSingle();
   if(!old.error&&old.data?.position_seconds>20&&old.data.position_seconds<old.data.duration_seconds-20)
     restored=old.data.position_seconds;
  }catch(_){}
 }
 async function save(force){
  if(!allowed||!activePlayer||!user||!viewer||writeBusy)return;
  const current=activePlayer;
  if(typeof current.getCurrentTime!=="function")return;
  const pos=current.getCurrentTime(),duration=current.getDuration();
  if(!Number.isFinite(pos)||!Number.isFinite(duration)||duration<=0||duration>86400||pos<0)return;
  if(!force&&!dirty)return;
  writeBusy=true;dirty=false;
  try{
   const {error}=await client.from("watch_progress").upsert({
    viewer_profile_id:viewer,user_id:user.id,site_id:site,film_id:filmId,episode,
    position_seconds:Math.floor(pos),duration_seconds:Math.floor(duration),
    watched_at:new Date().toISOString()
   },{onConflict:"viewer_profile_id,film_id,episode"});
   if(error)dirty=true;
  }catch(_){dirty=true;}finally{writeBusy=false;}
 }
 function startTimer(){
  if(activeInterval)clearInterval(activeInterval);
  activeInterval=setInterval(()=>{if(!holder.isConnected){clearInterval(activeInterval);activeInterval=null;return;}dirty=true;save(false);},20000);
 }
 await prepare();
 try{
  const yt=await ready();
  if(!holder.isConnected)return;
  activePlayer=new yt.Player(holder,{videoId,host:"https://www.youtube-nocookie.com",
   playerVars:{playsinline:1,rel:0,origin:location.origin},
   events:{
    onReady:e=>{if(restored>0){try{e.target.seekTo(restored,true);}catch(_){}}},
    onStateChange:e=>{
     if(e.data===yt.PlayerState.PLAYING){dirty=true;startTimer();}
     if(e.data===yt.PlayerState.PAUSED||e.data===yt.PlayerState.ENDED){if(activeInterval)clearInterval(activeInterval);activeInterval=null;dirty=true;save(true);}
    }
   }
  });
 }catch(_){offlineEmbed(holder,videoId,filmId);}
};
window.addEventListener("pagehide",()=>{if(activeInterval)clearInterval(activeInterval);activeInterval=null;});
})();