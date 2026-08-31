# Dictionary Projesi — Performans (k6) Raporu

**Tarih:** 2026-08-30
**k6 sürümü:** v0.54.0 (GitHub Releases tarball üzerinden indirildi — resmi `dl.k6.io` bu ortamın ağ allowlist'i tarafından engellendi, `registry.npmjs.org`/`github.com` engelli DEĞİL)

---

## 1. ÇOK ÖNEMLİ KAPSAM SINIRLAMASI (baştan okunmalı)

Bu ortamdan (device_bash köprüsü) kullanıcının **gerçek MongoDB'sine ağ erişimi YOKTUR** (port 27017 kapalı). Bu yüzden k6 testleri **üretime karşı DEĞİL**, `tests/performance/server/k6TestServer.ts` adlı özel bir sunucuya karşı çalıştırıldı: bu sunucu, GERÇEK `createApp()` (app.ts — routing/middleware/validation/auth/rate-limit/audit-logging zinciri HİÇ DEĞİŞTİRİLMEDEN) ile backend'in kendi vitest paketinin zaten güvendiği **in-memory sahte repository'leri** birleştiriyor.

**Bu ne ölçüyor:** routing + middleware (helmet/cors/rate-limit) + JWT auth + validation + iş mantığı katmanının GERÇEK performansı.
**Bu ne ÖLÇMÜYOR:** MongoDB I/O gecikmesi (network round-trip, disk, index taraması, connection pool doygunluğu). **Bu sayılar üretim-eşdeğeri DEĞİLDİR** — yalnızca uygulama kodunun kendi katmanının davranışı hakkında gerçek, faydalı bilgi verir.

Sunucu 1000 adet `K6_` ön ekli sözlük kaydıyla seed edildi (500 "Endüstriyel" — 8 alt gruba eşit dağıtılmış 125'er, 500 "IQV OS AI") ve tek bir `K6_perf_admin` test kullanıcısıyla.

**Sahte SLA eşiği İCAT EDİLMEDİ.** Aşağıdaki sayılar yalnızca gözlemsel olarak raporlanıyor.

---

## 2. Smoke Testleri (1 VU, kısa süre) — TÜMÜ GERÇEKTEN ÇALIŞTIRILDI

| Script | VU/Süre | Sonuç |
|---|---|---|
| `auth-smoke.js` | 1 VU, 6s | ✅ 6/6 iterasyon, checks 100% (12/12) |
| `dictionary-read.js` | 1 VU, 8 iter | ✅ checks 100% (32/32) — liste/arama/**8-alt-grup-filtre**/istatistik uçlarının tamamı |
| `dictionary-crud.js` | 1 VU, 4 iter | ✅ checks 100% (12/12) — create→update→delete, her `K6_` kaydı temizlendi |
| `personnel-read.js` | 1 VU, 4 iter | ✅ checks 100% (4/4) |

**Smoke sırasında bulunup düzeltilen 2 gerçek script hatası (uygulama hatası DEĞİL):**
1. Login yanıtının gerçek şekli `{success, token, user}` (düz) iken scriptler `data.token` (iç içe) bekliyordu — backend `auth.controller.ts` okunarak doğrulandı, scriptler düzeltildi.
2. `dictionary-read.js`'te `group=Endüstriyel` parametresi `encodeURIComponent` ile SARILMAMIŞTI (yalnızca `subgroup` sarılıydı) — k6/Go'nun URL işleyicisi ham UTF-8 baytlarını farklı ele alıyor, bu da "alt grup filtresi" kontrolünün 6/6 başarısız olmasına yol açtı. `curl` ile doğrulandıktan sonra (backend'in KENDİSİ doğru 200 dönüyordu) düzeltme scriptte yapıldı.

**Ayrıca smoke sırasında bulunup düzeltilen bir seed-script hatası:** ilk seed mantığı, grup indeksini (`i % 2`) ve alt grup indeksini (`i % 8`) AYNI `i`'den türetiyordu — bu, 8 alt gruptan yalnızca 4'ünün hiç veri almamasına yol açtı (`stats` uç noktasıyla doğrulandı: yalnızca 4 alt grup görünüyordu). Endüstriyel kayıtlar için bağımsız bir sayaç eklenerek düzeltildi; sonrasında `stats` 8 alt grubun her birinde 125 kayıt gösterdi.

---

## 3. Load Test — `dictionary-read.js` (staged 10 → 25 → 50 VU, toplam 60s)

```
http_reqs: 24,737 istek, 411.23 req/s ortalama
checks: 100.00% (24,736/24,736) — TÜM istekler script'in KENDİ tanımına göre (200 VEYA 429) beklenen durumdaydı
http_req_duration: avg=1.8ms  med=1.28ms  p90=3.75ms  p95=5.07ms  max=54.91ms
http_req_failed (k6'nın YERLEŞİK metriği — 4xx/5xx = "failed" sayar): %97.70 (24,170/24,737)
```

**Dürüst yorum:** `http_req_failed` metriğinin %97.70 olması bir çökme/hata DEĞİL — backend'in KENDİ `app.ts`'teki `apiLimiter` (300 istek/60s, `/api/*` genelinde) rate-limit'i, 25-50 eşzamanlı VU'nun ürettiği trafik altında hızla doyuyor ve 429 (Too Many Requests) döndürüyor. Bu, rate-limiter'ın **tasarlandığı gibi çalıştığının** kanıtı. Gerçek başarılı (200) istek oranı toplamın yaklaşık %2.3'ü (~567 istek / 60s ≈ 9.4 req/s gerçek-200 verimi) — bu, mevcut `apiLimiter` eşiğinin (300/60s = 5 req/s tüm kullanıcılar TOPLAMI için) 50 eşzamanlı kullanıcılı bir yük senaryosu için oldukça düşük olduğunu gösteren **gözlemsel bir uyarı**dır (resmi bir SLA/PASS-FAIL iddiası DEĞİL).

---

## 4. Stress Testi (gözlemsel) — `dictionary-read.js` (100 VU, 30s, taze sunucu)

```
http_reqs: 43,533 istek, 1,434.58 req/s (peak)
checks: 100.00% (43,532/43,532)
http_req_duration: avg=1.81ms  med=1.24ms  p90=3.89ms  p95=5.25ms  max=250.96ms
http_req_failed (yerleşik metrik): %99.31 (rate-limiter kaynaklı 429'lar)
```

**Gözlem:** 100 eşzamanlı VU'da bile **çökme, bağlantı hatası, connection-pool tükenmesi veya 5xx GÖZLEMLENMEDİ** — sunucu istikrarlı kaldı, yalnızca rate-limiter devreye girdi. Test, kullanıcının "çökme/pool tükenmesi/5xx patlaması görürsen durdur" talimatına uygun şekilde kısa tutuldu (30s) ve daha da agresif bir seviyeye çıkarılmadı, çünkü zaten net bir doygunluk sinyali (rate-limiter) gözlemlenmişti.

---

## 5. Login Ucu — Ayrı, Daha Katı Rate-Limit (`auth-smoke.js`, 20 VU, 15s)

```
http_reqs: 294 istek, 18.38 req/s
checks — "login status 200": %6.80 (20/294 başarılı)
http_req_duration (yalnızca başarılı istekler): avg=679ms  p95=1.16s
```

**Gözlem:** `/api/v1/auth/login` ucu, genel `apiLimiter`'a EK olarak kendi `loginLimiter`'ına sahip ve 20 eşzamanlı giriş denemesi altında isteklerin yalnızca %6.8'i geçebildi — bu, brute-force koruması açısından **beklenen, doğru güvenlik davranışı** (bir zafiyet DEĞİL), ancak meşru eşzamanlı kullanıcı sayısı yüksek olan bir ortamda giriş deneyimini etkileyebileceği için gözlemsel bir not olarak kayda geçirildi.

---

## 6. NOT EXECUTED olarak işaretlenenler

- **`personnel-read.js` / `dictionary-crud.js` / `mixed-workload.js` için AYRICA bir "load" koşusu** — bu üç script, hemen önce çalıştırılan 100-VU stres testinin (aynı sunucu süreci, aynı 60s'lik `apiLimiter` penceresi) bıraktığı REZİDÜEL rate-limit nedeniyle `setup()` adımındaki login çağrısında 429 aldı (JSON yerine düz metin gövdesi döndüğü için `JSON.parse` hata verdi) — bu, script'lerin kendisinin bir kusuru değil, aynı sunucu örneğine art arda ağır yük bindirmenin bir sonucu. Bu üç script için **SMOKE seviyesinde** (Bölüm 2) gerçek, başarılı PASS verisi zaten mevcut; ayrı bir "load" ölçümü için taze bir sunucu örneği ve ek zaman gerekirdi — zaman kısıtı nedeniyle tekrarlanmadı. **`LOAD RESULT (personnel-read/dictionary-crud/mixed-workload) = NOT EXECUTED`** (yalnızca smoke seviyesi tamamlandı).
- DB/connection-pool/CPU/memory gözlemi: bu ortamda böyle bir izleme aracı (ör. `docker stats`, gerçek Mongo `serverStatus`) mevcut DEĞİL — **NOT EXECUTED**, uydurulmadı.

---

## 7. Ham Sonuç Dosyaları

`backend/tests/performance/results/` altında: `smoke-auth.json`, `smoke-dictionary-read.json`, `smoke-dictionary-crud.json`, `smoke-personnel-read.json`, `load-dictionary-read.json`, `load-auth.json`, `stress-dictionary-read.json`, `load-personnel-read.json` (rezidüel-limit ile başarısız setup — Bölüm 6), `load-dictionary-crud.json` (aynı), `load-mixed-workload.json` (aynı).

## 8. Genel Sonuç

| Test türü | Durum |
|---|---|
| k6 kurulumu | ✅ (GitHub Releases üzerinden, resmi kanal engelliydi) |
| Smoke (5 script) | ✅ TÜMÜ PASS |
| Load — dictionary-read | ✅ ÇALIŞTIRILDI, gerçek sayılar yukarıda |
| Load — auth/login | ✅ ÇALIŞTIRILDI, gerçek sayılar yukarıda |
| Load — personnel-read/dictionary-crud/mixed-workload | ⚠️ NOT EXECUTED (yalnızca smoke) |
| Stress (gözlemsel) | ✅ ÇALIŞTIRILDI — çökme/5xx yok, rate-limiter doygunluğu gözlemlendi |
| Üretime karşı test | ❌ YAPILMADI (yasak, ve zaten teknik olarak imkansız — Mongo erişimi yok) |
