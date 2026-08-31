import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError';

export interface AuthenticatedUser {
  _id?: string;
  username?: string;
  role?: string;
  permissions?: string[];
  company_id?: string;
  organization_id?: string;
  [key: string]: unknown;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Real JWT authentication middleware (not a "does a header exist" check):
 *  1. reads the Authorization header
 *  2. extracts the Bearer token
 *  3. verifies the JWT signature against the configured secret
 *  4. verifies expiration (jwt.verify throws on an expired token)
 *  5. attaches the decoded user payload to req.user
 *  6. responds 401 for anything invalid/missing/expired
 */
export const createAuthMiddleware =
  (secret: string) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      next(ApiError.unauthorized('Yetkilendirme başlığı eksik veya geçersiz.'));
      return;
    }

    const token = header.slice('Bearer '.length).trim();

    if (!token) {
      next(ApiError.unauthorized('Oturum jetonu bulunamadı.'));
      return;
    }

    try {
      const decoded = jwt.verify(token, secret);

      if (typeof decoded === 'string') {
        req.user = { username: decoded };
      } else {
        req.user = decoded as AuthenticatedUser;
      }

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        next(
          ApiError.unauthorized(
            'Oturumunuzun süresi doldu, lütfen tekrar giriş yapın.',
          ),
        );
        return;
      }

      next(ApiError.unauthorized('Geçersiz oturum jetonu.'));
    }
  };

// ---------------------------------------------------------------------------
// BIRLESIK IZIN (PERMISSION) SISTEMI -- Kisi / Ayarlar / Dictionary
//
// KAYNAK: IQV Platform Frontend routes/roleAccess.tsx (USER_PERMISSIONS /
// ROLE_PERMISSIONS) ile BIREBIR ayni cozumleme sirasi (once JWT/kullanicidaki
// ACIK "permissions" dizisi, yoksa rol->izin eslemesi). Kisi (users.*) izin
// dizeleri onceki turda Platform'un GERCEK, kodda dogrulanmis
// konvansiyonundan alindi. Bu turda: (a) Dictionary'nin tek parca
// 'dictionary:write' izni, GERCEKTEN VAR OLAN ayri POST/PUT-PATCH/DELETE
// endpoint'leriyle birebir eslenecek sekilde dictionary.create/update/delete
// olarak AYRISTIRILDI (dictionary:read -> dictionary.read, isimlendirme
// tutarliligi icin users.* ile AYNI nokta-notasyonuna tasindi); (b) Ayarlar
// (settings.read/settings.update) EKLENDI.
//
// AYARLAR HAKKINDA DURUST NOT: `dashboard/src/components/settings/index.tsx`
// incelendiginde Ayarlar sayfasinin KENDI backend route'u OLMADIGI, sadece
// Dictionary modulunun GERCEK arama (GET /api/v1/dictionary) ve kayit
// olusturma (POST /api/v1/dictionary) endpoint'lerini farkli bir arayuzden
// cagirdigi goruldu. Bu yuzden settings.read/settings.update, Dictionary'nin
// PAYLASILAN list/create route'larinda dictionary.read/dictionary.create ile
// "VEYA" (requireAnyPermission) mantigiyla enforce edilir -- Ayarlar'a ozel,
// UYDURULMUS ikinci bir backend yüzeyi ACILMADI; bu iki izin, ayni fiziksel
// endpoint'e ikinci bir GERCEK giris yolu tanimlar (bkz. dictionary.routes.ts).
//
// UYARI: Bu, TEK guvenlik katmanidir. Frontend'deki gizleme/disabled durumu
// bir kolayliktir, asil kontrol HER ZAMAN burasidir.
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

// Platform'daki ROLE_PERMISSIONS ile BIREBIR ayni: superadmin/companyadmin/
// organizationadmin/admin tum izinlere sahiptir, 'user' rolunun VARSAYILAN
// olarak HICBIR izni yoktur -- bir kullanicinin gercekten belirli bir
// yetkiye sahip olmasi gerekiyorsa bu, ACIK bir permissions girisiyle
// (user_dictionary.permissions -> JWT permissions) saglanir, rol bazinda
// ORTUK bir istisna EKLENMEDI (boyle bir istisna Platform'un kendi kodunda
// da yok).
const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  superadmin: ALL_PERMISSIONS,
  companyadmin: ALL_PERMISSIONS,
  organizationadmin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  user: [],
};

// KOK NEDEN / BU TURUN EKLEDIGI KURAL: "Kisi" (people) listesi su ana
// kadar SADECE permission-gate kontrolu yapiyordu (requirePermission
// ('users.read')) -- yani `users.read` izni olan HERKES butun personel
// listesini goruyordu, rolu ne olursa olsun. Talep acikca ikinci, AYRI bir
// katman istiyor: 'user' rolundeki bir hesap -- Kisi izni acikca verilmis
// olsa BILE -- yalnizca KENDI kaydini gormeli; yonetici-katmani roller
// (superadmin/companyadmin/organizationadmin/admin) ise mevcut permission
// sistemi zaten izin veriyorsa tam listeyi gormeye devam eder. Bu, permission
// kontrolunun YERINE GECMEZ -- ONA EK, ikinci bir satir-bazli (row-level)
// kisitlamadir (bkz. modules/people/people.controller.ts -> list).
//
// Ikinci bir rol listesi UYDURULMADI: ayni ROLE_PERMISSIONS anahtar
// kumesinden ('user' haric) turetilir -- tek kaynak budur.
const FULL_PEOPLE_LIST_ROLES: ReadonlySet<string> = new Set(
  Object.keys(ROLE_PERMISSIONS).filter((role) => role !== 'user'),
);

// true -> bu kullanici Kisi listesinde TUM (izin verilen) kayitlari gorur.
// false -> (bilinmeyen roller DAHIL, guvenli varsayilan) yalnizca KENDI
// kaydini gormelidir -- cagiran taraf (people.controller.ts) bu durumda
// sorguyu req.user._id'ye (JWT'den, sahtelenemez) scope'lamalidir.
export const isFullPeopleListRole = (user: AuthenticatedUser): boolean => {
  const role =
    typeof user.role === 'string' ? user.role.trim().toLowerCase() : '';
  return FULL_PEOPLE_LIST_ROLES.has(role);
};

// KOK NEDEN / BU TURUN EKLEDIGI KURAL: Rol='user' bir hesap KENDI kaydini
// duzenlerken kendi rolunu (orn. 'admin' yaparak), kendi durumunu
// (Aktif/Pasif) veya kendi Erisim ve Yetkiler'ini (permissions) DEGISTIREMEZ
// -- bu bir privilege-escalation (yetki yukseltme) engelidir, satir-bazli
// GORME kisitlamasindan (isFullPeopleListRole) AYRI bir kuraldir. UCUNCU bir
// rol listesi UYDURULMADI: AYNI admin-tier rol kumesi (FULL_PEOPLE_LIST_ROLES)
// tekrar kullanilir -- admin-tier roller (superadmin/companyadmin/
// organizationadmin/admin) bu kisitlamaya tabi DEGILDIR (mevcut davranislari
// aynen devam eder); 'user' rolu VE (guvenli varsayilan olarak) taninmayan
// herhangi bir rol kisitlanir. Cagiran taraf (people.service.ts -> update)
// bunu SADECE actor KENDI kaydini (id esitligiyle, JWT'deki req.user._id
// uzerinden -- display name/username DEGIL) duzenlerken uygular; baskasinin
// kaydini duzenlerken bu kisitlama hic devreye girmez.
export const isSelfPrivilegeEscalationRestricted = (
  user: AuthenticatedUser,
): boolean => !isFullPeopleListRole(user);

export const resolvePermissions = (user: AuthenticatedUser): Set<string> => {
  const explicit = Array.isArray(user.permissions)
    ? user.permissions.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];

  if (explicit.length > 0) {
    return new Set(explicit);
  }

  const role =
    typeof user.role === 'string' ? user.role.trim().toLowerCase() : '';
  return new Set(ROLE_PERMISSIONS[role] ?? []);
};

/**
 * Tek bir izni zorunlu kilar. Kisi (people) modulunun list/update/delete ve
 * Dictionary modulunun read/create/update/delete route'larini korur --
 * frontend'deki ikon/menu gizleme bir kolayliktir, asil guvenlik BURADADIR.
 */
export const requirePermission =
  (permission: PermissionKey) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }

    const permissions = resolvePermissions(req.user);

    if (!permissions.has(permission)) {
      next(ApiError.forbidden('Bu işlem için yetkiniz yok.'));
      return;
    }

    next();
  };

/**
 * Verilenlerden EN AZ BIRI yeterlidir. Yalnizca Ayarlar sayfasinin,
 * Dictionary'nin PAYLASILAN list/create route'larina ikinci, GERCEK bir
 * giris yolu tanimlamasi icin kullanilir (bkz. yukaridaki "AYARLAR
 * HAKKINDA DURUST NOT").
 */
export const requireAnyPermission =
  (permissions: PermissionKey[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }

    const granted = resolvePermissions(req.user);

    if (!permissions.some((permission) => granted.has(permission))) {
      next(ApiError.forbidden('Bu işlem için yetkiniz yok.'));
      return;
    }

    next();
  };
