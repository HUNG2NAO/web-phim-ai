# LEVEL 3 — PREMIUM UI/UX DESIGN PASS

**Status:** Cloudflare Preview only, no merge into `main`.
**Reference:** `feature/level3-completion-preview-2026-10-29`.
**Design branch:** `feature/level3-premium-uiux-2026-10-29`.
**Preview:** https://feature-level3-premium-uiux.web-phim-ai-5sites.pages.dev

## Design system
- Reuse `assets/sites.js` for five brand accents, names, seals and content worlds. **Do not replace logos**.
- New additive `assets/premium-ui.css` shares spacing, focus states, touch targets, typography, media queries and brand theming.
- Colors: Xưởng Phim `#3FD0F5`, Kho Phim `#4FB08F`, Phê Phim `#FF4F7B`, Phim Hay `#E8673A`, Ghiền Phim `#A68BE0`.
- Futuristic world uses deep blue-black; historical world uses muted warm black, both keeping brand accent reserved for meaningful actions.
- Use Be Vietnam Pro for interface and Chakra Petch for brand header. All screen views keep visible keyboard focus and opt out of unnecessary animation with `prefers-reduced-motion`.

## Implemented
1. **Content-first member home**: Continue Watching and Recommendations precede the account statistics. Status numbers remain based on actual stored data.
2. **Featured film area**: Existing `InkArt.paint` draws a deterministic illustration of the brand's featured demo; descriptions clearly call sample titles illustrations.
3. **Real visual film cards**: 3:4 poster art, live/demo badges, plain-text film metadata, consent-aware progress bar, watch action only for legitimately published movies, separate Favorite / Watch later / Following controls.
4. **Performance**: Native browser `IntersectionObserver` requests poster painting as cards approach the viewport, with a fallback for browsers without it. Reuse `InkArt` cache and existing data.
5. **Brand identity**: Member Hub sets `data-world` and `data-site` so cold/warm themes actually apply. Admin Dashboard also follows selected site's world/accent; account page already derives them.
6. **Mobile**: responsive two-column card grid, minimum 40–44px touch targets, horizontal section navigation, narrow-screen compact active-profile switcher and reduced hero height.
7. **Cross-product consistency**: member, account and admin use one additive visual design layer rather than separately forked CSS.
8. No modifications to Auth/session/RLS tables, license, films, data, Supabase policy or Production branch.

## Verification
- Existing JS syntax/contract + JSDOM integration suite PASS after correcting the featured badge selector.
- Chromium end-to-end **28/28 PASS** on the Premium Preview with mocked Auth/database. Tests include poster painting, film card action state, palette for all five brands, content order, no overflow at 360px, account and admin readability, and all original auth/library/member workflows.
- Browser screenshots generated for desktop Xưởng Phim and mobile Kho Phim, with previous workflow screenshots archived for visual comparison.
- Real content, auth on five production origins, legal rights and live user acceptance remain separate release gates.

## Additional guardrails
- Do not infer that demo art is an official movie poster. Keep badge **PHIM MINH HỌA** until legally cleared content is published.
- The screenshot suite uses simulated Supabase data, not user credentials; passing this suite does not establish live multi-domain account isolation.
- Do not merge a draft PR to `main` without explicit approval, deployment checklist and rollback.
