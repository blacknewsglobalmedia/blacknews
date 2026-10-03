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
          <div>
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
          <div>
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
          <div>
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
      </div>
    </section>
  );
};
