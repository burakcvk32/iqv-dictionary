# Release Checklist

Before tagging a release or merging to `main`, ALL of the following
items must be verified. This list matches the actually-installed CI
pipeline (see [Git & CI/CD](git-ci.md)) one-to-one — it is not a
generic template.

## Git

- [ ] `git status --short` is clean, or every change is accounted for
- [ ] no files containing real secrets (`.env`, `.env.local`, etc.)
      show up in `git status` (gitignored)
- [ ] newly added files contain no real secret/password/token (see the
      "Security" item below)
- [ ] `node_modules/`, `dist/`, `coverage/`, raw k6 JSON output are not
      tracked by Git

## Frontend (`dashboard/`, pnpm)

- [ ] `pnpm run typecheck` — 0 errors
- [ ] `pnpm run lint` — 0 errors
- [ ] `pnpm run prettier` — 0 diffs
- [ ] `pnpm test` — all tests PASS
- [ ] `pnpm run test:coverage` — coverage report generated
- [ ] `pnpm run build` — production build completes successfully

## Backend (`backend/`, npm)

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] `npm run prettier` — 0 diffs
- [ ] `npm test` — all tests PASS (auth, authz, dictionary, personnel,
      resilience)
- [ ] `npm run test:coverage` — coverage report generated
- [ ] `npm run build` — `dist/` builds successfully
- [ ] `/health` returns 200 against the in-memory test server

## Security

- [ ] auth/authorization/self-privilege-escalation regression tests
      PASS (see [Testing](testing.md))
- [ ] deep secret scan: no real JWT secret/Mongo URI (with
      credentials)/password/token/API key anywhere in `.env`, config,
      Docker, source, test, docs, README, or script files
- [ ] `.env.example` files are up to date (real variable NAMES, no real
      VALUES)

## Docker

- [ ] `docker build ./backend` succeeds
- [ ] `docker build ./dashboard` succeeds
- [ ] `docker compose config` is valid (no syntax/merge errors)
- [ ] no image contains an embedded secret

## k6

- [ ] smoke tests (`k6-smoke` job) PASS
- [ ] (only when needed, manual) load/stress tests were run and results
      reviewed — never run against production

## MkDocs

- [ ] `mkdocs build --strict` completes without errors
- [ ] new pages appear in `mkdocs.yml`'s `nav`

## Deployment (`scripts/`, `docker-compose.prod.yml`)

- [ ] the `VERSION` file was updated for this release (the single
      source of truth logged by install/update scripts as "Current
      version"/"Target version" — see
      [Installation / Update / Uninstall](../deployment/installation.md))
- [ ] `bash -n scripts/linux/*.sh` — no syntax errors
- [ ] PowerShell parser validation (CI's `scripts-lint` job, or locally
      via `pwsh`:
      `[System.Management.Automation.Language.Parser]::ParseFile(...)`)
      passes for `scripts/windows/*.ps1`/`*.psm1`
- [ ] `docker compose -f docker-compose.prod.yml config` is valid
- [ ] `docker build -f backend/Dockerfile.prod ./backend` succeeds
- [ ] `docker build -f dashboard/Dockerfile.prod ./dashboard` succeeds
- [ ] `docker-compose.yml` (development) is UNTOUCHED/unbroken — still
      hot-reloads via `docker compose up -d`

## Test data cleanup

- [ ] `K6_`-prefixed data left over from k6/test runs was cleaned up
      automatically since it's in-memory only (no separate cleanup step
      NEEDED) — if a manual test was run against a real DB, its
      `K6_`/test data must be cleaned up by hand
