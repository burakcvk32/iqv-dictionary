// k6 PERFORMANS TESTLERİ İÇİN ÖZEL SUNUCU -- ÖNEMLİ KISITLAMA (raporlarda
// AÇIKÇA belirtilmelidir): bu ortamdan (device_bash köprüsü) kullanıcının
// GERÇEK MongoDB'sine (port 27017) ağ erişimi YOKTUR -- ne migration
// script'i ne de bu performans testi gerçek Mongo'ya bağlanabilir. Bu
// yüzden bu sunucu, GERÇEK `createApp()` (app.ts, tüm middleware/
// routing/validation/auth/rate-limit zinciri DEĞİŞTİRİLMEDEN
// kullanılıyor) ile, backend'in KENDİ vitest paketinin ZATEN GÜVENDİĞİ
// in-memory sahte repository'leri (`src/tests/support/*`) birleştiriyor.
// SONUÇ: routing/middleware/auth/validation/iş mantığı katmanının GERÇEK
// performansı ölçülüyor -- ANCAK Mongo I/O gecikmesi (network round-trip,
// disk, index taraması, connection pool) BU SAYIYA YANSIMIYOR. Bu,
// PERFORMANCE_REPORT.md'de üretim-eşdeğeri DEĞİL diye açıkça
// işaretlenmelidir.
import bcrypt from 'bcryptjs';
import { createApp } from '../../../src/app';
import { MemoryDictionaryRepository } from '../../../src/tests/support/memoryRepository';
import { MemoryUsersRepository } from '../../../src/tests/support/memoryUsersRepository';
import { MemoryPeopleRepository } from '../../../src/tests/support/memoryPeopleRepository';
import { DictionaryRecord } from '../../../src/modules/dictionary/dictionary.types';
import { UserRecord } from '../../../src/modules/auth/auth.types';

const PORT = Number(process.env.K6_TEST_SERVER_PORT ?? 4001);
export const K6_TEST_JWT_SECRET = 'k6-perf-test-secret';
export const K6_ADMIN_USERNAME = 'K6_perf_admin';
export const K6_ADMIN_PASSWORD = 'K6_Perf_Test_Pass_2026!';

const GROUPS = ['Endüstriyel', 'IQV OS AI'];
const SUBGROUPS = [
  'Temel Makine, Proses ve Sensör Terimi',
  'Üretim',
  'Bakım',
  'Kalite',
  'Veri, Yapay Zekâ ve Analitik',
  'Yazılım, Sistem ve Siber Güvenlik',
  'Endüstriyel Haberleşme ve Otomasyon',
  'Enerji ve Sürdürülebilirlik',
];

// K6_ ÖN EKİ: proje genelindeki test-veri-izolasyonu kuralı (görev
// açıklamasının 38-39. maddeleri) gereği, bu sunucunun ürettiği TÜM
// sözlük kayıtları `K6_` ile başlar -- gerçek/üretim verisiyle
// KARIŞTIRILAMAZ, ve zaten in-memory olduğu için process kapanınca
// otomatik temizlenir (ek bir cleanup adımı GEREKMEZ).
const seedDictionary = (count: number): DictionaryRecord[] => {
  const now = new Date();
  const records: DictionaryRecord[] = [];
  // KOK NEDEN (bulunup DUZELTILEN bir seed-script hatasi): grup VE alt
  // grup indeksleri AYNI `i`den turetiliyorsa (i % GROUPS.length VE i %
  // SUBGROUPS.length), GROUPS.length=2 ciftligi yuzunden Endustriyel
  // kayitlar HER ZAMAN CIFT `i` degerinde olusuyor -- bu da 8 alt
  // gruptan yalnizca 4'unun (cift index'li olanlarin) hic kayit
  // ALMAMASINA yol aciyordu (k6 dictionary-read.js'in ilk calistirmasinda
  // "Üretim" alt-grup filtresinin 0 sonuc donmesiyle YAKALANDI). Duzeltme:
  // Endustriyel kayitlar icin AYRI, bagimsiz bir sayac kullanilarak 8 alt
  // grubun TAMAMINA esit (125'er) dagitim saglaniyor.
  let industrialIndex = 0;
  for (let i = 0; i < count; i += 1) {
    const group = GROUPS[i % GROUPS.length];
    const subgroup =
      group === 'Endüstriyel' ? SUBGROUPS[industrialIndex % SUBGROUPS.length] : undefined;
    if (group === 'Endüstriyel') {
      industrialIndex += 1;
    }
    records.push({
      _id: `k6seed-${i.toString().padStart(6, '0')}`,
      english_term: `K6_Term_EN_${i}`,
      turkish_term: `K6_Terim_TR_${i}`,
      description: `K6 performans testi için üretilmiş açıklama #${i}.`,
      group,
      subgroup,
      created_by_id: '000000000000000000000001',
      updated_by_id: '000000000000000000000001',
      created_at: now,
      updated_at: now,
    } as DictionaryRecord);
  }
  return records;
};

export async function startK6TestServer() {
  const passwordHash = await bcrypt.hash(K6_ADMIN_PASSWORD, 10);
  const adminUser: UserRecord = {
    _id: '000000000000000000000001',
    username: K6_ADMIN_USERNAME,
    password: passwordHash,
    full_name: 'K6 Perf Admin',
    role: 'organizationadmin',
    status: 'active',
  };

  const dictionaryRepository = new MemoryDictionaryRepository();
  // KOK NEDEN: `MemoryDictionaryRepository`'nin (backend'in KENDI vitest
  // paketinin guvendigi ayni sinif) bir seed-array constructor'i YOK --
  // gercek `create()` API'si uzerinden, GERCEK is mantigiyla (validation,
  // ObjectId uretimi, created_at/updated_at) doldurulmasi gerekiyor.
  const seedRecords = seedDictionary(1000);
  for (const record of seedRecords) {
    // eslint-disable-next-line no-await-in-loop
    await dictionaryRepository.create(
      {
        english_term: record.english_term,
        turkish_term: record.turkish_term,
        description: record.description,
        group: record.group,
        subgroup: record.subgroup,
      },
      '000000000000000000000001',
    );
  }
  const usersRepository = new MemoryUsersRepository([adminUser]);
  const peopleRepository = new MemoryPeopleRepository([]);

  const app = createApp({
    dictionaryRepository,
    usersRepository,
    peopleRepository,
    jwtSecret: K6_TEST_JWT_SECRET,
    jwtExpiresIn: '2h',
    corsOrigin: '*',
  });

  const server = app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[k6TestServer] listening on http://127.0.0.1:${PORT} (1000 K6_ seeded dictionary records)`);
  });

  return server;
}

if (require.main === module) {
  startK6TestServer().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[k6TestServer] failed to start:', error);
    process.exit(1);
  });
}
