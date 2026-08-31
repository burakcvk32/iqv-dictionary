import { apiRoutes } from '../routes/api';
import http from '../utils/http';
import { AdminUser } from '../interfaces/models/admin';

// "Protected page flash" düzeltmesi için eklendi -- token'in backend'de
// hâlâ gerçekten geçerli olduğunu (imza/expiry + kullanıcı hâlâ var mı/
// aktif mi -- bkz. backend `modules/auth/auth.service.ts` -> `me()`)
// doğrulamak için tek amaçlı, minimal bir servis. Diğer servislerle
// (peopleApi.ts / dictionaryApi.ts) AYNI desen: shared `http` axios
// instance kullanılır (Bearer token zaten request interceptor'dan
// otomatik eklenir, burada elle taşınmaz).
export interface MeResponse {
  success: boolean;
  user: AdminUser;
}

export const authApi = {
  me: () => http.get<MeResponse>(apiRoutes.me).then((res) => res.data.user),
};
