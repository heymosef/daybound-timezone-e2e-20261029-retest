# Plan 019: Align the written interaction contract with the app

## Status and execution contract

- Status: DONE; locally implemented, validated and staff-reviewed on2026-10-23.
- Priority: P2; effort: S; change risk: LOW; category: docs.
- Planned at: `b4100f9`, 2026-10-23.
- Depends on: none; do before013 final assertions and017 changes.
- Repository checkout: `/Users/mohammed/Documents/Cursor/daybound-web-app`.
- Assigned isolated worktree: `/Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app`.
- After implementation is requested, use the assigned isolated worktree and local commits only. Do not push, deploy, open PRs, change dashboards, or change global runtime/model settings. The primary integrator owns index status and final validation.

Read the whole plan first. Run `git diff --stat b4100f9..HEAD -- README.md docs/maintenance-decisions.md docs/search-analytics.md docs/usage-analytics.md` and `git status --short`. Reconcile dependency edits against the excerpts and record expected differences. Stop for unexplained semantic drift, conflicting dirty work or an incomplete dependency; never overwrite someone else's work.

## Runtime, conventions and verification ownership

Use Node24 (`node --version` reports v24.x) and npm; run `npm ci` when dependencies are absent or the lockfile changes. Session-local alternative: `npm exec --yes --package=node@24 --package=npm@11 -- npm <arguments>`. Match React18 functional components, strict TypeScript, theme-token Tailwind classes and existing Testing Library/Vitest patterns. Never use real analytics credentials for verification.

Run focused checks below plus `npm run typecheck` and `npm run lint` for retained code changes (all exit0). The primary integrator owns one complete `npm test`, `npm run build` and browser-suite run on the final integrated candidate. A planning-only/no-change outcome needs document checks, not a redundant product rebuild. Do not confuse local results with remote CI or deployment.

## Scope

Only the following paths, this plan's execution notes and the integrator-owned index may change:

- `README.md`
- `docs/maintenance-decisions.md`
- `docs/search-analytics.md`
- `docs/usage-analytics.md`

## Why this matters

The README and “Behavior to preserve” document still say deselecting a time restores live Today. The implementation and accepted interaction deliberately preserve the browsed date/rail while returning city clocks to live time. A future agent could use the stale contract to reintroduce the bug.

## Current state and source of truth

`README.md` Dates and local saving says “Tapping the highlighted column again clears the selection and restores live Today.” `docs/maintenance-decisions.md` repeats that instruction. Actual `App.tsx` selection handling is:
```tsx
if (previous?.selected != null && previous.selected >= instant && previous.selected < instant + HOUR_MS) {
  return { ...previous, selected: null };
}
```
Its explicit Today action calls `setView(null)`. Existing App regressions include “preserves scrubbing done after selecting a column when that column is cleared” and keyboard-toggle cases. Those implementation/tests establish current behavior. Analytics docs contain historical “after publishing”/“not executed live” wording; do not infer current live status merely from their age or earlier chat.

## Steps

1. Compare the current App selection/date/home-change handlers and their tests with the two behavioral descriptions. Write a short truth table in `docs/maintenance-decisions.md`: live browsing; chosen future date; explicitly selected slot; deselected slot; Today/Home; home-city change; reload. State separately what happens to row clocks, rail position and home-calendar date. Deselect keeps base/hours/calendarTime and clears only selected; clocks become live, and the current-time marker follows existing no-selection visibility/viewport rules. Today/Home resets the view. Preserve future-date hour carry, DST gaps/repeats, midnight and exact-instant policies; don't invent a new reset. Verify `rg -n 'previous.*selected|selected: null|setView\(null\)' src/app/App.tsx` locates the matching implementation and `git diff --check` exits0.
2. Keep the README short by correcting the erroneous sentence and linking the canonical decision table for details. Reconcile the project-structure description now that plans/ contains new work. Remove duplicated contradictory behavior rather than copying the full table twice. Run `rg -n 'restores live Today|clears the selection and restores' README.md docs/maintenance-decisions.md` expecting no obsolete deselection claim, and `git diff --check` expecting exit0.
3. Review analytics docs only for tense/evidence clarity: distinguish implementation, offline verification, remote deployment and live report verification. Retain historical limitations unless source-controlled evidence confirms a later result; otherwise mark the live status unknown/as-of the recorded check. Do not fetch a dashboard, execute HogQL, change report definitions or state that reports are populated. Verify each changed claim names its evidence/date or is conditional; links resolve locally. Source code is out of scope.

## Test plan and done criteria

This is a documentation-only change: no new product tests or full rebuild. Use the existing App tests as evidence, not a reason to rerun430 tests. Done when the canonical truth table matches all named handlers/test cases, the obsolete deselection claims are absent, local Markdown links resolve, `git diff --check` exits0, and only scoped documentation changed. Preserve prior audit/history references instead of erasing them.

## STOP conditions

Stop if live code/tests disagree on an interaction, if wording would promise unverified live ingestion/retention, or if resolving a conflict requires changing behavior. Report the discrepancy for a separate code decision.

## Maintenance notes

Update the canonical behavior table in the same change as future interaction changes. Avoid redundant expanded contracts in multiple docs; the README is a summary with a link.

## Execution outcome — 2026-10-23

Completed under the user's implementation authorization. See [integrated validation](025-implementation-log.md) and [staff implementation approval](024-implementation-review.md). Current source/tests supersede the baseline excerpts for future drift checks; optional product designs remain excluded. No publication or deployment occurred.
