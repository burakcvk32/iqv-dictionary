import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, signTestToken } from './support/testApp';
import { PersonRecord } from '../modules/people/people.types';

const people: PersonRecord[] = [
  {
    _id: '507f1f77bcf86cd799439011',
    username: 'burak.cevik',
    full_name: 'Burak ÇEVİK',
    email: 'burak.cevik@iqvizyon.com',
    phone: null,
    role: 'organizationadmin',
    status: 'active',
    company_id: 'c1',
    organization_id: 'o1',
    company_name: 'IQVizyon',
  },
  {
    _id: '507f1f77bcf86cd799439012',
    username: 'osman.ozyurt',
    full_name: 'Osman Özyurt',
    email: 'osman.ozyurt@iqvizyon.com',
    phone: null,
    role: 'user',
    status: 'active',
    company_id: 'c1',
    organization_id: 'o1',
    company_name: 'IQVizyon',
  },
];

describe('People (Kişi) API', () => {
  it('JWT olmadan 401 döner', async () => {
    const { app } = buildTestApp([], people);
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('geçerli JWT ile 200 döner ve gerçek kayıtları listeler', async () => {
    const { app } = buildTestApp([], people);
    const token = signTestToken();

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it('response içinde password/hash/salt alanı asla dönmez', async () => {
    const { app } = buildTestApp([], people);
    const token = signTestToken();

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);

    for (const person of res.body.data) {
      expect(person.password).toBeUndefined();
      expect(person.password_hash).toBeUndefined();
      expect(person.hash).toBeUndefined();
      expect(person.salt).toBeUndefined();
    }
  });

  it('full_name üzerinden Türkçe karakter uyumlu arama yapar', async () => {
    const { app } = buildTestApp([], people);
    const token = signTestToken();

    const res = await request(app)
      .get('/api/v1/users')
      .query({ search: 'ozyurt' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].username).toBe('osman.ozyurt');
  });

  it('username üzerinden arama yapar', async () => {
    const { app } = buildTestApp([], people);
    const token = signTestToken();

    const res = await request(app)
      .get('/api/v1/users')
      .query({ search: 'burak' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].username).toBe('burak.cevik');
  });

  it('pagination doğru çalışır', async () => {
    const { app } = buildTestApp([], people);
    const token = signTestToken();

    const res = await request(app)
      .get('/api/v1/users')
      .query({ page: 1, limit: 1 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.totalPages).toBe(2);
  });

  it('role backend değerini olduğu gibi döner (uydurma yok)', async () => {
    const { app } = buildTestApp([], people);
    const token = signTestToken();

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);

    const roles = res.body.data.map((p: { role: string }) => p.role).sort();
    expect(roles).toEqual(['organizationadmin', 'user']);
  });
});

// TURN: satir-bazli (row-level) yetkilendirme -- "Kişi" izni (users.read)
// SADECE erisim kapisidir; rol = 'user' olan bir hesap bu izne sahip olsa
// BILE listede yalnizca KENDI kaydini gorur. Rol = admin-tier (superadmin/
// companyadmin/organizationadmin/admin) olan hesaplar ise (mevcut, degismemis
// davranis olarak) tum kayitlari gorur. Bu kural middleware/auth.ts'teki
// isFullPeopleListRole() + people.controller.ts'teki scopeToUserId akisiyla
// backend'de (frontend'de degil) uygulanir.
describe('People (Kişi) API — satır bazlı (row-level) yetkilendirme', () => {
  const selfScopedUserToken = () =>
    signTestToken({
      _id: '507f1f77bcf86cd799439012',
      username: 'osman.ozyurt',
      role: 'user',
      permissions: ['users.read'],
    });

  it('rol=admin-tier (organizationadmin) → mevcut davranış aynı kalır, TÜM kayıtları görür', async () => {
    const { app } = buildTestApp([], people);
    const token = signTestToken({
      _id: 'admin-1',
      username: 'admin',
      role: 'organizationadmin',
    });

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it("rol='user' + 'Kişi' (users.read) izni verilmiş → SADECE KENDİ kaydını görür, diğer personel görünmez", async () => {
    const { app } = buildTestApp([], people);

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${selfScopedUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]._id).toBe('507f1f77bcf86cd799439012');
    expect(res.body.data[0].username).toBe('osman.ozyurt');
    // Baskasinin kaydi (burak.cevik) kesinlikle donmemeli.
    expect(
      res.body.data.some(
        (p: { username: string }) => p.username === 'burak.cevik',
      ),
    ).toBe(false);
  });

  it("rol='user' + 'Kişi' izni → pagination/total da SADECE kendi kaydını yansıtır (headcount sızmaz)", async () => {
    const { app } = buildTestApp([], people);

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${selfScopedUserToken()}`);

    expect(res.body.pagination.total).toBe(1);
    expect(res.body.pagination.totalPages).toBe(1);
  });

  it("rol='user' + 'Kişi' izni → search ile BAŞKA bir personeli bulamaz (kendi kaydı search'e uymasa bile boş döner)", async () => {
    const { app } = buildTestApp([], people);

    const res = await request(app)
      .get('/api/v1/users')
      .query({ search: 'burak' })
      .set('Authorization', `Bearer ${selfScopedUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });

  it("rol='user' + 'Kişi' izni → kendi kaydıyla eşleşen search hâlâ kendi kaydını döner", async () => {
    const { app } = buildTestApp([], people);

    const res = await request(app)
      .get('/api/v1/users')
      .query({ search: 'osman' })
      .set('Authorization', `Bearer ${selfScopedUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].username).toBe('osman.ozyurt');
  });

  it("'Kişi' izni (users.read) OLMAYAN rol='user' → listeye erişemez, 403 (izin=erişim kapısı ayrımı korunur)", async () => {
    const { app } = buildTestApp([], people);
    const token = signTestToken({
      _id: '507f1f77bcf86cd799439012',
      username: 'osman.ozyurt',
      role: 'user',
    });

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// TURN: kendi hesabinda yetki yukseltme (self privilege escalation) engeli.
// Rol='user' bir hesap -- `users.update` izni acikca verilmis olsa BILE --
// KENDI kaydinda role/status/permissions alanlarini DEGISTIREMEZ; normal
// profil alanlarini (full_name/email/phone/telegram_id/password) ise
// mevcut sistem izin veriyorsa (users.update izni varsa) DUZENLEYEBILMEYE
// devam eder. Admin-tier roller (mevcut davranis) bu kisitlamaya tabi
// DEGILDIR -- KENDI kayitlarinda bile role/status/permissions
// degistirebilirler.
describe('People (Kişi) API — kendi hesabında yetki yükseltme engeli', () => {
  const SELF_ID = '507f1f77bcf86cd799439012'; // osman.ozyurt fixture kaydı

  const selfUpdatableUserToken = () =>
    signTestToken({
      _id: SELF_ID,
      username: 'osman.ozyurt',
      role: 'user',
      permissions: ['users.update'],
    });

  it("rol='user' + users.update izni → KENDİ rolünü 'admin' yapamaz, 403 döner", async () => {
    const { app, peopleRepository } = buildTestApp([], [...people]);

    const res = await request(app)
      .patch(`/api/v1/users/${SELF_ID}`)
      .set('Authorization', `Bearer ${selfUpdatableUserToken()}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(403);
    const stillThere = await peopleRepository.findById(SELF_ID);
    expect(stillThere?.role).toBe('user');
  });

  it("rol='user' + users.update izni → KENDİ Durumunu (Aktif/Pasif) değiştiremez, 403 döner", async () => {
    const { app, peopleRepository } = buildTestApp([], [...people]);

    const res = await request(app)
      .patch(`/api/v1/users/${SELF_ID}`)
      .set('Authorization', `Bearer ${selfUpdatableUserToken()}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(403);
    const stillThere = await peopleRepository.findById(SELF_ID);
    expect(stillThere?.status).toBe('active');
  });

  it("rol='user' + users.update izni → KENDİ Erişim ve Yetkiler'ini değiştiremez, 403 döner", async () => {
    const { app, peopleRepository } = buildTestApp([], [...people]);

    const res = await request(app)
      .patch(`/api/v1/users/${SELF_ID}`)
      .set('Authorization', `Bearer ${selfUpdatableUserToken()}`)
      .send({ permissions: ['dictionary.read', 'settings.read'] });

    expect(res.status).toBe(403);
    const stillThere = await peopleRepository.findById(SELF_ID);
    expect(stillThere?.permissions ?? []).toEqual([]);
  });

  it("rol='user' + users.update izni → role/status/permissions AYNI (mevcut) değerle gönderilirse (no-op) ENGELLENMEZ", async () => {
    const { app } = buildTestApp([], [...people]);

    const res = await request(app)
      .patch(`/api/v1/users/${SELF_ID}`)
      .set('Authorization', `Bearer ${selfUpdatableUserToken()}`)
      .send({ role: 'user', status: 'active', permissions: [] });

    expect(res.status).toBe(200);
  });

  it("rol='user' + users.update izni → KENDİ normal profil bilgilerini (Ad Soyad) düzenlemeye devam edebilir", async () => {
    const { app } = buildTestApp([], [...people]);

    const res = await request(app)
      .patch(`/api/v1/users/${SELF_ID}`)
      .set('Authorization', `Bearer ${selfUpdatableUserToken()}`)
      .send({ full_name: 'Osman Özyurt (Kendi Güncellemesi)' });

    expect(res.status).toBe(200);
    expect(res.body.data.full_name).toBe('Osman Özyurt (Kendi Güncellemesi)');
  });

  it('admin-tier rol KENDİ kaydını düzenlerken bile rol/durum/yetki değiştirebilir (istisna korunur, mevcut davranış bozulmaz)', async () => {
    const selfAdminId = '507f1f77bcf86cd799439099';
    const localPeople: PersonRecord[] = [
      {
        _id: selfAdminId,
        username: 'admin.kendisi',
        full_name: 'Admin Kendisi',
        email: 'admin.kendisi@iqvizyon.com',
        phone: null,
        role: 'organizationadmin',
        status: 'active',
        company_id: 'c1',
        organization_id: 'o1',
        company_name: 'IQVizyon',
      },
    ];
    const { app } = buildTestApp([], localPeople);
    const token = signTestToken({
      _id: selfAdminId,
      username: 'admin.kendisi',
      role: 'organizationadmin',
    });

    const res = await request(app)
      .patch(`/api/v1/users/${selfAdminId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'inactive',
        role: 'admin',
        permissions: ['dictionary.read'],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('inactive');
    expect(res.body.data.role).toBe('admin');
    expect(res.body.data.permissions).toEqual(['dictionary.read']);
  });
});

describe('People (Kişi) API — edit/delete', () => {
  const adminToken = () =>
    signTestToken({
      _id: 'admin-1',
      username: 'admin',
      role: 'organizationadmin',
    });
  const plainUserToken = () =>
    signTestToken({
      _id: '507f1f77bcf86cd799439012',
      username: 'osman.ozyurt',
      role: 'user',
    });

  it('users.update izni olan (organizationadmin) → PATCH ile güncelleme başarılı', async () => {
    const { app } = buildTestApp([], people);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439012')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ full_name: 'Osman Özyurt (Güncel)' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.full_name).toBe('Osman Özyurt (Güncel)');
    // Parola/hash hicbir zaman donmez.
    expect(res.body.data.password).toBeUndefined();
  });

  it('users.update izni OLMAYAN (role=user) → 403 döner', async () => {
    const { app } = buildTestApp([], people);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${plainUserToken()}`)
      .send({ full_name: 'Başkasının Adı' });

    expect(res.status).toBe(403);
  });

  it('user rolündeki bir kullanıcı KENDİ kaydını bile güncelleyemez (Platform ile aynı: user rolüne varsayılan izin yok)', async () => {
    const { app } = buildTestApp([], people);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439012')
      .set('Authorization', `Bearer ${plainUserToken()}`)
      .send({ full_name: 'Kendi Adım' });

    expect(res.status).toBe(403);
  });

  it('açık permissions dizisi (users.update) rol yerine geçer', async () => {
    const { app } = buildTestApp([], people);
    const token = signTestToken({
      _id: 'x1',
      username: 'ozel-yetkili',
      role: 'user',
      permissions: ['users.update'],
    });

    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_name: 'Güncellendi' });

    expect(res.status).toBe(200);
  });

  it('olmayan kullanıcı → 404', async () => {
    const { app } = buildTestApp([], people);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439099')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ full_name: 'X' });

    expect(res.status).toBe(404);
  });

  it('geçersiz ObjectId → 400', async () => {
    const { app } = buildTestApp([], people);
    const res = await request(app)
      .patch('/api/v1/users/not-a-valid-id')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ full_name: 'X' });

    expect(res.status).toBe(400);
  });

  it('password alanı gönderilse bile sessizce yok sayılır, hash asla dönmez', async () => {
    const { app } = buildTestApp([], people);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ full_name: 'Burak ÇEVİK', password: '$2b$10$fakehash...' });

    expect(res.status).toBe(200);
    expect(res.body.data.password).toBeUndefined();
  });

  it('geçersiz rol değeri → 400 validation', async () => {
    const { app } = buildTestApp([], people);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ role: 'uydurma-rol' });

    expect(res.status).toBe(400);
  });

  it('role/status/permissions değişince user_dictionary senkronize edilir', async () => {
    const { app, peopleRepository } = buildTestApp([], people);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        role: 'admin',
        status: 'inactive',
        permissions: ['dictionary.read'],
      });

    expect(res.status).toBe(200);
    const synced = peopleRepository.userDictionaryById.get(
      '507f1f77bcf86cd799439011',
    );
    expect(synced).toEqual({
      role: 'admin',
      status: 'inactive',
      permissions: ['dictionary.read'],
    });
  });

  it('yalnızca full_name değişirse user_dictionary hiç dokunulmaz', async () => {
    const { app, peopleRepository } = buildTestApp([], people);
    await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439012')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ full_name: 'Sadece İsim' });

    expect(
      peopleRepository.userDictionaryById.has('507f1f77bcf86cd799439012'),
    ).toBe(false);
  });

  it('users.delete izni olan → DELETE başarılı ve kayıt listeden kalkar', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .delete('/api/v1/users/507f1f77bcf86cd799439012')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const listRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(listRes.body.data).toHaveLength(1);
  });

  it('users.delete izni OLMAYAN (role=user) → 403', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .delete('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${plainUserToken()}`);

    expect(res.status).toBe(403);
  });

  it('olmayan kullanıcıyı silmeye çalışmak → 404', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .delete('/api/v1/users/507f1f77bcf86cd799439099')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

  it('geçersiz ObjectId ile silme → 400', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .delete('/api/v1/users/not-a-valid-id')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(400);
  });

  it('JWT olmadan update/delete → 401', async () => {
    const { app } = buildTestApp([], [...people]);
    const updateRes = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .send({ full_name: 'X' });
    const deleteRes = await request(app).delete(
      '/api/v1/users/507f1f77bcf86cd799439011',
    );

    expect(updateRes.status).toBe(401);
    expect(deleteRes.status).toBe(401);
  });

  // TURN: Platform parity -- şifre, Telegram ID, Firma alanları.
  it('şifre alanı GÖNDERİLİRSE kabul edilir, ancak response içinde ASLA görünmez', async () => {
    const { app, peopleRepository } = buildTestApp([], [...people]);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ password: 'yeni-sifre-123' });

    expect(res.status).toBe(200);
    expect(res.body.data.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('yeni-sifre-123');
    expect(
      peopleRepository.passwordWrittenIds.has('507f1f77bcf86cd799439011'),
    ).toBe(true);
  });

  it('şifre alanı BOŞ STRING olarak gönderilirse 400 (niyet: hiç göndermemek)', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ password: '' });

    expect(res.status).toBe(400);
  });

  it('şifre alanı HİÇ GÖNDERİLMEZSE mevcut parola değişikliği tetiklenmez', async () => {
    const { app, peopleRepository } = buildTestApp([], [...people]);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ full_name: 'Sadece İsim Değişti' });

    expect(res.status).toBe(200);
    expect(
      peopleRepository.passwordWrittenIds.has('507f1f77bcf86cd799439011'),
    ).toBe(false);
  });

  it('Telegram ID ve Firma alanları güncellenebilir ve listede görünür', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ telegram_id: '123456789', company_name: 'IQ Vizyon' });

    expect(res.status).toBe(200);
    expect(res.body.data.telegram_id).toBe('123456789');
    expect(res.body.data.company_name).toBe('IQ Vizyon');
  });

  it('çok uzun bir Telegram ID → 400', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ telegram_id: 'x'.repeat(65) });

    expect(res.status).toBe(400);
  });

  // TURN: "Yetkileri Düzenle" popup — users.read artık GET / için de
  // gerçek bir izinle korunuyor (önceki turda yalnızca kimlik doğrulama
  // vardı).
  it('users.read izni OLMAYAN (role=user, izin yok) → GET / 403', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${plainUserToken()}`);

    expect(res.status).toBe(403);
  });

  it('yalnızca users.read izni verilen kullanıcı → GET / 200, PATCH 403', async () => {
    const readOnlyToken = signTestToken({
      _id: 'u-read-only',
      username: 'readonly',
      role: 'user',
      permissions: ['users.read'],
    });

    const { app } = buildTestApp([], [...people]);
    const listRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${readOnlyToken}`);
    expect(listRes.status).toBe(200);

    const updateRes = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .send({ full_name: 'X' });
    expect(updateRes.status).toBe(403);
  });

  it('geçersiz izin adı gönderilirse (izin listesi UYDURULAMAZ) → 400', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ permissions: ['dictionary.read', 'uydurma.izin'] });

    expect(res.status).toBe(400);
  });

  it('Kişi/Ayarlar/Dictionary izinlerinin tamamı geçerli değer olarak kabul edilir ve user_dictionary.permissions olarak senkronize edilir', async () => {
    const { app, peopleRepository } = buildTestApp([], [...people]);
    const grantedPermissions = [
      'users.read',
      'users.update',
      'settings.read',
      'dictionary.read',
      'dictionary.create',
    ];

    const res = await request(app)
      .patch('/api/v1/users/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ permissions: grantedPermissions });

    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toEqual(grantedPermissions);
    expect(
      peopleRepository.userDictionaryById.get('507f1f77bcf86cd799439011')
        ?.permissions,
    ).toEqual(grantedPermissions);
  });
});

describe('People (Kişi) API — Personel Oluştur (create)', () => {
  const adminToken = () =>
    signTestToken({
      _id: 'admin-1',
      username: 'admin',
      role: 'organizationadmin',
    });
  const plainUserToken = () =>
    signTestToken({
      _id: '507f1f77bcf86cd799439012',
      username: 'osman.ozyurt',
      role: 'user',
    });

  const validPayload = {
    username: 'yeni.personel',
    password: 'gizli-sifre',
    full_name: 'Yeni Personel',
    email: 'yeni.personel@iqvizyon.com',
  };

  it('JWT olmadan 401 döner', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app).post('/api/v1/users').send(validPayload);
    expect(res.status).toBe(401);
  });

  it('users.create izni olmayan (plain user) → 403', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${plainUserToken()}`)
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  it('geçerli izinli kullanıcı + zorunlu alanlar → 201, kayıt oluşur ve listede görünür', async () => {
    const { app, peopleRepository } = buildTestApp([], [...people]);
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe('yeni.personel');
    expect(res.body.data.full_name).toBe('Yeni Personel');
    expect(res.body.data.email).toBe('yeni.personel@iqvizyon.com');
    // Varsayılanlar: Platform'un GERÇEK EMPTY_PERSONNEL_FORM'uyla AYNI
    // (role gönderilmezse 'user', status 'active').
    expect(res.body.data.role).toBe('user');
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.password).toBeUndefined();

    const listRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(
      listRes.body.data.some(
        (p: { username: string }) => p.username === 'yeni.personel',
      ),
    ).toBe(true);

    // Parola gerçekten hash'lenip yazılmış mı (memory repository test çifti).
    expect(peopleRepository.passwordWrittenIds.has(res.body.data._id)).toBe(
      true,
    );
  });

  it.each(['username', 'password', 'full_name', 'email'] as const)(
    'zorunlu alan (%s) eksikse → 400',
    async (field) => {
      const { app } = buildTestApp([], [...people]);
      const payload = { ...validPayload };
      delete (payload as Record<string, unknown>)[field];

      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send(payload);

      expect(res.status).toBe(400);
    },
  );

  it('geçersiz e-posta formatı → 400', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...validPayload, email: 'gecersiz-eposta' });

    expect(res.status).toBe(400);
  });

  it('zaten kullanılan kullanıcı adı → 409', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...validPayload, username: 'burak.cevik' });

    expect(res.status).toBe(409);
  });

  it("role/status gönderilirse aynen kabul edilir (Admin/Kullanıcı mapping'inin gerçek değerleri)", async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        ...validPayload,
        username: 'admin.personel',
        role: 'admin',
        status: 'passive',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('admin');
    expect(res.body.data.status).toBe('passive');
  });

  it('geçersiz rol değeri → 400', async () => {
    const { app } = buildTestApp([], [...people]);
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...validPayload, role: 'uydurma-rol' });

    expect(res.status).toBe(400);
  });
});
