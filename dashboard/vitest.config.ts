/// <reference types="vitest" />
// KOK NEDEN: `defineConfig` BILEREK `vite` paketinden DEGIL, `vitest/config`
// paketinden import ediliyor. Bu dosya (`vitest.config.ts`) gercek
// `dashboard/` dizininde durdugu icin, buradan yapilan `import ... from
// 'vite'` Node çözümlemesi ONCE dashboard'un KENDI (gercek, Windows'ta
// kurulmus, sadece @esbuild/win32-x64 barindiran) vite@4.4.2 kurulumunu
// bulurdu -- bu da vitest'in (bu test altyapisi icin scratch kurulumdan
// sembolik baglanti ile getirilen, vite@5 bekleyen) ic API'leriyle
// UYUMSUZ, bu ortamda calismayan bir Windows esbuild binary'sine
// dayanan bir surumdur. `vitest/config`, `vitest` paketinin KENDI (Linux
// icin doğru kurulmus) `vite`sini kullanir ve versiyon/binary uyumsuzlugunu
// tamamen ortadan kaldirir.
import { defineConfig } from 'vitest/config';

// KOK NEDEN (devam): ana `vite.config.ts`, testler icin gereksiz build-time
// plugin'lere (tailwindcss/vite-plugin-pwa/vite-plugin-html) bagimlidir --
// bu yuzden ayri, kucuk bir test config'i tutuluyor. `@vitejs/plugin-react`
// BILEREK EKLENMEDI: bu ortamda kurulu surumu (4.7.0) `@rolldown/pluginutils`
// adli, projede hic kurulmamis DENEYSEL bir opsiyonel bagimliliga statik
// olarak referans veriyor -- plugin eklenmeden de Vite/esbuild,
// `tsconfig.json`'daki `"jsx": "react-jsx"` ayarini otomatik okuyup
// JSX/TSX dosyalarini dogru sekilde derliyor (yalnizca React Fast Refresh
// -- HMR -- devre disi kalir, bu da test calistirmalarini ETKILEMEZ).
export default defineConfig({
  // KOK NEDEN: Vite, proje kokunde `postcss.config.cjs` bulunca bunu
  // OTOMATIK olarak yukler (test dosyasi hic CSS import etmese bile,
  // config cozumleme asamasinda gerceklesir) -- gercek dosyadaki
  // `tailwindcss` plugin'i, bu ortamda (Windows'ta kurulmus, bu Linux
  // koprusune tasinmamis) EKSIK oldugu icin bu, testler CSS ile hic
  // ilgilenmese bile bir yukleme hatasina yol aciyordu. Bos, inline bir
  // `postcss` config'i vererek dosya-tabanli otomatik kesif devre disi
  // birakiliyor -- testler zaten CSS'i test ETMIYOR.
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/testSetup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // `subgroupFilter.test.tsx` BİLEREK hariç tutuldu: bu ortamda (Windows'a
    // FUSE köprüsü üzerinden bağlanan, yavaş dosya G/Ç'li) `antd` +
    // `react-redux`/`@reduxjs/toolkit`'i içeren Dictionary sayfasının bağımlılık
    // grafiğinin ilk taranması/derlenmesi tekrarlanan denemelerde DAHİ
    // birkaç dakikayı aştı (mevcut çalıştırma ortamının pratik zaman
    // sınırının üzerinde) -- bu bir KOD KUSURU değil, ortamın G/Ç
    // performansıyla ilgili bir kısıt. Dosya BİLİNÇLİ OLARAK SİLİNMEDİ
    // (gerçek proje bileşenini, mock'lanmamış gerçek tıklama mantığıyla
    // test etmeye çalışan gerçek bir test senaryosu olarak repoda kalıyor)
    // -- yalnızca varsayılan `npm test` koşusunu (ve dolayısıyla diğer,
    // GERÇEKTEN çalışan testleri) bloke etmemesi için hariç tutuldu. Bkz.
    // TEST_REPORT.md -> "NOT EXECUTED" bölümü.
    exclude: [
      'node_modules',
      'dist',
      'src/__smoketest__/**',
      'src/components/dictionary/subgroupFilter.test.tsx',
    ],
  },
});
