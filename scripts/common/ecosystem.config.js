// ============================================================
// IQV Dictionary — PM2 process definitions for NATIVE (Docker-less)
// installs. Used identically by scripts/windows/install.ps1 and
// scripts/linux/install.sh — same business logic on both platforms (see
// repo root README.md "Native Installation").
//
// Backend: runs the compiled production build (backend/dist/server.js,
// produced by `npm run build`) with plain `node` — never `npm run dev` /
// tsx watch. Loads backend/.env itself via `dotenv/config` (see
// backend/src/config/env.ts), so no env values are duplicated here.
//
// Frontend: serves the production build (dashboard/dist, produced by
// `pnpm run build`) via the dependency-free static file server in
// static-server.mjs (SPA fallback) — mirrors what the Docker production
// image does with nginx (dashboard/nginx.conf), without requiring nginx
// to be installed natively.
// ============================================================
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

module.exports = {
  apps: [
    {
      name: 'iqv-dictionary-backend',
      cwd: path.join(ROOT, 'backend'),
      script: 'dist/server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
    },
    {
      name: 'iqv-dictionary-frontend',
      cwd: path.join(ROOT, 'dashboard'),
      script: path.join(ROOT, 'scripts', 'common', 'static-server.mjs'),
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        STATIC_DIR: path.join(ROOT, 'dashboard', 'dist'),
        STATIC_PORT: process.env.IQV_FRONTEND_PORT || '5173',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
    },
  ],
};
