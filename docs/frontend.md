# Frontend / Dashboard

`dashboard/`, React 18 + TypeScript + Vite ile yazılmış, Ant Design
bileşen kütüphanesini kullanan bir SPA'dır. Durum yönetimi Redux Toolkit
ile yapılır.

## Dizin yapısı (`dashboard/src/`)

| Dizin | İçerik |
|---|---|
| `routes/` | `browserRouter.tsx` (React Router tanımı, lazy-loaded sayfalar), `web.tsx` (sayfa path'leri), `api.tsx` (backend uç adresleri), `requireAuth.tsx` / `requirePermission.tsx` (route koruma bileşenleri) |
| `store/` | Redux Toolkit store'u (`store/index.tsx`) ve slice'lar (`store/slices/adminSlice.tsx`) |
| `services/` | Backend'e giden HTTP istemcileri: `authApi.ts`, `dictionaryApi.ts`, `peopleApi.ts` |
| `components/` | Alan bazlı UI: `auth/`, `dictionary/`, `layout/`, `loader/`, `settings/`, `theme/`, `users/` |
| `interfaces/` | TypeScript tip tanımları (`interfaces/models/`) |
| `constants/` | Sabitler |
| `utils/` | Yardımcı fonksiyonlar, `API_BASE_URL` çözümleme mantığı |

## Route koruma modeli

`requireAuth.tsx`, sayfa render edilmeden ÖNCE backend'in
`GET /api/v1/auth/me` ucuna karşı token'ı doğrular ("protected page
flash" güvenlik önlemi — doğrulama bitene kadar ne korumalı içerik ne de
login sayfası gösterilir, yalnızca bir loader). `requirePermission.tsx`
ise kullanıcının backend ile aynı `PermissionKey` sözleşmesini
(`dictionary.*`/`users.*`/`settings.*`) kullanarak sayfa/aksiyon bazlı
yetki kontrolü yapar (bkz. [Backend API](backend-api.md)
ve `dashboard/src/utils/permissions.ts` — backend `middleware/auth.ts`
ile birebir eşleşmesi gereken izin haritası).

## Tema (açık/koyu)

`components/theme/AppTheme.tsx`, uygulamanın kendi açık/koyu tema
sağlayıcısıdır — Ant Design'ın `ConfigProvider` tema token'larını
değiştirerek çalışır. (Bu, dokümantasyon sitesinin kendi Material tema
toggle'ından ayrıdır — bkz. [Ana Sayfa](index.md); ikisi bağımsız iki
sistemdir, biri uygulamanın kendi arayüzü, diğeri bu docs sitesi.)

## API taban adresi mantığı

`dashboard/src/utils/index.tsx`:

- **Geliştirme (`import.meta.env.DEV`):** her zaman boş/relative —
  istekler `/api/v1/...` şeklinde aynı origin'e gider, Vite'ın kendi
  `/api` proxy'si (`vite.config.ts`) bunu gerçek backend'e yönlendirir.
  `VITE_API_BASE_URL` dev'de KASITLI olarak yok sayılır.
- **Production build:** `VITE_API_BASE_URL` (build-time env — bkz.
  `dashboard/Dockerfile.prod`'daki `--build-arg` ve kök `.env.example`)
  kullanılır; istemci artık bir dev-server proxy'sinin arkasında
  değildir, backend'in gerçek adresine doğrudan istek atar.

## Test

Bileşen/unit testleri Vitest + React Testing Library + jsdom ile
`src/**/*.test.{ts,tsx}` altında yazılır — ayrıntı ve bilinen kapsam
sınırları için bkz. [Test](development/testing.md).

## Geliştirme komutları

```bash
cd dashboard
pnpm install --frozen-lockfile
pnpm run dev          # hot-reload dev server (Vite)
pnpm run typecheck    # tsc
pnpm run lint          # ESLint
pnpm run build         # production build (tsc && vite build)
pnpm test               # Vitest
```

Paket yöneticisi kesinlikle **pnpm**'dir (`dashboard/pnpm-lock.yaml`
kaynak-doğrusu) — `npm`/`yarn` ile karıştırılmamalıdır, bkz.
[Git ve CI](development/git-ci.md).
