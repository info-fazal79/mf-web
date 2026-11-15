/* Nusuk Manager → Social media → Design Builder: drag widgets onto the canvas, move and resize them,
   change text, colours, background, overlay and border, then download a JPG.
   Drawing: _lib/builder.ts. The design is kept on this computer (and can be saved by name). */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, ImagePlus, Redo2, Save, Trash2, Undo2 } from 'lucide-react';
import { supabase as sb } from '@/lib/supabase';
import { loadImage } from '../_lib/clubcard';
import { BD_DISTRICTS } from '../_lib/bdmap';
import { countDistricts } from '../_lib/distmap';
import { TEMPLATES, blankDoc, firstTemplate } from '../_lib/btemplates';
import { BSIZES, SWATCHES, WIDGETS, makeWidget, renderDoc, uid, type BSize, type Bg, type Doc, type El, type WidgetKey } from '../_lib/builder';

type ToastFn = (t: string, ok?: boolean) => void;
type Box = { x: number; y: number; w: number; h: number };
const DOC_KEY = 'nusuk:builder:doc';
const SAVED_KEY = 'nusuk:builder:saved';

const load = <T,>(k: string, d: T): T => { try { const s = localStorage.getItem(k); return s ? (JSON.parse(s) as T) : d; } catch { return d; } };
const keep = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

async function pickImage(): Promise<string> {
  return new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/*';
    i.onchange = () => {
      const f = i.files?.[0];
      if (!f) return res('');
      const r = new FileReader();
      r.onload = async () => {
        const url = String(r.result);
        const im = await loadImage(url);
        if (!im || Math.max(im.width, im.height) <= 1800) return res(url);
        const k = 1800 / Math.max(im.width, im.height);
        const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL(/png|webp/i.test(f.type) ? 'image/png' : 'image/jpeg', 0.9)); // png keeps transparent logos
      };
      r.readAsDataURL(f);
    };
    i.click();
  });
}

// ------------------------------------------------------------------ small inputs
const Row = ({ t, children }: { t: string; children: ReactNode }) => (
  <label className="grid gap-1"><span className="text-xs font-semibold text-emerald-900/80">{t}</span>{children}</label>
);
function ColorIn({ v, set }: { v: string; set: (c: string) => void }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5">
        <input type="color" className="h-8 w-10 cursor-pointer rounded border border-[#e7e1cf] bg-white p-0.5" value={/^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff'} onChange={(e) => set(e.target.value)} />
        <input className="nk-sel flex-1 font-mono text-xs" value={v} onChange={(e) => set(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-1">
        {SWATCHES.map((c) => <button key={c} type="button" title={c} onClick={() => set(c)} className="h-5 w-5 rounded-full border border-black/15" style={{ background: c }} />)}
      </div>
    </div>
  );
}
function Num({ v, set, min = 0, max = 400, step = 1 }: { v: number; set: (n: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" className="flex-1 accent-emerald-800" min={min} max={max} step={step} value={v} onChange={(e) => set(Number(e.target.value))} />
      <input type="number" className="nk-sel w-16 text-xs" min={min} max={max} step={step} value={Math.round(v * 100) / 100} onChange={(e) => set(Number(e.target.value))} />
    </div>
  );
}
const Check = ({ v, set, t }: { v: boolean; set: (b: boolean) => void; t: string }) => (
  <label className="flex items-center gap-2 text-xs font-semibold text-emerald-950"><input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} />{t}</label>
);
const Panel = ({ t, children, right }: { t: string; children: ReactNode; right?: ReactNode }) => (
  <section className="nk-card grid gap-2.5 p-3">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-emerald-950">{t}</h3>{right}</div>
    {children}
  </section>
);

// ------------------------------------------------------------------ page
export default function BuilderPage({ toast }: { toast: ToastFn }) {
  const [doc, setDocRaw] = useState<Doc>(() => load<Doc>(DOC_KEY, firstTemplate('fb_portrait')));
  const [sel, setSel] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [counts, setCounts] = useState<number[] | null>(null);
  const [saved, setSaved] = useState<{ name: string; doc: Doc }[]>(() => load(SAVED_KEY, []));
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const [dispW, setDispW] = useState(560);
  const [gallery, setGallery] = useState(false);
  const past = useRef<Doc[]>([]);
  const future = useRef<Doc[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { w: W, h: H } = BSIZES[doc.size];
  const scale = dispW / W;

  /** change + remember for undo */
  const commit = useCallback((next: Doc | ((d: Doc) => Doc)) => {
    setDocRaw((d) => {
      const n = typeof next === 'function' ? next(d) : next;
      past.current = [...past.current.slice(-60), d];
      future.current = [];
      return n;
    });
  }, []);
  /** change without an undo step (while dragging) */
  const live = (next: (d: Doc) => Doc) => setDocRaw(next);
  const undo = () => { const p = past.current.pop(); if (p) { future.current.push(doc); setDocRaw(p); } };
  const redo = () => { const f = future.current.pop(); if (f) { past.current.push(doc); setDocRaw(f); } };

  useEffect(() => { const t = setTimeout(() => { if (!keep(DOC_KEY, doc)) toast('Design too big to keep on this computer (use smaller pictures)', false); }, 500); return () => clearTimeout(t); }, [doc, toast]);

  // live district counts, only when a map is on the design
  const hasMap = doc.els.some((e) => e.type === 'map');
  useEffect(() => {
    if (!hasMap || counts || !sb) return;
    sb.rpc('nusuk_district_map').then(({ data }) => {
      const d = data as { d?: Record<string, number> } | null;
      setCounts(countDistricts(BD_DISTRICTS, d?.d ?? {}).counts);
    });
  }, [hasMap, counts]);

  // draw
  useEffect(() => {
    let off = false;
    const r = requestAnimationFrame(async () => {
      if (!canvas.current) return;
      const b = await renderDoc(canvas.current, doc, counts);
      if (!off) setBoxes(b);
    });
    return () => { off = true; cancelAnimationFrame(r); };
  }, [doc, counts]);

  // fit the stage to the space
  useEffect(() => {
    const fit = () => {
      const cw = wrapRef.current?.clientWidth ?? 560;
      const maxH = Math.max(320, window.innerHeight * 0.74);
      setDispW(Math.min(cw, (maxH * W) / H));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [W, H]);

  const selEl = doc.els.find((e) => e.id === sel) ?? null;
  const patch = (id: string, p: Partial<El>) => commit((d) => ({ ...d, els: d.els.map((e) => (e.id === id ? ({ ...e, ...p } as El) : e)) }));
  const setBg = (p: Partial<Bg>) => commit((d) => ({ ...d, bg: { ...d.bg, ...p } }));

  function add(k: WidgetKey, cx = W / 2, cy = H / 2) {
    const e = makeWidget(k, W, cx, cy);
    commit((d) => ({ ...d, els: [...d.els, e] }));
    setSel(e.id);
  }
  const remove = (id: string) => { commit((d) => ({ ...d, els: d.els.filter((e) => e.id !== id) })); setSel(null); };
  const duplicate = (id: string) => {
    const e = doc.els.find((x) => x.id === id);
    if (!e) return;
    const c = { ...e, id: uid(), x: e.x + 30, y: e.y + 30 } as El;
    commit((d) => ({ ...d, els: [...d.els, c] }));
    setSel(c.id);
  };
  const move = (id: string, dir: 1 | -1) => commit((d) => {
    const i = d.els.findIndex((e) => e.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= d.els.length) return d;
    const els = [...d.els]; [els[i], els[j]] = [els[j], els[i]];
    return { ...d, els };
  });
  function setSize(s: BSize) {
    const { w, h } = BSIZES[s];
    const kx = w / W, ky = h / H, k = Math.min(kx, ky);
    commit((d) => ({
      ...d, size: s,
      els: d.els.map((e) => {
        const nw = e.w * k, nh = e.h * k;
        const n = { ...e, w: nw, h: nh, x: (e.x + e.w / 2) * kx - nw / 2, y: (e.y + e.h / 2) * ky - nh / 2 } as El;
        if ('size' in n) (n as { size: number }).size = (e as { size: number }).size * k;
        if (n.type === 'text') { n.pad = (e as typeof n).pad * k; n.radius = (e as typeof n).radius * k; }
        return n;
      }),
    }));
  }

  // ---------- pointer: move / resize ----------
  const drag = useRef<{ id: string; mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'; sx: number; sy: number; e: El; moved: boolean } | null>(null);
  function down(ev: React.PointerEvent, id: string, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') {
    ev.stopPropagation(); ev.preventDefault();
    const e = doc.els.find((x) => x.id === id);
    if (!e) return;
    setSel(id);
    try { (ev.currentTarget as Element).closest('.nk-stage')?.setPointerCapture(ev.pointerId); } catch { /* fine */ }
    drag.current = { id, mode, sx: ev.clientX, sy: ev.clientY, e, moved: false };
  }
  function moveP(ev: React.PointerEvent) {
    const g = drag.current;
    if (!g) return;
    const dx = (ev.clientX - g.sx) / scale, dy = (ev.clientY - g.sy) / scale;
    if (!g.moved && Math.hypot(dx, dy) < 2) return;
    if (!g.moved) { past.current = [...past.current.slice(-60), doc]; future.current = []; g.moved = true; }
    const e = g.e, bh = boxes[e.id]?.h ?? e.h;
    let n: Partial<El>;
    if (g.mode === 'move') {
      let x = e.x + dx, y = e.y + dy;
      const snapV = Math.abs(x + e.w / 2 - W / 2) < 12 / scale * 0.6, snapH = Math.abs(y + bh / 2 - H / 2) < 12 / scale * 0.6;
      if (snapV) x = W / 2 - e.w / 2;
      if (snapH) y = H / 2 - bh / 2;
      setGuides({ v: snapV, h: snapH });
      n = { x: Math.round(x), y: Math.round(y) };
    } else {
      const left = g.mode === 'nw' || g.mode === 'sw', top = g.mode === 'nw' || g.mode === 'ne';
      let w = Math.max(30, e.w + (left ? -dx : dx));
      let h = Math.max(20, e.h + (top ? -dy : dy));
      const square = e.type === 'circle' || e.type === 'qr' || (e.type === 'image' && ev.shiftKey);
      if (square) { const r = e.type === 'image' ? e.h / e.w : 1; h = w * r; }
      if (e.type === 'map') h = w * (848 / 600) + 44;
      const auto = e.type === 'text' || e.type === 'list' || e.type === 'options';
      n = { w: Math.round(w), x: Math.round(left ? e.x + e.w - w : e.x) };
      if (!auto) Object.assign(n, { h: Math.round(h), y: Math.round(top ? e.y + e.h - h : e.y) });
    }
    live((d) => ({ ...d, els: d.els.map((x) => (x.id === g.id ? ({ ...x, ...n } as El) : x)) }));
  }
  const up = () => { drag.current = null; setGuides({ v: false, h: false }); };

  // keyboard
  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); redo(); return; }
      if (!sel) return;
      if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); remove(sel); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd') { ev.preventDefault(); duplicate(sel); }
      const step = ev.shiftKey ? 20 : 2;
      const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (m[ev.key]) { ev.preventDefault(); const e = doc.els.find((x) => x.id === sel); if (e) patch(sel, { x: e.x + m[ev.key][0], y: e.y + m[ev.key][1] }); }
      if (ev.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  function onDrop(ev: React.DragEvent) {
    ev.preventDefault();
    const k = ev.dataTransfer.getData('text/nk-widget') as WidgetKey;
    if (!k) return;
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    add(k, (ev.clientX - r.left) / scale, (ev.clientY - r.top) / scale);
  }

  async function download() {
    if (!canvas.current) return;
    setSel(null);
    canvas.current.toBlob((b) => {
      if (!b) return toast('Could not make the picture', false);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = `nusuk-design-${doc.size}.jpg`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('JPG downloaded');
    }, 'image/jpeg', 0.93);
  }
  function saveAs() {
    const name = prompt('Name for this design', `Design ${saved.length + 1}`)?.trim();
    if (!name) return;
    const next = [...saved.filter((s) => s.name !== name), { name, doc }];
    if (!keep(SAVED_KEY, next)) return toast('Not enough space on this computer, remove an old design or use smaller pictures', false);
    setSaved(next); toast('Saved');
  }

  // ------------------------------------------------------------------ properties of the selected element
  function props(e: El) {
    const p = (q: Partial<El>) => patch(e.id, q);
    const common = (
      <>
        <div className="grid gap-2">
          <Row t="Opacity"><Num v={e.opacity} set={(v) => p({ opacity: v })} min={0.05} max={1} step={0.05} /></Row>
          <Row t="Rotate°"><Num v={e.rot} set={(v) => p({ rot: v })} min={-45} max={45} /></Row>
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-[11px]">
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <label key={k} className="grid gap-0.5"><span className="font-semibold uppercase text-emerald-900/60">{k}</span>
              <input type="number" className="nk-sel text-xs" value={Math.round(e[k])} onChange={(ev) => p({ [k]: Number(ev.target.value) } as Partial<El>)} /></label>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs" onClick={() => p({ x: Math.round(W / 2 - e.w / 2) })}>↔ Centre</button>
          <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs" onClick={() => p({ y: Math.round(H / 2 - (boxes[e.id]?.h ?? e.h) / 2) })}>↕ Middle</button>
          <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs" onClick={() => duplicate(e.id)}><Copy className="h-3 w-3" /> Copy</button>
          <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs" onClick={() => move(e.id, 1)}><ArrowUp className="h-3 w-3" /> Front</button>
          <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs" onClick={() => move(e.id, -1)}><ArrowDown className="h-3 w-3" /> Back</button>
          <button type="button" className="nk-btn nk-ghost px-2 py-1 text-xs text-red-700" onClick={() => remove(e.id)}><Trash2 className="h-3 w-3" /> Delete</button>
        </div>
      </>
    );
    if (e.type === 'text') return (
      <>
        <Row t="Text"><textarea className="nk-input text-sm" rows={3} value={e.text} onChange={(ev) => p({ text: ev.target.value })} /></Row>
        <div className="grid gap-2">
          <Row t="Size"><Num v={e.size} set={(v) => p({ size: v })} min={10} max={220} /></Row>
          <Row t="Weight"><select className="nk-sel text-xs" value={e.weight} onChange={(ev) => p({ weight: Number(ev.target.value) })}>{[400, 500, 600, 700].map((w) => <option key={w} value={w}>{w === 700 ? 'Bold' : w === 600 ? 'Semi bold' : w === 500 ? 'Medium' : 'Regular'}</option>)}</select></Row>
        </div>
        <div className="flex gap-1">{(['left', 'center', 'right'] as const).map((a) => <button key={a} type="button" onClick={() => p({ align: a })} className={`nk-btn flex-1 px-2 py-1 text-xs ${e.align === a ? 'nk-green' : 'nk-ghost'}`}>{a}</button>)}</div>
        <Row t="Colour"><ColorIn v={e.color} set={(c) => p({ color: c })} /></Row>
        <div className="grid gap-2">
          <Row t="Line height"><Num v={e.lh} set={(v) => p({ lh: v })} min={0.9} max={2.2} step={0.05} /></Row>
          <Row t="Font"><select className="nk-sel text-xs" value={e.font} onChange={(ev) => p({ font: ev.target.value as 'bn' | 'mono' })}><option value="bn">Bangla (Hind Siliguri)</option><option value="mono">Code (mono)</option></select></Row>
        </div>
        <Check v={e.shadow} set={(b) => p({ shadow: b })} t="Shadow" />
        <Check v={e.bgOn} set={(b) => p({ bgOn: b })} t="Background box (tag / button)" />
        {e.bgOn && (
          <>
            <Row t="Box colour"><ColorIn v={e.bg} set={(c) => p({ bg: c })} /></Row>
            <div className="grid gap-2">
              <Row t="Padding"><Num v={e.pad} set={(v) => p({ pad: v })} max={80} /></Row>
              <Row t="Round corners"><Num v={e.radius} set={(v) => p({ radius: v })} max={120} /></Row>
            </div>
          </>
        )}
        <div className="grid gap-2">
          <Row t="Border"><Num v={e.borderW} set={(v) => p({ borderW: v })} max={20} /></Row>
          {e.borderW > 0 && <Row t="Border colour"><ColorIn v={e.borderC} set={(c) => p({ borderC: c })} /></Row>}
        </div>
        {common}
      </>
    );
    if (e.type === 'list') return (
      <>
        <Row t="Lines (one per line)"><textarea className="nk-input text-sm" rows={4} value={e.items} onChange={(ev) => p({ items: ev.target.value })} /></Row>
        <Check v={e.numbered} set={(b) => p({ numbered: b })} t="Numbers instead of ✓" />
        <Row t="Size"><Num v={e.size} set={(v) => p({ size: v })} min={12} max={90} /></Row>
        <div className="grid grid-cols-2 gap-2">
          <Row t="Text colour"><ColorIn v={e.color} set={(c) => p({ color: c })} /></Row>
          <Row t="Mark colour"><ColorIn v={e.mark} set={(c) => p({ mark: c })} /></Row>
        </div>
        {common}
      </>
    );
    if (e.type === 'options') return (
      <>
        <Row t="Options (one per line, up to 6)"><textarea className="nk-input text-sm" rows={4} value={e.items} onChange={(ev) => p({ items: ev.target.value.split('\n').slice(0, 6).join('\n') })} /></Row>
        <div className="grid gap-2">
          <Row t="Size"><Num v={e.size} set={(v) => p({ size: v })} min={14} max={80} /></Row>
          <Row t="Columns"><select className="nk-sel text-xs" value={e.cols} onChange={(ev) => p({ cols: Number(ev.target.value) as 1 | 2 })}><option value={2}>2</option><option value={1}>1</option></select></Row>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Row t="Text"><ColorIn v={e.color} set={(c) => p({ color: c })} /></Row>
          <Row t="Edge / mark"><ColorIn v={e.edge} set={(c) => p({ edge: c, mark: c })} /></Row>
        </div>
        <Row t="Box colour"><ColorIn v={e.card} set={(c) => p({ card: c })} /></Row>
        {common}
      </>
    );
    if (e.type === 'image') return (
      <>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="nk-btn nk-green px-3 py-1.5 text-xs" onClick={async () => { const u = await pickImage(); if (u) p({ src: u }); }}><ImagePlus className="h-3.5 w-3.5" /> {e.src ? 'Change picture' : e.logo ? 'Upload logo' : 'Upload picture'}</button>
          {e.src && <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-xs" onClick={() => p({ src: '' })}>{e.logo ? 'Back to Ribat logo' : 'Remove picture'}</button>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Row t="Fit"><select className="nk-sel text-xs" value={e.fit} onChange={(ev) => p({ fit: ev.target.value as 'cover' | 'contain' })}><option value="cover">Fill the box</option><option value="contain">Show whole picture</option></select></Row>
          <Row t="Round corners"><Num v={e.radius} set={(v) => p({ radius: v })} max={300} /></Row>
        </div>
        <Check v={e.circle} set={(b) => p({ circle: b })} t="Circle" />
        <Check v={e.shadow} set={(b) => p({ shadow: b })} t="Shadow" />
        <div className="grid gap-2">
          <Row t="Border"><Num v={e.borderW} set={(v) => p({ borderW: v })} max={30} /></Row>
          {e.borderW > 0 && <Row t="Border colour"><ColorIn v={e.borderC} set={(c) => p({ borderC: c })} /></Row>}
        </div>
        <p className="text-[11px] text-emerald-900/60">Tip: hold Shift while resizing to keep the shape. PNG logos stay transparent.</p>
        {common}
      </>
    );
    if (e.type === 'rect' || e.type === 'circle' || e.type === 'line') return (
      <>
        {e.type !== 'line' && <Check v={e.fillOn} set={(b) => p({ fillOn: b })} t="Fill" />}
        {e.type !== 'line' && e.fillOn && <Row t="Fill colour"><ColorIn v={e.fill} set={(c) => p({ fill: c })} /></Row>}
        <div className="grid grid-cols-2 gap-2">
          <Row t={e.type === 'line' ? 'Thickness' : 'Border'}><Num v={e.borderW} set={(v) => p({ borderW: v })} max={40} /></Row>
          {e.type === 'rect' && <Row t="Round corners"><Num v={e.radius} set={(v) => p({ radius: v })} max={300} /></Row>}
        </div>
        {(e.borderW > 0 || e.type === 'line') && <Row t={e.type === 'line' ? 'Colour' : 'Border colour'}><ColorIn v={e.borderC} set={(c) => p({ borderC: c })} /></Row>}
        {e.type !== 'line' && <Check v={e.shadow} set={(b) => p({ shadow: b })} t="Shadow" />}
        {common}
      </>
    );
    if (e.type === 'stat') return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <Row t="Number"><input className="nk-sel text-sm" value={e.value} onChange={(ev) => p({ value: ev.target.value })} /></Row>
          <Row t="Label"><input className="nk-sel text-sm" value={e.label} onChange={(ev) => p({ label: ev.target.value })} /></Row>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Row t="Number colour"><ColorIn v={e.color} set={(c) => p({ color: c })} /></Row>
          <Row t="Edge"><ColorIn v={e.edge} set={(c) => p({ edge: c })} /></Row>
        </div>
        <Row t="Box colour"><ColorIn v={e.card} set={(c) => p({ card: c })} /></Row>
        {common}
      </>
    );
    if (e.type === 'qr') return (
      <>
        <Row t="Link"><input className="nk-sel text-sm" value={e.text} onChange={(ev) => p({ text: ev.target.value })} /></Row>
        <div className="grid grid-cols-2 gap-2">
          <Row t="Dots"><ColorIn v={e.color} set={(c) => p({ color: c })} /></Row>
          <Row t="Background"><ColorIn v={e.bg} set={(c) => p({ bg: c })} /></Row>
        </div>
        {common}
      </>
    );
    if (e.type !== 'map') return null;
    return (
      <>
        <p className="text-xs text-emerald-900/70">Live accounts per district from /nusuk.</p>
        <Check v={e.panel} set={(b) => p({ panel: b })} t="Light panel behind the map" />
        {e.panel && <Row t="Panel edge"><ColorIn v={e.edge} set={(c) => p({ edge: c })} /></Row>}
        <button type="button" className="nk-btn nk-ghost w-fit px-2 py-1 text-xs" onClick={() => setCounts(null)}>Refresh counts</button>
        {common}
      </>
    );
  }

  const b = doc.bg;
  return (
    <div className="grid items-start gap-3 xl:grid-cols-[12.5rem_minmax(0,1fr)_20rem]">
      {/* ---------- widgets ---------- */}
      <aside className="grid gap-3 xl:sticky xl:top-4">
        <Panel t="Widgets">
          <p className="-mt-1 text-[11px] text-emerald-900/60">Drag onto the design, or click to add.</p>
          {(['Text', 'Pictures', 'Shapes', 'Nusuk'] as const).map((g) => (
            <div key={g} className="grid gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-900/50">{g}</span>
              <div className="grid grid-cols-2 gap-1">
                {WIDGETS.filter((w) => w.group === g).map((w) => (
                  <button key={w.key} type="button" draggable onDragStart={(ev) => { ev.dataTransfer.setData('text/nk-widget', w.key); ev.dataTransfer.effectAllowed = 'copy'; }}
                    onClick={() => add(w.key)} className="cursor-grab rounded-lg border border-[#e7e1cf] bg-white px-2 py-1.5 text-left text-xs font-semibold text-emerald-950 hover:border-emerald-700 hover:bg-emerald-50 active:cursor-grabbing">{w.label}</button>
                ))}
              </div>
            </div>
          ))}
        </Panel>
        <Panel t="Start from">
          <button type="button" className="nk-btn nk-green w-full py-2.5 text-sm" onClick={() => setGallery(true)}>🎨 Templates</button>
          <button type="button" className="w-full rounded-lg border border-[#e7e1cf] bg-white px-2 py-1.5 text-xs font-semibold hover:bg-emerald-50"
            onClick={() => { if (doc.els.length && !confirm('Start a blank design? (the current one is replaced)')) return; commit(blankDoc(doc.size)); setSel(null); }}>Blank design</button>
          {saved.length > 0 && (
            <div className="grid gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-900/50">Saved designs</span>
              {saved.map((s) => (
                <div key={s.name} className="flex items-center gap-1">
                  <button type="button" className="flex-1 truncate rounded-lg border border-[#e7e1cf] bg-white px-2 py-1 text-left text-xs font-semibold hover:bg-emerald-50" onClick={() => { commit(s.doc); setSel(null); }}>{s.name}</button>
                  <button type="button" className="px-1 text-red-700" aria-label="Delete" onClick={() => { if (!confirm(`Delete "${s.name}"?`)) return; const n = saved.filter((x) => x.name !== s.name); keep(SAVED_KEY, n); setSaved(n); }}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </aside>

      {/* ---------- stage ---------- */}
      <section className="nk-card grid gap-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select className="nk-sel max-w-full flex-1 text-sm" value={doc.size} onChange={(e) => setSize(e.target.value as BSize)}>
            {(Object.keys(BSIZES) as BSize[]).map((k) => <option key={k} value={k}>{BSIZES[k].label} · {BSIZES[k].w}×{BSIZES[k].h}</option>)}
          </select>
          <button type="button" className="nk-btn nk-ghost px-2 py-1.5" title="Undo (Ctrl+Z)" onClick={undo}><Undo2 className="h-4 w-4" /></button>
          <button type="button" className="nk-btn nk-ghost px-2 py-1.5" title="Redo (Ctrl+Y)" onClick={redo}><Redo2 className="h-4 w-4" /></button>
          <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-xs" onClick={saveAs}><Save className="h-4 w-4" /> Save</button>
          <button type="button" className="nk-btn nk-green px-3 py-1.5 text-xs" onClick={download}><Download className="h-4 w-4" /> Download JPG</button>
        </div>
        <div ref={wrapRef} className="grid w-full place-items-center rounded-xl bg-[repeating-conic-gradient(#f1ede2_0%_25%,#faf7ee_0%_50%)] bg-[length:20px_20px] p-0">
          <div className="nk-stage relative touch-none select-none" style={{ width: dispW, height: dispW * (H / W) }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }} onDrop={onDrop}
            onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} onPointerDown={() => setSel(null)}>
            <canvas ref={canvas} width={W} height={H} className="absolute inset-0 h-full w-full shadow-lg" />
            {guides.v && <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-pink-500" style={{ left: dispW / 2 }} />}
            {guides.h && <div className="pointer-events-none absolute right-0 left-0 h-px bg-pink-500" style={{ top: (dispW * (H / W)) / 2 }} />}
            {doc.els.map((e) => {
              const bx = boxes[e.id] ?? { x: e.x, y: e.y, w: e.w, h: e.h };
              const on = e.id === sel;
              return (
                <div key={e.id} onPointerDown={(ev) => down(ev, e.id, 'move')} onDoubleClick={() => setSel(e.id)}
                  className={`absolute cursor-move ${on ? 'outline-2 outline-sky-500 outline-solid' : 'hover:outline-1 hover:outline-dashed hover:outline-sky-400'}`}
                  style={{ left: bx.x * scale, top: bx.y * scale, width: bx.w * scale, height: Math.max(6, bx.h * scale), transform: e.rot ? `rotate(${e.rot}deg)` : undefined }}>
                  {on && (['nw', 'ne', 'sw', 'se'] as const).map((m) => (
                    <span key={m} onPointerDown={(ev) => down(ev, e.id, m)}
                      className="absolute h-3 w-3 rounded-sm border border-sky-600 bg-white"
                      style={{ left: m[1] === 'w' ? -6 : undefined, right: m[1] === 'e' ? -6 : undefined, top: m[0] === 'n' ? -6 : undefined, bottom: m[0] === 's' ? -6 : undefined, cursor: m === 'nw' || m === 'se' ? 'nwse-resize' : 'nesw-resize' }} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-center text-[11px] text-emerald-900/55">Drag to move · corners to resize · arrows nudge (Shift = more) · Delete removes · Ctrl+D copies · Ctrl+Z undo</p>
      </section>

      {/* ---------- properties ---------- */}
      <aside className="grid gap-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:overflow-x-hidden">
        {selEl ? (
          <Panel t={selEl.name ?? selEl.type} right={<button type="button" className="text-xs text-emerald-700" onClick={() => setSel(null)}>Done</button>}>{props(selEl)}</Panel>
        ) : (
          <Panel t="Background">
            <div className="flex gap-1">{(['solid', 'gradient', 'image'] as const).map((k) => <button key={k} type="button" onClick={() => setBg({ kind: k })} className={`nk-btn flex-1 px-2 py-1 text-xs ${b.kind === k ? 'nk-green' : 'nk-ghost'}`}>{k === 'solid' ? 'Colour' : k === 'gradient' ? 'Gradient' : 'Picture'}</button>)}</div>
            <Row t={b.kind === 'gradient' ? 'Colour 1' : 'Colour'}><ColorIn v={b.c1} set={(c) => setBg({ c1: c })} /></Row>
            {b.kind === 'gradient' && (
              <>
                <Row t="Colour 2"><ColorIn v={b.c2} set={(c) => setBg({ c2: c })} /></Row>
                <Row t="Angle"><Num v={b.angle} set={(v) => setBg({ angle: v })} max={360} /></Row>
              </>
            )}
            {b.kind === 'image' && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className="nk-btn nk-green px-3 py-1.5 text-xs" onClick={async () => { const u = await pickImage(); if (u) setBg({ image: u }); }}><ImagePlus className="h-3.5 w-3.5" /> {b.image ? 'Change picture' : 'Upload picture'}</button>
                  <select className="nk-sel text-xs" value={b.fit} onChange={(e) => setBg({ fit: e.target.value as 'cover' | 'contain' })}><option value="cover">Fill</option><option value="contain">Whole picture</option></select>
                </div>
                <Row t="Overlay colour"><ColorIn v={b.overlay} set={(c) => setBg({ overlay: c })} /></Row>
                <Row t="Overlay strength"><Num v={b.overlayOp} set={(v) => setBg({ overlayOp: v })} max={1} step={0.05} /></Row>
              </>
            )}
            <Check v={b.pattern} set={(v) => setBg({ pattern: v })} t="Islamic star pattern" />
            {b.pattern && (
              <div className="grid gap-2">
                <Row t="Pattern colour"><ColorIn v={b.patternColor} set={(c) => setBg({ patternColor: c })} /></Row>
                <Row t="Strength"><Num v={b.patternOp} set={(v) => setBg({ patternOp: v })} max={0.6} step={0.02} /></Row>
              </div>
            )}
            <Check v={b.frame} set={(v) => setBg({ frame: v })} t="Border around the design" />
            {b.frame && (
              <>
                <Row t="Border colour"><ColorIn v={b.frameColor} set={(c) => setBg({ frameColor: c })} /></Row>
                <div className="grid gap-2">
                  <Row t="Thickness"><Num v={b.frameW} set={(v) => setBg({ frameW: v })} min={1} max={40} /></Row>
                  <Row t="Inset"><Num v={b.frameInset} set={(v) => setBg({ frameInset: v })} max={120} /></Row>
                  <Row t="Corners"><Num v={b.frameR} set={(v) => setBg({ frameR: v })} max={120} /></Row>
                </div>
              </>
            )}
          </Panel>
        )}
        <Panel t="Layers" right={<span className="text-[11px] text-emerald-900/50">top first</span>}>
          {doc.els.length === 0 && <p className="text-xs text-emerald-900/60">Drag a widget onto the design.</p>}
          <div className="grid gap-1">
            {[...doc.els].reverse().map((e) => (
              <div key={e.id} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${e.id === sel ? 'border-emerald-800 bg-emerald-50' : 'border-[#e7e1cf] bg-white'}`}>
                <button type="button" className="min-w-0 flex-1 truncate text-left font-semibold" onClick={() => setSel(e.id)}>
                  {e.name ?? e.type}{e.type === 'text' ? <span className="font-normal text-emerald-900/60"> · {e.text.slice(0, 18)}</span> : null}
                </button>
                <button type="button" aria-label="Up" onClick={() => move(e.id, 1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Down" onClick={() => move(e.id, -1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Delete" className="text-red-700" onClick={() => remove(e.id)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </Panel>
      </aside>
      {gallery && <Gallery size={doc.size} close={() => setGallery(false)} pick={(d) => { if (doc.els.length && !confirm('Replace the current design with this template?')) return; commit(d); setSel(null); setGallery(false); }} />}
    </div>
  );
}

/** Template picker: a kind on the left, its layouts (with a real preview at the current size) on the right */
function Gallery({ size, close, pick }: { size: BSize; close: () => void; pick: (d: Doc) => void }) {
  const [cat, setCat] = useState(TEMPLATES[0].key);
  const c = TEMPLATES.find((t) => t.key === cat)!;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [close]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3" onClick={close}>
      <div className="grid max-h-[92vh] w-full max-w-5xl grid-rows-[auto_1fr] overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-[#e7e1cf] px-4 py-3">
          <div><h2 className="font-bold text-emerald-950">Templates</h2><p className="text-xs text-emerald-900/60">Pick a kind, then a layout. Everything stays editable. Size: {BSIZES[size].label}</p></div>
          <button type="button" className="nk-btn nk-ghost px-3 py-1.5 text-sm" onClick={close}>Close</button>
        </div>
        <div className="grid min-h-0 sm:grid-cols-[12rem_1fr]">
          <nav className="flex gap-1 overflow-x-auto border-b border-[#e7e1cf] p-2 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0">
            {TEMPLATES.map((t) => (
              <button key={t.key} type="button" onClick={() => setCat(t.key)}
                className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-semibold ${cat === t.key ? 'bg-emerald-900 text-white' : 'text-emerald-950 hover:bg-emerald-50'}`}>{t.emoji} {t.label}</button>
            ))}
          </nav>
          <div className="grid min-h-0 grid-cols-2 content-start gap-3 overflow-y-auto p-3 md:grid-cols-3">
            {c.variants.map((v) => <Thumb key={`${cat}-${v.key}-${size}`} label={v.label} make={() => v.make(size)} pick={pick} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
function Thumb({ label, make, pick }: { label: string; make: () => Doc; pick: (d: Doc) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [d] = useState(make);
  useEffect(() => { if (ref.current) renderDoc(ref.current, d, null); }, [d]);
  return (
    <button type="button" onClick={() => pick(make())} className="group grid gap-1.5 rounded-xl border border-[#e7e1cf] bg-[#faf7ee] p-2 text-left hover:border-emerald-700 hover:shadow-md">
      <canvas ref={ref} className="w-full rounded-lg shadow-sm" />
      <span className="text-xs font-bold text-emerald-950 group-hover:text-emerald-700">{label}</span>
    </button>
  );
}
