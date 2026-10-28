# AI Film Network — Level 3, Xưởng Phim pilot

Status: **Development Preview**, not Production. Branch: \`feature/level3-xuongphim-pilot-2026-10-29\`.

## Why pilot on one website?
The five movie brands share one vanilla HTML/CSS/JS repository and one Supabase Auth project. A new central rollout file \`assets/level3-config.js\` enables Xưởng Phim only. Do not enable four more sites until actual website UX and authorization have passed acceptance.

## Implemented
- /member.html: responsive member hub, Xưởng Phim branded, seven tabs and returning-to-film link.
- Viewer profiles: separate watchlists, preferences, reviews, and progress under one Supabase Auth account; **not** independent credentials/PINs or parental controls.
- Favorite, watch later and follow lists (can use the existing 36 demo films as test fixtures).
- Personal preferences: language, genre choices, content-based recommendations and playback tracking explicitly off by default.
- Recent progress/resume: only native videos actually playing, only when tracking is enabled by the user; demo films never invent watch data; YouTube IFrame tracking is *not* implemented.
- Review submission: RLS-private pending moderation; no unreviewed public posts or global ratings.
- Personal achievements inferred only from own stored actions; no fabricated XP or rankings.
- Notifications: empty inbox until a trusted server-side event publisher is built.
- Site feature flags + shared architecture for future Xưởng Phim → other brands rollout.
- Supabase migration \`level3_xuongphim_pilot_core_v1\` and index migration \`level3_pilot_fk_indexes_v1\`, applied only to \`ai-film-network\`, not HUNGCREATOR.
- GitHub Actions DOM simulations for viewer profile isolation, favorites, saved preferences, moderation and brand gating.

## Not complete / not marketed as functional
- Real film catalog, actual streaming videos (currently 36 labeled demos).
- YouTube IFrame playhead reporting, upload/dashboard, automated new episode notifications.
- Moderation dashboard, publicly approved community discussion, spam/reporting/blocking.
- Strong anti-fraud XP server ledger, verified leaderboards, gamified incentives.
- Production AI model recommendations and cross-site profile exchange; current rule-based suggestions are transparently labeled.
- Billing, paid membership, multiple independent family logins, age restrictions or parental controls.
- Privacy policy, consent records, data export/deletion endpoint and email sender for public scale.
- Actual mobile and multiple-browser QA on real production domains.

## Pilot verification checklist
1. Open branch Preview \`/member.html?site=xuongphim\` while signed in. Expect hub with zero invented watch stats.
2. Open \`/member.html?site=khophim\`; the full hub must remain gated.
3. Save favorite/watch later/follow for a sample film, reload: persistent values must match Supabase tables.
4. Create viewer profile B, switch; viewer B must not inherit A's lists, preferences, reviews or watch progress.
5. Preferences: content personalization and watch tracking default OFF. Change/toggle and verify persistence per profile.
6. Submit a review: \`moderation_status=pending\`, not publicly exposed.
7. Observe empty notifications and valid only-if-earned badges.
8. Native-video playback test with authorized MP4 and opt-in: resume location persist; OFF: nothing written.
9. Run DB advisors for RLS and indexes; confirm cross-account isolation with two permitted test accounts.
10. Test mobile viewport ~360/390px and desktop; check keyboard navigation and browser refresh.
11. Verify HUNGCREATOR and all five Production websites unchanged.
12. Never merge into main without approval and a rollback plan.

## Rollout to four other brands
Once the pilot truly passes, a PR may add each relevant site id to \`window.AFN_LEVEL3_CONFIG.enabledSites\` **one at a time**. Confirm brand detection, locale, content filters, OAuth redirect allowlist, independent domain sessions, and data isolation on that domain. Do not duplicate the SQL project, codebase, or user identities. Enable real film tracking only after the corresponding film player is integrated. 
