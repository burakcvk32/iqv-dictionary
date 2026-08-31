#!/usr/bin/env node
// ============================================================
// IQV Dictionary — dependency-free static file server.
//
// Serves the dashboard's production build (dashboard/dist, produced by
// `pnpm run build`) with an SPA fallback (unknown paths -> index.html,
// so React Router keeps working) and basic caching headers for hashed
// assets — mirroring what dashboard/nginx.conf does for the Docker
// production image, without requiring nginx to be installed natively on
// Windows/Linux. Used by scripts/common/ecosystem.config.js (PM2) in
// native installs — see repo root README.md "Native Installation".
//
// This process is never used as a substitute for `pnpm run dev` (the
// Vite dev server) — it only ever serves an already-built dist/.
//
// Env vars:
//   STATIC_DIR  - absolute path to the directory to serve (default: <repo>/dashboard/dist)
//   STATIC_PORT - port to listen on (default 5173)
//   STATIC_HOST - host to bind (default 0.0.0.0)
// ============================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = process.env.STATIC_DIR
  ? path.resolve(process.env.STATIC_DIR)
  : path.resolve(__dirname, '..', '..', 'dashboard', 'dist');
const PORT = Number(process.env.STATIC_PORT ?? 5173);
const HOST = process.env.STATIC_HOST ?? '0.0.0.0';

if (!fs.existsSync(STATIC_DIR)) {
  console.error(`[static-server] STATIC_DIR not found: ${STATIC_DIR}`);
  console.error(
    '[static-server] Did you run the dashboard production build (pnpm run build)?',
  );
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const HASHED_ASSET = /\.[a-zA-Z0-9_-]{6,}\.(js|css|woff2?|ttf)$/;

const send = (res, status, filePath, extraHeaders = {}) => {
  const ext = path.extname(filePath).toLowerCase();
  const body = fs.readFileSync(filePath);
  res.writeHead(status, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': body.length,
    ...extraHeaders,
  });
  res.end(body);
};

const server = http.createServer((req, res) => {
  try {
    if (req.url === '/health' || req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    const reqUrl = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? 'localhost'}`,
    );
    const relPath = decodeURIComponent(reqUrl.pathname);

    // Path traversal guard (separator-bounded, not a bare string-prefix
    // check — a sibling directory like "STATIC_DIR-evil" must not pass).
    const resolved = path.normalize(path.join(STATIC_DIR, relPath));
    if (resolved !== STATIC_DIR && !resolved.startsWith(STATIC_DIR + path.sep)) {
      res.writeHead(400).end('Bad request');
      return;
    }

    let filePath = resolved;
    if (
      relPath === '/' ||
      !fs.existsSync(filePath) ||
      fs.statSync(filePath).isDirectory()
    ) {
      filePath = path.join(STATIC_DIR, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404).end('Not found');
      return;
    }

    const cacheHeaders = HASHED_ASSET.test(filePath)
      ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
      : { 'Cache-Control': 'no-cache' };

    send(res, 200, filePath, cacheHeaders);
  } catch (error) {
    console.error('[static-server] request failed:', error);
    if (!res.headersSent) {
      res.writeHead(500).end('Internal server error');
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[static-server] IQV Dictionary frontend serving ${STATIC_DIR}`);
  console.log(`[static-server] listening on http://${HOST}:${PORT}`);
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
