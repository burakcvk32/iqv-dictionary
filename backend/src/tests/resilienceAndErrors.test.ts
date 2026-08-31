import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { MemoryDictionaryRepository } from './support/memoryRepository';
import { MemoryUsersRepository } from './support/memoryUsersRepository';
import { MemoryPeopleRepository } from './support/memoryPeopleRepository';
import { TEST_JWT_SECRET, signTestToken } from './support/testApp';
import {
  DictionaryListQuery,
  DictionaryListResult,
} from '../modules/dictionary/dictionary.types';

// QA TURU — bu dosya şunu kapsar:
//   ApiError OLMAYAN (beklenmeyen) bir hata middleware/errorHandler.ts
//   tarafından 500'e çevrilmeli VE ham hata mesajı/stack response'a
//   SIZMAMALI (yalnızca genel bir mesaj dönmeli).

// `list()` KASITLI OLARAK plain bir Error fırlatır (ApiError DEĞİL) --
// errorHandler.ts'in "beklenmeyen hata" (500) dalını gerçekten,
// uçtan uca (HTTP response'a kadar) tetiklemek için.
class ThrowingListDictionaryRepository extends MemoryDictionaryRepository {
  async list(_query: DictionaryListQuery): Promise<DictionaryListResult> {
    throw new Error(
      'SIMULATED: MongoDB bağlantısı zaman aşımına uğradı (internal detail)',
    );
  }
}

const adminToken = () =>
  signTestToken({
    _id: '507f1f77bcf86cd799439099',
    username: 'admin.tester',
    role: 'organizationadmin',
  });

describe("Error handling — ApiError olmayan beklenmeyen hatalar 500'e düşer, iç detay sızdırmaz", () => {
  it("Dictionary list sırasında beklenmeyen (ApiError olmayan) bir hata fırlatılırsa → 500, jenerik mesaj döner, ham hata metni response'a SIZMAZ", async () => {
    const dictionaryRepository = new ThrowingListDictionaryRepository();
    const usersRepository = new MemoryUsersRepository([]);
    const peopleRepository = new MemoryPeopleRepository([]);

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const app = createApp({
      dictionaryRepository,
      usersRepository,
      peopleRepository,
      jwtSecret: TEST_JWT_SECRET,
      jwtExpiresIn: '1h',
      corsOrigin: '*',
    });

    const res = await request(app)
      .get('/api/v1/dictionary')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Beklenmeyen bir sunucu hatası oluştu.');
    // Ham/iç hata metni (MongoDB, internal detail gibi kelimeler) HİÇBİR
    // ZAMAN response body'sine sızmamalı -- yalnızca server-side console'a
    // (errorHandler.ts) yazılmalı.
    const serializedBody = JSON.stringify(res.body);
    expect(serializedBody).not.toContain('MongoDB bağlantısı');
    expect(serializedBody).not.toContain('internal detail');
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('Tanımsız route → 404, "Route not found" mesajı', async () => {
    const dictionaryRepository = new MemoryDictionaryRepository();
    const usersRepository = new MemoryUsersRepository([]);
    const peopleRepository = new MemoryPeopleRepository([]);

    const app = createApp({
      dictionaryRepository,
      usersRepository,
      peopleRepository,
      jwtSecret: TEST_JWT_SECRET,
      jwtExpiresIn: '1h',
      corsOrigin: '*',
    });

    const res = await request(app).get('/api/v1/bu-route-hic-yok');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Route not found/);
  });
});
