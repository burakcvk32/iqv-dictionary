import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import {
  IqvizyonProvider,
  webDarkTheme,
  webLightTheme,
} from '@iqvizyonui/react-components';
import { antdConfig, IQV_FONT_FAMILY } from '../../constants';

interface AppThemeContextValue {
  isDark: boolean;
  toggle: () => void;
}

const AppThemeContext = createContext<AppThemeContextValue>({
  isDark: false,
  toggle: () => {},
});

// IQV Platform ile AYNI localStorage anahtarı — bilinçli tercih: bu, iki
// uygulamanın kaynak koduna (bu dosya + Platform'un AppTheme.tsx) göre
// doğrulanmış, keyfi seçilmemiş bir değerdir.
const STORAGE_KEY = 'iqv-theme-mode';

const getInitialDark = (): boolean => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
  } catch {
    // localStorage may be unavailable; fall back to light.
  }
  return false;
};

/**
 * Uygulama geneli açık/koyu tema sağlayıcısı — IQV Platform'daki
 * `components/theme/AppTheme.tsx` ile birebir aynı mekanizma (kaynak kod
 * seviyesinde doğrulandı):
 *
 *  - Tercih `localStorage['iqv-theme-mode']` ('dark' | 'light') içinde
 *    tutulur; ilk ziyarette (veya değer okunamazsa) açık tema varsayılır —
 *    Platform'da da sistem/OS tercihine bakan bir mantık YOKTUR.
 *  - `<html data-theme-mode="dark|light">` özel CSS'in (bkz. layout.css)
 *    tema durumuna göre davranabilmesi için ayarlanır.
 *  - antd `ConfigProvider`'ın `algorithm`'i (`defaultAlgorithm` /
 *    `darkAlgorithm`) burada, TEK NOKTADA, isDark ile senkron değiştirilir —
 *    böylece Button/Input/Table/Modal/Select/Dropdown/Card gibi TÜM antd
 *    bileşenleri otomatik olarak yeniden renklenir (manuel karanlık CSS
 *    yazmaya gerek kalmaz). `antdConfig`'in kendi ayarları (colorPrimary,
 *    fontFamily, tr_TR locale) KORUNUR, yalnızca `algorithm` eklenir.
 */
export const AppThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState<boolean>(getInitialDark);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme-mode',
      isDark ? 'dark' : 'light',
    );
  }, [isDark]);

  const toggle = () => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      } catch {
        // Ignore persistence failures.
      }
      return next;
    });
  };

  /**
   * IQV Design System teması.
   *
   * NEDEN GEREKLİ: @iqvizyonui bileşenleri (SearchBox, Badge vb.) ölçülerini
   * ve renklerini CSS DEĞİŞKENLERİNDEN okur — bu değişkenleri DOM'a basan tek
   * yer `IqvizyonProvider`'dır. Sağlayıcı yoksa değişkenler tanımsız kalır ve
   * bileşenler kenarlıksız/stilsiz görünür.
   *
   * Kütüphanenin KENDİ açık/koyu tema nesnesi (`webLightTheme`/
   * `webDarkTheme`) OLDUĞU GİBİ kullanılır; tek istisna yazı tipi ailesidir —
   * uygulamanın tek font standardına eşitlenir. Diğer hiçbir token elle
   * ezilmez.
   *
   * `display: contents`: sağlayıcının kendi sarmalayıcı <div>'i mevcut
   * layout ölçülerini ETKİLEMEZ.
   */
  const iqvTheme = useMemo(
    () => ({
      ...(isDark ? webDarkTheme : webLightTheme),
      fontFamilyBase: IQV_FONT_FAMILY,
    }),
    [isDark],
  );

  const value = useMemo(() => ({ isDark, toggle }), [isDark]);

  return (
    <AppThemeContext.Provider value={value}>
      <ConfigProvider
        {...antdConfig}
        theme={{
          ...antdConfig.theme,
          algorithm: isDark
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
        }}
      >
        <IqvizyonProvider theme={iqvTheme} style={{ display: 'contents' }}>
          {children}
        </IqvizyonProvider>
      </ConfigProvider>
    </AppThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(AppThemeContext);
