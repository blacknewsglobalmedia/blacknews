/**
 * BLACKNEWS — Cloudflare Worker entry point.
 *
 * - /api/images/*  → API de optimización de imágenes (Cloudinary + transformaciones por CDN)
 * - /api/video/*   → retirada (el material audiovisual se publica en YouTube)
 * - cualquier otra ruta → assets estáticos del frontend (dist/)
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export interface Env {
  // Binding de los assets estáticos (dist/) declarado en wrangler.jsonc
  ASSETS: { fetch(request: Request): Promise<Response> };
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  // Suscripciones PayPal (secretos con `wrangler secret put`, nunca en el repo)
  PAYPAL_MODE?: string; // 'sandbox' (por defecto) | 'live'
  PAYPAL_API_BASE?: string; // SOLO pruebas locales (ver worker/paypal.ts)
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_SECRET?: string;
  // Accesos concedidos (solo el Worker escribe aquí)
  PAYPAL_KV: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
}

async function handleApi(request: Request, env: Env, pathname: string): Promise<Response> {
  // Import perezoso: solo se carga el módulo de imágenes cuando hace falta
  const { optimizeImage, getStatus } = await import('./images');

  if (pathname === '/api/images/status' && request.method === 'GET') {
    return json({ success: true, ...getStatus() });
  }

  if (pathname === '/api/images/optimize' && request.method === 'POST') {
    try {
      const data = await optimizeImage(request, env);
      return json({ success: true, data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al procesar la imagen';
      console.error('[BLACKNEWS WORKER] optimize:', message);
      return json({ success: false, error: message }, 502);
    }
  }

  // Suscripciones PayPal (config, estado, activación y cancelación)
  if (pathname.startsWith('/api/paypal/')) {
    const { handlePaypalRequest } = await import('./paypal');
    return handlePaypalRequest(request, env, pathname);
  }

  if (pathname.startsWith('/api/video/')) {
    return json(
      {
        success: false,
        error:
          'El servicio de video se retiró: las publicaciones con video se suben directamente a YouTube.'
      },
      410
    );
  }

  return json({ success: false, error: `Ruta no encontrada: ${pathname}` }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith('/api/')) {
      return handleApi(request, env, pathname);
    }

    // Static assets (SPA): index.html para rutas sin archivo equivalente
    return env.ASSETS.fetch(request);
  }
};
