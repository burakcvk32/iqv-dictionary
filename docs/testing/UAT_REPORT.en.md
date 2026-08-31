# Dictionary Project — UAT & Responsive Report (Summary)

**Date:** 2026-08-30. This is a concise English summary — see
[UAT Raporu](UAT_REPORT.md) (Turkish) for the full report.

## Why this entire section is NOT EXECUTED / manual

A real UAT pass requires a genuinely running frontend (`npm run dev` or
a built dashboard) plus a real backend, driven by real clicks/form
entry in a browser. This was not possible in the test environment, for
two proven technical reasons:

1. **The dashboard dev/production server could not run in this
   environment.** `dashboard/node_modules` was installed on the user's
   real Windows machine and only contains `@esbuild/win32-x64` (and
   other Windows-specific native binaries) — there is no `linux-x64`
   build available over the Linux bridge used for this session, so
   `vite build`/`vite dev` immediately fail with *"You installed esbuild
   for another platform"* (see [Troubleshooting](../troubleshooting.md)).
   Reinstalling native binaries for this environment was deliberately
   avoided, since it risked breaking the user's real, working Windows
   dev environment.
2. **The real MongoDB was not reachable from this environment** (see
   the [Performance Report](PERFORMANCE_REPORT.md)) — a realistic,
   data-backed UAT flow wasn't possible either way.

A browser automation tool was technically available in the session, but
with no working target to point it at (neither a real dashboard nor a
real-data-backed backend), it was never used — using it against a
blank/crashed page would have amounted to falsely claiming a test was
performed, which is explicitly against the rules followed in this
engagement.

**This is not an application defect** — on the user's real Windows
machine, `npm run dev` works normally (`@esbuild/win32-x64` is present
and correct there). This is purely a constraint of the isolated test
environment.

## UAT scenarios (all NOT EXECUTED as live UAT)

Login → search flow, the 8-subgroup filter toggle, Settings CRUD flow,
admin personnel CRUD + permission changes, "users see only their own
record", self role-escalation blocking, and token-cleared → redirect-
without-flash — all marked `NOT EXECUTED` as live, end-to-end UAT.
Importantly, the security/business logic **behind** several of these
scenarios (self-privilege-escalation blocking, `scopeToUserId`
scoping, and the "protected page flash" fix specifically) was already
genuinely verified at the backend/component test level — see the
[Test Report](TEST_REPORT.md). What's marked NOT EXECUTED here
specifically is true end-to-end browser verification (real login screen
→ real clicks → real visible result), which those lower-level tests do
not replace and are not presented as replacing.

## Responsive testing

All 11 target viewports (from 1920×1080 down to 320×700, covering
desktop/tablet/mobile) are marked `NOT EXECUTED`, for the same root
cause above — screenshot-based responsive verification isn't physically
possible without a running, viewable dashboard. Marked `MANUAL` —
recommended to be completed by the user on their own Windows machine
with `npm run dev` in a real browser.

## Overall result

**UAT/Responsive: NOT EXECUTED (all of it).** The single, honestly
stated reason: no running dashboard server (platform-incompatible
native binaries) and no real MongoDB access in this isolated test
environment. Much of the security/business logic behind these scenarios
was already genuinely verified via backend/component tests — but that
does not substitute for a real end-to-end UAT pass, and is not presented
as doing so. Completing this table on the user's own Windows machine
with a real browser is recommended.
