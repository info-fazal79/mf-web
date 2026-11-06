import { useState } from 'react';
import { I, ImageField, TagsField, Toggle } from './ui';

export type Field =
  | { key: string; label: string; type: 'text' | 'url' | 'email' | 'textarea' | 'color' | 'number'; help?: string; placeholder?: string; wide?: boolean }
  | { key: string; label: string; type: 'image' | 'file'; help?: string; wide?: boolean }
  | { key: string; label: string; type: 'toggle'; help?: string; wide?: boolean }
  | { key: string; label: string; type: 'tags'; help?: string; wide?: boolean }
  | { key: string; label: string; type: 'select'; options: string[]; help?: string; wide?: boolean }
  | { key: string; label: string; type: 'textlist'; help?: string; wide?: boolean }
  | { key: string; label: string; type: 'list'; fields: Field[]; itemLabel: string; help?: string; wide?: boolean };

type Obj = Record<string, unknown>;

function blankFor(fields: Field[]): Obj {
  const o: Obj = {};
  for (const f of fields) {
    o[f.key] =
      f.type === 'toggle' ? false : f.type === 'number' ? 0 : f.type === 'tags' || f.type === 'list' || f.type === 'textlist' ? [] : f.type === 'select' ? f.options[0] : '';
  }
  return o;
}

function move<T>(arr: T[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

function ListField({ field, value, onChange }: { field: Extract<Field, { type: 'list' }>; value: Obj[]; onChange: (v: Obj[]) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="grid gap-2">
      {value.map((item, i) => {
        const title = String(item[field.itemLabel] ?? '') || `Item ${i + 1}`;
        const isOpen = open === i;
        return (
          <div key={i} className="rounded-xl border border-line bg-surface-2">
            <div className="flex items-center gap-2 px-3 py-2">
              <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium">
                <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
                <span className="truncate">{title}</span>
              </button>
              <button type="button" title="Move up" onClick={() => onChange(move(value, i, -1))} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface"><I n="up" s={15} /></button>
              <button type="button" title="Move down" onClick={() => onChange(move(value, i, 1))} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface"><I n="down" s={15} /></button>
              <button
                type="button"
                title="Delete"
                onClick={() => confirm(`Remove "${title}"?`) && onChange(value.filter((_, j) => j !== i))}
                className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-red-500"
              >
                <I n="trash" s={15} />
              </button>
            </div>
            {isOpen && (
              <div className="border-t border-line p-4">
                <SchemaForm fields={field.fields} value={item} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => {
          onChange([...value, blankFor(field.fields)]);
          setOpen(value.length);
        }}
        className="btn-ghost justify-self-start px-3 py-1.5 text-xs"
      >
        <I n="plus" s={14} /> Add item
      </button>
    </div>
  );
}

function TextList({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid gap-2">
      {value.map((t, i) => (
        <div key={i} className="flex items-start gap-2">
          <textarea value={t} rows={3} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} className="input resize-y" />
          <div className="grid gap-1">
            <button type="button" onClick={() => onChange(move(value, i, -1))} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2"><I n="up" s={15} /></button>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-red-500"><I n="trash" s={15} /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, ''])} className="btn-ghost justify-self-start px-3 py-1.5 text-xs">
        <I n="plus" s={14} /> Add paragraph
      </button>
    </div>
  );
}

export function SchemaForm({ fields, value, onChange }: { fields: Field[]; value: Obj; onChange: (v: Obj) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {fields.map((f) => {
        const v = value[f.key];
        const wide = f.wide ?? ['textarea', 'list', 'textlist', 'tags', 'image', 'file'].includes(f.type);
        const id = `f-${f.key}-${Math.random().toString(36).slice(2, 7)}`;
        return (
          <div key={f.key} className={wide ? 'sm:col-span-2' : ''}>
            {f.type !== 'toggle' && (
              <label className="label" htmlFor={id}>
                {f.label}
              </label>
            )}
            {f.type === 'textarea' ? (
              <textarea id={id} value={String(v ?? '')} rows={4} onChange={(e) => set(f.key, e.target.value)} className="input resize-y" placeholder={f.placeholder} />
            ) : f.type === 'number' ? (
              <input id={id} type="number" step="any" value={Number(v ?? 0)} onChange={(e) => set(f.key, e.target.valueAsNumber || 0)} className="input" />
            ) : f.type === 'color' ? (
              <div className="flex gap-2">
                <input type="color" value={String(v || '#000000')} onChange={(e) => set(f.key, e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-surface-2" />
                <input id={id} value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)} className="input font-mono" />
              </div>
            ) : f.type === 'toggle' ? (
              <Toggle checked={Boolean(v)} onChange={(x) => set(f.key, x)} label={f.label} />
            ) : f.type === 'image' ? (
              <ImageField value={String(v ?? '')} onChange={(x) => set(f.key, x)} />
            ) : f.type === 'file' ? (
              <ImageField value={String(v ?? '')} onChange={(x) => set(f.key, x)} accept="*" />
            ) : f.type === 'tags' ? (
              <TagsField value={(v as string[]) ?? []} onChange={(x) => set(f.key, x)} />
            ) : f.type === 'select' ? (
              <select id={id} value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)} className="input">
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : f.type === 'textlist' ? (
              <TextList value={(v as string[]) ?? []} onChange={(x) => set(f.key, x)} />
            ) : f.type === 'list' ? (
              <ListField field={f} value={(v as Obj[]) ?? []} onChange={(x) => set(f.key, x)} />
            ) : (
              <input id={id} type={f.type} value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)} className="input" placeholder={'placeholder' in f ? f.placeholder : undefined} />
            )}
            {f.help && <p className="mt-1.5 text-xs text-muted">{f.help}</p>}
          </div>
        );
      })}
    </div>
  );
}
