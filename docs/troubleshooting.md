# Sorun Giderme

Bu sayfa, geliştirme/CI sırasında gerçekten karşılaşılmış ve kök nedeni
kanıtlanmış sorunları ve çözümlerini listeler — spekülatif bir "olası
sorunlar" listesi değildir.

## Backend başlamıyor: `Missing required environment variable: JWT_SECRET`

`backend/src/config/env.ts`'de `JWT_SECRET`'in **fallback değeri yoktur**
— boşsa/atanmamışsa uygulama kasıtlı olarak çöker (güvenlik: varsayılan/
zayıf bir secret'la sessizce çalışmaz). Çözüm: `backend/.env` dosyasını
`backend/.env.example`'dan oluşturup gerçek bir `JWT_SECRET` değeri
girin. **Asla** `.env.example`'daki placeholder'ı (`your-secret-here`)
production'da kullanmayın.

## `docker compose -f docker-compose.yml config` — `env file ... backend/.env not found`

`docker-compose.yml`'deki `dictionary-backend` servisi
`env_file: ./backend/.env` kullanır — bu dosya bilerek Git'e girmez
(gerçek secret'lar commit edilmez). Yerelde ilk kurulumda:

```bash
cp backend/.env.example backend/.env
# sonra backend/.env içindeki değerleri (özellikle JWT_SECRET) düzenleyin
```

CI'da (`.github/workflows/ci.yml`, `docker-build` job'u) bu dosya
runner'ın geçici dosya sisteminde, CI-safe placeholder değerlerle
otomatik oluşturulur — hiçbir gerçek secret içermez, commit edilmez
(bkz. [Git ve CI](development/git-ci.md)).

## `pnpm install` yerine yanlışlıkla `npm install` çalıştırıldı (dashboard)

`dashboard/`'ın kaynak-doğrusu `pnpm-lock.yaml`'dır. `npm install`
çalıştırmak yanlışlıkla bir `package-lock.json` oluşturabilir ve iki
lockfile'ın senkron kalmamasına yol açar. Çözüm: yanlışlıkla oluşan
`package-lock.json`'ı silin, `pnpm install --frozen-lockfile` ile devam
edin. `backend/` ise tam tersi — orada kaynak-doğrusu `npm`'dir.

## `esbuild`/`rollup` native binary hatası ("You installed esbuild for another platform")

`node_modules` bir platformda (ör. Windows) kurulup başka bir işletim
sisteminde/köprüde (ör. Linux) doğrudan çalıştırılmaya çalışılırsa,
platforma özel native binary'ler (`@esbuild/win32-x64` vb.) eşleşmez ve
bu hatayla çöker. Bu bir kod kusuru DEĞİLDİR. Çözüm: `node_modules`'ü
gerçekten çalıştığınız platformda yeniden kurun (`rm -rf node_modules &&
pnpm install --frozen-lockfile` / `npm ci`) — asla bir platformun
`node_modules`'ünü diğerine kopyalamayın.

## Swagger UI (`/api-docs`) LAN IP üzerinden boş sayfa

Kök neden: `helmet()`'in varsayılan Content-Security-Policy'si
`upgrade-insecure-requests` direktifi içerir — bu, `localhost` dışında
(ör. `http://192.168.x.x:5173`) düz HTTP üzerinden erişildiğinde
tarayıcının Swagger'ın kendi CSS/JS'ini HTTPS'e yükseltmeye çalışıp
başarısız olmasına (`net::ERR_BLOCKED_BY_CLIENT`) yol açıyordu. Bu proje
zaten hem dev'de hem production'da düz HTTP servis ettiği için
`backend/src/app.ts`'de yalnızca bu tek direktif kaldırıldı, CSP'nin geri
kalanı korunuyor. Bu hatayı hâlâ görüyorsanız backend'in güncel
`app.ts` ile derlendiğinden emin olun.

## `429 Too Many Requests` — bu bir hata mı?

Hayır, çoğu durumda değil. `/api/*` altındaki tüm uçlar 300 istek/60s
(IP başına) ile sınırlıdır; `POST /api/v1/auth/login` ayrıca kendi 20
istek/5dk limitine sahiptir. Yoğun paralel test/otomasyon çalıştırırken
(bkz. [Performans Testi](development/performance-testing.md)) bu
limitlere hızla ulaşmak normaldir ve rate-limiter'ın **doğru** çalıştığını
gösterir. Gerçek bir uygulama hatası değildir.

## MongoDB'ye bağlanamıyor (`ECONNREFUSED` / bağlantı zaman aşımı)

Proje MongoDB'yi hiçbir zaman containerize etmez/yönetmez —
`backend/.env`'deki `MONGODB_URI` neyi gösteriyorsa oraya bağlanmayı
DENER. Kontrol listesi:

1. MongoDB gerçekten çalışıyor mu (`mongosh`/`mongo` ile bağlanmayı deneyin)?
2. Docker modundaysanız, host'taki Mongo'ya `host.docker.internal`
   üzerinden mi bağlanıyorsunuz (bkz.
   [Kurulum / Güncelleme / Kaldırma](deployment/installation.md))?
3. `MONGODB_URI`'deki port/host doğru mu, güvenlik duvarı 27017'yi
   engelliyor mu?

## `mkdocs build --strict` başarısız oluyor

En sık nedenler: (1) `mkdocs.yml`'in `nav`'ında olup diskte olmayan bir
dosya, (2) bir sayfadaki kırık iç link (`[metin](olmayan-dosya.md)`),
(3) `mkdocs-material`/`mkdocs-static-i18n` sürümleri `requirements-docs.txt`
ile kurulu sürüm arasında uyumsuz. Çözüm: hata mesajındaki dosya/satırı
kontrol edin; yerel olarak `pip install -r requirements-docs.txt &&
mkdocs build --strict` ile aynı hatayı tekrar üretip düzeltin.

## CI'da Docker/Quality Gate FAIL ama yerelde her şey çalışıyor

Önce [Git ve CI](development/git-ci.md) sayfasındaki pipeline
aşamalarına bakın — hangi job'ın FAIL olduğu (`frontend`/`backend`/
`docker-build`/`k6-smoke`/`scripts-lint`) `quality-pipeline` job'unun
ürettiği `REPORT.md` artifact'inde açıkça listelenir. Quality Gate,
skor ne olursa olsun herhangi bir zorunlu aşama gerçekten FAIL/iptal
olduğunda HER ZAMAN `FAILED` döner (skor yalnızca raporlama amaçlıdır) —
bu kasıtlı bir tasarımdır, "gizlice geçirme" mekanizması yoktur.
