import { ConfigProviderProps } from 'antd/es/config-provider';
import trTRIntl from 'antd/locale/tr_TR';

/**
 * UYGULAMANIN TEK FONT STANDARDI — IQV Platform ile paylaşılan yazı tipi
 * yığını. Aynı yığın 3 yerde tekrar yazılır (tek kaynak burasıdır, biri
 * değişirse üçü birlikte güncellenir):
 *   - antd      -> aşağıda `antdConfig.theme.token.fontFamily`
 *   - IQV UI    -> components/theme/AppTheme.tsx `fontFamilyBase`
 *   - CSS/root  -> src/index.css `:root` (tarayıcı ilk boyamada JS'i
 *                  beklemesin diye orada da bir kez yazılır)
 */
export const IQV_FONT_FAMILY =
  "Bahnschrift, 'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif";

// Ana içerik kartlarının (Dictionary istatistik kartları, sayfa içerik
// kartı) paylaşılan köşe yuvarlaklığı — IQV Platform ile aynı değer.
// Modal/Form içindeki kartlar bu sabiti kullanmaz, kendi değerlerini korur.
export const PAGE_CARD_RADIUS = 8;

export const antdConfig: ConfigProviderProps = {
  theme: {
    token: {
      colorPrimary: CONFIG.theme.accentColor,
      // antd bileşenleri (Button/Input/Table/Modal/Select...) font ailesini
      // body'den miras almaz; kendi `fontFamily` token'ini kullanır.
      fontFamily: IQV_FONT_FAMILY,
    },
    // SADECE Pagination -- aktif sayfa kutusunun rengi, global
    // `colorPrimary`i (yukarıda, `CONFIG.theme.accentColor` = mor/indigo
    // #838cf9) miras aldığı için morumsu görünüyordu. antd v5'in
    // component-scoped token override'ı ile YALNIZCA Pagination için
    // `colorPrimary`/`colorPrimaryHover` mavi tona ezilir; global token
    // ve dolayısıyla diğer TÜM antd bileşenleri (Button/Input/Table/
    // Modal/Select vb.) DEĞİŞMEDEN mor kalır. Renk yeni uydurulmadı --
    // AYNI proje-standardı mavi (`--iqv-btn-blue`, bkz. src/index.css
    // "Güncelle" aksiyon butonu). Aktif kutunun zemini zaten antd
    // varsayılanında `colorBgContainer` (beyaz) -- bu değiştirilmedi.
    components: {
      Pagination: {
        colorPrimary: '#4a6fa5',
        // Aynı mavinin ~%90 tonu (index.css'teki hover/active
        // `color-mix(in srgb, X 90%, black)` desenindeki ORANLA AYNI,
        // elle hesaplanmış hex -- antd component-token override'ları
        // CSS `color-mix()` FONKSİYONUNU kabul etmez, düz hex gerekir).
        colorPrimaryHover: '#436495',
      },
    },
  },
  // Uygulama içeriği Türkçe; antd'nin kendi dahili metinleri (Pagination,
  // Popconfirm, boş durum vb.) da Türkçe olsun diye tr_TR locale kullanılır.
  locale: trTRIntl,
};
