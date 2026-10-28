-- Extra covering indexes for composite FK checks under RLS; no data changes.
create index if not exists viewer_prefs_profile_owner_site
  on public.viewer_preferences(viewer_profile_id,user_id,site_id);
create index if not exists film_library_profile_owner_site
  on public.film_library(viewer_profile_id,user_id,site_id);
create index if not exists watch_progress_profile_owner_site
  on public.watch_progress(viewer_profile_id,user_id,site_id);
create index if not exists film_reviews_profile_owner_site
  on public.film_reviews(viewer_profile_id,user_id,site_id);