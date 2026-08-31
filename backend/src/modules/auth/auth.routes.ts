import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { createAuthMiddleware } from '../../middleware/auth';
import { createAuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from './auth.types';

export const createAuthRouter = (
  usersRepository: UsersRepository,
  jwtSecret: string,
  jwtExpiresIn: string,
): Router => {
  const router = Router();
  const service = new AuthService(
    usersRepository,
    jwtSecret,
    jwtExpiresIn,
  );
  const controller = createAuthController(service);
  // Dictionary/People router'larindaki AYNI desen (`createAuthMiddleware
  // (jwtSecret)` + `router.use`/route-bazli kullanim) -- yeni bir auth
  // kutuphanesi/mekanizmasi EKLENMEDI.
  const authenticate = createAuthMiddleware(jwtSecret);

  // Stricter limiter on top of the global API limiter — login is the most
  // brute-forceable endpoint in the app.
  const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.post('/login', loginLimiter, controller.login);

  // Bootstrap/"protected page flash" duzeltmesi icin: frontend, elindeki
  // token'i sayfa render etmeden ONCE bu route ile backend'e dogrulatir.
  // `/login`'in AKSINE bu route `authenticate` GEREKTIRIR -- token yoksa/
  // gecersizse/suresi dolmussa middleware zaten 401 ile reddeder, controller
  // hic calismaz.
  router.get('/me', authenticate, controller.me);

  return router;
};

export { AuthService };
