import { useCallback, useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { supabase } from '@/lib/supabase';
import { MarkdownEditor } from './blog';
import { Empty, I, Modal, PageTitle, Panel, Toggle, useToast } from './ui';

const sb = () => supabase!;
type EmailCfg = { fromName: string; fromEmail: string; adminEmail: string; siteUrl: string };
type Log = { id: number; event: string; recipient: string | null; subject: string | null; ok: boolean; error: string | null; created_at: string };
type Campaign = { id: string; subject: string; preheader: string | null; body: string; status: string; sent_count: number; error: string | null; created_at: string; sent_at: string | null };

async function callNotify(body: Record<string, unknown>) {
  const { data, error } = await sb().functions.invoke('notify', { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) msg = (await ctx.json()).error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return data as { ok?: boolean; error?: string; sent?: number };
}

/* ======================= Email settings + log ======================= */
export function EmailSettings() {
  const toast = useToast();
  const [cfg, setCfg] = useState<EmailCfg>({ fromName: 'Muhammad Fazal', fromEmail: 'onboarding@resend.dev', adminEmail: '', siteUrl: 'https://muhammadfazal.com' });
  const [enabled, setEnabled] = useState(true);
  const [log, setLog] = useState<Log[]>([]);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    const [{ data: e }, { data: n }, { data: l }] = await Promise.all([
      sb().from('private_settings').select('value').eq('key', 'email').maybeSingle(),
      sb().from('private_settings').select('value').eq('key', 'notify').maybeSingle(),
      sb().from('email_log').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (e?.value) setCfg((c) => ({ ...c, ...(e.value as EmailCfg) }));
    if (n?.value) setEnabled(Boolean((n.value as { enabled?: boolean }).enabled));
    setLog((l as Log[]) ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    const { error } = await sb().from('private_settings').upsert({ key: 'email', value: cfg });
    if (error) return toast(error.message, false);
    const { data: n } = await sb().from('private_settings').select('value').eq('key', 'notify').maybeSingle();
    if (n?.value) await sb().from('private_settings').update({ value: { ...(n.value as object), enabled } }).eq('key', 'notify');
    toast('Saved');
  }
  async function test() {
    setStatus('Sending…');
    try {
      const r = await callNotify({ action: 'test', to: cfg.adminEmail });
      setStatus(r.ok ? `✓ Sent to ${cfg.adminEmail}. Check your inbox (and spam).` : `✗ ${r.error}`);
    } catch (e) {
      setStatus(`✗ ${(e as Error).message}`);
    }
    load();
  }

  const set = <K extends keyof EmailCfg>(k: K, v: string) => setCfg((c) => ({ ...c, [k]: v }));
  return (
    <div>
      <PageTitle title="Email" sub="Automatic emails for bookings, orders, messages and newsletters (sent with Resend)." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Settings">
          <div className="grid gap-4">
            <Toggle checked={enabled} onChange={setEnabled} label="Send automatic notification emails" />
            <div><label className="label" htmlFor="em-admin">Your email (receives notifications)</label><input id="em-admin" type="email" value={cfg.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} className="input" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="em-name">Sender name</label><input id="em-name" value={cfg.fromName} onChange={(e) => set('fromName', e.target.value)} className="input" /></div>
              <div><label className="label" htmlFor="em-from">Sender email</label><input id="em-from" type="email" value={cfg.fromEmail} onChange={(e) => set('fromEmail', e.target.value)} className="input" /></div>
            </div>
            <p className="-mt-2 text-xs text-muted">Until your domain is verified in Resend, keep <code>onboarding@resend.dev</code>. It can only send to your own Resend account email. After verifying, use e.g. <code>hello@muhammadfazal.com</code>.</p>
            <div><label className="label" htmlFor="em-site">Website address (used in email links)</label><input id="em-site" value={cfg.siteUrl} onChange={(e) => set('siteUrl', e.target.value)} className="input" /></div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-primary" onClick={save}><I n="check" s={15} /> Save</button>
              <button type="button" className="btn-ghost" disabled={!cfg.adminEmail} onClick={test}>Send test email</button>
            </div>
            {status && <p className="text-sm">{status}</p>}
          </div>
        </Panel>
        <Panel title="What gets sent">
          <ul className="grid gap-2 text-sm text-muted">
            <li>📅 <strong className="text-fg">New consultation</strong>: you + a confirmation to the visitor</li>
            <li>✉️ <strong className="text-fg">New contact message</strong>: you (reply goes to the sender)</li>
            <li>💰 <strong className="text-fg">New order</strong>: you (verify payment) + "order received" to the buyer</li>
            <li>📚 <strong className="text-fg">Order approved</strong>: buyer gets "your e-books are ready" with links</li>
            <li>⚠️ <strong className="text-fg">Order rejected</strong>: buyer gets your note</li>
            <li>💬 <strong className="text-fg">New comment / review</strong>: you</li>
            <li>🎉 <strong className="text-fg">New subscriber</strong>: welcome email with unsubscribe link</li>
          </ul>
        </Panel>
      </div>
      <Panel title="Recent emails" className="mt-6">
        {log.length === 0 ? <Empty text="No emails sent yet." icon="mail" /> : (
          <ul className="divide-y divide-line text-sm">
            {log.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className={`h-2 w-2 rounded-full ${l.ok ? 'bg-accent' : 'bg-red-500'}`} />
                <span className="w-32 font-mono text-xs text-muted">{l.event}</span>
                <span className="min-w-0 flex-1 truncate">{l.subject}</span>
                <span className="truncate text-xs text-muted">{l.recipient}</span>
                <span className="font-mono text-xs text-muted">{new Date(l.created_at).toLocaleString()}</span>
                {!l.ok && l.error && <p className="w-full truncate pl-5 text-xs text-red-500" title={l.error}>{l.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ======================= Newsletter campaigns ======================= */
export function Newsletter() {
  const toast = useToast();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [active, setActive] = useState(0);
  const [edit, setEdit] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const [{ data }, { count }] = await Promise.all([
      sb().from('campaigns').select('*').order('created_at', { ascending: false }),
      sb().from('subscribers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ]);
    setRows((data as Campaign[]) ?? []);
    setActive(count ?? 0);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(c: Campaign) {
    const row = { subject: c.subject, preheader: c.preheader, body: c.body };
    const res = c.id ? await sb().from('campaigns').update(row).eq('id', c.id).select().single() : await sb().from('campaigns').insert(row).select().single();
    if (res.error) {
      toast(res.error.message, false);
      return null;
    }
    setEdit(res.data as Campaign);
    load();
    return res.data as Campaign;
  }
  async function sendTest(c: Campaign) {
    const saved = await save(c);
    if (!saved) return;
    setBusy('Sending test…');
    try {
      const { data: e } = await sb().from('private_settings').select('value').eq('key', 'email').maybeSingle();
      const to = (e?.value as EmailCfg | undefined)?.adminEmail;
      if (!to) throw new Error('Set your email in Email settings first');
      const r = await callNotify({ action: 'campaign', id: saved.id, testTo: to });
      toast(r.ok ? `Test sent to ${to}` : String(r.error), Boolean(r.ok));
    } catch (e) {
      toast((e as Error).message, false);
    }
    setBusy('');
  }
  async function sendAll(c: Campaign) {
    if (!confirm(`Send "${c.subject}" to ${active} subscriber(s)? This cannot be undone.`)) return;
    const saved = await save(c);
    if (!saved) return;
    setBusy(`Sending to ${active} subscribers…`);
    try {
      const r = await callNotify({ action: 'campaign', id: saved.id });
      toast(r.ok ? `Sent to ${r.sent} subscribers` : String(r.error), Boolean(r.ok));
      if (r.ok) setEdit(null);
    } catch (e) {
      toast((e as Error).message, false);
    }
    setBusy('');
    load();
  }
  async function remove(c: Campaign) {
    if (!confirm('Delete this campaign?')) return;
    await sb().from('campaigns').delete().eq('id', c.id);
    load();
  }

  return (
    <div>
      <PageTitle
        title="Newsletter"
        sub={`${active} active subscriber${active === 1 ? '' : 's'}. Every email includes an unsubscribe link.`}
        actions={<button type="button" className="btn-primary" onClick={() => setEdit({ id: '', subject: '', preheader: '', body: '', status: 'draft', sent_count: 0, error: null, created_at: '', sent_at: null })}><I n="plus" s={15} /> New email</button>}
      />
      <Panel>
        {rows.length === 0 ? <Empty text="No newsletters yet. Announce your next e-book or tutorial!" icon="mail" /> : (
          <ul className="divide-y divide-line">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <button type="button" onClick={() => setEdit(c)} className="min-w-0 flex-1 truncate text-left font-semibold hover:text-accent">{c.subject}</button>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${c.status === 'sent' ? 'bg-accent-soft text-accent' : c.status === 'failed' ? 'bg-red-500/15 text-red-500' : 'bg-surface-2 text-muted'}`}>{c.status}</span>
                {c.status === 'sent' && <span className="text-xs text-muted">{c.sent_count} recipients · {new Date(c.sent_at!).toLocaleDateString()}</span>}
                {c.status !== 'sent' && <button type="button" onClick={() => remove(c)} className="text-muted hover:text-red-500" aria-label="Delete"><I n="trash" s={15} /></button>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit?.id ? 'Edit newsletter' : 'New newsletter'} wide>
        {edit && <CampaignEditor c={edit} onChange={setEdit} busy={busy} onSave={() => save(edit).then((r) => r && toast('Draft saved'))} onTest={() => sendTest(edit)} onSend={() => sendAll(edit)} active={active} />}
      </Modal>
    </div>
  );
}

function CampaignEditor({ c, onChange, onSave, onTest, onSend, busy, active }: { c: Campaign; onChange: (c: Campaign) => void; onSave: () => void; onTest: () => void; onSend: () => void; busy: string; active: number }) {
  const sent = c.status === 'sent';
  const preview = useMemo(() => marked.parse(c.body || '_Write your email…_', { async: false }) as string, [c.body]);
  return (
    <div className="grid gap-4">
      <input value={c.subject} onChange={(e) => onChange({ ...c, subject: e.target.value })} disabled={sent} placeholder="Subject line" className="input text-lg font-semibold" aria-label="Subject" />
      {sent ? (
        <div className="prose max-w-none rounded-xl border border-line p-5" dangerouslySetInnerHTML={{ __html: preview }} />
      ) : (
        <MarkdownEditor value={c.body} onChange={(v) => onChange({ ...c, body: v })} />
      )}
      <p className="text-xs text-muted">Supported in emails: paragraphs, **bold**, _italic_, [links](https://…), ## headings, - lists and images.</p>
      {c.error && <p className="text-sm text-red-500">{c.error}</p>}
      {busy && <p className="text-sm text-accent">{busy}</p>}
      {!sent && (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onSave} disabled={!!busy || !c.subject.trim()}>Save draft</button>
          <button type="button" className="btn-ghost" onClick={onTest} disabled={!!busy || !c.subject.trim()}>Send test to me</button>
          <button type="button" className="btn-primary" onClick={onSend} disabled={!!busy || !c.subject.trim() || !c.body.trim() || active === 0}><I n="send" s={15} /> Send to {active}</button>
        </div>
      )}
    </div>
  );
}
