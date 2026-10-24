import React, { useMemo } from "react";
import { Report } from "../types/news";

interface TrustSectionProps {
  reports: Report[];
}

const MANIFIESTO: { title: string; text: string }[] = [
  {
    title: "Independencia",
    text: "Ningún gobierno, partido ni empresa decide qué publicamos ni cómo lo titulamos.",
  },
  {
    title: "Primero la verificación",
    text: "Publicamos cuando está contrastado; si un dato cambia, lo corregimos y lo indicamos en el propio informe.",
  },
  {
    title: "Nada encargado",
    text: "Lo publicitario se identifica como tal: ningún contenido pagado aparece disfrazado de periodismo.",
  },
  {
    title: "Tu lectura es tuya",
    text: "Sin registro obligatorio ni rastreo de terceros: tus guardados y subrayados se quedan en tu navegador.",
  },
];

const TRANSPARENCIA: { title: string; text: string }[] = [
  {
    title: "Publicidad",
    text: "Los anuncios son nuestra única fuente de ingresos, siempre etiquetados como tal.",
  },
  {
    title: "Acceso",
    text: "Leer BLACKNEWS es gratuito: sin muros de pago ni suscripción obligatoria.",
  },
  {
    title: "Datos",
    text: "No compramos ni vendemos perfiles de lectores; lo que guardas vive en tu dispositivo.",
  },
];

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Meses cortos (es-ES) para leer fechas «04 oct 2026 · …». */
const MSHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
const MONTH_IDX: Record<string, number> = Object.fromEntries(
  MSHORT.map((m, i) => [m, i]),
);

const isoLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Día de publicación (ISO local): primero del id `rep-custom-<ms>` y si no,
 * de la fecha visible («04 oct 2026 · …»). Sin fecha fiable no se cuenta.
 */
const reportIso = (r: Report): string | null => {
  const ms = /^rep-custom-(\d{13})$/.exec(r.id)?.[1];
  if (ms) return isoLocal(new Date(Number(ms)));
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/.exec(r.publishedAt ?? "");
  if (!m) return null;
  const month = MONTH_IDX[m[2].toLowerCase()];
  if (month === undefined) return null;
  return isoLocal(new Date(Number(m[3]), month, Number(m[1])));
};

/** Paquete de confianza: manifiesto editorial, redacción y transparencia. */
export const TrustSection: React.FC<TrustSectionProps> = ({ reports }) => {
  const team = useMemo(() => {
    const seen = new Map<string, { name: string; role: string; bureau: string }>();
    reports.forEach((r) => {
      const a = r.author;
      if (a?.name && !seen.has(a.name)) {
        seen.set(a.name, { name: a.name, role: a.role, bureau: a.bureau });
      }
    });
    return Array.from(seen.values()).slice(0, 6);
  }, [reports]);

  // Ritmo de publicación: cuatro semanas terminando en la semana actual
  // (rejilla lunes-first; los días que aún no llegaron quedan huecos).
  const heat = useMemo(() => {
    const counts = new Map<string, number>();
    reports.forEach((r) => {
      const iso = reportIso(r);
      if (iso) counts.set(iso, (counts.get(iso) ?? 0) + 1);
    });
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const start = new Date(monday);
    start.setDate(monday.getDate() - 21);
    const cells: { iso: string; count: number; future: boolean }[] = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = isoLocal(d);
      cells.push({
        iso,
        count: counts.get(iso) ?? 0,
        future: d.getTime() > today.getTime(),
      });
    }
    return cells;
  }, [reports]);
  const heatTotal = heat.reduce((sum, c) => (c.future ? sum : sum + c.count), 0);

  return (
    <section className="border-t border-white/10 bg-black font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="max-w-3xl mb-10 sm:mb-14">
          <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-3">
            PERIODISMO EN BLANCO Y NEGRO
          </div>
          <h2 className="font-headline text-3xl sm:text-4xl text-white tracking-tight leading-tight mb-4">
            El periodismo, sin letra pequeña
          </h2>
          <p className="text-sm sm:text-base text-neutral-400 font-light leading-relaxed">
            BLACKNEWS es un medio independiente. Esto es lo que nos comprometemos
            a cumplir y en qué nos diferenciamos de un portal de titulares.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {/* MANIFIESTO */}
          <div data-assemble>
            <div className="border-b border-white/10 pb-3 mb-5 text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">
              MANIFIESTO
            </div>
            <ul className="space-y-4">
              {MANIFIESTO.map((m, i) => (
                <li key={m.title}>
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-xs text-neutral-600 shrink-0">
                      {String(i + 1).padStart(2, "0")}.
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {m.title}
                    </span>
                  </div>
                  <p className="text-[13px] text-neutral-400 font-light leading-relaxed mt-1 pl-6">
                    {m.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* REDACCIÓN */}
          <div data-assemble>
            <div className="border-b border-white/10 pb-3 mb-5 text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">
              LA REDACCIÓN
            </div>
            <ul className="space-y-3.5">
              {team.length === 0 && (
                <li className="text-sm text-neutral-400 font-light">
                  La redacción se publica junto a cada despacho: autores y
                  corresponsalías figuran en la ficha de cada informe.
                </li>
              )}
              {team.map((a) => (
                <li key={a.name} className="flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-md border border-white/15 bg-neutral-950 grid place-items-center text-[11px] font-bold text-neutral-300 shrink-0"
                    aria-hidden="true"
                  >
                    {initials(a.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-white font-medium truncate">
                      {a.name}
                    </span>
                    <span className="block text-[11px] text-neutral-500 truncate">
                      {a.role} · {a.bureau}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-neutral-600 font-light leading-relaxed mt-4">
              Equipo derivado de los autores de los informes publicados.
            </p>
          </div>

          {/* TRANSPARENCIA */}
          <div data-assemble>
            <div className="border-b border-white/10 pb-3 mb-5 text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">
              CÓMO NOS FINANCIAMOS
            </div>
            <ul className="space-y-4">
              {TRANSPARENCIA.map((t) => (
                <li key={t.title}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-white mb-1">
                    {t.title}
                  </div>
                  <p className="text-[13px] text-neutral-400 font-light leading-relaxed">
                    {t.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Ritmo de publicación: cuatro semanas en malla de puntos */}
        <div data-assemble className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">
              Ritmo de publicación
            </div>
            <div className="text-[11px] font-mono text-neutral-600">
              {heatTotal} informes en 4 semanas · punto encendido = día con
              publicación
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 w-fit">
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
              <span key={d} className="text-[9px] font-mono text-neutral-600 text-center">
                {d}
              </span>
            ))}
            {heat.map((cell) =>
              cell.future ? (
                <span key={cell.iso} className="w-2.5 h-2.5" />
              ) : (
                <span
                  key={cell.iso}
                  title={
                    cell.count > 0
                      ? `${Number(cell.iso.slice(8, 10))} ${MSHORT[Number(cell.iso.slice(5, 7)) - 1]} · ${cell.count} informe${cell.count > 1 ? "s" : ""}`
                      : "sin publicaciones"
                  }
                  className={`w-2.5 h-2.5 rounded-full ${
                    cell.count >= 3
                      ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                      : cell.count === 2
                        ? "bg-white/85"
                        : cell.count === 1
                          ? "bg-white/55"
                          : "bg-[#2e2e2e]"
                  }`}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
