import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { uploadAvifToCloudinary, getCloudinaryConfig } from './cloudinaryService.ts';

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
  storage: 'cloudinary' | 'cloudflare-r2' | 'local-edge';
}

export interface ProcessImageOptions {
  buffer: Buffer;
  originalName?: string;
  slug?: string;
  isHero?: boolean;
  customSizes?: number[];
}

// Responsive widths defined by requirement:
// Thumbnail: 150px, Small: 400px, Medium: 800px, Large: 1200px, XL: 1920px (hero/featured)
export const STANDARD_SIZES = [150, 400, 800, 1200];
export const HERO_SIZES = [150, 400, 800, 1200, 1920];

// Quality configuration according to news media standards:
// AVIF: 55 (range 50-60)
// WebP: 68 (range 65-70)
// JPEG: 72 (range 70-75)
export const FORMAT_CONFIG = {
  avif: {
    quality: 55,
    effort: 4,
    chromaSubsampling: '4:2:0'
  },
  webp: {
    quality: 68,
    effort: 4
  },
  jpeg: {
    quality: 72,
    mozjpeg: true
  }
} as const;

// Ensure public/uploads directory exists for local fallback/storage
const PUBLIC_UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) {
  fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
}

// Initialize Cloudflare R2 client if credentials are configured
function getR2Client(): { client: S3Client; bucketName: string; publicDomain?: string } | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'news-media-images';
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;

  if (accountId && accessKeyId && secretAccessKey) {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
    return { client, bucketName, publicDomain };
  }

  return null;
}

/**
 * Generate a URL-friendly slug from text or filename
 */
export function sanitizeSlug(input: string): string {
  const nameWithoutExt = input.replace(/\.[^/.]+$/, '');
  return nameWithoutExt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || `noticia-${Date.now()}`;
}

/**
 * Upload buffer to Cloudinary, Cloudflare R2 or local directory
 */
async function saveVariant(
  filename: string,
  buffer: Buffer,
  contentType: string,
  format: 'avif' | 'webp' | 'jpeg',
  r2Config: ReturnType<typeof getR2Client>
): Promise<{ url: string; usedStorage: 'cloudinary' | 'cloudflare-r2' | 'local-edge' }> {
  // 1. Always write local file to public/uploads/ for high-performance edge serving / fallback
  const localFilePath = path.join(PUBLIC_UPLOADS_DIR, filename);
  await fs.promises.writeFile(localFilePath, buffer);
  const localUrl = `/uploads/${filename}`;

  // 2. Upload AVIF to Cloudinary
  if (format === 'avif') {
    const publicId = filename.replace(/\.[^/.]+$/, '');
    try {
      const cldRes = await uploadAvifToCloudinary(buffer, publicId);
      if (cldRes.success && cldRes.url) {
        return { url: cldRes.url, usedStorage: 'cloudinary' };
      }
    } catch (cldErr) {
      console.warn(`[IMAGE OPTIMIZER] Cloudinary notice for ${filename}:`, cldErr);
    }
  }

  // 3. Fallback to Cloudflare R2 if configured
  if (r2Config) {
    try {
      const command = new PutObjectCommand({
        Bucket: r2Config.bucketName,
        Key: filename,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable'
      });
      await r2Config.client.send(command);

      if (r2Config.publicDomain) {
        const base = r2Config.publicDomain.replace(/\/$/, '');
        return { url: `${base}/${filename}`, usedStorage: 'cloudflare-r2' };
      }
      return {
        url: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${r2Config.bucketName}/${filename}`,
        usedStorage: 'cloudflare-r2'
      };
    } catch (err) {
      console.warn(`Cloudflare R2 upload failed for ${filename}, falling back to local edge storage:`, err);
    }
  }

  return { url: localUrl, usedStorage: 'local-edge' };
}

/**
 * Core image optimization pipeline for news media:
 * 1. Conversion to AVIF by default (50-60), WebP (65-70), JPEG (70-75)
 * 2. Responsive sizes (150, 400, 800, 1200, 1920)
 * 3. Stripping of all EXIF metadata for privacy and size reduction
 * 4. Tiny 20px blur placeholder generation
 * 5. Naming: {slug}-{ancho}.{formato}
 * 6. Cloudinary .AVIF upload & storage
 */
export async function processNewsImage(options: ProcessImageOptions): Promise<OptimizationResult> {
  const {
    buffer,
    originalName = 'news-image.jpg',
    isHero = false,
    customSizes
  } = options;

  const originalSize = buffer.length;

  // Base sharp pipeline with EXIF removal
  // .rotate() will automatically orient according to EXIF before stripping metadata
  const basePipeline = sharp(buffer, { failOn: 'none' }).rotate();
  const metadata = await basePipeline.metadata();

  const originalWidth = metadata.width || 1200;
  const originalHeight = metadata.height || 800;
  const aspectRatio = Number((originalWidth / originalHeight).toFixed(3));

  // Determine slug
  const baseSlug = options.slug ? sanitizeSlug(options.slug) : sanitizeSlug(originalName);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  // Determine target widths: do not upscale beyond original width
  const requestedSizes = customSizes || (isHero ? HERO_SIZES : STANDARD_SIZES);
  const targetSizes = requestedSizes.filter((w) => w <= originalWidth + 100);
  if (targetSizes.length === 0) {
    targetSizes.push(Math.min(originalWidth, 800));
  }

  // 1. Generate 20px blur placeholder
  const blurBuffer = await sharp(buffer)
    .rotate()
    .resize(20, Math.max(12, Math.round(20 / aspectRatio)), { fit: 'inside' })
    .blur(1.5)
    .webp({ quality: 20 })
    .toBuffer();
  const blurDataUrl = `data:image/webp;base64,${blurBuffer.toString('base64')}`;

  // 2. Prepare Cloudflare R2 connection fallback
  const r2Config = getR2Client();

  const variants: ImageVariantInfo[] = [];
  let detectedStorage: 'cloudinary' | 'cloudflare-r2' | 'local-edge' = 'local-edge';

  // 3. Process each size for AVIF, WebP, and JPEG
  for (const width of targetSizes) {
    const height = Math.round(width / aspectRatio);

    // AVIF Variant (Default & Primary - quality 55)
    const avifBuffer = await sharp(buffer)
      .rotate()
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .avif(FORMAT_CONFIG.avif)
      .toBuffer();
    const avifFilename = `${slug}-${width}.avif`;
    const avifSave = await saveVariant(avifFilename, avifBuffer, 'image/avif', 'avif', r2Config);
    if (avifSave.usedStorage === 'cloudinary') {
      detectedStorage = 'cloudinary';
    } else if (avifSave.usedStorage === 'cloudflare-r2' && detectedStorage !== 'cloudinary') {
      detectedStorage = 'cloudflare-r2';
    }

    variants.push({
      width,
      height,
      format: 'avif',
      url: avifSave.url,
      sizeBytes: avifBuffer.length,
      filename: avifFilename
    });

    // WebP Variant (Secondary - quality 68)
    const webpBuffer = await sharp(buffer)
      .rotate()
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .webp(FORMAT_CONFIG.webp)
      .toBuffer();
    const webpFilename = `${slug}-${width}.webp`;
    const webpSave = await saveVariant(webpFilename, webpBuffer, 'image/webp', 'webp', r2Config);
    variants.push({
      width,
      height,
      format: 'webp',
      url: webpSave.url,
      sizeBytes: webpBuffer.length,
      filename: webpFilename
    });

    // JPEG Variant (Universal Fallback - quality 72)
    const jpegBuffer = await sharp(buffer)
      .rotate()
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .jpeg(FORMAT_CONFIG.jpeg)
      .toBuffer();
    const jpegFilename = `${slug}-${width}.jpg`;
    const jpegSave = await saveVariant(jpegFilename, jpegBuffer, 'image/jpeg', 'jpeg', r2Config);
    variants.push({
      width,
      height,
      format: 'jpeg',
      url: jpegSave.url,
      sizeBytes: jpegBuffer.length,
      filename: jpegFilename
    });
  }

  // 4. Construct srcsets for picture element
  const avifVariants = variants.filter((v) => v.format === 'avif').sort((a, b) => a.width - b.width);
  const webpVariants = variants.filter((v) => v.format === 'webp').sort((a, b) => a.width - b.width);
  const jpegVariants = variants.filter((v) => v.format === 'jpeg').sort((a, b) => a.width - b.width);

  const srcsetAvif = avifVariants.map((v) => `${v.url} ${v.width}w`).join(', ');
  const srcsetWebp = webpVariants.map((v) => `${v.url} ${v.width}w`).join(', ');
  const srcsetJpeg = jpegVariants.map((v) => `${v.url} ${v.width}w`).join(', ');

  // Standard fallback image (prefer 800w or largest available JPEG)
  const defaultFallback = jpegVariants.find((v) => v.width === 800) || jpegVariants[jpegVariants.length - 1];
  const fallbackUrl = defaultFallback?.url || variants[0].url;

  // Compute bandwidth savings against default 800w AVIF variant
  const mediumAvif = avifVariants.find((v) => v.width === 800) || avifVariants[avifVariants.length - 1];
  const totalSavingsPercent = mediumAvif
    ? Math.max(0, Math.round(((originalSize - mediumAvif.sizeBytes) / originalSize) * 100))
    : 75;

  // 5. Build suggested HTML <picture> snippet
  const pictureSnippet = `<picture>
  <source type="image/avif" srcset="${srcsetAvif}" sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px">
  <source type="image/webp" srcset="${srcsetWebp}" sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px">
  <img src="${fallbackUrl}" loading="${isHero ? 'eager' : 'lazy'}" ${isHero ? 'fetchpriority="high" ' : ''}alt="${originalName}" width="${defaultFallback?.width || 800}" height="${defaultFallback?.height || 533}">
</picture>`;

  return {
    slug,
    originalName,
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
    storage: detectedStorage
  };
}

/**
 * Returns basic format and dimension capabilities without exposing infrastructure secrets
 */
export function getR2Status() {
  return {
    formats: ['AVIF (calidad 55)', 'WebP (calidad 68)', 'JPEG (calidad 72 fallback)'],
    sizes: [150, 400, 800, 1200, 1920]
  };
}
