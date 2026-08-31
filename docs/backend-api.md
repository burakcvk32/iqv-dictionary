# Backend API

Backend, `backend/src/app.ts` içinde tek bir Express uygulaması olarak
kurulur. Bu sayfa gerçek route tanımlarından çıkarılmış özet bir
referanstır — **tam, interaktif ve her zaman kod ile senkron** referans
için çalışan backend'in `/api-docs` (Swagger UI) ve `/openapi.json`
uçlarına bakın (bkz. `backend/src/docs/swagger.ts`).

## Temel bilgiler

- **Base path:** `/api/v1/...` (bazı legacy/Node-RED uçları hariç, aşağıya bakın)
- **Kimlik doğrulama:** `Authorization: Bearer <JWT>` header'ı. Token,
  `POST /api/v1/auth/login` ile alınır, `JWT_EXPIRES_IN` (varsayılan `12h`)
  sonra geçersiz olur.
- **İçerik tipi:** `application/json`, gövde limiti 1 MB.
- **Global rate limit:** `/api/*` altındaki tüm uçlar için 300 istek /
  60 saniye (IP başına). Limit aşılınca `429 Too Many Requests` döner —
  bu bir hata değil, kasıtlı korumadır (bkz.
  [Performans Testi](development/performance-testing.md)).
- **Login rate limit:** `POST /api/v1/auth/login` ayrıca kendi, daha sıkı
  limitine sahiptir: 20 istek / 5 dakika (brute-force koruması).

## Uçlar

| Method | Path | Auth | İzin | Açıklama |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | — | — | Kullanıcı adı/parola ile giriş, `{ success, token, user }` döner |
| `GET` | `/api/v1/auth/me` | ✅ | — | Token'ı doğrular, taze kullanıcı verisini döner (`password` alanı YOK) — "protected page flash" önleme |
| `GET` | `/api/v1/users` | ✅ | `users.read` | Personel listesi |
| `POST` | `/api/v1/users` | ✅ | `users.create` | Yeni personel oluşturma |
| `PUT`/`PATCH` | `/api/v1/users/:id` | ✅ | `users.update` | Personel güncelleme |
| `DELETE` | `/api/v1/users/:id` | ✅ | `users.delete` | Personel silme |
| `GET` | `/api/v1/dictionary` | ✅ | `dictionary.read` veya `settings.read` | Sözlük listeleme/arama |
| `GET` | `/api/v1/dictionary/stats` | ✅ | `dictionary.read` | İstatistikler (grup/alt grup dağılımı) |
| `GET` | `/api/v1/dictionary/subgroups` | ✅ | `dictionary.read` veya `settings.read` | Seçilen gruba ait alt grup listesi |
| `GET` | `/api/v1/dictionary/:id` | ✅ | `dictionary.read` | Tek kayıt |
| `POST` | `/api/v1/dictionary` | ✅ | `dictionary.create` veya `settings.update` | Yeni terim ekleme |
| `PUT`/`PATCH` | `/api/v1/dictionary/:id` | ✅ | `dictionary.update` | Terim güncelleme |
| `DELETE` | `/api/v1/dictionary/:id` | ✅ | `dictionary.delete` | Terim silme |
| `GET`/`POST` | `/list-dictionary`, `/create-dictionary` | ✅ | (legacy) | Node-RED uyumluluğu için korunan eski alias'lar — aynı `DictionaryService`, kod tekrarı yok |
| `GET` | `/health` | — | — | Sağlık kontrolü, `{ success: true, data: { status: 'ok' } }` |
| `GET` | `/api-docs` | — | — | Swagger UI (interaktif API referansı) |
| `GET` | `/openapi.json` | — | — | Ham OpenAPI şeması |

## Yetkilendirme modeli

İzinler (`PermissionKey`) üç alanda tanımlıdır: **dictionary**
(`read/create/update/delete`), **users** (`read/create/update/delete`),
**settings** (`read/update`). Bir kullanıcının rolü ve/veya açıkça
atanmış izin listesi bu anahtarları çözer (`backend/src/middleware/auth.ts`).
Kendi hesabında rol/izin/durum yükseltmesi engellidir (self-privilege-
escalation koruması) — bkz.
[SECURITY REGRESSION tablosu](testing/TEST_REPORT.md).

## Hata formatı

Beklenmeyen (uygulanmamış) hatalar `500` ile, iç detay (stack trace,
DB bağlantı dizesi vb.) SIZDIRMADAN sabit bir mesajla döner. Bilinmeyen
route'lar `404` döner. Doğrulama hataları alan bazlı, okunabilir bir
gövde ile `400` döner (bkz. `<alan>.validation.ts` dosyaları).

## Geliştirme sırasında keşif

```bash
cd backend
npm run dev
# Sonra tarayıcıda: http://localhost:3001/api-docs
```

Swagger UI, tüm uçları gerçek şemalarıyla listeler ve doğrudan
tarayıcıdan istek göndermeye izin verir (token'ı "Authorize" butonuyla
girin).
