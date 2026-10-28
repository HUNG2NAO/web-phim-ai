# AI Film Network — Authentication V1 (DEV only)

## Current state

This branch adds a responsive account dialog on every brand, without changing the existing film catalog or domain routing. **Email Auth is activated only in the development preview branch**. A dedicated Supabase project `ai-film-network` exists. This is not yet released to the five production domains. Google sign-in stays disabled until OAuth is configured.

- One Supabase project and shared \`auth.users\` identity across five brands.
- Independent browser sessions per site origin via localStorage (the browser enforces domain isolation).
- Explicit \`signOut({scope:"local"})\`, never global logout.
- Email/password sign-up, confirmation, sign-in, password recovery and Google OAuth handlers.
- Profile display name stored in Auth metadata for the initial UI, while \`db/auth_v1.sql\` defines secure persistent profiles/memberships for subsequent onboarding.
- Free browsing remains available without login.

## Required manual setup after creating a NEW Supabase project

1. In the Supabase dashboard for the NEW project, enable email/password with email verification.
2. Configure **Authentication → URL Configuration**. Set the Site URL to \`https://www.xuongphim.ai\`, and allow exact URLs:
   - \`https://www.xuongphim.ai/?auth=callback\`, \`?auth=confirm\`, \`?auth=recovery\`
   - Same 3 paths on www.khophim.ai, www.phephim.ai, www.phimhay.ai, www.ghienphim.ai.
   - Allow Preview host URLs separately for staging tests (do not globally whitelist \`*.pages.dev\`).
3. If Google sign-in is desired, configure **Authentication → Providers → Google** and follow Supabase's provider-specific OAuth callback instructions in Google Cloud Console. Never put provider secret in the site.
4. \`db/auth_v1.sql\` was applied to the new project (`afn_auth_profiles_site_memberships_v1`), and security/performance advisors returned no warnings at that moment.
5. Retrieve only **Project URL** and **publishable key** from the new project dashboard. The preview branch already has `enabled: true`, a public project URL and a publishable key. Do NOT put service_role/secret keys here. Keep `googleEnabled: false` until the provider is configured.
6. Deploy first to a Cloudflare Preview branch; test registration, recovery, Google login, logout and site-separated sessions. **Do not merge into main until verified on real domains**.

## Pilot test requirements

- Open the Cloudflare Preview URL configured in Supabase redirect allowlist.
- Use an email belonging to an authorized Supabase organization team member for built-in SMTP testing; other addresses need custom SMTP first.
- Test signup, email verification, reload, login, local logout and reset password. Record results before rollout.
- Hosted Supabase projects normally require email confirmation by default; this still needs runtime verification.
- Preview-origin sessions do not prove five-production-domain session isolation because preview variants share one origin.
- Google OAuth has been intentionally hidden/disabled for this pilot.

## Caveats

- OAuth/email callbacks MUST be allowlisted for every website; distinct TLDs cannot share a session cookie or localStorage.
- Google may automatically reuse an existing Google account session, but each film website will still require a sign-in action.
- Email delivery limits on the hosted Supabase email service mean production should use verified/custom SMTP, configured in the Supabase dashboard.
- Signups must have abuse protection, rate limits, and appropriate privacy terms before opening to broad audiences.
- No real users, admin keys, or protected film content belong in this public repository.
- This branch does not build the community/chat, stars, points, or streaming dashboard.
- Production currently has a \`noindex,follow\` demo notice and 36 sample films; retain them until real content is reviewed.
- Existing HUNGCREATOR Supabase project and Cloudflare zones must not be changed.
