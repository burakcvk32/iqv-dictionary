import { combineReducers, configureStore } from '@reduxjs/toolkit';
import adminSlice, { AdminState } from './slices/adminSlice';
import {
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// KASITLI OLARAK CONFIG.appName'DEN BAĞIMSIZ, SABİT bir değer: bu,
// redux-persist'in localStorage anahtarıdır (`persist:IQV`). CONFIG.appName
// yalnızca GÖRÜNEN uygulama adıdır (browser title, PWA manifest vb.) ve
// isimlendirme turlarında değişebilir — eğer bu anahtar CONFIG.appName'e
// bağlı kalsaydı, her görünen-ad değişikliğinde mevcut kullanıcıların
// tarayıcısındaki oturum/token verisi (eski anahtar altında) erişilemez hale
// gelir, yani "IQVizyon standardı" isimlendirme turu sessizce herkesi
// LOGOUT ederdi. Auth/persist davranışını KORUMAK için bu değer SABİTLENDİ.
const PERSIST_STORAGE_KEY = 'IQV';

const persistConfig = {
  key: PERSIST_STORAGE_KEY,
  storage,
};

const rootReducer = combineReducers({
  admin: adminSlice,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export type RootState = {
  admin: AdminState;
};
export type AppDispatch = typeof store.dispatch;
