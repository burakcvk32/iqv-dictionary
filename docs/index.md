# Dictionary Projesi Dokümantasyonu

Bu site, **Dictionary** (Türkçe/İngilizce endüstriyel terminoloji sözlüğü) projesinin
geliştirici dokümantasyonunu içerir: proje `dashboard/` (React + Ant Design) ve
`backend/` (Express + MongoDB) olmak üzere iki alt projeden oluşur.

## İçindekiler

**Kurulum / Dağıtım** bölümü, production seviyesinde tam otomatik
kurulum/güncelleme/kaldırma sistemini belgeler (Windows/Linux,
Docker/Native) — bkz. [Kurulum / Güncelleme / Kaldırma](deployment/installation.md)
ve repo kökündeki `README.md` dosyasının "Quick Start" bölümüne.

**Geliştirme** bölümü, projeyi Git'e/CI'ya hazırlarken kurulan pipeline'ı belgeler:

- [Git ve CI](development/git-ci.md) — branch stratejisi, local pre-commit kontrolleri, CI pipeline aşamaları
- [Test](development/testing.md) — Jest/Vitest tabanlı unit/integration/güvenlik testleri, nasıl çalıştırılır
- [Performans Testi](development/performance-testing.md) — k6 smoke/load/stress testleri
- [Sürüm Kontrol Listesi](development/release-checklist.md) — bir sürümü etiketlemeden önce kontrol edilmesi gerekenler

**Test Raporları** bölümü, projenin CI/Git hazırlık sürecinde gerçekten çalıştırılan
test/performans/UAT turlarının ham sonuçlarını içerir (bkz. her raporun kendi
"NOT EXECUTED" bölümleri — hiçbir sonuç uydurulmamıştır):

- [Test Raporu](testing/TEST_REPORT.md)
- [Performans Raporu](testing/PERFORMANCE_REPORT.md)
- [UAT Raporu](testing/UAT_REPORT.md)

## Hızlı Başlangıç (geliştirici modu — hot reload)

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

## Production Kurulum (tek komut)

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

Ayrıntılar için bkz. [Kurulum / Güncelleme / Kaldırma](deployment/installation.md).
