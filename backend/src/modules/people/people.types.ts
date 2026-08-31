// "People" module = the real MongoDB-backed listing behind the dashboard's
// Kişi (Users) screen. Deliberately separate from modules/auth (which only
// looks up one user by username for login) even though both read the same
// `iqvizyon-users` collection — this module is read-only listing, auth is
// credential verification; no reason to couple them.
//
// TURN: Edit/Delete eklendi. `permissions` alanı artık burada da modellendi
// -- alan zaten gercek belgede/auth modulunde vardi (auth.types.ts
// UserRecord.permissions), Kisi listeleme ekrani simdiye kadar hic
// projekte etmemisti. "Dictionary yetkileri" formu bu alani kullanir;
// gecerli degerler middleware/auth.ts'teki GERCEK iki izin dizesidir
// (middleware/auth.ts PermissionKey) -- uydurulmadi.
export interface PersonRecord {
  _id: string;
  username: string;
  full_name?: string;
  email?: string;
  phone?: string | null;
  role?: string;
  status?: string;
  permissions?: string[];
  company_id?: string;
  organization_id?: string;
  company_name?: string;
  telegram_id?: string | null;
}

export interface PeopleListQuery {
  page: number;
  limit: number;
  search?: string;
  // TURN: satir-bazli (row-level) kisitlama -- bkz. middleware/auth.ts
  // isFullPeopleListRole. Yalnizca controller tarafindan, DOGRULANMIS
  // JWT'deki req.user._id'den doldurulur; client'in query/body'sinden
  // ASLA okunmaz (parsePeopleListQuery bu alani hic uretmez). Doluysa
  // repository sonucu bu tek _id'ye kisitlar.
  scopeToUserId?: string;
}

export interface PeopleListResult {
  data: PersonRecord[];
  total: number;
}

// Duzenleme formunun destekledigi TUM alanlar -- gercek modelde (ve auth
// modulunun UserRecord'unda) var olan alanlarla BIREBIR ayni. `password`
// KASITLI OLARAK burada YOK: bu turda parola degistirme akisi eklenmedi
// (bkz. people.validation.ts ust yorum).
// TURN: Platform parity icin `password` (opsiyonel, sadece dolu
// gonderildiginde bcrypt ile hash'lenip yazilir) ve `telegram_id` eklendi.
// Ikisi de Platform'un gercek appUser.tsx / PersonnelWritePayload
// modelinde KANITLANMIS alanlardir.
export interface PeopleUpdateInput {
  username?: string;
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

// TURN: "Personel Oluştur" akışı için create girdisi. Platform'un GERÇEK
// PersonnelFormModal.tsx create modunda ZORUNLU tuttuğu 4 alanla (Kullanıcı
// Adı, Şifre, Ad Soyad, E-posta) BİREBİR aynı; diğerleri (phone/telegram_id/
// company_name/role/status/permissions) PeopleUpdateInput ile AYNI, opsiyonel
// alanlardır -- yeni bir alan UYDURULMADI.
export interface PeopleCreateInput {
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

export interface PeopleRepository {
  list(query: PeopleListQuery): Promise<PeopleListResult>;
  findById(id: string): Promise<PersonRecord | null>;
  // `excludeId` verilirse o kaydin kendisi haric ayni kullanici adina sahip
  // baska bir kayit olup olmadigini kontrol eder (edit sirasinda benzersizlik
  // dogrulamasi icin).
  findByUsername(
    username: string,
    excludeId?: string,
  ): Promise<PersonRecord | null>;
  // TURN: "Personel Oluştur" -- `actorId` (JWT'deki `_id`) `created_by`/
  // `updated_by` alanlarına yazılır, `update()`'teki AYNI konvansiyon.
  create(input: PeopleCreateInput, actorId?: string): Promise<PersonRecord>;
  // `actorId`: islemi yapan (JWT'deki) kullanicinin _id'si -- `updated_by`
  // alanina yazilir. `undefined` olabilir (test/legacy token senaryosu).
  update(
    id: string,
    input: PeopleUpdateInput,
    actorId?: string,
  ): Promise<PersonRecord | null>;
  remove(id: string): Promise<boolean>;
}
