import { ApiError } from '../../utils/apiError';
import { LoginCredentials } from './auth.types';

export const validateLoginPayload = (
  body: Record<string, unknown>,
): LoginCredentials => {
  const errors: { field: string; message: string }[] = [];

  if (typeof body.username !== 'string' || body.username.trim().length === 0) {
    errors.push({ field: 'username', message: 'Kullanıcı adı zorunludur.' });
  }

  if (typeof body.password !== 'string' || body.password.length === 0) {
    errors.push({ field: 'password', message: 'Parola zorunludur.' });
  }

  if (errors.length > 0) {
    throw ApiError.unprocessable('Girilen bilgiler geçersiz.', errors);
  }

  return {
    username: (body.username as string).trim(),
    password: body.password as string,
  };
};
