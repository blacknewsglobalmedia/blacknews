import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  Plus,
  Trash2,
  X,
  Flag,
  Clock,
  Sparkles,
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CountryFlag } from './SocialPostGenerator';
import { CATEGORIES } from '../data/newsData';
import {
  CalendarEvent,
  CalendarEventKind,
  KIND_META,
  KIND_ORDER,
  eventCovers,
  expandEventsForYear,
  formatLongDate,
  readLocalEvents,
  todayIso,
  writeLocalEvents,
  daysUntil,
} from '../data/editorialCalendar';
import type { RedactorProfile } from '../types/auth';

// Firestore `settings/editorial_calendar`: lectura pública, escritura del
// propietario (mismo patrón que flash_news y categories).
const REMOTE_KEY = ['settings', 'editorial_calendar'] as const;

const MONTHS_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** Cabecera de semana lunes-first (la redacción trabaja en semana laborable). */
const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface EditorialCalendarProps {
  currentUser: RedactorProfile;
  /** Solo ADMIN y MODERADOR dan de alta/borran acontecimientos. */
  canManage: boolean;
}

/**
 * Agenda editorial en rejilla grande: elecciones, cumbres, efemérides y
 * recordatorios, filtrable por país, sección y tipo. Vista mensual con
 * navegación, ficha del día y lista de lo que viene ahora mismo.
 */
export const EditorialCalendar: React.FC<EditorialCalendarProps> = ({
  currentUser,
  canManage,
}) => {
  const now = todayIso();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = now.split('-').map(Number);
    return { year: y, month: m - 1 }; // month 0-indexed
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>(() => readLocalEvents());
  const [isAdding, setIsAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Filtros
  const [activeKinds, setActiveKinds] = useState<CalendarEventKind[]>([]);
  const [activeCountry, setActiveCountry] = useState<string>('TODOS');
  const [activeCategory, setActiveCategory] = useState<string>('TODAS');
  const [onlyUpcoming, setOnlyUpcoming] = useState(false);

  // ── Carga remota (Firestore) + respaldo local ──────────────────────────
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const snap = await getDoc(doc(db, REMOTE_KEY[0], REMOTE_KEY[1]));
        if (!alive || !snap.exists()) return;
        const items = (snap.data() as { items?: CalendarEvent[] }).items;
        if (!Array.isArray(items) || items.length === 0) return;
        setEvents(items);
        writeLocalEvents(items);
      } catch {
        /* sin permisos o sin red: sigue la copia local */
      }
    };
    void pull();
    return () => {
      alive = false;
    };
  }, []);

  const persist = async (next: CalendarEvent[]) => {
    setEvents(next);
    writeLocalEvents(next);
    try {
      await setDoc(doc(db, REMOTE_KEY[0], REMOTE_KEY[1]), { items: next });
    } catch {
      /* solo el propietario puede escribir: los demás ven su copia local */
    }
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  // ── Año visible y expansión de recurrentes ─────────────────────────────
  const yearEvents = useMemo(
    () => expandEventsForYear(events, cursor.year),
    [events, cursor.year],
  );

  // ── Filtro compartido (misma lógica para rejilla, próximos y ficha) ─────
  const matchesFilters = (ev: CalendarEvent): boolean => {
    if (activeKinds.length > 0 && !activeKinds.includes(ev.kind)) return false;
    if (activeCountry !== 'TODOS' && ev.country !== activeCountry) return false;
    if (activeCategory !== 'TODAS' && ev.category !== activeCategory) return false;
    if (onlyUpcoming && ev.date < now) return false;
    return true;
  };

  const filtered = useMemo(
    () => yearEvents.filter(matchesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yearEvents, activeKinds, activeCountry, activeCategory, onlyUpcoming, now],
  );

  // Próximos 30 días: se ancla al año REAL de hoy (no al visible en la
  // rejilla) y mira también el siguiente, para que a mediados de diciembre
  // salgan los hitos de enero o al navegar a otros años no se vacíe.
  const upcoming = useMemo(() => {
    const horizonIso = new Date(Date.now() + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const thisYear = Number(now.slice(0, 4));
    const pool = [
      ...expandEventsForYear(events, thisYear),
      ...expandEventsForYear(events, thisYear + 1),
    ];
    return pool
      .filter((ev) => matchesFilters(ev) && ev.date >= now && ev.date <= horizonIso)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, activeKinds, activeCountry, activeCategory, onlyUpcoming, now]);

  // Países presentes en el año (para el desplegable) — solo los que hay eventos.
  const countriesInPlay = useMemo(() => {
    const set = new Set<string>();
    yearEvents.forEach((ev) => set.add(ev.country));
    return [...set].sort();
  }, [yearEvents]);

  // ── Rejilla del mes ────────────────────────────────────────────────────
  const monthGrid = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
    // getUTCDay: 0=domingo → convertimos a lunes-first
    const startOffset = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(
      Date.UTC(cursor.year, cursor.month + 1, 0),
    ).getUTCDate();

    const cells: Array<{ iso: string | null; inMonth: boolean }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ iso: null, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ iso, inMonth: true });
    }
    while (cells.length % 7 !== 0) cells.push({ iso: null, inMonth: false });
    return cells;
  }, [cursor]);

  const eventsOn = (iso: string | null): CalendarEvent[] => {
    if (!iso) return [];
    return filtered.filter((ev) => eventCovers(ev, iso));
  };

  // Acontecimientos distintos que se pintan en el mes visible (para que el
  // contador de la barra de filtros cuadre con lo que se ve en la rejilla).
  const monthCount = useMemo(() => {
    const seen = new Set<string>();
    for (const cell of monthGrid) {
      if (!cell.iso) continue;
      for (const ev of eventsOn(cell.iso)) seen.add(ev.id);
    }
    return seen.size;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthGrid, filtered]);

  const monthLabel = `${MONTHS_SHORT[cursor.month]} ${cursor.year}`.toUpperCase();

  const gotoPrev = () => {
    setCursor((c) =>
      c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 },
    );
    setSelectedDay(null);
  };
  const gotoNext = () => {
    setCursor((c) =>
      c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 },
    );
    setSelectedDay(null);
  };
  const gotoToday = () => {
    const [y, m] = now.split('-').map(Number);
    setCursor({ year: y, month: m - 1 });
    setSelectedDay(null);
  };

  const toggleKind = (k: CalendarEventKind) =>
    setActiveKinds((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );

  const clearFilters = () => {
    setActiveKinds([]);
    setActiveCountry('TODOS');
    setActiveCategory('TODAS');
    setOnlyUpcoming(false);
  };
  const filtersOn =
    activeKinds.length > 0 ||
    activeCountry !== 'TODOS' ||
    activeCategory !== 'TODAS' ||
    onlyUpcoming;

  // ── Alta / borrado ─────────────────────────────────────────────────────
  const handleAdd = async (ev: CalendarEvent) => {
    await persist([...events, ev]);
    flash('Acontecimiento añadido a la agenda');
    setIsAdding(false);
  };
  const handleDelete = async (ev: CalendarEvent) => {
    // Los borrados tocan la semilla original (id sin @año) para que no vuelva.
    const baseId = ev.id.split('@')[0];
    await persist(events.filter((e) => e.id !== baseId));
    flash('Acontecimiento eliminado');
    setSelectedDay(null);
  };

  const selectedEvents = selectedDay ? eventsOn(selectedDay) : [];

  return (
    <div className="space-y-6">
      {/* ── Cabecera ─────────────────────────────────────────────────── */}
      <div className="pb-4 border-b border-white/10 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 uppercase mb-1">
            <CalendarDays className="w-3.5 h-3.5 text-white" />
            <span>AGENDA EDITORIAL</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-medium text-white tracking-tight uppercase">
            CALENDARIO DE ACONTECIMIENTOS
          </h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl font-light">
            Elecciones, cumbres, efemérides y recordatorios de redacción.
            Filtra por país y sección, y da de alta los hitos que quieras seguir.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={gotoPrev}
              aria-label="Mes anterior"
              className="px-3 py-2.5 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 py-2.5 text-xs font-bold text-white tracking-widest border-x border-white/10 min-w-[7.5rem] text-center">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={gotoNext}
              aria-label="Mes siguiente"
              className="px-3 py-2.5 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={gotoToday}
            className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer border border-white/10"
          >
            Hoy
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Añadir</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Filtros ──────────────────────────────────────────────────── */}
      <div className="bg-neutral-950/70 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold mr-1">
            Tipo
          </span>
          {KIND_ORDER.map((k) => {
            const meta = KIND_META[k];
            const on = activeKinds.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKind(k)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold uppercase tracking-wide border transition-all cursor-pointer flex items-center gap-1.5 ${
                  on
                    ? `${meta.chip} shadow-sm`
                    : 'bg-neutral-900/60 border-white/5 text-neutral-400 hover:text-white hover:border-white/20'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <Flag className="w-3.5 h-3.5 text-neutral-500" />
            <select
              value={activeCountry}
              onChange={(e) => setActiveCountry(e.target.value)}
              className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/40 cursor-pointer"
            >
              <option value="TODOS">TODOS LOS PAÍSES</option>
              {countriesInPlay.map((code) => (
                <option key={code} value={code}>
                  {code === 'GLOBAL' ? '🌐 INTERNACIONAL' : code}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/40 cursor-pointer"
            >
              <option value="TODAS">TODAS LAS SECCIONES</option>
              {CATEGORIES.filter((c) => c !== 'TODAS').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setOnlyUpcoming((v) => !v)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide border transition-colors cursor-pointer ${
              onlyUpcoming
                ? 'bg-white text-black border-white'
                : 'bg-neutral-900 border-white/10 text-neutral-400 hover:text-white'
            }`}
          >
            Solo próximos
          </button>

          {filtersOn && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] text-neutral-500 hover:text-white uppercase tracking-wide font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}

          <span className="text-[11px] text-neutral-500 font-mono ml-auto">
            {monthCount} en {MONTHS_SHORT[cursor.month].toUpperCase()} ·{' '}
            {filtered.length} en {cursor.year}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-6 items-start">
        {/* ── Rejilla mensual ────────────────────────────────────────── */}
        <div className="bg-neutral-950/70 border border-white/10 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-white/10">
            {WEEKDAYS_SHORT.map((d) => (
              <div
                key={d}
                className="py-2.5 text-center text-[10px] font-mono font-semibold uppercase tracking-widest text-neutral-500"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthGrid.map((cell, i) => {
              const dayEvents = eventsOn(cell.iso);
              const isToday = cell.iso === now;
              const isSelected = cell.iso === selectedDay;
              const dayNum = cell.iso ? Number(cell.iso.slice(8, 10)) : null;
              const firstThree = dayEvents.slice(0, 3);
              const overflow = dayEvents.length - firstThree.length;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!cell.iso}
                  onClick={() => cell.iso && setSelectedDay(cell.iso === selectedDay ? null : cell.iso)}
                  className={`relative min-h-[5.5rem] sm:min-h-[6.5rem] p-1.5 sm:p-2 text-left border-r border-b border-white/5 transition-colors ${
                    !cell.iso
                      ? 'bg-black/40 cursor-default'
                      : isSelected
                        ? 'bg-white/[0.07] cursor-pointer'
                        : 'hover:bg-white/[0.03] cursor-pointer'
                  }`}
                >
                  {dayNum !== null && (
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-bold ${
                          isToday
                            ? 'text-black bg-emerald-400 rounded-md w-6 h-6 flex items-center justify-center'
                            : cell.inMonth
                              ? 'text-white'
                              : 'text-neutral-600'
                        }`}
                      >
                        {dayNum}
                      </span>
                      {overflow > 0 && (
                        <span className="text-[10px] text-neutral-500 font-mono">
                          +{overflow}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    {firstThree.map((ev) => (
                      <div
                        key={ev.id}
                        className={`text-[10px] leading-tight px-1.5 py-1 rounded-md border truncate ${KIND_META[ev.kind].chip}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Panel lateral: ficha del día + próximos ────────────────── */}
        <div className="space-y-5">
          {/* Ficha del día seleccionado */}
          {selectedDay && (
            <div className="bg-neutral-950/70 border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                  {formatLongDate(selectedDay)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="p-1 text-neutral-500 hover:text-white transition-colors cursor-pointer"
                  aria-label="Cerrar ficha"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {selectedEvents.length === 0 ? (
                <p className="text-xs text-neutral-500 font-light">
                  Sin acontecimientos registrados para este día con los filtros actuales.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 bg-neutral-900/60 border border-white/5 rounded-xl space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-white font-semibold leading-snug">
                          {ev.title}
                        </span>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleDelete(ev)}
                            className="p-1 text-neutral-600 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wide">
                        <span
                          className={`px-2 py-0.5 rounded-md border ${KIND_META[ev.kind].chip}`}
                        >
                          {KIND_META[ev.kind].short}
                        </span>
                        <span className="text-neutral-500 flex items-center gap-1">
                          {ev.country === 'GLOBAL' ? '🌐' : (
                            <CountryFlag code={ev.country} className="w-4 h-2.5 object-cover rounded-[1px] inline-block" />
                          )}
                          {ev.country}
                        </span>
                        {ev.category && (
                          <span className="text-neutral-500">{ev.category}</span>
                        )}
                        {ev.recurring && (
                          <span className="text-neutral-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> anual
                          </span>
                        )}
                      </div>
                      {ev.notes && (
                        <p className="text-xs text-neutral-400 font-light leading-relaxed">
                          {ev.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Próximos 30 días */}
          <div className="bg-neutral-950/70 border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold pb-2 border-b border-white/5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>EN LOS PRÓXIMOS 30 DÍAS</span>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-xs text-neutral-500 font-light">
                Nada programado en el horizonte con los filtros actuales.
              </p>
            ) : (
              <div className="space-y-2.5">
                {upcoming.map((ev) => {
                  const days = daysUntil(ev.date);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => {
                        const [y, m] = ev.date.split('-').map(Number);
                        setCursor({ year: y, month: m - 1 });
                        setSelectedDay(ev.date);
                      }}
                      className="w-full text-left p-3 bg-neutral-900/60 hover:bg-neutral-900 border border-white/5 rounded-xl transition-colors cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                          {formatLongDate(ev.date)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            days <= 3
                              ? 'bg-emerald-400/15 text-emerald-300'
                              : 'text-neutral-500'
                          }`}
                        >
                          {days === 0 ? 'HOY' : `en ${days}d`}
                        </span>
                      </div>
                      <div className="text-xs text-white font-semibold leading-snug">
                        {ev.title}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 uppercase">
                        {ev.country === 'GLOBAL' ? '🌐' : <CountryFlag code={ev.country} className="w-4 h-2.5 object-cover rounded-[1px] inline-block" />}
                        {ev.country}
                        <span className={`w-1.5 h-1.5 rounded-full ${KIND_META[ev.kind].dot}`} />
                        {KIND_META[ev.kind].short}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal de alta ────────────────────────────────────────────── */}
      {isAdding && (
        <AddEventModal
          defaultDate={selectedDay ?? now}
          onCancel={() => setIsAdding(false)}
          onConfirm={handleAdd}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-emerald-500 text-black text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Pie: quién mantiene la agenda */}
      <p className="text-[11px] text-neutral-600 font-light">
        Agenda mantenida por la redacción. Última edición: {currentUser.name}.
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Modal de alta de acontecimiento
// ---------------------------------------------------------------------------
interface AddEventModalProps {
  defaultDate: string;
  onCancel: () => void;
  onConfirm: (ev: CalendarEvent) => void;
}

const AddEventModal: React.FC<AddEventModalProps> = ({
  defaultDate,
  onCancel,
  onConfirm,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState('');
  const [kind, setKind] = useState<CalendarEventKind>('eleccion');
  const [country, setCountry] = useState('GLOBAL');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [recurring, setRecurring] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    onConfirm({
      id: `manual-${Date.now()}`,
      title: title.trim(),
      date,
      endDate: endDate && endDate !== date ? endDate : undefined,
      kind,
      country,
      category: (category || undefined) as CalendarEvent['category'],
      notes: notes.trim() || undefined,
      recurring,
      source: 'manual',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg bg-neutral-950 border border-white/10 rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Nuevo acontecimiento
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-neutral-500 hover:text-white transition-colors cursor-pointer"
            aria-label="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (p. ej. «Brasil · Segunda vuelta presidencial»)"
          className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/40"
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Fecha</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/40"
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Hasta (opcional)</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/40"
            />
          </label>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Tipo</span>
          <div className="flex flex-wrap gap-2">
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold uppercase tracking-wide border transition-all cursor-pointer flex items-center gap-1.5 ${
                  kind === k
                    ? KIND_META[k].chip
                    : 'bg-neutral-900/60 border-white/5 text-neutral-400 hover:text-white'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${KIND_META[k].dot}`} />
                {KIND_META[k].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">País</span>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="ISO o GLOBAL"
              className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white uppercase focus:outline-none focus:border-white/40"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Sección</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/40 cursor-pointer"
            >
              <option value="">(sin sección)</option>
              {CATEGORIES.filter((c) => c !== 'TODAS').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Nota breve (contexto, sede, qué vigilar…)"
          rows={3}
          className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/40 resize-none"
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="w-4 h-4 accent-emerald-400 cursor-pointer"
          />
          <span className="text-xs text-neutral-300">
            Se repite cada año (efemeride)
          </span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-semibold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer border border-white/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer shadow-md shadow-emerald-500/20"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
};
