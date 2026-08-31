import { ObjectId } from 'mongodb';
import {
  DictionaryCreateInput,
  DictionaryListQuery,
  DictionaryListResult,
  DictionaryRecord,
  DictionaryRepository,
  DictionaryStats,
  DictionaryUpdateInput,
  DuplicateCheckInput,
} from '../../modules/dictionary/dictionary.types';
import {
  groupVariantPatternSource,
  normalizeGroupKey,
} from '../../modules/dictionary/group-normalize';
import {
  buildExactInsensitiveRegex,
  buildSearchRegex,
  turkishLower,
} from '../../utils/regex';

// Simple in-memory stand-in for MongoDictionaryRepository, used by tests so
// the HTTP layer / service / validation / auth can be exercised end-to-end
// with supertest without requiring a running MongoDB instance.
export class MemoryDictionaryRepository implements DictionaryRepository {
  private records: DictionaryRecord[] = [];

  private groupMatches(recordGroup: string, filterGroup: string): boolean {
    const key = normalizeGroupKey(filterGroup);
    const pattern = new RegExp(
      groupVariantPatternSource(key, filterGroup),
      'i',
    );
    return pattern.test(recordGroup);
  }

  async list(query: DictionaryListQuery): Promise<DictionaryListResult> {
    let filtered = [...this.records];

    if (query.group) {
      filtered = filtered.filter((r) =>
        this.groupMatches(r.group, query.group as string),
      );
    }

    if (query.subgroup) {
      const exact = buildExactInsensitiveRegex(query.subgroup);
      filtered = filtered.filter(
        (r) => r.subgroup !== undefined && exact.test(r.subgroup),
      );
    }

    if (query.search) {
      const regex = buildSearchRegex(query.search);
      filtered = filtered.filter(
        (r) =>
          regex.test(r.english_term) ||
          regex.test(r.turkish_term) ||
          regex.test(r.description) ||
          regex.test(r.group) ||
          (r.subgroup ? regex.test(r.subgroup) : false),
      );
    }

    filtered.sort((a, b) => (a._id < b._id ? 1 : a._id > b._id ? -1 : 0));

    const total = filtered.length;
    const start = (query.page - 1) * query.limit;
    const data = filtered.slice(start, start + query.limit);

    return { data, total };
  }

  async findById(id: string): Promise<DictionaryRecord | null> {
    return this.records.find((r) => r._id === id) ?? null;
  }

  async findDuplicate(
    input: DuplicateCheckInput,
    excludeId?: string,
  ): Promise<DictionaryRecord | null> {
    const groupKey = normalizeGroupKey(input.group);
    const termExact = buildExactInsensitiveRegex(input.english_term);

    const candidates = this.records.filter(
      (r) =>
        r._id !== excludeId &&
        termExact.test(r.english_term) &&
        this.groupMatches(r.group, input.group),
    );

    if (groupKey === 'IQV_OS_AI') {
      return candidates[0] ?? null;
    }

    const targetSubgroup = turkishLower((input.subgroup ?? '').trim());
    return (
      candidates.find(
        (r) => turkishLower((r.subgroup ?? '').trim()) === targetSubgroup,
      ) ?? null
    );
  }

  // Gerçek MongoDictionaryRepository.create()/update() ile AYNI davranış
  // (bkz. dictionary.repository.mongo.ts) -- testlerin created_by_id/
  // updated_by_id/created_at/updated_at'i uçtan uca (supertest ile HTTP
  // katmanından) doğrulayabilmesi için bu in-memory repository de AYNI
  // konvansiyonu uygular. Gerçek repodaki ObjectId dönüşümüyle AYNI
  // geçerlilik kuralı: `actorId` GERÇEK bir ObjectId formatında değilse
  // (ör. bazı testlerin varsayılan 'u1' token'ı) sessizce atlanır.
  async create(
    input: DictionaryCreateInput,
    actorId?: string,
  ): Promise<DictionaryRecord> {
    const now = new Date();
    const record: DictionaryRecord = {
      _id: new ObjectId().toHexString(),
      english_term: input.english_term,
      turkish_term: input.turkish_term,
      description: input.description,
      group: input.group,
      subgroup: input.subgroup,
      created_at: now,
      updated_at: now,
    };
    if (actorId && ObjectId.isValid(actorId)) {
      const actorObjectId = new ObjectId(actorId).toHexString();
      record.created_by_id = actorObjectId;
      record.updated_by_id = actorObjectId;
    }
    this.records.push(record);
    return record;
  }

  async update(
    id: string,
    input: DictionaryUpdateInput,
    actorId?: string,
  ): Promise<DictionaryRecord | null> {
    const record = this.records.find((r) => r._id === id);
    if (!record) return null;

    if (input.english_term !== undefined)
      record.english_term = input.english_term;
    if (input.turkish_term !== undefined)
      record.turkish_term = input.turkish_term;
    if (input.description !== undefined) record.description = input.description;
    if (input.group !== undefined) record.group = input.group;
    if ('subgroup' in input) record.subgroup = input.subgroup;

    // Gerçek repository ile AYNI: created_at/created_by_id HİÇ değişmez,
    // updated_at her başarılı update'te yenilenir, updated_by_id güncelleyen
    // (geçerli bir ObjectId ise) actorId olur.
    record.updated_at = new Date();
    if (actorId && ObjectId.isValid(actorId)) {
      record.updated_by_id = new ObjectId(actorId).toHexString();
    }

    return record;
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.records.findIndex((r) => r._id === id);
    if (idx === -1) return false;
    this.records.splice(idx, 1);
    return true;
  }

  async stats(): Promise<DictionaryStats> {
    const iqvOsAi = this.records.filter((r) =>
      this.groupMatches(r.group, 'IQV OS AI'),
    ).length;
    const industrial = this.records.filter((r) =>
      this.groupMatches(r.group, 'Endüstriyel'),
    );

    const counts = new Map<string, number>();
    for (const r of industrial) {
      if (!r.subgroup) continue;
      counts.set(r.subgroup, (counts.get(r.subgroup) ?? 0) + 1);
    }

    return {
      total: this.records.length,
      iqv_os_ai: iqvOsAi,
      industrial: industrial.length,
      subgroups: Array.from(counts.entries()).map(([name, count]) => ({
        name,
        count,
      })),
    };
  }

  async distinctSubgroups(group: string): Promise<string[]> {
    const seen = new Map<string, string>();
    for (const r of this.records) {
      if (!this.groupMatches(r.group, group) || !r.subgroup) continue;
      const key = turkishLower(r.subgroup.trim());
      if (!seen.has(key)) seen.set(key, r.subgroup.trim());
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'tr'));
  }
}
