# Testing

## Overview

| Sub-project | Framework | Location |
|---|---|---|
| `backend/` | Vitest 2 + Supertest | `backend/src/tests/` |
| `dashboard/` | Vitest 1 + React Testing Library + jsdom | `dashboard/src/**/*.test.{ts,tsx}` |

## Backend tests

```bash
cd backend
npm test              # full suite (vitest run)
npm run test:coverage # with coverage (v8 provider)
```

**Test database approach:** the real MongoDB is NEVER connected to.
Every test file combines the in-memory fake repositories under
`src/tests/support/` (`MemoryDictionaryRepository`,
`MemoryUsersRepository`, `MemoryPeopleRepository`) with the real
`createApp()` (routing/middleware/validation/auth chain UNCHANGED).
This keeps tests both fast and independent of a real Mongo connection.

**Covered test files:**

- `people.test.ts` — Personnel CRUD, permission/role escalation
  blocking, users see only their own record (self-security).
- `dictionary.test.ts` — Dictionary CRUD, search, subgroup filtering.
- `auth.test.ts` — Login, `/auth/me` ("protected page flash" security
  regression: no/invalid/expired token → 401; valid → 200).
- `resilienceAndErrors.test.ts` — unexpected errors degrade to 500
  without leaking internal detail; unknown routes → 404.

**Interpreting results:** `npm test` output shows `✓`/`✗` per file plus
`Test Files`/`Tests` totals. Any FAILing test turns CI red (see
[Git & CI/CD](git-ci.md)).

## Dashboard tests

```bash
cd dashboard
pnpm test              # full suite (vitest run)
pnpm run test:watch    # watch mode during development
pnpm run test:coverage # with coverage
```

**Covered test files:**

- `src/utils/permissions.test.ts` — role/permission resolution logic
  (`resolvePermissions`, `hasPermission`, `isAdminTierRole`) — the
  permission map must match backend `middleware/auth.ts` exactly.
- `src/routes/requireAuth.test.tsx` — "protected page flash" security
  regression: verifies, via real DOM rendering, that protected content
  is NEVER rendered while a token is missing/invalid/still being
  validated (AUTH-01 → AUTH-07).

**One known test file that cannot currently be run:**
`src/components/dictionary/subgroupFilter.test.tsx` is deliberately
excluded via `vitest.config.ts`'s `exclude` list — the file itself
remains in the repo as a genuine test scenario (not deleted), but the
initial dependency-graph scan for `antd`+`react-redux` can exceed a
practical time limit in some environments. It's excluded so it doesn't
block `pnpm test` (and therefore CI). See the comment block at the top
of the file itself and the [Test Report](../testing/TEST_REPORT.md) for
details.

## Auth/Authorization/Security regression tests

The following scenarios run as REQUIRED checks in CI (backend
`auth.test.ts` + `people.test.ts`, dashboard `requireAuth.test.tsx`):

- No token → 401 / redirect to login
- Invalid token → 401
- Expired token → 401
- Role/permission-based route access control (403)
- Self privilege escalation is blocked
- A normal user sees only their own record (`scopeToUserId`)
