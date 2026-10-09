// Load local .env (gitignored). In production (Cloudflare Workers) these same
// names come from the dashboard variables/secrets instead.
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { processNewsImage, getR2Status } from './server/imageOptimizer.ts';
// Tabla de precios compartida con el Worker (fuente única de verdad)
import { PRICES } from './worker/paypal.ts';
// Misma implementación que el Worker para la IA editorial: en local la clave
// va en .env y sin ella se avisa, nunca se finge una respuesta.
import { handleAiGenerate } from './worker/ai.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Body parsers
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Ensure public/uploads exists and serve it statically
const uploadsDir = path.resolve(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.avif')) {
      res.setHeader('Content-Type', 'image/avif');
    } else if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
  }
}));

// Setup multer in-memory storage for uploaded files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// API: Get basic format and dimension capabilities
app.get('/api/images/status', (_req, res) => {
  try {
    const status = getR2Status();
    res.json({ success: true, ...status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Process and optimize uploaded image or remote image URL
app.post('/api/images/optimize', upload.single('image') as any, async (req, res) => {
  try {
    let imageBuffer: Buffer | null = null;
    let originalName = 'news-image.jpg';
    const slug = req.body?.slug || req.query?.slug;
    const isHero = req.body?.isHero === 'true' || req.body?.isHero === true;

    // Check if multipart file was provided
    if (req.file && req.file.buffer) {
      imageBuffer = req.file.buffer;
      originalName = req.file.originalname || originalName;
    } 
    // Or check if base64 or remote URL was provided in JSON body
    else if (req.body?.imageUrl) {
      const imageUrl = req.body.imageUrl as string;
      if (imageUrl.startsWith('data:')) {
        // Base64 data URL
        const base64Data = imageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // Remote URL fetch
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Error al descargar la imagen remota: HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        const urlParts = new URL(imageUrl).pathname.split('/');
        originalName = urlParts[urlParts.length - 1] || originalName;
      } else if (imageUrl.startsWith('/')) {
        // Local asset file in repo
        const localPath = path.resolve(__dirname, imageUrl.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          imageBuffer = await fs.promises.readFile(localPath);
          originalName = path.basename(localPath);
        } else {
          // Check public folder
          const publicPath = path.resolve(__dirname, 'public', imageUrl.replace(/^\//, ''));
          if (fs.existsSync(publicPath)) {
            imageBuffer = await fs.promises.readFile(publicPath);
            originalName = path.basename(publicPath);
          }
        }
      }
    }

    if (!imageBuffer) {
      return res.status(400).json({
        success: false,
        error: 'No se recibió ninguna imagen para procesar. Proporciona un archivo o una URL válida.'
      });
    }

    const result = await processNewsImage({
      buffer: imageBuffer,
      originalName,
      slug: typeof slug === 'string' ? slug : undefined,
      isHero
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error processing image:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error al procesar la imagen'
    });
  }
});

// Setup multer temporary disk storage for video conversion
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.webm';
      cb(null, `rec-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

// Helper to inspect if input media has an audio stream via ffprobe
function checkHasAudio(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(false);
      resolve(Boolean(stdout && stdout.trim().includes('audio')));
    });
  });
}

const composeUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || (file.fieldname === 'overlay' ? '.png' : '.mp4');
      cb(null, `comp-${file.fieldname}-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
    }
  }),
  limits: { fileSize: 250 * 1024 * 1024 } // 250MB max for long videos
});

// API: Suscripciones PayPal — en local no hay Worker ni credenciales, se
// responde "no configurado" para que la modal lo muestre sin fingir pagos.
app.get('/api/paypal/config', (_req, res) => {
  res.json({
    success: true,
    enabled: false,
    mode: 'sandbox',
    currency: 'USD',
    clientId: null,
    planIds: {},
    prices: PRICES,
  });
});
app.use('/api/paypal', (_req, res) => {
  if (_req.method === 'GET') {
    res.json({ success: true, active: false });
    return;
  }
  res.status(503).json({ success: false, error: 'payments_not_configured' });
});

// API: Redacción asistida con IA (OpenRouter + búsqueda web Tavily) — mismo
// handler que el Worker. En local las claves salen de .env (OPENROUTER_API_KEY
// y, opcional, TAVILY_API_KEY); con OPENROUTER_API_BASE / TAVILY_API_BASE
// pueden apuntar a servicios simulados para probar el circuito sin gastar.
app.post('/api/ai/generate', async (req, res) => {
  try {
    const host = req.get('host') || `localhost:${PORT}`;
    const request = new Request(`http://${host}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': req.ip || req.socket.remoteAddress || 'local',
      },
      body: JSON.stringify(req.body ?? {}),
    });
    const response = await handleAiGenerate(request, {
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
      OPENROUTER_API_BASE: process.env.OPENROUTER_API_BASE,
      TAVILY_API_KEY: process.env.TAVILY_API_KEY,
      TAVILY_API_BASE: process.env.TAVILY_API_BASE,
    });
    res.status(response.status).type('application/json').send(await response.text());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al generar con la IA';
    console.error('[BLACKNEWS API] ai:', message);
    res.status(502).json({ success: false, error: message });
  }
});

// API: Direct Server-Side Video Post Composition (High-Speed, 100% Quality, Perfect Audio Sync)
app.post('/api/video/compose-post', composeUpload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'overlay', maxCount: 1 }
]) as any, async (req, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const videoFile = files?.video?.[0];
  const overlayFile = files?.overlay?.[0];
  let tempDownloadedVideoPath: string | null = null;

  if ((!videoFile && !req.body?.videoUrl) || !overlayFile) {
    return res.status(400).json({ success: false, error: 'Se requiere archivo de video (o URL de video) y overlay PNG' });
  }

  let videoPath = videoFile?.path;
  const overlayPath = overlayFile.path;
  const outputPath = path.join(os.tmpdir(), `post-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);
  const outputFilename = (req.body?.filename as string) || 'blacknews-post-4x5.mp4';

  const trimStart = Math.max(0, parseFloat(req.body?.trimStart) || 0);
  const trimEnd = parseFloat(req.body?.trimEnd) || 0;
  const maxDuration = parseFloat(req.body?.maxDuration) || 0;
  const videoSpeed = Math.max(0.25, Math.min(4.0, parseFloat(req.body?.videoSpeed) || 1.0));
  const isMuted = req.body?.isMuted === 'true' || req.body?.isMuted === true;
  const filter = (req.body?.filter as string) || 'none';
  const brightness = parseFloat(req.body?.brightness) || 100;
  const contrast = parseFloat(req.body?.contrast) || 100;

  try {
    // If video was provided via URL instead of file upload
    if (!videoPath && req.body?.videoUrl) {
      const vUrl = String(req.body.videoUrl).trim();
      tempDownloadedVideoPath = path.join(os.tmpdir(), `dl-video-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);
      const resp = await fetch(vUrl);
      if (!resp.ok) {
        throw new Error(`No se pudo descargar el video remoto (HTTP ${resp.status}): ${resp.statusText}`);
      }
      const arrayBuf = await resp.arrayBuffer();
      fs.writeFileSync(tempDownloadedVideoPath, Buffer.from(arrayBuf));
      videoPath = tempDownloadedVideoPath;
    }

    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new Error('Archivo de video no disponible para composición');
    }

    const hasAudio = await checkHasAudio(videoPath);

    // Calculate effective duration
    let clipDuration = 0;
    if (trimEnd > trimStart) {
      clipDuration = trimEnd - trimStart;
      if (maxDuration > 0) {
        clipDuration = Math.min(clipDuration, maxDuration);
      }
    } else if (maxDuration > 0) {
      clipDuration = maxDuration;
    }

    // Build video filter sequence with normalized SAR and constant 30fps
    const videoFilters: string[] = [
      'setsar=1',
      'scale=1080:810:force_original_aspect_ratio=increase',
      'crop=1080:810',
      'fps=30'
    ];

    // Speed adjustment if any
    if (videoSpeed !== 1.0) {
      videoFilters.push(`setpts=PTS/${videoSpeed}`);
    }

    // Color & editorial filters
    if (filter === 'bw-high') {
      videoFilters.push('colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3,eq=contrast=1.3:brightness=0.01');
    } else if (filter === 'editorial') {
      videoFilters.push('colorchannelmixer=.33:.33:.33:0:.33:.33:.33:0:.33:.33:.33,eq=contrast=1.15:brightness=0.0');
    } else if (filter === 'warm-cinematic') {
      videoFilters.push('colorbalance=rs=.08:gs=-.02:bs=-.08,eq=contrast=1.1');
    } else if (filter === 'cool-cyber') {
      videoFilters.push('colorbalance=rs=-.05:gs=.02:bs=.1,eq=contrast=1.15');
    } else if (filter === 'contrast-plus') {
      videoFilters.push('eq=contrast=1.25:brightness=0.02');
    }

    if (brightness !== 100 || contrast !== 100) {
      const bNorm = (brightness - 100) / 200;
      const cNorm = contrast / 100;
      videoFilters.push(`eq=contrast=${cNorm}:brightness=${bNorm}`);
    }

    const vFilterStr = videoFilters.join(',');

    // Position video on bottom 60% (y = 540px) and overlay the 1080x1350 PNG with titles & branding.
    // Notice: shortest=1 on overlay ensures video stream drives the visual timeline.
    let filterComplex = `[0:v]${vFilterStr}[vvid]; [vvid]pad=1080:1350:0:540:black[vbase]; [vbase][1:v]overlay=0:0:shortest=1[vout]`;

    const args: string[] = ['-y'];

    if (trimStart > 0) {
      args.push('-ss', String(trimStart));
    }
    if (clipDuration > 0) {
      args.push('-t', String(clipDuration));
    }

    args.push('-i', videoPath);
    // CRITICAL: Loop the single-frame overlay PNG infinitely so it never cuts or freezes video
    args.push('-loop', '1', '-i', overlayPath);

    const willIncludeAudio = !isMuted && hasAudio;

    if (willIncludeAudio) {
      let aFilter = 'aresample=async=1000:first_pts=0';
      if (videoSpeed !== 1.0) {
        aFilter = `atempo=${videoSpeed},${aFilter}`;
      }
      filterComplex += `; [0:a]${aFilter}[aout]`;
      args.push('-filter_complex', filterComplex);
      args.push('-map', '[vout]');
      args.push('-map', '[aout]');
      args.push('-c:a', 'aac', '-b:a', '160k', '-ar', '48000');
    } else {
      args.push('-filter_complex', filterComplex);
      args.push('-map', '[vout]');
      args.push('-an');
    }

    // CRITICAL: -shortest ensures that output ends cleanly when video ends without frozen still frame
    args.push(
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-pix_fmt', 'yuv420p',
      '-shortest',
      '-movflags', '+faststart',
      outputPath
    );

    await new Promise<void>((resolve, reject) => {
      execFile('ffmpeg', args, { maxBuffer: 100 * 1024 * 1024 }, (err, _stdout, stderr) => {
        if (err) {
          console.error('ffmpeg composition error:', stderr || err.message);
          reject(new Error(stderr || err.message));
        } else {
          resolve();
        }
      });
    });

    const stat = fs.statSync(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);

    const readStream = fs.createReadStream(outputPath);
    readStream.pipe(res);

    readStream.on('close', () => {
      if (videoPath) try { fs.unlinkSync(videoPath); } catch {}
      if (tempDownloadedVideoPath) try { fs.unlinkSync(tempDownloadedVideoPath); } catch {}
      try { fs.unlinkSync(overlayPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
    });
  } catch (err: any) {
    console.error('Error in /api/video/compose-post:', err);
    if (videoPath) try { fs.unlinkSync(videoPath); } catch {}
    if (tempDownloadedVideoPath) try { fs.unlinkSync(tempDownloadedVideoPath); } catch {}
    try { fs.unlinkSync(overlayPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
    return res.status(500).json({ success: false, error: err.message || 'Error en composición de video' });
  }
});

// API: Convert WebM or raw video recording to 100% compliant H.264/AAC MP4 for X (Twitter), Instagram & Meta
app.post('/api/video/convert-to-mp4', videoUpload.single('video') as any, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No se recibió ningún archivo de video' });
  }

  const inputPath = req.file.path;
  const outputPath = path.join(os.tmpdir(), `out-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);
  const outputFilename = (req.body?.filename as string) || 'blacknews-video.mp4';

  try {
    const hasAudio = await checkHasAudio(inputPath);

    await new Promise<void>((resolve, reject) => {
      const args = [
        '-y',
        '-i', inputPath,
        '-vsync', 'cfr',
        '-r', '30',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        '-movflags', '+faststart'
      ];

      if (hasAudio) {
        args.push(
          '-c:a', 'aac',
          '-b:a', '160k',
          '-ar', '48000',
          '-af', 'aresample=async=1000:first_pts=0'
        );
      } else {
        args.push('-an');
      }

      args.push(outputPath);

      execFile('ffmpeg', args, { maxBuffer: 100 * 1024 * 1024 }, (err, _stdout, stderr) => {
        if (err) {
          // If first attempt failed with audio, fallback with -an
          execFile('ffmpeg', [
            '-y',
            '-i', inputPath,
            '-vsync', 'cfr',
            '-r', '30',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '22',
            '-pix_fmt', 'yuv420p',
            '-shortest',
            '-movflags', '+faststart',
            '-an',
            outputPath
          ], { maxBuffer: 100 * 1024 * 1024 }, (retryErr) => {
            if (retryErr) {
              reject(new Error(stderr || retryErr.message));
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    });

    const stat = fs.statSync(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);

    const readStream = fs.createReadStream(outputPath);
    readStream.pipe(res);

    readStream.on('close', () => {
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
    });
  } catch (err: any) {
    console.error('Error converting video to MP4:', err);
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
    return res.status(500).json({ success: false, error: err.message || 'Error al convertir video a MP4' });
  }
});

// Mount Vite or serve static assets
async function startServer() {
  if (!isProduction) {
    // Development mode with Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve dist static files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BLACKNEWS SERVER] Running on http://0.0.0.0:${PORT} (Mode: ${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
