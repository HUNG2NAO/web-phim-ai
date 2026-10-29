/* Membership rollout switch.
   PREVIEW candidate for all five brands; keep Production untouched until each site QA passes.
   Enable additional site IDs only after real-domain security and browser QA. */
window.AFN_LEVEL3_CONFIG = Object.freeze({
  enabledSites: ["xuongphim", "khophim", "phephim", "phimhay", "ghienphim"],
  pilotOnly: false
});
