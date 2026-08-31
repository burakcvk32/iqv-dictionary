import { API_BASE_URL } from '../utils';

export const apiRoutes = {
  // Real local backend — the dashboard's own authentication. Never ReqRes.
  login: `${API_BASE_URL}/api/v1/auth/login`,
  // "Protected page flash" düzeltmesi -- token'in backend'de hâlâ gerçekten
  // geçerli olduğunu (imza/expiry + kullanıcı hâlâ var mı/aktif mi)
  // doğrulamak için (bkz. backend `modules/auth/auth.routes.ts` -> yeni
  // `GET /me`). Yeni bir auth mimarisi değil -- mevcut login akışının
  // "kullanıcı hâlâ geçerli mi" kontrolünün ayrı bir GET olarak yeniden
  // kullanılabilir hale gelmiş hali.
  me: `${API_BASE_URL}/api/v1/auth/me`,
  // Real local backend — Kişi (People) screen, backed by MongoDB `iqvizyon-users`.
  people: `${API_BASE_URL}/api/v1/users`,
  dictionary: `${API_BASE_URL}/api/v1/dictionary`,
  dictionaryStats: `${API_BASE_URL}/api/v1/dictionary/stats`,
  dictionarySubgroups: `${API_BASE_URL}/api/v1/dictionary/subgroups`,
};
