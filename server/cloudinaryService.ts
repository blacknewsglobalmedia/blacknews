import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.resolve(__dirname, 'cloudinaryConfig.json');

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadPreset?: string;
  folder: string;
}

// Credentials NEVER live in the source code. Precedence: environment variables
// (local .env or Cloudflare Workers variables/secrets) > server/cloudinaryConfig.json.
// See .env.example for the required keys.
const DEFAULT_CONFIG: CloudinaryConfig = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  apiKey: process.env.CLOUDINARY_API_KEY || '',
  apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  uploadPreset: 'blacknews_upload',
  folder: 'blacknews/articles'
};

let currentConfig: CloudinaryConfig = { ...DEFAULT_CONFIG };

// Load persistent config if exists (non-secret fields), then let env vars win
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    currentConfig = {
      ...DEFAULT_CONFIG,
      ...parsed,
      ...(process.env.CLOUDINARY_CLOUD_NAME ? { cloudName: process.env.CLOUDINARY_CLOUD_NAME } : {}),
      ...(process.env.CLOUDINARY_API_KEY ? { apiKey: process.env.CLOUDINARY_API_KEY } : {}),
      ...(process.env.CLOUDINARY_API_SECRET ? { apiSecret: process.env.CLOUDINARY_API_SECRET } : {})
    };
  }
} catch (err) {
  console.warn('[CLOUDINARY] Failed reading config file, using environment:', err);
}

// True when we have real credentials to talk to Cloudinary
export function hasCloudinaryCredentials(config: CloudinaryConfig = currentConfig): boolean {
  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
}

// Initialize Cloudinary SDK
function applyCloudinaryConfig() {
  cloudinary.config({
    cloud_name: currentConfig.cloudName,
    api_key: currentConfig.apiKey,
    api_secret: currentConfig.apiSecret,
    secure: true
  });
}
applyCloudinaryConfig();

export function getCloudinaryConfig(): CloudinaryConfig {
  return { ...currentConfig };
}

export function updateCloudinaryConfig(newConfig: Partial<CloudinaryConfig>): CloudinaryConfig {
  currentConfig = {
    ...currentConfig,
    ...newConfig
  };
  applyCloudinaryConfig();

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CLOUDINARY] Failed saving config file:', err);
  }

  return currentConfig;
}

export interface CloudinaryTestResult {
  success: boolean;
  cloudName: string;
  apiKeyMasked: string;
  message: string;
  isCloudNameMismatch: boolean;
  httpCode?: number;
}

export async function testCloudinaryConnection(
  configOverride?: Partial<CloudinaryConfig>
): Promise<CloudinaryTestResult> {
  const configToTest = {
    ...currentConfig,
    ...configOverride
  };

  const maskedKey = configToTest.apiKey
    ? `${configToTest.apiKey.slice(0, 4)}...${configToTest.apiKey.slice(-4)}`
    : 'No configurada';

  try {
    // Reconfigure temporarily for test if override provided
    cloudinary.config({
      cloud_name: configToTest.cloudName,
      api_key: configToTest.apiKey,
      api_secret: configToTest.apiSecret,
      secure: true
    });

    const res = await cloudinary.api.ping();
    // Reapply active config
    applyCloudinaryConfig();

    return {
      success: true,
      cloudName: configToTest.cloudName,
      apiKeyMasked: maskedKey,
      message: 'Conexión verificada con éxito con Cloudinary. Las imágenes .AVIF se alojarán en tu cuenta.',
      isCloudNameMismatch: false,
      httpCode: 200
    };
  } catch (error: any) {
    applyCloudinaryConfig();
    const errMsg = error?.message || error?.error?.message || String(error);
    const httpCode = error?.http_code || error?.error?.http_code || 500;
    const isMismatch = errMsg.includes('cloud_name mismatch') || errMsg.includes('mismatch');

    let userFriendlyMessage = `Error de conexión: ${errMsg}`;
    if (isMismatch) {
      userFriendlyMessage = `Detectado "cloud_name mismatch": La clave ${maskedKey} se llama "${configToTest.cloudName}", pero en Cloudinary el "Cloud Name" es el identificador de tu entorno (aparece arriba a la izquierda en tu panel de Cloudinary, ej. d... o personalizado). Escribe tu Cloud Name exacto para conectar.`;
    }

    return {
      success: false,
      cloudName: configToTest.cloudName,
      apiKeyMasked: maskedKey,
      message: userFriendlyMessage,
      isCloudNameMismatch: isMismatch,
      httpCode
    };
  }
}

export interface CloudinaryUploadResult {
  success: boolean;
  url: string;
  publicId: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Upload an AVIF buffer directly to Cloudinary
 */
export async function uploadAvifToCloudinary(
  buffer: Buffer,
  publicId: string,
  options?: {
    tags?: string[];
    folder?: string;
    subfolder?: string;
  }
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve) => {
    if (!hasCloudinaryCredentials()) {
      resolve({
        success: false,
        url: '',
        publicId,
        format: 'avif',
        bytes: buffer.length,
        error: 'CLOUDINARY no configurado: faltan CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET en las variables de entorno.'
      });
      return;
    }

    const targetFolder = options?.folder || currentConfig.folder || 'blacknews/articles';
    const finalFolder = options?.subfolder ? `${targetFolder}/${options.subfolder}` : targetFolder;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: finalFolder,
        public_id: publicId,
        format: 'avif',
        resource_type: 'image',
        overwrite: true,
        use_filename: true,
        tags: options?.tags || ['blacknews', 'article', 'avif']
      },
      (error, result) => {
        if (error || !result) {
          const errText = error?.message || 'Error desconocido al subir a Cloudinary';
          console.warn(`[CLOUDINARY] Upload failed for ${publicId}:`, errText);
          resolve({
            success: false,
            url: '',
            publicId,
            format: 'avif',
            bytes: buffer.length,
            error: errText
          });
          return;
        }

        resolve({
          success: true,
          url: result.secure_url || result.url,
          publicId: result.public_id,
          format: result.format || 'avif',
          bytes: result.bytes || buffer.length,
          width: result.width,
          height: result.height
        });
      }
    );

    uploadStream.end(buffer);
  });
}
