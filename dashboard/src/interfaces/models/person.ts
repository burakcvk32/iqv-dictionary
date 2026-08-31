// Real MongoDB-backed record for the Kişi (People) screen. Never carries a
// password/hash/salt field (backend excludes it).
export interface Person {
  _id: string;
  username: string;
  full_name?: string;
  email?: string;
  phone?: string | null;
  role?: string;
  status?: string;
  // Dictionary yetkileri — backend'de zaten var olan gerçek alan
  // (auth.types.ts UserRecord.permissions ile aynı), Kişi listeleme daha
  // önce hiç projekte etmemişti. Gerçek değerler yalnızca
  // backend/src/middleware/auth.ts PermissionKey (bkz. backend
  // middleware/auth.ts requireDictionaryPermission).
  permissions?: string[];
  company_id?: string;
  organization_id?: string;
  company_name?: string;
  // Platform'un gercek appUser.tsx modelinde dogrulanan alan (telegramId /
  // telegram_id) -- Dictionary'de daha once hic modellenmemisti.
  telegram_id?: string | null;
}

export interface PeopleQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface PeoplePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PeopleListResponse {
  success: boolean;
  data: Person[];
  pagination: PeoplePagination;
}

export interface PersonResponse {
  success: boolean;
  data: Person;
}

// Düzenleme formunun gönderebileceği TÜM alanlar — backend
// people.validation.ts'teki allowlist ile birebir aynı. `password` KASITLI
// OLARAK yok: bu turda parola değiştirme akışı eklenmedi.
export interface PersonUpdateInput {
  username?: string;
  // Platform'un gercek PersonnelWritePayload semantigiyle BIREBIR ayni:
  // alan hic gonderilmezse (undefined) mevcut parola backend'de KORUNUR.
  // Bos string GONDERILMEZ -- form katmani (PersonEditModal) bos Sifre
  // alanini payload'dan tamamen CIKARIR.
  password?: string;
  full_name?: string;
  email?: string;
  phone?: string | null;
  telegram_id?: string | null;
  company_name?: string;
  role?: string;
  status?: string;
  permissions?: string[];
}

// TURN: "Personel Oluştur" -- backend'in GERÇEK create endpoint'inin
// (backend/src/modules/people/people.types.ts PeopleCreateInput) BİREBİR
// aynı zorunlu/opsiyonel alan kümesi. Platform'un GERÇEK create-form
// kuralıyla aynı: Kullanıcı Adı / Şifre / Ad Soyad / E-posta zorunlu,
// gerisi opsiyonel (role/status gönderilmezse backend 'user'/'active'
// varsayılanını uygular).
export interface PersonCreateInput {
  username: string;
  password: string;
  full_name: string;
  email: string;
  phone?: string | null;
  telegram_id?: string | null;
  company_name?: string;
  role?: string;
  status?: string;
  permissions?: string[];
}
