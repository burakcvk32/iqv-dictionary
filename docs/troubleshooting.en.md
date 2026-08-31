# Troubleshooting

This page lists issues that were actually encountered during
development/CI, with their proven root cause and fix — it is not a
speculative "possible issues" list.

## Backend won't start: `Missing required environment variable: JWT_SECRET`

`backend/src/config/env.ts` gives `JWT_SECRET` **no fallback** — if it's
missing/empty the app deliberately crashes (a security choice: it never
silently runs with a default/weak secret). Fix: create `backend/.env`
from `backend/.env.example` and set a real `JWT_SECRET` value. **Never**
use the placeholder in `.env.example` (`your-secret-here`) in production.

## `docker compose -f docker-compose.yml config` — `env file ... backend/.env not found`

The `dictionary-backend` service in `docker-compose.yml` uses
`env_file: ./backend/.env` — this file is deliberately not committed to
Git (real secrets are never committed). On first local setup:

```bash
cp backend/.env.example backend/.env
# then edit the values in backend/.env (especially JWT_SECRET)
```

In CI (`.github/workflows/ci.yml`, `docker-build` job) this file is
created automatically on the runner's ephemeral filesystem with
CI-safe placeholder values — it never contains a real secret and is
never committed (see [Git & CI/CD](development/git-ci.md)).

## `npm install` was run instead of `pnpm install` (dashboard)

`dashboard/`'s source of truth is `pnpm-lock.yaml`. Running `npm
install` there can accidentally create a `package-lock.json`, leaving
two lockfiles out of sync. Fix: delete the stray `package-lock.json`
and continue with `pnpm install --frozen-lockfile`. `backend/` is the
opposite — its source of truth is `npm`.

## `esbuild`/`rollup` native binary error ("You installed esbuild for another platform")

If `node_modules` was installed on one platform (e.g. Windows) and then
run directly on a different OS/bridge (e.g. Linux), platform-specific
native binaries (`@esbuild/win32-x64`, etc.) won't match and this error
is thrown. This is not a code defect. Fix: reinstall `node_modules` on
the platform you're actually running on (`rm -rf node_modules && pnpm
install --frozen-lockfile` / `npm ci`) — never copy one platform's
`node_modules` to another.

## Swagger UI (`/api-docs`) shows a blank page over a LAN IP

Root cause: `helmet()`'s default Content-Security-Policy includes an
`upgrade-insecure-requests` directive — when accessed over plain HTTP
from something other than `localhost` (e.g. `http://192.168.x.x:5173`),
the browser tries to upgrade Swagger's own CSS/JS to HTTPS and fails
(`net::ERR_BLOCKED_BY_CLIENT`). Since this project serves plain HTTP in
both dev and production, only that one directive was removed in
`backend/src/app.ts`; the rest of the CSP is unchanged. If you still see
this, make sure the backend is running the current `app.ts`.

## `429 Too Many Requests` — is this a bug?

Usually not. Every endpoint under `/api/*` is limited to 300
requests/60s per IP; `POST /api/v1/auth/login` also has its own 20
requests/5min limit. Running heavy parallel tests/automation (see
[Performance Testing](development/performance-testing.md)) hits these
limits quickly and normally — that's the rate limiter working
**correctly**, not an application bug.

## Can't connect to MongoDB (`ECONNREFUSED` / connection timeout)

The project never containerizes or manages MongoDB — it simply tries to
connect to whatever `MONGODB_URI` in `backend/.env` points to. Checklist:

1. Is MongoDB actually running (try connecting with `mongosh`/`mongo`)?
2. In Docker mode, are you reaching the host's MongoDB via
   `host.docker.internal` (see
   [Installation / Update / Uninstall](deployment/installation.md))?
3. Is the host/port in `MONGODB_URI` correct, and is a firewall
   blocking 27017?

## `mkdocs build --strict` fails

Most common causes: (1) a file listed in `mkdocs.yml`'s `nav` that
doesn't exist on disk, (2) a broken internal link
(`[text](missing-file.md)`), (3) `mkdocs-material`/`mkdocs-static-i18n`
versions incompatible with what's pinned in `requirements-docs.txt`.
Fix: check the file/line in the error message; reproduce locally with
`pip install -r requirements-docs.txt && mkdocs build --strict` and fix
it there.

## CI shows Docker/Quality Gate FAILED but everything works locally

First check the pipeline stages on
[Git & CI/CD](development/git-ci.md) — which job failed
(`frontend`/`backend`/`docker-build`/`k6-smoke`/`scripts-lint`) is
listed explicitly in the `REPORT.md` artifact produced by the
`quality-pipeline` job. Regardless of score, the Quality Gate always
returns `FAILED` when any required stage genuinely fails/is
cancelled (the score is reporting-only) — this is by design, there is
no way to "quietly" pass it.
