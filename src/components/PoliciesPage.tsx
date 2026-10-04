import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Scale,
  CalendarDays,
  ScrollText,
  CheckCircle2,
} from "lucide-react";
import { APP_VERSION, BUILD_STAMP } from "../version";
import { usePolicies } from "../context/PoliciesContext";
import {
  formatPolicyDate,
  isFutureDate,
  isValidIsoDate,
} from "../utils/policies";
import { LegalProse } from "./LegalProse";
import { scrollToSectionId } from "../utils/scroll";

interface PoliciesPageProps {
  onBack: () => void;
  /** Sección 1-based a la que hacer scroll (deep-link `?politicas=<n>`). */
  initialSection?: number | null;
}

/**
 * Página pública con todas las políticas ordenadas (§1-§10), índice lateral
 * sticky y ficha de vigencia. Es la vista completa a la que apuntan el banner
 * y los enlaces del pie.
 */
export const PoliciesPage: React.FC<PoliciesPageProps> = ({
  onBack,
  initialSection,
}) => {
  const {
    record,
    intro,
    sections,
    source,
    syncError,
    needsNotice,
    ackNotice,
  } = usePolicies();

  const [activeSection, setActiveSection] = useState(1);
  // Aviso pendiente durante esta visita: la lectura confirma el aviso, pero la
  // ficha informativa se mantiene aunque el banner global desaparezca.
  const [sawPending, setSawPending] = useState(() => needsNotice);

  const vigenciaValid = isValidIsoDate(record.effectiveDate);
  const future = isFutureDate(record.effectiveDate);
  const dateLabel = formatPolicyDate(record.effectiveDate);

  // El simple hecho de leer la página da por recibido el aviso de versión nueva.
  useEffect(() => {
    if (needsNotice) {
      setSawPending(true);
      ackNotice();
    }
  }, [needsNotice, ackNotice]);

  // Deep-link ?politicas=<n>: salta a la sección tras montar (salto directo,
  // como un ancla: el visitante aterriza en la sección pedida) y deja esa
  // sección marcada en el índice sin esperar al primer evento de scroll.
  useEffect(() => {
    if (!initialSection) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`seccion-${initialSection}`)
        ?.scrollIntoView({ behavior: "instant", block: "start" });
      setActiveSection(initialSection);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [initialSection]);

  // Resalta en el índice la sección que pasa por la zona de lectura.
  useEffect(() => {
    const onScroll = () => {
      let current = 1;
      for (let n = 1; n <= sections.length; n++) {
        const el = document.getElementById(`seccion-${n}`);
        if (el && el.getBoundingClientRect().top <= 160) current = n;
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections.length]);

  const goTo = useMemo(
    () => (n: number) => {
      scrollToSectionId(`seccion-${n}`);
      setActiveSection(n);
    },
    [],
  );

  return (
    <div className="min-h-screen bg-black text-neutral-300 font-sans">
      {/* Encabezado */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Portada</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white">
            <Scale className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Políticas y Normativa</span>
            <span className="sm:hidden">Políticas</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Título */}
        <header className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-tight">
            Todas las Políticas de BLACKNEWS
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-neutral-400 font-light">
            Documento único y ordenado · {sections.length} secciones · versión
            {record.version > 0 ? ` publicada ${record.version}` : " integrada"}
          </p>
        </header>

        {/* Ficha de vigencia */}
        <div
          className={`mb-6 p-4 rounded-xl border ${
            future
              ? "bg-amber-950/40 border-amber-500/40"
              : "bg-neutral-950 border-white/10"
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <CalendarDays
              className={`w-4 h-4 ${future ? "text-amber-400" : "text-emerald-400"}`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-white">
              {vigenciaValid
                ? future
                  ? "Entrada en vigor"
                  : "Vigentes desde"
                : "Fecha de entrada en vigor"}
            </span>
            <span className="text-sm font-bold text-white">
              {vigenciaValid ? dateLabel : "por determinar"}
            </span>
            {record.updatedAt && (
              <span className="text-xs text-neutral-400 font-light">
                · Última actualización:{" "}
                {new Date(record.updatedAt).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          {sawPending && (
            <p className="mt-2.5 flex items-start gap-2 text-xs text-amber-300">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Estas políticas acaban de publicarse.{" "}
                {future
                  ? `Los cambios entrarán en vigor el ${dateLabel}.`
                  : `Los cambios están vigentes desde el ${dateLabel}.`}
              </span>
            </p>
          )}
          {source === "cache" && syncError && (
            <p className="mt-2.5 text-xs text-neutral-500">
              Mostrando la última versión guardada en este dispositivo (sin
              conexión).
            </p>
          )}
        </div>

        {/* Cuerpo: índice + documento */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Índice sticky */}
          <aside className="lg:w-64 lg:shrink-0">
            <nav className="lg:sticky lg:top-20 border border-white/10 rounded-xl bg-neutral-950 p-3.5">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white mb-2.5">
                <ScrollText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Índice de secciones</span>
              </div>
              <ol className="space-y-0.5">
                {sections.map((section, idx) => {
                  const n = idx + 1;
                  const active = activeSection === n;
                  return (
                    <li key={section.title}>
                      <button
                        onClick={() => goTo(n)}
                        className={`w-full text-left px-2 py-1.5 rounded-md text-xs leading-snug transition-colors cursor-pointer ${
                          active
                            ? "bg-white text-black font-semibold"
                            : "text-neutral-400 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <span className="font-mono mr-1.5 opacity-70">
                          §{n}
                        </span>
                        {section.title.replace(/^\d+\.\s*/, "")}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </aside>

          {/* Documento */}
          <article className="flex-1 min-w-0">
            {/* Cabecera meta */}
            <div className="p-3.5 bg-neutral-950 border border-white/10 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5 text-xs mb-6">
              {intro.map((m) => (
                <div key={m.label} className="flex items-baseline gap-2 min-w-0">
                  <span className="text-white font-medium shrink-0">
                    {m.label}:
                  </span>
                  <span className="text-neutral-400 break-all">{m.value}</span>
                </div>
              ))}
            </div>

            <LegalProse sections={sections} />

            <div className="mt-10 pt-5 border-t border-white/10 text-xs font-mono text-neutral-500">
              BLACKNEWS LEGAL · v{APP_VERSION} ({BUILD_STAMP})
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};
