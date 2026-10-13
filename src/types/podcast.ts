/**
 * Episodios de podcast de BLACKNEWS.
 *
 * El audio se aloja firmado en Cloudinary (subida vía /api/podcasts/upload)
 * y el episodio se publica en Firestore (`settings/podcasts`) con la misma
 * dinámlica que el teletipo: el estudio escribe, la portada lee.
 */
export interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  /** Sección de la que cuelga el episodio (GEOPOLÍTICA, ECONOMÍA & MERCADOS…). */
  category: string;
  /** URL de entrega del audio en Cloudinary. */
  audioUrl: string;
  /** Duración en segundos (la reporta Cloudinary al subir). */
  durationSec: number;
  /** Fecha en pantalla (p. ej. «12 OCT 2026»). */
  publishedAt: string;
  /** Instante de creación (ms) para ordenar la lista. */
  createdAt: number;
  /** Firma del redactor que lo publica. */
  author: string;
}
