# Homepage intermittent font/rendering stability — 29 October 2026

## Reported symptom
A screenshot of Ghiền Phim Preview showed temporary fragmented Vietnamese hero and brand typography, followed by spontaneous recovery. The user also reports occasional slow response. This is not proof of a permanent source-text corruption.

## Likely contributors identified in source
- A synchronous `InkArt.paint()` call for a 1600×800 hero Canvas and many 360×540 poster canvases during initial rendering.
- `InkArt.hydrate()` painted all DOM posters in a tight requestAnimationFrame queue, including below-fold ones; any individual paint could exceed its 12 ms budget.
- Google Fonts stylesheet used `display=swap`, allowing late font replacement and visual reflow, including for the hero heading/logo.
- `text-wrap: balance` on the largest hero headings can require extra line-layout recalculation when fonts change.
These are plausible contributors to the observed intermittent symptom, not a confirmed single root cause.

## Changes on isolated Preview branch
1. `assets/art.js`: using IntersectionObserver to draw posters only near the viewport; put featured art ahead of below-fold work; draw at most one illustration per idle callback, yielding to user input between expensive paintings. Handle failure without blocking page text.
2. `assets/app.js`: cap initial featured art resolution from 1600×800 to 1200×600 (44% fewer pixels) and posters from 360×540 to 320×480 (21% fewer pixels).
3. `index.html`: Google Fonts with `display=optional` instead of `display=swap` to avoid late swap under poor connectivity. This can intentionally use the fallback on slow connections.
4. `assets/style.css`: stable line wrapping for Vietnamese headline and nowrap logo.
5. Chromium E2E: slow/blocked Google Fonts, delayed/lazy art painting, rapid multi-brand switching, all existing Level 3 scenarios.
6. No changes to user data, RLS, Supabase schema, login credentials or movie metadata. No updates to production `main`.

## Verification
- GitHub Actions Chromium: **31/31 tests PASS**, including three new homepage regression tests with simulated fonts/network conditions.
- Auth + JSDOM quality gate: PASS.
- Cloudflare Preview build: verify separately.
- Real Windows Chrome GPU/driver/repaint behavior remains user/device-specific; do not claim the symptom is conclusively eliminated.
- If symptoms persist, investigate Chrome Task Manager (Shift+Esc), GPU acceleration, GPU driver, font cache, DevTools Performance trace and browser errors before making further changes.

## Rollback
Do not merge the draft branch until the user confirms desktop behavior. Production remains the `main` branch. The previous Premium UI preview can continue running independently.
