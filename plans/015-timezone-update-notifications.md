# Plan 015: Check timezone freshness on a bounded maintenance schedule

## Status and execution contract

- Status: DONE; locally implemented, validated and staff-reviewed on2026-10-23.
- Priority: P1; effort: S; change risk: LOW; category: dx.
- Planned at: `b4100f9`, 2026-10-23.
- Depends on: none.
- Repository checkout: `/Users/mohammed/Documents/Cursor/daybound-web-app`.
- Assigned isolated worktree: `/Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app`.
- Implementation owner uses the assigned isolated worktree and local commits only after implementation is requested. Do not push, deploy, open PRs, change dashboards, or change global runtime/model settings. The primary integrator owns `plans/README.md` status and final validation.

Read this entire file before implementation. Run `git diff --stat b4100f9..HEAD -- scripts/check-timezone-data.mjs scripts/lib/timezone-check.mjs scripts/test-timezone-check.mjs .github/workflows/timezone-freshness.yml docs/timezone-data.md` and `git status --short`. Reconcile expected edits from the dependencies against the current-state excerpts; record that reconciliation in the handoff. Stop for unexplained semantic drift, unrelated dirty files in scope, or a dependency that is not complete. Do not overwrite someone else's work.

## Runtime, conventions and verification ownership

Use Node24 (`node --version` must report v24.x) and npm; run `npm ci` when dependencies are missing or the lockfile changes. A session-local invocation is `npm exec --yes --package=node@24 --package=npm@11 -- npm <arguments>`; do not change global defaults. Match React18 functional components, TypeScript strict mode, Tailwind theme variables, and existing Testing Library/Vitest patterns. Never use real analytics credentials for verification.

During implementation run the focused commands below, `npm run typecheck`, and `npm run lint` (all exit 0). The primary integrator runs `npm test` and `npm run build` once on the final integrated candidate, plus the browser suite once it exists. A plan's passing focused tests are not a claim that final integration passed. Failure requires investigation, not blanket retries or wider unrelated refactors.

## Scope

Only these paths may change, plus this plan's execution notes and the integrator-owned index:

- `scripts/check-timezone-data.mjs`
- `scripts/lib/timezone-check.mjs`
- `scripts/test-timezone-check.mjs`
- `.github/workflows/timezone-freshness.yml`
- `docs/timezone-data.md`

## Why this matters

The timezone checker is currently manual, so a long period without development can leave legislated rule changes unnoticed. Bundled2026e matched IANA2026e during the2026-10-23 audit; this is prevention, not a current stale-rules defect.

## Current state

`scripts/check-timezone-data.mjs` validates pinned provider/source/generated versions, then:
```js
const response = await fetch("https://data.iana.org/time-zones/tzdb/version",
  { signal: AbortSignal.timeout(15000) });
const latest = (await response.text()).trim();
if (!/^\d{4}[a-z]+$/.test(latest)) throw new Error("Unexpected IANA version response");
if (data.version !== latest) process.exitCode = 1;
```
Transport errors and stale rules currently share an unsuccessful outcome. `docs/timezone-data.md` intentionally requires reviewed pinned updates; full historical data and BC display overrides are accepted tradeoffs. CI and Pages run only on PRs/pushes/manual dispatch and do not invoke this network check.

## Steps

1. Extract testable classification/check logic into `scripts/lib/timezone-check.mjs`, injecting the version fetch rather than adding fixture flags to product code. Preserve `npm run tz:check`; define exit0/current,1/review needed (stale or pinned local mismatch),2/check unavailable (network, timeout, unexpected response). Emit short distinct diagnostic messages and an Actions-compatible summary without user data. Version comparison must support multi-letter IANA suffixes. Write Node built-in tests in `scripts/test-timezone-check.mjs` using `node:test`/`assert`, no new dependency. The `test-` filename deliberately avoids Vitest's `.test`/`.spec` discovery; the Node runner owns this file. Verify `node --test scripts/test-timezone-check.mjs` passes for equal/newer/local mismatch/HTTP error/invalid/timeout outcomes without network.
2. Add a separate workflow with manual dispatch and daily14:17UTC schedule, Node24, `npm ci`, existing SHA-pinned checkout/setup-node actions, `contents:read`, and a5-minute timeout. Run the offline script tests then the live check once. No polling, issue creation, automatic PR/update/install of latest timezone packages, deployments or dependency on this check in normal PR CI. Both unavailable and review-needed outcomes must produce a failed run, with distinct job-summary headings so failures remain visible instead of silently succeeding. Verify `git diff --check` and inspect workflow ordering/permissions; do not dispatch it remotely.
3. Document the default-branch scheduling requirement, possible delayed/disabled schedules in inactive repositories, distinct outcomes, how to run manually, and the existing reviewed provider+metadata+lockfile/regression update process. Explain that GitHub run notifications depend on the owner's subscription/account settings and have not been configured or verified locally. Verify `node --test scripts/test-timezone-check.mjs`, typecheck and lint exit0. Optionally run `npm run tz:check` once; a network failure is an honest availability result, not an excuse to change pinned data.

## Done criteria

- Offline tests pass with deterministic status classification; no fake external network needed.
- The scheduled/manual workflow is read-only and bounded, with a clear failure summary for both update-needed and unavailable checks.
- Ordinary builds remain deterministic and offline with respect to IANA; no floating versions, automatic updates or release steps.
- Record whether the one optional live check ran and its actual result. Do not claim GitHub notification delivery or activation until a future authorized remote run verifies it.

## STOP conditions

Stop if notifications require external dashboard/account changes, if updating timezone packages is proposed in this plan, or if the provider's version marker no longer matches the current checker. Report source-format changes; do not suppress the mismatch. Do not add automated issues or publish anything.

## Maintenance notes

If IANA changes its version endpoint, treat it as check unavailable. Owner must monitor failed runs and GitHub inactivity policies. Notification infrastructure cannot anticipate unpublished rules or update already-downloaded clients.

## Execution outcome — 2026-10-23

Completed under the user's implementation authorization. See [integrated validation](025-implementation-log.md) and [staff implementation approval](024-implementation-review.md). Current source/tests supersede the baseline excerpts for future drift checks; optional product designs remain excluded. No publication or deployment occurred.
