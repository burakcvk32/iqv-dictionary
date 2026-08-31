# Performance Testing (k6)

## Test environment

k6 tests are **never run against production.** Both in local
verification and in CI (the `k6-smoke` / `k6-load-stress` jobs), they
run against a server started by the backend's own
`tests/performance/server/k6TestServer.ts` — the real `createApp()`
combined with the same in-memory fake repositories (see the "Test
database approach" section of [Testing](testing.md) — the same
in-memory pattern).

**What this measures:** the real performance of the routing +
middleware (helmet/cors/rate-limit) + JWT auth + validation + business
logic layer. **What it does NOT measure:** MongoDB I/O latency. The
numbers are NOT production-equivalent — they only give real, useful
information about the application code's own layer. See the
[Performance Report](../testing/PERFORMANCE_REPORT.md) for the detailed,
actually-executed results.

## "Never run against production" rule

- k6 scripts target `http://127.0.0.1:4001` (the in-memory test server)
  by default (`BASE_URL` env var).
- `BASE_URL` is never set to a real/staging/production address in the
  CI pipeline.
- The test user and every dictionary record used are prefixed with
  `K6_` — never mixed with real data, and automatically cleaned up when
  the process exits since everything is in-memory.

## Smoke vs. Load/Stress

| Level | When it runs | VUs/Duration | Scripts |
|---|---|---|---|
| **Smoke** | Every push/PR (`k6-smoke` job) | 1 VU, short | `auth-smoke.js`, `dictionary-read.js`, `dictionary-crud.js`, `personnel-read.js` |
| **Load/Stress** | Manual only (`workflow_dispatch`, `run_k6_load_test: true`) | 10-100 VUs, 30-60s | `dictionary-read.js`, `auth-smoke.js` |

Smoke tests give a fast "broken or not" signal on every commit;
load/stress tests take longer and are noisier (they deliberately
saturate the rate limiter), so they don't run on every push.

## VUs/Duration logic

Scripts can be parameterized via `__ENV.VUS` / `__ENV.DURATION`
(defaults are defined in the script, usually 1 VU / 6-10s for smoke).
The load test configuration that was actually run: staged 10 → 25 → 50
VUs, 60s total (see Performance Report, section 3).

## Result metrics

k6's standard output includes:

- `http_reqs` — total request count and req/s
- `http_req_duration` — `avg`/`med`/`p90`/`p95`/`max` latency
- `http_req_failed` — k6's built-in "failed" rate (counts 4xx/5xx —
  NOTE: for this project 429 [rate-limit] also counts here, and that is
  NOT a crash, see the honest commentary in section 3 of the
  Performance Report)
- `checks` — the script's OWN expected-status assertions (usually
  treats 200 OR 429 as "expected")

Raw JSON results are written to `backend/tests/performance/results/`
and are **not committed to Git** (see `.gitignore`) — only curated
markdown summaries like this page are committed.
