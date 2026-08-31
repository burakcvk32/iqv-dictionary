# Dictionary Project — Performance (k6) Report (Summary)

**Date:** 2026-08-30 · **k6 version:** v0.54.0. This is a concise
English summary — see [Performans Raporu](PERFORMANCE_REPORT.md)
(Turkish) for the complete report with every raw metric and commentary.

## Scope limitation (read first)

The test environment had **no network access to the real MongoDB**
(port 27017 was not reachable). So these k6 runs are **not against
production** — they target `tests/performance/server/k6TestServer.ts`,
which combines the real `createApp()` (routing/middleware/validation/
auth/rate-limiting chain, completely unchanged) with the same in-memory
fake repositories the backend's own Vitest suite already trusts.

**What this measures:** the real performance of routing + middleware +
JWT auth + validation + business logic. **What it does not measure:**
MongoDB I/O latency. **These numbers are not production-equivalent** —
they are genuine, useful signal about the application code's own layer
only. No SLA threshold was invented; the numbers below are reported
observationally.

## Smoke tests (1 VU, short) — all genuinely executed

All four smoke scripts (`auth-smoke.js`, `dictionary-read.js`,
`dictionary-crud.js`, `personnel-read.js`) passed with 100% checks. Two
real script bugs (not application bugs) were found and fixed during
smoke testing: a mismatched login-response shape assumption, and a
missing `encodeURIComponent` around a query parameter. A seed-script bug
that left 4 of 8 dictionary subgroups empty was also found and fixed.

## Load test — `dictionary-read.js` (staged 10 → 25 → 50 VUs, 60s total)

24,737 requests, 411.23 req/s average. `http_req_duration`: avg 1.8ms,
p95 5.07ms, max 54.91ms. k6's built-in `http_req_failed` metric shows
97.70% — **this is not a crash**: the backend's own `apiLimiter` (300
req/60s across `/api/*`) saturates quickly under 25-50 concurrent VUs
and correctly returns 429. The real successful (200) throughput was
roughly 9.4 req/s — an observational note that the current
`apiLimiter` threshold may be low for a 50-concurrent-user load
scenario (not a formal SLA/pass-fail claim).

## Stress test (observational) — `dictionary-read.js` (100 VUs, 30s)

43,533 requests, 1,434.58 req/s peak. `http_req_duration`: avg 1.81ms,
p95 5.25ms, max 250.96ms. **No crash, connection error, or 5xx was
observed even at 100 concurrent VUs** — the server stayed stable; only
the rate limiter engaged.

## Login endpoint — separate, stricter rate limit (20 VUs, 15s)

294 requests, 18.38 req/s. Only 6.8% (20/294) of login attempts
succeeded — this is **expected, correct** brute-force protection from
the login endpoint's own stricter limiter (not a vulnerability), though
it's noted as something that could affect legitimate concurrent-login
experience in a high-traffic environment.

## Not executed

A separate "load" run for `personnel-read.js` / `dictionary-crud.js` /
`mixed-workload.js` was not completed — the residual rate limit left
over from the preceding 100-VU stress test caused their `setup()` login
calls to receive 429s. Smoke-level PASS data already exists for all
three; a fresh server instance and additional time would be needed for
a dedicated load run, which time constraints did not allow. DB/CPU/
memory monitoring was not available in this environment either — marked
`NOT EXECUTED`, not fabricated.

## Overall result

k6 setup ✅, all 4 smoke scripts ✅ PASS, dictionary-read load ✅
executed, auth/login load ✅ executed, personnel-read/dictionary-crud/
mixed-workload load ⚠️ NOT EXECUTED (smoke only), stress test ✅
executed (no crash/5xx, rate-limiter saturation observed), testing
against production ❌ not done (forbidden, and technically impossible —
no Mongo access).
