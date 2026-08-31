# Git ve CI

## Amaç

Bu sayfa, Dictionary projesinin Git/CI hazırlığı sırasında (2026-08-30) kurulan
gerçek, çalışan CI pipeline'ını belgeler. Burada anlatılan HER adım
`.github/workflows/ci.yml` içinde gerçekten tanımlıdır — uydurulmuş
veya "planlanan" bir adım yoktur.

## CI Platformu

Proje **GitHub Actions** kullanır (`origin` remote'u GitHub'dadır,
`.github/workflows/` ve `.github/dependabot.yml` zaten mevcuttu).
Uygulama kodu (backend/dashboard/Docker/k6/scripts) ile dokümantasyon
(MkDocs) build'i **iki ayrı workflow dosyasına** bölünmüştür — Actions
ekranında iki bağımsız workflow olarak görünsünler ve birbirini
GEREKSİZ YERE tetiklemesinler diye:

| Workflow dosyası | Actions ekranındaki adı | Kapsam |
|---|---|---|
| `.github/workflows/ci.yml` | **IQV Dictionary CI** | backend, dashboard, Docker doğrulama, k6, script lint, Quality Pipeline |
| `.github/workflows/docs.yml` | **IQV Dictionary Docs** | yalnızca `mkdocs build --strict` + site artifact'i |

MkDocs işlemleri `ci.yml` içine TAŞINMAZ — bu sayfanın geri kalanı
yalnızca `ci.yml`'i belgeler; `docs.yml` için bkz. aşağıdaki
"Docs Workflow" bölümü.

## Branch Stratejisi

- **Ana branch:** `main` (repoda tek branch, `origin/main`'i izliyor).
- CI, `main`'e açılan `pull_request`'lerde ve `main`'e doğrudan `push`'larda
  tetiklenir.
- Yük/stres (k6 load/stress) testleri her push'ta ÇALIŞMAZ — yalnızca
  manuel `workflow_dispatch` ile (`run_k6_load_test: true` girdisiyle)
  tetiklenir.

## Local Pre-Commit Kontrolleri (önerilen)

Bir commit'ten önce, geliştiricinin kendi makinesinde manuel olarak
çalıştırması önerilen komutlar (CI'nın aynısı, yerelde):

```bash
# dashboard/ (pnpm)
pnpm run typecheck && pnpm run lint && pnpm run prettier && pnpm test

# backend/ (npm)
npm run typecheck && npm run lint && npm run prettier && npm test
```

## CI Pipeline Aşamaları (`ci.yml` içindeki gerçek, tanımlı job'lar)

| Job | Ne yapar | Ne zaman çalışır |
|---|---|---|
| `frontend` | `dashboard/`: `pnpm install --frozen-lockfile` → typecheck → lint → prettier → test → coverage → build | her push/PR |
| `backend` | `backend/`: `npm ci` → typecheck → lint → prettier → test → coverage → build → `/health` duman testi | her push/PR |
| `k6-smoke` | `backend` job'undan sonra, in-memory test sunucusuna karşı kısa k6 smoke script'leri | her push/PR |
| `docker-build` | `frontend`+`backend` job'larından sonra: iki DEV Dockerfile (`backend/Dockerfile`, `dashboard/Dockerfile`) + iki PRODUCTION Dockerfile (`backend/Dockerfile.prod`, `dashboard/Dockerfile.prod`) için yerel `docker build` (registry'ye PUSH YOK) + `docker-compose.yml` VE `docker-compose.prod.yml` için `docker compose config` doğrulaması (CI-only, placeholder `backend/.env` ile — bkz. [Sorun Giderme](../troubleshooting.md)) | her push/PR |
| `scripts-lint` | `scripts/linux/*.sh` için `bash -n`, `scripts/windows/*.ps1`/`*.psm1` için gerçek PowerShell parser doğrulaması (`[System.Management.Automation.Language.Parser]::ParseFile`, `pwsh` GitHub-hosted runner'da hazır gelir) | her push/PR |
| `k6-load-stress` | Uzun, yüksek VU'lu k6 yük/stres testleri | yalnızca manuel `workflow_dispatch` |
| `quality-pipeline` | Yukarıdaki job'ların GERÇEK sonuçlarını toplayıp 100 puanlık bir kalite raporu (`REPORT.md`/`REPORT.json`/`QUALITY.svg`) üretir ve strict gate'i uygular — bkz. aşağıdaki "Quality Pipeline" bölümü | her push/PR, `if: always()` |

Sıralama, ucuz kontrollerin (install/typecheck/lint/test) önce, pahalı
olanların (build/Docker/k6) sonra çalışacağı şekilde kuruldu (fail-fast).
MkDocs build'i burada DEĞİL, ayrı `docs.yml` workflow'undadır (aşağıya
bakın).

## Docs Workflow (`docs.yml` — "IQV Dictionary Docs")

`.github/workflows/docs.yml`, Actions ekranında **ayrı, bağımsız bir
workflow** olarak görünür (adı tam olarak `IQV Dictionary Docs`).
İçeriği: Python kurulumu → `pip install -r requirements-docs.txt` →
`mkdocs build --strict` → derlenen `site/`'ı `iqv-dictionary-docs-site`
artifact'i olarak yükleme. Hiçbir yere (GitHub Pages dahil) deploy
ETMEZ — yalnızca dokümantasyonun bozulmadığını doğrular.

Tetikleyiciler: `push`/`pull_request` (yalnızca `docs/**`,
`mkdocs.yml`, `requirements-docs.txt` değiştiğinde — backend/dashboard
kod değişikliklerinde gereksiz yere çalışmasın diye) VE
`workflow_dispatch` (elle, herhangi bir zamanda tetiklenebilir —
workflow'un Actions ekranında görünür/keşfedilebilir kalmasını da
sağlar, `paths` filtresine takılıp hiç çalışmadığı bir durum oluşmaz).

## Quality Pipeline

`quality-pipeline` job'u, yukarıdaki tüm zorunlu job'ların
`needs.*.result` değerlerini toplar ve `scripts/ci/generate-quality-report.mjs`
ile 100 puanlık bir rapor üretir (Backend 30, Dashboard 30, Docker 15,
k6 Smoke 15, Scripts 10). **Skor yalnızca raporlama içindir** — gerçek
bir zorunlu aşama FAIL/iptal/beklenmedik-skip olduğunda sonuç HER ZAMAN
`FAILED`dir (strict gate, skor ile yumuşatılamaz). Rapor `if: always()`
ile önceki aşamalardan biri FAIL olsa bile üretilir ve
`iqv-dictionary-quality-report` artifact'i olarak yüklenir.

## Node.js Sürümü

CI, `Node 20.x` kullanır (`actions/setup-node@v4`) — bu, her iki
`Dockerfile`'ın (`FROM node:20-alpine`) zaten kullandığı sürümle
BİREBİR aynıdır. Eski workflow dosyası `16.x` kullanıyordu; bu, gerçek
Docker imajlarıyla tutarsızdı ve düzeltildi.

## Paket Yöneticisi

**İki alt proje, iki farklı paket yöneticisi kullanır — kasıtlı olarak
farklıdırlar, karıştırılmamalıdır:**

- **`dashboard/` → pnpm.** Kaynak-doğrusu `dashboard/pnpm-lock.yaml`.
  `dashboard/package.json`'daki `"packageManager": "pnpm@9.15.9"` alanı
  bunu corepack'e bildirir. Hem kök hem de `dashboard/` altındaki
  `README.md` zaten baştan beri `pnpm install`/`pnpm run dev`
  talimatları veriyordu. CI'da `pnpm/action-setup@v4` + `pnpm install
  --frozen-lockfile` kullanılır. Stray `dashboard/yarn.lock` dosyası
  (hiçbir yerde kullanılmıyordu) kaldırıldı.
- **`backend/` → npm.** Kaynak-doğrusu `backend/package-lock.json`.
  Backend için ayrı bir `pnpm-lock.yaml`/`yarn.lock` hiç var olmadı.
  CI'da `npm ci` kullanılır.

**Not:** Eski CI workflow dosyası (ve eski `dashboard/Dockerfile`)
yanlışlıkla `npm ci`/`package-lock.json` kullanıyordu — bu, projenin
gerçek pnpm standardına aykırıydı ve bu CI hazırlık geçişinde
düzeltildi (hem workflow hem Dockerfile artık pnpm kullanıyor).
`dashboard/pnpm-lock.yaml` ayrıca `package.json`'la senkron DEĞİLDİ
(vitest/testing-library/jsdom bağımlılıkları lockfile'da eksikti) —
bu da düzeltildi, `pnpm install --frozen-lockfile` artık temiz
çalışıyor.

## Test Veritabanı

CI, **gerçek/üretim MongoDB'sine hiçbir zaman bağlanmaz**. Backend'in
kendi test paketi zaten `src/tests/support/*` altında in-memory sahte
repository'ler kullanıyor (Mongo'nun birebir yerine geçen). CI bu mevcut
deseni AYNEN kullanır — yeni bir test-veritabanı altyapısı (ör. CI
servis konteyneri olarak MongoDB) EKLENMEDİ.

## Docker

`docker-build` job'u dört gerçek `docker build` çalıştırır:
`backend/Dockerfile` + `dashboard/Dockerfile` (geliştirme — hot reload,
`npm run dev`/`pnpm run dev`) ve `backend/Dockerfile.prod` +
`dashboard/Dockerfile.prod` (production — derlenmiş `dist`, `node
dist/server.js` / nginx). Hem `docker-compose.yml` hem
`docker-compose.prod.yml`, `docker compose config` ile doğrulanır.
Hiçbir imaj hiçbir registry'ye push edilmez, hiçbir yere deploy edilmez
(bkz. [Kurulum / Güncelleme / Kaldırma](../deployment/installation.md)
— production kurulum bu Dockerfile.prod'ları `scripts/windows/install.ps1`
/ `scripts/linux/install.sh` üzerinden kullanır, CI'dan değil).

## Ortam Değişkenleri

CI, testler için `NODE_ENV=test` ayarlar. Gerçek bir prod secret'ına
CI'da hiçbir zaman ihtiyaç duyulmaz (in-memory repository'ler `.env`
dosyası olmadan çalışır).
