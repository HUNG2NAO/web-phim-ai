/* Public frontend configuration. Set only the project URL and publishable/anon key.
   NEVER put a service_role key, secret key, password or private token here.
   Keep this file enabled only on the auth-preview branch while the full signup flow is tested. */
window.AFN_AUTH_CONFIG = {
  enabled: true,
  googleEnabled: false,
  url: "https://jurvphonehknrxjpowoe.supabase.co",
  publishableKey: "sb_publishable_RvkZO52tu4ywhjaQzNDs4Q_VFvmJFsu",
  storageKey: "afn-film-auth-v1",
  // Level 4.6 — khớp cài đặt "Password requirements" của Supabase Auth (máy chủ mới là nơi quyết định).
  // Mật khẩu cũ yếu hơn vẫn đăng nhập được (không khóa tài khoản); chỉ áp khi đăng ký / đổi mật khẩu.
  passwordPolicy: { minLength: 10, letterAndDigit: true },
  // Cloudflare Turnstile (chống bot cho đăng nhập / đăng ký / quên mật khẩu). Để trống = TẮT.
  // Chỉ điền SITE KEY công khai. Secret key chỉ nhập trong Supabase Auth → Bot and Abuse Protection, KHÔNG để ở đây.
  // Bật theo thứ tự: triển khai frontend có site key → kiểm tra widget → rồi mới bật CAPTCHA trong Supabase.
  turnstileSiteKey: ""
};
