import { Outlet } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';

// IQV Platform Login ekranı referans alınarak birebir uygulanmıştır (bkz.
// Platform Frontend/dashboard/src/components/auth/AuthLayout.tsx): düz krem
// arka plan (#f5f0e6) üzerinde ortalanmış kırık-beyaz bir kart (#fdfcf9).
// Eski dekoratif arka plan görseli/gradient kaldırıldı — Platform hiçbir
// görsel/gradient kullanmıyor, sade tek renk zemin kullanıyor.
//
// LOGIN HER ZAMAN AÇIK TEMA: Bu sayfanın arka planı/kartı SABİT açık renkler
// (#f5f0e6 / #fdfcf9) kullanır; ama içindeki AntD bileşenleri (Input,
// Input.Password, Alert, Button) renklerini AppThemeProvider'ın global
// `algorithm`'inden alır — global tercih koyu ise `darkAlgorithm` devreye
// girip input'ları siyah zeminli yapardı. Burada, YALNIZCA bu auth ağacını
// saran bir ConfigProvider ile `algorithm` açık temaya (`defaultAlgorithm`)
// SABİTLENİR — bu tamamen YERELDİR: `AppThemeProvider`'ın kendi state'ine ve
// localStorage'daki (`iqv-theme-mode`) kullanıcı tercihine DOKUNULMAZ;
// kullanıcı giriş yaptıktan sonra seçtiği koyu tema uygulamada aynen devam
// eder. `color-scheme: light` (bkz. index.css `.login-page`) ayrıca
// tarayıcının KENDİ UA widget'larının (autofill, caret, kaydırma çubuğu)
// koyu varyantını kullanmasını engeller. (Platform'un gerçek AuthLayout.tsx
// kaynağıyla birebir aynı yaklaşım.)
const AuthLayout = () => {
  return (
    <ConfigProvider theme={{ algorithm: antdTheme.defaultAlgorithm }}>
      <div
        className="login-page flex min-h-screen items-center justify-center px-4 py-8"
        style={{ backgroundColor: '#f5f0e6' }}
      >
        <div
          className="w-full rounded-2xl shadow-2xl sm:w-96"
          style={{
            backgroundColor: '#fdfcf9',
            maxWidth: 'calc(100vw - 2rem)',
            padding: '2.375rem 1rem 3rem',
          }}
        >
          <div className="space-y-4 p-8 md:space-y-6 md:p-10">
            <Outlet />
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default AuthLayout;
