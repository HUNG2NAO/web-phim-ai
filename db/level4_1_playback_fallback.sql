-- AI FILM NETWORK — Level 4.1: nguồn phát dự phòng cho từng tập (áp SAU level4_rewards_unlock_social_v1.sql).
-- Chỉ hỗ trợ đúng hai loại nguồn hợp lệ đã có: YouTube Video ID (11 ký tự) hoặc video HTTPS do chủ site sở hữu/có quyền.
-- Không DRM, không vượt giới hạn nền tảng: nguồn dự phòng chỉ được trả về SAU cùng một bước kiểm tra quyền xem
-- như nguồn chính. Additive & idempotent: chạy lại an toàn; gỡ bằng db/staging/99_rollback_level4.sql.
begin;

alter table public.episode_sources
  add column if not exists fallback_kind text,
  add column if not exists fallback_youtube_id text,
  add column if not exists fallback_video_url text;

alter table public.episode_sources drop constraint if exists fallback_valid;
alter table public.episode_sources add constraint fallback_valid check (
  (fallback_kind is null and fallback_youtube_id is null and fallback_video_url is null) or
  (fallback_kind = 'youtube' and fallback_youtube_id ~ '^[A-Za-z0-9_-]{11}$' and fallback_video_url is null) or
  (fallback_kind = 'native' and fallback_youtube_id is null and fallback_video_url ~ '^https://[^[:space:]]+$'
     and char_length(fallback_video_url) <= 1000));

-- Same access rules as before; the only change is the optional "fallback" object in an "ok" answer.
create or replace function public.get_playback_source(p_episode_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare uid uuid := auth.uid(); e public.site_episodes; s public.episode_sources; allowed boolean;
begin
  select * into e from public.site_episodes where id = p_episode_id;
  if not found or (not e.published and not private.is_site_admin(e.site_id)) then
    return jsonb_build_object('status', 'not_found');
  end if;
  allowed := private.episode_is_open(e) or (uid is not null and private.is_site_admin(e.site_id));
  if not allowed and e.access_tier = 'member' then allowed := uid is not null; end if;
  if not allowed and e.access_tier = 'early' and uid is not null then
    allowed := exists (select 1 from public.content_entitlements c where c.user_id = uid and c.episode_id = e.id
      and c.status = 'active' and (c.expires_at is null or c.expires_at > now()));
  end if;
  if not allowed then
    return jsonb_build_object('status', case when uid is null then 'login_required' else 'locked' end,
      'tier', e.access_tier, 'price', e.price_points, 'free_from', e.free_from);
  end if;
  select * into s from public.episode_sources where episode_id = e.id;
  if not found then return jsonb_build_object('status', 'no_source'); end if;
  return jsonb_build_object('status', 'ok', 'source_kind', s.source_kind, 'youtube_id', s.youtube_id, 'video_url', s.video_url,
    'fallback', case when s.fallback_kind is null then null
      else jsonb_build_object('source_kind', s.fallback_kind, 'youtube_id', s.fallback_youtube_id, 'video_url', s.fallback_video_url) end);
end $$;
revoke all on function public.get_playback_source(uuid) from public;
grant execute on function public.get_playback_source(uuid) to anon, authenticated;

commit;
