# Performans Testi (k6)

## Test Ortamı

k6 testleri **üretime karşı ASLA çalıştırılmaz.** Hem yerel doğrulamada
hem de CI'da (`k6-smoke` / `k6-load-stress` job'ları), backend'in kendi
`tests/performance/server/k6TestServer.ts` dosyasıyla ayağa kaldırılan,
gerçek `createApp()` + in-memory sahte repository'lerden oluşan bir
sunucuya karşı çalışırlar (bkz. [Test](testing.md) sayfasındaki
"Test veritabanı mantığı" bölümü — aynı in-memory desen).

**Bu ne ölçer:** routing + middleware (helmet/cors/rate-limit) + JWT
auth + validation + iş mantığı katmanının gerçek performansı.
**Bu ne ÖLÇMEZ:** MongoDB I/O gecikmesi. Sayılar üretim-eşdeğeri
DEĞİLDİR — yalnızca uygulama kodunun kendi katmanı hakkında gerçek bilgi
verir. Ayrıntılı, gerçekten çalıştırılmış sonuçlar için
[Performans Raporu](../testing/PERFORMANCE_REPORT.md)'na bakın.

## "Asla Üretime Karşı Çalıştırma" Kuralı

- k6 script'leri varsayılan olarak `http://127.0.0.1:4001` (in-memory
  test sunucusu) hedefler (`BASE_URL` ortam değişkeni).
- CI pipeline'ında `BASE_URL` hiçbir zaman gerçek/staging/production bir
  adrese ayarlanmaz.
- Kullanılan test kullanıcısı ve tüm sözlük kayıtları `K6_` önekiyle
  işaretlidir — gerçek veriyle asla karışmaz ve in-memory olduğu için
  süreç kapanınca otomatik temizlenir.

## Smoke vs. Load/Stress

| Seviye | Ne zaman çalışır | VU/Süre | Script'ler |
|---|---|---|---|
| **Smoke** | Her push/PR (`k6-smoke` job'u) | 1 VU, kısa | `auth-smoke.js`, `dictionary-read.js`, `dictionary-crud.js`, `personnel-read.js` |
| **Load/Stress** | Yalnızca manuel (`workflow_dispatch`, `run_k6_load_test: true`) | 10-100 VU, 30-60s | `dictionary-read.js`, `auth-smoke.js` |

Smoke testleri her commit'te hızlı bir "kırık mı değil mi" sinyali
verir; load/stress testleri daha uzun sürdüğü ve gürültülü
(rate-limiter'ı kasıtlı olarak doyurduğu) için her push'ta ÇALIŞMAZ.

## VU/Süre Mantığı

Script'ler `__ENV.VUS` / `__ENV.DURATION` ile parametrize edilebilir
(varsayılanlar script içinde tanımlı, genellikle 1 VU / 6-10s smoke
için). Load testi için gerçekten çalıştırılan konfigürasyon: staged
10 → 25 → 50 VU, toplam 60s (bkz. Performans Raporu Bölüm 3).

## Sonuç Metrikleri

k6'nın standart çıktısı şu metrikleri içerir:

- `http_reqs` — toplam istek sayısı ve req/s
- `http_req_duration` — `avg`/`med`/`p90`/`p95`/`max` gecikme
- `http_req_failed` — k6'nın yerleşik "failed" oranı (4xx/5xx sayar —
  DİKKAT: bu proje için 429 [rate-limit] de bu sayaca girer, bu bir
  ÇÖKME değildir, bkz. Performans Raporu Bölüm 3'teki dürüst yorum)
- `checks` — script'in KENDİ tanımladığı beklenen-durum kontrolleri
  (genellikle 200 VEYA 429'u "beklenen" sayar)

Ham JSON sonuçları `backend/tests/performance/results/` altına yazılır
ve **Git'e commit edilmez** (bkz. `.gitignore`) — yalnızca bu sayfa gibi
küratörlü markdown özetler commit edilir.
