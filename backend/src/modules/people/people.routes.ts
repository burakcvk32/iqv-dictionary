import { Router } from 'express';
import { createAuthMiddleware, requirePermission } from '../../middleware/auth';
import { createPeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { PeopleRepository } from './people.types';

export const createPeopleRouter = (
  repository: PeopleRepository,
  jwtSecret: string,
): Router => {
  const router = Router();
  const service = new PeopleService(repository);
  const controller = createPeopleController(service);
  const authenticate = createAuthMiddleware(jwtSecret);

  router.use(authenticate);

  // TURN: liste artik da GERCEK bir izinle korunuyor (onceki turda yalnizca
  // kimlik dogrulama vardi -- "Yetkileri Düzenle" popup'inin Kişi bölümünün
  // gercek bir karsiligi olmasi icin bu route da eklendi).
  router.get('/', requirePermission('users.read'), controller.list);

  // TURN: "Personel Oluştur" -- yeni kayıt oluşturma, `users.create` izniyle
  // korunur (middleware/auth.ts PermissionKey'de zaten var olan GERÇEK izin).
  router.post('/', requirePermission('users.create'), controller.create);

  // PUT + PATCH ikisi de destekleniyor -- Dictionary (terim) modulunun
  // KENDI GERCEK emsaliyle (dictionary.routes.ts) BIREBIR ayni desen.
  // Gercek izin kontrolu BURADA (route middleware) yapilir; controller
  // katmani sadece dogrulanmis, izinli bir istekle calisir.
  router.put('/:id', requirePermission('users.update'), controller.update);
  router.patch('/:id', requirePermission('users.update'), controller.update);
  router.delete('/:id', requirePermission('users.delete'), controller.remove);

  return router;
};

export { PeopleService };
