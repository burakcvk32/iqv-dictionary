import bcrypt from 'bcryptjs';
import { Collection, Db, ObjectId } from 'mongodb';
import { env } from '../../config/env';
import {
  buildExactInsensitiveRegex,
  buildSearchRegex,
} from '../../utils/regex';
import {
  PeopleCreateInput,
  PeopleListQuery,
  PeopleListResult,
  PeopleRepository,
  PeopleUpdateInput,
  PersonRecord,
} from './people.types';

// Mongo document shape on disk. Deliberately has NO `password` field here —
// the projection below excludes it at the DB level, so it never even
// deserializes into this process, on top of never being mapped to the API
// response.
interface PersonDocument {
  _id: ObjectId;
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

// DB-level exclusion — belt and suspenders alongside never mapping these
// fields onto PersonRecord. Any of these fields, however named, never leave
// Mongo.
const SAFE_PROJECTION = {
  password: 0,
  password_hash: 0,
  hash: 0,
  salt: 0,
} as const;

const toRecord = (doc: PersonDocument): PersonRecord => ({
  _id: doc._id.toHexString(),
  username: doc.username,
  full_name: doc.full_name,
  email: doc.email,
  phone: doc.phone ?? null,
  role: doc.role,
  status: doc.status,
  permissions: doc.permissions,
  company_id: doc.company_id,
  organization_id: doc.organization_id,
  company_name: doc.company_name,
  telegram_id: doc.telegram_id ?? null,
});

export class MongoPeopleRepository implements PeopleRepository {
  private readonly collection: Collection<PersonDocument>;

  constructor(db: Db) {
    this.collection = db.collection<PersonDocument>(
      env.MONGODB_USERS_COLLECTION,
    );
  }

  async list(query: PeopleListQuery): Promise<PeopleListResult> {
    const filter: Record<string, unknown> = {};

    // TURN: satir-bazli kisitlama -- bkz. middleware/auth.ts
    // isFullPeopleListRole ve people.controller.ts (bu alani dolduran tek
    // yer). `scopeToUserId` gecersiz/eksikse GUVENLI VARSAYILAN: hicbir
    // kayit donmez (asla "kisitlamayi atlayip tam listeye dus" YAPILMAZ).
    if (query.scopeToUserId !== undefined) {
      if (!ObjectId.isValid(query.scopeToUserId)) {
        return { data: [], total: 0 };
      }
      filter._id = new ObjectId(query.scopeToUserId);
    }

    if (query.search) {
      const regex = buildSearchRegex(query.search);
      filter.$or = [
        { username: regex },
        { full_name: regex },
        { email: regex },
        { company_name: regex },
      ];
    }

    const skip = (query.page - 1) * query.limit;

    const [docs, total] = await Promise.all([
      this.collection
        .find(filter, { projection: SAFE_PROJECTION })
        .sort({ _id: -1 })
        .skip(skip)
        .limit(query.limit)
        .toArray(),
      this.collection.countDocuments(filter),
    ]);

    return { data: docs.map(toRecord), total };
  }

  async findById(id: string): Promise<PersonRecord | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: SAFE_PROJECTION },
    );

    return doc ? toRecord(doc) : null;
  }

  async findByUsername(
    username: string,
    excludeId?: string,
  ): Promise<PersonRecord | null> {
    const filter: Record<string, unknown> = {
      username: buildExactInsensitiveRegex(username),
    };

    if (excludeId && ObjectId.isValid(excludeId)) {
      filter._id = { $ne: new ObjectId(excludeId) };
    }

    const doc = await this.collection.findOne(filter, {
      projection: SAFE_PROJECTION,
    });

    return doc ? toRecord(doc) : null;
  }

  // TURN: "Personel Oluştur" -- `update()`'teki AYNI parola hash'leme
  // (bcryptjs, salt-round 10) ve role/status/permissions ->
  // `user_dictionary.*` yansıtma konvansiyonu create'te de uygulanır; yeni
  // bir alan/konvansiyon UYDURULMADI. `created_at`/`created_by`,
  // `update()`'in zaten yazdığı `updated_at`/`updated_by` ile AYNI
  // isimlendirme deseninin create karşılığıdır.
  async create(
    input: PeopleCreateInput,
    actorId?: string,
  ): Promise<PersonRecord> {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const role = input.role ?? 'user';
    const status = input.status ?? 'active';
    const permissions = input.permissions ?? [];
    const now = new Date();

    const doc: Record<string, unknown> = {
      username: input.username,
      password: passwordHash,
      full_name: input.full_name,
      email: input.email,
      phone: input.phone ?? null,
      telegram_id: input.telegram_id ?? null,
      company_name: input.company_name ?? '',
      role,
      status,
      permissions,
      user_dictionary: { role, status, permissions },
      created_at: now,
      updated_at: now,
    };

    if (actorId) {
      doc.created_by = actorId;
      doc.updated_by = actorId;
    }

    const result = await this.collection.insertOne(
      doc as unknown as PersonDocument,
    );
    const created = await this.findById(result.insertedId.toHexString());
    // insertOne az önce basarili oldu; kayit bulunamamasi normalde imkansizdir.
    if (!created) {
      throw new Error('Kişi oluşturuldu ancak okunamadı.');
    }
    return created;
  }

  async update(
    id: string,
    input: PeopleUpdateInput,
    actorId?: string,
  ): Promise<PersonRecord | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const objectId = new ObjectId(id);
    const setFields: Record<string, unknown> = {};

    if (input.username !== undefined) setFields.username = input.username;
    if (input.full_name !== undefined) setFields.full_name = input.full_name;
    if (input.email !== undefined) setFields.email = input.email;
    if (input.phone !== undefined) setFields.phone = input.phone;
    if (input.telegram_id !== undefined) {
      setFields.telegram_id = input.telegram_id;
    }
    if (input.company_name !== undefined) {
      setFields.company_name = input.company_name;
    }

    // TURN: Platform parity -- sifre degisikligi. `auth.service.ts`'teki
    // GERCEK login karsilastirmasiyla (`bcrypt.compare`) UYUMLU calismasi
    // icin AYNI kutuphane (bcryptjs) ve makul bir salt-round degeriyle
    // hash'lenir. `input.password` yalnizca kullanici formda GERCEKTEN bir
    // sey yazdiginda (validation.ts: bos gonderilemez) buraya ulasir --
    // alan hic gonderilmediginde (undefined) mevcut hash'e DOKUNULMAZ.
    if (input.password !== undefined) {
      setFields.password = await bcrypt.hash(input.password, 10);
    }

    // role / status / permissions degistiginde -- user_platform BENZERI
    // KONVANSIYONA uyularak -- ayni degerler `user_dictionary` alt
    // belgesine de ($set ile, tekil path'ler uzerinden) yansitilir.
    // NOT (kok neden / tasarim karari): bu proje su ana kadar HICBIR yerde
    // `user_dictionary` alanini okumadi/yazmadi -- Dictionary backend'i
    // (auth + people modulleri) yalnizca UST DUZEY (legacy) `role`/`status`/
    // `permissions` alanlarini kullanir. Ancak Platform Frontend kaynak
    // kodunda (`routes/roleAccess.tsx`) KANITLANMIS gercek bir konvansiyon
    // var: `user_platform.{role,roles,permissions}` -- ayni paylasilan
    // `iqvizyon-users` koleksiyonunda modul-bazli izin alt-belgeleri
    // tutuluyor. `user_dictionary` bu konvansiyonun Dictionary'e ait
    // KARSILIGI olarak, VAR OLAN semaya uyumlu sekilde burada YAZILIYOR --
    // tekil dotted-path $set kullanildigi icin: (a) `user_dictionary` hic
    // yoksa sadece bu 3 alanla OLUSTURULUR, (b) zaten baska alt alanlari
    // varsa ONLARA DOKUNULMAZ, (c) `user_platform` KESINLIKLE hic
    // etkilenmez (bu path'e hicbir yazma islemi yapilmaz).
    if (input.role !== undefined) {
      setFields.role = input.role;
      setFields['user_dictionary.role'] = input.role;
    }
    if (input.status !== undefined) {
      setFields.status = input.status;
      setFields['user_dictionary.status'] = input.status;
    }
    if (input.permissions !== undefined) {
      setFields.permissions = input.permissions;
      setFields['user_dictionary.permissions'] = input.permissions;
    }

    setFields.updated_at = new Date();
    if (actorId) {
      setFields.updated_by = actorId;
    }

    if (Object.keys(setFields).length > 0) {
      await this.collection.updateOne({ _id: objectId }, { $set: setFields });
    }

    return this.findById(id);
  }

  async remove(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
      return false;
    }

    // Mevcut projede silme islemi icin TEK gercek emsal Dictionary
    // (terim) modulundeki `deleteOne` -- bkz.
    // modules/dictionary/dictionary.repository.mongo.ts `remove()`. Kisi
    // silme daha once HIC yoktu (soft-delete/is_deleted/deleted_at gibi bir
    // alan/konvansiyon projede HICBIR yerde bulunmuyor); bu yuzden kendi
    // basina yeni bir soft-delete standardi UYDURULMADI, mevcut TEK gercek
    // emsal (fiziksel silme) aynen izlendi.
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }
}
