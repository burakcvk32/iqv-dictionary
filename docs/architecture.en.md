# Architecture

Dictionary is a classic SPA + REST API split into two independent
sub-projects: `dashboard/` (client) and `backend/` (API server). The
only contact point between them is HTTP/JSON — there is no shared code;
each sub-project has its own dependency tree.

```
+----------------------+        HTTPS/JSON        +------------------------+
|  dashboard/ (SPA)     | ------------------------> |  backend/ (REST API)   |
|  React 18 + Vite      |   /api/v1/... (JWT)        |  Express + TypeScript  |
|  Ant Design + Redux    | <------------------------ |                         |
|  Toolkit               |                            |                         |
+----------------------+                            +------------+-----------+
                                                                    | mongodb://
                                                                    v
                                                            +----------------+
                                                            |    MongoDB      |
                                                            | (never          |
                                                            |  containerized, |
                                                            |  runs           |
                                                            |  externally)    |
                                                            +----------------+
```

## Backend layers (`backend/src/`)

Every business area (auth, dictionary, people) follows the same
4-layer pattern under `backend/src/modules/<area>/`:

| Layer | File | Responsibility |
|---|---|---|
| Route | `<area>.routes.ts` | Express router — wires URLs to controllers |
| Controller | `<area>.controller.ts` | HTTP req/res, status codes, error mapping |
| Service | `<area>.service.ts` | Business rules (authorization checks, validation flow) |
| Repository | `<area>.repository.mongo.ts` | MongoDB access (the single real persistence point) |
| Types/Validation | `<area>.types.ts`, `<area>.validation.ts` | Type definitions, request schema validation |

This layering is what lets tests (see [Testing](development/testing.md))
swap the repository for an in-memory fake and run all business logic
without a real MongoDB.

Other top-level directories:

- `backend/src/config/` — environment variable loading (`env.ts`), DB connection (`db.ts`)
- `backend/src/middleware/` — JWT verification, permission checks, rate limiting, error handlers
- `backend/src/docs/` — Swagger/OpenAPI generation (see [Backend API](backend-api.md))
- `backend/src/legacy/` — old endpoints kept for backward compatibility
- `backend/src/tests/` + `backend/src/tests/support/` — the Vitest suite and its in-memory fake repositories

## Frontend layers (`dashboard/src/`)

See [Frontend / Dashboard](frontend.md) for details. In short:
`routes/` (React Router definitions plus the `requireAuth`/
`requirePermission` guard components), `store/` (Redux Toolkit slices),
`services/` (API client), `components/` (feature-scoped UI, e.g.
`dictionary/`, `users/`, `auth/`, `settings/`, `theme/`).

## Inter-service communication

- **Development (hot reload):** Vite's own dev-server proxy
  (`vite.config.ts`) forwards `/api` requests to the backend; dashboard
  code always uses relative paths (`/api/v1/...`) — `VITE_API_BASE_URL`
  is intentionally ignored in dev.
- **Production build:** the build-time env var `VITE_API_BASE_URL` (see
  `dashboard/src/utils/index.tsx`) sets the backend's real address — the
  client is no longer behind a dev-server proxy.
- **Docker (development):** `docker-compose.yml` publishes the backend
  under the `dictionary-backend` service name on Docker's internal DNS;
  the dashboard container uses
  `VITE_DEV_API_PROXY_TARGET=http://dictionary-backend:3001` to reach it.
- **Docker (production):** `docker-compose.prod.yml` serves static files
  via `nginx` (inside the dashboard image); the backend comes up as its
  own container/image with a `healthcheck`, and the dashboard depends on
  it via `depends_on: condition: service_healthy`.

## Database

MongoDB is **never containerized or managed** by this project — it
connects to whatever `MONGODB_URI` in `backend/.env` points to (host
machine, another server on the LAN, etc.). In Docker mode this is
usually resolved to the host machine via Docker's `host.docker.internal`
DNS alias (see `extra_hosts` in `docker-compose.yml` /
`docker-compose.prod.yml`).

## Relationship to deployment/CI

Docker images and `docker compose` validation are built in CI purely for
LOCAL VALIDATION — nothing is ever pushed to a registry (see
[Git & CI/CD](development/git-ci.md)). The real production install runs
via `scripts/windows/install.ps1` / `scripts/linux/install.sh`,
completely independent of CI (see
[Installation / Update / Uninstall](deployment/installation.md)).
