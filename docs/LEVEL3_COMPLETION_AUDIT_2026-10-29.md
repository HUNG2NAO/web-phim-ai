# Level 3 completion — Preview release audit (29 October 2026)

## Deployment boundary
- Repository: HUNG2NAO/web-phim-ai.
- Branch: feature/level3-completion-preview-2026-10-29.
- Production main is **untouched**. Original HUNGCREATOR project is **untouched**.
- Supabase project: **ai-film-network** (`jurvphonehknrxjpowoe`). Migrations were applied to this dedicated project.
- Do not merge this branch to production without separate user approval, rollback plan and real-domain QA.

## Implemented (functional pathways, subject to real-user acceptance)
1. Shared Auth identity, 5 independent origin sessions, sign-up/login/password reset and separate profile page.
2. Self-service display name, password update, email update confirmation request and logout.
3. Owner-only staff console `admin.html`, with Supabase RLS-stored `site_staff` roles (one existing verified owner has five site-admin records).
4. Legally attested YouTube ID or HTTPS native media metadata, draft/publish/unpublish/delete; only published rights-attested releases flow into the website's catalog.
5. Native MP4 playback progress, optional YouTube IFrame API watch progress and resuming, only if viewer explicitly enables tracking.
6. Viewer watchlists, following, profile separation, genre-based rule ranking and privacy settings.
7. Staff review moderation; approved comments appear in a separate sanitized public `approved_reviews` table (no author identifiers).
8. Site inbox messages sent by site admins; publish-event inbox messages for *opted-in* viewers who followed a film.
9. JSON download of user-owned account activity (excluding private Auth infrastructure), account-deletion **request** workflow with staff triage. Full auth-user deletion remains manual/admin-verified.
10. Activity deletion from viewer settings, deletion of secondary viewing profiles, default-off tracking/personalization/notifications.
11. Preview activation remains controlled by `assets/level3-config.js` and Cloudflare Pages preview branch.

## Tested and confirmed
- GitHub Actions runs JS syntax, auth contract and DOM tests.
- Real Chromium browser: 19/19 tests PASS using **mocked Supabase Auth/database**, including website navigation, responsive layout, account self-service, mock staff dashboard, favorites and data export.
- Database RLS flags enabled; a simulated authenticated non-staff role sees 0 site_staff rows, while the verified owner can see five.
- Transactional Supabase database QA verified (and rolled back) opt-in release notice generation and approval/rejection synchronization.
- Security Advisor: no database RLS warning; Supabase Auth **leaked-password protection disabled** remains an outstanding project-setting warning.
- No fake film views, history or notifications were left in the real database.

## NOT complete / external prerequisites (must not be advertised as ready)
- No user-supplied, rights-cleared videos have been imported. Real playback/resume needs valid published YouTube/MP4 sources and browser/device acceptance.
- No automatic new-episode ingestion/notifications: publishing a *film* can generate follow alerts; individual episode releases are not yet modelled.
- No remote LLM/semantic AI recommender is configured: existing recommendations are deterministic and transparently described as rule-based.
- Public signup emails and password/email changes require custom SMTP and valid Supabase Auth redirect allowlist for every Preview/Production domain.
- Google Login is disabled until OAuth credentials/consent screens are configured.
- Account deletion is a request queue; actual Auth deletion requires trusted/admin execution and verified user identity.
- No payment system, parental PIN, community abuse reporting and public rankings.
- Two real accounts, cross-account isolation, independently authenticated real five-domain origin sessions, multiple devices, mobile accessibility and performance still need acceptance.
- Film content rights still require human validation; the checkbox is an attestation, **not legal verification**.

## Pilot and release verification
1. Log into completion Preview with a legitimately created account. Open `account.html?site=xuongphim`.
2. Verify profile edits and password reset/email confirmation using allowed Supabase redirects and real SMTP.
3. Open `admin.html?site=xuongphim` as authorized owner; test unpublished draft with actual rights-cleared source and confirm no exposure to ordinary viewers.
4. Publish only after rights check, then verify movie card, player, and opt-in progress/resume in Chrome/Firefox/mobile.
5. Test two real authenticated accounts: non-staff is forbidden from moderation, publishing, reading other's profiles, and other private data.
6. Submit and review an actual comment; verify pending is private, approved appears in public feed, rejection removes it.
7. Opt into notifications, follow a legally-published film ID, publish from draft, verify the inbox event exactly once. Opt out and verify no new notice.
8. Download JSON and submit account-deletion request; staff dashboard should show request; do NOT claim request was processed before it is.
9. Verify all five real domains and www variants retain independent per-origin sessions and correct branding/content.
10. Before Production: enable leaked-password protection if supported, configure custom SMTP, legal documents/consent, domain allowlist, rate limits, monitoring, backups, and a rollback plan.

## Rollback
- GitHub: revert or do not merge this PR. For Preview, return to former Auth branch; Production branch `main` remains unchanged.
- DB migrations are additive; do not blindly drop tables with real member data. If reversing, perform backed-up, reviewed data migration.
