/**
 * Cloudflare Worker in front of the static site.
 * Only /s/<slug> runs here (see run_worker_first in wrangler.toml); everything
 * else is served from the built site (./dist) as before.
 *
 * /s/<slug> is a campaign share link (Nusuk Manager → Campaign):
 *   • Facebook's own server reads it to build the post preview. That means the
 *     link was put on Facebook, so the share is counted (once per day).
 *   • People who click it are sent to the Facebook post (or /nusuk).
 * The secret that lets the worker count shares is a Cloudflare secret
 * (NUSUK_CAMP_SECRET), never stored in this public repo.
 */
const FACEBOOK_ASN = 32934; // Meta's network
const FB_CRAWLER = /facebookexternalhit|facebookcatalog|meta-externalagent/i;
const OTHER_PREVIEW = /bot|crawl|spider|preview|whatsapp|telegram|twitter|slack|discord|skype|linkedin/i;

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function previewPage(info, selfUrl, dest) {
  const title = info?.title || 'নুসুক উমরাহ কোড শেয়ার';
  const body = info?.body || 'এক ক্লিকে নুসুক রেফারেল কোড কপি করুন, উমরাহ জেতার সুযোগ বাড়ান।';
  const image = info?.image || '';
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(selfUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(body)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta http-equiv="refresh" content="0;url=${esc(dest)}">
</head><body><a href="${esc(dest)}">${esc(title)}</a></body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/s\/([A-Za-z0-9]{6,20})\/?$/);
    if (!m) return env.ASSETS.fetch(request);

    const ua = request.headers.get('user-agent') || '';
    // Counted only when it really is Facebook's server (its network + crawler name);
    // a fake "facebookexternalhit" from anywhere else just gets the preview page.
    const fromFacebook = request.cf?.asn === FACEBOOK_ASN && FB_CRAWLER.test(ua);
    const isPreviewBot = FB_CRAWLER.test(ua) || OTHER_PREVIEW.test(ua);

    let info = null;
    if (env.NUSUK_CAMP_SECRET && env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
      try {
        const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/nusuk_camp_hit`, {
          method: 'POST',
          headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
          // Other preview bots (WhatsApp, Telegram…) are not clicks and not Facebook shares: just read the info
          body: JSON.stringify({ p_secret: env.NUSUK_CAMP_SECRET, p_slug: m[1], p_fb: fromFacebook, p_peek: isPreviewBot && !fromFacebook }),
        });
        if (r.ok) info = await r.json();
      } catch {
        /* still send people on */
      }
    }
    const dest = info?.ok && info.dest ? info.dest : `${url.origin}/nusuk/`;
    if (isPreviewBot) {
      return new Response(previewPage(info, url.href, dest), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    return Response.redirect(dest, 302);
  },
};
