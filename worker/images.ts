/**
 * BLACKNEWS — Optimización de imágenes en Cloudflare Workers.
 *
 * No se usa `sharp` (módulo nativo incompatible con Workers ni con su límite de CPU).
 * En su lugar:
 *   1. El original se sube firmado a Cloudinary.
 *   2. Las variantes responsivas (AVIF/WebP/JPEG) se generan bajo demanda en el CDN
 *      de Cloudinary con transformaciones en la URL.
 *   3. Se mide cada variante (HEAD) para calcular ahorro y srcset, igual que el server Node.
 *
 * El contrato de respuesta es idéntico a server/imageOptimizer.ts
 * (`OptimizedImageSet` de src/types/news.ts).
 */

export interface CloudinaryEnv {
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
}

export interface ImageVariantInfo {
  width: number;
  height: number;
  format: 'avif' | 'webp' | 'jpeg';
  url: string;
  sizeBytes: number;
  filename: string;
}

export interface OptimizationResult {
  slug: string;
  originalName: string;
  originalSize: number;
  width: number;
  height: number;
  aspectRatio: number;
  blurDataUrl: string;
  variants: ImageVariantInfo[];
  srcsetAvif: string;
  srcsetWebp: string;
  srcsetJpeg: string;
  fallbackUrl: string;
  pictureSnippet: string;
  totalSavingsPercent: number;
  storage: 'cloudinary';
}

// Mismos valores que server/imageOptimizer.ts
const STANDARD_SIZES = [150, 400, 800, 1200];
const HERO_SIZES = [150, 400, 800, 1200, 1920];

const FORMAT_CONFIG = [
  { format: 'avif' as const, cloudFormat: 'avif', quality: 55 },
  { format: 'webp' as const, cloudFormat: 'webp', quality: 68 },
  // Cloudinary usa la extensión "jpg" aunque el contrato del front diga "jpeg"
  { format: 'jpeg' as const, cloudFormat: 'jpg', quality: 72 }
];

export function getStatus() {
  return {
    formats: ['AVIF (calidad 55)', 'WebP (calidad 68)', 'JPEG (calidad 72 fallback)'],
    sizes: [150, 400, 800, 1200, 1920]
  };
}

/** URL-friendly slug, idéntico al del server Node */
export function sanitizeSlug(input: string): string {
  const nameWithoutExt = input.replace(/\.[^/.]+$/, '');
  return (
    nameWithoutExt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || `noticia-${Date.now()}`
  );
}

async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function requireCredentials(env: CloudinaryEnv) {
  const missing = (
    ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const
  ).filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(
      `Cloudinary no configurado en el Worker: falta ${missing.join(', ')}. Envíalas con "npx wrangler secret put <NOMBRE>".`
    );
  }
}

interface CloudinaryUpload {
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

/** Sube el original a Cloudinary con firma (SHA-1 de los parámetros + API secret). */
async function uploadOriginal(
  env: CloudinaryEnv,
  bytes: Uint8Array,
  filename: string,
  mimeType: string
): Promise<CloudinaryUpload> {
  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary firma solo estos parámetros (lo que reporta en "String to sign")
  const signedParams: Record<string, string> = {
    folder: 'blacknews/articles',
    timestamp: String(timestamp)
  };

  const stringToSign = Object.keys(signedParams)
    .sort()
    .map((key) => `${key}=${signedParams[key]}`)
    .join('&');
  const signature = await sha1Hex(stringToSign + env.CLOUDINARY_API_SECRET);

  const form = new FormData();
  form.append('file', new Blob([bytes as BlobPart], { type: mimeType }), filename);
  form.append('api_key', env.CLOUDINARY_API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('auto_orientation', 'true');
  form.append('folder', signedParams.folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`;
  const response = await fetch(endpoint, { method: 'POST', body: form });
  const payload = (await response.json().catch(() => ({}))) as Record<string, any>;

  if (!response.ok) {
    const message = payload?.error?.message || `Cloudinary respondió HTTP ${response.status}`;
    throw new Error(`Error de Cloudinary al subir la imagen: ${message}`);
  }

  if (!payload.public_id || !payload.width || !payload.height) {
    throw new Error('Cloudinary devolvió una respuesta inesperada (sin public_id/dimensiones).');
  }

  return {
    publicId: payload.public_id,
    width: Number(payload.width),
    height: Number(payload.height),
    bytes: Number(payload.bytes) || bytes.length,
    format: String(payload.format || '')
  };
}

/** URL de entrega con transformación en el CDN (formato + ancho + calidad, sin metadatos). */
function variantUrl(
  cloudName: string,
  publicId: string,
  width: number,
  cloudFormat: string,
  quality: number
): string {
  const transformation = `w_${width},f_${cloudFormat},q_${quality},fl_strip_profile`;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${publicId}`;
}

/** Mide el peso real de una variante en el CDN (content-length del HEAD). */
async function measureVariant(url: string): Promise<number> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok) return 0;
    return Number(head.headers.get('content-length') || 0);
  } catch {
    return 0;
  }
}

async function buildBlurPlaceholder(
  cloudName: string,
  publicId: string,
  aspectRatio: number
): Promise<string> {
  // Miniatura de 20px de ancho con desenfoque fuerte (placeholder mientras carga)
  const blurHeight = Math.max(12, Math.round(20 / (aspectRatio || 1)));
  const url = `https://res.cloudinary.com/${cloudName}/image/upload/w_20,h_${blurHeight},c_fit,e_blur:200,f_webp,q_20/${publicId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const buffer = new Uint8Array(await response.arrayBuffer());
    return `data:image/webp;base64,${toBase64(buffer)}`;
  } catch {
    return '';
  }
}

/** Obtiene las dimensiones del original: por JSON (archivo) o descargando una URL. */
async function readImageInput(
  request: Request
): Promise<{ bytes: Uint8Array; filename: string; mimeType: string; slug?: string; isHero: boolean }> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const entry = form.get('image');
    if (!(entry instanceof File)) {
      throw new Error('No se recibió ninguna imagen para procesar.');
    }
    return {
      bytes: new Uint8Array(await entry.arrayBuffer()),
      filename: entry.name || 'noticia.jpg',
      mimeType: entry.type || 'image/jpeg',
      slug: typeof form.get('slug') === 'string' ? String(form.get('slug')) : undefined,
      isHero: String(form.get('isHero')) === 'true'
    };
  }

  if (contentType.includes('application/json')) {
    const body = (await request.json()) as { imageUrl?: string; slug?: string; isHero?: boolean | string };
    const source = body.imageUrl;
    if (!source) throw new Error('No se recibió ninguna imagen para procesar.');

    if (source.startsWith('data:')) {
      const [header, base64Data] = source.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { bytes, filename: 'noticia.jpg', mimeType, slug: body.slug, isHero: body.isHero === true || body.isHero === 'true' };
    }

    if (source.startsWith('http://') || source.startsWith('https://')) {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Error al descargar la imagen remota: HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const name = new URL(source).pathname.split('/').pop() || 'noticia.jpg';
      return {
        bytes,
        filename: name,
        mimeType: response.headers.get('content-type') || 'image/jpeg',
        slug: body.slug,
        isHero: body.isHero === true || body.isHero === 'true'
      };
    }

    throw new Error('imageUrl no válida: se espera una URL http(s) o un data URI.');
  }

  throw new Error('Content-Type no soportado: usa multipart/form-data con el campo "image".');
}

export async function optimizeImage(request: Request, env: CloudinaryEnv): Promise<OptimizationResult> {
  requireCredentials(env);

  const input = await readImageInput(request);
  const originalSize = input.bytes.length;

  const upload = await uploadOriginal(env, input.bytes, input.filename, input.mimeType);

  const originalWidth = upload.width;
  const originalHeight = upload.height;
  const aspectRatio = Number((originalWidth / originalHeight).toFixed(3)) || 1;

  const baseSlug = input.slug ? sanitizeSlug(input.slug) : sanitizeSlug(input.filename);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const requestedSizes = input.isHero ? HERO_SIZES : STANDARD_SIZES;
  const targetSizes = requestedSizes.filter((w) => w <= originalWidth + 100);
  if (targetSizes.length === 0) targetSizes.push(Math.min(originalWidth, 800));

  // Genera todas las variantes en el CDN y las mide en paralelo
  const jobs: Array<{ width: number; height: number; spec: (typeof FORMAT_CONFIG)[number]; url: string }> = [];
  for (const width of targetSizes) {
    const height = Math.round(width / aspectRatio);
    for (const spec of FORMAT_CONFIG) {
      jobs.push({
        width,
        height,
        spec,
        url: variantUrl(env.CLOUDINARY_CLOUD_NAME, upload.publicId, width, spec.cloudFormat, spec.quality)
      });
    }
  }

  const sizes = await Promise.all(jobs.map((job) => measureVariant(job.url)));

  const variants: ImageVariantInfo[] = jobs.map((job, index) => ({
    width: job.width,
    height: job.height,
    format: job.spec.format,
    url: job.url,
    sizeBytes: sizes[index],
    filename: `${slug}-${job.width}.${job.spec.format === 'jpeg' ? 'jpg' : job.spec.format}`
  }));

  const blurDataUrl = await buildBlurPlaceholder(env.CLOUDINARY_CLOUD_NAME, upload.publicId, aspectRatio);

  const avifVariants = variants.filter((v) => v.format === 'avif').sort((a, b) => a.width - b.width);
  const webpVariants = variants.filter((v) => v.format === 'webp').sort((a, b) => a.width - b.width);
  const jpegVariants = variants.filter((v) => v.format === 'jpeg').sort((a, b) => a.width - b.width);

  const srcsetAvif = avifVariants.map((v) => `${v.url} ${v.width}w`).join(', ');
  const srcsetWebp = webpVariants.map((v) => `${v.url} ${v.width}w`).join(', ');
  const srcsetJpeg = jpegVariants.map((v) => `${v.url} ${v.width}w`).join(', ');

  const defaultFallback = jpegVariants.find((v) => v.width === 800) || jpegVariants[jpegVariants.length - 1];
  const fallbackUrl = defaultFallback?.url || variants[0]?.url || '';

  const mediumAvif = avifVariants.find((v) => v.width === 800) || avifVariants[avifVariants.length - 1];
  const totalSavingsPercent =
    mediumAvif && mediumAvif.sizeBytes > 0 && originalSize > 0
      ? Math.max(0, Math.round(((originalSize - mediumAvif.sizeBytes) / originalSize) * 100))
      : 75;

  const pictureSnippet = `<picture>
  <source type="image/avif" srcset="${srcsetAvif}" sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px">
  <source type="image/webp" srcset="${srcsetWebp}" sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px">
  <img src="${fallbackUrl}" loading="${input.isHero ? 'eager' : 'lazy'}" ${input.isHero ? 'fetchpriority="high" ' : ''}alt="${input.filename}" width="${defaultFallback?.width || 800}" height="${defaultFallback?.height || 533}">
</picture>`;

  return {
    slug,
    originalName: input.filename,
    originalSize,
    width: originalWidth,
    height: originalHeight,
    aspectRatio,
    blurDataUrl,
    variants,
    srcsetAvif,
    srcsetWebp,
    srcsetJpeg,
    fallbackUrl,
    pictureSnippet,
    totalSavingsPercent,
    storage: 'cloudinary'
  };
}
