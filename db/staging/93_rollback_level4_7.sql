-- Gỡ Level 4.7 (nền đa ngôn ngữ). Chỉ xóa đối tượng MỚI của 4.7 — không đụng episode_sources, phim, tập, ví hay người dùng.
-- CẢNH BÁO: dữ liệu đã nhập vào episode_media / episode_subtitles (nếu có) sẽ mất → sao lưu 2 bảng này trước.
begin;
drop function if exists public.get_playback_media(uuid, text);
drop table if exists public.episode_subtitles;
drop table if exists public.episode_media;
drop function if exists private.audit_media();
commit;
