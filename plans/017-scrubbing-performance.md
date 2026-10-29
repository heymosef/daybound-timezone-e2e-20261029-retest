# Plan 017: Measure scrubbing cost and apply only demonstrated improvements

## Status and execution contract

- Status: INVESTIGATED—NO CHANGE; locally implemented, validated and staff-reviewed on2026-10-23.
- Priority: P2; effort: M; change risk: MED; category: perf.
- Planned at: `b4100f9`, 2026-10-23.
- Depends on: 013; integrate after012/014/016/020 when they touch App or rows.
- Repository checkout: `/Users/mohammed/Documents/Cursor/daybound-web-app`.
- Assigned isolated worktree: `/Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app`.
- Implementation owner uses the assigned isolated worktree and local commits only after implementation is requested. Do not push, deploy, open PRs, change dashboards, or change global runtime/model settings. The primary integrator owns `plans/README.md` status and final validation.

Read this entire file before implementation. Run `git diff --stat b4100f9..HEAD -- src/app/App.tsx src/app/App.test.tsx src/app/components/TimezoneRow.tsx src/app/components/TimezoneRow.test.tsx src/app/components/Timeline.tsx src/app/components/Timeline.test.tsx src/hooks/useTimelineScrub.ts src/hooks/useTimelineScrub.test.tsx scripts/browser-fixtures.mjs tests/browser/timeline.spec.ts plans/017-scrubbing-measurements.md` and `git status --short`. Reconcile expected edits from the dependencies against the current-state excerpts; record that reconciliation in the handoff. Stop for unexplained semantic drift, unrelated dirty files in scope, or a dependency that is not complete. Do not overwrite someone else's work.

## Runtime, conventions and verification ownership

Use Node24 (`node --version` must report v24.x) and npm; run `npm ci` when dependencies are missing or the lockfile changes. A session-local invocation is `npm exec --yes --package=node@24 --package=npm@11 -- npm <arguments>`; do not change global defaults. Match React18 functional components, TypeScript strict mode, Tailwind theme variables, and existing Testing Library/Vitest patterns. Never use real analytics credentials for verification.

During implementation run the focused commands below, `npm run typecheck`, and `npm run lint` (all exit 0). The primary integrator runs `npm test` and `npm run build` once on the final integrated candidate, plus the browser suite once it exists. A plan's passing focused tests are not a claim that final integration passed. Failure requires investigation, not blanket retries or wider unrelated refactors.

## Scope

Only these paths may change, plus this plan's execution notes and the integrator-owned index:

- `src/app/App.tsx`
- `src/app/App.test.tsx`
- `src/app/components/TimezoneRow.tsx`
- `src/app/components/TimezoneRow.test.tsx`
- `src/app/components/Timeline.tsx`
- `src/app/components/Timeline.test.tsx`
- `src/hooks/useTimelineScrub.ts`
- `src/hooks/useTimelineScrub.test.tsx`
- `scripts/browser-fixtures.mjs`
- `tests/browser/timeline.spec.ts`
- `plans/017-scrubbing-measurements.md`

## Why this matters

Scrubbing publishes pan changes to App at animation-frame cadence. Date objects and calendar-selection objects are recreated on these renders, and each row combines stationary information with the moving rail. This is a source-level optimization candidate; the audit measured no frame-time problem. Measurement may conclude that no refactor is worthwhile.

## Current state and behavior that must survive

`App.tsx`:
```tsx
const clockTime = view?.selected != null ? new Date(view.selected) : now;
const timelineTime = view ? new Date(view.base) : now;
const surfacedSelection: DateSelection = view
  ? { mode: "date", date: getZonedFields(view.calendarTime, homeTimezone).date }
  : LIVE_SELECTION;
```
`handlePanTimeline` updates `view.hours` and `calendarTime`; `useTimelineScrub.ts` already batches pending movement via requestAnimationFrame. `TimezoneRow` and `Timeline` already use `React.memo`, and the timeline model has a memoized calculation. Preserve25 elapsed-hour cells, +/-24h exploration, exact fractional/DST instants, day-boundary updates, live clocks unless selected, frozen browsed view, deselection preserving rail/date, stable instant cell keys and scrubbing hover/transition suppression. Existing `App.test.tsx` describe “synchronized timeline exploration” and `Timeline.test.tsx` provide correctness patterns.

## Steps

1. Establish a repeatable baseline in `plans/017-scrubbing-measurements.md`: record commit, browser/device, refresh rate, viewport, design, CPU throttle (if emulated), row count, clock scenario, warm-up and capture method. Settle012/014/016/020 before the baseline, or record a deliberate fixed exclusion of unimplemented plans; any later overlapping change invalidates the comparison. Add only fixture-shell seeding for a bounded deterministic12/24-row scenario if necessary; no product performance flags/profilers. Run three matched10-second active samples after warm-up at390px and1280px using the same fixture build type. Include the normal fixture row count as the representative case;12/24 rows are separately labelled stress cases. Use a native pointer-down at the viewport center and a symmetric back-and-forth path x(t)=center+A*sin(2*pi*t/2000ms), with A=min(0.3*viewportWidth,3*cellWidth), constant y, and a nominal60Hz input cadence. Log actual event cadence and elapsed performance.now timestamps. This crosses hour rebases while staying within +/-3h of the anchor, well clear of the24h clamp. Record rail transform/data-start changes in every1-second interval; reject samples that stall at a clamp or lack continuing pan updates. Keep the fixture clock frozen but use performance.now()/rAF timestamps for frame gaps/long tasks. Choose p95 rAF gap as the primary metric before any candidate change; secondary metrics are >50ms long-task count and input-to-rail-update latency. Retain raw sample summaries and actual cadence so a low input rate cannot masquerade as faster rendering. Apply identical lightweight timing/rail-observation overhead to baseline/candidate; capture frame gaps/long tasks and a separate diagnostic React profiler trace to attribute renders; don't compare a development baseline with a production candidate. Use existing tools or a tiny offline measurement helper under the fixture shell, not telemetry. Verify `node scripts/browser-fixtures.mjs` exits0 and named browser smoke tests pass with no external requests. Save summarized numeric evidence, not raw user data.
2. Decision gate: if the representative baseline has no repeatable slow frame behavior, finish as INVESTIGATED—NO CHANGE with the evidence and skip refactoring. A candidate optimization needs a visible issue or reproducible p95 frame gap above25ms in the fixed60Hz reference environment; for other refresh rates record an equivalent justified budget before comparing. Physical-phone performance remains unverified unless actually measured. Verify the measurement record contains all three continuously active samples for each named representative/stress case and the explicit go/no-go decision before touching product code.
3. If warranted, first stabilize Date/selection inputs by primitive epoch/date dependencies. Isolate stationary row information from rail props only if profiling identifies it as costly. Reuse current formatter/model caches; do not add a second cache, global state manager, virtualization, worker, alternate animation library or imperative DOM rail. Recompute header date state only when its actual date changes, while preserving per-frame movement. One change at a time; verify `npm test -- src/app/App.test.tsx src/app/components/TimezoneRow.test.tsx src/app/components/Timeline.test.tsx src/hooks/useTimelineScrub.test.tsx`, typecheck and lint exit0.
4. Re-run the identical three baseline samples. Accept only a repeatable >=20% reduction in the preselected p95 rAF-gap metric with no >10% regression in the other measured scenarios and unchanged behavior/browser checks. If the baseline cannot be compared reliably, keep the measurement report and revert unproven code changes. Verify `npm run test:browser -- tests/browser/timeline.spec.ts` passes and record before/after numbers and rejected experiments.

## Done criteria

Either a documented NO CHANGE verdict or a measured improvement satisfying the acceptance gate is a successful outcome. No claimed speedup without matched evidence. Focused tests/typecheck/lint and actual browser checks pass for any retained source change. Timeline state/cell identity/date transitions/selected band/clock-change hints remain correct. No new product analytics/profiling payload, feature flags or long-lived benchmark watcher.

## STOP conditions

Stop for unexplained timing noise, different environments/build types, absence of reproducible baseline, or correctness regressions. Do not optimize merely because a component re-renders or the bundle warning exists. If the diagnosis requires architecture work beyond these files, report the trace and propose a smaller follow-up instead.

## Maintenance notes

Performance numbers are environment-specific, not CI timing assertions. Keep deterministic behavior checks in CI; retain summarized measurement records as evidence. Re-profile only when relevant changes or regressions justify it.

## Execution outcome — 2026-10-23

Completed under the user's implementation authorization. See [integrated validation](025-implementation-log.md) and [staff implementation approval](024-implementation-review.md). Current source/tests supersede the baseline excerpts for future drift checks; optional product designs remain excluded. No publication or deployment occurred.
