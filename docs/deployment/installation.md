# Kurulum / Güncelleme / Kaldırma

Bu sayfa, `scripts/windows/` ve `scripts/linux/` altındaki install/update/
uninstall script'lerinin GERÇEKTE ne yaptığını belgeler — repo kökündeki
`README.md` dosyasının "Quick Start" bölümüyle aynı komutları, burada
daha ayrıntılı anlatır.

## Desteklenen matris

| Platform | Docker | Native (Docker'sız) |
|---|---|---|
| Windows | ✅ `install.ps1 -Mode docker` | ✅ `install.ps1 -Mode native` |
| Linux | ✅ `install.sh --mode docker` | ✅ `install.sh --mode native` |

`-Mode`/`--mode` verilmezse (`auto`), script Docker'ın çalışır durumda
olup olmadığını (`docker info` + `docker compose version`) kontrol eder
ve buna göre otomatik seçer; kararını her zaman loglar
(`[INFO] Installation mode: docker|native`).

## Docker modu ne kurar

- `docker-compose.prod.yml` (repo kökü) — **mevcut** `docker-compose.yml`
  (hot-reload geliştirme ortamı, bind-mount + `npm run dev`/`pnpm run dev`)
  DEĞİŞTİRİLMEDİ ve hâlâ `docker compose up -d` ile çalışıyor.
  `docker-compose.prod.yml` ayrı bir Compose projesi ismiyle
  (`iqv-dictionary-prod`) tamamen production imajlar kullanır:
  `backend/Dockerfile.prod` (multi-stage: `npm ci` + `npm run build` →
  `node dist/server.js`, **asla `npm run dev`**) ve
  `dashboard/Dockerfile.prod` (multi-stage: `pnpm install` + `pnpm run
  build` → statik dosyalar `nginx` ile servis edilir,
  `dashboard/nginx.conf`, **asla Vite dev server**).
- MongoDB'yi containerize ETMEZ — mevcut `docker-compose.yml` gibi,
  uygulamanın zaten dışarıda (host/başka bir sunucu) çalışan MongoDB'sine
  bağlanır (`host.docker.internal`).
- Portlar ve frontend'in build-time API adresi repo kökündeki `.env`
  dosyasından okunur (yoksa `.env.example`'dan otomatik oluşturulur):
  `IQV_BACKEND_PORT` (varsayılan `3001`), `IQV_FRONTEND_PORT` (varsayılan
  `8080`), `VITE_API_BASE_URL`.

## Native mod ne kurar

- Backend: `npm ci` + `npm run build` (derlenmiş `backend/dist/server.js`).
- Dashboard: `corepack` ile `pnpm@9.15.9` etkinleştirilir, `pnpm install
  --frozen-lockfile` + `pnpm run build` (statik `dashboard/dist`).
- Süreç yönetimi: her iki platformda da **PM2**
  (`scripts/common/ecosystem.config.js`) — aynı iş mantığı,
  Windows/Linux arasında fark yok:
  - Backend: `node dist/server.js` (PM2 altında, `autorestart`).
  - Frontend: `dashboard/dist`'i servis eden, bağımlılıksız, projeye özel
    statik dosya sunucusu (`scripts/common/static-server.mjs`) — Docker
    imajındaki nginx'in native karşılığı; Windows'a ayrıca nginx kurmayı
    gerektirmez.
- Reboot/oturum açılışında otomatik başlatma:
  - **Windows:** `pm2-windows-startup` (`pm2-startup install`) —
    admin gerektirmez, PM2'nin kayıtlı process listesini oturum
    açılışında geri yükler.
  - **Linux:** `pm2 startup systemd` — systemd birimi üretir; script bunu
    parolasız `sudo` varsa otomatik kurar, yoksa çalıştırılacak tam
    komutu ekrana basar (script asla parola bekleyip takılı kalmaz).

## Idempotency

`install.ps1`/`install.sh` ikinci kez çalıştırıldığında:

- Var olan `backend/.env` / `dashboard/.env` / kök `.env` DOKUNULMADAN
  bırakılır (`[OK] ... already exists`).
- Docker modunda `docker compose up -d` var olan container'ları sadece
  gerekiyorsa yeniden oluşturur.
- Native modda `pm2 startOrReload` var olan process'leri idempotent şekilde
  günceller (yeniden yeniden process YARATMAZ).

## Update akışı (Bölüm 10-14, IQVizyon kural seti)

1. Kurulum modu tespiti — `.iqv-install/state.json`'dan (yoksa çalışan
   container/PM2 process'lerinden best-effort tespit).
2. Git repo mu kontrolü.
3. **Dirty tree kontrolü — `git status --porcelain` boş değilse update
   GÜVENLİ ŞEKİLDE İPTAL EDİLİR** (`[ERROR] Local modifications
   detected...`). `git reset --hard` / `git clean -fd` / `git checkout .`
   script'lerin HİÇBİRİNDE kullanılmaz.
4. `git fetch origin <branch>` + `git pull --ff-only` (diverge varsa
   güvenli şekilde başarısız olur, hiçbir şeyi ezmez).
5. `VERSION` dosyasından "Current version" / "Target version" loglanır.
6. `git diff --name-only <eski-sha> <yeni-sha>` ile DEĞİŞEN dosyalar
   incelenir ve buna göre:
   - `backend/package.json`/`package-lock.json` değiştiyse → `npm ci`
   - `backend/src|scripts` değiştiyse → backend yeniden derlenir
   - `backend/Dockerfile*` / `docker-compose*.yml` değiştiyse → Docker
     imajı yeniden build edilir
   - `dashboard/package.json`/`pnpm-lock.yaml` değiştiyse → `pnpm
     install --frozen-lockfile`
   - `dashboard/src|vite.config.ts|...` değiştiyse → dashboard yeniden
     build edilir
   - `backend/scripts/*migrat*|*rename*` gibi migration-benzeri dosyalar
     değiştiyse → OTOMATİK ÇALIŞTIRILMAZ (veri güvenliği), yalnızca
     `[WARN]` ile kullanıcıya elle gözden geçirmesi hatırlatılır.
7. Docker: `docker compose ... up -d` (yalnızca gerekliyse rebuild).
   Native: `pm2 startOrReload`/`pm2 restart` + `pm2 save`.
8. Healthcheck (`/health` + frontend kök) — biri bile FAIL ise script
   hata koduyla çıkar.
9. `.iqv-install/state.json` güncellenir (`updatedAt`, `version`).

## Uninstall / Purge / Purge-Data (Bölüm 15-17)

| Komut | Ne yapar |
|---|---|
| `uninstall.ps1` / `uninstall.sh` | Container'ları veya PM2 process'lerini durdurur/kaldırır. Kaynak kod, `node_modules`, `dist`, `.env` dosyaları DOKUNULMADAN kalır. |
| `-Purge` / `--purge` | Yukarıya ek: `node_modules`, `dist`, üretilen `.env` dosyaları, Docker prod imajları, `.iqv-install/` durum dizini silinir. |
| `-Purge -RemoveSource` / `--purge --remove-source` | Yukarıya ek: **tüm repository** silinir. Script kendi çalıştığı dizini senkron silemeyeceği için, arka planda ayrı bir temizlik script'i (`$TEMP`/`/tmp`'te) zamanlar ve bu script birkaç saniye sonra klasörü siler. Ekstra bir onay (`yes` yazmanız veya `-Yes`/`--yes`) istenir. |
| `-PurgeData` / `--purge-data` | MongoDB bu kurulum tarafından hiç yönetilmediği (harici DB) için **hiçbir veri silmez** — yalnızca bunu açıkça loglar. |

Varsayılan (bayraksız) `uninstall`, üretim veritabanını **asla** silmez —
zaten hiçbir zaman bir DB container/volume'u oluşturmaz.

## Version mekanizması

Tek kaynak-doğrusu: repo kökündeki **`VERSION`** dosyası (düz metin,
örn. `1.1.0`). `backend/package.json` (`1.0.0`) ve `dashboard/package.json`
(`1.1.0`), her alt projenin KENDİ bağımsız modül sürümüdür ve
DEĞİŞTİRİLMEDİ — install/update script'leri "Current version"/"Target
version" için yalnızca `VERSION`'ı okur, ikinci bir sürüm dosyası daha
icat edilmedi.

## Kurulum durumu (state) dosyası

`.iqv-install/state.json` (Git'e girmez — bkz. `.gitignore`):

```json
{
  "mode": "docker",
  "version": "1.1.0",
  "installPath": "/path/to/Dictionary",
  "installedAt": "2026-08-31T06:00:00Z",
  "updatedAt": "2026-08-31T06:00:00Z",
  "services": { "backend": "iqv-dictionary-backend-prod", "frontend": "iqv-dictionary-frontend-prod" },
  "ports": { "backend": 3001, "frontend": 8080 }
}
```

Hiçbir secret/token/parola bu dosyaya YAZILMAZ.
