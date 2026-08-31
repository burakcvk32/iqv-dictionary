# Sürüm Kontrol Listesi

Bir sürümü etiketlemeden/main'e merge etmeden önce, aşağıdaki maddelerin
TAMAMI doğrulanmalıdır. Bu liste, gerçekten kurulu olan CI pipeline'ıyla
(bkz. [Git ve CI](git-ci.md)) BİREBİR eşleşir — genel bir şablon değildir.

## Git

- [ ] `git status --short` temiz veya tüm değişiklikler açıklanabilir
- [ ] `.env`, `.env.local` gibi gerçek secret içeren dosyalar `git status`'ta
      GÖRÜNMÜYOR (gitignore'lanmış)
- [ ] Yeni eklenen dosyalarda gerçek secret/şifre/token YOK (bkz. aşağıdaki
      "Güvenlik" maddesi)
- [ ] `node_modules/`, `dist/`, `coverage/`, ham k6 JSON çıktıları Git'e
      girmiyor

## Frontend (`dashboard/`, pnpm)

- [ ] `pnpm run typecheck` — 0 hata
- [ ] `pnpm run lint` — 0 hata
- [ ] `pnpm run prettier` — 0 fark
- [ ] `pnpm test` — tüm testler PASS
- [ ] `pnpm run test:coverage` — coverage raporu üretiliyor
- [ ] `pnpm run build` — production build başarıyla tamamlanıyor

## Backend (`backend/`, npm)

- [ ] `npm run typecheck` — 0 hata
- [ ] `npm run lint` — 0 hata
- [ ] `npm run prettier` — 0 fark
- [ ] `npm test` — tüm testler PASS (auth, authz, dictionary, personnel,
      audit log, resilience)
- [ ] `npm run test:coverage` — coverage raporu üretiliyor
- [ ] `npm run build` — `dist/` başarıyla üretiliyor
- [ ] `/health` ucu, in-memory test sunucusuyla 200 dönüyor

## Güvenlik

- [ ] Auth/authorization/self-privilege-escalation regresyon testleri
      PASS (bkz. [Test](testing.md))
- [ ] Audit log sızıntı testleri PASS (parola/token log'a YAZILMIYOR)
- [ ] Deep secret scan: `.env`, config, Docker, source, test, docs,
      README, script dosyalarında gerçek JWT secret/Mongo URI (kimlik
      bilgili)/parola/token/API key YOK
- [ ] `.env.example` dosyaları güncel (gerçek değişken ADLARI var,
      gerçek DEĞERLER yok)

## Docker

- [ ] `docker build ./backend` başarılı
- [ ] `docker build ./dashboard` başarılı
- [ ] `docker compose config` geçerli (syntax/merge hatası yok)
- [ ] Hiçbir imajda gömülü secret YOK

## k6

- [ ] Smoke testleri (`k6-smoke` job'u) PASS
- [ ] (Yalnızca gerekiyorsa, manuel) load/stress testleri çalıştırıldı ve
      sonuçlar gözden geçirildi — üretime karşı ÇALIŞTIRILMADI

## MkDocs

- [ ] `mkdocs build --strict` hatasız tamamlanıyor
- [ ] Yeni sayfalar `mkdocs.yml`'in `nav`'ında görünüyor

## Deployment (`scripts/`, `docker-compose.prod.yml`)

- [ ] `VERSION` dosyası, bu sürüm için güncellendi (install/update
      script'lerinin logladığı "Current version"/"Target version" tek
      kaynak-doğrusu — bkz.
      [Kurulum / Güncelleme / Kaldırma](../deployment/installation.md))
- [ ] `bash -n scripts/linux/*.sh` — syntax hatası yok
- [ ] PowerShell parser doğrulaması (CI `scripts-lint` job'u, veya yerelde
      `pwsh`: `[System.Management.Automation.Language.Parser]::ParseFile(...)`)
      `scripts/windows/*.ps1`/`*.psm1` için hatasız
- [ ] `docker compose -f docker-compose.prod.yml config` geçerli
- [ ] `docker build -f backend/Dockerfile.prod ./backend` başarılı
- [ ] `docker build -f dashboard/Dockerfile.prod ./dashboard` başarılı
- [ ] `docker-compose.yml` (geliştirme) DOKUNULMADI/bozulmadı — hâlâ
      `docker compose up -d` ile hot-reload çalışıyor

## Test Verisi Temizliği

- [ ] k6/test çalıştırmalarından kalan `K6_` önekli veriler yalnızca
      in-memory olduğu için otomatik temizlendi (ayrı bir cleanup adımı
      GEREKMEZ) — gerçek bir DB'ye karşı manuel test yapıldıysa, o
      DB'deki `K6_`/test verisi elle temizlenmeli
