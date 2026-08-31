# Installation / Update / Uninstall

This page documents what the install/update/uninstall scripts under
`scripts/windows/` and `scripts/linux/` ACTUALLY do — the same commands
as the "Quick Start" section of the repository root `README.md`,
explained here in more detail.

## Supported matrix

| Platform | Docker | Native (no Docker) |
|---|---|---|
| Windows | ✅ `install.ps1 -Mode docker` | ✅ `install.ps1 -Mode native` |
| Linux | ✅ `install.sh --mode docker` | ✅ `install.sh --mode native` |

If `-Mode`/`--mode` is omitted (`auto`), the script checks whether
Docker is actually usable (`docker info` + `docker compose version`)
and picks a mode accordingly, always logging its decision
(`[INFO] Installation mode: docker|native`).

## What Docker mode installs

- `docker-compose.prod.yml` (repo root) — the **existing**
  `docker-compose.yml` (hot-reload dev environment, bind-mounted source
  + `npm run dev`/`pnpm run dev`) is UNCHANGED and still works via
  `docker compose up -d`. `docker-compose.prod.yml` is a separate Compose
  project (`iqv-dictionary-prod`) that uses fully production images:
  `backend/Dockerfile.prod` (multi-stage: `npm ci` + `npm run build` →
  `node dist/server.js`, **never `npm run dev`**) and
  `dashboard/Dockerfile.prod` (multi-stage: `pnpm install` + `pnpm run
  build` → static files served by `nginx`, `dashboard/nginx.conf`,
  **never the Vite dev server**).
- MongoDB is NOT containerized — same as `docker-compose.yml`, the app
  connects to a MongoDB that already runs externally (host/another
  server) via `host.docker.internal`.
- Ports and the frontend's build-time API address are read from the
  repo root `.env` (auto-created from `.env.example` if missing):
  `IQV_BACKEND_PORT` (default `3001`), `IQV_FRONTEND_PORT` (default
  `8080`), `VITE_API_BASE_URL`.

## What native mode installs

- Backend: `npm ci` + `npm run build` (compiled `backend/dist/server.js`).
- Dashboard: `corepack` enables `pnpm@9.15.9`, then `pnpm install
  --frozen-lockfile` + `pnpm run build` (static `dashboard/dist`).
- Process management: **PM2** on both platforms
  (`scripts/common/ecosystem.config.js`) — identical logic on
  Windows/Linux:
  - Backend: `node dist/server.js` (under PM2, `autorestart`).
  - Frontend: a dependency-free, project-specific static file server
    (`scripts/common/static-server.mjs`) that serves `dashboard/dist` —
    the native counterpart of the Docker image's nginx; no separate
    nginx install needed on Windows.
- Start-on-boot:
  - **Windows:** `pm2-windows-startup` (`pm2-startup install`) — needs
    no admin rights, restores PM2's saved process list on login.
  - **Linux:** `pm2 startup systemd` — generates a systemd unit; the
    script installs it automatically if passwordless `sudo` is
    available, otherwise it prints the exact command to run (the script
    never blocks waiting for a password).

## Idempotency

Running `install.ps1`/`install.sh` a second time:

- Leaves an existing `backend/.env` / `dashboard/.env` / root `.env`
  UNTOUCHED (`[OK] ... already exists`).
- In Docker mode, `docker compose up -d` only recreates containers when
  actually needed.
- In native mode, `pm2 startOrReload` updates existing processes
  idempotently (never spawns duplicate processes).

## Update flow

1. Detect install mode — from `.iqv-install/state.json` (or, if absent,
   best-effort detection from running containers/PM2 processes).
2. Verify it's a Git repo.
3. **Dirty-tree check — if `git status --porcelain` is non-empty, the
   update is SAFELY ABORTED** (`[ERROR] Local modifications
   detected...`). None of the scripts ever run `git reset --hard` /
   `git clean -fd` / `git checkout .`.
4. `git fetch origin <branch>` + `git pull --ff-only` (fails safely on
   divergence, never overwrites anything).
5. "Current version"/"Target version" are logged from the `VERSION` file.
6. `git diff --name-only <old-sha> <new-sha>` inspects what changed and
   acts accordingly:
   - `backend/package.json`/`package-lock.json` changed → `npm ci`
   - `backend/src|scripts` changed → backend is rebuilt
   - `backend/Dockerfile*` / `docker-compose*.yml` changed → the Docker
     image is rebuilt
   - `dashboard/package.json`/`pnpm-lock.yaml` changed → `pnpm install
     --frozen-lockfile`
   - `dashboard/src|vite.config.ts|...` changed → dashboard is rebuilt
   - migration-like files (`backend/scripts/*migrat*|*rename*`) changed
     → NOT run automatically (data safety) — only a `[WARN]` reminder to
     review them manually.
7. Docker: `docker compose ... up -d` (rebuild only if needed). Native:
   `pm2 startOrReload`/`pm2 restart` + `pm2 save`.
8. Health check (`/health` + frontend root) — if either fails, the
   script exits with an error code.
9. `.iqv-install/state.json` is updated (`updatedAt`, `version`).

## Uninstall / Purge / Purge-Data

| Command | What it does |
|---|---|
| `uninstall.ps1` / `uninstall.sh` | Stops/removes containers or PM2 processes. Source code, `node_modules`, `dist`, `.env` files are left UNTOUCHED. |
| `-Purge` / `--purge` | In addition: removes `node_modules`, `dist`, generated `.env` files, production Docker images, the `.iqv-install/` state directory. |
| `-Purge -RemoveSource` / `--purge --remove-source` | In addition: deletes the **entire repository**. Since the script cannot synchronously delete the directory it's running from, it schedules a separate cleanup script (in `$TEMP`/`/tmp`) that deletes the folder a few seconds later. Requires an extra confirmation (typing `yes` or passing `-Yes`/`--yes`). |
| `-PurgeData` / `--purge-data` | Since MongoDB was never managed by this install (it's external), this **deletes no data** — it only logs that fact explicitly. |

The default (flagless) `uninstall` **never** deletes the production
database — it never creates a DB container/volume in the first place.

## Version mechanism

Single source of truth: the repo root **`VERSION`** file (plain text,
e.g. `1.1.0`). `backend/package.json` (`1.0.0`) and
`dashboard/package.json` (`1.1.0`) are each sub-project's own
independent module version and are UNCHANGED — install/update scripts
only read `VERSION` for "Current version"/"Target version"; no second
version file was invented.

## Install state file

`.iqv-install/state.json` (not tracked by Git — see `.gitignore`):

```json
{
  "mode": "docker",
  "version": "1.1.0",
  "installPath": "/path/to/Dictionary",
  "installedAt": "2026-08-31T06:00:00Z",
  "updatedAt": "2026-08-31T06:00:00Z",
  "services": { "backend": "iqv-dictionary-backend-prod", "frontend": "iqv-dictionary-frontend-prod" },
  "ports": { "backend": 3001, "frontend": 8080 }
}
```

No secret/token/password is ever written to this file.
