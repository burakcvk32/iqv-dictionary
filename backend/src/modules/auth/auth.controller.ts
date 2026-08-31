import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/apiError';
import { AuthService } from './auth.service';
import { validateLoginPayload } from './auth.validation';

export const createAuthController = (service: AuthService) => ({
  login: asyncHandler(async (req: Request, res: Response) => {
    const credentials = validateLoginPayload(req.body ?? {});
    const { token, user } = await service.login(credentials);

    res.status(200).json({ success: true, token, user });
  }),

  // `GET /api/v1/auth/me` -- `authenticate` middleware'i BU noktaya kadar
  // JWT imza+expiry'yi zaten dogruladi ve `req.user._id`yi TOKEN'dan
  // (sahtelenemez) atadi. `_id` hicbir sekilde yoksa (teorik olarak
  // olmamali, ama token payload'u bozuksa) 401 ile reddedilir --
  // `service.me`ye asla `undefined` GECIRILMEZ.
  me: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?._id;

    if (!userId) {
      throw ApiError.unauthorized(
        'Oturum geçersiz, lütfen tekrar giriş yapın.',
      );
    }

    const user = await service.me(userId);

    res.status(200).json({ success: true, user });
  }),
});
