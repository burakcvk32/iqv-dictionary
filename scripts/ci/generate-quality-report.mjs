#!/usr/bin/env node
/**
 * IQV Dictionary -- CI Quality Report generator.
 *
 * KOK NEDEN: "IQV Dictionary CI" workflow'undaki (.github/workflows/ci.yml)
 * "Quality Pipeline" job'u bu script'i cagirir. Butun agir mantik (skor
 * hesaplama, REPORT.md/REPORT.json/QUALITY.svg uretimi, GitHub Step
 * Summary icerigi) BURADA yasar -- workflow yalnizca `needs.*.result`
 * degerlerini ve gercek GitHub context degerlerini (sha/ref/run id/...)
 * env degiskeni olarak bu script'e AKTARIR (orchestration). Boylece
 * workflow dosyasi inline bash/YAML mantik yigini haline gelmez ve script
 * `node scripts/ci/generate-quality-report.mjs` ile YEREL (lokal) olarak
 * da (ornek PASS/FAIL env degiskenleriyle) test edilebilir.
 *
 * SOZLESME (workflow tarafinda saglanmasi beklenen ortam degiskenleri):
 *   QR_BACKEND_RESULT         needs.backend.result
 *   QR_FRONTEND_RESULT        needs.frontend.result
 *   QR_DOCKER_RESULT          needs.docker-build.result
 *   QR_K6_SMOKE_RESULT        needs.k6-smoke.result
 *   QR_SCRIPTS_LINT_RESULT    needs.scripts-lint.result
 *   QR_K6_LOAD_STRESS_RESULT  needs.k6-load-stress.result (informational)
 *   QR_EVENT_NAME             github.event_name
 *   QR_SHA                    github.sha
 *   QR_REF_NAME               github.ref_name
 *   QR_RUN_ID                 github.run_id
 *   QR_SERVER_URL             github.server_url
 *   QR_REPOSITORY             github.repository
 *   QR_NODE_VERSION           env.NODE_VERSION (opsiyonel, bilgi amacli)
 *   QR_OUTPUT_DIR             cikti klasoru (varsayilan: quality-report)
 *   GITHUB_STEP_SUMMARY       (GitHub'in kendi native degiskeni, varsa
 *                              kullanilir; yoksa sessizce atlanir --
 *                              yerel calistirmada hata VERMEZ)
 *
 * ONEMLI: Bu script her sartta (basarili/basarisiz skor farketmeksizin)
 * exitCode 0 ile biter -- boylece workflow'daki "Upload artifact" adimi
 * hicbir zaman atlanmaz. Strict gate (job'u GERCEKTEN FAIL etme kararı)
 * workflow'daki AYRI, SONRAKI bir adimda (GATE_RESULT.txt okunarak)
 * uygulanir. Bu siralama kullanicinin acik talebidir: "CI sonuclarini
 * topla -> REPORT uret -> artifact upload et -> gerekirse EN SON strict
 * gate nedeniyle job'u FAIL yap".
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const OUTPUT_DIR = process.env.QR_OUTPUT_DIR || 'quality-report';
const OUTPUT_PATH = path.resolve(REPO_ROOT, OUTPUT_DIR);

// ------------------------------------------------------------------
// 1) Girdi toplama -- SAHTE deger UYDURULMAZ. Bir env degiskeni yoksa
//    'unknown' olarak isaretlenir ve bu, o asamanin puan ALAMAMASINA
//    (blocking) yol acar -- "belki basarilidir" varsayimi YAPILMAZ.
// ------------------------------------------------------------------
const env = (name, fallback) => {
  const value = process.env[name];
  return value === undefined || value === '' ? (fallback === undefined ? 'unknown' : fallback) : value;
};

const PROJECT = 'IQV Dictionary';

const resolveVersion = () => {
  const versionFile = path.resolve(REPO_ROOT, 'VERSION');
  if (existsSync(versionFile)) {
    const raw = readFileSync(versionFile, 'utf8').trim();
    if (raw) return raw;
  }
  return 'unknown';
};

const EVENT_NAME = env('QR_EVENT_NAME');
const SHA = env('QR_SHA');
const SHORT_SHA = SHA !== 'unknown' ? SHA.slice(0, 7) : 'unknown';
const REF_NAME = env('QR_REF_NAME');
const RUN_ID = env('QR_RUN_ID');
const SERVER_URL = env('QR_SERVER_URL', 'https://github.com');
const REPOSITORY = env('QR_REPOSITORY');
const NODE_VERSION = env('QR_NODE_VERSION');
const RUN_URL =
  RUN_ID !== 'unknown' && REPOSITORY !== 'unknown'
    ? SERVER_URL + '/' + REPOSITORY + '/actions/runs/' + RUN_ID
    : 'unknown';
const GENERATED_AT = new Date().toISOString();
const VERSION = resolveVersion();

// ------------------------------------------------------------------
// 2) Asama tanimlari -- GERCEKTEN ci.yml'de var olan job ID'lerine
//    baglanir (bkz. .github/workflows/ci.yml): frontend, backend,
//    docker-build, k6-smoke, scripts-lint. Dictionary projesinde
//    OLMAYAN bir asama (ornegin Playwright/E2E, Security Precheck,
//    Workflow Lint) BURAYA UYDURULMAZ.
// ------------------------------------------------------------------
const STAGES = [
  { id: 'backend', label: 'Backend', weight: 30, result: env('QR_BACKEND_RESULT') },
  { id: 'frontend', label: 'Dashboard', weight: 30, result: env('QR_FRONTEND_RESULT') },
  { id: 'docker', label: 'Docker Build', weight: 15, result: env('QR_DOCKER_RESULT') },
  { id: 'k6smoke', label: 'k6 Smoke', weight: 15, result: env('QR_K6_SMOKE_RESULT') },
  {
    id: 'scriptsLint',
    label: 'Install/Update/Uninstall Scripts',
    weight: 10,
    result: env('QR_SCRIPTS_LINT_RESULT'),
  },
];

// k6 Load/Stress (manual) -- Dictionary CI'da yalnizca `workflow_dispatch`
// + run_k6_load_test=true ile calisir. Normal push/PR'da skipped
// gorunmesi BEKLENEN/DOGRU davranistir -- bu yuzden puanlamaya DAHIL
// EDILMEZ, skoru DUSURMEZ, strict gate'i KIRMAZ, warning URETMEZ.
// Yalnizca informational olarak raporlanir.
const K6_LOAD_STRESS_RESULT = env('QR_K6_LOAD_STRESS_RESULT');
const isManualDispatch = EVENT_NAME === 'workflow_dispatch';
const k6LoadStressExpectedSkip = K6_LOAD_STRESS_RESULT === 'skipped';

const findingFor = (result) => {
  switch (result) {
    case 'success':
      return 'başarılı';
    case 'failure':
      return 'başarısız';
    case 'cancelled':
      return 'iptal edildi';
    case 'skipped':
      return 'beklenmeyen skip (bir bağımlılık başarısız/atlanmış olabilir)';
    default:
      return 'bilinmeyen durum (' + result + ')';
  }
};

const scoredStages = STAGES.map((stage) => {
  const passed = stage.result === 'success';
  return Object.assign({}, stage, {
    passed,
    points: passed ? stage.weight : 0,
    finding: findingFor(stage.result),
  });
});

const totalWeight = STAGES.reduce((sum, s) => sum + s.weight, 0);
const score = scoredStages.reduce((sum, s) => sum + s.points, 0);
const blockingErrors = scoredStages.filter((s) => !s.passed).length;

// Bu projede ayri bir Security Precheck / Workflow Lint asamasi (Flex'te
// oldugu gibi puansiz fakat bloklayici on-kontrol) GERCEKTEN
// BULUNMUYOR (bkz. ci.yml job listesi) -- bu yuzden Critical/Warning
// sayaclari yapisal olarak 0'dir; UYDURULMUS bir deger DEGILDIR, bu
// projenin CI'sinda o kategoriye giren bir kontrol olmadigini yansitir.
const critical = 0;
const warnings = 0;
const environmentSkipped = k6LoadStressExpectedSkip ? 1 : 0;

const scoreLabel = (value) => {
  if (value >= 90) return 'Çok İyi';
  if (value >= 80) return 'İyi';
  if (value >= 70) return 'Kabul Edilebilir';
  if (value >= 60) return 'İyileştirme Gerekli';
  return 'Kritik';
};

// STRICT GATE (Soft Gate KAPALI): skor yuksek olsa bile herhangi bir
// ZORUNLU/puanlanan asama basarisiz/iptal/beklenmedik-skip ise sonuc
// FAILED'dir. k6 Load/Stress (manual) bu hesaba HIC KATILMAZ.
const overallResult = blockingErrors === 0 ? 'PASSED' : 'FAILED';
const label = scoreLabel(score);

// ------------------------------------------------------------------
// 3) Test sayilari -- job-level needs.*.result'tan GUVENILIR sekilde
//    pass/fail/skip SAYISI cikarilamaz (bu bilgi yalnizca Backend/
//    Dashboard job'larinin kendi vitest ciktilarinda vardir, bu script
//    o loglari PARSE ETMEZ). Uydurma deger yerine acikca N/A.
// ------------------------------------------------------------------
const testCounts = {
  passed: null,
  failed: null,
  skipped: null,
  total: null,
  note: 'N/A - job seviyesi sonucundan güvenilir şekilde çıkarılamıyor',
};

// ------------------------------------------------------------------
// 4) Cikti klasoru
// ------------------------------------------------------------------
mkdirSync(OUTPUT_PATH, { recursive: true });

// ------------------------------------------------------------------
// 5) Yardimci: markdown tablo satirlari (backtick problemi olmasin diye
//    template literal yerine dizi + join kullanilir)
// ------------------------------------------------------------------
const BACKTICK = String.fromCharCode(96);
const code = (s) => BACKTICK + s + BACKTICK;
const fence = BACKTICK + BACKTICK + BACKTICK;

const stageTableRows = scoredStages
  .map((s) => {
    const sonuc = s.passed ? 'PASS' : s.result.toUpperCase();
    return '| ' + s.label + ' | ' + sonuc + ' | Evet (' + s.weight + ' puan) | ' + s.finding + ' |';
  })
  .join('\n');

const scoringTableRows = scoredStages
  .map((s) => '| ' + s.label + ' | ' + s.weight + ' | ' + s.points + ' |')
  .join('\n');

const k6LoadStressStatusLabel = (() => {
  if (K6_LOAD_STRESS_RESULT === 'skipped') {
    return isManualDispatch
      ? 'SKIPPED (manuel çalıştırmada run_k6_load_test=false seçilmiş)'
      : 'SKIPPED (beklenen davranış — yalnızca workflow_dispatch ile elle tetiklenir)';
  }
  return K6_LOAD_STRESS_RESULT.toUpperCase();
})();

const findingsLines = [];
if (blockingErrors === 0) {
  findingsLines.push('- Tüm zorunlu (puanlanan) CI aşamaları başarıyla tamamlandı; bloklayıcı bulgu yok.');
} else {
  for (const s of scoredStages) {
    if (!s.passed) {
      findingsLines.push(
        '- **' + s.label + '**: ' + s.finding + ' — bu çalışmada ' + s.weight + " puanın 0'ı alındı (bloklayıcı).",
      );
    }
  }
}
findingsLines.push(
  '- Bu projede ayrı bir Security Precheck / Workflow Lint aşaması bulunmuyor (bkz. ' +
    code('.github/workflows/ci.yml') +
    '); bu yüzden Critical/Warning sayaçları yapısal olarak 0’dır — ileride böyle bir aşama eklenirse bu script’e puansız-fakat-bloklayıcı bir kategori olarak eklenebilir.',
);
findingsLines.push(
  '- **k6 Load/Stress (Manual)**: ' +
    k6LoadStressStatusLabel +
    ' — bu aşama puanlamaya DAHİL DEĞİLDİR, skoru düşürmez, strict gate’i kırmaz, warning üretmez.',
);

const summaryParagraph =
  overallResult === 'PASSED'
    ? 'Bu çalıştırmada tüm zorunlu CI aşamaları (Backend, Dashboard, Docker Build, k6 Smoke, Install/Update/Uninstall Scripts) başarıyla tamamlandı. Kalite skoru **' +
      score +
      '/100** ve sonuç **PASSED**.'
    : 'Bu çalıştırmada ' +
      blockingErrors +
      ' zorunlu CI aşaması başarısız/iptal/beklenmedik biçimde atlanmış durumda. Skor yüksek olsa bile strict gate kuralı gereği sonuç **FAILED**’dir — gerçek başarısızlık puanla gizlenmez.';

const conclusionParagraph =
  overallResult === 'PASSED'
    ? 'Tüm zorunlu kalite kapıları geçildi. Bu çalıştırma yayına/merge’e uygun kabul edilir (proje kendi PR/branch koruma kurallarına tabidir).'
    : 'Bir veya daha fazla zorunlu kalite kapısı geçilemedi. Bu çalıştırma FAILED olarak işaretlenmiştir; ilgili job loglarına bakılıp asıl hata giderilmeden tekrar denenmelidir.';

const testCountsJson = JSON.stringify(testCounts, null, 2);

const reportMdLines = [
  '# IQV Dictionary Quality Result',
  '',
  '## 1. Yönetici Özeti',
  '',
  summaryParagraph,
  '',
  '## 2. Genel Kalite Puanı',
  '',
  '- Proje: ' + PROJECT,
  '- Versiyon: ' + VERSION,
  '- Sonuç: **' + overallResult + '**',
  '- Skor: **' + score + '/' + totalWeight + '**',
  '- Sınıf: **' + label + '**',
  '- Critical: ' + critical,
  '- Blocking Error: ' + blockingErrors,
  '- Warning: ' + warnings,
  '- Environment Skipped: ' + environmentSkipped,
  '',
  '## 3. Aşama Sonuçları',
  '',
  '| Aşama | Sonuç | Puanlanıyor | Bulgu |',
  '|---|---|---|---|',
  stageTableRows,
  '',
  '### Informational (Puanlamaya Dahil Değil)',
  '',
  '| Aşama | Sonuç | Not |',
  '|---|---|---|',
  '| k6 Load/Stress (Manual) | ' + K6_LOAD_STRESS_RESULT.toUpperCase() + ' | ' + k6LoadStressStatusLabel + ' |',
  '',
  '## 4. Test Özeti',
  '',
  "Backend ve Dashboard job'larının kendi " +
    code('test') +
    ' / ' +
    code('test:coverage') +
    ' adımlarında (Vitest) gerçek birim/entegrasyon testleri çalışır; bu Quality Pipeline job’u yalnızca o job’ların **job-seviyesi** (' +
    code('needs.*.result') +
    ') sonucunu okur, log parse etmez. Bu yüzden geçen/kalan/atlanan test SAYISI burada güvenilir şekilde üretilemez:',
  '',
  fence + 'json',
  testCountsJson,
  fence,
  '',
  'Ayrıntılı test çıktısı için ilgili job’un ("Backend" / "Frontend (dashboard)") kendi log’larına ve ' +
    code('backend-coverage') +
    ' / ' +
    code('dashboard-coverage') +
    ' artifact’lerine bakın.',
  '',
  '## 5. Quality Gate',
  '',
  '- Strict Gate Mode: **AÇIK**',
  '- Soft Gate: **KAPALI**',
  '- Kural: Skor 100 olsa bile puanlanan aşamalardan herhangi biri ' +
    code('success') +
    ' DEĞİLSE (failure / cancelled / beklenmedik skipped) genel sonuç **FAILED**’dir. Skor yalnızca RAPORLAMA amaçlıdır, gate kararını TEK BAŞINA belirlemez.',
  '- Bu çalıştırmada blocking error sayısı: **' + blockingErrors + '** → Sonuç: **' + overallResult + '**',
  '',
  '## 6. Bulgular',
  '',
  findingsLines.join('\n'),
  '',
  '## 7. Environment / CI Bilgileri',
  '',
  '- Proje: ' + PROJECT,
  '- Branch: ' + REF_NAME,
  '- Commit: ' + SHORT_SHA + ' (' + SHA + ')',
  '- Tetikleyen olay (event): ' + EVENT_NAME,
  '- CI Run: ' + RUN_URL,
  '- Run ID: ' + RUN_ID,
  '- Node sürümü (CI): ' + NODE_VERSION,
  '- Üretim zamanı (UTC): ' + GENERATED_AT,
  '',
  '## 8. Sonuç',
  '',
  conclusionParagraph,
  '',
  '## 9. Puanlama (100 üzerinden)',
  '',
  '| Aşama | Ağırlık | Alınan |',
  '|---|---:|---:|',
  scoringTableRows,
  '| **TOPLAM** | **' + totalWeight + '** | **' + score + '** |',
  '',
];

const reportMd = reportMdLines.join('\n');
writeFileSync(path.join(OUTPUT_PATH, 'REPORT.md'), reportMd, 'utf8');

// ------------------------------------------------------------------
// 6) REPORT.json (machine-readable)
// ------------------------------------------------------------------
const reportJson = {
  project: PROJECT,
  version: VERSION,
  generatedAt: GENERATED_AT,
  commit: SHA,
  branch: REF_NAME,
  runId: RUN_ID,
  result: overallResult,
  score,
  scoreLabel: label,
  critical,
  blockingErrors,
  warnings,
  environmentSkipped,
  softGate: false,
  strictGate: true,
  stages: scoredStages.map((s) => ({
    id: s.id,
    label: s.label,
    result: s.result,
    passed: s.passed,
    weight: s.weight,
    pointsAwarded: s.points,
    scored: true,
  })),
  informationalStages: [
    {
      id: 'k6LoadStress',
      label: 'k6 Load/Stress (Manual)',
      result: K6_LOAD_STRESS_RESULT,
      scored: false,
      note: 'Yalnızca workflow_dispatch ile elle tetiklenir; normal push/PR üzerinde skipped olması beklenen davranıştır ve skoru/gate sonucunu etkilemez.',
    },
  ],
  runUrl: RUN_URL,
  testCounts,
};

writeFileSync(
  path.join(OUTPUT_PATH, 'REPORT.json'),
  JSON.stringify(reportJson, null, 2) + '\n',
  'utf8',
);

// ------------------------------------------------------------------
// 7) QUALITY.svg -- basit, bagimliliksiz (harici font/kutuphane
//    olmadan) coklu-segment rozet. Renk PASS/FAIL'e gore dinamik.
// ------------------------------------------------------------------
const badgeColor = overallResult === 'PASSED' ? '#2e8b57' : '#c0392b';
const segments = [
  { text: 'IQV Dictionary', color: '#555555' },
  { text: 'CI Quality', color: '#555555' },
  { text: score + '/' + totalWeight, color: badgeColor },
  { text: overallResult, color: badgeColor },
];

const charWidth = 6.6;
const segPaddingX = 10;
const heightPx = 20;
const segWidths = segments.map((s) => Math.round(s.text.length * charWidth + segPaddingX * 2));
const totalW = segWidths.reduce((a, b) => a + b, 0);

let xCursor = 0;
const rects = [];
const texts = [];
segments.forEach((seg, i) => {
  const w = segWidths[i];
  rects.push('<rect x="' + xCursor + '" y="0" width="' + w + '" height="' + heightPx + '" fill="' + seg.color + '"/>');
  const textX = xCursor + w / 2;
  const escaped = seg.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  texts.push(
    '<text x="' +
      textX +
      '" y="14" font-family="Verdana,Geneva,sans-serif" font-size="11" fill="#ffffff" text-anchor="middle">' +
      escaped +
      '</text>',
  );
  xCursor += w;
});

const badgeLabel = PROJECT + ' | CI Quality | ' + score + '/' + totalWeight + ' | ' + overallResult;
const qualitySvgLines = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="' + totalW + '" height="' + heightPx + '" role="img" aria-label="' + badgeLabel + '">',
  '  <title>' + badgeLabel + '</title>',
  '  ' + rects.join('\n  '),
  '  ' + texts.join('\n  '),
  '</svg>',
  '',
];
writeFileSync(path.join(OUTPUT_PATH, 'QUALITY.svg'), qualitySvgLines.join('\n'), 'utf8');

// ------------------------------------------------------------------
// 8) GATE_RESULT.txt -- workflow'daki AYRI, SONRAKI "Enforce strict
//    quality gate" adimi bu dosyayi okuyup job'u FAIL eder. Boylece
//    generate adimi HER ZAMAN exit 0 doner ve "Upload artifact" adimi
//    hicbir zaman atlanmaz (kullanicinin acik siralama talebi).
// ------------------------------------------------------------------
writeFileSync(path.join(OUTPUT_PATH, 'GATE_RESULT.txt'), overallResult + '\n', 'utf8');

// ------------------------------------------------------------------
// 9) GitHub Step Summary -- varsa (gercek CI calistirmasinda GitHub
//    tarafindan enjekte edilir) dogrudan icine yazilir; yerelde (local
//    smoke test) GITHUB_STEP_SUMMARY tanimli DEGILSE sessizce atlanir,
//    hata VERMEZ.
// ------------------------------------------------------------------
const stepSummaryLines = [
  '# IQV Dictionary Quality Result',
  '',
  '| Alan | Değer |',
  '|---|---|',
  '| Project | ' + PROJECT + ' |',
  '| Version | ' + VERSION + ' |',
  '| Result | **' + overallResult + '** |',
  '| Score | **' + score + '/' + totalWeight + '** (' + label + ') |',
  '| Critical | ' + critical + ' |',
  '| Blocking Error | ' + blockingErrors + ' |',
  '| Warning | ' + warnings + ' |',
  '| Environment Skipped | ' + environmentSkipped + ' |',
  '| Branch | ' + REF_NAME + ' |',
  '| Commit | ' + SHORT_SHA + ' |',
  '| CI Run | ' + RUN_URL + ' |',
  '| Generated At (UTC) | ' + GENERATED_AT + ' |',
  '',
  '## Aşama Sonuçları',
  '',
  '| Aşama | Sonuç | Puanlanıyor | Bulgu |',
  '|---|---|---|---|',
  stageTableRows,
  '',
  '_k6 Load/Stress (Manual): ' + K6_LOAD_STRESS_RESULT.toUpperCase() + ' — informational, puanlamaya dahil değil._',
  '',
  '## Puanlama (100 üzerinden)',
  '',
  '| Aşama | Ağırlık | Alınan |',
  '|---|---:|---:|',
  scoringTableRows,
  '| **TOPLAM** | **' + totalWeight + '** | **' + score + '** |',
  '',
  '**Strict Gate Mode: AÇIK**',
  '**Soft Gate: KAPALI**',
  '',
];
const stepSummary = stepSummaryLines.join('\n');

if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, stepSummary + '\n', 'utf8');
  } catch (err) {
    console.error('[generate-quality-report] GITHUB_STEP_SUMMARY yazilamadi (yok sayiliyor):', err.message);
  }
} else {
  console.log('[generate-quality-report] GITHUB_STEP_SUMMARY tanimli degil (yerel calistirma) -- atlaniyor.');
}

// ------------------------------------------------------------------
// 10) Konsol ozeti + HER ZAMAN basarili exit (strict gate SONRAKI,
//     AYRI bir workflow adiminda GATE_RESULT.txt okunarak uygulanir).
// ------------------------------------------------------------------
console.log('[generate-quality-report] Result=' + overallResult + ' Score=' + score + '/' + totalWeight + ' (' + label + ')');
console.log('[generate-quality-report] Blocking errors: ' + blockingErrors);
console.log('[generate-quality-report] Output: ' + OUTPUT_PATH);
process.exitCode = 0;
