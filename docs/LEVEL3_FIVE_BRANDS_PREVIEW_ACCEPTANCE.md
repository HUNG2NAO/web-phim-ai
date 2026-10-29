# Level 3 Five-Brand Preview — Acceptance & Rollout Record

**Status:** Preview candidate only. Never merge into main until explicitly approved.
**Base:** feature/level3-xuongphim-pilot-2026-10-29
**Target Cloudflare Pages project:** web-phim-ai-5sites
**Preview URL:** https://feature-level3-five-brands-p.web-phim-ai-5sites.pages.dev

## Scope verified in automated browser QA

- Same Level 3 hub implemented with feature flags for all five brands.
- Xưởng Phim & Phê Phim: futuristic demo catalog and respective accents.
- Kho Phim, Phim Hay & Ghiền Phim: historical demo catalog; legacy entries without `world` are treated as cổ trang.
- Real Chromium tests with **mocked authentication and fake database**: mobile width, desktop, favorites saved across reload, independent viewing profiles, guest gate, five brand-specific catalogs.
- Further E2E account dropdown → Member Hub → Profile navigation tests are tracked separately.
- No actual film/video streaming is verified.
- Production branch remains `main`, unchanged.

## Major constraints before enabling production on each domain

1. Real Supabase user sign-up, confirmed email, password recovery and authenticated refresh on each www domain.
2. Supabase Auth redirect allowlists; Google OAuth provider configured only when legitimately ready.
3. Browser origin isolation: every real domain has independent local session despite sharing an auth.users identity. **Preview query parameter switching is not proof of separate domain sessions.**
4. RLS cross-user tests with two separate authorized users, not just mocked accounts.
5. Privacy notice, deletion and data-export processes; custom SMTP for unrestricted user email delivery.
6. Avoid allowing public reviews to publish before moderation tools and abuse controls are ready.
7. Movie content distribution requires rights review. Resume playback on YouTube IFrame remains unavailable until integrated and tested.
8. Mobile accessibility, performance and actual user interaction across 5 production domains.
9. Supabase Security Advisor currently warns about leaked-password protection disabled. Check plan support and improve password protection before production launch.
10. Real film catalog, watch progress, notification delivery and true AI recommendation are not complete and must not be represented as such.

## Change strategy

The single file `assets/level3-config.js` gates rollout by brand. Five-brand enablement in this branch is **Preview only**. Production rollouts should be approved individually, with a way to revert to auth-only mode by removing a site ID from `enabledSites`. No copying or moving Supabase data between sites.

## Explicitly not part of this change

No updates to HUNGCREATOR.VN, its Supabase project, separate Windows tools, registrar DNS, Cloudflare redirect rules, or the production main branch.
