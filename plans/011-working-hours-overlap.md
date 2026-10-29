# Plan 011: Plan configurable working hours and overlap comparison

## Status

- Category: direction/design; priority P3.
- Planned at: b77ff08, 2026-10-22.
- Status: DEFERRED — planning only, as explicitly selected by the user.
- Depends on the existing calendar/timeline model and validated storage/recovery layer.
- Repository: /Users/mohammed/Documents/Cursor/daybound-web-app.
- Worktree for future implementation: /Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app.

## Current state and intent

The user explicitly deferred implementation. `src/utils/timeline.ts` currently treats 07:00–19:00 as daytime; fixed25 elapsed-hour rail and exact timezone boundaries are explicit accepted constraints.

Daybound uses React18, bundled IANA timezone rules, Tailwind theme variables and localStorage. Existing Testing Library/Vitest patterns are in src/app/App.test.tsx and DatePicker.test.tsx. Retain device-local operation, keyboard focus, theme tokens and reduced-motion behavior.

## Proposed scope and design investigation

Add validated per-zone working windows and day-of-week selection through a small settings control, then render the overlap of working intervals across selected rows on the shared instant rail. Calculate intervals in each IANA zone on the selected calendar dates and convert to absolute instants through DST; do not compare local hour numbers across zones. Keep the default 07:00–19:00 behavior until the product contract is confirmed. A future discovery pass must settle overnight windows, split shifts, holiday support, inclusive/exclusive endpoints, repeated/nonexistent local times, which rows participate, and the UI for overlap. Produce an approved small UX spec and interval truth table before implementation.

Potential source scope, subject to a future approved implementation plan: src/utils/timezoneUtils.ts; src/utils/persistence.ts; src/utils/workingHours.ts (future); src/app/components/Timeline.tsx; src/app/components/WorkingHoursSettings.tsx (future); focused tests and docs.

## Steps for the future owner

1. Reconcile against current HEAD using git diff; read live validators/time helpers and `docs/maintenance-decisions.md`. Do not copy stale audit snippets as implementation.
2. Ask the unresolved product-policy questions above, with concrete examples and a recommended small initial contract. Do not assume answers or implement while questions are pending.
3. Write a self-contained final API/UX specification, schema migration and regression matrix; obtain staff review.
4. Only after explicit implementation authorization, use an isolated local worktree/branch, implement focused commits, and run the stated gates. No pushes, public issues/PRs or deployment.

## Test plan and verification criteria

Derive every row-local calendar date intersecting the absolute rail, not only the selected home date. Materialize all relevant local intervals and weekday schedules before computing overlap.

Intervals crossing midnight; zero overlap; all-day/full overlap; weekday/weekend differences; UTC/fractional offsets; DST missing/repeated hours with explicit policy; persistence migration preserving legacy default shading; instant-aligned overlap geometry and accessible descriptions. Run npm test/typecheck/lint/build and desktop/mobile browser flows once policy is approved.

For this planning deliverable now: the plan exists, defines data boundaries and deferred decisions, names dependencies and tests, and is marked DEFERRED in the index. No feature code/UI/data schema has been added for this plan.

## STOP conditions and maintenance

No accounts, payroll, calendar-provider integration, holidays or meeting booking without separate approval. Plan the data migration before adding UI fields. Coarse effort L; fix risk MED–HIGH.

Stop for missing product decisions, drift in storage/time contracts, unsupported schemas, privacy-impacting scope expansion, or two failed verification attempts. Never expose secrets or user data in diagnostics. Future code requires renewed explicit authorization; this task authorizes these two plan artifacts only.
