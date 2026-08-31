import { Collection, Db, ObjectId } from 'mongodb';
import { env } from '../../config/env';
import {
  DictionaryCreateInput,
  DictionaryListQuery,
  DictionaryListResult,
  DictionaryRecord,
  DictionaryRepository,
  DictionaryStats,
  DictionaryUpdateInput,
  DuplicateCheckInput,
} from './dictionary.types';
import {
  groupVariantPatternSource,
  normalizeGroupKey,
} from './group-normalize';
import {
  buildExactInsensitiveRegex,
  buildSearchRegex,
  turkishLower,
} from '../../utils/regex';

// Default kept for tests / callers that don't have env loaded; the real
// app always resolves the collection name from MONGODB_DICTIONARY_COLLECTION.
export const DICTIONARY_COLLECTION = 'iqvizyon-dictionary';

const resolveCollectionName = (): string => env.MONGODB_DICTIONARY_COLLECTION;

// Mongo document shape on disk. `_id` is an ObjectId there; we always map to
// a string `_id` at the repository boundary so the rest of the app never
// touches the driver's types.
interface DictionaryDocument {
  _id: ObjectId;
  english_term: string;
  turkish_term: string;
  description: string;
  group: string;
  subgroup?: string | null;
  // Audit metadata -- bkz. dictionary.types.ts DictionaryRecord yorumu.
  // Mongo'da GERÇEK BSON ObjectId (string DEĞİL) -- `_id` alanının
  // kendisiyle AYNI tip. Eski kayıtlarda YOK OLABİLİR, bu yüzden hepsi
  // optional (eski `created_by: string` alanı bu turda KALDIRILDI, eski
  // kayıtlardaki o alana burada hiç dokunulmaz/okunmaz).
  created_by_id?: ObjectId;
  updated_by_id?: ObjectId;
  created_at?: Date;
  updated_at?: Date;
}

// `actorId` (JWT'deki hex string `_id`) GERÇEK bir ObjectId'ye çevrilebilir
// mi kontrol eder; degilse (eksik/gecersiz -- ör. test/legacy token)
// `undefined` doner ve audit alanina HIC YAZILMAZ (sahte/uydurma bir deger
// KONULMAZ). create() VE update() TARAFINDAN PAYLASILAN TEK donusum noktasi.
const toActorObjectId = (actorId?: string): ObjectId | undefined =>
  actorId && ObjectId.isValid(actorId) ? new ObjectId(actorId) : undefined;

const toRecord = (doc: DictionaryDocument): DictionaryRecord => ({
  _id: doc._id.toHexString(),
  english_term: doc.english_term,
  turkish_term: doc.turkish_term,
  description: doc.description,
  group: doc.group,
  subgroup: doc.subgroup ?? undefined,
  created_by_id: doc.created_by_id?.toHexString(),
  updated_by_id: doc.updated_by_id?.toHexString(),
  created_at: doc.created_at,
  updated_at: doc.updated_at,
});

export const isValidObjectId = (id: string): boolean => ObjectId.isValid(id);

export const ensureDictionaryIndexes = async (db: Db): Promise<void> => {
  const collection = db.collection<DictionaryDocument>(resolveCollectionName());

  // Non-destructive, non-unique performance indexes only. Duplicate rules
  // differ per group (see group-normalize.ts) so they are enforced in the
  // service layer rather than via a DB-level unique index, and we do not
  // know whether legacy data already contains duplicates.
  await Promise.all([
    collection.createIndex({ group: 1 }),
    collection.createIndex({ group: 1, subgroup: 1 }),
    collection.createIndex({ english_term: 1 }),
  ]);
};

export class MongoDictionaryRepository implements DictionaryRepository {
  private readonly collection: Collection<DictionaryDocument>;

  constructor(db: Db) {
    this.collection = db.collection<DictionaryDocument>(
      resolveCollectionName(),
    );
  }

  private buildGroupFilter(rawGroup: string) {
    const key = normalizeGroupKey(rawGroup);
    const pattern = groupVariantPatternSource(key, rawGroup);
    return { group: { $regex: pattern, $options: 'i' } };
  }

  async list(query: DictionaryListQuery): Promise<DictionaryListResult> {
    const filter: Record<string, unknown> = {};

    if (query.group) {
      Object.assign(filter, this.buildGroupFilter(query.group));
    }

    if (query.subgroup) {
      filter.subgroup = buildExactInsensitiveRegex(query.subgroup);
    }

    if (query.search) {
      const regex = buildSearchRegex(query.search);
      filter.$or = [
        { english_term: regex },
        { turkish_term: regex },
        { description: regex },
        { group: regex },
        { subgroup: regex },
      ];
    }

    const skip = (query.page - 1) * query.limit;

    const [docs, total] = await Promise.all([
      this.collection
        .find(filter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(query.limit)
        .toArray(),
      this.collection.countDocuments(filter),
    ]);

    return { data: docs.map(toRecord), total };
  }

  async findById(id: string): Promise<DictionaryRecord | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const doc = await this.collection.findOne({ _id: new ObjectId(id) });
    return doc ? toRecord(doc) : null;
  }

  async findDuplicate(
    input: DuplicateCheckInput,
    excludeId?: string,
  ): Promise<DictionaryRecord | null> {
    const groupKey = normalizeGroupKey(input.group);
    const filter: Record<string, unknown> = {
      english_term: buildExactInsensitiveRegex(input.english_term),
      ...this.buildGroupFilter(input.group),
    };

    if (excludeId && ObjectId.isValid(excludeId)) {
      filter._id = { $ne: new ObjectId(excludeId) };
    }

    const candidates = await this.collection.find(filter).limit(50).toArray();

    if (groupKey === 'IQV_OS_AI') {
      // subgroup is not used for this group — any term+group match is a dup.
      return candidates.length > 0 ? toRecord(candidates[0]) : null;
    }

    const targetSubgroup = turkishLower((input.subgroup ?? '').trim());
    const match = candidates.find(
      (doc) => turkishLower((doc.subgroup ?? '').trim()) === targetSubgroup,
    );

    return match ? toRecord(match) : null;
  }

  // TURN: created_by_id/updated_by_id/created_at/updated_at eklendi --
  // people.repository.mongo.ts create()'teki AYNI konvansiyon (isim +
  // davranış), YALNIZCA created_by_id/updated_by_id BSON ObjectId olarak
  // saklanır (people modülündeki string `created_by`/`created_by`'dan
  // FARKLI -- bu turun GERÇEK isteği). `now` HEM created_at HEM
  // updated_at'e yazılır (ilk oluşturmada ikisi EŞİTTİR); `actorId`
  // (JWT'deki req.user._id, controller'dan geçirilir) GEÇERLİ bir
  // ObjectId'ye çevrilebiliyorsa HEM created_by_id HEM updated_by_id'ye
  // yazılır (ilk oluşturmada ikisi de AYNI kullanıcıyı gösterir) -- yoksa
  // (ör. eski/test token senaryosu) hiçbiri eklenmez (sahte/boş bir değer
  // UYDURULMAZ). Frontend payload'ında (`DictionaryCreateInput`) bu
  // alanlar YOKTUR -- yalnızca backend tarafından, burada set edilir.
  async create(
    input: DictionaryCreateInput,
    actorId?: string,
  ): Promise<DictionaryRecord> {
    const now = new Date();
    const doc: Omit<DictionaryDocument, '_id'> = {
      english_term: input.english_term,
      turkish_term: input.turkish_term,
      description: input.description,
      group: input.group,
      subgroup: input.subgroup,
      created_at: now,
      updated_at: now,
    };

    const actorObjectId = toActorObjectId(actorId);
    if (actorObjectId) {
      doc.created_by_id = actorObjectId;
      doc.updated_by_id = actorObjectId;
    }

    const result = await this.collection.insertOne(doc as DictionaryDocument);
    return toRecord({ ...doc, _id: result.insertedId } as DictionaryDocument);
  }

  async update(
    id: string,
    input: DictionaryUpdateInput,
    actorId?: string,
  ): Promise<DictionaryRecord | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const update: Record<string, unknown> = { ...input };

    if ('subgroup' in input && input.subgroup === undefined) {
      // Explicitly clear subgroup (e.g. switching a record to IQV OS AI).
      delete update.subgroup;
      await this.collection.updateOne(
        { _id: new ObjectId(id) },
        { $unset: { subgroup: '' } },
      );
    }

    // Her başarılı güncellemede `updated_at` VE `updated_by_id` server
    // tarafından YENİDEN yazılır; `created_at`/`created_by_id` burada HİÇ
    // ele alınmaz (yalnızca create()'te set edilirler, update ile asla
    // değiştirilmezler) -- people.repository.mongo.ts update()'teki AYNI
    // konvansiyon (bkz. `setFields.updated_at = new Date();`). `req.body`
    // içinde created_by_id/updated_by_id/created_at/updated_at gönderilmiş
    // olsa bile buraya gelen `input` zaten yalnızca validateUpdatePayload'ın
    // (dictionary.validation.ts) allowlist'lediği düzenlenebilir alanları
    // içerir -- bu dört alan o fonksiyonda hiç okunmaz, bu yüzden client
    // tarafından ASLA overwrite edilemez; `updated_by_id` SADECE buradaki
    // GERÇEK `actorId`den (JWT) türetilir. `update` nesnesine eklendiği
    // için aşağıdaki "en az bir alan var mı" kontrolü artık HER ZAMAN
    // true'dur (yalnızca subgroup temizleme isteği gelse bile updated_at
    // yine de güncellenir).
    update.updated_at = new Date();

    const actorObjectId = toActorObjectId(actorId);
    if (actorObjectId) {
      update.updated_by_id = actorObjectId;
    }

    if (Object.keys(update).length > 0) {
      await this.collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: update },
      );
    }

    const doc = await this.collection.findOne({ _id: new ObjectId(id) });
    return doc ? toRecord(doc) : null;
  }

  async remove(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
      return false;
    }

    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  async stats(): Promise<DictionaryStats> {
    const iqvOsAiFilter = this.buildGroupFilter('IQV OS AI');
    const industrialFilter = this.buildGroupFilter('Endüstriyel');

    const [total, iqvOsAi, industrial, subgroupAgg] = await Promise.all([
      this.collection.countDocuments({}),
      this.collection.countDocuments(iqvOsAiFilter),
      this.collection.countDocuments(industrialFilter),
      this.collection
        .aggregate<{ _id: string; count: number }>([
          { $match: industrialFilter },
          {
            $match: {
              subgroup: { $exists: true, $nin: [null, ''] },
            },
          },
          { $group: { _id: '$subgroup', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ])
        .toArray(),
    ]);

    return {
      total,
      iqv_os_ai: iqvOsAi,
      industrial,
      subgroups: subgroupAgg.map((row) => ({
        name: row._id,
        count: row.count,
      })),
    };
  }

  async distinctSubgroups(group: string): Promise<string[]> {
    const values = await this.collection.distinct('subgroup', {
      ...this.buildGroupFilter(group),
      subgroup: { $exists: true, $nin: [null, ''] },
    });

    const seen = new Map<string, string>();
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      const key = turkishLower(trimmed);
      if (!seen.has(key)) {
        seen.set(key, trimmed);
      }
    }

    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'tr'));
  }
}
