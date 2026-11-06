import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Empty, I, Modal, PageTitle, Panel, Toggle, useToast } from './ui';

type Order = {
  id: string;
  order_no: string;
  user_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  items: { ebook_id: string; title: string; slug: string; price: number }[];
  subtotal: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  payment_method: 'bkash' | 'nagad' | 'free' | null;
  payer_number: string | null;
  trx_id: string | null;
  status: 'pending' | 'paid' | 'rejected' | 'refunded' | 'cancelled';
  admin_note: string | null;
  created_at: string;
  paid_at: string | null;
};
type Coupon = { id?: string; code: string; kind: 'percent' | 'fixed'; value: number; min_total: number; max_uses: number | null; used_count?: number; starts_at: string | null; ends_at: string | null; active: boolean };

const sb = () => supabase!;
const taka = (n: number) => `৳${Number(n)}`;
const METHOD: Record<string, { label: string; color: string }> = { bkash: { label: 'bKash', color: '#e2136e' }, nagad: { label: 'Nagad', color: '#f6921e' }, free: { label: 'Free (coupon)', color: '#22d38a' } };
const STATUS: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  paid: 'bg-accent-soft text-accent',
  rejected: 'bg-red-500/15 text-red-500',
  refunded: 'bg-blue-500/15 text-blue-500',
  cancelled: 'bg-surface-2 text-muted',
};
const digits = (p: string) => p.replace(/\D/g, '').replace(/^0/, '880');

/* ======================= Orders ======================= */
export function Orders() {
  const toast = useToast();
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Order | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb().from('orders').select('*').order('created_at', { ascending: false });
    if (error) toast(error.message, false);
    setRows(((data as Order[]) ?? []).map((o) => ({ ...o, total: Number(o.total), subtotal: Number(o.subtotal), discount: Number(o.discount) })));
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function approve(o: Order) {
    setBusy(true);
    const { error } = await sb().rpc('approve_order', { p_order: o.id });
    setBusy(false);
    if (error) return toast(error.message, false);
    toast(`${o.order_no} approved, e-books unlocked`);
    setOpen(null);
    load();
  }
  async function reject(o: Order) {
    if (!confirm(`Reject ${o.order_no}?${o.status === 'paid' ? ' The buyer will lose access to these e-books.' : ''}`)) return;
    setBusy(true);
    const { error } = await sb().rpc('reject_order', { p_order: o.id, p_note: note.trim() || 'Payment could not be verified. Please contact us on WhatsApp.' });
    setBusy(false);
    if (error) return toast(error.message, false);
    toast(`${o.order_no} rejected`);
    setOpen(null);
    load();
  }

  const shown = rows.filter((o) => (filter === 'all' || o.status === filter) && (!q || `${o.order_no} ${o.email} ${o.trx_id ?? ''} ${o.payer_number ?? ''} ${o.name ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  const revenue = rows.filter((o) => o.status === 'paid').reduce((a, o) => a + o.total, 0);
  const month = new Date().toISOString().slice(0, 7);
  const monthRevenue = rows.filter((o) => o.status === 'paid' && (o.paid_at ?? o.created_at).startsWith(month)).reduce((a, o) => a + o.total, 0);

  return (
    <div>
      <PageTitle title="Orders" sub="Verify bKash/Nagad payments and unlock e-books." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-xs text-muted uppercase">Waiting for you</p><p className="mt-1 text-3xl font-extrabold text-yellow-500">{rows.filter((o) => o.status === 'pending').length}</p></div>
        <div className="card p-5"><p className="text-xs text-muted uppercase">This month</p><p className="mt-1 text-3xl font-extrabold">{taka(monthRevenue)}</p></div>
        <div className="card p-5"><p className="text-xs text-muted uppercase">All-time revenue</p><p className="mt-1 text-3xl font-extrabold text-accent">{taka(revenue)}</p></div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['pending', 'paid', 'rejected', 'all'].map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === s ? 'bg-accent text-accent-contrast' : 'border border-line bg-surface text-muted'}`}>
            {s} <span className="opacity-70">{s === 'all' ? rows.length : rows.filter((r) => r.status === s).length}</span>
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order, email, TrxID…" className="input ml-auto w-64 py-1.5 text-xs" />
      </div>
      <Panel>
        {loading ? <p className="py-8 text-center text-sm text-muted">Loading…</p> : shown.length === 0 ? <Empty text={filter === 'pending' ? 'No payments waiting for verification. 🎉' : 'No orders here.'} icon="dashboard" /> : (
          <ul className="divide-y divide-line">
            {shown.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => { setOpen(o); setNote(o.admin_note ?? ''); }} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 py-3 text-left text-sm">
                  <span className="w-24 font-mono font-semibold">{o.order_no}</span>
                  <span className="min-w-0 flex-1 truncate">{o.name || o.email} <span className="text-muted">· {o.items.map((i) => i.title).join(', ')}</span></span>
                  {o.payment_method && <span className="text-xs font-bold" style={{ color: METHOD[o.payment_method]?.color }}>{METHOD[o.payment_method]?.label}</span>}
                  {o.trx_id && <span className="font-mono text-xs text-muted">{o.trx_id}</span>}
                  <span className="w-16 text-right font-semibold">{taka(o.total)}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${STATUS[o.status]}`}>{o.status}</span>
                  <span className="w-20 text-right font-mono text-xs text-muted">{new Date(o.created_at).toLocaleDateString()}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal open={open !== null} onClose={() => setOpen(null)} title={`Order ${open?.order_no ?? ''}`}>
        {open && (
          <div className="grid gap-4 text-sm">
            {open.status === 'pending' && open.payment_method !== 'free' && (
              <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4">
                <p className="font-semibold">Check your {METHOD[open.payment_method ?? 'bkash']?.label} app for:</p>
                <ul className="mt-2 grid gap-1">
                  <li>Amount: <strong>{taka(open.total)}</strong></li>
                  <li>From: <strong className="font-mono">{open.payer_number}</strong></li>
                  <li>TrxID: <strong className="font-mono">{open.trx_id}</strong> <button type="button" className="ml-1 text-xs text-accent" onClick={() => { navigator.clipboard.writeText(open.trx_id ?? ''); toast('TrxID copied'); }}>copy</button></li>
                </ul>
              </div>
            )}
            <dl className="grid grid-cols-[110px_1fr] gap-y-2">
              <dt className="text-muted">Status</dt><dd><span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${STATUS[open.status]}`}>{open.status}</span></dd>
              <dt className="text-muted">Buyer</dt><dd>{open.name || '—'} · <a className="text-accent" href={`mailto:${open.email}`}>{open.email}</a></dd>
              {open.phone && (<><dt className="text-muted">Phone</dt><dd>{open.phone}</dd></>)}
              <dt className="text-muted">Placed</dt><dd>{new Date(open.created_at).toLocaleString()}</dd>
              {open.paid_at && (<><dt className="text-muted">Paid</dt><dd>{new Date(open.paid_at).toLocaleString()}</dd></>)}
              {open.coupon_code && (<><dt className="text-muted">Coupon</dt><dd className="font-mono">{open.coupon_code} (−{taka(open.discount)})</dd></>)}
            </dl>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {open.items.map((i) => (
                <li key={i.ebook_id} className="flex justify-between px-3 py-2"><a href={`/ebooks/${i.slug}`} target="_blank" className="hover:text-accent">{i.title}</a><span>{taka(i.price)}</span></li>
              ))}
              <li className="flex justify-between px-3 py-2 font-bold"><span>Total</span><span>{taka(open.total)}</span></li>
            </ul>
            <div>
              <label className="label" htmlFor="o-note">Note to buyer (shown if rejected)</label>
              <textarea id="o-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input" placeholder="e.g. Amount did not match. Please contact us on WhatsApp." />
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              {open.phone || open.payer_number ? (
                <a className="btn-ghost" target="_blank" rel="noopener" href={`https://wa.me/${digits(open.phone || open.payer_number || '')}?text=${encodeURIComponent(`Hi${open.name ? ` ${open.name}` : ''}! About your order ${open.order_no} on muhammadfazal.com:`)}`}>WhatsApp</a>
              ) : null}
              {open.status !== 'rejected' && <button type="button" className="btn-ghost text-red-500" disabled={busy} onClick={() => reject(open)}>Reject</button>}
              {open.status !== 'paid' && <button type="button" className="btn-primary" disabled={busy} onClick={() => approve(open)}><I n="check" s={15} /> {busy ? 'Working…' : 'Approve & unlock'}</button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ======================= Coupons ======================= */
const blank: Coupon = { code: '', kind: 'percent', value: 10, min_total: 0, max_uses: null, starts_at: null, ends_at: null, active: true };
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export function Coupons() {
  const toast = useToast();
  const [rows, setRows] = useState<Coupon[]>([]);
  const [edit, setEdit] = useState<Coupon | null>(null);
  const load = useCallback(() => sb().from('coupons').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
    if (error) toast(error.message, false);
    setRows(((data as Coupon[]) ?? []).map((c) => ({ ...c, value: Number(c.value), min_total: Number(c.min_total) })));
  }), [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!edit) return;
    const { id, used_count, ...row } = edit;
    void used_count;
    row.code = row.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(row.code)) return toast('Code: 3–30 letters, numbers, - or _', false);
    if (!(row.value > 0)) return toast('Value must be more than 0', false);
    const { error } = id ? await sb().from('coupons').update(row).eq('id', id) : await sb().from('coupons').insert(row);
    if (error) return toast(error.code === '23505' ? 'That code already exists.' : error.message, false);
    setEdit(null);
    load();
  }
  async function remove(c: Coupon) {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    await sb().from('coupons').delete().eq('id', c.id!);
    load();
  }
  async function toggle(c: Coupon) {
    await sb().from('coupons').update({ active: !c.active }).eq('id', c.id!);
    load();
  }

  return (
    <div>
      <PageTitle title="Coupons" sub="Discount codes buyers can enter at checkout." actions={<button type="button" className="btn-primary" onClick={() => setEdit({ ...blank })}><I n="plus" s={15} /> New coupon</button>} />
      <Panel>
        {rows.length === 0 ? <Empty text="No coupons yet." icon="layers" /> : (
          <ul className="divide-y divide-line">
            {rows.map((c) => {
              const expired = c.ends_at && Date.parse(c.ends_at) < Date.now();
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="rounded-md border border-dashed border-accent px-2 py-0.5 font-mono font-bold text-accent">{c.code}</span>
                  <span className="font-semibold">{c.kind === 'percent' ? `${c.value}% off` : `${taka(c.value)} off`}</span>
                  <span className="text-xs text-muted">
                    used {c.used_count ?? 0}{c.max_uses ? ` / ${c.max_uses}` : ''}{c.min_total ? ` · min ${taka(c.min_total)}` : ''}{c.ends_at ? ` · ends ${new Date(c.ends_at).toLocaleDateString()}` : ''}
                  </span>
                  {expired && <span className="rounded bg-red-500/15 px-1.5 text-xs text-red-500">expired</span>}
                  <span className="ml-auto" />
                  <Toggle checked={c.active} onChange={() => toggle(c)} />
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setEdit({ ...c })}>Edit</button>
                  <button type="button" className="text-muted hover:text-red-500" onClick={() => remove(c)} aria-label="Delete"><I n="trash" s={15} /></button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit?.id ? 'Edit coupon' : 'New coupon'}>
        {edit && (
          <div className="grid gap-4">
            <div><label className="label" htmlFor="cp-code">Code</label><input id="cp-code" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} placeholder="EID25" className="input font-mono uppercase" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="cp-kind">Type</label>
                <select id="cp-kind" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Coupon['kind'] })} className="input"><option value="percent">Percent (%)</option><option value="fixed">Fixed amount (৳)</option></select>
              </div>
              <div><label className="label" htmlFor="cp-val">{edit.kind === 'percent' ? 'Percent off' : 'Taka off'}</label><input id="cp-val" type="number" min={1} value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.valueAsNumber || 0 })} className="input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="cp-min">Minimum order (৳)</label><input id="cp-min" type="number" min={0} value={edit.min_total} onChange={(e) => setEdit({ ...edit, min_total: e.target.valueAsNumber || 0 })} className="input" /></div>
              <div><label className="label" htmlFor="cp-max">Max uses (empty = unlimited)</label><input id="cp-max" type="number" min={1} value={edit.max_uses ?? ''} onChange={(e) => setEdit({ ...edit, max_uses: e.target.value === '' ? null : e.target.valueAsNumber })} className="input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="cp-start">Starts</label><input id="cp-start" type="datetime-local" value={toLocal(edit.starts_at)} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="input" /></div>
              <div><label className="label" htmlFor="cp-end">Ends</label><input id="cp-end" type="datetime-local" value={toLocal(edit.ends_at)} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="input" /></div>
            </div>
            <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active" />
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save coupon</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
