import { ApiError } from '../../utils/apiError';
import { PeopleCreateInput, PeopleUpdateInput } from './people.types';

export const parsePeopleListQuery = (query: Record<string, unknown>) => {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(query.limit ?? '10'), 10) || 10),
  );

  const search =
    typeof query.search === 'string' && query.search.trim().length > 0
      ? query.search.trim()
      : undefined;

  return { page, limit, search };
};

export interface FieldError {
  field: string;
  message: string;
}

const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 200;
const MAX_PHONE_LENGTH = 30;
const MAX_USERNAME_LENGTH = 100;
const MAX_TELEGRAM_ID_LENGTH = 64;
// Platform'un GERCEK kurali (PersonnelFormModal.tsx): minimum karakter
// sayisi kurali YOKTUR. Sadece CREATE'te zorunlu; EDIT'te bos = degisiklik
// yok. Bu backend UPDATE endpoint'i icin: alan gonderilirse (undefined
// DEGILSE) bos OLAMAZ -- bos birakma niyeti frontend'de alani hic
// GONDERMEMEKLE ifade edilir (bkz. PersonEditModal payload olusturma).

// E-posta icin basit ama gercekci bir format kontrolu (RFC'nin tamamini
// uygulamaya CALISMAZ, sadece acik bicimsizlikleri yakalar).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rol degerleri UYDURULMADI: projede zaten geçen (PEOPLE_ROLE_LABELS ile
// ayni, IQV Platform roleAccess.tsx ROLE_PERMISSIONS ile BIREBIR ayni) rol
// kumesi.
const KNOWN_ROLES = new Set([
  'superadmin',
  'companyadmin',
  'organizationadmin',
  'admin',
  'user',
]);

// Durum degerleri UYDURULMADI: IQV Platform'un kendi
// PERSONNEL_STATUS_BADGE mapping'inde taninan TUM gercek degerler (Turkce
// varyantlar dahil, cunku bu ekosistemde bazi kayitlarda Turkce ham deger
// gorulebiliyor).
const KNOWN_STATUSES = new Set([
  'active',
  'aktif',
  'inactive',
  'passive',
  'pasif',
]);

// "Yetkileri Düzenle" popup'inin TUM gercek izin kumesi -- backend
// middleware/auth.ts'teki ALL_PERMISSIONS ile BIREBIR ayni (Kisi/Ayarlar/
// Dictionary). Baska bir izin adi UYDURULMADI; bu liste degisirse tek
// kaynak middleware/auth.ts'teki PermissionKey/ALL_PERMISSIONS'tir.
const KNOWN_PERMISSIONS = new Set([
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
]);

const isBlank = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim().length === 0;

// TURN: "Personel Oluştur" -- Platform'un GERÇEK create-form kuralıyla
// BİREBİR aynı zorunlu alan kümesi: Kullanıcı Adı / Şifre / Ad Soyad /
// E-posta (bkz. Platform Frontend/dashboard/src/components/settings/
// PersonnelFormModal.tsx). Diğer alanlar (phone/telegram_id/company_name/
// role/status/permissions) `validatePeopleUpdatePayload` ile AYNI kural ve
// karakter sınırlarını kullanır -- KNOWN_ROLES/KNOWN_STATUSES/
// KNOWN_PERMISSIONS UYDURULMADI, yukarıdaki TEK kaynak tekrar kullanılır.
// role/status gönderilmezse Platform'un GERÇEK varsayılanı ('user' /
// 'active') uygulanır (bkz. PersonnelFormModal.tsx EMPTY_PERSONNEL_FORM).
export const validatePeopleCreatePayload = (
  body: Record<string, unknown>,
): PeopleCreateInput => {
  const errors: FieldError[] = [];
  let username = '';
  let password = '';
  let fullName = '';
  let email = '';

  if (isBlank(body.username)) {
    errors.push({ field: 'username', message: 'Kullanıcı adı zorunludur.' });
  } else if ((body.username as string).trim().length > MAX_USERNAME_LENGTH) {
    errors.push({
      field: 'username',
      message: `Kullanıcı adı en fazla ${MAX_USERNAME_LENGTH} karakter olabilir.`,
    });
  } else {
    username = (body.username as string).trim();
  }

  // Platform'un GERÇEK kuralı: CREATE'te zorunlu, MINIMUM KARAKTER SAYISI
  // KURALI YOKTUR (kaldırılmıştır) -- tek karakterlik bir şifre de geçerlidir.
  if (isBlank(body.password)) {
    errors.push({ field: 'password', message: 'Şifre zorunludur.' });
  } else {
    password = body.password as string;
  }

  if (isBlank(body.full_name)) {
    errors.push({ field: 'full_name', message: 'Ad Soyad zorunludur.' });
  } else if ((body.full_name as string).trim().length > MAX_NAME_LENGTH) {
    errors.push({
      field: 'full_name',
      message: `Ad Soyad en fazla ${MAX_NAME_LENGTH} karakter olabilir.`,
    });
  } else {
    fullName = (body.full_name as string).trim();
  }

  if (isBlank(body.email)) {
    errors.push({ field: 'email', message: 'E-posta zorunludur.' });
  } else if (!EMAIL_PATTERN.test((body.email as string).trim())) {
    errors.push({
      field: 'email',
      message: 'Geçerli bir e-posta adresi giriniz.',
    });
  } else if ((body.email as string).trim().length > MAX_EMAIL_LENGTH) {
    errors.push({
      field: 'email',
      message: `E-posta en fazla ${MAX_EMAIL_LENGTH} karakter olabilir.`,
    });
  } else {
    email = (body.email as string).trim().toLowerCase();
  }

  const result: PeopleCreateInput = {
    username,
    password,
    full_name: fullName,
    email,
  };

  if (body.telegram_id !== undefined) {
    if (body.telegram_id === null || body.telegram_id === '') {
      result.telegram_id = null;
    } else if (typeof body.telegram_id !== 'string') {
      errors.push({
        field: 'telegram_id',
        message: 'Telegram ID metin olmalıdır.',
      });
    } else if (body.telegram_id.trim().length > MAX_TELEGRAM_ID_LENGTH) {
      errors.push({
        field: 'telegram_id',
        message: `Telegram ID en fazla ${MAX_TELEGRAM_ID_LENGTH} karakter olabilir.`,
      });
    } else {
      result.telegram_id = body.telegram_id.trim();
    }
  }

  if (body.company_name !== undefined) {
    if (body.company_name === null || body.company_name === '') {
      result.company_name = '';
    } else if (typeof body.company_name !== 'string') {
      errors.push({ field: 'company_name', message: 'Firma metin olmalıdır.' });
    } else if (body.company_name.trim().length > MAX_NAME_LENGTH) {
      errors.push({
        field: 'company_name',
        message: `Firma en fazla ${MAX_NAME_LENGTH} karakter olabilir.`,
      });
    } else {
      result.company_name = body.company_name.trim();
    }
  }

  if (body.phone !== undefined) {
    if (body.phone === null || body.phone === '') {
      result.phone = null;
    } else if (typeof body.phone !== 'string') {
      errors.push({ field: 'phone', message: 'Telefon metin olmalıdır.' });
    } else if (body.phone.trim().length > MAX_PHONE_LENGTH) {
      errors.push({
        field: 'phone',
        message: `Telefon en fazla ${MAX_PHONE_LENGTH} karakter olabilir.`,
      });
    } else {
      result.phone = body.phone.trim();
    }
  }

  // Platform'un GERÇEK varsayılanı: role gönderilmezse 'user'.
  if (body.role !== undefined) {
    const roleKey =
      typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';
    if (!roleKey || !KNOWN_ROLES.has(roleKey)) {
      errors.push({ field: 'role', message: 'Geçersiz rol değeri.' });
    } else {
      result.role = roleKey;
    }
  } else {
    result.role = 'user';
  }

  // Platform'un GERÇEK varsayılanı: status gönderilmezse 'active'.
  if (body.status !== undefined) {
    const statusKey =
      typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    if (!statusKey || !KNOWN_STATUSES.has(statusKey)) {
      errors.push({ field: 'status', message: 'Geçersiz durum değeri.' });
    } else {
      result.status = statusKey;
    }
  } else {
    result.status = 'active';
  }

  if (body.permissions !== undefined) {
    if (!Array.isArray(body.permissions)) {
      errors.push({
        field: 'permissions',
        message: 'Yetkiler bir liste olmalıdır.',
      });
    } else {
      const invalid = body.permissions.filter(
        (item) => typeof item !== 'string' || !KNOWN_PERMISSIONS.has(item),
      );
      if (invalid.length > 0) {
        errors.push({
          field: 'permissions',
          message: 'Geçersiz yetki değeri.',
        });
      } else {
        result.permissions = body.permissions as string[];
      }
    }
  } else {
    // GÜVENLİ VARSAYILAN: Platform'un EMPTY_PERSONNEL_FORM'uyla AYNI --
    // yeni kullanıcıda hiçbir Kişi/Ayarlar/Dictionary yetkisi yoktur.
    result.permissions = [];
  }

  if (errors.length > 0) {
    throw ApiError.badRequest('Girilen bilgiler geçersiz.', errors);
  }

  return result;
};

export const validatePeopleUpdatePayload = (
  body: Record<string, unknown>,
): PeopleUpdateInput => {
  const errors: FieldError[] = [];
  const result: PeopleUpdateInput = {};

  // TURN: Platform parity -- parola artik desteklenir. Platform'un GERCEK
  // davranisiyla BIREBIR ayni: alan hic gonderilmezse (undefined)
  // dokunulmaz; gonderilirse bos OLAMAZ (bos = "degistirme" niyeti, bu
  // niyet frontend'de alani PAYLOAD'DAN COKARTMAKLA ifade edilir, bos
  // string GONDERMEKLE degil). Minimum karakter sayisi kurali YOKTUR
  // (Platform'un kendi yorumu: "MINIMUM KARAKTER SAYISI KURALI YOKTUR").
  if (body.password !== undefined) {
    if (isBlank(body.password)) {
      errors.push({
        field: 'password',
        message:
          'Şifre alanı gönderildiyse boş olamaz (değiştirmek istemiyorsanız bu alanı hiç göndermeyin).',
      });
    } else {
      result.password = body.password as string;
    }
  }

  if (body.telegram_id !== undefined) {
    if (body.telegram_id === null || body.telegram_id === '') {
      result.telegram_id = null;
    } else if (typeof body.telegram_id !== 'string') {
      errors.push({
        field: 'telegram_id',
        message: 'Telegram ID metin olmalıdır.',
      });
    } else if (body.telegram_id.trim().length > MAX_TELEGRAM_ID_LENGTH) {
      errors.push({
        field: 'telegram_id',
        message: `Telegram ID en fazla ${MAX_TELEGRAM_ID_LENGTH} karakter olabilir.`,
      });
    } else {
      result.telegram_id = body.telegram_id.trim();
    }
  }

  if (body.company_name !== undefined) {
    if (body.company_name === null || body.company_name === '') {
      result.company_name = '';
    } else if (typeof body.company_name !== 'string') {
      errors.push({ field: 'company_name', message: 'Firma metin olmalıdır.' });
    } else if (body.company_name.trim().length > MAX_NAME_LENGTH) {
      errors.push({
        field: 'company_name',
        message: `Firma en fazla ${MAX_NAME_LENGTH} karakter olabilir.`,
      });
    } else {
      result.company_name = body.company_name.trim();
    }
  }

  if (body.username !== undefined) {
    if (isBlank(body.username)) {
      errors.push({ field: 'username', message: 'Kullanıcı adı boş olamaz.' });
    } else if ((body.username as string).trim().length > MAX_USERNAME_LENGTH) {
      errors.push({
        field: 'username',
        message: `Kullanıcı adı en fazla ${MAX_USERNAME_LENGTH} karakter olabilir.`,
      });
    } else {
      result.username = (body.username as string).trim();
    }
  }

  if (body.full_name !== undefined) {
    if (isBlank(body.full_name)) {
      errors.push({ field: 'full_name', message: 'Ad Soyad boş olamaz.' });
    } else if ((body.full_name as string).trim().length > MAX_NAME_LENGTH) {
      errors.push({
        field: 'full_name',
        message: `Ad Soyad en fazla ${MAX_NAME_LENGTH} karakter olabilir.`,
      });
    } else {
      result.full_name = (body.full_name as string).trim();
    }
  }

  if (body.email !== undefined) {
    if (isBlank(body.email)) {
      errors.push({ field: 'email', message: 'E-posta boş olamaz.' });
    } else if (!EMAIL_PATTERN.test((body.email as string).trim())) {
      errors.push({
        field: 'email',
        message: 'Geçerli bir e-posta adresi giriniz.',
      });
    } else if ((body.email as string).trim().length > MAX_EMAIL_LENGTH) {
      errors.push({
        field: 'email',
        message: `E-posta en fazla ${MAX_EMAIL_LENGTH} karakter olabilir.`,
      });
    } else {
      result.email = (body.email as string).trim().toLowerCase();
    }
  }

  if (body.phone !== undefined) {
    if (body.phone === null || body.phone === '') {
      result.phone = null;
    } else if (typeof body.phone !== 'string') {
      errors.push({ field: 'phone', message: 'Telefon metin olmalıdır.' });
    } else if (body.phone.trim().length > MAX_PHONE_LENGTH) {
      errors.push({
        field: 'phone',
        message: `Telefon en fazla ${MAX_PHONE_LENGTH} karakter olabilir.`,
      });
    } else {
      result.phone = body.phone.trim();
    }
  }

  if (body.role !== undefined) {
    const roleKey =
      typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';
    if (!roleKey || !KNOWN_ROLES.has(roleKey)) {
      errors.push({ field: 'role', message: 'Geçersiz rol değeri.' });
    } else {
      result.role = roleKey;
    }
  }

  if (body.status !== undefined) {
    const statusKey =
      typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    if (!statusKey || !KNOWN_STATUSES.has(statusKey)) {
      errors.push({ field: 'status', message: 'Geçersiz durum değeri.' });
    } else {
      result.status = statusKey;
    }
  }

  if (body.permissions !== undefined) {
    if (!Array.isArray(body.permissions)) {
      errors.push({
        field: 'permissions',
        message: 'Yetkiler bir liste olmalıdır.',
      });
    } else {
      const invalid = body.permissions.filter(
        (item) => typeof item !== 'string' || !KNOWN_PERMISSIONS.has(item),
      );
      if (invalid.length > 0) {
        errors.push({
          field: 'permissions',
          message: 'Geçersiz yetki değeri.',
        });
      } else {
        result.permissions = body.permissions as string[];
      }
    }
  }

  if (errors.length > 0) {
    throw ApiError.badRequest('Girilen bilgiler geçersiz.', errors);
  }

  if (Object.keys(result).length === 0) {
    throw ApiError.badRequest('Güncellenecek en az bir alan gönderilmelidir.');
  }

  return result;
};
