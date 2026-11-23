// Online play: fill in your Supabase project (Settings → API). Empty url = offline prototype in this browser.
// The anon key is public by design; the service role key must never go here.
export const NET = {
  url: 'https://ivzplchpakfkilnzvkyj.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2enBsY2hwYWtma2lsbnp2a3lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MDU1NjMsImV4cCI6MjEwODA4MTU2M30.mB0EBwAGun-oZ_4wzF6frP2H6yUoIl-Mw-Dgh-fdBdQ',
};

// Cloudflare Turnstile (captcha on sign-in, sign-up and new password). The site key is public; the secret key lives
// only in Supabase (Authentication → Attack Protection). On localhost Cloudflare's test key is used (always passes).
const TURNSTILE_KEY = '0x4AAAAAAGPOGo1vGJtiLvRc';
const TURNSTILE_TEST_KEY = '1x00000000000000000000AA';
export const CAPTCHA = {
  script: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
  siteKey: typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? TURNSTILE_TEST_KEY : TURNSTILE_KEY,
};

// ?mock runs the online client against a fake in-browser server (for testing without Supabase)
export const ONLINE = !!(NET.url && NET.anonKey) || (typeof location !== 'undefined' && /[?&]mock/.test(location.search));
