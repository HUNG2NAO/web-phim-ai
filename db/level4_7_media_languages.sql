-- AI FILM NETWORK — Level 4.7: NỀN DỮ LIỆU ĐA NGÔN NGỮ / NHIỀU NGUỒN PHÁT (chuẩn bị, CHƯA có engine xử lý phim).
-- CHỈ THÊM: 2 bảng mới + 1 hàm mới. Không sửa/xóa bảng, dữ liệu hay hàm hiện có
-- (episode_sources + get_playback_source v1 giữ nguyên, website hiện tại chạy như cũ).
-- Gỡ: db/staging/93_rollback_level4_7.sql (chỉ xóa 2 bảng mới + hàm mới).
--
-- Mô hình: MỘT tập phim (site_episodes.id, thuộc một phim film_id của một website) có NHIỀU bản phát:
--   episode_media     — mỗi dòng = 1 nguồn phát của 1 ngôn ngữ âm thanh (bản gốc / lồng tiếng / bản có phụ đề cứng),
--                       nhà cung cấp: youtube (công khai), youtube_unlisted, facebook (video công khai), gdrive, native (URL https).
--                       Nhiều nguồn cùng ngôn ngữ = dự phòng theo priority (0 = ưu tiên nhất).
--   episode_subtitles — phụ đề theo ngôn ngữ (vi, th, id…): track có sẵn trong video YouTube ('youtube') hoặc tệp WebVTT ('vtt').
-- Đổi ngôn ngữ = chọn dòng khác của CÙNG tập phim → không tạo lại bản ghi phim/tập.
-- Quyền: chỉ quản trị viên đúng website (hoặc chủ mạng) ghi; người xem KHÔNG đọc bảng trực tiếp mà qua
-- get_playback_media(episode, language) — dùng lại toàn bộ kiểm tra quyền xem của get_playback_source (mở khóa, thành viên…).
begin;

create table if not exists public.episode_media (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.site_episodes(id) on delete cascade,
  language text not null check (language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),                 -- BCP 47: vi, th, id, en, vi-VN
  track_kind text not null default 'original' check (track_kind in ('original', 'dub', 'subtitled')),
  provider text not null check (provider in ('youtube', 'youtube_unlisted', 'facebook', 'gdrive', 'native')),
  external_id text,
  url text,
  priority smallint not null default 0 check (priority between 0 and 99),
  label text check (label is null or char_length(label) <= 60),
  published boolean not null default false,
  rights_attested boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_provider_valid check (
       (provider in ('youtube', 'youtube_unlisted') and external_id ~ '^[A-Za-z0-9_-]{11}$' and url is null)
    or (provider = 'facebook' and external_id is null and char_length(url) <= 1000
        and url ~ '^https://(www\.|m\.|web\.)?facebook\.com/[^[:space:]]+$')
    or (provider = 'gdrive' and external_id ~ '^[A-Za-z0-9_-]{20,100}$' and url is null)
    or (provider = 'native' and external_id is null and char_length(url) <= 1000 and url ~ '^https://[^[:space:]]+$')),
  constraint media_published_needs_rights check (not published or rights_attested),
  constraint media_one_per_slot unique (episode_id, language, track_kind, priority)
);
create index if not exists episode_media_episode_idx on public.episode_media(episode_id, published, language, priority);
create index if not exists episode_media_created_by_idx on public.episode_media(created_by);

create table if not exists public.episode_subtitles (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.site_episodes(id) on delete cascade,
  language text not null check (language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  label text check (label is null or char_length(label) <= 60),
  -- 'youtube' = track phụ đề có sẵn TRONG video YouTube của tập (ưu tiên: 1 link YouTube + nhiều phụ đề, không cần URL)
  -- 'vtt'     = tệp WebVTT bên ngoài (https) — dùng cho nguồn không có track phụ đề (Drive, MP4) hoặc phủ lên YouTube
  source text not null default 'youtube' check (source in ('youtube', 'vtt')),
  url text check (url is null or (char_length(url) <= 1000 and url ~ '^https://[^[:space:]]+$')),
  is_default boolean not null default false,
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subtitle_source_valid check ((source = 'youtube' and url is null) or (source = 'vtt' and url is not null)),
  constraint subtitle_one_per_language unique (episode_id, language, source)
);
create index if not exists episode_subtitles_created_by_idx on public.episode_subtitles(created_by);
create unique index if not exists episode_subtitles_one_default on public.episode_subtitles(episode_id) where is_default;

-- RLS: quản trị viên (role admin) đúng website / nhân sự mạng — cùng mẫu với episode_sources; 2FA do cổng RESTRICTIVE mfa_gate_* (Level 4.6).
alter table public.episode_media enable row level security;
alter table public.episode_subtitles enable row level security;
revoke all on public.episode_media, public.episode_subtitles from public, anon;
revoke truncate, trigger, references on public.episode_media, public.episode_subtitles from authenticated, service_role;
grant select, insert, update, delete on public.episode_media, public.episode_subtitles to authenticated;

drop policy if exists media_admin_all on public.episode_media;
create policy media_admin_all on public.episode_media for all to authenticated
  using (exists (select 1 from public.site_episodes e join public.site_staff s on s.site_id = e.site_id and s.user_id = (select auth.uid()) and s.role = 'admin'
                 where e.id = episode_media.episode_id)
         or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())))
  with check (exists (select 1 from public.site_episodes e join public.site_staff s on s.site_id = e.site_id and s.user_id = (select auth.uid()) and s.role = 'admin'
                 where e.id = episode_media.episode_id)
         or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())));
drop policy if exists subtitles_admin_all on public.episode_subtitles;
create policy subtitles_admin_all on public.episode_subtitles for all to authenticated
  using (exists (select 1 from public.site_episodes e join public.site_staff s on s.site_id = e.site_id and s.user_id = (select auth.uid()) and s.role = 'admin'
                 where e.id = episode_subtitles.episode_id)
         or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())))
  with check (exists (select 1 from public.site_episodes e join public.site_staff s on s.site_id = e.site_id and s.user_id = (select auth.uid()) and s.role = 'admin'
                 where e.id = episode_subtitles.episode_id)
         or exists (select 1 from public.network_staff n where n.user_id = (select auth.uid())));

drop policy if exists mfa_gate_select on public.episode_media;
create policy mfa_gate_select on public.episode_media as restrictive for select to authenticated using ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_insert on public.episode_media;
create policy mfa_gate_insert on public.episode_media as restrictive for insert to authenticated with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_update on public.episode_media;
create policy mfa_gate_update on public.episode_media as restrictive for update to authenticated using ((select public.afn_staff_gate())) with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_delete on public.episode_media;
create policy mfa_gate_delete on public.episode_media as restrictive for delete to authenticated using ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_select on public.episode_subtitles;
create policy mfa_gate_select on public.episode_subtitles as restrictive for select to authenticated using ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_insert on public.episode_subtitles;
create policy mfa_gate_insert on public.episode_subtitles as restrictive for insert to authenticated with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_update on public.episode_subtitles;
create policy mfa_gate_update on public.episode_subtitles as restrictive for update to authenticated using ((select public.afn_staff_gate())) with check ((select public.afn_staff_gate()));
drop policy if exists mfa_gate_delete on public.episode_subtitles;
create policy mfa_gate_delete on public.episode_subtitles as restrictive for delete to authenticated using ((select public.afn_staff_gate()));

-- Nhật ký quản trị: mọi thêm/sửa/xóa nguồn phát và phụ đề (ai, website, tập, ngôn ngữ, nhà cung cấp, trạng thái xuất bản).
create or replace function private.audit_media() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare e public.site_episodes; r jsonb;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  select * into e from public.site_episodes where id = (r->>'episode_id')::uuid;
  perform private.audit(e.site_id, tg_table_name || '.' || lower(tg_op), coalesce(e.film_id, '') || ':' || coalesce(e.episode_no::text, ''),
    jsonb_strip_nulls(jsonb_build_object('language', r->>'language', 'provider', r->>'provider', 'source', r->>'source',
      'track_kind', r->>'track_kind', 'published', (r->>'published')::boolean)));
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.audit_media() from public;
drop trigger if exists audit_episode_media on public.episode_media;
create trigger audit_episode_media after insert or update or delete on public.episode_media for each row execute function private.audit_media();
drop trigger if exists audit_episode_subtitles on public.episode_subtitles;
create trigger audit_episode_subtitles after insert or update or delete on public.episode_subtitles for each row execute function private.audit_media();

-- Nguồn phát theo ngôn ngữ. Quyền xem = đúng như get_playback_source (không lặp lại logic → không lệch quy tắc).
-- Trả về TOÀN BỘ media + phụ đề đã xuất bản của tập để Language Router (assets/language-router.js) tự chọn theo người xem;
-- 'language'/'sources' là gợi ý của máy chủ: p_language nếu có → 'vi' → bản gốc → ngôn ngữ đầu tiên.
-- Không có dòng media nào → trả nguồn v1 (legacy) kèm phụ đề.
create or replace function public.get_playback_media(p_episode_id uuid, p_language text default null)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  base jsonb := public.get_playback_source(p_episode_id);
  langs text[];
  pick text;
  subs jsonb;
  media jsonb;
begin
  if coalesce(base->>'status', '') not in ('ok', 'no_source') then return base; end if;
  subs := coalesce((select jsonb_agg(jsonb_build_object('language', s.language, 'label', s.label, 'source', s.source, 'url', s.url, 'default', s.is_default)
                                     order by s.language, s.source)
                      from public.episode_subtitles s where s.episode_id = p_episode_id and s.published), '[]'::jsonb);
  select array_agg(distinct m.language order by m.language) into langs
    from public.episode_media m where m.episode_id = p_episode_id and m.published;
  if langs is null then
    return base || jsonb_build_object('languages', '[]'::jsonb, 'legacy', true, 'media', '[]'::jsonb, 'subtitles', subs);
  end if;
  pick := case when p_language = any(langs) then p_language
               when 'vi' = any(langs) then 'vi'
               else coalesce((select m.language from public.episode_media m where m.episode_id = p_episode_id and m.published
                               and m.track_kind = 'original' order by m.priority limit 1), langs[1]) end;
  media := (select jsonb_agg(jsonb_build_object('language', m.language, 'provider', m.provider, 'external_id', m.external_id, 'url', m.url,
                                                'track_kind', m.track_kind, 'priority', m.priority, 'label', m.label)
                             order by m.language, m.priority, m.track_kind)
              from public.episode_media m where m.episode_id = p_episode_id and m.published);
  return jsonb_build_object('status', 'ok', 'legacy', false, 'language', pick, 'languages', to_jsonb(langs), 'media', media,
    'sources', (select jsonb_agg(x order by (x->>'priority')::int) from jsonb_array_elements(media) x where x->>'language' = pick),
    'subtitles', subs);
end $$;
revoke all on function public.get_playback_media(uuid, text) from public;
grant execute on function public.get_playback_media(uuid, text) to anon, authenticated;

commit;
