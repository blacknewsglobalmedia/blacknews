import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import type { PodcastEpisode } from '../types/podcast';

interface PodcastSectionProps {
  episodes: PodcastEpisode[];
}

/** h:mm:ss si pasa de la hora; en otro caso m:ss. */
function formatTime(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const base = `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
  return base;
}

/**
 * «Podcast» de portada: episodios subidos desde el estudio (pestaña Podcast),
 * con reproductor propio en negro mate y acento esmeralda. Sin episodios la
 * sección no renderiza. Un solo audio sonando a la vez.
 */
export const PodcastSection: React.FC<PodcastSectionProps> = ({ episodes }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
  const current = episodes.find((e) => e.id === currentId);

  const playEpisode = (episode: PodcastEpisode) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentId === episode.id) {
      // Mismo episodio: alternar reproducción.
      if (audio.paused) void audio.play().catch(() => setPlaying(false));
      else audio.pause();
      return;
    }
    audio.src = episode.audioUrl;
    audio.currentTime = 0;
    setCurrentId(episode.id);
    setProgress(0);
    setDuration(episode.durationSec || 0);
    void audio.play().catch(() => setPlaying(false));
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setProgress(value);
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
        aria-label={isCurrent ? 'Pausar' : 'Reproducir'}
        className={`shrink-0 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
          big
            ? 'w-12 h-12 bg-emerald-500 hover:bg-emerald-400 text-black'
            : 'w-9 h-9 border border-white/15 text-neutral-300 hover:text-white hover:border-white/30'
        }`}
      >
        {isCurrent ? (
          <Pause className={big ? 'w-5 h-5' : 'w-4 h-4'} />
        ) : (
          <Play className={big ? 'w-5 h-5 translate-x-px' : 'w-4 h-4 translate-x-px'} />
        )}
      </button>
    );
  };

  return (
    <section className="border-t border-white/10 bg-black font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {/* Cabecera */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 mb-6">
          <span className="shrink-0 bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded">
            Podcast
          </span>
          <h2 className="font-headline text-lg sm:text-xl text-white tracking-tight">
            La onda de BLACKNEWS
          </h2>
          <span className="ml-auto text-[10px] font-mono text-neutral-500">
            {episodes.length} episodio{episodes.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Episodio destacado + reproductor */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-mono uppercase tracking-wider">
            <span className="text-emerald-400/90 font-semibold">
              {featured.category}
            </span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-500">{featured.publishedAt}</span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-500">
              {formatTime(featured.durationSec)}
            </span>
            {featured.author && (
              <>
                <span className="text-neutral-600">·</span>
                <span className="text-neutral-500">{featured.author}</span>
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

          <div className="mt-4 flex items-center gap-3.5">
            <PlayerButton episode={featured} big />
            <span className="w-11 text-right text-[11px] font-mono text-neutral-400 tabular-nums">
              {formatTime(
                currentId === featured.id ? progress : featured.durationSec,
              )}
            </span>
            <input
              type="range"
              min={0}
              max={
                currentId === featured.id && duration > 0
                  ? duration
                  : Math.max(1, featured.durationSec)
              }
              step={1}
              value={
                currentId === featured.id ? Math.min(progress, duration || featured.durationSec) : 0
              }
              onChange={(e) => {
                if (currentId !== featured.id) playEpisode(featured);
                seek(Number(e.target.value));
              }}
              aria-label="Progreso del episodio"
              className="flex-1 h-1 accent-emerald-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-neutral-600 tabular-nums">
              {formatTime(
                currentId === featured.id && duration > 0
                  ? duration
                  : featured.durationSec,
              )}
            </span>
          </div>
        </div>

        {/* Episodios anteriores */}
        {rest.length > 0 && (
          <ul className="mt-4 space-y-px">
            {rest.slice(0, 6).map((episode) => (
              <li
                key={episode.id}
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 transition-colors ${
                  currentId === episode.id
                    ? 'bg-white/[0.04]'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                <PlayerButton episode={episode} />
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white truncate">
                    {episode.title}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-mono text-neutral-600">
                    {episode.category} · {episode.publishedAt}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                  {formatTime(episode.durationSec)}
                </span>
              </li>
            ))}
          </ul>
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
        }}
        className="hidden"
      />
    </section>
  );
};
