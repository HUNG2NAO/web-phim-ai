-- Level 4 functional + security tests. Run via tests/sql/run.sh on a THROWAWAY local database.
\set ON_ERROR_STOP 1
\set A '''aaaaaaaa-0000-4000-8000-000000000001'''
\set B '''aaaaaaaa-0000-4000-8000-000000000002'''
\set OWNER '''aaaaaaaa-0000-4000-8000-000000000003'''
\set KADMIN '''aaaaaaaa-0000-4000-8000-000000000004'''
\set XMOD '''aaaaaaaa-0000-4000-8000-000000000005'''

-- 1. Anonymous visitor -----------------------------------------------------------
begin; set local role anon;
select t.ok((select count(*) from public.site_films) = 2, 'anon reads published films only (Level 3 permission bug fixed)');
select t.ok((select count(*) from public.site_episodes where site_id='xuongphim') = 6, 'anon sees 6 published xuongphim episodes, not the draft');
select t.ok((select count(*) from public.site_social_links) = 1, 'anon sees only enabled social links');
select t.ok((select checkin_base from public.reward_rules) = 10, 'anon can read reward rules');
select t.err('select * from public.wallets', 'permission denied', 'anon cannot read wallets');
select t.err('select * from public.episode_sources', 'permission denied', 'anon cannot read playback sources table');
select t.err('select * from public.traffic_events', 'permission denied', 'anon cannot read traffic events');
select t.err($$select public.claim_daily_checkin('xuongphim')$$, 'permission denied', 'anon cannot check in');
select t.err($$select public.unlock_episode('eeeeeeee-0000-4000-8000-000000000002','anon-key-0001')$$, 'permission denied', 'anon cannot unlock');
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000001')->>'youtube_id' = 'EP1xxxxxxxx', 'anon gets source of a free episode');
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000002')->>'status' = 'login_required', 'anon gets login_required for early-access episode');
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000002')->>'youtube_id' is null, 'locked response contains no source');
select t.ok(not (public.get_playback_source('eeeeeeee-0000-4000-8000-000000000002') ? 'fallback'), 'locked response contains no fallback source either');
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000004')->>'status' = 'login_required', 'member episode needs login');
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000005')->>'status' = 'not_found', 'unpublished episode is not_found for anon');
select public.log_landing('xuongphim', '/', 'tin-hieu-47', 'facebook', 'social', 'ra-mat', 'abc_1');
select public.log_landing('xuongphim', '/', null, '', '', '', '');
select public.log_landing('khongco', '/', null, 'x', null, null, null);
commit;
select t.ok((select count(*) from public.traffic_events) = 1, 'only campaign landing on a valid site is recorded');

-- 2. Check-in --------------------------------------------------------------------
begin; set local role authenticated; select t.as_user(:A);
select t.ok((public.claim_daily_checkin('xuongphim')->>'points')::int = 10, 'A first check-in earns base 10 points');
select t.ok(public.claim_daily_checkin('xuongphim')->>'status' = 'already', 'second check-in same day is refused');
select t.ok(public.claim_daily_checkin('khophim')->>'status' = 'already', 'one check-in per day across the whole network');
select t.ok((select balance from public.wallets) = 10, 'A wallet balance = 10');
select t.ok((select count(*) from public.wallet_ledger) = 1, 'exactly one ledger row');
select t.err($$update public.wallets set balance = 999999$$, 'permission denied', 'A cannot edit own balance');
select t.err($$insert into public.wallet_ledger(user_id,kind,delta,balance_after,idempotency_key) values (auth.uid(),'admin_credit',100,100,'hack-00001')$$, 'permission denied', 'A cannot write ledger');
select t.err($$insert into public.daily_checkins(user_id,checkin_date,site_id,streak,points) values (auth.uid(), current_date+1,'xuongphim',1,999)$$, 'permission denied', 'A cannot forge check-ins');
select t.err($$select public.claim_daily_checkin('khong-ton-tai')$$, 'invalid_site', 'invalid site rejected');
commit;
begin; set local role authenticated; select t.as_user(:B);
select t.ok((select count(*) from public.wallets) = 0, 'B cannot see A wallet');
select t.ok((select count(*) from public.wallet_ledger) = 0, 'B cannot see A ledger');
commit;

-- streak: give B six previous days, then today is day 7 → base 10 + min(6,cap5)*2 + day7 30 = 50
insert into public.daily_checkins(user_id, checkin_date, site_id, streak, points)
select 'aaaaaaaa-0000-4000-8000-000000000002', private.vn_today() - g, 'xuongphim', 7 - g, 0 from generate_series(1, 6) g;
begin; set local role authenticated; select t.as_user(:B);
select t.ok((select public.claim_daily_checkin('xuongphim')) @> '{"status":"claimed","streak":7,"points":50,"day7":true}', 'day 7 streak earns 10 + 5*2 + 30 bonus = 50');
commit;

-- 3. Admin credit + unlocking ----------------------------------------------------
begin; set local role authenticated; select t.as_user(:OWNER);
select t.ok(public.admin_adjust_points(:A::uuid, 200, 'Thưởng thử nghiệm', 'grant-a-0001')->>'balance' = '210', 'network admin credits A 200');
select t.ok(public.admin_adjust_points(:A::uuid, 200, 'Thưởng thử nghiệm', 'grant-a-0001')->>'status' = 'replay', 'admin credit is idempotent');
select t.ok(public.admin_adjust_points(:A::uuid, -5000, 'Trừ quá số dư', 'grant-a-0002')->>'status' = 'insufficient', 'admin cannot push balance negative');
select t.err($$select public.admin_adjust_points('aaaaaaaa-0000-4000-8000-000000000001', 5, 'x', 'grant-a-0003')$$, 'reason_required', 'admin adjustment requires a reason');
commit;

begin; set local role authenticated; select t.as_user(:A);
select t.ok((select public.unlock_episode('eeeeeeee-0000-4000-8000-000000000002', 'req-a-ep2-0001')) @> '{"status":"unlocked","balance":160}', 'A unlocks early episode 2 for 50 points');
select t.ok((select public.unlock_episode('eeeeeeee-0000-4000-8000-000000000002', 'req-a-ep2-0001')) @> '{"status":"already_unlocked","balance":160,"replay":true}', 'replayed request is not charged again');
select t.ok((select public.unlock_episode('eeeeeeee-0000-4000-8000-000000000002', 'req-a-ep2-0002')) @> '{"status":"already_unlocked","balance":160}', 'new request for owned episode is not charged');
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000002')->>'youtube_id' = 'EP2xxxxxxxx', 'A receives source after unlocking');
select t.ok(public.unlock_episode('eeeeeeee-0000-4000-8000-000000000003', 'req-a-ep3-0001')->>'status' = 'free', 'early episode past free_from is free, no charge');
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000004')->>'video_url' = 'https://media.example.test/ep4.mp4', 'member episode plays for a signed-in user');
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000011')->>'status' = 'locked', 'xuongphim unlock does not open khophim episode (site isolation)');
select t.err($$select public.unlock_episode('eeeeeeee-0000-4000-8000-000000000005', 'req-a-ep5-0001')$$, 'episode_not_found', 'cannot unlock unpublished episode');
select t.err($$select public.unlock_episode('eeeeeeee-0000-4000-8000-000000000002', 'bad key!')$$, 'invalid_idempotency_key', 'malformed idempotency key rejected');
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000002')->'fallback'->>'video_url' = 'https://media.example.test/ep2-backup.mp4', 'fallback source delivered only together with an allowed primary');
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000001')->'fallback' = 'null'::jsonb, 'episode without backup returns fallback null');
select t.ok((select balance from public.wallets) = 160, 'A balance after all attempts = 160');
select t.ok((select count(*) from public.content_entitlements) = 1, 'A has exactly one entitlement');
select t.ok((select count(*) from public.wallet_ledger where kind = 'unlock') = 1, 'A has exactly one unlock debit');
select t.ok((select count(*) from public.episode_sources) = 0, 'viewer cannot list sources table rows');
commit;

begin; set local role authenticated; select t.as_user(:B);
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000002')->>'status' = 'locked', 'B (not unlocked) is locked out of episode 2');
select t.ok((select public.unlock_episode('eeeeeeee-0000-4000-8000-000000000011', 'req-b-k01-0001')) @> '{"status":"unlocked","balance":20}', 'B unlocks khophim episode for 30');
select t.ok((select public.unlock_episode('eeeeeeee-0000-4000-8000-000000000002', 'req-b-ep2-0001')) @> '{"status":"insufficient","balance":20,"price":50}', 'insufficient balance: no charge');
select t.ok((select balance from public.wallets) = 20, 'B balance unchanged after insufficient attempt');
select t.ok((select count(*) from public.content_entitlements) = 1, 'no entitlement created when payment fails');
commit;

-- entitlement expiry: A unlocks 3-day episode 6, then time passes
begin; set local role authenticated; select t.as_user(:A);
select t.ok((public.unlock_episode('eeeeeeee-0000-4000-8000-000000000006', 'req-a-ep6-0001')->>'expires_at') is not null, 'time-limited unlock has expiry');
commit;
update public.content_entitlements set expires_at = now() - interval '1 minute'
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and episode_id = 'eeeeeeee-0000-4000-8000-000000000006';
begin; set local role authenticated; select t.as_user(:A);
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000006')->>'status' = 'locked', 'expired entitlement no longer plays');
select t.ok((select public.unlock_episode('eeeeeeee-0000-4000-8000-000000000006', 'req-a-ep6-0002')) @> '{"status":"unlocked","balance":60}', 'expired content can be unlocked again (charged once more)');
select t.ok((select count(*) from public.content_entitlements where episode_id='eeeeeeee-0000-4000-8000-000000000006' and status='expired') = 1, 'old entitlement marked expired');
commit;

-- 4. Admin authorisation ---------------------------------------------------------
begin; set local role authenticated; select t.as_user(:A);
select t.err($$select public.admin_overview('xuongphim')$$, 'forbidden', 'viewer cannot open admin overview');
select t.err($$select public.admin_set_reward_rules(true, 999, 0, 0, 0)$$, 'forbidden', 'viewer cannot change reward rules');
select t.err($$select public.admin_adjust_points(auth.uid(), 1000, 'tự cộng điểm', 'self-0001')$$, 'forbidden', 'viewer cannot credit themselves');
select t.ok((select count(*) from public.admin_audit_log) = 0, 'viewer cannot read audit log');
commit;
begin; set local role authenticated; select t.as_user(:XMOD);
select t.ok((public.admin_overview('xuongphim')->>'members')::int = 2, 'moderator sees xuongphim overview with real member count');
select t.err($$select public.admin_overview('khophim')$$, 'forbidden', 'moderator of xuongphim cannot see khophim');
select t.err($$select * from public.admin_member_wallets('xuongphim')$$, 'forbidden', 'moderator cannot see member wallets (admin only)');
commit;
begin; set local role authenticated; select t.as_user(:KADMIN);
select t.ok((select count(*) from public.admin_member_wallets('khophim')) = 2, 'khophim admin lists khophim members with wallets');
select t.err($$select * from public.admin_member_wallets('xuongphim')$$, 'forbidden', 'khophim admin cannot list xuongphim members');
select t.err($$select public.admin_adjust_points('aaaaaaaa-0000-4000-8000-000000000002', 10, 'thử cộng điểm', 'kadm-0001')$$, 'forbidden', 'site admin cannot mint points (network owner only)');
select t.err($$insert into public.site_episodes(site_id,film_id,episode_no,created_by) values ('xuongphim','tin-hieu-47',9,auth.uid())$$, 'row-level security', 'khophim admin cannot add xuongphim episodes');
insert into public.site_episodes(site_id, film_id, episode_no, title, created_by, published) values ('khophim','kiem-khach',2,'Tập 2',auth.uid(),false);
select t.ok((select count(*) from public.episode_sources) = 1, 'khophim admin sees only khophim sources');
select t.ok((select public.admin_refund_unlock(c.id, 'Video lỗi, hoàn điểm') from public.admin_site_entitlements('khophim') c limit 1) @> '{"status":"refunded","points":30}', 'site admin refunds a khophim unlock');
select t.ok((select public.admin_refund_unlock(c.id, 'Hoàn lần hai') from public.admin_site_entitlements('khophim') c limit 1) @> '{"status":"not_refundable"}', 'refund cannot be applied twice');
select t.err($$select public.admin_refund_unlock((select id from public.content_entitlements limit 1), 'không có quyền')$$, 'entitlement_not_found|forbidden', 'site admin cannot see/refund other users entitlements directly');
commit;
begin; set local role authenticated; select t.as_user(:B);
select t.ok((select balance from public.wallets) = 50, 'B received the 30 points back');
select t.ok((select count(*) from public.wallet_ledger where kind='refund') = 1, 'refund recorded in ledger');
select t.ok(public.get_playback_source('eeeeeeee-0000-4000-8000-000000000011')->>'status' = 'locked', 'refunded content is locked again');
commit;
begin; set local role authenticated; select t.as_user(:KADMIN);
select t.err($$select public.admin_refund_unlock(c.id, 'thử hoàn điểm site khác') from public.content_entitlements c where false union all select public.admin_refund_unlock((select c2.id from public.admin_site_entitlements('khophim') c2 limit 1), 'x')$$, 'reason_required|not_refundable', 'refund requires a reason');
commit;
begin; set local role authenticated; select t.as_user(:OWNER);
select t.ok((select checkin_base from public.admin_set_reward_rules(true, 20, 3, 4, 40)) = 20, 'network owner updates reward rules');
select t.ok((select count(*) from public.admin_audit_log where action = 'reward_rules.update') = 1, 'rule change is audited');
select t.ok((select count(*) from public.admin_audit_log where action = 'wallet.adjust') = 1, 'manual points adjustment is audited');
select t.ok((select count(*) from public.admin_audit_log where action like 'site_episodes.%') >= 1, 'episode changes are audited by trigger');
commit;
begin; set local role authenticated; select t.as_user(:KADMIN);
select t.ok((select count(*) from public.admin_audit_log where site_id is distinct from 'khophim') = 0, 'site admin reads only own-site audit rows');
select t.ok((select count(*) from public.admin_audit_log where action = 'entitlement.refund') = 1, 'refund is audited');
commit;

-- 5. Reports, social links, traffic ------------------------------------------------
begin; set local role authenticated; select t.as_user(:A);
insert into public.content_reports(site_id, film_id, episode_no, kind, note) values ('xuongphim','tin-hieu-47',2,'video_error','Không phát được');
select t.err($$insert into public.content_reports(site_id,film_id,kind,status) values ('xuongphim','tin-hieu-47','other','resolved')$$, 'row-level security', 'viewer cannot file a pre-resolved report');
commit;
begin; set local role authenticated; select t.as_user(:B);
select t.ok((select count(*) from public.content_reports) = 0, 'B cannot see A report');
commit;
begin; set local role authenticated; select t.as_user(:XMOD);
select t.ok((select count(*) from public.content_reports where site_id='xuongphim') = 1, 'xuongphim moderator sees the report');
update public.content_reports set status='resolved', handled_at=now(), handled_by=auth.uid() where site_id='xuongphim';
select t.ok((select status from public.content_reports limit 1) = 'resolved', 'moderator resolves report');
commit;
begin; set local role authenticated; select t.as_user(:A);
select t.err($$insert into public.content_reports(site_id,film_id,kind) select 'xuongphim','tin-hieu-47','other' from generate_series(1,25)$$, 'report_rate_limited', 'reports are rate limited (20 per 24h)');
commit;
begin; set local role authenticated; select t.as_user(:KADMIN);
insert into public.site_social_links(site_id, platform, label, url) values ('khophim','youtube','Kênh YouTube','https://www.youtube.com/@example-test');
select t.err($$insert into public.site_social_links(site_id,platform,label,url) values ('xuongphim','tiktok','x','https://www.tiktok.com/@x')$$, 'row-level security', 'khophim admin cannot edit xuongphim social links');
select t.err($$insert into public.site_social_links(site_id,platform,label,url) values ('khophim','other','x','javascript:alert(1)')$$, 'check constraint', 'non-https social URL rejected');
select t.err($$update public.episode_sources set fallback_kind='native', fallback_video_url='http://insecure.example.test/a.mp4' where episode_id='eeeeeeee-0000-4000-8000-000000000011'$$, 'fallback_valid', 'fallback must be HTTPS');
select t.err($$update public.episode_sources set fallback_kind='youtube', fallback_youtube_id='short' where episode_id='eeeeeeee-0000-4000-8000-000000000011'$$, 'fallback_valid', 'fallback YouTube ID must be 11 characters');
update public.episode_sources set fallback_kind='youtube', fallback_youtube_id='K01backup00' where episode_id='eeeeeeee-0000-4000-8000-000000000011';
select t.ok((select fallback_youtube_id from public.episode_sources where episode_id='eeeeeeee-0000-4000-8000-000000000011') = 'K01backup00', 'site admin sets a backup source for own-site episode');
select t.ok((select count(*) from public.admin_audit_log where action = 'episode_sources.update') >= 1, 'backup source change is audited');
commit;
begin; set local role authenticated; select t.as_user(:OWNER);
select t.ok((select visits from public.admin_traffic('xuongphim', 7) where utm_source='facebook') = 1, 'traffic dashboard groups campaign visits');
commit;

-- 7. Community chat (Level 4.2) ------------------------------------------------------
begin; set local role anon;
select t.err($$select public.send_chat_message('network','xin chào')$$, 'permission denied', 'anon cannot send chat');
select t.err($$select * from public.chat_messages$$, 'permission denied', 'anon cannot read chat');
commit;
begin; set local role authenticated; select t.as_user(:A);
select t.ok((public.send_chat_message('network', '  Xin chào   mọi người 👋  ')).body = 'Xin chào mọi người 👋', 'A sends to network room, whitespace normalised, emoji kept');
select t.ok((select display_name from public.chat_messages where user_id = auth.uid() limit 1) = 'Khán giả A', 'author name comes from server-side profile');
select t.ok((public.send_chat_message('film:xuongphim:tin-hieu-47', '<img src=x onerror=alert(1)> phim hay')).body like '<img%', 'HTML is stored as plain text (UI renders textContent)');
select t.err($$select public.send_chat_message('network', 'Xin chào mọi người 👋')$$, 'chat_duplicate', 'identical message within 60s is refused');
select t.err($$select public.send_chat_message('phong-la', 'x')$$, 'invalid_room', 'unknown room refused');
select t.err($$select public.send_chat_message('film:khongco:abc', 'x')$$, 'invalid_room', 'film room of unknown site refused');
select t.err($$select public.send_chat_message('network', '   ')$$, 'empty_message', 'empty message refused');
select t.err($$select public.send_chat_message('network', repeat('a', 501))$$, 'message_too_long', 'message over 500 chars refused');
select t.err($$insert into public.chat_messages(room,user_id,display_name,body) values ('network', auth.uid(), 'Admin thật', 'giả mạo')$$, 'permission denied', 'direct insert (sender spoofing) is impossible');
select t.err($$update public.chat_messages set body = 'sửa' where user_id = auth.uid()$$, 'permission denied', 'members cannot edit messages');
select public.send_chat_message('network', 'tin 3');
select public.send_chat_message('network', 'tin 4');
select public.send_chat_message('network', 'tin 5');
select t.err($$select public.send_chat_message('network', 'tin 6')$$, 'chat_rate_limited', 'more than 5 messages per 30s is rate limited');
commit;
begin; set local role authenticated; select t.as_user(:B);
select t.ok((select count(*) from public.chat_messages where room = 'network') = 4, 'B reads the network room history');
select t.ok((public.report_chat_message((select id from public.chat_messages where room like 'film:%' limit 1), 'spam', 'thử báo cáo'))->>'status' = 'reported', 'B reports A film-room message');
select t.ok((public.report_chat_message((select id from public.chat_messages where room like 'film:%' limit 1), 'spam', 'lần 2'))->>'status' = 'reported', 'reporting twice is idempotent');
select t.ok((select count(*) from public.chat_reports) = 1, 'B sees exactly own single report');
select t.err($$select public.chat_moderate_message((select id from public.chat_messages limit 1), true, 'thử ẩn')$$, 'forbidden', 'member cannot hide messages');
select t.err($$select public.chat_set_mute('aaaaaaaa-0000-4000-8000-000000000001', 60, 'thử khóa')$$, 'forbidden', 'member cannot mute others');
select t.err($$select * from public.admin_chat_reports(null)$$, 'forbidden', 'member cannot list reports');
commit;
begin; set local role authenticated; select t.as_user(:KADMIN);
select t.ok((select count(*) from public.admin_chat_reports('open') where room like 'film:xuongphim:%') = 0, 'khophim admin does not see xuongphim film-room reports');
select t.err($$select public.chat_moderate_message((select id from public.chat_messages where room like 'film:xuongphim:%' limit 1), true, 'không đúng site')$$, 'forbidden', 'khophim admin cannot moderate xuongphim film room');
commit;
begin; set local role authenticated; select t.as_user(:XMOD);
select t.ok((select count(*) from public.admin_chat_reports('open')) = 1, 'xuongphim moderator sees the open report');
select t.ok((public.chat_moderate_message((select message_id from public.admin_chat_reports('open') limit 1), true, 'Nội dung HTML'))->>'status' = 'hidden', 'moderator hides the reported film-room message');
select t.ok((select count(*) from public.admin_chat_reports('open')) = 0, 'hiding resolves the report');
select t.err($$select public.chat_set_mute('aaaaaaaa-0000-4000-8000-000000000001', 60, 'spam')$$, 'forbidden', 'moderator (not admin) cannot mute network-wide');
commit;
begin; set local role authenticated; select t.as_user(:B);
select t.ok((select count(*) from public.chat_messages where room like 'film:%') = 0, 'hidden message disappears for other members');
commit;
begin; set local role authenticated; select t.as_user(:A);
select t.ok((select count(*) from public.chat_messages where room like 'film:%') = 1, 'author still sees own hidden message');
commit;
begin; set local role authenticated; select t.as_user(:OWNER);
select t.ok((public.chat_set_mute('aaaaaaaa-0000-4000-8000-000000000002', 60, 'Thử khóa chat QA'))->>'status' = 'muted', 'network owner mutes B for 60 minutes');
select t.err($$select public.chat_set_mute(auth.uid(), 60, 'tự khóa')$$, 'cannot_mute_self', 'cannot mute yourself');
commit;
begin; set local role authenticated; select t.as_user(:B);
select t.err($$select public.send_chat_message('network', 'tôi bị khóa?')$$, 'chat_muted', 'muted member cannot send');
select t.ok((select muted_until > now() from public.chat_mutes) is true, 'muted member can see own mute status');
commit;
begin; set local role authenticated; select t.as_user(:OWNER);
select t.ok((public.chat_set_mute('aaaaaaaa-0000-4000-8000-000000000002', 0, 'Mở khóa sau kiểm tra'))->>'status' = 'unmuted', 'owner restores B chat rights');
select t.ok((public.chat_moderate_message((select id from public.chat_messages where room like 'film:%' limit 1), false, 'Khôi phục thử'))->>'status' = 'restored', 'owner restores hidden message');
select t.ok((select count(*) from public.admin_audit_log where action in ('chat.hide','chat.restore','chat.mute','chat.unmute')) = 4, 'chat moderation is fully audited');
commit;
begin; set local role authenticated; select t.as_user(:B);
select t.ok((public.send_chat_message('network', 'Cảm ơn admin')).body = 'Cảm ơn admin', 'B can send again after unmute');
commit;
-- người mới đăng ký chưa có hồ sơ: tên lấy từ lúc đăng ký, không lộ email
update auth.users set raw_user_meta_data = '{"display_name":"QA TEST 6"}' where id = 'aaaaaaaa-0000-4000-8000-000000000006';
begin; set local role authenticated; select t.as_user('aaaaaaaa-0000-4000-8000-000000000006');
select t.ok((public.send_chat_message('network', 'Thành viên mới chào cả nhà')).display_name = 'QA TEST 6', 'new member without profile shows signup display name');
commit;
begin; set local role authenticated; select t.as_user('aaaaaaaa-0000-4000-8000-000000000007');
select t.ok((public.send_chat_message('network', 'Không có tên')).display_name = 'Thành viên', 'member without any name shows neutral label, never the e-mail');
commit;

-- 7. Level 4.3: cách ly quản trị theo website + quy trình yêu cầu quyền riêng tư --------------
\set U1 '''aaaaaaaa-0000-4000-8000-0000000000a1'''
\set U2 '''aaaaaaaa-0000-4000-8000-0000000000a2'''
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-4000-8000-0000000000a1', 'privacy-u1@example.test', now(), '{"display_name":"U1"}'),
 ('aaaaaaaa-0000-4000-8000-0000000000a2', 'privacy-u2@example.test', now(), '{"display_name":"U2"}'),
 ('aaaaaaaa-0000-4000-8000-0000000000a3', 'creator-u3@example.test', now(), '{}');
begin; set local role authenticated; select t.as_user(:U1);
select public.claim_daily_checkin('xuongphim');
select public.send_chat_message('film:khophim:kiem-khach', 'U1 ở phòng Kho Phim');
select public.send_chat_message('film:xuongphim:tin-hieu-47', 'U1 ở phòng Xưởng Phim');
select public.send_chat_message('network', 'U1 ở phòng chung');
commit;
begin; set local role authenticated; select t.as_user(:U2);
select public.report_chat_message(id, 'spam', 'QA 4.3') from public.chat_messages where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1';
select t.ok((select count(*) from public.chat_reports where reporter = auth.uid()) = 3, 'U2 reads the 3 reports it filed');
commit;
begin; set local role authenticated; select t.as_user(:KADMIN);
select t.ok((select count(*) from public.chat_reports r join public.chat_messages m on m.id = r.message_id where m.room like 'film:xuongphim:%') = 0, 'khophim admin cannot read reports from xuongphim rooms (isolation fix)');
select t.ok((select count(*) from public.chat_reports r join public.chat_messages m on m.id = r.message_id where m.user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1' and m.room = 'film:khophim:kiem-khach') = 1, 'khophim admin reads reports from its own film room');
select t.ok((select count(*) from public.chat_reports r join public.chat_messages m on m.id = r.message_id where m.user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1' and m.room = 'network') = 1, 'site admin reads network-room reports (network room moderated by admins)');
select t.ok((select count(*) from public.chat_reports where reporter = 'aaaaaaaa-0000-4000-8000-0000000000a2') = 2, 'khophim admin sees exactly 2 of U2 reports');
commit;
begin; set local role authenticated; select t.as_user(:XMOD);
select t.ok((select count(*) from public.chat_reports where reporter = 'aaaaaaaa-0000-4000-8000-0000000000a2') = 1, 'xuongphim moderator sees only the xuongphim-room report');
select t.ok((select count(*) from public.chat_reports r join public.chat_messages m on m.id = r.message_id where m.room = 'network') = 0, 'moderator (non-admin) cannot read network-room reports');
commit;
begin; set local role authenticated; select t.as_user(:OWNER);
select public.chat_set_mute('aaaaaaaa-0000-4000-8000-0000000000a1', 60, 'QA 4.3 mute');
select t.ok((select count(*) from public.chat_reports where reporter = 'aaaaaaaa-0000-4000-8000-0000000000a2') = 3, 'network owner reads all reports');
commit;
begin; set local role authenticated; select t.as_user(:XMOD);
select t.ok((select count(*) from public.chat_mutes) = 0, 'moderator cannot read the network mute list');
commit;
begin; set local role authenticated; select t.as_user(:KADMIN);
select t.ok((select count(*) from public.chat_mutes where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1') = 1, 'site admin can read mutes (mute is network-wide, admins enforce it)');
commit;
begin; set local role authenticated; select t.as_user(:U1);
select t.ok((select count(*) from public.chat_mutes) = 1, 'muted member sees own mute');
commit;
begin; set local role authenticated; select t.as_user(:OWNER);
select public.chat_set_mute('aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'QA 4.3 unmute');
commit;

-- privacy requests
begin; set local role authenticated; select t.as_user(:U1);
insert into public.member_privacy_requests(user_id, site_id, request_type) values (auth.uid(), 'xuongphim', 'delete_account');
select t.err($$insert into public.member_privacy_requests(user_id, site_id, request_type) values (auth.uid(), 'khophim', 'delete_account')$$, 'duplicate key', 'only one open delete request per member');
select t.err($$insert into public.member_privacy_requests(user_id, site_id, request_type) values ('aaaaaaaa-0000-4000-8000-0000000000a2', 'xuongphim', 'delete_account')$$, 'row-level security', 'cannot file a request for someone else');
select t.err($$update public.member_privacy_requests set status = 'completed'$$, 'permission denied', 'member cannot change request status');
select t.ok((select subject_id = user_id from public.member_privacy_requests), 'subject_id set server-side');
commit;
begin; set local role authenticated; select t.as_user(:KADMIN);
select t.ok((select count(*) from public.member_privacy_requests where site_id = 'xuongphim') = 0, 'khophim admin cannot read xuongphim privacy requests');
select t.err($$select public.admin_privacy_request_set_status((select id from public.member_privacy_requests where subject_id is not null limit 1), 'in_review')$$, 'not_found|forbidden', 'khophim admin cannot handle xuongphim requests');
select t.err($$update public.member_privacy_requests set status = 'in_review'$$, 'permission denied', 'direct UPDATE no longer allowed for staff');
commit;
begin; set local role authenticated; select t.as_user(:XMOD);
select t.ok((select count(*) from public.member_privacy_requests) = 0, 'moderator (non-admin) cannot read privacy requests');
commit;
select set_config('t.req', (select id::text from public.member_privacy_requests where subject_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), false);
begin; set local role authenticated; select t.as_user(:OWNER);
select t.err($$select public.admin_privacy_request_set_status(current_setting('t.req')::uuid, 'completed')$$, 'invalid_transition', 'pending cannot jump to completed');
select t.err($$select public.admin_privacy_request_set_status(current_setting('t.req')::uuid, 'rejected', 'x')$$, 'note_required', 'rejecting requires a reason');
select t.ok((public.admin_privacy_request_set_status(current_setting('t.req')::uuid, 'in_review', 'Đang xác minh'))->>'status' = 'in_review', 'owner moves request to in_review');
select t.err($$select public.admin_privacy_request_set_status(current_setting('t.req')::uuid, 'completed')$$, 'use_account_deletion', 'delete requests can only complete through the deletion executor');
commit;
select t.ok((select count(*) from public.member_notifications where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1' and event_key like 'privacy:%:in_review') = 1, 'member is notified when request goes in_review');
select t.ok(exists (select 1 from public.admin_audit_log where action = 'privacy.in_review'), 'status change is audited');
begin; set local role authenticated; select t.as_user(:U1);
select t.ok((select count(*) from public.member_notifications where event_key like 'privacy:%') = 1, 'member reads the status notification');
commit;
begin; set local role authenticated; select t.as_user(:KADMIN);
select t.err($$select public.admin_execute_account_deletion(current_setting('t.req')::uuid, 'privacy-u1@example.test', false)$$, 'forbidden', 'site admin cannot execute account deletion');
commit;
begin; set local role authenticated; select t.as_user(:OWNER);
select t.err($$select public.admin_execute_account_deletion(current_setting('t.req')::uuid, 'sai@example.test', false)$$, 'email_mismatch', 'deletion requires typing the member e-mail');
select t.ok((public.admin_execute_account_deletion(current_setting('t.req')::uuid, ''))->>'status' = 'dry_run', 'default call is a dry run (no e-mail needed to preview)');
select t.ok((public.admin_execute_account_deletion(current_setting('t.req')::uuid, ''))->>'email_hint' = 'pr***@example.test', 'dry run shows a masked e-mail hint only');
select t.ok(((public.admin_execute_account_deletion(current_setting('t.req')::uuid, 'privacy-u1@example.test'))->'counts'->>'chat_messages')::int = 3, 'dry run counts the member chat messages');
commit;
select t.ok(exists (select 1 from auth.users where id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), 'dry run deletes nothing');
begin; set local role authenticated; select t.as_user(:OWNER);
select t.ok((public.admin_execute_account_deletion(current_setting('t.req')::uuid, ' PRIVACY-U1@example.test ', false))->>'status' = 'deleted', 'owner executes deletion (e-mail compared case-insensitively)');
commit;
select t.ok(not exists (select 1 from auth.users where id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), 'account removed');
select t.ok(not exists (select 1 from public.wallet_ledger where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1')
        and not exists (select 1 from public.chat_messages where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1')
        and not exists (select 1 from public.daily_checkins where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), 'wallet ledger, chat and check-ins of the deleted member are gone');
select t.ok((select status = 'completed' and user_id is null from public.member_privacy_requests where subject_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), 'request record kept (pseudonymous subject_id) as proof of handling');
select t.ok(exists (select 1 from public.admin_audit_log where action = 'privacy.account_deleted' and details->>'subject' = 'aaaaaaaa-0000-4000-8000-0000000000a1' and details::text not like '%@%'), 'deletion audited without e-mail');
select t.ok((select count(*) from public.chat_reports where reporter = 'aaaaaaaa-0000-4000-8000-0000000000a2') = 0, 'reports on the deleted member messages are gone with the messages');

-- staff accounts cannot be deleted through the member flow
begin; set local role authenticated; select t.as_user(:XMOD);
insert into public.member_privacy_requests(user_id, site_id, request_type) values (auth.uid(), 'xuongphim', 'delete_account');
commit;
select set_config('t.req2', (select id::text from public.member_privacy_requests where subject_id = 'aaaaaaaa-0000-4000-8000-000000000005'), false);
begin; set local role authenticated; select t.as_user(:OWNER);
select public.admin_privacy_request_set_status(current_setting('t.req2')::uuid, 'in_review');
select t.err($$select public.admin_execute_account_deletion(current_setting('t.req2')::uuid, 'xp-mod@example.test', false)$$, 'target_is_staff', 'staff must lose their role before deletion');
select t.ok((public.admin_privacy_request_set_status(current_setting('t.req2')::uuid, 'rejected', 'Tài khoản quản trị: gỡ quyền trước'))->>'status' = 'rejected', 'owner rejects with a reason');
commit;

-- creators can be deleted: films stay, created_by becomes NULL
insert into public.site_films(site_id, film_id, title, source_kind, youtube_id, rights_attested, published, created_by, film_type)
values ('khophim', 'phim-cua-u3', 'Phim của U3', 'youtube', 'DDDDDDDDDDD', true, false, 'aaaaaaaa-0000-4000-8000-0000000000a3', 'le');
delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-0000000000a3';
select t.ok((select created_by is null from public.site_films where film_id = 'phim-cua-u3'), 'deleting a creator keeps the film (created_by → NULL)');
delete from public.site_films where film_id = 'phim-cua-u3';

-- self export
begin; set local role anon;
select t.err($$select public.my_data_export()$$, 'permission denied', 'anon cannot export');
commit;
begin; set local role authenticated; select t.as_user(:U2);
select t.ok((public.my_data_export())->'account'->>'email' = 'privacy-u2@example.test', 'export contains own account');
select t.ok(jsonb_typeof((public.my_data_export())->'wallet_ledger') = 'array' and jsonb_typeof((public.my_data_export())->'chat_messages') = 'array', 'export includes ledger and chat sections');
select t.ok(not ((public.my_data_export())::text like '%privacy-u1%' or (public.my_data_export())::text like '%viewer-a@%'), 'export contains no other member data');
commit;

-- 8. Level 4.4: công tắc Community Chat phía máy chủ ------------------------------------------
begin; set local role anon;
select t.ok((select count(*) from public.chat_settings where enabled) = 6, 'all 6 chat scopes open by default (Preview behaviour preserved)');
commit;
begin; set local role authenticated; select t.as_user(:U2);
select t.ok((public.send_chat_message('film:khophim:kiem-khach', 'U2 trước khi đóng Kho Phim')).room = 'film:khophim:kiem-khach', 'member sends while open');
select t.err($$update public.chat_settings set enabled = false$$, 'permission denied', 'member cannot flip the switch directly');
select t.err($$select public.admin_set_chat_enabled('khophim', false, 'tự đóng chơi')$$, 'forbidden', 'member cannot close chat');
commit;
select set_config('t.kho_before', (select count(*)::text from public.chat_messages where room = 'film:khophim:kiem-khach'), false);
begin; set local role authenticated; select t.as_user(:KADMIN);
select t.err($$select public.admin_set_chat_enabled('khophim', false, 'x')$$, 'reason_required', 'closing needs a reason');
select t.err($$select public.admin_set_chat_enabled('nowhere', false, 'đóng thử nghiệm')$$, 'invalid_scope', 'unknown scope rejected');
select t.ok((public.admin_set_chat_enabled('khophim', false, 'Tạm đóng chờ đánh giá pháp lý'))->>'enabled' = 'false', 'khophim admin closes khophim film rooms');
select t.err($$select public.admin_set_chat_enabled('xuongphim', false, 'đóng site người khác')$$, 'forbidden', 'khophim admin cannot close another site');
select t.err($$select public.admin_set_chat_enabled('khophim', true, 'tự mở lại')$$, 'forbidden', 'only the network owner may re-open chat');
commit;
begin; set local role authenticated; select t.as_user(:U2);
select t.err($$select public.send_chat_message('film:khophim:kiem-khach', 'gửi khi đóng')$$, 'chat_disabled', 'API send blocked while khophim chat is closed');
select t.ok((select count(*) from public.chat_messages where room = 'film:khophim:kiem-khach') = 0, 'members cannot read closed rooms (RLS → Realtime also silent)');
select t.ok((public.send_chat_message('film:xuongphim:tin-hieu-47', 'Xưởng Phim vẫn mở')).room = 'film:xuongphim:tin-hieu-47', 'other sites stay open (per-site switch)');
select t.ok((public.send_chat_message('network', 'Phòng chung vẫn mở')).room = 'network', 'network room stays open');
commit;
select set_config('t.kho_msg', (select id::text from public.chat_messages where room = 'film:khophim:kiem-khach' order by created_at limit 1), false);
begin; set local role authenticated; select t.as_user('aaaaaaaa-0000-4000-8000-000000000006');
select t.err($$select public.report_chat_message(current_setting('t.kho_msg')::uuid, 'spam', 'đóng rồi')$$, 'chat_disabled', 'reporting into a closed room blocked');
commit;
begin; set local role authenticated; select t.as_user(:KADMIN);
select t.ok((select count(*) from public.chat_messages where room = 'film:khophim:kiem-khach') = current_setting('t.kho_before')::int, 'khophim staff still read the closed room (moderation)');
select public.chat_moderate_message(current_setting('t.kho_msg')::uuid, true, 'Dọn nội dung khi đóng');
select t.ok((select hidden from public.chat_messages where id = current_setting('t.kho_msg')::uuid), 'moderation (hide) still works while closed');
select t.err($$select public.send_chat_message('film:khophim:kiem-khach', 'admin gửi khi đóng')$$, 'chat_disabled', 'closed means closed for staff too');
commit;
begin; set local role authenticated; select t.as_user(:XMOD);
select t.ok((select count(*) from public.chat_messages where room = 'film:khophim:kiem-khach') = 0, 'staff of another site cannot read the closed khophim room');
select t.err($$select public.admin_set_chat_enabled('network', false, 'moderator đóng phòng chung')$$, 'forbidden', 'moderator (non-admin) cannot close the network room');
commit;
-- trigger cũng chặn mọi đường ghi khác (kể cả vai trò quản trị CSDL)
select t.err($$insert into public.chat_messages(room, user_id, display_name, body) values ('film:khophim:kiem-khach', 'aaaaaaaa-0000-4000-8000-0000000000a2', 'x', 'ghi thẳng')$$, 'chat_disabled', 'direct insert into a closed room blocked by trigger');
begin; set local role authenticated; select t.as_user(:KADMIN);
select t.ok((public.admin_set_chat_enabled('network', false, 'Khẩn cấp: spam phòng chung'))->>'enabled' = 'false', 'site admin can emergency-close the network room');
commit;
begin; set local role authenticated; select t.as_user(:U2);
select t.err($$select public.send_chat_message('network', 'gửi khi phòng chung đóng')$$, 'chat_disabled', 'network send blocked while closed');
commit;
begin; set local role authenticated; select t.as_user(:OWNER);
select t.ok((public.admin_set_chat_enabled('network', true, 'Mở lại sau xử lý spam'))->>'enabled' = 'true', 'owner re-opens network room');
select t.ok((public.admin_set_chat_enabled('khophim', true, 'Mở lại sau đánh giá'))->>'enabled' = 'true', 'owner re-opens khophim');
commit;
begin; set local role authenticated; select t.as_user(:U2);
select t.ok((select count(*) from public.chat_messages where room = 'film:khophim:kiem-khach' and not hidden) = current_setting('t.kho_before')::int - 1, 're-opened: earlier messages visible again (data kept; the one hidden while closed stays hidden)');
select t.ok((public.send_chat_message('film:khophim:kiem-khach', 'Đã mở lại')).body = 'Đã mở lại', 'sending works again after re-open');
commit;
select t.ok((select count(*) from public.admin_audit_log where action in ('chat.disable', 'chat.enable')) = 4, 'every switch change is audited (2 close + 2 open)');
-- phạm vi thiếu cấu hình → đóng (an toàn mặc định)
delete from public.chat_settings where scope = 'phimhay';
begin; set local role authenticated; select t.as_user(:U2);
select t.err($$select public.send_chat_message('film:phimhay:bat-ky', 'không có cấu hình')$$, 'chat_disabled|invalid_room', 'scope without a settings row is treated as closed');
commit;
insert into public.chat_settings(scope) values ('phimhay');

-- 9. Level 4.5: tăng cứng quyền ------------------------------------------------------------
begin; set local role authenticated; select t.as_user(:U2);
select t.err($$truncate public.profiles$$, 'permission denied', 'authenticated cannot TRUNCATE (TRUNCATE bypasses RLS)');
select t.err($$truncate public.watch_progress$$, 'permission denied', 'authenticated cannot TRUNCATE watch_progress');
select t.err($$update public.site_memberships set site_id = 'khophim'$$, 'permission denied', 'no UPDATE grant where no UPDATE policy exists');
insert into public.profiles(id, display_name) values (auth.uid(), 'U2 hồ sơ') on conflict (id) do update set display_name = excluded.display_name;
select t.ok((select display_name from public.profiles where id = auth.uid()) = 'U2 hồ sơ', 'member profile upsert still works (needed by account page)');
commit;
begin; set local role anon;
select t.err($$truncate public.site_films$$, 'permission denied', 'anon cannot TRUNCATE');
commit;
select t.ok((select count(*) from private.grant_hardening_log where privilege = 'TRUNCATE') >= 8, 'revoked privileges are logged for exact rollback');
insert into public.traffic_events(site_id, path, utm_source) select 'phephim', '/', 'flood' from generate_series(1, 300);
begin; set local role anon;
select public.log_landing('phephim', '/', null, 'facebook', 'social', 'flood-test', null);
commit;
select t.ok((select count(*) from public.traffic_events where site_id = 'phephim') = 300, 'log_landing flood cap: max 300 landings/minute/site');
begin; set local role anon;
select public.log_landing('phimhay', '/', null, 'facebook', 'social', 'binh-thuong', null);
commit;
select t.ok((select count(*) from public.traffic_events where site_id = 'phimhay') = 1, 'other sites unaffected by the cap');

-- 6. Invariants -------------------------------------------------------------------
select t.ok(not exists (select 1 from public.wallets w where w.balance <> (select coalesce(sum(delta),0) from public.wallet_ledger l where l.user_id = w.user_id)), 'every wallet balance equals the sum of its ledger');
select t.ok(not exists (select 1 from public.wallets where balance < 0), 'no negative balances');
