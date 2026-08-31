import { RootState } from '../store';

// ---------------------------------------------------------------------------
// BIRLESIK IZIN (PERMISSION) SISTEMI -- Kisi / Ayarlar / Dictionary
//
// backend/src/middleware/auth.ts'teki PermissionKey/ALL_PERMISSIONS/
// ROLE_PERMISSIONS ile BIREBIR ayni izin dizeleri ve cozumleme sirasi
// (once JWT/kullanicidaki ACIK "permissions" dizisi, yoksa rol->izin
// eslemesi). Bu, TEK bir gorunum kolayligidir -- asil guvenlik HER ZAMAN
// backend'dedir; buradaki amac yalnizca yetkisiz bir kullaniciya
// tiklanamaz bir sayfa/menu/buton GOSTERMEMEKTIR.
// ---------------------------------------------------------------------------
export type PermissionKey =
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'settings.read'
  | 'settings.update'
  | 'dictionary.read'
  | 'dictionary.create'
  | 'dictionary.update'
  | 'dictionary.delete';

export const ALL_PERMISSIONS: PermissionKey[] = [
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'settings.read',
  'settings.update',
  'dictionary.read',
  'dictionary.create',
  'dictionary.update',
  'dictionary.delete',
];

const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  superadmin: ALL_PERMISSIONS,
  companyadmin: ALL_PERMISSIONS,
  organizationadmin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  user: [],
};

// Eski (v0) kayitlarda `permissions` alani hic olmayabilir veya bos olabilir
// -- bu durumda role tabanli varsayilana DUSULUR (geriye donuk uyumluluk,
// crash ETMEZ).
export const resolvePermissions = (
  admin: RootState['admin'],
): Set<PermissionKey> => {
  const user = admin?.user;
  const explicit = (user?.permissions ?? []).filter(
    (item): item is string => typeof item === 'string',
  );

  if (explicit.length > 0) {
    return new Set(explicit as PermissionKey[]);
  }

  const role = (user?.role ?? '').trim().toLowerCase();
  return new Set(ROLE_PERMISSIONS[role] ?? []);
};

export const hasPermission = (
  admin: RootState['admin'],
  permission: PermissionKey,
): boolean => resolvePermissions(admin).has(permission);

// TURN: kendi hesabında yetki yükseltme (self privilege escalation) engeli
// -- Personel düzenleme ekranının frontend tarafı için. Backend'deki AYNI
// mantığın (backend/src/middleware/auth.ts isFullPeopleListRole/
// isSelfPrivilegeEscalationRestricted) BİREBİR görünüm karşılığı: YENİ bir
// rol listesi UYDURULMADI, yukarıdaki AYNI ROLE_PERMISSIONS anahtar
// kümesinden ('user' hariç) türetilir. Bu, SADECE bir UI kolaylığıdır
// (disabled görünüm) -- asıl, sahtelenemez kontrol her zaman backend'dedir
// (people.service.ts update()).
const ADMIN_TIER_ROLES: ReadonlySet<string> = new Set(
  Object.keys(ROLE_PERMISSIONS).filter((role) => role !== 'user'),
);

export const isAdminTierRole = (admin: RootState['admin']): boolean => {
  const role = (admin?.user?.role ?? '').trim().toLowerCase();
  return ADMIN_TIER_ROLES.has(role);
};
