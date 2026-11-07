// =====================================================================
// MF Website · Edge Function "notify"
// Sends transactional emails and newsletters with Resend.
//
// Deploy: Supabase → Edge Functions → Deploy a new function → Via Editor,
// name it "notify", paste this whole file, turn OFF "Verify JWT"
// (the function checks its own secret / admin login), then Deploy.
// Secret needed: RESEND_API_KEY (Edge Functions → Secrets).
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const RESEND = Deno.env.get('RESEND_API_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Cfg = { fromName: string; fromEmail: string; adminEmail: string; siteUrl: string };
type Mail = { to: string; subject: string; html: string; replyTo?: string; headers?: Record<string, string> };

async function setting<T>(key: string): Promise<T | null> {
  const { data } = await sb.from('private_settings').select('value').eq('key', key).maybeSingle();
  return (data?.value as T) ?? null;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const taka = (n: unknown) => `৳${Number(n)}`;

function layout(cfg: Cfg, title: string, body: string, footer = '') {
  return `<!doctype html><html><body style="margin:0;background:#f3f7f4;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0c1a12">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
  <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #dbe7de;border-radius:16px;overflow:hidden">
    <tr><td style="background:#07100b;padding:20px 28px"><span style="display:inline-block;background:#22d38a;color:#04140b;font-weight:800;font-family:monospace;border-radius:10px;padding:6px 10px">MF</span>
      <span style="color:#e7f5ec;font-weight:700;margin-left:10px;font-size:15px">${esc(cfg.fromName)}</span></td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${title}</h1>
      <div style="font-size:15px;line-height:1.65;color:#2b3b31">${body}</div>
    </td></tr>
    <tr><td style="padding:18px 28px;border-top:1px solid #e6efe8;font-size:12px;color:#6b8073">${footer || `<a href="${cfg.siteUrl}" style="color:#059b5f">${cfg.siteUrl.replace(/^https?:\/\//, '')}</a>`}</td></tr>
  </table></td></tr></table></body></html>`;
}
const btn = (href: string, label: string) => `<p style="margin:24px 0"><a href="${href}" style="background:#059b5f;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;display:inline-block">${label}</a></p>`;
const rows = (pairs: [string, unknown][]) =>
  `<table style="width:100%;border-collapse:collapse;font-size:14px">${pairs
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#6b8073;width:130px;vertical-align:top">${k}</td><td style="padding:6px 0">${esc(v)}</td></tr>`)
    .join('')}</table>`;

async function send(event: string, cfg: Cfg, m: Mail) {
  if (!m.to) return { ok: false, error: 'no recipient' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${cfg.fromName} <${cfg.fromEmail}>`, to: [m.to], subject: m.subject, html: m.html, reply_to: m.replyTo, headers: m.headers }),
  });
  const ok = r.ok;
  const error = ok ? null : (await r.text()).slice(0, 500);
  await sb.from('email_log').insert({ event, recipient: m.to, subject: m.subject, ok, error });
  return { ok, error };
}

/* ---------------- Event → emails ---------------- */
async function handleEvent(type: string, rec: Record<string, any>, cfg: Cfg) {
  const site = cfg.siteUrl.replace(/\/$/, '');
  const admin = cfg.adminEmail;
  const out: Promise<unknown>[] = [];

  switch (type) {
    case 'consultation.new': {
      const slot = rec.preferred_date ? `${rec.preferred_date} at ${rec.preferred_time ?? ''} (Bangladesh time)` : 'No slot selected';
      out.push(send(type, cfg, {
        to: admin, replyTo: rec.email, subject: `New consultation: ${rec.name} · ${rec.topic ?? ''}`,
        html: layout(cfg, 'New consultation request', rows([['Name', rec.name], ['Email', rec.email], ['Phone', rec.phone], ['Address', rec.address], ['Topic', rec.topic], ['Slot', slot]]) + `<p style="margin-top:16px;white-space:pre-line">${esc(rec.message)}</p>` + btn(`${site}/admin#/consultations`, 'Open in admin')),
      }));
      out.push(send(type, cfg, {
        to: rec.email, replyTo: admin, subject: 'Your consultation request was received',
        html: layout(cfg, `Thanks, ${esc(rec.name)}!`, `<p>I've received your consultation request${rec.preferred_date ? ` for <strong>${esc(slot)}</strong>` : ''}. I'll confirm the time and send a meeting link shortly.</p><p>If you need to change anything, just reply to this email.</p>`),
      }));
      break;
    }
    case 'message.new':
      out.push(send(type, cfg, {
        to: admin, replyTo: rec.email, subject: `New message: ${rec.subject || rec.name}`,
        html: layout(cfg, 'New contact message', rows([['From', `${rec.name} <${rec.email}>`], ['Subject', rec.subject]]) + `<p style="margin-top:16px;white-space:pre-line">${esc(rec.message)}</p>` + btn(`${site}/admin#/messages`, 'Open inbox')),
      }));
      break;
    case 'order.new': {
      const items = (rec.items ?? []).map((i: any) => `<li>${esc(i.title)}: ${taka(i.price)}</li>`).join('');
      if (rec.status === 'pending') {
        out.push(send(type, cfg, {
          to: admin, subject: `💰 Verify payment ${rec.order_no}: ${taka(rec.total)} via ${String(rec.payment_method).toUpperCase()}`,
          html: layout(cfg, `Payment to verify: ${esc(rec.order_no)}`, rows([['Amount', taka(rec.total)], ['Method', rec.payment_method], ['Sender', rec.payer_number], ['TrxID', rec.trx_id], ['Buyer', `${rec.name ?? ''} <${rec.email}>`], ['Coupon', rec.coupon_code]]) + `<ul>${items}</ul>` + btn(`${site}/admin#/orders`, 'Verify in admin')),
        }));
        out.push(send(type, cfg, {
          to: rec.email, replyTo: admin, subject: `Order ${rec.order_no} received, verifying your payment`,
          html: layout(cfg, 'Thanks for your order!', `<p>Order <strong>${esc(rec.order_no)}</strong> (${taka(rec.total)}) is being verified. Your e-books will unlock in your library as soon as the payment is confirmed. I'll email you when it's done.</p><ul>${items}</ul>` + btn(`${site}/account`, 'View my orders')),
        }));
      }
      break;
    }
    case 'order.paid': {
      const items = (rec.items ?? []).map((i: any) => `<li><a href="${site}/read?book=${encodeURIComponent(i.slug)}" style="color:#059b5f">${esc(i.title)}</a></li>`).join('');
      out.push(send(type, cfg, {
        to: rec.email, replyTo: admin, subject: `Your e-books are ready 📚 (${rec.order_no})`,
        html: layout(cfg, 'Payment confirmed, happy reading!', `<p>Your order <strong>${esc(rec.order_no)}</strong> is complete. These e-books are now in your library:</p><ul>${items}</ul>` + btn(`${site}/account`, 'Open my library')),
      }));
      break;
    }
    case 'order.rejected':
      out.push(send(type, cfg, {
        to: rec.email, replyTo: admin, subject: `About your order ${rec.order_no}`,
        html: layout(cfg, 'We could not verify your payment', `<p>${esc(rec.admin_note || 'The payment for this order could not be verified.')}</p><p>Please reply to this email or message me on WhatsApp with your Transaction ID and I'll sort it out quickly.</p>`),
      }));
      break;
    case 'comment.new': {
      const { data: post } = await sb.from('posts').select('title,slug').eq('id', rec.post_id).maybeSingle();
      out.push(send(type, cfg, {
        to: admin, subject: `New comment on "${post?.title ?? 'a post'}"`,
        html: layout(cfg, 'New comment awaiting approval', rows([['From', `${rec.name} <${rec.email}>`], ['Post', post?.title]]) + `<p style="white-space:pre-line">${esc(rec.body)}</p>` + btn(`${site}/admin#/blog-comments`, 'Moderate')),
      }));
      break;
    }
    case 'review.new':
      out.push(send(type, cfg, {
        to: admin, subject: `New ${rec.rating}★ e-book review from ${rec.name}`,
        html: layout(cfg, 'New review awaiting approval', `<p>${'★'.repeat(rec.rating)}${'☆'.repeat(5 - rec.rating)}</p><p style="white-space:pre-line">${esc(rec.body ?? '')}</p>` + btn(`${site}/admin#/ebook-reviews`, 'Moderate')),
      }));
      break;
    case 'subscriber.new': {
      const unsub = `${site}/unsubscribe?t=${rec.unsubscribe_token}`;
      out.push(send(type, cfg, {
        to: rec.email, subject: 'Welcome! 🎉',
        headers: { 'List-Unsubscribe': `<${unsub}>` },
        html: layout(cfg, 'Thanks for subscribing!', `<p>You'll get new e-books, tutorials and automation tips straight to your inbox. No spam, ever.</p>` + btn(`${site}/ebooks`, 'Browse free e-books'), `Don't want these emails? <a href="${unsub}" style="color:#6b8073">Unsubscribe</a>`),
      }));
      break;
    }
  }
  return Promise.allSettled(out);
}

/* ---------------- Newsletter ---------------- */
function mdToHtml(md: string) {
  // Small, safe Markdown subset for newsletters
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#059b5f">$1</a>');
  return md
    .split(/\n{2,}/)
    .map((b) => {
      if (/^##\s/.test(b)) return `<h2 style="font-size:18px;margin:24px 0 8px">${inline(b.replace(/^##\s/, ''))}</h2>`;
      if (/^(-|\*)\s/m.test(b)) return `<ul>${b.split('\n').map((l) => `<li>${inline(l.replace(/^(-|\*)\s/, ''))}</li>`).join('')}</ul>`;
      const img = b.match(/^!\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/);
      if (img) return `<img src="${img[2]}" alt="${esc(img[1])}" style="max-width:100%;border-radius:12px">`;
      return `<p>${inline(b).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

async function sendCampaign(id: string, cfg: Cfg, testTo?: string) {
  const { data: c } = await sb.from('campaigns').select('*').eq('id', id).single();
  if (!c) throw new Error('Campaign not found');
  const site = cfg.siteUrl.replace(/\/$/, '');
  const build = (token: string) => {
    const unsub = `${site}/unsubscribe?t=${token}`;
    return { html: layout(cfg, esc(c.subject), mdToHtml(c.body), `You're receiving this because you subscribed at ${site.replace(/^https?:\/\//, '')}. <a href="${unsub}" style="color:#6b8073">Unsubscribe</a>`), unsub };
  };
  if (testTo) {
    const { html } = build('test');
    return send('campaign.test', cfg, { to: testTo, subject: `[TEST] ${c.subject}`, html });
  }
  await sb.from('campaigns').update({ status: 'sending', error: null }).eq('id', id);
  const { data: subs } = await sb.from('subscribers').select('email,unsubscribe_token').eq('status', 'active');
  let sent = 0;
  const list = subs ?? [];
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100).map((s) => {
      const { html, unsub } = build(s.unsubscribe_token);
      return { from: `${cfg.fromName} <${cfg.fromEmail}>`, to: [s.email], subject: c.subject, html, headers: { 'List-Unsubscribe': `<${unsub}>` } };
    });
    const r = await fetch('https://api.resend.com/emails/batch', { method: 'POST', headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' }, body: JSON.stringify(batch) });
    if (!r.ok) {
      const err = (await r.text()).slice(0, 500);
      await sb.from('campaigns').update({ status: 'failed', error: err, sent_count: sent }).eq('id', id);
      await sb.from('email_log').insert({ event: 'campaign', recipient: `${batch.length} subscribers`, subject: c.subject, ok: false, error: err });
      return { ok: false, error: err, sent };
    }
    sent += batch.length;
  }
  await sb.from('campaigns').update({ status: 'sent', sent_count: sent, sent_at: new Date().toISOString() }).eq('id', id);
  await sb.from('email_log').insert({ event: 'campaign', recipient: `${sent} subscribers`, subject: c.subject, ok: true });
  return { ok: true, sent };
}

/* ---------------- Entry ---------------- */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!RESEND) return json({ error: 'RESEND_API_KEY secret is not set' }, 500);

  const cfg = { fromName: 'Muhammad Fazal', fromEmail: 'onboarding@resend.dev', adminEmail: '', siteUrl: 'https://muhammadfazal.com', ...(await setting<Cfg>('email')) } as Cfg;
  const body = await req.json().catch(() => ({}));

  // 1) Calls from the database triggers
  const secret = req.headers.get('x-notify-secret');
  if (secret) {
    const notify = await setting<{ secret: string }>('notify');
    if (!notify || secret !== notify.secret) return json({ error: 'bad secret' }, 401);
    await handleEvent(String(body.type), body.record ?? {}, cfg);
    return json({ ok: true });
  }

  // 2) Calls from the admin panel (signed-in admin only)
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const { data: u } = await sb.auth.getUser(token);
  const { data: prof } = u.user ? await sb.from('profiles').select('role').eq('id', u.user.id).maybeSingle() : { data: null };
  if (!prof || !['admin', 'editor'].includes(prof.role)) return json({ error: 'admins only' }, 403);

  try {
    if (body.action === 'test') {
      const r = await send('test', cfg, { to: body.to || cfg.adminEmail, subject: 'Test email from your website ✅', html: layout(cfg, 'It works!', '<p>Your website can send emails. Booking, order and message notifications will arrive here.</p>') });
      return json(r, r.ok ? 200 : 400);
    }
    if (body.action === 'campaign') return json(await sendCampaign(String(body.id), cfg, body.testTo));
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
