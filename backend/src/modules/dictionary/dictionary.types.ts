export interface DictionaryRecord {
  _id: string;
  english_term: string;
  turkish_term: string;
  description: string;
  group: string;
  subgroup?: string;
  // Audit metadata. TURN: `created_by` (string) KALDIRILDI -- yeni
  // standart `created_by_id`/`updated_by_id`dir. Mongo'da BSON ObjectId
  // olarak saklanır (bkz. dictionary.repository.mongo.ts: DictionaryDocument
  // + toRecord()); `_id` alanının kendisiyle AYNI konvansiyon izlenir --
  // driver'ın ObjectId tipi yalnızca repository sınırında kalır, buradaki
  // API/servis katmanı (`DictionaryRecord`) her zamanki gibi hex STRING
  // görür (`_id: doc._id.toHexString()` ile AYNI desen). `created_by_id`
  // oluşturan, `updated_by_id` en son güncelleyen (JWT `req.user._id`,
  // controller'dan `actorId` olarak geçirilir) kullanıcıdır. DÖRDÜ DE
  // optional: bu turdan ÖNCE oluşturulmuş eski kayıtlarda (eski `created_by`
  // alanı dahil) YOK OLABİLİR -- ne backend ne frontend bu durumda crash
  // ETMEMELİ. Eski kayıtlar OTOMATİK migrate EDİLMEZ.
  created_by_id?: string;
  updated_by_id?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface DictionaryCreateInput {
  english_term: string;
  turkish_term: string;
  description: string;
  group: string;
  subgroup?: string;
}

export type DictionaryUpdateInput = Partial<DictionaryCreateInput>;

export interface DictionaryListQuery {
  page: number;
  limit: number;
  search?: string;
  group?: string;
  subgroup?: string;
}

export interface DictionaryListResult {
  data: DictionaryRecord[];
  total: number;
}

export interface DictionarySubgroupCount {
  name: string;
  count: number;
}

export interface DictionaryStats {
  total: number;
  iqv_os_ai: number;
  industrial: number;
  subgroups: DictionarySubgroupCount[];
}

export interface DuplicateCheckInput {
  english_term: string;
  group: string;
  subgroup?: string;
}

export interface DictionaryRepository {
  list(query: DictionaryListQuery): Promise<DictionaryListResult>;
  findById(id: string): Promise<DictionaryRecord | null>;
  findDuplicate(
    input: DuplicateCheckInput,
    excludeId?: string,
  ): Promise<DictionaryRecord | null>;
  // `actorId`: işlemi yapan (JWT'deki, sahtelenemez) kullanıcının `_id`si
  // -- hex string olarak geçirilir, repository'de ObjectId'ye çevrilip
  // create()'te HEM created_by_id HEM updated_by_id'ye, update()'te
  // SADECE updated_by_id'ye yazılır (created_by_id update ile asla
  // değişmez). `undefined` olabilir (test/legacy token senaryosu) ya da
  // geçerli bir ObjectId değilse yok sayılır -- people.types.ts
  // PeopleRepository ile AYNI desen (create/update ikisi de actorId alır).
  create(
    input: DictionaryCreateInput,
    actorId?: string,
  ): Promise<DictionaryRecord>;
  update(
    id: string,
    input: DictionaryUpdateInput,
    actorId?: string,
  ): Promise<DictionaryRecord | null>;
  remove(id: string): Promise<boolean>;
  stats(): Promise<DictionaryStats>;
  distinctSubgroups(group: string): Promise<string[]>;
}
