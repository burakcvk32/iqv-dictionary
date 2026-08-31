import { ApiError } from '../../utils/apiError';
import {
  DictionaryCreateInput,
  DictionaryListQuery,
  DictionaryListResult,
  DictionaryRecord,
  DictionaryRepository,
  DictionaryStats,
  DictionaryUpdateInput,
} from './dictionary.types';
import {
  canonicalizeGroupForStorage,
  isIqvOsAiGroup,
  normalizeGroupKey,
} from './group-normalize';

const duplicateMessage = (group: string, subgroup?: string): string => {
  if (isIqvOsAiGroup(group)) {
    return `Bu terim "${group}" grubunda zaten kayıtlı.`;
  }

  if (subgroup) {
    return `Bu terim "${group}" grubunda "${subgroup}" alt grubunda zaten kayıtlı.`;
  }

  return `Bu terim "${group}" grubunda zaten kayıtlı.`;
};

export class DictionaryService {
  constructor(private readonly repository: DictionaryRepository) {}

  async list(query: DictionaryListQuery): Promise<DictionaryListResult> {
    return this.repository.list(query);
  }

  async getById(id: string): Promise<DictionaryRecord> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw ApiError.notFound('Sözlük kaydı bulunamadı.');
    }
    return record;
  }

  async stats(): Promise<DictionaryStats> {
    return this.repository.stats();
  }

  async subgroupsForGroup(group: string): Promise<string[]> {
    return this.repository.distinctSubgroups(group);
  }

  // `actorId`: JWT'deki req.user._id (controller'dan geçirilir) --
  // people.service.ts create() ile AYNI desen. Yalnızca repository.create()'e
  // aktarılır; bu katmanda başka bir iş kuralı YOKTUR (created_by/created_at/
  // updated_at set etme mantığı repository'de -- bkz. dictionary.repository.mongo.ts).
  async create(
    input: DictionaryCreateInput,
    actorId?: string,
  ): Promise<DictionaryRecord> {
    const canonicalGroup = canonicalizeGroupForStorage(input.group);
    const effectiveSubgroup = isIqvOsAiGroup(canonicalGroup)
      ? undefined
      : input.subgroup;

    const duplicate = await this.repository.findDuplicate({
      english_term: input.english_term,
      group: canonicalGroup,
      subgroup: effectiveSubgroup,
    });

    if (duplicate) {
      throw ApiError.conflict(
        duplicateMessage(canonicalGroup, effectiveSubgroup),
      );
    }

    return this.repository.create(
      {
        ...input,
        group: canonicalGroup,
        subgroup: effectiveSubgroup,
      },
      actorId,
    );
  }

  // `actorId`: JWT'deki req.user._id (controller'dan geçirilir) --
  // repository.update()'e aktarılır (updated_by_id'ye yazılır);
  // created()'teki AYNI desen.
  async update(
    id: string,
    input: DictionaryUpdateInput,
    actorId?: string,
  ): Promise<DictionaryRecord> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiError.notFound('Sözlük kaydı bulunamadı.');
    }

    const nextGroupRaw = input.group ?? existing.group;
    const canonicalGroup = canonicalizeGroupForStorage(nextGroupRaw);
    const nextIsIqvOsAi = isIqvOsAiGroup(canonicalGroup);

    const nextEnglishTerm = input.english_term ?? existing.english_term;
    const nextSubgroup = nextIsIqvOsAi
      ? undefined
      : input.subgroup !== undefined
        ? input.subgroup
        : existing.subgroup;

    const duplicate = await this.repository.findDuplicate(
      {
        english_term: nextEnglishTerm,
        group: canonicalGroup,
        subgroup: nextSubgroup,
      },
      id,
    );

    if (duplicate) {
      throw ApiError.conflict(duplicateMessage(canonicalGroup, nextSubgroup));
    }

    const updated = await this.repository.update(
      id,
      {
        ...input,
        group: canonicalGroup,
        subgroup: nextIsIqvOsAi ? undefined : nextSubgroup,
      },
      actorId,
    );

    if (!updated) {
      throw ApiError.notFound('Sözlük kaydı bulunamadı.');
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.repository.remove(id);
    if (!removed) {
      throw ApiError.notFound('Sözlük kaydı bulunamadı.');
    }
  }
}

export { normalizeGroupKey };
