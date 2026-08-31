import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, signTestToken } from './support/testApp';
import { UserRecord } from '../modules/auth/auth.types';

const buildUser = (overrides: Partial<UserRecord> = {}): UserRecord => ({
  _id: '64b64b64b64b64b64b64b64',
  username: 'burak.cevik',
  password: bcrypt.hashSync('correct-password', 4),
  full_name: 'Burak ÇEVİK',
  email: 'burak.cevik@iqvizyon.com',
  role: 'organizationadmin',
  status: 'active',
  company_id: 'c1',
  organization_id: 'o1',
  company_name: 'IQVizyon',
  ...overrides,
});

describe('Auth API', () => {
  it('doğru kullanıcı adı/parola ile 200 ve token döner, parola response içinde yok', async () => {
    const { app } = buildTestApp([buildUser()]);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'burak.cevik', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.username).toBe('burak.cevik');
    expect(res.body.user.password).toBeUndefined();
  });

  it('kullanıcı adı case-insensitive eşleşir', async () => {
    const { app } = buildTestApp([buildUser()]);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'Burak.Cevik', password: 'correct-password' });

    expect(res.status).toBe(200);
  });

  it('yanlış parola 401 döner', async () => {
    const { app } = buildTestApp([buildUser()]);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'burak.cevik', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('olmayan kullanıcı 401 döner', async () => {
    const { app } = buildTestApp([]);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ghost', password: 'anything' });

    expect(res.status).toBe(401);
  });

  it('eksik alanlarda 422 döner', async () => {
    const { app } = buildTestApp([buildUser()]);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: '' });
    expect(res.status).toBe(422);
  });

  it('status aktif değilse 401 döner', async () => {
    const { app } = buildTestApp([buildUser({ status: 'suspended' })]);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'burak.cevik', password: 'correct-password' });

    expect(res.status).toBe(401);
  });

  it('login token, Dictionary endpointinde de kabul edilir (aynı JWT_SECRET)', async () => {
    const { app } = buildTestApp([buildUser()]);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'burak.cevik', password: 'correct-password' });

    const token = loginRes.body.token;

    const dictionaryRes = await request(app)
      .get('/api/v1/dictionary')
      .set('Authorization', `Bearer ${token}`);

    expect(dictionaryRes.status).toBe(200);
  });

  it('reqres.in benzeri harici bir servise istek atmıyor (sadece local app üzerinden çalışır)', async () => {
    const { app } = buildTestApp([buildUser()]);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'burak.cevik', password: 'correct-password' });

    // Login purely in-process against the injected repository — no network
    // call is made, proving the endpoint is fully local.
    expect(res.status).toBe(200);
  });
});

// QA TURU: GET /api/v1/auth/me daha önce (bootstrap/"protected page
// flash" düzeltmesi turunda) eklendi ama HİÇ test edilmemişti — bu blok
// tam olarak o düzeltmenin var olma nedenini (AUTH-03/04/08) doğrular:
// token GEÇERLİ olsa bile, kullanıcı sonradan silinmiş/pasife alınmışsa
// oturum GERÇEKTEN reddedilmeli.
describe('Auth API — GET /auth/me (bootstrap / "protected page flash" doğrulaması)', () => {
  it('AUTH: token olmadan /me → 401', async () => {
    const { app } = buildTestApp([buildUser()]);

    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('AUTH: bozuk/anlamsız (malformed) token ile /me → 401, "Geçersiz oturum jetonu."', async () => {
    const { app } = buildTestApp([buildUser()]);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer bu-bir-jwt-degil-sadece-rastgele-metin');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Geçersiz oturum jetonu/);
  });

  it('AUTH: süresi dolmuş (expired) token ile /me → 401', async () => {
    const { app } = buildTestApp([buildUser()]);
    const expiredToken = signTestToken(
      {
        _id: '64b64b64b64b64b64b64b64',
        username: 'burak.cevik',
        role: 'organizationadmin',
      },
      { expiresIn: '-10s' },
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it('AUTH: geçerli token + aktif kullanıcı → 200, TAZE kullanıcı verisi döner, parola YOK', async () => {
    const user = buildUser({ full_name: 'Burak ÇEVİK (güncel)' });
    const { app } = buildTestApp([user]);
    const token = signTestToken({
      _id: user._id,
      username: user.username,
      role: user.role,
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.username).toBe('burak.cevik');
    expect(res.body.user.full_name).toBe('Burak ÇEVİK (güncel)');
    expect(res.body.user.password).toBeUndefined();
  });

  it('AUTH-08: token GEÇERLİ ama kullanıcı sonradan SİLİNMİŞ → /me 401 (stale token kabul edilmez)', async () => {
    // Kullanıcı repository'ye HİÇ eklenmedi — token imzası geçerli olsa
    // bile artık var olmayan bir kullanıcıyı temsil ediyor (silinmiş
    // hesap senaryosu).
    const { app } = buildTestApp([]);
    const token = signTestToken({
      _id: '64b64b64b64b64b64b64b64',
      username: 'silinmis.kullanici',
      role: 'organizationadmin',
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it('AUTH-08: token GEÇERLİ ama kullanıcı artık PASİF (status != active) → /me 401 (korumalı içerik açılmamalı)', async () => {
    const user = buildUser({ status: 'inactive' });
    const { app } = buildTestApp([user]);
    const token = signTestToken({
      _id: user._id,
      username: user.username,
      role: user.role,
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});
