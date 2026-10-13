/**
 * BLACKNEWS — Subida de episodios de podcast a Cloudinary.
 *
 * Cloudinary aloja audio como `resource_type "video"`: el endpoint de subida
 * es `/video/upload` y la respuesta incluye `duration` (segundos) además del
 * `secure_url`. Se reutiliza el patrón de firma (folder + timestamp + API
 * secret) de images.ts, que ya funciona en producción para fotografía.
 *
 * El Worker sólo devuelve la URL y los metadatos del audio: el episodio
 * (título, descripción, categoría) lo guarda el frontend en Firestore
 * (`settings/podcasts`), igual que el teletipo de última hora.
 */

import type { CloudinaryEnv } from './images';

/** Cuerpo máximo de petición en Cloudflare Workers: 100 MB. */
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const AUDIO_FOLDER = 'blacknews/podcasts';
const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|wav|ogg|opus|webm)$/i;

export interface PodcastUploadResult {
  secureUrl: string;
  publicId: string;
  durationSec: number;
  bytes: number;
  format: string;
}

async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Sube un fichero de audio firmado a Cloudinary y devuelve su URL de entrega
 * más la duración. Lanza Error con mensaje apto para el estudio.
 */
export async function handlePodcastUpload(
  request: Request,
  env: CloudinaryEnv
): Promise<PodcastUploadResult> {
  const missing = (
    ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const
  ).filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(
      `Cloudinary no configurado en el Worker: falta ${missing.join(', ')}. Envíalas con "npx wrangler secret put <NOMBRE>".`
    );
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    throw new Error('Falta el fichero de audio (campo "file").');
  }

  // Algunos sistemas envían el audio como application/octet-stream: se
  // admite por MIME (audio/*) o, en su defecto, por extensión conocida.
  const looksLikeAudio =
    (file.type && file.type.startsWith('audio/')) ||
    AUDIO_EXTENSIONS.test(file.name || '');
  if (!looksLikeAudio) {
    throw new Error(
      `Tipo no admitido (${file.type || 'desconocido'}): sube un archivo de audio (MP3, M4A, WAV, OGG…).`
    );
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error(
      `El audio pesa ${(file.size / 1024 / 1024).toFixed(0)} MB; el máximo son 100 MB.`
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signedParams: Record<string, string> = {
    folder: AUDIO_FOLDER,
    timestamp: String(timestamp)
  };
  const stringToSign = Object.keys(signedParams)
    .sort()
    .map((key) => `${key}=${signedParams[key]}`)
    .join('&');
  const signature = await sha1Hex(stringToSign + env.CLOUDINARY_API_SECRET);

  const upload = new FormData();
  upload.append('file', file, file.name || 'episodio.mp3');
  upload.append('api_key', env.CLOUDINARY_API_KEY);
  upload.append('timestamp', String(timestamp));
  upload.append('signature', signature);
  upload.append('folder', signedParams.folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/video/upload`;
  const response = await fetch(endpoint, { method: 'POST', body: upload });
  const payload = (await response.json().catch(() => ({}))) as Record<string, any>;

  if (!response.ok) {
    const message = payload?.error?.message || `Cloudinary respondió HTTP ${response.status}`;
    throw new Error(`Error de Cloudinary al subir el audio: ${message}`);
  }
  if (!payload.secure_url || !payload.public_id) {
    throw new Error('Cloudinary devolvió una respuesta inesperada (sin secure_url).');
  }

  return {
    secureUrl: String(payload.secure_url),
    publicId: String(payload.public_id),
    durationSec: Math.max(0, Math.round(Number(payload.duration) || 0)),
    bytes: Number(payload.bytes) || file.size,
    format: String(payload.format || '')
  };
}
