import React, { useRef, useState } from 'react';
import { Mic, Upload, Trash2, PlayCircle } from 'lucide-react';
import type { PodcastEpisode } from '../types/podcast';

interface PodcastManagerProps {
  episodes: PodcastEpisode[];
  onUpdateEpisodes: (items: PodcastEpisode[]) => void;
  categories: string[];
  /** Firma del redactor que publica (queda en el episodio). */
  authorName: string;
}

const MONTHS = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
];

/** mm:ss para la duración en pantalla. */
function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Duración real del fichero en el navegador (respaldo si Cloudinary no la da). */
function readLocalDurationSec(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const probe = new Audio();
      const done = (sec: number) => {
        URL.revokeObjectURL(url);
        resolve(sec);
      };
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => done(probe.duration || 0);
      probe.onerror = () => done(0);
      probe.src = url;
    } catch {
      resolve(0);
    }
  });
}

/**
 * «Podcast» del estudio: sube episodios de audio a Cloudinary
 * (/api/podcasts/upload) y los publica en la portada (Firestore
 * `settings/podcasts`, vía onUpdateEpisodes). La sección de portada sólo
 * aparece cuando hay al menos un episodio publicado.
 */
export const PodcastManager: React.FC<PodcastManagerProps> = ({
  episodes,
  onUpdateEpisodes,
  categories,
  authorName,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0] ?? 'GEOPOLÍTICA');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    setError(null);
    setNotice(null);
    if (!title.trim()) {
      setError('El episodio necesita título.');
      return;
    }
    if (!file) {
      setError('Selecciona el fichero de audio del episodio.');
      return;
    }

    setUploading(true);
    try {
      // Duración local mientras sube (Cloudinary también la reporta).
      const localDurationPromise = readLocalDurationSec(file);

      const body = new FormData();
      body.append('file', file, file.name);
      const response = await fetch('/api/podcasts/upload', {
        method: 'POST',
        body,
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: { secureUrl: string; durationSec: number };
      } | null;

      if (!response.ok || !payload?.success || !payload.data?.secureUrl) {
        throw new Error(
          payload?.error || `El servidor devolvió HTTP ${response.status}.`,
        );
      }

      const localDuration = await localDurationPromise;
      const now = new Date();
      const episode: PodcastEpisode = {
        id: `pod-${Date.now()}`,
        title: title.trim(),
        description: description.trim(),
        category,
        audioUrl: payload.data.secureUrl,
        durationSec: payload.data.durationSec || Math.round(localDuration),
        publishedAt: `${String(now.getDate()).padStart(2, '0')} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
        createdAt: Date.now(),
        author: authorName,
      };
      onUpdateEpisodes([episode, ...episodes]);
      resetForm();
      setNotice(`Episodio «${episode.title}» publicado en portada.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo subir el audio. Inténtalo de nuevo.',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    onUpdateEpisodes(episodes.filter((e) => e.id !== id));
    setNotice('Episodio retirado de la portada.');
    setError(null);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Cabecera */}
      <div className="flex items-center gap-2">
        <Mic className="w-5 h-5 text-emerald-400" />
        <h2 className="text-sm sm:text-base font-semibold uppercase tracking-wider text-white">
          Podcast
        </h2>
        <span className="text-xs font-mono text-neutral-500">
          {episodes.length} episodio(s) en portada
        </span>
      </div>

      {/* Subida de episodio */}
      <div className="bg-neutral-950 rounded-2xl border border-white/10 p-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título del episodio (p. ej. El parte semanal: Estrecho de Taiwán)"
          className="w-full bg-neutral-900 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 font-sans"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Descripción del episodio (aparece bajo el reproductor en portada)"
          className="w-full bg-neutral-900 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 font-sans resize-y leading-relaxed"
        />

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-neutral-900 border border-white/15 rounded-xl px-3 py-2.5 text-xs font-sans text-white focus:outline-none"
          >
            {(categories.length ? categories : ['GEOPOLÍTICA']).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 border border-white/15 rounded-xl text-xs font-semibold text-neutral-200 hover:border-white/30 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {file ? file.name.slice(0, 32) : 'Elegir audio (MP3 · M4A · WAV)'}
          </button>

          {file && (
            <span className="text-[11px] font-mono text-neutral-500">
              {(file.size / 1024 / 1024).toFixed(1)} MB · máx. 100 MB
            </span>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 leading-relaxed">{error}</p>
        )}
        {notice && (
          <p className="text-xs text-emerald-400 leading-relaxed">{notice}</p>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-neutral-500">
            El audio se aloja en Cloudinary; el episodio se publica al instante
            en portada.
          </span>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className={`px-5 py-2.5 rounded-xl shadow-sm font-semibold text-xs uppercase tracking-wider transition-colors ${
              uploading
                ? 'bg-neutral-800 text-neutral-500 cursor-wait'
                : 'bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer'
            }`}
          >
            {uploading ? 'Subiendo…' : 'Publicar episodio'}
          </button>
        </div>
      </div>

      {/* Lista de episodios publicados */}
      <div className="bg-neutral-950 rounded-2xl border border-white/10 divide-y divide-white/5">
        {episodes.length === 0 ? (
          <p className="p-6 text-center text-xs text-neutral-500">
            Aún no hay episodios: sube el primero y aparecerá en la portada.
          </p>
        ) : (
          episodes.map((ep) => (
            <div key={ep.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-sm font-semibold text-white truncate">
                      {ep.title}
                    </span>
                  </div>
                  <span className="mt-1 block text-[10px] font-mono text-neutral-500">
                    {ep.category} · {ep.publishedAt} ·{' '}
                    {formatDuration(ep.durationSec)} · {ep.author}
                  </span>
                  {ep.description && (
                    <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed line-clamp-2">
                      {ep.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(ep.id)}
                  title="Retirar de portada"
                  className="text-neutral-500 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {/* Previsualización con el reproductor nativo del navegador */}
              <audio
                controls
                preload="none"
                src={ep.audioUrl}
                className="w-full h-9"
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
