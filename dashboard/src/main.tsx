import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { persistStore } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react';
import Loader from './components/loader';
import { store } from './store';
import { injectStore } from './utils/http';
import { AppThemeProvider } from './components/theme/AppTheme';
import App from './App';
import './index.css';

const persistor = persistStore(store);
injectStore(store);

// NOT: dış statik <ConfigProvider {...antdConfig}> kaldırıldı — IQV Platform
// ile aynı yapı: `AppThemeProvider` (components/theme/AppTheme.tsx) artık
// `antdConfig`'i KENDİSİ uygular ve `algorithm`'i (açık/koyu) isDark state'i
// ile senkron tutar. antdConfig'in içeriği (colorPrimary, fontFamily, tr_TR
// locale) kaybolmadı — AppThemeProvider içinde aynen kullanılıyor.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppThemeProvider>
      <Provider store={store}>
        <PersistGate loading={<Loader />} persistor={persistor}>
          <App />
        </PersistGate>
      </Provider>
    </AppThemeProvider>
  </React.StrictMode>,
);
