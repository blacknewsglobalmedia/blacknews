import React, { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import type { PodcastEpisode } from "../types/podcast";

interface PodcastSectionProps {
  episodes: PodcastEpisode[];
}

/** Puntos sin marcar: el mismo gris de la tierra del atlas (#2e2e2e). */
const DOT_IDLE = "#2e2e2e";
/** Puntos del progreso de reproducción (legible también en móvil). */
const PROGRESS_DOTS = 40;

/** h:mm:ss si pasa de la hora; en otro caso m:ss. */
function formatTime(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/**
 * Constelación de puntos al estilo del mapa de cobertura: los reproducidos
 * se encienden en esmeralda, el punto de cabeza late con el mismo halo
 * pulsante del atlas y el resto espera en gris tierra. El control real es un
 * range nativo invisible encima (arrastrar, clic y teclado funcionan).
 */
const DotProgress: React.FC<{
  ratio: number;
  active: boolean;
  onSeek: (fraction: number) => void;
}> = ({ ratio, active, onSeek }) => {
  const step = 1 / (PROGRESS_DOTS - 1);
  return (
    <div className="relative flex-1 h-6 flex items-center min-w-0">
      <div
        aria-hidden
        className="flex w-full items-center justify-between"
      >
        {Array.from({ length: PROGRESS_DOTS }).map((_, i) => {
          const frac = i * step;
          const played = frac <= ratio + step / 2;
          const isHead = played && frac + step > ratio + step / 2;
          return (
            <span
              key={i}
              className="relative flex items-center justify-center shrink-0"
            >
              {isHead && active && (
                <span className="absolute w-3 h-3 rounded-full bg-emerald-400/40 map-pulse" />
              )}
              <span
                className={`rounded-full ${
                  isHead
                    ? "w-[5px] h-[5px] bg-emerald-400"
                    : played
                      ? "w-1 h-1 bg-emerald-400/75"
                      : "w-1 h-1"
                }`}
                style={played ? undefined : { background: DOT_IDLE }}
              />
            </span>
          );
        })}
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(Math.min(1, Math.max(0, ratio)) * 1000)}
        onChange={(e) => onSeek(Number(e.target.value) / 1000)}
        aria-label="Progreso del episodio"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
};

/**
 * «Podcast» de portada: episodios subidos desde el estudio (pestaña Podcast).
 *
 * Estilo atlas: negro puro sin tarjetas, etiquetas diminutas con tracking
 * amplio, píldoras `bg-white/5` y el halo pulsante de las corresponsalías.
 * Sin portada, el hueco lo ocupa una constelación de puntos con un marcador
 * esmeralda latiendo (el mismo lenguaje que el mapa de cobertura).
 */
export const PodcastSection: React.FC<PodcastSectionProps> = ({ episodes }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Al desmontar, el audio muere con la sección.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  if (episodes.length === 0) return null;

  const [featured, ...rest] = episodes;
  const featuredDuration =
    currentId === featured.id && duration > 0 ? duration : featured.durationSec;
  const ratio =
    currentId === featured.id && featuredDuration > 0
      ? progress / featuredDuration
      : 0;

  const playEpisode = (episode: PodcastEpisode, seekTo?: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentId === episode.id) {
      if (typeof seekTo === "number") {
        audio.currentTime = seekTo;
        setProgress(seekTo);
      }
      if (audio.paused) void audio.play().catch(() => setPlaying(false));
      else audio.pause();
      return;
    }
    audio.src = episode.audioUrl;
    audio.currentTime = 0;
    setCurrentId(episode.id);
    setProgress(0);
    setDuration(episode.durationSec || 0);
    // El seek se aplica cuando el navegador conozca la duración real.
    pendingSeekRef.current = typeof seekTo === "number" ? seekTo : null;
    void audio.play().catch(() => setPlaying(false));
  };

  /** Seek de la barra de puntos: nunca alterna play/pause, sólo ubica. */
  const seekFeatured = (fraction: number) => {
    const target = fraction * featuredDuration;
    const audio = audioRef.current;
    if (!audio) return;
    if (currentId !== featured.id) {
      // Episodio sin arrancar: empieza reproduciendo desde el punto elegido.
      playEpisode(featured, target);
      return;
    }
    audio.currentTime = target;
    setProgress(target);
  };

  const PlayerButton: React.FC<{ episode: PodcastEpisode; big?: boolean }> = ({
    episode,
    big,
  }) => {
    const isCurrent = currentId === episode.id && playing;
    return (
      <button
        type="button"
        onClick={() => playEpisode(episode)}
        aria-label={isCurrent ? "Pausar" : "Reproducir"}
        className={`shrink-0 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
          big
            ? "w-11 h-11 bg-emerald-500 hover:bg-emerald-400 text-black"
            : "w-9 h-9 border border-white/15 text-neutral-400 hover:text-white hover:border-white/30"
        }`}
      >
        {isCurrent ? (
          <Pause className={big ? "w-5 h-5" : "w-4 h-4"} />
        ) : (
          <Play
            className={big ? "w-5 h-5 translate-x-px" : "w-4 h-4 translate-x-px"}
          />
        )}
      </button>
    );
  };

  /** Hueco de portada: constelación de puntos con marcador pulsante. */
  const CoverPlaceholder: React.FC = () => (
    <div
      aria-hidden
      className="relative shrink-0 w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border border-white/[0.07] overflow-hidden"
    >
      <div
        className="absolute inset-0 grid place-items-center"
        style={{
          gridTemplateColumns: "repeat(7, 1fr)",
          padding: "16%",
        }}
      >
        {Array.from({ length: 49 }).map((_, i) => (
          <span
            key={i}
            className="w-1 h-1 rounded-full"
            style={{ background: i === 24 ? "#10b981" : DOT_IDLE }}
          />
        ))}
      </div>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-emerald-400/40 map-pulse" />
    </div>
  );

  return (
    <section className="border-t border-white/10 bg-black font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {/* Cabecera: misma voz que «Mapa de cobertura» */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-6">
          <span className="text-[10px] uppercase tracking-[0.25em] text-neutral-600 font-semibold">
            Podcast
          </span>
          <h2 className="font-headline text-lg text-white tracking-tight">
            La onda de BLACKNEWS
          </h2>
          <span className="ml-auto text-[10px] text-neutral-600 tabular-nums">
            {episodes.length} episodio{episodes.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Episodio destacado: portada + reproductor de puntos */}
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-7 items-start">
          {featured.coverUrl ? (
            <img
              src={featured.coverUrl}
              alt=""
              loading="lazy"
              className="shrink-0 w-28 h-28 sm:w-36 sm:h-36 rounded-2xl object-cover ring-1 ring-white/10"
            />
          ) : (
            <CoverPlaceholder />
          )}

          <div className="min-w-0 flex-1 w-full">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] uppercase tracking-wider">
              <span className="text-emerald-400/90 font-semibold">
                {featured.category}
              </span>
              <span className="text-neutral-700">·</span>
              <span className="text-neutral-600">{featured.publishedAt}</span>
              {featured.author && (
                <>
                  <span className="text-neutral-700">·</span>
                  <span className="text-neutral-600">{featured.author}</span>
                </>
              )}
            </div>

            <h3 className="mt-2 font-headline text-xl sm:text-2xl text-white leading-tight tracking-tight">
              {featured.title}
            </h3>
            {featured.description && (
              <p className="mt-2 text-sm text-neutral-400 leading-relaxed max-w-3xl">
                {featured.description}
              </p>
            )}

            <div className="mt-5 flex items-center gap-4">
              <PlayerButton episode={featured} big />
              <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                {formatTime(currentId === featured.id ? progress : 0)}
              </span>
              <DotProgress
                ratio={ratio}
                active={playing && currentId === featured.id}
                onSeek={seekFeatured}
              />
              <span className="text-[11px] font-mono text-neutral-600 tabular-nums">
                {formatTime(featuredDuration)}
              </span>
            </div>
          </div>
        </div>

        {/* Episodios anteriores: lista tipo panel del atlas */}
        {rest.length > 0 && (
          <div className="mt-9">
            <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-600 font-semibold mb-1">
              Anteriores
            </div>
            <ul className="divide-y divide-white/5">
              {rest.slice(0, 6).map((episode) => {
                const isCurrent = currentId === episode.id;
                return (
                  <li key={episode.id}>
                    <button
                      type="button"
                      onClick={() => playEpisode(episode)}
                      className={`group w-full text-left flex items-center gap-3.5 py-3 -mx-2 px-2 rounded transition-colors cursor-pointer ${
                        isCurrent ? "bg-white/5" : "hover:bg-white/5"
                      }`}
                    >
                      {episode.coverUrl ? (
                        <img
                          src={episode.coverUrl}
                          alt=""
                          loading="lazy"
                          className="shrink-0 w-10 h-10 rounded-lg object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <span className="shrink-0 w-10 h-10 rounded-lg border border-white/[0.07] grid place-items-center">
                          <span className="relative flex items-center justify-center">
                            <span className="absolute w-4 h-4 rounded-full bg-emerald-400/30 map-pulse" />
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          </span>
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-[13px] font-medium leading-snug truncate ${
                            isCurrent ? "text-white" : "text-neutral-200 group-hover:text-white"
                          }`}
                        >
                          {episode.title}
                        </span>
                        <span className="block text-[10px] text-neutral-600 mt-0.5">
                          {episode.category} · {episode.publishedAt}
                          {isCurrent && playing && " · sonando"}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-neutral-400 px-2 py-1 rounded-full bg-white/5">
                        {formatTime(episode.durationSec)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Audio real: un único elemento, un solo sonido a la vez */}
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
          if (pendingSeekRef.current != null) {
            e.currentTarget.currentTime = pendingSeekRef.current;
            setProgress(pendingSeekRef.current);
            pendingSeekRef.current = null;
          }
        }}
        className="hidden"
      />
    </section>
  );
};
