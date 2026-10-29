# Plan 016: Recover an accidentally removed city with Undo

## Status and execution contract

- Status: DONE; locally implemented, validated and staff-reviewed on2026-10-23.
- Priority: P2; effort: M; change risk: MED; category: usability.
- Planned at: `b4100f9`, 2026-10-23.
- Depends on: 012 and014 for integration;013 for browser verification.
- Repository checkout: `/Users/mohammed/Documents/Cursor/daybound-web-app`.
- Assigned isolated worktree: `/Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app`.
- Implementation owner uses the assigned isolated worktree and local commits only after implementation is requested. Do not push, deploy, open PRs, change dashboards, or change global runtime/model settings. The primary integrator owns `plans/README.md` status and final validation.

Read this entire file before implementation. Run `git diff --stat b4100f9..HEAD -- src/app/App.tsx src/app/App.test.tsx src/app/components/TimezoneRow.tsx src/app/components/TimezoneRow.test.tsx src/app/components/UndoCityRemoval.tsx src/app/components/UndoCityRemoval.test.tsx tests/browser/city-actions.spec.ts docs/maintenance-decisions.md` and `git status --short`. Reconcile expected edits from the dependencies against the current-state excerpts; record that reconciliation in the handoff. Stop for unexplained semantic drift, unrelated dirty files in scope, or a dependency that is not complete. Do not overwrite someone else's work.

## Runtime, conventions and verification ownership

Use Node24 (`node --version` must report v24.x) and npm; run `npm ci` when dependencies are missing or the lockfile changes. A session-local invocation is `npm exec --yes --package=node@24 --package=npm@11 -- npm <arguments>`; do not change global defaults. Match React18 functional components, TypeScript strict mode, Tailwind theme variables, and existing Testing Library/Vitest patterns. Never use real analytics credentials for verification.

During implementation run the focused commands below, `npm run typecheck`, and `npm run lint` (all exit 0). The primary integrator runs `npm test` and `npm run build` once on the final integrated candidate, plus the browser suite once it exists. A plan's passing focused tests are not a claim that final integration passed. Failure requires investigation, not blanket retries or wider unrelated refactors.

## Scope

Only these paths may change, plus this plan's execution notes and the integrator-owned index:

- `src/app/App.tsx`
- `src/app/App.test.tsx`
- `src/app/components/TimezoneRow.tsx`
- `src/app/components/TimezoneRow.test.tsx`
- `src/app/components/UndoCityRemoval.tsx`
- `src/app/components/UndoCityRemoval.test.tsx`
- `tests/browser/city-actions.spec.ts`
- `docs/maintenance-decisions.md`

## Why this matters

`handleRemoveTimezone` immediately filters and persists the list. Re-adding a city loses its custom label and position. A one-level Undo should restore that row without adding a confirmation dialog to every removal.

## Current state and conventions

`src/app/App.tsx` currently has:
```tsx
const handleRemoveTimezone = useCallback((id: string) => {
  const updated = timezones.filter(tz => tz.id !== id);
  setTimezones(previous => previous.filter(row => row.id !== id));
  capture("timezone_removed", { timezone_count_after: updated.length });
}, [capture, setTimezones, timezones]);
```
Home-row remove is not exposed. Rows carry stable id/timezone/label/city/country/isHome; do not regenerate them on restore. Match App's local-save notice: `role="status"`, theme tokens, native focusable buttons and concise text. Existing `App.test.tsx` uses `userEvent`/localStorage and fake clock scenarios; follow its local cleanup conventions. By integration,014 must expose an external storage revision/invalidation signal; use it only to cancel stale Undo, never to replay external edits.

## Product contract

Keep one undoable removal in memory for10 seconds. A second removal replaces it. Represent hover, focus-within and document-hidden as an overlapping set of pause reasons. Pause while any reason exists; clearing one must not resume while another remains. Measure elapsed/remaining duration with performance.now(), not Date.now() (the fixture freezes wall time). Resume only the remaining duration, not a new full window. A second removal starts its own10-second budget while preserving active environmental pause reasons. Reload clears it. No restored row becomes home automatically. Undo should not change the selected instant, scrubbed rail or chosen home. A compact notice reads “City removed.” with an Undo button and an accessible city-specific description; render the actual city label as React text only.

Save the removed row and neighboring stable IDs, plus its old index. Restore before the surviving following neighbor, otherwise after the surviving preceding neighbor, otherwise clamp the original index. Preserve other intervening edits. If that ID or exact timezone string was re-added, clear the pending Undo and announce “City is already added” without duplicates. Match existing exact-identifier duplicate policy; do not introduce canonical-alias deduplication here. External config divergence revisions/conflicts invalidate the notice immediately, before any adoption; a blocked-storage visit still supports in-memory Undo. Do not emit a new analytics event or transmit the label; existing removal events retain their meaning as actions.

## Steps

1. Add focused failing App tests for removal/restoration of label, stable id and order, second-removal replacement, duplicate re-add, home change and selected/browsed time preservation. Add immediate Undo during animated exit, focused-notice external invalidation, duplicate re-add while Undo is focused, and pointer removal with unrelated focus. Verify `npm test -- src/app/App.test.tsx -t 'Undo city removal'` fails on the intended missing feature. Keep the new tests under that describe name.
2. Implement transient removed-row metadata and a small `UndoCityRemoval` component. Removal/restore updaters stay pure; timers/listeners belong to effects with cleanup and respect StrictMode. Explicitly reject home-row removal at the handler boundary. Add the smallest typed callback-ref registration from TimezoneRow's rename button to an App-owned map keyed by stable row ID; the map must register current mounted buttons and remove only its own registration on cleanup. Keep a pending focus request serviced after the restored row commits and is present in the current configuration; never query by city text or focus an outgoing animated row. On keyboard removal when the removed control owned focus, focus Undo. Pointer removal with focus elsewhere must not steal focus. Successful Undo focuses the restored current rename trigger. For external invalidation, duplicate re-add or second-removal replacement, if the disappearing notice action currently owns focus, move it to the current home row's registered rename button (otherwise the first surviving row; last fallback is an App main ref with tabIndex=-1). If focus is elsewhere, leave it alone. Normal expiry cannot unmount a focused notice because focus is a pause reason. Verify App/notice tests, typecheck and lint exit0.
3. Add browser checks for one click/keyboard removal, Undo, saved reload, focus visibility, no popup overlap at390px, and external-tab invalidation. Reuse013's harness; do not expand its initial smoke suite with redundant scenarios. Verify `npm run test:browser -- tests/browser/city-actions.spec.ts` exits0 and record keyboard/mobile-emulation limits.

## Test plan and done criteria

- Unit/component tests cover10-second timeout, remaining-duration hover/focus/hidden pause, overlapping pause reasons, replacement while paused, StrictMode/unmount cleanup, cancellation, duplicate policy, original neighbor disappearance and stable original data restoration. Advance a controlled monotonic performance clock in tests; frozen fixture Date.now is not timing evidence.
- Quota failure preserves in-memory operation and a truthful save notice; Undo never resets live/fixed/selected timeline state.
- Other-tab revision clears Undo; restoration cannot resurrect a row removed externally. Only the most recent removal is recoverable.
- Focused tests/typecheck/lint/browser flow exit0. One status notice and one Undo target appear; no persistent Undo state or extra analytics fields are introduced.

## STOP conditions

Stop if restoring requires changing home-normalization rules, if the storage conflict API has not settled, or if hidden-tab timers cannot meet the stated pause contract. Do not grow this into multi-step history, a generic notification framework or delete confirmations.

## Maintenance notes

Review neighbor positioning whenever row-order semantics change. Invalidate the undo token if import/replace is later added. New city identity/alias policies need a separate decision; this plan follows current exact timezone-string behavior.

## Execution outcome — 2026-10-23

Completed under the user's implementation authorization. See [integrated validation](025-implementation-log.md) and [staff implementation approval](024-implementation-review.md). Current source/tests supersede the baseline excerpts for future drift checks; optional product designs remain excluded. No publication or deployment occurred.
