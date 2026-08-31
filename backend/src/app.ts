import cors from 'cors';
import express, { Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createDictionaryRouter } from './modules/dictionary/dictionary.routes';
import { DictionaryService } from './modules/dictionary/dictionary.service';
import { DictionaryRepository } from './modules/dictionary/dictionary.types';
import { createLegacyDictionaryRouter } from './legacy/legacy.routes';
import { createAuthRouter } from './modules/auth/auth.routes';
import { UsersRepository } from './modules/auth/auth.types';
import { createPeopleRouter } from './modules/people/people.routes';
import { PeopleRepository } from './modules/people/people.types';
import { createDocsRouter } from './docs/swagger';

export interface AppDependencies {
  dictionaryRepository: DictionaryRepository;
  usersRepository: UsersRepository;
  peopleRepository: PeopleRepository;
  jwtSecret: string;
  jwtExpiresIn?: string;
  corsOrigin?: string | string[];
}

export const createApp = (deps: AppDependencies): Express => {
  const app = express();

  app.disable('x-powered-by');
  // KOK NEDEN (LAN IP uzerinden /api-docs BOS SAYFA hatasi): helmet()'in
  // VARSAYILAN Content-Security-Policy'si `upgrade-insecure-requests`
  // direktifini icerir -- bu, sayfadaki TUM alt kaynak (css/js) isteklerini
  // otomatik olarak HTTPS'e yukseltmeye calisir. `localhost` tarayicilarca
  // (Chrome dahil) "potentially trustworthy" (guvenli) kabul edildigi icin
  // bu yukseltme sorun cikarmiyordu/gizli kaliyordu -- ama LAN IP'den
  // (ornegin http://192.168.10.172:5173) duz HTTP uzerinden erisildiginde
  // origin GUVENSIZ sayiliyor, tarayici swagger-ui.css/bundle.js/init.js
  // gibi ayni-origin alt kaynaklari HTTPS'e yukseltmeye calisiyor, bu
  // projede HTTPS sunulmadigi icin istekler basarisiz oluyor (Chrome
  // console'da `net::ERR_BLOCKED_BY_CLIENT` + "URL's origin was
  // untrustworthy" uyarisiyla) -- SONUC: Swagger'in kendi CSS/JS'i hic
  // yuklenmiyor, BOS SAYFA. Duzeltme: SADECE bu tek direktif kaldirilir,
  // CSP'nin geri kalani (default-src 'self' vb.) DEGISMEDEN korunur --
  // proje zaten hem dev'de hem production'da (nginx.conf) duz HTTP servis
  // ediyor, bu direktifin burada gercek bir guvenlik faydasi yok, sadece
  // LAN IP erisimini kirıyordu.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'upgrade-insecure-requests': null,
        },
      },
    }),
  );
  // Birden fazla origin (ör. LAN geliştirme: localhost + LAN IP) destekler.
  // Tek eleman '*' ise (varsayılan/joker), `cors`'a dizi değil DÜZ '*'
  // string'i verilir — aksi halde `cors` diziyi bir whitelist gibi
  // yorumlayıp yalnızca Origin header'ı harfiyen "*" olan (hiçbir zaman
  // gerçekleşmeyen) istekleri kabul eder, bu da her isteği bloklardı.
  const corsOriginList = Array.isArray(deps.corsOrigin)
    ? deps.corsOrigin
    : [deps.corsOrigin ?? '*'];
  const corsOrigin =
    corsOriginList.length === 1 && corsOriginList[0] === '*'
      ? '*'
      : corsOriginList;
  app.use(
    cors({
      origin: corsOrigin,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', apiLimiter);
  app.use(
    '/api/v1/auth',
    createAuthRouter(
      deps.usersRepository,
      deps.jwtSecret,
      deps.jwtExpiresIn ?? '12h',
    ),
  );
  app.use(
    '/api/v1/users',
    createPeopleRouter(deps.peopleRepository, deps.jwtSecret),
  );
  app.use('/list-dictionary', apiLimiter);
  app.use('/create-dictionary', apiLimiter);

  app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, data: { status: 'ok' } });
  });

  const dictionaryService = new DictionaryService(deps.dictionaryRepository);

  app.use(
    '/api/v1/dictionary',
    createDictionaryRouter(deps.dictionaryRepository, deps.jwtSecret),
  );

  // Legacy Node-RED compatibility aliases — same service, no duplicated logic.
  app.use(createLegacyDictionaryRouter(dictionaryService, deps.jwtSecret));

  // IQV Dictionary Swagger / OpenAPI dokumantasyonu -- backend-native,
  // JWT/auth middleware'inin DISINDA (herkese acik, tipki Swagger UI'nin
  // kendisinin de acik olmasi gerektigi gibi). `/api-docs`, `/api-docs/`
  // ve `/openapi.json` route'lari burada tanimlanir.
  app.use(createDocsRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
