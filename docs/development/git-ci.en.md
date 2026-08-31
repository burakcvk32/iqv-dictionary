# Git & CI/CD

## Purpose

This page documents the real, working CI pipeline set up during the
Dictionary project's Git/CI preparation (2026-08-30). Every step
described here is genuinely defined in the workflow files — nothing
here is invented or "planned".

## CI Platform

The project uses **GitHub Actions** (the `origin` remote is on GitHub;
`.github/workflows/` and `.github/dependabot.yml` already existed).
Application code (backend/dashboard/Docker/k6/scripts) and
documentation (MkDocs) builds live in **two separate workflow files**
so they show up as two independent workflows on the Actions screen and
don't needlessly trigger each other:

| Workflow file | Name on the Actions screen | Scope |
|---|---|---|
| `.github/workflows/ci.yml` | **IQV Dictionary CI** | backend, dashboard, Docker validation, k6, script lint, Quality Pipeline |
| `.github/workflows/docs.yml` | **IQV Dictionary Docs** | only `mkdocs build --strict` + the site artifact |

MkDocs steps are never moved into `ci.yml` — the rest of this page
documents `ci.yml` only; see "Docs Workflow" below for `docs.yml`.

## Branch Strategy

- **Main branch:** `main` (the repo has a single branch, tracking `origin/main`).
- CI runs on `pull_request`s targeting `main` and on direct `push`es to `main`.
- Load/stress (k6 load/stress) tests do NOT run on every push — only via
  manual `workflow_dispatch` (with the `run_k6_load_test: true` input).

## Local pre-commit checks (recommended)

Commands recommended to run locally before a commit (the same checks CI runs):

```bash
# dashboard/ (pnpm)
pnpm run typecheck && pnpm run lint && pnpm run prettier && pnpm test

# backend/ (npm)
npm run typecheck && npm run lint && npm run prettier && npm test
```

## CI Pipeline Stages (real jobs defined in `ci.yml`)

| Job | What it does | When it runs |
|---|---|---|
| `frontend` | `dashboard/`: `pnpm install --frozen-lockfile` → typecheck → lint → prettier → test → coverage → build | every push/PR |
| `backend` | `backend/`: `npm ci` → typecheck → lint → prettier → test → coverage → build → `/health` smoke test | every push/PR |
| `k6-smoke` | After `backend`, short k6 smoke scripts against the in-memory test server | every push/PR |
| `docker-build` | After `frontend`+`backend`: local `docker build` (no registry push) for two dev Dockerfiles (`backend/Dockerfile`, `dashboard/Dockerfile`) and two production Dockerfiles (`backend/Dockerfile.prod`, `dashboard/Dockerfile.prod`), plus `docker compose config` validation for both `docker-compose.yml` and `docker-compose.prod.yml` (CI-only, with a placeholder `backend/.env` — see [Troubleshooting](../troubleshooting.md)) | every push/PR |
| `scripts-lint` | `bash -n` for `scripts/linux/*.sh`, real PowerShell parser validation for `scripts/windows/*.ps1`/`*.psm1` (`[System.Management.Automation.Language.Parser]::ParseFile`, `pwsh` ships pre-installed on GitHub-hosted runners) | every push/PR |
| `k6-load-stress` | Long, high-VU k6 load/stress tests | manual `workflow_dispatch` only |
| `quality-pipeline` | Collects the real results of the jobs above into a 100-point quality report (`REPORT.md`/`REPORT.json`/`QUALITY.svg`) and enforces the strict gate — see "Quality Pipeline" below | every push/PR, `if: always()` |

The order runs cheap checks (install/typecheck/lint/test) first and
expensive ones (build/Docker/k6) last (fail-fast). The MkDocs build is
NOT here — it lives in the separate `docs.yml` workflow (see below).

## Docs Workflow (`docs.yml` — "IQV Dictionary Docs")

`.github/workflows/docs.yml` shows up on the Actions screen as a
**separate, independent workflow** (named exactly `IQV Dictionary
Docs`). Its content: set up Python → `pip install -r
requirements-docs.txt` → `mkdocs build --strict` → upload the built
`site/` as the `iqv-dictionary-docs-site` artifact. It never deploys
anywhere (GitHub Pages included) — it only verifies the documentation
isn't broken.

Triggers: `push`/`pull_request` (only when `docs/**`, `mkdocs.yml`, or
`requirements-docs.txt` change — so it doesn't run needlessly on
backend/dashboard code changes) AND `workflow_dispatch` (can always be
triggered manually, regardless of paths — this also keeps the workflow
visible/discoverable on the Actions screen instead of getting stuck
never running because of the `paths` filter).

## Quality Pipeline

The `quality-pipeline` job collects `needs.*.result` from every required
job above and produces a 100-point report via
`scripts/ci/generate-quality-report.mjs` (Backend 30, Dashboard 30,
Docker 15, k6 Smoke 15, Scripts 10). **The score is reporting-only** —
whenever a required stage genuinely fails/is cancelled/unexpectedly
skipped, the result is ALWAYS `FAILED` (a strict gate that the score
cannot soften). The report is generated with `if: always()`, so it's
produced even when an earlier stage failed, and uploaded as the
`iqv-dictionary-quality-report` artifact.

## Node.js Version

CI uses `Node 20.x` (`actions/setup-node@v4`) — exactly matching what
both `Dockerfile`s already use (`FROM node:20-alpine`).

## Package Manager

**The two sub-projects intentionally use two different package
managers — they must not be mixed:**

- **`dashboard/` → pnpm.** Source of truth: `dashboard/pnpm-lock.yaml`.
  CI uses `pnpm/action-setup@v4` + `pnpm install --frozen-lockfile`.
- **`backend/` → npm.** Source of truth: `backend/package-lock.json`.
  CI uses `npm ci`.

## Test Database

CI **never connects to a real/production MongoDB**. The backend's own
test suite already uses in-memory fake repositories under
`src/tests/support/*` (which stand in for MongoDB) — CI reuses this
existing pattern; no new test-database infrastructure (e.g. a MongoDB
service container) was added.

## Docker

The `docker-build` job runs four real `docker build`s: `backend/Dockerfile`
+ `dashboard/Dockerfile` (development — hot reload, `npm run dev`/`pnpm
run dev`) and `backend/Dockerfile.prod` + `dashboard/Dockerfile.prod`
(production — compiled `dist`, `node dist/server.js` / nginx). Both
`docker-compose.yml` and `docker-compose.prod.yml` are validated with
`docker compose config`. No image is ever pushed to a registry or
deployed anywhere.

## Environment Variables

CI sets `NODE_ENV=test` for tests. No real production secret is ever
needed in CI (the in-memory repositories work without any `.env` file).
