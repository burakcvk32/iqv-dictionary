# Dictionary Projesi — UAT (Kullanıcı Kabul Testi) ve Responsive Rapor

**Tarih:** 2026-08-30

---

## 1. Neden bu bölümün tamamı NOT EXECUTED / MANUEL

Gerçek bir UAT senaryosu, GERÇEK çalışan bir frontend (`npm run dev` veya build edilmiş dashboard) + gerçek backend'e karşı, bir tarayıcıda gerçek tıklama/form doldurma ile yürütülmelidir. Bu ortamda bu mümkün DEĞİLDİ, iki ayrı, kanıtlanmış teknik nedenle:

1. **Dashboard geliştirme/production sunucusu bu ortamda ÇALIŞTIRILAMIYOR.** `dashboard/node_modules`, kullanıcının gerçek Windows makinesinde kurulmuş ve yalnızca `@esbuild/win32-x64` (ve Windows'a özgü diğer native binary'ler) içeriyor — bu Linux köprüsünde `linux-x64` YOK. `npx vite build`/`npx vite dev` bu yüzden anında *"You installed esbuild for another platform"* hatasıyla çöküyor (bkz. `TEST_REPORT.md` Bölüm 2.2.4). Bu native binary'leri bu ortama kurmak (`node_modules`'ü yeniden kurmak/silmek) kullanıcının GERÇEK, çalışan Windows geliştirme ortamını bozma riski taşıdığı için YAPILMADI (görev talimatı: gereksiz/riskli değişiklik yapılmaması).
2. **Gerçek MongoDB'ye bu ortamdan erişim YOK** (bkz. `PERFORMANCE_REPORT.md` Bölüm 1) — üretim-benzeri veriyle GERÇEK bir UAT akışı zaten mümkün değil.

Oturumda bir tarayıcı otomasyon aracı (Claude'un yerleşik tarayıcısı / Chrome uzantısı) teknik olarak mevcuttu, ancak yukarıdaki iki neden yüzünden yönlendirilebilecek ÇALIŞAN bir hedef (ne gerçek dashboard, ne gerçek-veri-destekli backend) yoktu — bu yüzden tarayıcı hiç kullanılmadı; kullanmak, boş/çökmüş bir sayfayı "test ettim" gibi göstermek olurdu ki bu açıkça yasak.

**Bu, uygulamanın bir kusuru DEĞİLDİR** — kullanıcının GERÇEK Windows makinesinde `npm run dev` normal şekilde çalışır (`@esbuild/win32-x64` orada mevcut ve doğru). Bu yalnızca bu izole test ortamının bir kısıtıdır.

---

## 2. UAT Senaryoları

| ID | Senaryo | Sonuç |
|---|---|---|
| UAT-01 | Login → arama akışı | **NOT EXECUTED** (yukarıdaki Bölüm 1 nedeniyle) |
| UAT-02 | Endüstriyel alt grup filtre toggle (8 alt grup) | **NOT EXECUTED** (canlı UAT olarak) — ANCAK bkz. `TEST_REPORT.md` Bölüm 4.2: aynı mantık, gerçek bileşen koduna karşı `requireAuth.test.tsx` benzeri bir component testiyle (`subgroupFilter.test.tsx`) test EDİLMEYE ÇALIŞILDI, ortamsal G/Ç kısıtı nedeniyle o da NOT EXECUTED kaldı (ayrıntı orada) |
| UAT-03 | Ayarlar: oluştur → ara → seç → otomatik-doldur → güncelle → sil | **NOT EXECUTED** |
| UAT-04 | Admin: personel CRUD + izin değişikliği | **NOT EXECUTED** (canlı UAT olarak) — ilgili GÜVENLİK mantığı (izin/rol yükseltme engeli) `people.test.ts`'te (backend, 54 test, baseline'ın parçası) GERÇEKTEN test edilmiş ve PASS durumda, bkz. `TEST_REPORT.md` Bölüm 6 |
| UAT-05 | Normal kullanıcı yalnızca kendi kaydını görür | **NOT EXECUTED** (canlı UAT) — backend tarafı `people.test.ts` içinde `scopeToUserId` mantığıyla test ediliyor (baseline) |
| UAT-06 | Kendi kendine rol yükseltme engellenir | **NOT EXECUTED** (canlı UAT) — backend tarafı `people.test.ts` içinde test ediliyor (baseline), bkz. SECURITY REGRESSION tablosu |
| UAT-07 | Token silinince flash olmadan login'e yönlendirme | **NOT EXECUTED** (canlı UAT) — ANCAK bu tam olarak `requireAuth.test.tsx`'in (dashboard, 6 test, bu oturumda yazıldı ve GERÇEKTEN PASS) test ettiği şey; component seviyesinde gerçek DOM render'ıyla doğrulandı (bkz. `TEST_REPORT.md` Bölüm 4.2, AUTH-05) |

**Not:** UAT-04/05/06/07'nin ARKASINDAKİ güvenlik mantığı zaten backend/component seviyesinde gerçekten test edilmiş durumda — burada NOT EXECUTED olarak işaretlenen, bunların GERÇEK bir tarayıcıda uçtan uca (gerçek login ekranı → gerçek tıklamalar → gerçek görsel sonuç) doğrulanmamış olmasıdır.

---

## 3. Responsive Test

| Viewport | Sonuç |
|---|---|
| 1920×1080 | **NOT EXECUTED** |
| 1440×900 | **NOT EXECUTED** |
| 1366×768 | **NOT EXECUTED** |
| 1280×800 | **NOT EXECUTED** |
| 1024×768 | **NOT EXECUTED** |
| 834×1194 (tablet dikey) | **NOT EXECUTED** |
| 768×1024 | **NOT EXECUTED** |
| 480×800 | **NOT EXECUTED** |
| 414×896 | **NOT EXECUTED** |
| 375×667 | **NOT EXECUTED** |
| 320×700 | **NOT EXECUTED** |

Tümü aynı kök nedenle (Bölüm 1): çalıştırılabilir/görüntülenebilir bir dashboard olmadan ekran görüntüsü tabanlı responsive doğrulama fiziksel olarak mümkün değildi. `MANUAL` olarak işaretleniyor — kullanıcının kendi Windows makinesinde `npm run dev` ile GERÇEK tarayıcıda manuel olarak doğrulanması gerekir.

---

## 4. Genel Sonuç

**UAT/Responsive: NOT EXECUTED (tamamı).** Sebep tekrarlanmıyor gizlenmeden, tek ve net: bu izole test ortamında çalışan bir dashboard sunucusu (platform-uyumsuz native binary'ler) ve gerçek MongoDB erişimi yok. Bu senaryoların ARKASINDAKİ güvenlik/iş mantığının önemli bir kısmı zaten backend/component testleriyle (bkz. `TEST_REPORT.md`) gerçekten doğrulandı — ancak bu, gerçek bir uçtan-uca UAT'in YERİNE GEÇMEZ ve öyle sunulmuyor. Kullanıcının kendi Windows makinesinde gerçek tarayıcıyla bu tabloyu tamamlaması ÖNERİLİR.
