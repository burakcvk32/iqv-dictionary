# Test

## Genel Bakış

| Alt proje | Çatı | Konum |
|---|---|---|
| `backend/` | Vitest 2 + Supertest | `backend/src/tests/` |
| `dashboard/` | Vitest 1 + React Testing Library + jsdom | `dashboard/src/**/*.test.{ts,tsx}` |

## Backend Testleri

```bash
cd backend
npm test              # tüm suite (vitest run)
npm run test:coverage # coverage ile (v8 provider)
```

**Test veritabanı mantığı:** gerçek MongoDB'ye ASLA bağlanılmaz. Her test
dosyası, `src/tests/support/` altındaki in-memory sahte repository'leri
(`MemoryDictionaryRepository`, `MemoryUsersRepository`,
`MemoryPeopleRepository`) gerçek
`createApp()` (routing/middleware/validation/auth zinciri
DEĞİŞTİRİLMEDEN) ile birleştirir. Bu sayede testler hem hızlı hem de
gerçek Mongo bağlantısına bağımlı değildir.

**Kapsanan test dosyaları:**

- `people.test.ts` — Personel CRUD, izin/rol yükseltme engeli, kullanıcı
  yalnızca kendi kaydını görür (self-security).
- `dictionary.test.ts` — Sözlük CRUD, arama, alt grup filtreleme.
- `auth.test.ts` — Login, `/auth/me` ("protected page flash" güvenlik
  regresyonu: token yok/geçersiz/süresi dolmuş → 401; geçerli → 200).
- `resilienceAndErrors.test.ts` — Beklenmedik hataların iç detay
  sızdırmadan 500'e düşmesi; bilinmeyen route → 404.

**Sonuçların yorumlanması:** `npm test` çıktısında her dosya için
`✓`/`✗` ve toplam `Test Files`/`Tests` satırları görünür. Herhangi bir
test FAIL olursa CI kırmızı olur (bkz. [Git ve CI](git-ci.md)).

## Dashboard Testleri

```bash
cd dashboard
pnpm test              # tüm suite (vitest run)
pnpm run test:watch    # geliştirme sırasında izleme modu
pnpm run test:coverage # coverage ile
```

**Kapsanan test dosyaları:**

- `src/utils/permissions.test.ts` — rol/izin çözümleme mantığı
  (`resolvePermissions`, `hasPermission`, `isAdminTierRole`) — backend
  `middleware/auth.ts` ile birebir eşleşmesi gereken izin haritası.
- `src/routes/requireAuth.test.tsx` — "protected page flash" güvenlik
  regresyonu: token yokken/hatalıyken korumalı içeriğin ASLA (doğrulama
  bitmeden) render edilmediğinin gerçek DOM render'ıyla doğrulanması
  (AUTH-01 → AUTH-07).

**Bilinen, çalıştırılamayan bir test dosyası:**
`src/components/dictionary/subgroupFilter.test.tsx`, `vitest.config.ts`'nin
`exclude` listesinde bilerek dışarıda bırakılmıştır — dosyanın kendisi
GERÇEK bir test senaryosu olarak repoda durur (silinmedi), ancak
`antd`+`react-redux` bağımlılık grafiğinin ilk taranması bazı ortamlarda
pratik zaman sınırını aşabiliyor. `pnpm test`'i (ve dolayısıyla CI'ı)
BLOKE ETMEMESİ için hariç tutuldu. Ayrıntı için dosyanın kendi başındaki
yorum bloğuna ve [Test Raporu](../testing/TEST_REPORT.md)'na bakın.

## Auth/Authorization/Security Regresyon Testleri

Aşağıdaki senaryolar CI'da ZORUNLU olarak çalışır (backend `auth.test.ts`
+ `people.test.ts`, dashboard `requireAuth.test.tsx`):

- Token yok → 401 / login'e yönlendirme
- Geçersiz token → 401
- Süresi dolmuş token → 401
- Rol/izin bazlı route erişim kontrolü (403)
- Kendi kendine rol/izin yükseltme engeli
- Normal kullanıcının yalnızca kendi kaydını görmesi (`scopeToUserId`)

