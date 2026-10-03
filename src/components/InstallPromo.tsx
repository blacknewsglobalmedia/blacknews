import React, { useEffect, useState } from "react";
import { Download, Share, Volume2, VolumeX } from "lucide-react";
import { Report } from "../types/news";

interface InstallPromoProps {
  reports: Report[];
  /** true si el navegador emitió beforeinstallprompt y no estamos ya instalados */
  installAvailable: boolean;
  onInstall: () => void;
}

/**
 * Banda promocional de la PWA: instalar en la pantalla de inicio
 * y "escuchar la portada" con la voz del navegador (Web Speech API).
 */
export const InstallPromo: React.FC<InstallPromoProps> = ({
  reports,
  installAvailable,
  onInstall,
}) => {
  const [hint, setHint] = useState(false);
  const [listening, setListening] = useState(false);

  const topHeadlines = reports.slice(0, 3);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const toggleListen = () => {
    if (!("speechSynthesis" in window)) return;
    if (listening) {
      window.speechSynthesis.cancel();
      setListening(false);
      return;
    }
    window.speechSynthesis.cancel();
    const text = topHeadlines
      .map((r, i) => `Titular ${i + 1}: ${r.title}`)
      .join(". ");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES";
    u.onend = () => setListening(false);
    u.onerror = () => setListening(false);
    window.speechSynthesis.speak(u);
    setListening(true);
  };

  const handleInstall = () => {
    if (installAvailable) onInstall();
    else setHint((v) => !v);
  };

  return (
    <section className="border-t border-white/10 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
          {/* Texto */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <img
              src="/icons/icon-192.png"
              alt="Icono de BLACKNEWS"
              width={48}
              height={48}
              className="w-12 h-12 rounded-xl border border-white/15 shrink-0"
            />
            <div className="min-w-0 font-sans">
              <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-2">
                BLACKNEWS SIN CONEXIÓN
              </div>
              <h2 className="font-headline text-xl sm:text-2xl text-white tracking-tight leading-snug mb-2">
                Léela en tu pantalla de inicio, aunque no tengas datos
              </h2>
              <p className="text-sm text-neutral-400 font-light leading-relaxed">
                Instálala como aplicación y las últimas noticias quedan guardadas
                en tu dispositivo para leerlas sin conexión.
              </p>
              {hint && (
                <p className="text-xs text-neutral-300 bg-neutral-900 border border-white/10 rounded-md px-3 py-2 mt-3 leading-relaxed">
                  iPhone/iPad: <strong className="text-white">Compartir</strong> →{" "}
                  <strong className="text-white">Añadir a pantalla de inicio</strong>.
                  {" "}Ordenador: menú{" "}
                  <strong className="text-white">⋮</strong> →{" "}
                  <strong className="text-white">Instalar aplicación</strong>.
                </p>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 px-5 py-3 bg-white text-black text-xs font-bold uppercase tracking-wider rounded-md hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              AÑADIR A PANTALLA DE INICIO
            </button>
            <button
              onClick={toggleListen}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider rounded-md border transition-colors cursor-pointer ${
                listening
                  ? "bg-white/10 border-white/40 text-white"
                  : "border-white/20 text-white hover:border-white"
              }`}
              aria-pressed={listening}
            >
              {listening ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
              {listening ? "DETENER" : "ESCUCHAR LA PORTADA"}
            </button>
            {!installAvailable && (
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-500">
                <Share className="w-3 h-3" />
                o menú del navegador
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
