#!/usr/bin/env node
// ============================================================
// IQV Dictionary — kok dizinden TEK komutla local (Docker'siz) hot-reload
// gelistirme ortamini ayaga kaldirir: backend (`tsx watch`, port 3001) +
// frontend (Vite dev server, port 5173) ayni anda.
//
// KOK NEDEN (bu script neden eklendi): Onceden repo kokunde backend +
// frontend'i BIRLIKTE baslatan bir dev script YOKTU -- yalnizca
// `dashboard> npm run dev` / `backend> npm run dev` AYRI AYRI, veya
// production-amacli Docker/PM2 akislari (scripts/common/ecosystem.config.js,
// docker-compose*.yml) vardi. Kullanici sadece frontend'i baslatinca
// (`dashboard> npm run dev`) backend hic calismiyor ve Vite'in proxy'si
// (dashboard/vite.config.ts) TUM `/api*`, `/api-docs`, `/openapi.json`,
// `/health` isteklerinde ECONNREFUSED aliyordu -- bu HATA SWAGGER'A OZEL
// DEGILDI, backend'in hic calismiyor olmasindan kaynaklaniyordu.
//
// Bu script YENI bir npm bagimliligi EKLEMEZ (ornegin `concurrently`) --
// sadece Node'un kendi `child_process` modulunu kullanir. Backend ve
// frontend'in KENDI mevcut `npm run dev` script'lerini (backend/package.json,
// dashboard/package.json) DEGISTIRMEDEN, oldugu gibi cagirir.
//
// Kullanim: repo kokunden `npm run dev` (bkz. root package.json).
// Durdurmak icin: Ctrl+C -- her iki alt process de temiz kapatilir.
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const PROCESSES = [
  { name: 'backend', cwd: path.join(ROOT, 'backend'), color: '\x1b[36m' },
  { name: 'frontend', cwd: path.join(ROOT, 'dashboard'), color: '\x1b[35m' },
];
const RESET = '\x1b[0m';

const children = [];
let shuttingDown = false;

const prefixLines = (name, color, data) => {
  const text = data.toString();
  const lines = text.split(/\r?\n/);
  // Son eleman, satir sonu ile bitmiyorsa bos string olur -- yazdirma.
  lines.forEach((line, index) => {
    if (line === '' && index === lines.length - 1) {
      return;
    }
    process.stdout.write(`${color}[${name}]${RESET} ${line}\n`);
  });
};

const shutdown = (code) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  children.forEach((child) => {
    if (!child.killed) {
      // Windows'ta `shell: true` ile baslatilan npm process'leri icin
      // SIGTERM/SIGINT alt process agacinin tamamini kapatmayabilir --
      // yine de once nazik bir SIGINT/SIGTERM denenir.
      child.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
    }
  });
  process.exit(code ?? 0);
};

PROCESSES.forEach(({ name, cwd, color }) => {
  // `shell: true`: Windows'ta `npm` komutu dogrudan `spawn('npm', ...)` ile
  // (PATHEXT/npm.cmd cozumlemesi nedeniyle) guvenilir calismayabilir --
  // `shell: true` bunu isletim sistemi kabugu (cmd.exe / bash) uzerinden
  // cozer, macOS/Linux'ta da ayni sekilde calisir.
  const child = spawn('npm', ['run', 'dev'], {
    cwd,
    shell: true,
    env: process.env,
  });
  children.push(child);

  child.stdout.on('data', (data) => prefixLines(name, color, data));
  child.stderr.on('data', (data) => prefixLines(name, color, data));

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    process.stdout.write(
      `${color}[${name}]${RESET} process sonlandi (code=${code}, signal=${signal}) -- diger process de kapatiliyor.\n`,
    );
    shutdown(code ?? 1);
  });

  child.on('error', (err) => {
    process.stdout.write(
      `${color}[${name}]${RESET} baslatilamadi: ${err.message}\n`,
    );
    shutdown(1);
  });
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
