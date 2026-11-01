'use client';
import {
  useEffect, useId, useRef, useState,
  type ElementType, type KeyboardEvent, type ReactNode,
} from 'react';
import './signal.css';

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Led ─────────────────────────────────────────────── */
export function Led({ on = true, pulse = true }: { on?: boolean; pulse?: boolean }) {
  return <span className="sg-led" data-on={on} data-pulse={on && pulse} aria-hidden="true" />;
}

/* ── GlitchText: mode="idle" (falla sola) | "hover" ──── */
export function GlitchText({
  children, as: Tag = 'span', mode = 'idle',
}: { children: string; as?: ElementType; mode?: 'idle' | 'hover' }) {
  return <Tag className="sg-glitch" data-text={children} data-mode={mode}>{children}</Tag>;
}

/* ── DecodeText: se descifra al montar o al cambiar `trigger` ── */
const GLYPHS = '░▒▓█#/<>_[]';
export function DecodeText({
  text, duration = 900, trigger,
}: { text: string; duration?: number; trigger?: unknown }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reduced()) { setOut(text); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setOut(
        [...text].map((ch, i) =>
          ch === ' ' || i < p * text.length ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        ).join('')
      );
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, duration, trigger]);
  return (<><span aria-hidden="true">{out}</span><span className="sg-sr">{text}</span></>);
}

/* ── Redacted: bloque tachado que se revela al activar ── */
export function Redacted({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className="sg-redacted" aria-pressed={open} onClick={() => setOpen(o => !o)}>
      <span>{children}</span>
    </button>
  );
}

/* ── Tuner: slider tipo dial de radio ───────────────── */
export function Tuner({
  label, value, onChange, min = 3000, max = 9000, step = 5, unit = 'kHz',
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  const id = useId();
  return (
    <div className="sg-tuner">
      <div className="sg-tuner__head">
        <label htmlFor={id} className="sg-label">{label}</label>
        <span className="sg-tuner__val">{value} <span className="sg-label">{unit}</span></span>
      </div>
      <div className="sg-tuner__dial">
        <input id={id} type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))} />
      </div>
    </div>
  );
}

/* ── Tabs con navegación por flechas ────────────────── */
export function Tabs({ items }: { items: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const next = items[(i + d + items.length) % items.length];
    setActive(next.id); refs.current[next.id]?.focus();
  };
  return (
    <div>
      <div className="sg-tabs__list" role="tablist">
        {items.map((t, i) => (
          <button key={t.id} ref={el => { refs.current[t.id] = el; }} role="tab" className="sg-tab"
            id={`${base}-t-${t.id}`} aria-controls={`${base}-p-${t.id}`}
            aria-selected={active === t.id} tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)} onKeyDown={e => move(e, i)}>
            {active === t.id ? `[${t.label}]` : t.label}
          </button>
        ))}
      </div>
      {items.map(t => (
        <div key={t.id} role="tabpanel" className="sg-tabs__panel" id={`${base}-p-${t.id}`}
          aria-labelledby={`${base}-t-${t.id}`} hidden={active !== t.id}>{t.content}</div>
      ))}
    </div>
  );
}

/* ── Disclosure: <details> nativo con [+] / [–] ─────── */
export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="sg-disc">
      <summary>{title}</summary>
      <div className="sg-disc__body">{children}</div>
    </details>
  );
}

/* ── Transmission: modal sobre <dialog> ─────────────── */
export function Transmission({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const tid = useId();
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sg-tx" aria-labelledby={tid} onClose={onClose}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      <div className="sg-tx__bar">
        <span id={tid} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, letterSpacing: '.12em' }}>
          <Led /> {title}
        </span>
        <button type="button" className="sg-tx__close" onClick={onClose} aria-label="Cerrar">[ cerrar ]</button>
      </div>
      <div className="sg-tx__body">{children}</div>
    </dialog>
  );
}

/* ── Pager: « 01 02 03 » ────────────────────────────── */
export function Pager({
  page, total, onChange,
}: { page: number; total: number; onChange: (p: number) => void }) {
  return (
    <nav className="sg-pager" aria-label="Paginación">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Anterior">«</button>
      {Array.from({ length: total }, (_, i) => i + 1).map(p => (
        <button key={p} type="button" aria-current={p === page ? 'page' : undefined} onClick={() => onChange(p)}>
          {String(p).padStart(2, '0')}
        </button>
      ))}
      <button type="button" disabled={page >= total} onClick={() => onChange(page + 1)} aria-label="Siguiente">»</button>
    </nav>
  );
}

/* ── Skeleton: carga hecha de ░▒█ ───────────────────── */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  const widths = [100, 86, 64, 92, 48];
  return (
    <div role="status" aria-label="Cargando" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="sg-skel" aria-hidden="true" style={{ width: `${widths[i % widths.length]}%` }}>
          {'░▒░░▒░░░▒░░▒░░░░▒░░░▒░░░░░▒░░▒░░░░▒░░░▒░░░░▒░░░░░▒░░▒░░░░▒░░░▒'.repeat(4)}
        </span>
      ))}
    </div>
  );
}

/* ── Stat: dato con barra ASCII ─────────────────────── */
export function Stat({
  label, value, level, of = 10,
}: { label: string; value: string; level: number; of?: number }) {
  return (
    <div className="sg-stat">
      <span className="sg-label">{label}</span>
      <span className="sg-stat__v">{value}</span>
      <span className="sg-stat__bar" aria-hidden="true">{'█'.repeat(level)}{'░'.repeat(of - level)}</span>
    </div>
  );
}

/* ── Static + Scanlines: capas globales opcionales ──── */
export function StaticOverlay({ opacity = 0.05, fps = 12 }: { opacity?: number; fps?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const g = c.getContext('2d'); if (!g) return;
    const draw = () => {
      const img = g.createImageData(c.width, c.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    };
    draw();
    if (reduced()) return;
    const t = setInterval(draw, 1000 / fps);
    return () => clearInterval(t);
  }, [fps]);
  return <canvas ref={ref} className="sg-static" width={160} height={90} style={{ opacity }} aria-hidden="true" />;
}
export function Scanlines() { return <div className="sg-scan" aria-hidden="true" />; }
