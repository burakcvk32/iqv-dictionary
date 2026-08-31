import { AxiosError } from 'axios';
import { toast } from 'sonner';

// Base URL for the IQV Dashboard's own backend (Dictionary, People, and
// other real modules).
//
// DEV: her zaman BOŞ (relative) — istekler `/api/v1/...` şeklinde, sayfanın
// KENDİ origin'ine (localhost:5173 VEYA LAN IP'si:5173, hangisiyle açıldıysa
// onunla) gider; Vite'ın kendi `/api` proxy'si (bkz. vite.config.ts) bunu
// sunucu tarafında gerçek backend'e (localhost:3001) iletir. Böylece LAN'dan
// açılan bir istemci, kendi yerel localhost'una YANLIŞLIKLA istek atmaz —
// `VITE_API_BASE_URL` dev'de KASITLI olarak yok sayılır.
// PROD: `VITE_API_BASE_URL` (build-time env) kullanılır — davranış değişmedi.
export const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001');

export enum NotificationType {
  ERROR = 'error',
  SUCCESS = 'success',
}

export const setPageTitle = (title: string) => {
  window.document.title = title;
};

export const showNotification = (
  message = 'Something went wrong',
  type: NotificationType = NotificationType.ERROR,
  description?: string,
) => {
  toast[type](message, {
    description: description,
  });
};

export const handleErrorResponse = (
  error: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  callback?: () => void,
  errorMessage?: string,
) => {
  console.error(error);

  if (!errorMessage) {
    errorMessage = 'Something went wrong';

    if (typeof error === 'string') {
      try {
        error = JSON.parse(error);
      } catch {
        // do nothing
      }
    }

    if (error instanceof AxiosError && error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error instanceof AxiosError && error?.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error?.message) {
      errorMessage = error.message;
    }
  }

  showNotification(
    errorMessage &&
      errorMessage.charAt(0).toUpperCase() + errorMessage.slice(1),
    NotificationType.ERROR,
  );

  if (callback) {
    return callback();
  }
};

// "Personeli Güncelle" modalındaki "Güncelle" aksiyon butonunun GÖRÜNÜMÜ --
// IQV Platform'un GERÇEK referans bileşeninden (Platform Frontend/dashboard/
// src/components/settings/PersonnelFormModal.tsx, `SAVE_BUTTON_STYLE`)
// BİREBİR aynı değerlerle taşınmıştır. Bilinçli olarak yalnızca GÖRÜNÜM
// burada tutulur; submit/loading/disabled ve API çağrısı davranışı
// bileşende olduğu gibi kalır.
export const SAVE_BUTTON_STYLE = {
  borderRadius: 6,
  height: 32,
  paddingInline: 16,
  fontWeight: 500,
} as const;

// "Erişim ve Yetkiler" tetikleyici alanının köşe yuvarlaklığı -- IQV
// Platform'un GERÇEK referans sabitinden (Platform Frontend/dashboard/src/
// utils/index.tsx, `PAGE_CARD_RADIUS`) BİREBİR aynı değerle taşınmıştır.
// Platform'da bu sabit PersonnelFormModal.tsx'teki "Erişim ve Yetkiler"
// tetikleyici butonunun `borderRadius`'unda da AYNEN kullanılır (bkz.
// components/users/PersonEditModal.tsx).
export const PAGE_CARD_RADIUS = 8;
