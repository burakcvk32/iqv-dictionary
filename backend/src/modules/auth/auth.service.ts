import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiError } from '../../utils/apiError';
import { LoginCredentials, SafeUser, UsersRepository } from './auth.types';

const INVALID_CREDENTIALS_MESSAGE = 'Kullanıcı adı veya parola hatalı.';

const toSafeUser = (user: {
  _id: string;
  username: string;
  full_name?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  company_id?: string;
  organization_id?: string;
  company_name?: string;
  status?: string;
}): SafeUser => ({
  _id: user._id,
  username: user.username,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
  permissions: user.permissions,
  company_id: user.company_id,
  organization_id: user.organization_id,
  company_name: user.company_name,
  status: user.status,
});

export interface LoginResult {
  token: string;
  user: SafeUser;
}

export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtSecret: string,
    private readonly jwtExpiresIn: string,
  ) {}

  // `GET /api/v1/auth/me` -- bootstrap/"protected page flash" duzeltmesi
  // icin: `authenticate` middleware'i JWT imza+expiry'yi zaten dogruladi
  // (bu fonksiyon cagrildiginda `userId` sahtelenemez, token'dan gelir).
  // Burada login()'deki AYNI iki kural TEKRAR kullanilir: (1) kullanici
  // hala veritabaninda var mi, (2) status hala 'active' mi -- boylece
  // token gecerli olsa BILE, sonradan silinen/pasife alinan bir
  // kullanicinin oturumu bir sonraki bootstrap/verify cagrisinda
  // GERCEKTEN reddedilir (mevcut sistemde bu kontrol daha once SADECE
  // login anindaydi, sonrasinda hic tekrarlanmiyordu).
  async me(userId: string): Promise<SafeUser> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw ApiError.unauthorized(
        'Oturum geçersiz, lütfen tekrar giriş yapın.',
      );
    }

    if (user.status && user.status !== 'active') {
      throw ApiError.unauthorized(
        'Hesabınız aktif değil. Lütfen yöneticinizle iletişime geçin.',
      );
    }

    return toSafeUser(user);
  }

  async login(credentials: LoginCredentials): Promise<LoginResult> {
    const user = await this.usersRepository.findByUsername(
      credentials.username,
    );

    if (!user) {
      throw ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
    }

    if (user.status && user.status !== 'active') {
      throw ApiError.unauthorized(
        'Hesabınız aktif değil. Lütfen yöneticinizle iletişime geçin.',
      );
    }

    const passwordMatches = await bcrypt.compare(
      credentials.password,
      user.password,
    );

    if (!passwordMatches) {
      throw ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
    }

    const safeUser = toSafeUser(user);

    // Same JWT_SECRET the Dictionary (and every other module's) auth
    // middleware verifies with — one shared token system, no per-module
    // secrets.
    const token = jwt.sign(
      {
        _id: safeUser._id,
        username: safeUser.username,
        role: safeUser.role,
        permissions: safeUser.permissions,
        company_id: safeUser.company_id,
        organization_id: safeUser.organization_id,
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn } as jwt.SignOptions,
    );

    return { token, user: safeUser };
  }
}
