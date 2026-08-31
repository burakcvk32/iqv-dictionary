//config.ts

enum LayoutType {
  MIX = 'mix',
  TOP = 'top',
  SIDE = 'side',
}

const CONFIG = {
  // Uygulamanın görünen adı — browser sekmesi (<title>, dashboard/index.html
  // üzerinden vite.config.ts `createHtmlPlugin`), PWA manifest name/short_name
  // ve marka ikonlarının alt metninde kullanılır. Yalnızca GÖRÜNEN isim —
  // logo, UI tasarımı veya sayfa içeriği bu değişiklikten ETKİLENMEZ.
  appName: 'IQV Dictionary',
  enablePWA: true,
  theme: {
    accentColor: '#838cf9',
    sidebarLayout: LayoutType.MIX,
  },
  metaTags: {
    title: 'IQV Dictionary',
    description: 'IQV Dictionary — terim sözlüğü ve platform yönetim paneli.',
    imageURL: 'logo.svg',
  },
};

export default CONFIG;
