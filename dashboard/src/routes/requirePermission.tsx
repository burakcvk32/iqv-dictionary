import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { PermissionKey, resolvePermissions } from '../utils/permissions';
import AccessDeniedPage from '../components/accessDeniedPage';

export type RequirePermissionProps = {
  permission: PermissionKey;
  children: JSX.Element;
};

// KÖK NEDEN / BU TURUN EKLEDİĞİ KURAL: mevcut sidebar filtrelemesi
// (`layout/index.tsx` -> `visibleSidebar`) SADECE menü öğesini gizliyordu
// -- URL'yi elle yazan bir kullanıcı (izni olmasa bile) sayfayı
// GÖRÜYORDU (Dictionary/Settings/Users sayfa bileşenlerinin kendisi
// hiçbir zaman izne göre render'i ENGELLEMİYORDU, yalnızca sayfa İÇİNDEKİ
// tekil buton/sütunları koşullu gösteriyordu). Bu bileşen GERÇEK bir
// route-level authorization katmanı ekler: `RequireAuth`in İÇİNDE (yani
// yalnızca authenticated olduğu KESİNLEŞTİKTEN SONRA) kullanılır,
// backend'deki (middleware/auth.ts) AYNI `PermissionKey` sözleşmesini
// (users.read/settings.read/dictionary.read) paylaşan frontend
// `resolvePermissions`'ı (utils/permissions.ts) kullanır -- yeni bir izin
// ismi UYDURULMADI, backend zaten bunları AYRICA (asıl güvenlik katmanı
// olarak) zorunlu kılmaya devam ediyor.
const RequirePermission = ({
  permission,
  children,
}: RequirePermissionProps) => {
  const admin = useSelector((state: RootState) => state.admin);
  const permissions = resolvePermissions(admin);

  if (!permissions.has(permission)) {
    return <AccessDeniedPage />;
  }

  return children;
};

export default RequirePermission;
