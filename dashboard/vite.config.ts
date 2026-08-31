import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { createHtmlPlugin } from 'vite-plugin-html';
import tailwindConfig from './tailwind.config.mjs';
import CONFIG from './config';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    createHtmlPlugin({
      inject: {
        data: {
          title: CONFIG.appName,
          metaTitle: CONFIG.metaTags.title,
          metaDescription: CONFIG.metaTags.description,
          metaImageURL: CONFIG.metaTags.imageURL,
        },
      },
    }),
    ...(CONFIG.enablePWA
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            // KOK NEDEN DUZELTMESI: devOptions.enabled=true iken
            // vite-plugin-pwa, npm run dev (vite dev) sirasinda BILE
            // gercek bir workbox service worker uretip tarayiciya
            // kaydediyor (bkz. dashboard/dev-dist/). Bu SW, autoUpdate ile
            // guncellenmeye calissa da HTML/JS gibi navigasyon isteklerini
            // cache-first servis edebiliyor; sonuc olarak kaynak kod
            // degistirilse bile (or. Login.tsx) tarayicida ESKI surum
            // gorunmeye devam edebiliyor -- bu, "IQVizyon hala gorunuyor"
            // belirtisinin gercek kok nedenidir. PRODUCTION build'i
            // (vite build) ETKILENMEZ; bu ayar sadece dev sunucusu
            // icindir. Gelistirme sirasinda SW kaynakli stale-cache
            // sorunlarini tamamen ortadan kaldirmak icin kapatildi.
            devOptions: {
              enabled: false,
            },
            includeAssets: ['icon.png'],
            // IQV Dictionary Swagger / OpenAPI (`/api-docs`, `/openapi.json`)
            // backend-native, SPA-DISI gercek sayfalardir -- production
            // build'inde Workbox'in navigasyon fallback'i (bilinmeyen
            // path'leri index.html'e dusurme) BUNLARI YAKALAMAMALI, aksi
            // halde Swagger yerine React app kabugu servis edilir. Sadece
            // bu iki yol icin ACIKCA disariya alindi -- diger normal SPA/
            // PWA davranisi (offline app-shell fallback) DEGISMEDI.
            workbox: {
              navigateFallbackDenylist: [
                /^\/api-docs(?:\/|$)/,
                /^\/openapi\.json$/,
              ],
            },
            manifest: {
              name: CONFIG.appName,
              short_name: CONFIG.appName,
              description: CONFIG.metaTags.description,
              theme_color: CONFIG.theme.accentColor,
              background_color: '#ffffff',
              display: 'standalone',
              start_url: '/',
              icons: [
                {
                  src: 'icon.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: 'icon.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any',
                },
              ],
            },
          }),
        ]
      : []),
  ],
  css: {
    postcss: {
      plugins: [tailwind(tailwindConfig), autoprefixer],
    },
  },
  define: {
    CONFIG: CONFIG,
  },
  // LAN gelistirme erisimi: `0.0.0.0` uzerinde dinleyerek makinenin mevcut
  // LAN IP'sinden (ornegin http://192.168.10.158:5173) de erisilebilir hale
  // gelir -- `yarn dev --host` gibi gecici bir bayrak yerine kalici config.
  // Port 5173 zaten varsayilan; acikca yaziliyor. IP hicbir yerde hardcode
  // EDILMEDI -- makine hangi LAN IP'sine sahipse Vite otomatik onun
  // uzerinden de erisilebilir olur.
  //
  // `/api` proxy: LAN'dan (veya localhost'tan) acilan sayfadaki fetch/axios
  // istekleri ayni origin'e (mevcut host:5173) gittigi icin istemci
  // bilgisayarin KENDI localhost'una gitme riski ORTADAN KALKAR -- Vite dev
  // sunucusu bu istekleri sunucu tarafinda (ayni makinede calisan) gercek
  // Node.js backend'e (bkz. backend/.env PORT=3001) iletir. Bu, tarayici
  // acisindan same-origin oldugundan CORS'a da tabi degildir.
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Hedef normalde ayni makinedeki backend'e (localhost:3001) gider.
      // Docker Compose'ta frontend/backend AYRI container oldugundan
      // 'localhost' artik frontend container'inin KENDISINI isaret eder --
      // bu durumda docker-compose.yml, backend servisinin Docker DNS adini
      // (`http://dictionary-backend:3001`) bu degiskenle ENJEKTE eder.
      // Docker DISINDA (normal `npm run dev`) bu degisken TANIMSIZDIR ve
      // onceki, degismeyen davranis (localhost:3001) aynen KORUNUR.
      '/api': {
        target:
          process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
      // Backend'in `/api/v1/*` DISINDA kalan gercek root-level route'lari
      // (health check + Node-RED uyumluluk uclari) icin -- `/api` ile AYNI
      // hedef/AYNI degisken. Bu olmadan bu endpoint'lerde "Try it out" ayni
      // origin'de 404 dener (SPA fallback'e duser).
      '/health': {
        target:
          process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
      '/list-dictionary': {
        target:
          process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
      '/create-dictionary': {
        target:
          process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
      // IQV Dictionary Swagger / OpenAPI -- backend-native (bkz.
      // backend/src/docs/swagger.ts). ONCEDEN buraya AYRI bir kural
      // eklenmemisti; `/api-docs` istekleri yalnizca yukaridaki `/api`
      // kuralinin string-prefix eslesmesine ("/api-docs".startsWith("/api")
      // => true) SESSIZCE guveniyordu -- bu, dogru hedefe gitse de
      // KIRILGAN/ORTUK bir davranistir (ayni prefix eslesmesi, ONCEKI
      // hatali frontend mimarisinde `/api-docs` isteginin route'suz
      // backend'e dusup 404 JSON donmesine neden olan KOK SEBEPTI). Artik
      // ACIKCA, kendi kurallariyla tanimlaniyor.
      '/api-docs': {
        target:
          process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
      '/openapi.json': {
        target:
          process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
