import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, signTestToken } from './support/testApp';

const basePayload = {
  english_term: 'Machine Learning',
  turkish_term: 'Makine Öğrenmesi',
  description: 'Açıklama metni',
  group: 'IQV OS AI',
};

describe('Dictionary API', () => {
  let ctx: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    ctx = buildTestApp();
  });

  it('1) JWT olmadan list isteği 401 döner', async () => {
    const res = await request(ctx.app).get('/api/v1/dictionary');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('2) geçerli JWT ile list 200 döner', async () => {
    const token = signTestToken();
    const res = await request(ctx.app)
      .get('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('3) geçerli kayıt oluşturma 201 döner', async () => {
    const token = signTestToken();
    const res = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload);
    expect(res.status).toBe(201);
    expect(res.body.data.english_term).toBe('Machine Learning');
    expect(res.body.data.subgroup).toBeUndefined();
  });

  it('4) zorunlu alan eksikse 422 döner', async () => {
    const token = signTestToken();
    const res = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({
        english_term: '',
        turkish_term: 'x',
        description: 'y',
        group: 'Endüstriyel',
      });
    expect(res.status).toBe(422);
  });

  it('5) geçersiz ObjectId 400 döner', async () => {
    const token = signTestToken();
    const res = await request(ctx.app)
      .get('/api/v1/dictionary/not-an-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('6) IQV OS AI mükerrer kayıt (case-insensitive) 409 döner', async () => {
    const token = signTestToken();
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload);

    const res = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...basePayload, english_term: 'machine learning' });

    expect(res.status).toBe(409);
  });

  it('7) aynı Endüstriyel subgroup mükerrer kayıt 409 döner', async () => {
    const token = signTestToken();
    const payload = {
      english_term: 'Predictive Maintenance',
      turkish_term: 'Kestirimci Bakım',
      description: 'Açıklama',
      group: 'Endüstriyel',
      subgroup: 'CNC',
    };
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    const res = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(res.status).toBe(409);
  });

  it('8) aynı terim farklı subgroup ile başarılı olur', async () => {
    const token = signTestToken();
    const payload = {
      english_term: 'Predictive Maintenance',
      turkish_term: 'Kestirimci Bakım',
      description: 'Açıklama',
      group: 'Endüstriyel',
      subgroup: 'CNC',
    };
    const first = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(first.status).toBe(201);

    const second = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...payload, subgroup: 'PLC' });
    expect(second.status).toBe(201);
  });

  it('9) güncelleme başarılı olur', async () => {
    const token = signTestToken();
    const created = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload);
    const res = await request(ctx.app)
      .put(`/api/v1/dictionary/${created.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Güncellendi' });
    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('Güncellendi');
  });

  it('10) güncelleme kendi kaydını duplicate saymaz', async () => {
    const token = signTestToken();
    const created = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload);
    const res = await request(ctx.app)
      .put(`/api/v1/dictionary/${created.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Sadece açıklama değişti' });
    expect(res.status).toBe(200);
  });

  it('11) silme başarılı olur', async () => {
    const token = signTestToken();
    const created = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload);
    const res = await request(ctx.app)
      .delete(`/api/v1/dictionary/${created.body.data._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('12) olmayan id 404 döner', async () => {
    const token = signTestToken();
    const res = await request(ctx.app)
      .get('/api/v1/dictionary/64b64b64b64b64b64b64b64b')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('13) search doğru filtreleme yapar', async () => {
    const token = signTestToken();
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload);
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...basePayload, english_term: 'Neural Network' });

    const res = await request(ctx.app)
      .get('/api/v1/dictionary')
      .query({ search: 'machine' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].english_term).toBe('Machine Learning');
  });

  it('14) group filter doğru çalışır', async () => {
    const token = signTestToken();
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload);
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({
        english_term: 'Predictive Maintenance',
        turkish_term: 'Kestirimci Bakım',
        description: 'Açıklama',
        group: 'Endüstriyel',
        subgroup: 'CNC',
      });

    const res = await request(ctx.app)
      .get('/api/v1/dictionary')
      .query({ group: 'Endüstriyel' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].group).toBe('Endüstriyel');
  });

  it('15) subgroup filter doğru çalışır', async () => {
    const token = signTestToken();
    const payload = {
      english_term: 'Predictive Maintenance',
      turkish_term: 'Kestirimci Bakım',
      description: 'Açıklama',
      group: 'Endüstriyel',
      subgroup: 'CNC',
    };
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...payload, subgroup: 'PLC' });

    const res = await request(ctx.app)
      .get('/api/v1/dictionary')
      .query({ group: 'Endüstriyel', subgroup: 'PLC' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].subgroup).toBe('PLC');
  });

  it('16) pagination doğru çalışır', async () => {
    const token = signTestToken();
    for (let i = 0; i < 25; i++) {
      await request(ctx.app)
        .post('/api/v1/dictionary')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...basePayload,
          english_term: `Term ${i}`,
          group: 'Endüstriyel',
          subgroup: 'General',
        });
    }

    const page1 = await request(ctx.app)
      .get('/api/v1/dictionary')
      .query({ page: 1, limit: 20 })
      .set('Authorization', `Bearer ${token}`);
    expect(page1.body.data).toHaveLength(20);
    expect(page1.body.pagination.total).toBe(25);
    expect(page1.body.pagination.totalPages).toBe(2);

    const page2 = await request(ctx.app)
      .get('/api/v1/dictionary')
      .query({ page: 2, limit: 20 })
      .set('Authorization', `Bearer ${token}`);
    expect(page2.body.data).toHaveLength(5);
  });

  it('17) stats doğru sayıları döner', async () => {
    const token = signTestToken();
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload);
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({
        english_term: 'Predictive Maintenance',
        turkish_term: 'Kestirimci Bakım',
        description: 'Açıklama',
        group: 'Endüstriyel',
        subgroup: 'CNC',
      });

    const res = await request(ctx.app)
      .get('/api/v1/dictionary/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.iqv_os_ai).toBe(1);
    expect(res.body.data.industrial).toBe(1);
    expect(res.body.data.subgroups).toEqual([{ name: 'CNC', count: 1 }]);
  });

  it('subgroups: group parametresine ait GERÇEK, tekrarsız alt grupları döner', async () => {
    const token = signTestToken();
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...basePayload,
        group: 'Endüstriyel',
        subgroup: 'Bakım',
        english_term: 'A',
      });
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...basePayload,
        group: 'Endüstriyel',
        subgroup: 'Üretim',
        english_term: 'B',
      });
    // Aynı alt grup ikinci kez -- distinct sonuçta TEKRAR ETMEMELİ.
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...basePayload,
        group: 'Endüstriyel',
        subgroup: 'Bakım',
        english_term: 'C',
      });
    // IQV OS AI grubuna ait bir kayıt -- sonuçları KİRLETMEMELİ.
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...basePayload, group: 'IQV OS AI', english_term: 'D' });

    const res = await request(ctx.app)
      .get('/api/v1/dictionary/subgroups')
      .query({ group: 'Endüstriyel' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sort()).toEqual(['Bakım', 'Üretim'].sort());
  });

  it('subgroups: group parametresi eksikse 400 döner', async () => {
    const token = signTestToken();
    const res = await request(ctx.app)
      .get('/api/v1/dictionary/subgroups')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('süresi dolmuş token için 401 döner', async () => {
    const expired = jwt.sign({ _id: 'u1' }, 'test-secret', { expiresIn: -10 });
    const res = await request(ctx.app)
      .get('/api/v1/dictionary')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('legacy /list-dictionary ve /create-dictionary aynı servisi kullanır', async () => {
    const token = signTestToken();
    const created = await request(ctx.app)
      .post('/create-dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload);
    expect(created.status).toBe(201);

    const listed = await request(ctx.app)
      .post('/list-dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(listed.status).toBe(200);
    expect(listed.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Dictionary API — izin matrisi (Kişi/Ayarlar/Dictionary permission sistemi)', () => {
  let ctx: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    ctx = buildTestApp();
  });

  const plainUserToken = () =>
    signTestToken({ _id: 'u2', username: 'plain', role: 'user' });
  const dictionaryReadOnlyToken = () =>
    signTestToken({
      _id: 'u3',
      username: 'reader',
      role: 'user',
      permissions: ['dictionary.read'],
    });
  const settingsOnlyToken = () =>
    signTestToken({
      _id: 'u4',
      username: 'settings-user',
      role: 'user',
      permissions: ['settings.read', 'settings.update'],
    });

  it('dictionary.read izni OLMAYAN (role=user, izin yok) → GET / 403', async () => {
    const res = await request(ctx.app)
      .get('/api/v1/dictionary')
      .set('Authorization', `Bearer ${plainUserToken()}`);
    expect(res.status).toBe(403);
  });

  it('yalnızca dictionary.read izni olan → GET / 200, POST / 403 (create izni yok)', async () => {
    const listRes = await request(ctx.app)
      .get('/api/v1/dictionary')
      .set('Authorization', `Bearer ${dictionaryReadOnlyToken()}`);
    expect(listRes.status).toBe(200);

    const createRes = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${dictionaryReadOnlyToken()}`)
      .send(basePayload);
    expect(createRes.status).toBe(403);
  });

  it('dictionary.update/dictionary.delete izni olmayan (yalnızca read) → PUT/DELETE 403', async () => {
    const admin = signTestToken();
    const created = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${admin}`)
      .send(basePayload);

    const updateRes = await request(ctx.app)
      .put(`/api/v1/dictionary/${created.body.data._id}`)
      .set('Authorization', `Bearer ${dictionaryReadOnlyToken()}`)
      .send({ english_term: 'X' });
    expect(updateRes.status).toBe(403);

    const deleteRes = await request(ctx.app)
      .delete(`/api/v1/dictionary/${created.body.data._id}`)
      .set('Authorization', `Bearer ${dictionaryReadOnlyToken()}`);
    expect(deleteRes.status).toBe(403);
  });

  // Ayarlar sayfasının kendi backend route'u yok — dictionaryApi.list/create'i
  // (GET/POST /api/v1/dictionary) doğrudan çağırır. Bu yüzden settings.read/
  // settings.update de bu İKİ route için GEÇERLİ, gerçek bir giriş yoludur
  // (requireAnyPermission) — dictionary.* izni olmasa bile.
  it('yalnızca settings.read/settings.update izni olan → GET / ve POST / 200 (Ayarlar akışı)', async () => {
    const listRes = await request(ctx.app)
      .get('/api/v1/dictionary')
      .set('Authorization', `Bearer ${settingsOnlyToken()}`);
    expect(listRes.status).toBe(200);

    const createRes = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${settingsOnlyToken()}`)
      .send(basePayload);
    expect(createRes.status).toBe(201);
  });

  it('yalnızca settings.* izni olan → dictionary.update gerektiren PUT hâlâ 403', async () => {
    const admin = signTestToken();
    const created = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${admin}`)
      .send(basePayload);

    const updateRes = await request(ctx.app)
      .put(`/api/v1/dictionary/${created.body.data._id}`)
      .set('Authorization', `Bearer ${settingsOnlyToken()}`)
      .send({ english_term: 'X' });
    expect(updateRes.status).toBe(403);
  });

  // KOK NEDEN REGRESYON TESTİ: Ayarlar ekranının "Alt Grup" SelectBox'ı
  // GET /api/v1/dictionary/subgroups çağırır. Bu route ÖNCEDEN yalnızca
  // `dictionary.read` kabul ediyordu; yalnızca settings.*'e sahip bir
  // kullanıcıda (Ayarlar'a erişebilen ama dictionary.read'i OLMAYAN,
  // gerçek bir izin kombinasyonu) istek SESSİZCE 403 dönüyor, frontend
  // bunu yutup boş bir dropdown gösteriyordu. Route artık GET / ve POST /
  // ile AYNI `requireAnyPermission(['dictionary.read','settings.read'])`
  // desenini kullanır.
  it('yalnızca settings.read izni olan → GET /subgroups 200 (Alt Grup SelectBox akışı)', async () => {
    const admin = signTestToken();
    await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${admin}`)
      .send({ ...basePayload, group: 'Endüstriyel', subgroup: 'Kalite' });

    const res = await request(ctx.app)
      .get('/api/v1/dictionary/subgroups')
      .query({ group: 'Endüstriyel' })
      .set('Authorization', `Bearer ${settingsOnlyToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(['Kalite']);
  });

  it('ne dictionary.read ne settings.* izni olan → GET /subgroups 403', async () => {
    const res = await request(ctx.app)
      .get('/api/v1/dictionary/subgroups')
      .query({ group: 'Endüstriyel' })
      .set('Authorization', `Bearer ${plainUserToken()}`);
    expect(res.status).toBe(403);
  });

  // -------------------------------------------------------------------
  // AUDIT METADATA: created_by_id / updated_by_id / created_at / updated_at
  // (bkz. dictionary.repository.mongo.ts / tests/support/memoryRepository.ts)
  //
  // `signTestToken()`'ın PAYLAŞILAN varsayılan `_id: 'u1'`si BİLEREK
  // KULLANILMAZ -- gerçek ObjectId formatında DEĞİLDİR (bu, projede
  // ObjectId.isValid ile korunan diğer ~25 teste dokunmadan, o testlerin
  // hâlâ 'u1' ile çalışabilmesi için KASITLI bırakıldı). Audit alanları
  // gerçek BSON ObjectId'ye çevrildiği için burada `new ObjectId()` ile
  // üretilen GEÇERLİ hex id'ler kullanılır.
  // -------------------------------------------------------------------

  it("created_by_id/updated_by_id/created_at/updated_at: yeni kayıt authenticated user ObjectId'i ve server timestamp ile oluşur", async () => {
    const actorId = new ObjectId().toHexString();
    const token = signTestToken({
      _id: actorId,
      username: 'tester',
      role: 'admin',
    });
    const res = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload);

    expect(res.status).toBe(201);
    expect(res.body.data.created_by_id).toBe(actorId);
    expect(res.body.data.updated_by_id).toBe(actorId);
    expect(res.body.data.created_at).toBeDefined();
    expect(res.body.data.updated_at).toBeDefined();
    // İlk oluşturmada created_at ile updated_at AYNI andır.
    expect(new Date(res.body.data.created_at).getTime()).toBe(
      new Date(res.body.data.updated_at).getTime(),
    );
  });

  it('created_by_id güvenliği: request body içinde sahte created_by_id/updated_by_id gönderilse bile gerçek authenticated user id kullanılır', async () => {
    const actorId = new ObjectId().toHexString();
    const fakeId = new ObjectId().toHexString();
    const token = signTestToken({
      _id: actorId,
      username: 'tester',
      role: 'admin',
    });
    const res = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...basePayload, created_by_id: fakeId, updated_by_id: fakeId });

    expect(res.status).toBe(201);
    expect(res.body.data.created_by_id).toBe(actorId);
    expect(res.body.data.updated_by_id).toBe(actorId);
    expect(res.body.data.created_by_id).not.toBe(fakeId);
  });

  it("güncelleme: created_by_id/created_at değişmez, updated_by_id güncelleyen kullanıcı olur, updated_at ileri bir timestamp'e güncellenir", async () => {
    const creatorId = new ObjectId().toHexString();
    const updaterId = new ObjectId().toHexString();
    const creatorToken = signTestToken({
      _id: creatorId,
      username: 'creator',
      role: 'admin',
    });
    const updaterToken = signTestToken({
      _id: updaterId,
      username: 'updater',
      role: 'admin',
    });

    const created = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(basePayload);

    const createdById = created.body.data.created_by_id;
    const createdAt = created.body.data.created_at;
    expect(createdById).toBe(creatorId);

    // updated_at'in created_at'ten kesin olarak İLERİ bir timestamp
    // olduğunu doğrulayabilmek için (aynı milisaniyede tie olmasın diye)
    // küçük bir gecikme.
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Kaydı FARKLI bir kullanıcı (B) günceller -- created_by_id (A) SABİT
    // kalmalı, updated_by_id B'ye DEĞİŞMELİ.
    const res = await request(ctx.app)
      .put(`/api/v1/dictionary/${created.body.data._id}`)
      .set('Authorization', `Bearer ${updaterToken}`)
      .send({ description: 'Güncellendi' });

    expect(res.status).toBe(200);
    expect(res.body.data.created_by_id).toBe(createdById);
    expect(res.body.data.created_at).toBe(createdAt);
    expect(res.body.data.updated_by_id).toBe(updaterId);
    expect(res.body.data.updated_by_id).not.toBe(createdById);
    expect(new Date(res.body.data.updated_at).getTime()).toBeGreaterThan(
      new Date(createdAt).getTime(),
    );
  });

  it('metadata manipülasyonu: update body içindeki created_by_id/updated_by_id/created_at/updated_at backend tarafından yok sayılır', async () => {
    const actorId = new ObjectId().toHexString();
    const fakeId = new ObjectId().toHexString();
    const token = signTestToken({
      _id: actorId,
      username: 'tester',
      role: 'admin',
    });
    const created = await request(ctx.app)
      .post('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload);

    const createdById = created.body.data.created_by_id;
    const createdAt = created.body.data.created_at;

    const res = await request(ctx.app)
      .put(`/api/v1/dictionary/${created.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'Manipülasyon denemesi',
        created_by_id: fakeId,
        updated_by_id: fakeId,
        created_at: '2000-01-01T00:00:00.000Z',
        updated_at: '2000-01-01T00:00:00.000Z',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.created_by_id).toBe(createdById);
    expect(res.body.data.created_at).toBe(createdAt);
    // updated_by_id burada GERÇEK actor (token sahibi) olmalı -- body'deki
    // sahte fakeId DEĞİL.
    expect(res.body.data.updated_by_id).toBe(actorId);
    expect(res.body.data.updated_by_id).not.toBe(fakeId);
    expect(res.body.data.updated_at).not.toBe('2000-01-01T00:00:00.000Z');
  });
});
