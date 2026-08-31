# IQV Dictionary

IQV Dictionary is IQVizyon's dictionary platform for centrally
managing, grouping, authorizing, and exposing industrial terminology
to applications via an API. The project has two sub-projects:
`dashboard/` (React + Ant Design client) and `backend/` (Express +
MongoDB API).

Use the sun/moon icon (top right) to switch between light and dark
mode, and the language selector (globe icon) to switch between Turkish
and English. The search box at the top performs full-text search
across every page.

## Components

| Component | Technology | Location |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Ant Design + Redux Toolkit | `dashboard/` |
| Backend | Node.js + Express + TypeScript (compiled `dist/`) | `backend/` |
| Database | MongoDB (runs externally, never containerized) | `backend/.env` → `MONGODB_URI` |
| API Documentation | Swagger UI + OpenAPI 3.0.3 (backend-native) | `backend/docs/openapi.yaml`, `/api-docs` |
| CI/CD | GitHub Actions — `IQV Dictionary CI`, `IQV Dictionary Docs` | `.github/workflows/` |

## Quick links

- **Installation** — single-command Docker/Native, Windows/Linux setup:
  see the repository root `README.md` ("Installation") and the detailed
  flow in [Installation / Update / Uninstall](deployment/installation.md).
- **API** — a REST endpoint summary lives at [Backend API](backend-api.md);
  for a live, always-in-sync reference use the running backend's
  `/api-docs` (Swagger UI) and `/openapi.json`. See
  [Architecture](architecture.md) for how the services talk to each other.
- **CI/CD** — pipeline stages and the Quality Pipeline are documented at
  [Git & CI/CD](development/git-ci.md); the repository root `README.md`
  ("CI/CD") gives a short summary.
- If something isn't working as expected, check
  [Troubleshooting](troubleshooting.md) first.

## Contents

**Architecture** documents how `backend/` and `dashboard/` are layered,
their modules, and how they talk to each other — see
[Architecture](architecture.md).

**Installation / Deployment** documents the fully automated production
install/update/uninstall system (Windows/Linux, Docker/native) — see
[Installation / Update / Uninstall](deployment/installation.md) and the
"Installation" section of the repository root `README.md`.

**Backend API** summarizes the real REST endpoints and the
authentication model — see [Backend API](backend-api.md) (for a live,
always-in-sync interactive reference, use the running backend's
`/api-docs` Swagger UI).

**Frontend / Dashboard** summarizes the dashboard's module/route/state
structure — see [Frontend / Dashboard](frontend.md).

**Development** documents the pipeline built while preparing the project
for Git/CI:

- [Git & CI/CD](development/git-ci.md) — branch strategy, local pre-commit checks, CI/CD pipeline stages
- [Testing](development/testing.md) — Vitest-based unit/integration/security tests and how to run them
- [Performance Testing](development/performance-testing.md) — k6 smoke/load/stress tests
- [Release Checklist](development/release-checklist.md) — what to verify before tagging a release

**Test Reports** contains the raw results of test/performance/UAT runs
that were actually executed during the project's CI/Git preparation
(see each report's own "NOT EXECUTED" sections — no result was ever
fabricated):

- [Test Report](testing/TEST_REPORT.md)
- [Performance Report](testing/PERFORMANCE_REPORT.md)
- [UAT Report](testing/UAT_REPORT.md)

## Quick start (developer mode — hot reload)

```bash
# Backend (npm)
cd backend
npm ci
npm run dev

# Dashboard (pnpm)
cd dashboard
pnpm install --frozen-lockfile
pnpm run dev
```

See each sub-project's `.env.example` for the full list of environment
variables.

## Production install (single command)

Unlike developer mode, a production install of the whole system
(backend + dashboard, with or without Docker) is a single command:

```powershell
# Windows
.\scripts\windows\install.ps1
```

```bash
# Linux
./scripts/linux/install.sh
```

See [Installation / Update / Uninstall](deployment/installation.md) and
the repository root `README.md` for details.
