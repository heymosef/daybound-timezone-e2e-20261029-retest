# Plan 012: Make city controls usable and visible with a keyboard

## Status and execution contract

- Status: DONE; locally implemented, validated and staff-reviewed on2026-10-23.
- Priority: P1; effort: S; change risk: LOW; category: accessibility.
- Planned at: `b4100f9`, 2026-10-23.
- Depends on: none.
- Repository checkout: `/Users/mohammed/Documents/Cursor/daybound-web-app`.
- Assigned isolated worktree: `/Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app`.
- Implementation owner uses the assigned isolated worktree and local commits only after implementation is requested. Do not push, deploy, open PRs, change dashboards, or change global runtime/model settings. The primary integrator owns `plans/README.md` status and final validation.

Read this entire file before implementation. Run `git diff --stat b4100f9..HEAD -- src/app/components/TimezoneRow.tsx src/app/components/TimezoneRow.test.tsx src/app/components/SettingsMenu.tsx src/app/components/SettingsMenu.test.tsx src/app/App.test.tsx` and `git status --short`. Reconcile expected edits from the dependencies against the current-state excerpts; record that reconciliation in the handoff. Stop for unexplained semantic drift, unrelated dirty files in scope, or a dependency that is not complete. Do not overwrite someone else's work.

## Runtime, conventions and verification ownership

Use Node24 (`node --version` must report v24.x) and npm; run `npm ci` when dependencies are missing or the lockfile changes. A session-local invocation is `npm exec --yes --package=node@24 --package=npm@11 -- npm <arguments>`; do not change global defaults. Match React18 functional components, TypeScript strict mode, Tailwind theme variables, and existing Testing Library/Vitest patterns. Never use real analytics credentials for verification.

During implementation run the focused commands below, `npm run typecheck`, and `npm run lint` (all exit 0). The primary integrator runs `npm test` and `npm run build` once on the final integrated candidate, plus the browser suite once it exists. A plan's passing focused tests are not a claim that final integration passed. Failure requires investigation, not blanket retries or wider unrelated refactors.

## Scope

Only these paths may change, plus this plan's execution notes and the integrator-owned index:

- `src/app/components/TimezoneRow.tsx`
- `src/app/components/TimezoneRow.test.tsx`
- `src/app/components/SettingsMenu.tsx`
- `src/app/components/SettingsMenu.test.tsx`
- `src/app/App.test.tsx`

## Why this matters

City rename is currently a clickable non-focusable div. Desktop move/home/remove controls are hidden until pointer hover although their native buttons can receive Tab focus. The small-screen Home City select has no associated accessible name. These are source-confirmed barriers; screen-reader speech still needs a human check.

## Current state and constraints

`src/app/components/TimezoneRow.tsx` has:
```tsx
<div className="hidden md:flex opacity-0 group-hover:opacity-100 ...">
// ...
<div className="flex items-center gap-[0.5em] cursor-pointer group/name"
  onClick={() => { setEditName(cityName); setIsEditing(true); }}>
```
The absolute desktop action wrapper additionally has `pointer-events-none group-hover:pointer-events-auto`. In `SettingsMenu.tsx`, Home City is a plain div above an unlabelled select. Match the existing Settings test style:
```tsx
const user = userEvent.setup();
toggle().focus();
await user.keyboard(" ");
expect(toggle()).toHaveAttribute("aria-checked", "false");
```
Keep the current 768px/1024px behavior, themes, city clocks, soft selected band, and timeline interaction. This plan must not change saved labels, schemas or analytics properties. Do not broaden this into a whole-menu semantics rewrite.

## Steps

1. Add `TimezoneRow.test.tsx` with minimal typed row props and spies. Write failing tests that reach rename with Tab and activate it with Enter/Space; save with Enter/blur and cancel with Escape. Verify: `npm test -- src/app/components/TimezoneRow.test.tsx` fails for the intended keyboard barrier before the fix.
2. Replace the rename trigger with a native `button type="button"`, preserving the visual text/badge layout and adding a city-specific accessible action name and theme-token focus ring. Give the inline editor a city-specific name. Make focus handling depend on the exit reason: Enter-save and Escape-cancel return focus to the rename trigger; blur-save preserves the destination of Tab or a pointer click and must not pull focus back. Track cancellation/commit so the subsequent blur cannot save an Escape-cancelled draft or commit twice. Both mouse and keyboard must commit once. Add `group-focus-within:opacity-100` to hidden action wrappers and `group-focus-within:pointer-events-auto` where applicable. Make move/remove/home names identify the city. Preserve home-row restrictions and DOM/tab order; don't add another duplicate focusable desktop/mobile control at the same breakpoint. Verify the row tests pass and `npm run typecheck` exits 0.
3. Associate a real Home City label and select using a stable React `useId()` value, preserving display styles. Add a Settings test using `getByRole("combobox", {name: "Home City"})` and keyboard selection. Update exact-name expectations affected by the improved row names only. Verify: `npm test -- src/app/components/TimezoneRow.test.tsx src/app/components/SettingsMenu.test.tsx src/app/App.test.tsx` passes; `npm run lint` exits 0.

## Test plan and done criteria

- Row test structure follows `src/app/components/SettingsMenu.test.tsx`; App behavior checks follow `src/app/App.test.tsx`. Clean timers/mocks locally.
- Cover Enter/Space rename, Escape draft cancellation including subsequent blur, one commit per action, empty-name behavior, and row-specific action names. Explicitly test Tab/Shift+Tab out of the editor and clicking another button: blur commits once and focus stays at the intended destination; Enter/Escape restore focus to rename. Do not change the length policy here (Plan020 owns it).
- Browser owner must Tab at 1280px and 390px, assert the focused control and its ancestor have visible opacity and an unobscured focus ring, invoke move/home/remove, and ensure the clock/rail are not hit-area blocked. Plan013 adds an automated version when available; record an actual offline manual check if013 is not ready.
- Done: focused tests/typecheck/lint exit 0, the browser observations are recorded, and only in-scope files changed. A class-name assertion alone cannot establish visible keyboard access.

## STOP conditions

Stop for an unexpected change to timeline selection, home-row restrictions or analytics; for a need to redesign menu semantics; or after two unsuccessful targeted repair attempts. If event ordering makes Escape commit a draft, resolve it within this editor before proceeding rather than suppressing blur globally.

## Maintenance notes

Review both pointer-hover and focus-within visibility when changing row layout. Keep accessible names and keyboard tests synchronized with label edits. Coordinate `TimezoneRow.tsx` with Plan020; integrate012 first.

## Execution outcome — 2026-10-23

Completed under the user's implementation authorization. See [integrated validation](025-implementation-log.md) and [staff implementation approval](024-implementation-review.md). Current source/tests supersede the baseline excerpts for future drift checks; optional product designs remain excluded. No publication or deployment occurred.
