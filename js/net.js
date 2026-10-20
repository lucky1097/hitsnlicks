// Online play: fill in your Supabase project (Settings → API). Empty url = offline prototype in this browser.
// The anon key is public by design; the service role key must never go here.
export const NET = {
  url: 'https://ivzplchpakfkilnzvkyj.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2enBsY2hwYWtma2lsbnp2a3lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MDU1NjMsImV4cCI6MjEwODA4MTU2M30.mB0EBwAGun-oZ_4wzF6frP2H6yUoIl-Mw-Dgh-fdBdQ',
};

// ?mock runs the online client against a fake in-browser server (for testing without Supabase)
export const ONLINE = !!(NET.url && NET.anonKey) || (typeof location !== 'undefined' && /[?&]mock/.test(location.search));
