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

-- 6. Invariants -------------------------------------------------------------------
select t.ok(not exists (select 1 from public.wallets w where w.balance <> (select coalesce(sum(delta),0) from public.wallet_ledger l where l.user_id = w.user_id)), 'every wallet balance equals the sum of its ledger');
select t.ok(not exists (select 1 from public.wallets where balance < 0), 'no negative balances');
