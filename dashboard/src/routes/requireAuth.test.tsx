import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireAuth from './requireAuth';
import adminSlice from '../store/slices/adminSlice';
import { Admin } from '../interfaces/models/admin';
import { authApi } from '../services/authApi';
import { webRoutes } from './web';

// GERÇEK `src/routes/requireAuth.tsx` bileşeni test ediliyor -- "protected
// page flash" düzeltmesinin (bkz. bileşenin kendi yorum bloğu) tam olarak
// iddia ettiği gibi davrandığını doğrular: token VARLIĞI ile GEÇERLİLİĞİ
// arasındaki fark, `authApi.me()` GERÇEKTEN çözülene kadar korumalı içerik
// ASLA render edilmeden test edilir. Yalnızca ağ katmanı (`authApi`)
// mock'landı.
vi.mock('../services/authApi', () => ({
  authApi: { me: vi.fn() },
}));

const mockedAuthApi = vi.mocked(authApi, true);

function buildStore(admin: Admin | null) {
  return configureStore({
    reducer: combineReducers({ admin: adminSlice }),
    preloadedState: { admin },
  });
}

function renderProtected(admin: Admin | null) {
  const store = buildStore(admin);
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/dictionary']}>
        <Routes>
          <Route
            path="/dictionary"
            element={
              <RequireAuth>
                <div>KORUMALI-SAYFA-ICERIGI</div>
              </RequireAuth>
            }
          />
          <Route path={webRoutes.login} element={<div>LOGIN-SAYFASI</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('RequireAuth — AUTH-01/02/03/04/05/06/07 ("protected page flash" güvenlik regresyonu)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AUTH-01: token hiç yoksa, /auth/me hiç ÇAĞRILMADAN senkron olarak login sayfasına yönlendirir', () => {
    renderProtected(null);
    expect(screen.getByText('LOGIN-SAYFASI')).toBeInTheDocument();
    expect(screen.queryByText('KORUMALI-SAYFA-ICERIGI')).toBeNull();
    expect(mockedAuthApi.me).not.toHaveBeenCalled();
  });

  it('AUTH-05: token varken doğrulama BİTENE kadar (checking) korumalı içerik ASLA görünmez — flash yok', async () => {
    let resolveMe!: (value: unknown) => void;
    mockedAuthApi.me.mockReturnValue(
      new Promise((resolve) => {
        resolveMe = resolve;
      }) as never,
    );

    renderProtected({ token: 'gecerli-token' });

    // Dogrulama devam ederken: ne korumali icerik NE DE login sayfasi
    // gorunmemeli (bir Loader gorunur).
    expect(screen.queryByText('KORUMALI-SAYFA-ICERIGI')).toBeNull();
    expect(screen.queryByText('LOGIN-SAYFASI')).toBeNull();

    resolveMe({
      _id: 'u1',
      username: 'tester',
      full_name: 'Taze Isim',
      role: 'organizationadmin',
    });

    await waitFor(() =>
      expect(screen.getByText('KORUMALI-SAYFA-ICERIGI')).toBeInTheDocument(),
    );
  });

  it('AUTH-04: token geçerliyse (me() 200 döner) korumalı içerik render edilir', async () => {
    mockedAuthApi.me.mockResolvedValue({
      _id: 'u1',
      username: 'tester',
      full_name: 'Taze Isim',
      role: 'organizationadmin',
    } as never);

    renderProtected({ token: 'gecerli-token' });

    await waitFor(() =>
      expect(screen.getByText('KORUMALI-SAYFA-ICERIGI')).toBeInTheDocument(),
    );
    expect(mockedAuthApi.me).toHaveBeenCalledTimes(1);
  });

  it("AUTH-02/AUTH-06: /auth/me 401 dönerse (geçersiz/süresi dolmuş token) oturum TEMİZLENİR ve login'e yönlendirilir", async () => {
    mockedAuthApi.me.mockRejectedValue({ response: { status: 401 } });

    renderProtected({ token: 'gecersiz-token' });

    await waitFor(() =>
      expect(screen.getByText('LOGIN-SAYFASI')).toBeInTheDocument(),
    );
    expect(screen.queryByText('KORUMALI-SAYFA-ICERIGI')).toBeNull();
  });

  it('AUTH-07: /auth/me 403 dönerse oturum TEMİZLENMEZ (401 dışındaki hatalarda mevcut oturuma güvenilmeye devam edilir)', async () => {
    mockedAuthApi.me.mockRejectedValue({ response: { status: 403 } });

    renderProtected({ token: 'gecerli-ama-403-token' });

    await waitFor(() =>
      expect(screen.getByText('KORUMALI-SAYFA-ICERIGI')).toBeInTheDocument(),
    );
    expect(screen.queryByText('LOGIN-SAYFASI')).toBeNull();
  });

  it("ağ hatası/timeout (response yok) durumunda kullanıcı anında login'e ATILMAZ — mevcut oturuma güvenilir", async () => {
    mockedAuthApi.me.mockRejectedValue(new Error('Network Error'));

    renderProtected({ token: 'herhangi-bir-token' });

    await waitFor(() =>
      expect(screen.getByText('KORUMALI-SAYFA-ICERIGI')).toBeInTheDocument(),
    );
  });
});
