# IQV Dictionary

IQV Dictionary, Türkçe/İngilizce endüstriyel terminoloji sözlüğü ve
personel yönetim paneli: **React + Ant Design** tabanlı bir dashboard
(`dashboard/`) ve **Express + MongoDB** tabanlı bir API (`backend/`)
içerir.

Bu README, projeyi production seviyesinde **tek komutla** kurmak/
güncellemek/kaldırmak için gereken her şeyi anlatır. Geliştirici
dokümantasyonu (Git/CI, testler, performans) için `docs/` klasörüne ve
`mkdocs serve` ile üretilen siteye bakın.

## Requirements

| Bileşen | Docker modu | Native (Docker'sız) mod |
|---|---|---|
| [Docker](https://docs.docker.com/get-docker/) + Compose v2 | ✅ gerekli | — |
| [Node.js 20+](https://nodejs.org/) (npm + corepack ile birlikte gelir) | yalnızca script'in kendisi için | ✅ gerekli |
| [pnpm](https://pnpm.io/) | — | `corepack` ile install script'i otomatik etkinleştirir |
| [PM2](https://pm2.keymetrics.dev/) | — | install script'i otomatik kurar |
| Çalışan bir **MongoDB** örneği | ✅ (dışarıda — bkz. aşağıda) | ✅ (dışarıda) |

IQV Dictionary, MongoDB'yi **kendi başına kurmaz/containerize etmez** —
`backend/.env`'deki `MONGODB_URI` neyi gösteriyorsa oraya bağlanır
(varsayılan: host makinede/LAN'da çalışan bir MongoDB, `127.0.0.1:27017`).

## Quick Start

```powershell
# Windows
.\scripts\windows\install.ps1
```

```bash
# Linux
chmod +x ./scripts/linux/*.sh
./scripts/linux/install.sh
```

Bu tek komut: gerekli `.env` dosyalarını (yoksa, güvenli üretilmiş bir
`JWT_SECRET` ile) oluşturur, Docker'ın mevcut olup olmadığını algılar,
backend + dashboard'u production modda derler/başlatır ve
`/health` ile gerçek bir healthcheck yapar. Kurulum bittiğinde:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:8080` (Docker) veya `http://localhost:5173` (Native)

## Installation

`install.ps1`/`install.sh`, `-Mode`/`--mode` parametresiyle çalışma
modunu seçer:

```powershell
.\scripts\windows\install.ps1 -Mode auto     # varsayılan: Docker varsa Docker, yoksa native
.\scripts\windows\install.ps1 -Mode docker   # Docker'ı zorla
.\scripts\windows\install.ps1 -Mode native   # Native'i zorla (Docker'sız)
```

```bash
./scripts/linux/install.sh --mode auto
./scripts/linux/install.sh --mode docker
./scripts/linux/install.sh --mode native
```

`auto` modunda script Docker'ın gerçekten çalışır durumda olup
olmadığını kontrol eder (`docker info` + `docker compose version`) ve
kararını her zaman loglar:

```text
[INFO] Docker detected.
[INFO] Installation mode: docker
```

Script'ler **idempotent**tir — ikinci kez çalıştırmak var olan `.env`
dosyalarını, container'ları veya PM2 process'lerini bozmaz, yalnızca
gerekeni günceller.

### Docker Installation

`docker-compose.prod.yml` (repo kökü) gerçek production imajlarını
kullanır: `backend/Dockerfile.prod` (derlenmiş `dist/`, `node
dist/server.js` — asla `npm run dev`) ve `dashboard/Dockerfile.prod`
(derlenmiş statik `dist/`, nginx ile servis edilir — asla Vite dev
server). Bu, mevcut `docker-compose.yml` (bind-mount + hot-reload
geliştirme ortamı, `docker compose up -d`) ile **karışmaz**; o dosya
hiç değiştirilmedi ve olduğu gibi çalışmaya devam ediyor.

Portlar ve frontend'in build-time API adresi kök `.env` dosyasından
okunur (yoksa `.env.example`'dan otomatik oluşturulur):
`IQV_BACKEND_PORT` (varsayılan `3001`), `IQV_FRONTEND_PORT` (varsayılan
`8080`), `VITE_API_BASE_URL`.

### Native Installation

Docker olmadan: backend `npm ci && npm run build` ile derlenir, dashboard
`pnpm install --frozen-lockfile && pnpm run build` ile derlenir, ikisi
de **PM2** (`scripts/common/ecosystem.config.js`) altında çalıştırılır —
backend derlenmiş `dist/server.js`'i, frontend ise bağımlılıksız bir
statik dosya sunucusunu (`scripts/common/static-server.mjs`, SPA
fallback'li — Docker imajındaki nginx'in native karşılığı) servis eder.

Terminal kapatılsa/bilgisayar yeniden başlasa bile IQV Dictionary
otomatik ayağa kalkar:

- **Windows** — `pm2-windows-startup` (admin gerektirmez, oturum
  açılışında PM2'nin kayıtlı process listesini geri yükler).
- **Linux** — `pm2 startup systemd` (systemd birimi üretir; parolasız
  `sudo` varsa otomatik kurulur, yoksa çalıştırılacak komut ekrana
  basılır).

## Update

```powershell
.\scripts\windows\update.ps1
```

```bash
./scripts/linux/update.sh
```

Akış: kurulu modu (Docker/native) `.iqv-install/state.json`'dan tespit
eder → `git fetch` + **fast-forward-only** `git pull` → değişen
dosyalara göre yalnızca gerekeni yeniden kurar/derler/yeniden başlatır
→ healthcheck → sürüm geçişini raporlar:

```text
IQV Dictionary
Current version : 1.1.0
Target version  : 1.2.0
...
[OK] IQV Dictionary updated successfully.
Version: 1.2.0
```

**Güvenlik:** çalışma dizininde commit edilmemiş değişiklikler varsa
(`git status` temiz değilse) update **iptal edilir** —
`git reset --hard` / `git clean -fd` / `git checkout .` script'lerin
HİÇBİRİNDE kullanılmaz, hiçbir yerel değişiklik sessizce silinmez.
Ayrıntılar için [docs/deployment/installation.md](docs/deployment/installation.md).

## Uninstall

```powershell
.\scripts\windows\uninstall.ps1                      # servisleri/container'ları durdur, kaynak kodu KORU
.\scripts\windows\uninstall.ps1 -Purge                # + node_modules/dist/imajlar/.env dosyaları
.\scripts\windows\uninstall.ps1 -Purge -RemoveSource   # + TÜM repository (ekstra onay ister)
```

```bash
./scripts/linux/uninstall.sh
./scripts/linux/uninstall.sh --purge
./scripts/linux/uninstall.sh --purge --remove-source
```

MongoDB bu kurulum tarafından **hiçbir zaman** yönetilmez/silinmez —
zaten bir DB container'ı/volume'u oluşturulmaz. `-PurgeData`/
`--purge-data` bunu açıkça loglar (üretim veritabanına dokunulmadığını
teyit eden bir no-op'tur).

## Version Management

Tek kaynak-doğrusu repo kökündeki **`VERSION`** dosyasıdır (düz metin,
örn. `1.1.0`). `backend/package.json` ve `dashboard/package.json`'daki
`version` alanları her alt projenin kendi bağımsız modül sürümüdür ve
değiştirilmedi — install/update script'leri "Current version"/"Target
version" için yalnızca `VERSION`'ı okur.

## Health Check

Install/update, yalnızca process ayakta diye başarı saymaz — gerçek
HTTP healthcheck yapar:

```text
[CHECK] Backend ........ OK
[CHECK] Frontend ....... OK
[CHECK] Docker ......... OK
[CHECK] Health .......... OK
IQV Dictionary installation completed successfully.
```

Backend: `GET /health` (`backend/src/app.ts`, `{"success":true,"data":{"status":"ok"}}`).
Frontend: kök `/` üzerinden HTTP 2xx/3xx doğrulaması.

## API Documentation

Swagger UI (standart, native görünüm; gruplama betiği yalnızca
TOTAL/INTERNAL/EXTERNAL/SYSTEM üst başlıklarını toplar, gerçek operasyon
listesini/renklerini değiştirmez), backend tarafından
(`swagger-ui-express`) servis edilir. Geliştirmede erişim, önceki gibi
Vite dev sunucusu (5173) üzerinden aynı origin'de kalır — Vite bu isteği
sunucu tarafında gerçek backend'e iletir:

```text
http://localhost:5173/api-docs
```

Ağdaki başka bir cihazdan (Vite zaten `0.0.0.0` üzerinde dinliyor):

```text
http://<host-ip>:5173/api-docs
```

Production'da frontend (nginx, statik dosya sunucusu) API trafiğini
proxy'lemez — mevcut, değişmemiş davranış gereği tarayıcı zaten
`VITE_API_BASE_URL` üzerinden doğrudan backend'e gider (bkz. "Environment
Variables"); Swagger de aynı şekilde backend'in kendi portundan (varsayılan
`3001`, bkz. `IQV_BACKEND_PORT`) doğrudan erişilir: `http://<host>:3001/api-docs`.

Tek kaynak-doğrusu OpenAPI 3.0.3 dosyası: `backend/docs/openapi.yaml`
(gerçek backend route/controller/validation kodundan çıkarılmıştır; her
operasyon `x-iqv-classification` — INTERNAL/EXTERNAL/SYSTEM — ve
`x-iqv-domain` uzantı alanlarıyla etiketlenmiştir). Ham JSON hâli her zaman
`GET /openapi.json`'dan (aynı origin üzerinden, ör. `http://localhost:5173/openapi.json`)
gerçek JSON olarak döner — hiçbir zaman HTML değildir. "Try it out"
istekleri, mevcut Vite dev proxy'si üzerinden gerçek backend'e gider —
IP/port hiçbir yerde hardcode edilmemiştir.

## Environment Variables

| Dosya | Kim oluşturur | İçerik |
|---|---|---|
| `backend/.env` | Yoksa install script'i `.env.example`'dan, **rastgele üretilmiş bir `JWT_SECRET`** ile oluşturur | `PORT`, `MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET`, `CORS_ORIGIN`, ... |
| `dashboard/.env` | Yoksa install script'i `.env.example`'dan oluşturur | `VITE_API_BASE_URL` |
| `.env` (repo kökü) | Yoksa install script'i `.env.example`'dan oluşturur — yalnızca Docker modunda kullanılır | `IQV_BACKEND_PORT`, `IQV_FRONTEND_PORT`, `VITE_API_BASE_URL` |

Gerçek secret'lar hiçbir zaman `.env.example` dosyalarına yazılmaz;
sadece değişken ADLARI belgelenir (bkz. her dosyanın kendisi).

## Troubleshooting

- **`Docker/Docker Compose not available, but -Mode docker was requested`**
  — Docker Desktop/Engine kurulu ve ÇALIŞIYOR olmalı (`docker info`
  başarılı dönmeli).
- **`Local modifications detected... Update aborted`** — `git status
  --short` ile değişiklikleri görün, commit/stash edin, tekrar deneyin.
- **Backend healthcheck FAIL** — `backend/.env`'deki `MONGODB_URI`'nin
  gerçekten erişilebilir bir MongoDB'ye işaret ettiğinden emin olun
  (Docker modunda bu, host'un `host.docker.internal`'da dinlediği
  anlamına gelir).
- **Loglar** — Docker: `docker compose -f docker-compose.prod.yml logs -f`.
  Native: `pm2 logs`.
- Daha fazlası için [docs/deployment/installation.md](docs/deployment/installation.md).

## Developer Mode

Mevcut geliştirici deneyimi hiç değişmedi — backend ve frontend hâlâ ayrı
paket yöneticileriyle (backend: npm, dashboard: pnpm), ayrı `dev`
script'leriyle çalışır:

```bash
cd backend  && npm ci   && npm run dev     # http://localhost:3001
cd dashboard && pnpm install --frozen-lockfile && pnpm run dev   # http://localhost:5173
```

**Önemli:** Frontend (Vite, 5173) `/api`, `/api-docs`, `/openapi.json` ve
`/health` isteklerini backend'e (3001) proxy'ler — backend çalışmıyorsa bu
istekler `ECONNREFUSED` verir. Sadece `dashboard> npm run dev` çalıştırıp
`backend> npm run dev`'i unutmak bunun en sık nedenidir.

Bu iki komutu iki ayrı terminalde unutmadan çalıştırmak yerine, repo
kökünden tek komutla ikisini birlikte başlatabilirsiniz (yeni bir bağımlılık
eklemez, sadece mevcut `backend`/`dashboard` `dev` script'lerini birlikte
çalıştırır — bkz. `scripts/common/dev.js`):

```bash
npm run dev   # backend (3001) + frontend (5173) aynı anda, Ctrl+C ikisini de kapatır
```

veya Docker ile hot-reload (bind-mount, dosya kaydettiğinizde anında
yansır):

```bash
docker compose up -d
```

## Production Mode

Yukarıdaki [Quick Start](#quick-start) / [Installation](#installation)
bölümlerine bakın — production'da hiçbir zaman `npm run dev`/`pnpm run
dev` çalıştırılmaz; her zaman derlenmiş bir build (`node
dist/server.js`, statik `dashboard/dist`) servis edilir.

## Directory Structure

```text
Dictionary/
├── backend/                 # Express + MongoDB API
│   ├── Dockerfile            # geliştirme (hot reload, docker-compose.yml)
│   ├── Dockerfile.prod        # PRODUCTION (docker-compose.prod.yml)
│   └── src/
├── dashboard/                # React + Ant Design frontend
│   ├── Dockerfile            # geliştirme (hot reload, docker-compose.yml)
│   ├── Dockerfile.prod        # PRODUCTION (docker-compose.prod.yml)
│   ├── nginx.conf             # yalnızca Dockerfile.prod kullanır
│   └── src/
├── scripts/
│   ├── windows/               # install.ps1 / update.ps1 / uninstall.ps1 / lib.psm1
│   ├── linux/                 # install.sh / update.sh / uninstall.sh / lib.sh
│   └── common/                # ecosystem.config.js (PM2), static-server.mjs
├── docs/                     # MkDocs kaynağı (`mkdocs serve`)
├── docker-compose.yml         # geliştirme (bind-mount, hot reload) — DEĞİŞMEDİ
├── docker-compose.prod.yml    # PRODUCTION (bu README'nin kurduğu sistem)
├── VERSION                   # tek sürüm kaynak-doğrusu (bkz. Version Management)
├── .env.example               # yalnızca docker-compose.prod.yml için (port/build-arg)
└── package.json               # kök: yalnızca `npm run docker:*` kısayolları — kurulum mantığı scripts/ altında
```

## Feedback

Sorunlar/öneriler için thumbs-down veya proje deposu üzerinden geri
bildirim verin.
