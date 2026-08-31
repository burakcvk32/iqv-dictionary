# Backend API

The backend is a single Express application assembled in
`backend/src/app.ts`. This page is a summary reference derived from the
real route definitions — for a **complete, interactive, always-in-sync**
reference, use the running backend's `/api-docs` (Swagger UI) and
`/openapi.json` endpoints (see `backend/src/docs/swagger.ts`).

## Basics

- **Base path:** `/api/v1/...` (a few legacy/Node-RED endpoints are the exception, see below)
- **Authentication:** `Authorization: Bearer <JWT>` header. The token is
  obtained via `POST /api/v1/auth/login` and expires after
  `JWT_EXPIRES_IN` (default `12h`).
- **Content type:** `application/json`, 1 MB body limit.
- **Global rate limit:** every endpoint under `/api/*` is limited to 300
  requests / 60 seconds per IP. Exceeding it returns `429 Too Many
  Requests` — this is not a bug, it is intentional protection (see
  [Performance Testing](development/performance-testing.md)).
- **Login rate limit:** `POST /api/v1/auth/login` additionally has its
  own, stricter limit: 20 requests / 5 minutes (brute-force protection).

## Endpoints

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | — | — | Username/password login, returns `{ success, token, user }` |
| `GET` | `/api/v1/auth/me` | ✅ | — | Validates the token, returns fresh user data (no `password` field) — prevents the "protected page flash" |
| `GET` | `/api/v1/users` | ✅ | `users.read` | List personnel |
| `POST` | `/api/v1/users` | ✅ | `users.create` | Create a personnel record |
| `PUT`/`PATCH` | `/api/v1/users/:id` | ✅ | `users.update` | Update a personnel record |
| `DELETE` | `/api/v1/users/:id` | ✅ | `users.delete` | Delete a personnel record |
| `GET` | `/api/v1/dictionary` | ✅ | `dictionary.read` or `settings.read` | List/search dictionary entries |
| `GET` | `/api/v1/dictionary/stats` | ✅ | `dictionary.read` | Statistics (group/subgroup distribution) |
| `GET` | `/api/v1/dictionary/subgroups` | ✅ | `dictionary.read` or `settings.read` | Subgroups for a given group |
| `GET` | `/api/v1/dictionary/:id` | ✅ | `dictionary.read` | Single entry |
| `POST` | `/api/v1/dictionary` | ✅ | `dictionary.create` or `settings.update` | Create a new term |
| `PUT`/`PATCH` | `/api/v1/dictionary/:id` | ✅ | `dictionary.update` | Update a term |
| `DELETE` | `/api/v1/dictionary/:id` | ✅ | `dictionary.delete` | Delete a term |
| `GET`/`POST` | `/list-dictionary`, `/create-dictionary` | ✅ | (legacy) | Old aliases kept for Node-RED compatibility — same `DictionaryService`, no duplicated logic |
| `GET` | `/health` | — | — | Health check, `{ success: true, data: { status: 'ok' } }` |
| `GET` | `/api-docs` | — | — | Swagger UI (interactive API reference) |
| `GET` | `/openapi.json` | — | — | Raw OpenAPI schema |

## Authorization model

Permissions (`PermissionKey`) are defined across three areas:
**dictionary** (`read/create/update/delete`), **users**
(`read/create/update/delete`), **settings** (`read/update`). A user's
role and/or explicitly assigned permission list resolve these keys
(`backend/src/middleware/auth.ts`). Self-privilege-escalation (changing
your own role/permissions/status) is blocked — see the
[SECURITY REGRESSION table](testing/TEST_REPORT.md).

## Error format

Unexpected (unhandled) errors return `500` with a fixed, safe message —
never leaking internal detail (stack traces, DB connection strings,
etc.). Unknown routes return `404`. Validation errors return `400` with
a readable, field-level body (see the `<area>.validation.ts` files).

## Exploring during development

```bash
cd backend
npm run dev
# then open: http://localhost:3001/api-docs
```

Swagger UI lists every endpoint with its real schema and lets you send
requests directly from the browser (enter your token via "Authorize").
