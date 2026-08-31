# IQV Dictionary

IQV Dictionary; endüstriyel terimlerin merkezi olarak yönetilmesini,
gruplandırılmasını, yetkilendirilmesini ve uygulamalar tarafından API
üzerinden kullanılmasını sağlayan IQVizyon sözlük platformudur. Proje
iki alt projeden oluşur: `dashboard/` (React + Ant Design istemcisi) ve
`backend/` (Express + MongoDB API).

Sağ üstteki güneş/ay ikonuyla açık/koyu temayı, dünya ikonuyla (dil
seçici) Türkçe/İngilizce içeriği değiştirebilirsiniz. Üstteki arama
kutusu tüm sayfalarda tam metin arama yapar.

## Bileşenler

| Bileşen | Teknoloji | Konum |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Ant Design + Redux Toolkit | `dashboard/` |
| Backend | Node.js + Express + TypeScript (derlenmiş `dist/`) | `backend/` |
| Veritabanı | MongoDB (dışarıda çalışır, containerize edilmez) | `backend/.env` → `MONGODB_URI` |
| API Dokümantasyonu | Swagger UI + OpenAPI 3.0.3 (backend-native) | `backend/docs/openapi.yaml`, `/api-docs` |
| CI/CD | GitHub Actions — `IQV Dictionary CI`, `IQV Dictionary Docs` | `.github/workflows/` |

## Hızlı bağlantılar

- **Kurulum** — Docker/Native, Windows/Linux tek komutla kurulum: repo
  kökündeki `README.md` ("Installation") ve ayrıntılı akış için
  [Kurulum / Güncelleme / Kaldırma](deployment/installation.md).
- **API** — REST uç özeti için [Backend API](backend-api.md); canlı,
  her zaman kod ile senkron referans için çalışan backend'in
  `/api-docs` (Swagger UI) ve `/openapi.json` uçları.
  [Mimari](architecture.md) sayfası servisler arası iletişimi anlatır.
- **CI/CD** — pipeline aşamaları ve Quality Pipeline için
  [Git ve CI](development/git-ci.md); repo kökündeki `README.md`
  ("CI/CD") kısa özeti verir.
- Bir şey beklendiği gibi çalışmıyorsa önce
  [Sorun Giderme](troubleshooting.md) sayfasına bakın.

## İçindekiler

**Mimari** bölümü, `backend/` ve `dashboard/` alt projelerinin katman
yapısını, modüllerini ve aralarındaki iletişimi belgeler — bkz.
[Mimari](architecture.md).

**Kurulum / Dağıtım** bölümü, production seviyesinde tam otomatik
kurulum/güncelleme/kaldırma sistemini belgeler (Windows/Linux,
Docker/Native) — bkz. [Kurulum / Güncelleme / Kaldırma](deployment/installation.md)
ve repo kökündeki `README.md` dosyasının "Installation" bölümüne.

**Backend API** bölümü, gerçek REST uçlarını ve kimlik doğrulama
modelini özetler — bkz. [Backend API](backend-api.md) (ayrıntılı,
interaktif referans için `/api-docs` Swagger UI'ına bakın).

**Frontend / Dashboard** bölümü, dashboard'un modül/route/state
yapısını özetler — bkz. [Frontend / Dashboard](frontend.md).

**Geliştirme** bölümü, projeyi Git'e/CI'ya hazırlarken kurulan pipeline'ı belgeler:

- [Git ve CI](development/git-ci.md) — branch stratejisi, local pre-commit kontrolleri, CI/CD pipeline aşamaları
- [Test](development/testing.md) — Vitest tabanlı unit/integration/güvenlik testleri, nasıl çalıştırılır
- [Performans Testi](development/performance-testing.md) — k6 smoke/load/stress testleri
- [Sürüm Kontrol Listesi](development/release-checklist.md) — bir sürümü etiketlemeden önce kontrol edilmesi gerekenler

**Test Raporları** bölümü, projenin CI/Git hazırlık sürecinde gerçekten çalıştırılan
test/performans/UAT turlarının ham sonuçlarını içerir (bkz. her raporun kendi
"NOT EXECUTED" bölümleri — hiçbir sonuç uydurulmamıştır):

- [Test Raporu](testing/TEST_REPORT.md)
- [Performans Raporu](testing/PERFORMANCE_REPORT.md)
- [UAT Raporu](testing/UAT_REPORT.md)

## Geliştirici modu (hot reload)

```bash
# Backend (npm)
cd backend
npm ci
npm run dev

# Dashboard (pnpm)
cd dashboard
pnpm install --frozen-lockfile
pnpm run dev
```

Detaylı ortam değişkenleri için her alt projenin `.env.example` dosyasına bakın.

## Production kurulum (tek komut)

Geliştirici modunun aksine, production'da tüm sistemi (backend + dashboard,
Docker'lı veya Docker'sız) TEK komutla kurmak için:

```powershell
# Windows
.\scripts\windows\install.ps1
```

```bash
# Linux
./scripts/linux/install.sh
```

Ayrıntılar için bkz. [Kurulum / Güncelleme / Kaldırma](deployment/installation.md)
ve repo kökündeki `README.md`.
