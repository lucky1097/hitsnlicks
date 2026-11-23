// The game lives at https://hitsnlicks.online (Cloudflare Pages). Old GitHub Pages links go there, with the
// same page, ?query and #hash (an account email link carries its tokens after the #).
if (location.hostname.endsWith('github.io')) {
  location.replace('https://hitsnlicks.online' + location.pathname.replace(/^\/hitsnlicks/, '') + location.search + location.hash);
}
