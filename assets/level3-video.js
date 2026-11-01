/* Playback-only progress for native <video>. No demo events or simulated views.
   YouTube embeds require their own tested IFrame API adapter later. */
(function(){
  "use strict";
  const cfg=window.AFN_AUTH_CONFIG||{};
  const host=window.location.hostname.replace(/^www\./,"");
  const params=new URLSearchParams(window.location.search);
  const brands=window.SITES||[];
  const site=window.AFN_RESOLVE_SITE?window.AFN_RESOLVE_SITE().site:(host.endsWith(".pages.dev") ?
    (brands.find(x=>x.id===params.get("site"))||brands[0]) :
    brands.find(x=>x.domain===host));
  const SITE=site?.id||"unknown";
  const pilot=(window.AFN_LEVEL3_CONFIG?.enabledSites||["xuongphim"]).includes(SITE);
  if(!pilot||!cfg.enabled||!window.supabase||!/^sb_publishable_[\w-]+$/.test(cfg.publishableKey||""))return;
  const client=(window.AFN&&window.AFN.client&&window.AFN.client())||window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{
    persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce",
    storageKey:cfg.storageKey||"afn-film-auth-v1"
  }});
  const tracked=new WeakSet();
  window.AFN_TRACK_VIDEO=function(payload){
    const video=payload&&payload.video;
    const filmId=payload&&payload.filmId;
    const episode=Number(payload&&payload.episode)||1;
    if(!video||tracked.has(video)||!video.matches("video")||!/^[-a-z0-9]{1,120}$/.test(filmId||""))return;
    tracked.add(video);
    let viewer=null,user=null,enabled=false,busy=false,lastSaved=0;
    (async function(){
      try{
        const a=(window.AFN&&window.AFN.client&&window.AFN.client()===client)?{data:{user:await window.AFN.getUser()}}:await client.auth.getUser();
        if(a.error||!a.data?.user)return;
        user=a.data.user;
        let profileId;try{profileId=localStorage.getItem("afn-active-viewer:"+user.id+":"+SITE);}catch(_){return;}
        if(!profileId||!/^[a-f0-9-]{36}$/i.test(profileId))return;
        const p=await client.from("viewer_profiles").select("id").eq("id",profileId).eq("user_id",user.id).eq("site_id",SITE).maybeSingle();
        if(p.error||!p.data)return;
        const pref=await client.from("viewer_preferences").select("watch_tracking_enabled")
          .eq("viewer_profile_id",profileId).eq("user_id",user.id).maybeSingle();
        if(pref.error||!pref.data?.watch_tracking_enabled)return;
        viewer=profileId;enabled=true;
        const old=await client.from("watch_progress").select("position_seconds,duration_seconds")
          .eq("viewer_profile_id",viewer).eq("film_id",filmId).eq("episode",episode).maybeSingle();
        if(!old.error&&old.data&&old.data.position_seconds>20&&old.data.duration_seconds>30&&
          old.data.position_seconds<old.data.duration_seconds-20){
          const resume=()=>{if(Number.isFinite(video.duration)&&video.duration>old.data.position_seconds+10)
            video.currentTime=old.data.position_seconds;};
          if(video.readyState>=1)resume();
          else video.addEventListener("loadedmetadata",resume,{once:true});
        }
      }catch(_){/* optional feature must never block playback */}
    })();
    async function save(force){
      if(!enabled||!viewer||!user||busy)return;
      const duration=video.duration,position=video.currentTime;
      if(!Number.isFinite(duration)||duration<=0||duration>86400||!Number.isFinite(position)||position<0)return;
      const now=Date.now();
      if(!force&&now-lastSaved<20000)return;
      busy=true;lastSaved=now;
      try{
        await client.from("watch_progress").upsert({
          viewer_profile_id:viewer,user_id:user.id,site_id:SITE,film_id:filmId,episode:episode,
          position_seconds:Math.floor(position),duration_seconds:Math.floor(duration),
          watched_at:new Date().toISOString()
        },{onConflict:"viewer_profile_id,film_id,episode"});
      }catch(_){}finally{busy=false;}
    }
    video.addEventListener("timeupdate",()=>save(false));
    video.addEventListener("pause",()=>save(true));
    video.addEventListener("ended",()=>save(true));
  };
})();
