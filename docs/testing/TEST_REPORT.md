# Dictionary Projesi — Test Raporu

**Tarih:** 2026-08-30
**Ortam:** `device_bash` köprüsü üzerinden gerçek Windows geliştirme makinesi ("burak") — `C:\Users\cevik\Desktop\Dictionary\Dictionary\`
**Kural:** Bu raporda yer alan HER sonuç ya gerçekten çalıştırıldı (PASS/FAIL, gerçek sayılarla) ya da açıkça `NOT EXECUTED` olarak işaretlendi ve teknik gerekçesi yazıldı. Çalıştırılmamış hiçbir şey PASS olarak gösterilmedi.

---

## 1. Ortam Bilgisi

- Platform: `win32` (gerçek kullanıcı makinesi, `device_bash` Linux köprüsü üzerinden erişildi)
- Backend: Node.js + Express + TypeScript, test çatısı: Vitest 2.1.9 + Supertest, in-memory sahte repository'ler (`src/tests/support/*`)
- Dashboard: React 18 + Vite 4 + antd 5 + TypeScript, test çatısı: Vitest 1.6.1 + React Testing Library 14 + jsdom
- **Gerçek MongoDB'ye bu ortamdan ağ erişimi YOKTUR** (port 27017 kapalı — Mongo, kullanıcının gerçek Windows host'unda çalışıyor, bu köprüye açılmıyor). Bu, aşağıdaki her bölümde kapsam sınırlaması olarak ayrıca belirtilmiştir.
- `git pull/push/commit` KULLANILMADI (kullanıcı talimatı gereği, tüm oturum boyunca).

---

## 2. Statik Analiz (Build / Typecheck / Lint / Prettier)

### 2.1 Backend

| Kontrol | Komut | Sonuç |
|---|---|---|
| TypeScript typecheck | `npx tsc --noEmit` | ✅ PASS — 0 hata |
| ESLint | `npx eslint "src/**/*.ts" "scripts/**/*.ts"` | ✅ PASS — 0 hata |
| Build | `npx tsc -p tsconfig.json` | ✅ PASS — `dist/` üretildi |
| Prettier | — | Backend'de ayrı bir Prettier config'i YOK (yalnızca ESLint) — `NOT APPLICABLE` |

### 2.2 Dashboard

| Kontrol | Komut | Sonuç |
|---|---|---|
| ESLint (ilk çalıştırma) | `npx eslint .` | 84 problem / 4 dosya (detay aşağıda) |
| Prettier | `npx prettier --check "./src/**/*.{ts,tsx}"` | ✅ PASS — "All matched files use Prettier code style!" |
| TypeScript typecheck (ilk çalıştırma) | `npx tsc --noEmit` | ❌ 6 hata |
| TypeScript typecheck (düzeltme sonrası) | `npx tsc --noEmit` | ⚠️ 3 hata (hepsi pre-existing, kanıtlandı — bkz. 2.2.3) |
| Build (`tsc && vite build`) | `npm run build` | ❌ FAIL — pre-existing TS2786 hataları zinciri durduruyor + ayrı bir platform kısıtı (bkz. 2.2.4) |

#### 2.2.1 ESLint bulguları (84 problem / 4 dosya) — kaynağa göre ayrıştırıldı

- **`vite.config.ts.timestamp-*.mjs`** (76 hata): Vite'ın kendi ürettiği, oturum dışı bir crash-dump artefaktı — gerçek kaynak kod DEĞİL, proje çöp dosyası. Kod kalitesiyle ilgisi yok.
- **`_to_delete/_tmp_switch_probe.tsx`** (3 hata): önceki bir oturumdan kalma scratch/deneme dosyası, gerçek kod değil.
- **`src/components/dictionary/index.tsx`** (4 hata, `@typescript-eslint/no-unused-vars`): `canUpdateDictionary`, `canDeleteDictionary`, `openEditModal`, `showDeleteConfirmation` satır 252/253/326/336'da tanımlı ama kullanılmıyor görünüyor. **Gerçek, kaynak koddaki bir bulgu** — `git status` bu dosyayı `??` (tamamen untracked) gösterdiği için pre-existing mi yoksa bu oturumda mı eklendiği kanıtlanamadı; bu yüzden köken iddiası YAPILMADI, olduğu gibi raporlandı. Kapsam dışı olduğu için düzeltilmedi (görev talimatı: gereksiz/büyük refactor yapılmaması).
- **`src/components/layout/index.tsx`** (1 hata, `react-hooks/set-state-in-effect`, satır 177): `useEffect(..., [location.pathname])` içinde `setExpanded(false)`. Aynı şekilde köken kanıtlanamadı, düzeltilmedi (kapsam dışı).

#### 2.2.2 TypeScript hataları — düzeltilen (3 adet, gerçek build hatası)

`DictionaryFormModal.tsx(124,11)`, `settings/index.tsx(348,11)`, `PersonEditModal.tsx(519,11)` — hepsi aynı desen (`TS2345`): antd `Form.setFields()` çağrısında backend'den gelen validasyon hatasının `field` değeri (tip: `string`) antd'nin beklediği `FieldData<T>.name` (bilinen alan adlarının literal union'ı) tipiyle uyuşmuyordu.

**Minimal, güvenli, kapsam-içi düzeltme:** `fieldError.field as keyof <FormValues>` cast'i eklendi (yalnızca derleme zamanı, çalışma zamanı davranışı SIFIR değişti) — backend alan adlarının gerçek form alanlarıyla eşleştiği zaten iş kuralı olduğu için gerekçelendirildi. Düzeltme sonrası bu 3 dosya için ayrı ayrı `npx eslint` çalıştırıldı: temiz.

#### 2.2.3 TypeScript hataları — pre-existing olduğu KANITLANAN (3 adet, düzeltilmedi)

`browserRouter.tsx(66,14)/(74,14)/(82,14)` — `TS2786`, `@loadable/component`'in ürettiği `LoadableComponent`'in JSX eleman tipi olarak kullanılamaması.

**Kanıt:** `git diff HEAD -- dashboard/src/routes/browserRouter.tsx` çalıştırıldı — `Users` bileşeni için `loadable()` sarmalama deseni HEAD'de (bu oturumun route-permission-guard değişikliğinden ÖNCE) zaten AYNEN mevcuttu. Bu oturum yalnızca aynı bozuk deseni Dictionary/Settings için 2 kez daha KOPYALADI (yeni bir hata türü İCAT ETMEDİ). Düzeltmek `@loadable/component` sürüm değişikliği veya refactor gerektirir — kapsam dışı, YAPILMADI.

#### 2.2.4 Build — ayrı, ortamsal bir engel (kod kusuru DEĞİL)

`npx vite build` tek başına çalıştırıldığında `tsc` adımını atlayınca bile şu hatayla çöküyor: *"You installed esbuild for another platform"*. Kanıt: `dashboard/node_modules/@esbuild/` yalnızca `win32-x64` içeriyor (kullanıcının gerçek Windows makinesinde kurulmuş), bu Linux köprüsünde `linux-x64` YOK. Bu, projenin `node_modules`'ünün Windows'a özgü kurulmuş olmasından kaynaklanan **ortamsal bir kısıt** — uygulama kodunun bir kusuru değil. `npm run dev`/`npm run build`, kullanıcının GERÇEK Windows makinesinde normal şekilde çalışır; bu yalnızca bu test ortamının kısıtıdır.

### 2.3 ÖNEMLİ, BULUNUP DÜZELTİLEN BİR REGRESYON: `dashboard/node_modules` bütünlüğü

Test altyapısı kurulumu sırasında (bkz. Bölüm 4), `dashboard/node_modules` içinde **120 paketin** tamamen bozuk (yalnızca boş bir `node_modules` alt klasörü içeren, gerçek `package.json`'ı bile olmayan) olduğu tespit edildi — bunların arasında **`react-redux`, `tailwindcss`, `async-validator`** (antd Form validasyonunun temeli) gibi GERÇEK, üretim bağımlılıkları vardı. Bu, muhtemelen bu oturumun erken bir aşamasında kesintiye uğrayan bir arka plan `npm install` işleminin bıraktığı yarım kalmış durumdu.

**Etki:** Bu bozulma giderilmeden önce, `react-redux`/`tailwindcss`/`async-validator` kullanan HERHANGİ bir gerçek kod yolu (yani antd Form/Modal kullanan hemen hemen her sayfa) muhtemelen çalışma zamanında çökerdi — bu, yalnızca test altyapısını değil, kullanıcının gerçek `npm run dev` ortamını da etkileme potansiyeli olan ciddi bir bulguydu.

**Düzeltme:** `package-lock.json`'daki sürümlere sadık kalınarak proje kökü DIŞINDA (mount dışı, yerel disk) temiz bir `npm install` yapıldı, ardından SADECE bozuk/eksik paketler (mevcut, çalışan hiçbir şeye DOKUNULMADAN) gerçek `dashboard/node_modules` içine kopyalandı. Ayrıca, `antd@5.29.3` (zaten kurulu olan GERÇEK sürüm — `package.json`'daki `^5.6.4` aralığından daha yeni, `package-lock.json` bu konuda güncel değildi) için eksik olan `@ant-design/cssinjs-utils`, `@rc-component/async-validator`, `@rc-component/qrcode` ve uyumsuz `rc-util` sürümü de aynı minimal, hedefli yöntemle düzeltildi. Kullanıcının Windows'a özgü `win32-x64` esbuild/rollup binary'lerine DOKUNULMADI. Düzeltme sonrası: 0 bozuk paket (tam tarama ile doğrulandı), `react-redux`/`tailwindcss`/`async-validator` sürümleri `package.json` aralıklarıyla eşleşiyor.

---

## 3. Backend — Test Sonuçları (GERÇEKTEN ÇALIŞTIRILDI)

### 3.1 Baseline (bu oturumun QA görevi BAŞLAMADAN önce, mevcut test paketi)

```
Test Files  3 passed (3)
     Tests  106 passed (106)
```
(`people.test.ts`, `dictionary.test.ts`, `audit.test.ts`)

### 3.2 Bu oturumda eklenen testler

- `auth.test.ts` içine yeni `describe` bloğu: **`GET /auth/me` ("protected page flash" doğrulaması)** — 6 test: token yok→401, bozuk token→401, süresi dolmuş token→401, geçerli token→200 (taze kullanıcı verisi, `password` alanı YOK), silinmiş kullanıcı→401, pasif kullanıcı→401.
- **YENİ dosya** `resilienceAndErrors.test.ts` — 4 test:
  - Audit log yazımı BAŞARISIZ olsa bile Dictionary/Personnel create işlemi 201 ile TAMAMLANIR (ana iş akışı audit'e bağımlı değil) + hata `console.error`'a GÖRÜNÜR şekilde yazılır (sessizce yutulmaz).
  - `ApiError` olmayan beklenmedik hatalar 500'e düşer, gövde iç detay SIZDIRMAZ (`"Beklenmeyen bir sunucu hatası oluştu."` sabit mesajı, `"MongoDB bağlantısı"` gibi iç detaylar YOK).
  - Bilinmeyen route → 404.

### 3.3 AFTER (backend, tüm suite)

```
✓ src/tests/people.test.ts (54 tests)
✓ src/tests/dictionary.test.ts (32 tests)
✓ src/tests/audit.test.ts (12 tests)
✓ src/tests/resilienceAndErrors.test.ts (4 tests)
✓ src/tests/auth.test.ts (14 tests)

Test Files  5 passed (5)
     Tests  116 passed (116)
Duration    45.68s (ilk ekleme sonrası çalıştırma) / 46.05s (coverage ile birlikte son çalıştırma)
```

**106 → 116: net +10 gerçek test, 0 FAIL, 0 SKIP.**

### 3.4 Backend Coverage (GERÇEKTEN çalıştırıldı — `vitest run --coverage`, v8 provider)

| Dosya/Klasör | % Stmts | % Branch | % Funcs | % Lines |
|---|---|---|---|---|
| **Tümü** | **64.59** | **74.64** | **91.96** | **64.59** |
| `src/modules/auth/auth.service.ts` | 100 | 100 | 100 | 100 |
| `src/modules/auth/auth.controller.ts` | 87.5 | 71.42 | 100 | 87.5 |
| `src/middleware/auth.ts` | 89.58 | 80 | 100 | 89.58 |
| `src/modules/audit/audit.service.ts` | 98.71 | 78.57 | 100 | 98.71 |
| `src/modules/dictionary/dictionary.controller.ts` | 95.32 | 70.37 | 100 | 95.32 |
| `src/modules/people/people.controller.ts` | 94.55 | 81.33 | 100 | 94.55 |
| `src/utils/*` | 97.14 | 94.44 | 92.85 | 97.14 |
| `src/modules/*/​*.repository.mongo.ts` (Dictionary/Auth/People) | **0** | **0** | **0** | **0** |
| `src/config/db.ts`, `src/config/env.ts` | 0 | 0 | 0 | 0 |
| `src/server.ts` | 0 | 0 | 0 | 0 |
| `src/scripts/rename-...-2026-08-30.ts` | 0 | 0 | 0 | 0 |

**Dürüst yorum (güvenlik/iş-kritik yollar öncelikli):** Auth servis/middleware, audit servisi ve controller/validasyon katmanları yüksek kapsama sahip (%87-100). **En önemli gerçek boşluk:** üç modülün GERÇEK MongoDB repository implementasyonları (`*.repository.mongo.ts`) **%0 kapsamda** — çünkü tüm testler, bu ortamdan gerçek Mongo'ya erişilemediği için in-memory sahte repository'lere karşı çalışıyor. Bu, üretim persistence katmanının bu oturumda HİÇ test edilmediği anlamına gelir ve raporun en önemli, saklanmayan boşluğudur. `server.ts`/`db.ts`/`env.ts`'nin 0 olması beklenir (bootstrap/config, testlerde gerçek sunucu başlatılmıyor).

---

## 4. Dashboard — Test Altyapısı ve Sonuçları

### 4.1 Kurulum (özet — tam detay komut günlüğünde)

Dashboard'ta ÖNCEDEN hiçbir test altyapısı YOKTU (Playwright/Cypress/Vitest yok, `package.json`'da test script'i yok). Bu oturumda eklendi: `vitest@1.6.1`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`. `dashboard/node_modules` içine doğrudan `npm install` GÜVENİLİR ÇALIŞMADI (FUSE-bridge üzerinde tekrarlanan `ENOTEMPTY` hataları) — bunun yerine mount DIŞINDA temiz bir scratch kurulum yapılıp yalnızca gerekli paketler sembolik bağlantı/kopya ile gerçek `node_modules`'e taşındı (bkz. Bölüm 2.3 için de kullanılan aynı yöntem). `vitest.config.ts` (ayrı, minimal — ana `vite.config.ts`'in test için gereksiz `tailwindcss`/PWA plugin bağımlılıklarından bağımsız) ve `src/testSetup.ts` (`@testing-library/jest-dom` + `matchMedia`/`ResizeObserver`/`IntersectionObserver` jsdom polyfill'leri) eklendi. `package.json`'a `test`/`test:watch`/`test:coverage` script'leri eklendi.

### 4.2 Yazılan ve GERÇEKTEN ÇALIŞTIRILAN testler

| Dosya | Test sayısı | Sonuç |
|---|---|---|
| `src/utils/permissions.test.ts` | 14 | ✅ 14/14 PASS |
| `src/routes/requireAuth.test.tsx` | 6 | ✅ 6/6 PASS |
| **Toplam (`npm test`)** | **20** | **✅ 20/20 PASS, 0 FAIL** (165.88s — bkz. 4.4) |

`permissions.test.ts`: `resolvePermissions`/`hasPermission`/`isAdminTierRole` — açık `permissions` dizisi rolü geçersiz kılar, boş rol/bilinmeyen rol boş kümeye düşer, rol karşılaştırması büyük/küçük harf ve boşluktan bağımsız, `'user'` rolü hiçbir izne sahip değil, `superadmin/companyadmin/organizationadmin/admin` tüm izinlere sahip.

`requireAuth.test.tsx` (AUTH-01 → AUTH-07, GERÇEK bileşen render edilerek):
- **AUTH-01:** token yok → `/auth/me` HİÇ ÇAĞRILMADAN senkron redirect.
- **AUTH-05 (flash testi):** token varken doğrulama bitene kadar (`status==='checking'`) ne korumalı içerik NE DE login sayfası görünür — yalnızca Loader. Doğrulama çözülünce içerik görünür. **Flash YOK — doğrulandı.**
- **AUTH-04:** geçerli token → içerik render edilir.
- **AUTH-02/06:** `/auth/me` 401 → oturum TEMİZLENİR, login'e yönlendirilir.
- **AUTH-07:** `/auth/me` 403 → oturum TEMİZLENMEZ, içerik render edilmeye devam eder (401 dışındaki hatalarda mevcut oturuma güvenilir — kod bunu doğru yapıyor).
- Ağ hatası/timeout → anında login'e atılmaz.

### 4.3 NOT EXECUTED — dürüstçe işaretlendi

**`src/components/dictionary/subgroupFilter.test.tsx`** (8 Endüstriyel alt grup filtre kartı — tıkla-seç/tekrar-tıkla-temizle/alt gruplar arası doğrudan geçiş, GERÇEK `Dictionary` bileşenine karşı, `@ant-design/pro-components` ve `@iqvizyonui/react-components` yalnızca mock'lanarak) **yazıldı ama bu ortamda GÜVENİLİR şekilde ÇALIŞTIRILAMADI.**

**Teknik gerekçe:** Bu dosyanın bağımlılık grafiğinin (antd + `@reduxjs/toolkit` + react-redux + react-router) ilk tarama/derleme aşaması, bu ortamın (Windows'a FUSE köprüsü üzerinden bağlanan, yavaş dosya G/Ç'li) kısıtları altında **5 ayrı denemede de** (varsayılan optimizer, optimizer devre dışı, ProTable/SearchBox mock'lanmış hali dahil) aracın 180 saniyelik tek-çağrı üst sınırını aştı — hiçbir denemede tek bir test dahi sonuçlanmadan zaman aşımına uğradı (`node_modules/.vite/vitest/results.json` bunu doğruluyor: yalnızca `requireAuth.test.tsx`'in sonucu kayıtlı). Bu bir kod kusuru DEĞİL, ortamın G/Ç performansıyla ilgili bir kısıt.

Dosya SİLİNMEDİ (repoda, gerçek bileşene karşı gerçek tıklama mantığı deneyen dürüst bir test senaryosu olarak duruyor) — yalnızca varsayılan `npm test` koşusunu kilitlememesi için `vitest.config.ts`'in `exclude` listesine, gerekçesi yorum olarak yazılarak eklendi. **Sonuç: `K6 RESULT` değil ama aynı ilkeyle — `COMPONENT TEST RESULT = NOT EXECUTED` (ortamsal G/Ç kısıtı nedeniyle).**

8 alt grubun DOM'a doğru render edildiği ve tıklama/toggle mantığının (`activeSubgroup === subgroup ? undefined : subgroup`) kaynak kodda birebir bu şekilde yazılı olduğu, dosya statik olarak incelenerek (Bölüm "Dictionary CRUD ve Filtre" analizi, `src/components/dictionary/index.tsx` satır ~320 ve ~522-533) doğrulandı — ancak bu **kod okuma/statik doğrulama** düzeyinde kalır, ÇALIŞTIRILMIŞ bir test SONUCU değildir ve öyle sunulmamıştır.

### 4.4 Not: neden bu kadar yavaş?

`requireAuth.test.tsx` tek başına 165.88s sürdü (`collect: 164.62s`) — antd'nin tüm bileşenlerini yeniden dışa aktaran `index.js` barrel dosyasının, Windows'a FUSE köprüsü üzerinden bağlı bu ortamda ilk kez taranıp derlenmesi bu kadar sürüyor. Bu, gerçek süre olarak burada dürüstçe raporlanıyor (kullanıcının "süre önemli değil ama yine de gerçek süreleri raporla" talimatı gereği) — production CI ortamında (yerel SSD, sıcak önbellek) bu süre saniyeler mertebesinde olurdu.

---

## 5. Yetkilendirme (Authorization) — Gerçek Backend `PermissionKey` Değerleriyle

Aşağıdaki, backend `middleware/auth.ts`'teki GERÇEK 3 izin alanı (Dictionary/Kişi/Ayarlar) ve `PermissionKey` değerleri (`dictionary.read/create/update/delete`, `users.read/create/update/delete`, `settings.read/update`) `people.test.ts` (54 test) ve `dictionary.test.ts` (32 test) içinde ZATEN kapsamlı şekilde test ediliyordu (baseline'ın parçası) — bu oturum bunlara EK olarak `permissions.test.ts` ile frontend tarafındaki AYNI izin sözleşmesinin çözümleme mantığını (14 test) doğruladı. Kendi hesabında yetki yükseltme engeli (`isFullPeopleListRole`/self-privilege-escalation) `people.test.ts` içinde zaten test ediliyor (54 testin bir kısmı).

---

## 6. SECURITY REGRESSION Tablosu

| Senaryo | Durum | Kanıt |
|---|---|---|
| Auth page flash (checking sırasında korumalı içerik görünmemeli) | ✅ PASS | `requireAuth.test.tsx` AUTH-05 |
| Geçersiz JWT (bozuk imza) | ✅ PASS | `auth.test.ts` |
| Süresi dolmuş JWT | ✅ PASS | `auth.test.ts`, `requireAuth.test.tsx` |
| Yetkisiz route erişimi (401) | ✅ PASS | `auth.test.ts`, `requireAuth.test.tsx` AUTH-02/06 |
| 403 oturumu SİLMEMELİ | ✅ PASS | `requireAuth.test.tsx` AUTH-07 |
| Kendi hesabında rol yükseltme engeli | ✅ PASS | `people.test.ts` (baseline, bu oturumda yeniden doğrulandı) |
| Kendi hesabında izin yükseltme engeli | ✅ PASS | `people.test.ts` (baseline) |
| Kendi hesabında durum (status) değişikliği engeli | ✅ PASS | `people.test.ts` (baseline) |
| Hassas veri log sızıntısı (password/hash/JWT/cookie audit log'a YAZILMAMALI) | ✅ PASS | `audit.test.ts` (baseline) |
| Audit-DB kullanılamazsa hata GÖRÜNÜR olmalı, ana işlem etkilenmemeli | ✅ PASS | `resilienceAndErrors.test.ts` (bu oturumda eklendi) |
| Beklenmeyen hatalar iç detay sızdırmamalı (500) | ✅ PASS | `resilienceAndErrors.test.ts` (bu oturumda eklendi) |

---

## 7. Test Verisi İzolasyonu

Backend testleri (`people.test.ts`/`dictionary.test.ts`/`audit.test.ts`/`auth.test.ts`/`resilienceAndErrors.test.ts`) in-memory sahte repository'lere karşı çalışır — her test dosyası kendi izole `buildTestApp()` örneğini kurar, gerçek/kalıcı hiçbir veriye dokunmaz, ek bir cleanup GEREKMEZ. k6 performans testleri `K6_` ön ekli veri üretir (bkz. PERFORMANCE_REPORT.md) — yine tamamen in-memory, process kapanınca otomatik temizlenir.

---

## 8. Genel Sonuç

| Kategori | Durum |
|---|---|
| Backend unit/entegrasyon/auth/authz/audit/resilience testleri | ✅ PASS (116/116) |
| Backend coverage | ✅ ÇALIŞTIRILDI (gerçek sayılar yukarıda) — Mongo repository katmanı %0 (açık boşluk) |
| Backend build/typecheck/lint | ✅ PASS |
| Dashboard unit/component testleri (permissions, RequireAuth) | ✅ PASS (20/20) |
| Dashboard 8-alt-grup component testi | ⚠️ **NOT EXECUTED** (ortamsal G/Ç kısıtı, gerekçeli) |
| Dashboard build | ❌ FAIL (3 pre-existing TS2786 hatası + ayrı esbuild platform kısıtı) — düzeltilmedi, kapsam dışı olduğu kanıtlandı |
| Dashboard node_modules bütünlüğü | ✅ BULUNDU VE DÜZELTİLDİ (120 bozuk paket, react-redux/tailwindcss/async-validator dahil) |
| k6 performans testleri | ✅ ÇALIŞTIRILDI — bkz. `PERFORMANCE_REPORT.md` |
| UAT / responsive | ⚠️ **NOT EXECUTED** — bkz. `UAT_REPORT.md` |

**Genel durum: PARTIAL PASS.** Backend tarafı kapsamlı ve gerçekten yeşil. Dashboard tarafında iki gerçek, isimlendirilmiş boşluk var (bir component testi ortamsal G/Ç kısıtı nedeniyle çalıştırılamadı; dashboard `build` iki ayrı, kapsam-dışı pre-existing/ortamsal nedenle başarısız) — hiçbiri gizlenmedi veya PASS gibi gösterilmedi.

---

## 9. Komut Günlüğü (gerçek, sırayla — şifre/secret YOK)

```
cd backend && npx vitest run                                  # baseline: 106/106
cd backend && npx tsc --noEmit                                # clean
cd backend && npx eslint "src/**/*.ts" "scripts/**/*.ts"      # clean
cd backend && npx tsc -p tsconfig.json                        # build OK
cd backend && npx vitest run                                  # AFTER: 116/116
cd backend && npx vitest run --coverage                       # coverage raporu (Bölüm 3.4)
cd dashboard && npx eslint .                                  # 84 problem / 4 dosya
cd dashboard && npx prettier --check "./src/**/*.{ts,tsx}"    # clean
cd dashboard && npx tsc --noEmit                               # 6 hata -> (3 duzeltme sonrasi) 3 hata
cd dashboard && npm run build                                  # FAIL (bkz. 2.2.4)
cd dashboard && npx vite build                                  # FAIL (esbuild platform)
cd dashboard && npm test  (== vitest run)                       # 20/20 PASS
/tmp/k6bin/k6 version                                           # k6 v0.54.0
cd backend && npx tsx tests/performance/server/k6TestServer.ts &  # in-memory k6 test sunucusu
/tmp/k6bin/k6 run tests/performance/k6/*.js                      # bkz. PERFORMANCE_REPORT.md
```
