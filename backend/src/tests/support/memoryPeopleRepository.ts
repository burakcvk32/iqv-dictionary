import {
  PeopleCreateInput,
  PeopleListQuery,
  PeopleListResult,
  PeopleRepository,
  PeopleUpdateInput,
  PersonRecord,
} from '../../modules/people/people.types';
import { buildSearchRegex } from '../../utils/regex';

// Gercek MongoPeopleRepository'nin PersonRecord'da modellenmeyen
// (Mongo-only) `user_dictionary` alt-belge davranisini test edilebilir
// kilmak icin BU test cift'i (memory repository), gercek repository'nin
// update() metodundaki AYNI "role/status/permissions -> user_dictionary.*"
// yansitma mantigini ayri, herkese acik bir Map'te simule eder. Bu alan
// PersonRecord arayuzunun bir parcasi DEGILDIR (uretim kodu bunu okumaz);
// yalnizca people.test.ts'in senkronizasyonu dogrulayabilmesi icindir.
export class MemoryPeopleRepository implements PeopleRepository {
  public readonly passwordWrittenIds = new Set<string>();

  public readonly userDictionaryById = new Map<
    string,
    { role?: string; status?: string; permissions?: string[] }
  >();

  constructor(private readonly people: PersonRecord[] = []) {}

  async list(query: PeopleListQuery): Promise<PeopleListResult> {
    let filtered = [...this.people];

    // Gercek MongoPeopleRepository.list()'teki scopeToUserId davranisini
    // birebir simule eder: sadece controller'in dogrulanmis JWT'den turettigi
    // bu alan set edildiyse (rol = 'user' gibi tam liste yetkisi olmayanlar),
    // sonucu o kullaniciya ait tek kayda daraltir; eslesme yoksa bos doner.
    if (query.scopeToUserId !== undefined) {
      filtered = filtered.filter((p) => p._id === query.scopeToUserId);
    }

    if (query.search) {
      const regex = buildSearchRegex(query.search);
      filtered = filtered.filter(
        (p) =>
          regex.test(p.username) ||
          (p.full_name ? regex.test(p.full_name) : false) ||
          (p.email ? regex.test(p.email) : false) ||
          (p.company_name ? regex.test(p.company_name) : false),
      );
    }

    filtered.sort((a, b) => (a._id < b._id ? 1 : a._id > b._id ? -1 : 0));

    const total = filtered.length;
    const start = (query.page - 1) * query.limit;
    const data = filtered.slice(start, start + query.limit);

    return { data, total };
  }

  async findById(id: string): Promise<PersonRecord | null> {
    return this.people.find((p) => p._id === id) ?? null;
  }

  async findByUsername(
    username: string,
    excludeId?: string,
  ): Promise<PersonRecord | null> {
    const normalized = username.trim().toLowerCase();
    return (
      this.people.find(
        (p) =>
          p.username.trim().toLowerCase() === normalized &&
          (!excludeId || p._id !== excludeId),
      ) ?? null
    );
  }

  // Gercek MongoPeopleRepository.create()'in ayni davranisini simule eder:
  // username/full_name/email/password zorunlu (cagiran taraf -- service
  // katmani -- zaten dogrulanmis girdi gonderir), role/status/permissions
  // varsayilanlari ('user'/'active'/[]) ve user_dictionary yansitmasi AYNI.
  async create(
    input: PeopleCreateInput,
    _actorId?: string,
  ): Promise<PersonRecord> {
    const role = input.role ?? 'user';
    const status = input.status ?? 'active';
    const permissions = input.permissions ?? [];

    const created: PersonRecord = {
      _id: `mem-${this.people.length + 1}-${Date.now()}`,
      username: input.username,
      full_name: input.full_name,
      email: input.email,
      phone: input.phone ?? null,
      telegram_id: input.telegram_id ?? null,
      company_name: input.company_name ?? '',
      role,
      status,
      permissions,
    };

    this.people.push(created);
    this.passwordWrittenIds.add(created._id);
    this.userDictionaryById.set(created._id, { role, status, permissions });

    return created;
  }

  async update(
    id: string,
    input: PeopleUpdateInput,
    _actorId?: string,
  ): Promise<PersonRecord | null> {
    const index = this.people.findIndex((p) => p._id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.people[index];
    const updated: PersonRecord = {
      ...existing,
      ...(input.username !== undefined ? { username: input.username } : {}),
      ...(input.full_name !== undefined ? { full_name: input.full_name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.telegram_id !== undefined
        ? { telegram_id: input.telegram_id }
        : {}),
      ...(input.company_name !== undefined
        ? { company_name: input.company_name }
        : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.permissions !== undefined
        ? { permissions: input.permissions }
        : {}),
    };

    this.people[index] = updated;

    if (input.password !== undefined) {
      this.passwordWrittenIds.add(id);
    }

    if (
      input.role !== undefined ||
      input.status !== undefined ||
      input.permissions !== undefined
    ) {
      const previous = this.userDictionaryById.get(id) ?? {};
      this.userDictionaryById.set(id, {
        ...previous,
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.permissions !== undefined
          ? { permissions: input.permissions }
          : {}),
      });
    }

    return updated;
  }

  async remove(id: string): Promise<boolean> {
    const index = this.people.findIndex((p) => p._id === id);
    if (index === -1) {
      return false;
    }
    this.people.splice(index, 1);
    return true;
  }
}
