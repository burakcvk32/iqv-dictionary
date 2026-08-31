import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { RootState } from '../store';
import { login, logout } from '../store/slices/adminSlice';
import { webRoutes } from './web';
import { authApi } from '../services/authApi';
import Loader from '../components/loader';

export type RequireAuthProps = {
  children: JSX.Element;
};

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

// "PROTECTED PAGE FLASH" DÜZELTMESİ -- KÖK NEDEN: bu bileşen daha önce
// SADECE `admin` (redux-persist'ten senkron rehydrate edilen, token'in
// backend'de HÂLÂ geçerli olup olmadığını hiç doğrulamayan) truthy/null
// durumuna bakıyordu -- localStorage'daki eski/geçersiz bir token bile
// anında "authenticated" sayılıyor, korumalı sayfa hemen render
// ediliyor, SADECE sayfanın ilk API çağrısı 401 dönünce (`http.tsx`
// interceptor) `logout()` tetiklenip kullanıcı login'e atılıyordu --
// yani sayfa bir an için GERÇEKTEN görünüyordu. Bu turdaki düzeltme:
// token VARLIĞI ile token GEÇERLİLİĞİ ayrıştırılır -- token varsa
// backend'in KENDİ yeni `GET /api/v1/auth/me` endpoint'iyle
// (auth.routes.ts) GERÇEKTEN doğrulanır, bu doğrulama BİTMEDEN
// (`status === 'checking'`) `children` (korumalı sayfa) ASLA render
// EDİLMEZ.
const RequireAuth = ({ children }: RequireAuthProps) => {
  const admin = useSelector((state: RootState) => state.admin);
  const location = useLocation();
  const dispatch = useDispatch();
  const [status, setStatus] = useState<AuthStatus>('checking');

  useEffect(() => {
    // Token YOKSA (localStorage'da hiç girişi yoksa) gereksiz bir backend
    // çağrısı YAPILMAZ -- aşağıdaki render bloğundaki `!admin?.token`
    // kontrolü zaten senkron olarak login'e yönlendirir. Token rehydrate
    // sonrası değişirse (örn. başka bir sekmede login olundu) effect
    // yeniden çalışır ve YENİDEN doğrular.
    if (!admin?.token) {
      return;
    }

    let cancelled = false;

    authApi
      .me()
      .then((freshUser) => {
        if (cancelled) return;
        // Token geçerli VE kullanıcı hâlâ var/aktif -- `user`/`permissions`
        // login anındaki ESKİ değil, backend'den GELEN TAZE veriyle
        // yenilenir (aynı token korunur, yeniden login GEREKMEZ).
        dispatch(login({ token: admin.token, user: freshUser }));
        setStatus('authenticated');
      })
      .catch((error) => {
        if (cancelled) return;

        if (error?.response?.status === 401) {
          // Token geçersiz/süresi dolmuş/kullanıcı bulunamadı/pasif --
          // GERÇEK backend kararı budur (bkz. `auth.service.ts` -> `me()`).
          // Oturum tamamen temizlenir.
          dispatch(logout());
          setStatus('unauthenticated');
          return;
        }

        // Ağ hatası/timeout/5xx: token'i HEMEN geçersiz SAYMA (kullanıcıyı
        // sonsuz login döngüsüne sokmamak için) -- mevcut, daha önce
        // doğrulanmış session'a güvenmeye devam et.
        setStatus('authenticated');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.token]);

  // Token hiç yoksa (ilk yükleme) VEYA sonradan (örn. başka bir istekten
  // dönen 401 -> `http.tsx` interceptor -> `logout()`) `admin` null
  // olduysa: HER render'da senkron olarak kontrol edilir, korumalı
  // içerik ASLA görünmez.
  if (!admin?.token) {
    return <Navigate to={webRoutes.login} state={{ from: location }} replace />;
  }

  if (status === 'checking') {
    return <Loader />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to={webRoutes.login} state={{ from: location }} replace />;
  }

  return children;
};

export default RequireAuth;
