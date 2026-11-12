import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AuthForm } from './AccountApp';
import { Star } from 'lucide-react';

type Review = { id: string; name: string; rating: number; body: string | null; created_at: string; status: string; user_id: string | null };

const Stars = ({ n, size = 14 }: { n: number; size?: number }) => (
  <span className="inline-flex text-yellow-400" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={size} fill={i <= Math.round(n) ? 'currentColor' : 'none'} strokeWidth={1.5} aria-hidden="true" />
    ))}
  </span>
);

export default function EbookReviews({ ebookId }: { ebookId: string }) {
  const [list, setList] = useState<Review[] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [rating, setRating] = useState(5);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [err, setErr] = useState('');
  const [login, setLogin] = useState(false);

  const load = () => supabase?.from('ebook_reviews').select('id,name,rating,body,created_at,status,user_id').eq('ebook_id', ebookId).order('created_at', { ascending: false }).then(({ data }) => setList((data as Review[]) ?? []));
  useEffect(() => {
    if (!supabase) return setList([]);
    load();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [ebookId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session) { setLogin(false); load(); }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const approved = (list ?? []).filter((r) => r.status === 'approved');
  const mine = (list ?? []).find((r) => session && r.user_id === session.user.id);
  const avg = approved.length ? approved.reduce((a, r) => a + r.rating, 0) / approved.length : 0;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) return;
    const body = String(new FormData(e.currentTarget).get('body') ?? '').trim();
    setState('sending');
    setErr('');
    const name = String(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Reader');
    const { error } = await supabase!.from('ebook_reviews').insert({ ebook_id: ebookId, user_id: session.user.id, name, rating, body: body || null });
    if (error) {
      setState('idle');
      return setErr(error.code === '23505' ? 'You have already reviewed this e-book.' : 'Could not send your review.');
    }
    setState('done');
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Reader reviews</h2>
          {approved.length > 0 && (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted"><Stars n={avg} /> {avg.toFixed(1)} out of 5 · {approved.length} review{approved.length > 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      <div className="card mt-5 p-5">
        {mine ? (
          <p className="text-sm text-muted">{mine.status === 'approved' ? 'Thanks for your review!' : 'Thanks! Your review is awaiting approval.'}</p>
        ) : state === 'done' ? (
          <p className="text-sm text-accent">Thanks! Your review will appear after approval.</p>
        ) : session ? (
          <form onSubmit={submit} className="grid gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">Your rating</span>
              <div className="flex" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} type="button" role="radio" aria-checked={rating === i} onClick={() => setRating(i)} className={`text-2xl ${i <= rating ? 'text-yellow-400' : 'text-muted/30'}`} aria-label={`${i} stars`}>★</button>
                ))}
              </div>
            </div>
            <textarea name="body" rows={3} maxLength={3000} placeholder="What did you like? Who would you recommend it to?" className="input resize-y" />
            {err && <p className="text-sm text-red-500">{err}</p>}
            <button type="submit" disabled={state === 'sending'} className="btn-primary justify-self-start">{state === 'sending' ? 'Sending…' : 'Submit review'}</button>
          </form>
        ) : login ? (
          <AuthForm compact />
        ) : (
          <p className="text-sm text-muted">
            <button type="button" onClick={() => setLogin(true)} className="font-semibold text-accent hover:underline">Sign in</button> to write a review.
          </p>
        )}
      </div>

      {list === null ? (
        <p className="mt-6 text-sm text-muted">Loading reviews…</p>
      ) : approved.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No reviews yet. Be the first!</p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {approved.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft font-bold text-accent">{r.name[0]?.toUpperCase()}</span>
                <div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  <Stars n={r.rating} size={12} />
                </div>
                <span className="ml-auto text-xs text-muted">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.body && <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
