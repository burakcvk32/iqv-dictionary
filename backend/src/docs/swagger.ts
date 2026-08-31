import fs from 'fs';
import path from 'path';
import express, { NextFunction, Request, Response, Router } from 'express';
// KOK NEDEN (Vitest altinda "Cannot read properties of undefined
// (reading 'load')"): js-yaml@5.x artik SADECE named export'lar
// sunuyor (dist/js-yaml.mjs'de `export default` YOK) -- gercek Node/
// tsx CJS calistirmasinda (`esModuleInterop`) TypeScript'in
// `__importDefault` yardimcisi butun modulu `{ default: modul }`
// olarak SARDIGI icin `import yaml from 'js-yaml'` calisiyordu, AMA
// Vitest/Vite'in kendi ESM-once modul cozumlemesi package.json
// `exports.import` alanindaki GERCEK ESM dosyasini (default export'u
// OLMAYAN) DOGRUDAN yukluyor -- bu yuzden `yaml` orada `undefined`
// donuyordu. `import * as yaml from 'js-yaml'` (namespace import) HER
// IKI ortamda da (CJS interop + gercek ESM) dogru calisir.
import * as yaml from 'js-yaml';
import swaggerUi from 'swagger-ui-express';

// IQV Dictionary Swagger / OpenAPI dokumantasyonu -- BACKEND-NATIVE.
//
// REFERANS: IQV Flex ERP (kardes proje) -> `app.js` (mount sirasi/yapisi)
// ve `src/config/swagger.js` (`applyIqvTaxonomy` -- iki seviyeli
// TOTAL/INTERNAL/OUTPUT/SYSTEM + domain gruplama mimarisi). Bu dosya ERP'de
// CALISAN mimariyi BIREBIR ayni ilkeyle uygular; Dictionary'e ozgu FARKLI
// bir mimari URETILMEZ -- yalnizca: (1) tek dogruluk kaynagi burada elle
// yazilmis YAML'dir (ERP'de JS nesnesi), taksonomi YAML yuklendikten SONRA
// ayni sekilde uygulanir; (2) siniflandirma etiketi ERP'deki `OUTPUT`
// yerine `EXTERNAL` kullanir (kullanicinin acik talebi).
//
// KOK NEDEN (ilk hatali surum): `/api-docs` bir React/Vite frontend
// route'uydu; Vite dev proxy'sindeki `'/api': {...}` kurali, Vite'in duz
// string prefix eslesmesi (`path.startsWith(context)`) nedeniyle
// `/api-docs` istegini de sessizce route'suz backend'e yonlendiriyordu.
// Duzeltme: route'u GERCEKTEN backend'e eklemek (bu dosya) + Vite
// proxy'sinde `/api-docs` ve `/openapi.json` icin ACIK kurallar
// (dashboard/vite.config.ts).
//
// `src/docs/swagger.ts` (dev, tsx) ve derlenmis `dist/docs/swagger.js`
// (prod, `node dist/server.js`) backend kokune GORE AYNI derinlikte
// (iki seviye yukari) oldugu icin bu tek yol HER IKI modda da dogru
// dosyayi bulur. Prod Docker imajinda `docs/` klasorunun de kopyalanmasi
// gerektigi icin `backend/Dockerfile.prod`'a
// `COPY --from=builder /app/docs ./docs` eklendi.
const DOCS_DIR = path.join(__dirname, '..', '..', 'docs');
const OPENAPI_SPEC_PATH = path.join(DOCS_DIR, 'openapi.yaml');

/* ------------------------------------------------------------------ */
/* IQV siniflandirma taksonomisi -- ERP'deki applyIqvTaxonomy() ile    */
/* AYNI ilke (bkz. ERP backend/src/config/swagger.js).                 */
/* ------------------------------------------------------------------ */

type OperationObject = Record<string, unknown> & {
  tags?: string[];
  'x-iqv-classification'?: string;
  'x-iqv-domain'?: string;
};

// Kok grup ETIKETLERI (Swagger UI'da gorunen tam ad). ERP'nin
// `OUTPUT APIs` etiketi burada `EXTERNAL APIs` olarak kullanilir --
// kullanicinin acik talebi (siniflandirma DEGERI de spec'te zaten
// `EXTERNAL`'dir, ikinci bir eslestirme kod kumesi URETILMEZ).
const IQV_GROUP_LABELS: Record<string, string> = {
  INTERNAL: 'INTERNAL APIs',
  EXTERNAL: 'EXTERNAL APIs',
  SYSTEM: 'SYSTEM APIs',
};

// Kok grup SIRASI (Swagger ekranindaki sira) -- ERP ile AYNI mantik.
const IQV_ROOT_GROUP_ORDER = [
  'TOTAL APIs',
  'INTERNAL APIs',
  'EXTERNAL APIs',
  'SYSTEM APIs',
];

// Alan (domain) SIRASI -- Dictionary'nin GERCEK domainleri (ERP'nin
// listesi KOPYALANMAZ; bu liste yalnizca Dictionary'nin kendi
// `x-iqv-domain` degerlerinden olusur).
const IQV_DOMAIN_ORDER = ['Health', 'Auth', 'Dictionary', 'People'];

const IQV_TAG_SEPARATOR = ' / ';
const API_SUMMARY_PLACEHOLDER = '{{API_SUMMARY}}';

interface OpenApiSpec {
  info: { description?: string };
  tags?: Array<{ name: string; description?: string }>;
  paths?: Record<string, Record<string, OperationObject>>;
  [key: string]: unknown;
}

const OPERATION_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
];

/**
 * ERP'deki applyIqvTaxonomy() ile AYNI islemi yapar: her operation'a
 * spec'teki `x-iqv-classification` / `x-iqv-domain` degerlerinden
 * turetilen IKI kompozit tag atar (`TOTAL APIs / <domain>` ve
 * `<GRUP> / <domain>`), boylece Swagger UI'in NATIVE tag-bazli
 * gruplamasi iki seviyeli gorunumu KENDILIGINDEN uretir -- ozel bir
 * DOM yeniden yazimi/kopyalama GEREKMEZ (bkz. docs/iqv-swagger-groups.js,
 * yalnizca GORSEL toplama/collapse katmani ekler).
 *
 * Bir operation'da `x-iqv-classification`/`x-iqv-domain` eksikse HATA
 * FIRLATIR (ERP'deki AYNI davranis) -- boylece yeni eklenen bir uc nokta
 * YANLISLIKLA gruplamanin disinda KALMAZ, sessizce "Diger"e dusmez.
 */
const applyIqvTaxonomy = (spec: OpenApiSpec): OpenApiSpec => {
  const domainDescriptions = new Map(
    (spec.tags ?? []).map((tag) => [tag.name, tag.description]),
  );

  const counts: Record<string, number> = {
    TOTAL: 0,
    INTERNAL: 0,
    EXTERNAL: 0,
    SYSTEM: 0,
  };
  const domainsByGroup = new Map<string, Set<string>>(
    IQV_ROOT_GROUP_ORDER.map((group) => [group, new Set<string>()]),
  );

  for (const [routePath, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of OPERATION_METHODS) {
      const operation = pathItem[method];
      if (!operation) {
        continue;
      }

      const classification = operation['x-iqv-classification'];
      const domain = operation['x-iqv-domain'];
      if (!classification || !IQV_GROUP_LABELS[classification] || !domain) {
        throw new Error(
          `openapiSpec: ${method.toUpperCase()} ${routePath} icin x-iqv-classification / x-iqv-domain eksik.`,
        );
      }

      const groupLabel = IQV_GROUP_LABELS[classification];
      operation.tags = [
        `TOTAL APIs${IQV_TAG_SEPARATOR}${domain}`,
        `${groupLabel}${IQV_TAG_SEPARATOR}${domain}`,
      ];

      counts.TOTAL += 1;
      counts[classification] += 1;
      domainsByGroup.get('TOTAL APIs')?.add(domain);
      domainsByGroup.get(groupLabel)?.add(domain);
    }
  }

  const domainRank = (name: string) => {
    const index = IQV_DOMAIN_ORDER.indexOf(name);
    return index === -1 ? IQV_DOMAIN_ORDER.length : index;
  };

  const orderedTags: Array<{ name: string; description?: string }> = [];
  for (const group of IQV_ROOT_GROUP_ORDER) {
    const domains = [...(domainsByGroup.get(group) ?? [])].sort(
      (left, right) =>
        domainRank(left) - domainRank(right) || left.localeCompare(right),
    );
    for (const domain of domains) {
      const name = `${group}${IQV_TAG_SEPARATOR}${domain}`;
      const description = domainDescriptions.get(domain);
      orderedTags.push(description ? { name, description } : { name });
    }
  }
  spec.tags = orderedTags;

  const summary = [
    `- **Total APIs:** ${counts.TOTAL}`,
    `- **Internal APIs:** ${counts.INTERNAL}`,
    `- **External APIs:** ${counts.EXTERNAL}`,
    `- **System APIs:** ${counts.SYSTEM}`,
  ].join('\n');
  if (spec.info.description) {
    spec.info.description = spec.info.description
      .split(API_SUMMARY_PLACEHOLDER)
      .join(summary);
  }

  return spec;
};

let cachedSpec: OpenApiSpec | null = null;

const loadSpec = (): OpenApiSpec => {
  if (cachedSpec) {
    return cachedSpec;
  }
  const raw = fs.readFileSync(OPENAPI_SPEC_PATH, 'utf8');
  const spec = yaml.load(raw) as OpenApiSpec;
  cachedSpec = applyIqvTaxonomy(spec);
  return cachedSpec;
};

export const createDocsRouter = (): Router => {
  const router = Router();
  const spec = loadSpec();

  // Gercek OpenAPI 3.0.3 JSON -- HER ZAMAN JSON doner, asla HTML degil.
  // ERP ile AYNI: dogrudan `/openapi.json`, body-parser middleware'lerinden
  // ONCE baglanir (bkz. app.ts -- bu router notFoundHandler'dan once mount
  // edilir).
  router.get('/openapi.json', (_req: Request, res: Response) => {
    res.type('application/json').send(spec);
  });

  // `/api-docs` (trailing slash YOK) -> `/api-docs/`'e temiz redirect.
  // GEREKCE: swagger-ui-express'in urettigi HTML, asset yollarini GORECE
  // ("./swagger-ui.css" vb.) kullanir. Trailing slash olmadan tarayici bu
  // yollari bir ust dizine gore cozer (`/swagger-ui.css`) ve varliklar
  // yuklenmez. Bu redirect sayesinde kullanicinin trailing slash farkini
  // hic bilmesine gerek kalmiyor -- `/api-docs` da `/api-docs/` de calisir.
  //
  // ONEMLI: Express'in varsayilan (non-strict) yonlendirmesinde
  // `router.get('/api-docs', ...)` HEM `/api-docs` HEM DE `/api-docs/`
  // ile eslesir -- bu yuzden `req.path`'e gore ACIKCA ayirt edilir,
  // aksi halde `/api-docs/` kendi kendine sonsuz redirect donguye girer.
  router.get('/api-docs', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.endsWith('/')) {
      next();
      return;
    }
    res.redirect('/api-docs/');
  });

  // ERP ile AYNI mount sirasi: once ozel gruplama betigi (`docs/`
  // altindaki statik dosya), sonra swagger-ui-express'in kendi
  // varliklari/HTML'i. `express.static`'te eslesmezse (ör.
  // `/api-docs/swagger-ui.css`) otomatik olarak bir sonrakine
  // (`swaggerUi.serve`) duser.
  router.use(
    '/api-docs',
    express.static(DOCS_DIR, { index: false }),
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'IQV Dictionary API Docs',
      // Native Swagger operasyon/renk semasini DEGISTIRMEZ -- sadece
      // sayfaya TOTAL/INTERNAL/EXTERNAL/SYSTEM + domain gruplama katmani
      // ekler (bkz. docs/iqv-swagger-groups.js, ERP'deki AYNI dosyadan
      // uyarlanmistir). Siniflandirma JS icinde path'e gore HARDCODE
      // EDILMEZ; spec'teki `x-iqv-classification` / `x-iqv-domain`
      // alanlarindan (bu dosyadaki applyIqvTaxonomy() araciligiyla)
      // uretilen kompozit tag adlarindan okunur.
      customJs: '/api-docs/iqv-swagger-groups.js',
      swaggerOptions: {
        // ERP ile AYNI: acilista TUM (kompozit) tag bolumleri KAPALI
        // gelir; kok gruplama betigi bu bolumleri kendi 4 acilir
        // basligi ALTINA toplar ve varsayilan olarak onlari da kapali
        // tutar.
        docExpansion: 'none',
        persistAuthorization: true,
        displayRequestDuration: true,
        // Swagger UI'nin harici validator.swagger.io gorsel istegi CSP
        // ile CAKISABILIR (ERP'deki AYNI gerekce) -- rozet/istek
        // tamamen devre disi birakilir.
        validatorUrl: null,
      },
    }),
  );

  return router;
};
