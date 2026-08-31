import { Router } from 'express';
import {
  createAuthMiddleware,
  requireAnyPermission,
  requirePermission,
} from '../../middleware/auth';
import { createDictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';
import { DictionaryRepository } from './dictionary.types';

export const createDictionaryRouter = (
  repository: DictionaryRepository,
  jwtSecret: string,
): Router => {
  const router = Router();
  const service = new DictionaryService(repository);
  const controller = createDictionaryController(service);
  const authenticate = createAuthMiddleware(jwtSecret);

  router.use(authenticate);

  // /stats and /subgroups must be registered before /:id so they are not
  // swallowed by the :id param route.
  //
  // /stats yalnizca ana Dictionary sayfasindan cagrilir (Ayarlar hic
  // kullanmaz) -- saf dictionary.read yeterlidir.
  router.get('/stats', requirePermission('dictionary.read'), controller.stats);

  // KOK NEDEN DUZELTMESI: /subgroups ARTIK Ayarlar ekranindan da cagriliyor
  // (dashboard/src/components/settings/index.tsx -- "Alt Grup" SelectBox'i,
  // secilen Grup'a ait GERCEK alt grup listesini bu uctan ceker). Onceki
  // yorum ("Ayarlar hic kullanmaz") artik GECERSIZ. Route tek basina
  // `dictionary.read` istiyordu; ama Ayarlar'a yalnizca `settings.read` /
  // `settings.update` izniyle giren (dictionary.read'i OLMAYAN, ozel
  // izin listesi atanmis) bir kullanicida bu istek SESSIZCE 403 donuyor
  // ve frontend'in `.catch()` bloğu bunu yutuyordu -- Alt Grup dropdown'u
  // acilan ama SECENEKSIZ gorunmesinin GERCEK nedeni buydu, bir UI/
  // component hatasi DEGILDI. Asagidaki GET '/' ve POST '/' route'larinda
  // ZATEN uygulanan AYNI `requireAnyPermission` deseniyle duzeltilir --
  // yeni bir izin UYDURULMADI, mevcut `settings.read` projede zaten
  // GERCEK, tanimli bir izindir.
  router.get(
    '/subgroups',
    requireAnyPermission(['dictionary.read', 'settings.read']),
    controller.subgroups,
  );

  // NOT: GET '/' (arama/listeleme) VE POST '/' (yeni kayit) hem ana
  // Dictionary sayfasindan hem de Ayarlar sayfasindan (bkz.
  // dashboard/src/components/settings/index.tsx -- kendi backend route'u
  // OLMAYAN, bu iki endpoint'i dogrudan cagiran bir arayuz) cagrilir. Bu
  // yuzden bu iki route'ta dictionary.read/dictionary.create YETERLI
  // olmakla birlikte, settings.read/settings.update de GECERLI bir GERCEK
  // giris yoludur (requireAnyPermission) -- Ayarlar icin UYDURULMUS, ikinci
  // bir backend yuzeyi ACILMADI.
  router.get(
    '/',
    requireAnyPermission(['dictionary.read', 'settings.read']),
    controller.list,
  );
  router.get('/:id', requirePermission('dictionary.read'), controller.getById);
  router.post(
    '/',
    requireAnyPermission(['dictionary.create', 'settings.update']),
    controller.create,
  );
  router.put('/:id', requirePermission('dictionary.update'), controller.update);
  router.patch(
    '/:id',
    requirePermission('dictionary.update'),
    controller.update,
  );
  router.delete(
    '/:id',
    requirePermission('dictionary.delete'),
    controller.remove,
  );

  return router;
};

export { DictionaryService };
