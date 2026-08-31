# Frontend / Dashboard

`dashboard/` is a React 18 + TypeScript + Vite single-page application
using the Ant Design component library. State management is handled
with Redux Toolkit.

## Directory layout (`dashboard/src/`)

| Directory | Contents |
|---|---|
| `routes/` | `browserRouter.tsx` (React Router setup, lazy-loaded pages), `web.tsx` (page paths), `api.tsx` (backend endpoint URLs), `requireAuth.tsx` / `requirePermission.tsx` (route guard components) |
| `store/` | The Redux Toolkit store (`store/index.tsx`) and slices (`store/slices/adminSlice.tsx`) |
| `services/` | HTTP clients that talk to the backend: `authApi.ts`, `dictionaryApi.ts`, `peopleApi.ts` |
| `components/` | Feature-scoped UI: `auth/`, `dictionary/`, `layout/`, `loader/`, `settings/`, `theme/`, `users/` |
| `interfaces/` | TypeScript type definitions (`interfaces/models/`) |
| `constants/` | Constants |
| `utils/` | Helper functions, `API_BASE_URL` resolution logic |

## Route protection model

`requireAuth.tsx` validates the token against the backend's
`GET /api/v1/auth/me` endpoint **before** a page is rendered (the
"protected page flash" safeguard — while validation is pending, neither
protected content nor the login page is shown, only a loader).
`requirePermission.tsx` then applies page/action-level authorization
using the same `PermissionKey` contract as the backend
(`dictionary.*`/`users.*`/`settings.*` — see
[Backend API](backend-api.md) and
`dashboard/src/utils/permissions.ts`, which must stay in sync with
backend `middleware/auth.ts`).

## Theme (light/dark)

`components/theme/AppTheme.tsx` is the application's own light/dark
theme provider — it works by swapping Ant Design `ConfigProvider` theme
tokens. (This is separate from this documentation site's own Material
theme toggle — see [Home](index.md); they are two independent systems,
one for the application's own UI, one for this docs site.)

## API base URL logic

`dashboard/src/utils/index.tsx`:

- **Development (`import.meta.env.DEV`):** always empty/relative —
  requests go to `/api/v1/...` on the same origin, and Vite's own `/api`
  proxy (`vite.config.ts`) forwards them to the real backend.
  `VITE_API_BASE_URL` is intentionally ignored in dev.
- **Production build:** `VITE_API_BASE_URL` (a build-time env var — see
  the `--build-arg` in `dashboard/Dockerfile.prod` and the root
  `.env.example`) is used; the client is no longer behind a dev-server
  proxy and calls the backend's real address directly.

## Testing

Component/unit tests are written with Vitest + React Testing Library +
jsdom under `src/**/*.test.{ts,tsx}` — see
[Testing](development/testing.md) for details and known coverage gaps.

## Development commands

```bash
cd dashboard
pnpm install --frozen-lockfile
pnpm run dev          # hot-reload dev server (Vite)
pnpm run typecheck    # tsc
pnpm run lint          # ESLint
pnpm run build         # production build (tsc && vite build)
pnpm test               # Vitest
```

The package manager is strictly **pnpm** (`dashboard/pnpm-lock.yaml` is
the source of truth) — never mix it with `npm`/`yarn`, see
[Git & CI/CD](development/git-ci.md).
