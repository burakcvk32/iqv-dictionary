import { describe, it, expect } from 'vitest';
import {
  ALL_PERMISSIONS,
  hasPermission,
  isAdminTierRole,
  resolvePermissions,
} from './permissions';
import { Admin } from '../interfaces/models/admin';

// Gerçek `src/utils/permissions.ts` içindeki, backend
// `middleware/auth.ts`'teki PermissionKey/ROLE_PERMISSIONS ile birebir
// eşleşmesi gereken çözümleme mantığı test ediliyor. Hiçbir izin/rol
// UYDURULMADI -- yalnızca gerçek kaynak dosyadaki değerler kullanıldı.
const admin = (overrides: Partial<Admin> = {}): Admin => ({
  token: 'tok',
  user: {
    _id: 'u1',
    username: 'tester',
    role: 'user',
    ...overrides.user,
  },
  ...overrides,
});

describe('resolvePermissions', () => {
  it('admin null/undefined ise boş bir izin kümesi döner (crash etmez)', () => {
    expect(resolvePermissions(null).size).toBe(0);
    expect(resolvePermissions(undefined as never).size).toBe(0);
  });

  it('kullanıcıda AÇIK bir permissions dizisi varsa, rol tamamen YOK SAYILIR ve o dizi kullanılır', () => {
    const result = resolvePermissions(
      admin({
        user: {
          _id: 'u1',
          username: 'tester',
          role: 'user', // rol tabanlı eşleme boş olurdu
          permissions: ['dictionary.read', 'dictionary.update'],
        },
      }),
    );
    expect([...result].sort()).toEqual(
      ['dictionary.read', 'dictionary.update'].sort(),
    );
  });

  it('permissions dizisi BOŞ ise (yok değil, [] ise) role-based varsayılana düşer', () => {
    const result = resolvePermissions(
      admin({
        user: {
          _id: 'u1',
          username: 'tester',
          role: 'superadmin',
          permissions: [],
        },
      }),
    );
    expect([...result].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it.each(['superadmin', 'companyadmin', 'organizationadmin', 'admin'])(
    "'%s' rolü, açık permissions verisi yokken TÜM izinlere sahiptir",
    (role) => {
      const result = resolvePermissions(
        admin({ user: { _id: 'u1', username: 'x', role } }),
      );
      expect([...result].sort()).toEqual([...ALL_PERMISSIONS].sort());
    },
  );

  it("'user' rolü, açık permissions verisi yokken HİÇBİR izne sahip değildir", () => {
    const result = resolvePermissions(
      admin({ user: { _id: 'u1', username: 'x', role: 'user' } }),
    );
    expect(result.size).toBe(0);
  });

  it('bilinmeyen/geçersiz bir rol, boş bir izin kümesine düşer (crash etmez, sessizce reddeder)', () => {
    const result = resolvePermissions(
      admin({ user: { _id: 'u1', username: 'x', role: 'hicbirsey' } }),
    );
    expect(result.size).toBe(0);
  });

  it('rol karşılaştırması büyük/küçük harf ve baştaki/sondaki boşluklardan bağımsızdır', () => {
    const result = resolvePermissions(
      admin({ user: { _id: 'u1', username: 'x', role: '  SuperAdmin  ' } }),
    );
    expect([...result].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it('user alanı hiç yoksa (undefined) boş rol -> boş izin kümesi döner', () => {
    const result = resolvePermissions({ token: 'tok' } as Admin);
    expect(result.size).toBe(0);
  });
});

describe('hasPermission', () => {
  it('resolvePermissions ile birebir tutarlıdır', () => {
    const a = admin({
      user: { _id: 'u1', username: 'x', role: 'organizationadmin' },
    });
    expect(hasPermission(a, 'dictionary.delete')).toBe(true);
    expect(
      hasPermission(
        admin({ user: { _id: 'u1', username: 'x', role: 'user' } }),
        'dictionary.delete',
      ),
    ).toBe(false);
  });
});

describe('isAdminTierRole', () => {
  it("'user' HARİÇ tüm ROLE_PERMISSIONS anahtarları admin-tier sayılır", () => {
    for (const role of [
      'superadmin',
      'companyadmin',
      'organizationadmin',
      'admin',
    ]) {
      expect(
        isAdminTierRole(admin({ user: { _id: 'u1', username: 'x', role } })),
      ).toBe(true);
    }
  });

  it("'user' rolü ve bilinmeyen roller admin-tier DEĞİLDİR", () => {
    expect(
      isAdminTierRole(
        admin({ user: { _id: 'u1', username: 'x', role: 'user' } }),
      ),
    ).toBe(false);
    expect(
      isAdminTierRole(
        admin({ user: { _id: 'u1', username: 'x', role: 'bilinmeyen' } }),
      ),
    ).toBe(false);
    expect(isAdminTierRole(null)).toBe(false);
  });
});
