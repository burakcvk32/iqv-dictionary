# Mimari

Dictionary, iki bağımsız alt projeden oluşan klasik bir SPA + REST API
mimarisidir: `dashboard/` (istemci) ve `backend/` (API sunucusu). İkisi
arasındaki tek temas noktası HTTP/JSON'dur — ortak kod paylaşımı yoktur,
her alt proje kendi `package.json`/bağımlılık ağacına sahiptir.

```
┌─────────────────────┐        HTTPS/JSON        ┌──────────────────────┐
│  dashboard/ (SPA)    │ ────────────────────────▶ │  backend/ (REST API)  │
│  React 18 + Vite     │   /api/v1/... (JWT)        │  Express + TypeScript │
│  Ant Design + Redux   │ ◀──────────────────────── │                        │
│  Toolkit              │                            │                        │
└─────────────────────┘                            └───────────┬───────────┘
                                                                  │ mongodb://
                                                                  ▼
                                                          ┌───────────────┐
                                                          │   MongoDB      │
                                                          │ (containerize  │
                                                          │  edilmez,      │
                                                          │  dışarıda      │
                                                          │  çalışır)      │
                                                          └───────────────┘
```

## Backend katmanları (`backend/src/`)

Her iş alanı (auth, dictionary, people) aynı 4 katmanlı deseni izler,
`backend/src/modules/<alan>/` altında:

| Katman | Dosya | Sorumluluk |
|---|---|---|
| Route | `<alan>.routes.ts` | Express router — URL'leri controller'a bağlar |
| Controller | `<alan>.controller.ts` | HTTP req/res, status code, hata dönüştürme |
| Service | `<alan>.service.ts` | İş kuralları (yetki kontrolü, doğrulama akışı) |
| Repository | `<alan>.repository.mongo.ts` | MongoDB erişimi (tek gerçek persistence noktası) |
| Types/Validation | `<alan>.types.ts`, `<alan>.validation.ts` | Tip tanımları, request şema doğrulaması |

Bu katmanlaşma sayesinde testler (bkz. [Test](development/testing.md))
repository'yi in-memory bir sahte ile değiştirip gerçek MongoDB olmadan
tüm iş mantığını çalıştırabilir.

Diğer üst düzey dizinler:

- `backend/src/config/` — ortam değişkeni okuma (`env.ts`), DB bağlantısı (`db.ts`)
- `backend/src/middleware/` — JWT doğrulama, izin kontrolü, rate limiting, hata işleyiciler
- `backend/src/docs/` — Swagger/OpenAPI üretimi (bkz. [Backend API](backend-api.md))
- `backend/src/legacy/` — geriye dönük uyumluluk için korunan eski uçlar
- `backend/src/tests/` + `backend/src/tests/support/` — Vitest suite'i ve in-memory sahte repository'ler

## Frontend katmanları (`dashboard/src/`)

Ayrıntı için bkz. [Frontend / Dashboard](frontend.md). Özetle: `routes/`
(React Router tanımları + `requireAuth`/`requirePermission` koruma
bileşenleri), `store/` (Redux Toolkit slice'ları), `services/` (API
istemcisi), `components/` (alan bazlı UI, örn. `dictionary/`, `users/`,
`auth/`, `settings/`, `theme/`).

## Servisler arası iletişim

- **Geliştirme (hot reload):** Vite'ın kendi dev-server proxy'si
  (`vite.config.ts`) `/api` isteklerini backend'e yönlendirir; dashboard
  kodu her zaman relative path (`/api/v1/...`) kullanır,
  `VITE_API_BASE_URL` dev'de kasıtlı olarak yok sayılır.
- **Production build:** `VITE_API_BASE_URL` build-time env değişkeni
  (bkz. `dashboard/src/utils/index.tsx`) backend'in gerçek adresini
  belirler — istemci artık bir dev-server proxy'sinin arkasında değildir.
- **Docker (geliştirme):** `docker-compose.yml`, backend'i
  `dictionary-backend` servis adıyla dahili DNS'te yayınlar; dashboard
  container'ı `VITE_DEV_API_PROXY_TARGET=http://dictionary-backend:3001`
  ile bu adı kullanır.
- **Docker (production):** `docker-compose.prod.yml`, `nginx` (dashboard
  imajı içinde) statik dosyaları servis eder; backend ayrı bir container/
  imaj olarak `healthcheck` ile ayağa kalkar, dashboard `depends_on:
  condition: service_healthy` ile ona bağımlıdır.

## Veritabanı

MongoDB bu proje tarafından **hiçbir zaman containerize edilmez veya
yönetilmez** — `backend/.env`'deki `MONGODB_URI` neyi gösteriyorsa oraya
bağlanır (host makine, LAN'daki başka bir sunucu, vb.). Docker
modunda bu genellikle Docker'ın `host.docker.internal` DNS takma adıyla
host makineye yönlendirilir (bkz. `docker-compose.yml`/
`docker-compose.prod.yml`'deki `extra_hosts`).

## Dağıtım/CI ile ilişki

Docker imajları ve `docker compose` doğrulaması yalnızca CI'da
YEREL DOĞRULAMA amacıyla build edilir, hiçbir registry'ye push edilmez
(bkz. [Git ve CI](development/git-ci.md)). Gerçek production kurulumu
`scripts/windows/install.ps1` / `scripts/linux/install.sh` üzerinden,
CI'dan tamamen bağımsız olarak yapılır (bkz.
[Kurulum / Güncelleme / Kaldırma](deployment/installation.md)).
