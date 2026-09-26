import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { processNewsImage, getR2Status } from './server/imageOptimizer.ts';

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

// API: Get Cloudflare R2 and compression engine status
app.get('/api/images/status', (_req, res) => {
  try {
    const status = getR2Status();
    res.json({ success: true, ...status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Process and optimize uploaded image or remote image URL
app.post('/api/images/optimize', upload.single('image'), async (req, res) => {
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
