import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  // Sello de build: cambia en cada compilación (local o en Cloudflare) y se
  // muestra en el footer, para comprobar en cada despliegue que la producción
  // ejecuta el último build. Formato UTC: YYYYMMDD-HHMMSS.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const buildStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;

  return {
    define: {
      __BUILD_STAMP__: JSON.stringify(buildStamp),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
        manifest: {
          name: 'BLACKNEWS — Periodismo Independiente',
          short_name: 'BLACKNEWS',
          description:
            'Periodismo independiente: geopolítica, mercados y tecnología en blanco y negro.',
          lang: 'es',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#000000',
          theme_color: '#000000',
          icons: [
            {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png'},
            {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png'},
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // Imágenes (Cloudinary, subidas, CDN): caché primero, 30 días
              urlPattern: /\.(?:png|jpe?g|gif|svg|webp|avif|ico)(\?.*)?$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'bn-images',
                expiration: {
                  maxEntries: 250,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {statuses: [0, 200]},
              },
            },
            {
              // Tipografías de Google: caché primero, 1 año
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'bn-fonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
