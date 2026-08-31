import { ApiError } from '../../utils/apiError';
import {
  isSelfPrivilegeEscalationRestricted,
  AuthenticatedUser,
} from '../../middleware/auth';
import {
  PeopleCreateInput,
  PeopleListQuery,
  PeopleListResult,
  PeopleRepository,
  PeopleUpdateInput,
  PersonRecord,
} from './people.types';

// Iki dizinin (siralamadan BAGIMSIZ, kume olarak) ayni yetki kumesini temsil
// edip etmedigini karsilastirir -- checkbox'lari farkli sirada gonderen bir
// istek (fonksiyonel olarak degisiklik OLMAYAN bir no-op) yanlislikla
// "degisiklik yapilmaya calisiliyor" olarak ALGILANMASIN diye.
const permissionsSetsEqual = (
  a: string[] | undefined,
  b: string[] | undefined,
): boolean => {
  const setA = new Set(a ?? []);
  const setB = new Set(b ?? []);
  if (setA.size !== setB.size) return false;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
};

export class PeopleService {
  constructor(private readonly repository: PeopleRepository) {}

  async list(query: PeopleListQuery): Promise<PeopleListResult> {
    return this.repository.list(query);
  }

  async getById(id: string): Promise<PersonRecord> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw ApiError.notFound('Kişi bulunamadı.');
    }
    return record;
  }

  // TURN: "Personel Oluştur" -- `update()`'teki AYNI benzersizlik kuralı
  // (case-insensitive kullanıcı adı çakışması) create'te de uygulanır;
  // yeni bir doğrulama kuralı UYDURULMADI.
  async create(
    input: PeopleCreateInput,
    actorId?: string,
  ): Promise<PersonRecord> {
    const duplicate = await this.repository.findByUsername(input.username);
    if (duplicate) {
      throw ApiError.conflict('Bu kullanıcı adı zaten kullanılıyor.');
    }

    return this.repository.create(input, actorId);
  }

  async update(
    id: string,
    input: PeopleUpdateInput,
    actorId?: string,
    actor?: AuthenticatedUser,
  ): Promise<PersonRecord> {
    // Var olma kontrolu ONCE yapilir -- olmayan bir kayda "kullanici adi
    // musait mi" sorusu sormanin anlami yok, ayrica 404 her zaman diger
    // hatalardan ONCE donmelidir (bilgi sizdirmamak icin de dogru sira).
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiError.notFound('Kişi bulunamadı.');
    }

    // KOK NEDEN / BU TURUN EKLEDIGI KURAL: kendi hesabinda yetki yukseltme
    // (self privilege escalation) engeli. SADECE actor KENDI kaydini
    // duzenliyorsa (id karsilastirmasi JWT'deki req.user._id ile -- display
    // name/username DEGIL) VE actor'un rolu admin-tier DEGILSE (guvenli
    // varsayilan: 'user' ve taninmayan roller) uygulanir. Sadece body'de
    // alan VAR diye degil, ESKI degerden GERCEKTEN FARKLI bir deger istenip
    // istenmedigine bakilir -- no-op (mevcut degeri aynen geri gonderen)
    // istekler engellenmez. Admin-tier roller (mevcut davranis) hic
    // etkilenmez; sadece BASKASININ kaydini duzenleyen bir 'user' zaten
    // requirePermission('users.update') tarafindan 403 ile reddedilir (bu
    // kural o katmanin YERINE GECMEZ, ona EKTIR).
    const isEditingSelf = actorId !== undefined && actorId === id;
    if (isEditingSelf && actor && isSelfPrivilegeEscalationRestricted(actor)) {
      const roleChanged =
        input.role !== undefined &&
        input.role.toLowerCase() !== (existing.role ?? '').toLowerCase();
      const statusChanged =
        input.status !== undefined &&
        input.status.toLowerCase() !== (existing.status ?? '').toLowerCase();
      const permissionsChanged =
        input.permissions !== undefined &&
        !permissionsSetsEqual(input.permissions, existing.permissions);

      if (roleChanged || statusChanged || permissionsChanged) {
        throw ApiError.forbidden(
          'Kendi rolünüzü, durumunuzu veya erişim yetkilerinizi değiştiremezsiniz.',
        );
      }
    }

    if (
      input.username !== undefined &&
      input.username.toLowerCase() !== existing.username.toLowerCase()
    ) {
      const duplicate = await this.repository.findByUsername(
        input.username,
        id,
      );
      if (duplicate) {
        throw ApiError.conflict('Bu kullanıcı adı zaten kullanılıyor.');
      }
    }

    const updated = await this.repository.update(id, input, actorId);
    if (!updated) {
      throw ApiError.notFound('Kişi bulunamadı.');
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiError.notFound('Kişi bulunamadı.');
    }

    const removed = await this.repository.remove(id);
    if (!removed) {
      throw ApiError.notFound('Kişi bulunamadı.');
    }
  }
}
