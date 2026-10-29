# Plan 021: Design a concise copyable time comparison

## Status and execution contract

- Status: OPTIONAL DESIGN; planning is authorized, implementation is not started.
- Priority: P3; effort: S–M; change risk: LOW–MED; category: direction.
- Planned at: `b4100f9`, 2026-10-23.
- Depends on: 013 before any implementation; design can run independently.
- Repository checkout: `/Users/mohammed/Documents/Cursor/daybound-web-app`.
- Assigned isolated worktree: `/Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app`.
- After implementation is requested, use the assigned isolated worktree and local commits only. Do not push, deploy, open PRs, change dashboards, or change global runtime/model settings. The primary integrator owns index status and final validation.

Read the whole plan first. Run `git diff --stat b4100f9..HEAD -- plans/021-copy-comparison-design.md` and `git status --short`. Reconcile dependency edits against the excerpts and record expected differences. Stop for unexplained semantic drift, conflicting dirty work or an incomplete dependency; never overwrite someone else's work.

## Runtime, conventions and verification ownership

Use Node24 (`node --version` reports v24.x) and npm; run `npm ci` when dependencies are absent or the lockfile changes. Session-local alternative: `npm exec --yes --package=node@24 --package=npm@11 -- npm <arguments>`. Match React18 functional components, strict TypeScript, theme-token Tailwind classes and existing Testing Library/Vitest patterns. Never use real analytics credentials for verification.

Run focused checks below plus `npm run typecheck` and `npm run lint` for retained code changes (all exit0). The primary integrator owns one complete `npm test`, `npm run build` and browser-suite run on the final integrated candidate. A planning-only/no-change outcome needs document checks, not a redundant product rebuild. Do not confuse local results with remote CI or deployment.

## Scope

Only the following paths, this plan's execution notes and the integrator-owned index may change:

- `plans/021-copy-comparison-design.md`

## Why this matters

People already select a shared instant and see every city's corresponding date/time. A copyable summary could complete the workflow from comparing a time to communicating it. This is optional product work, not a defect or an instruction to add UI now.

## Current state and constraints

`App.tsx` derives the common instant as `view?.selected` and passes `clockTime` to every row. Date selection also establishes a selected instant. The existing accessible status says all city clocks show this moment. There is no copy/share/export action. Existing helpers `getZonedFields`, `formatCalendarDate`, `formatZonedClock` and `utcOffsetLabel` use bundled rules and exact offsets; use those rather than browser timezone rules. `Timeline` can represent repeated hours and fractional offsets, so a shared local hour string alone is ambiguous.

## Proposed small contract for design review

Offer a “Copy time comparison” action only when there is a selected instant (including the automatic selection from choosing a future date). Recommended initial placement: a compact Settings action, disabled with a short accessible explanation when no instant is selected; validate its discoverability before implementation. Copy plain text with one line per displayed city in current order: visible row label, full local date including year, formatted local time respecting12/24h, and numeric UTC offset. A header may identify the home reference date/time; avoid redundant headers if lines already suffice. Example format only: `Toronto — Tue, Nov 3, 2026, 12:00 PM (UTC−05:00)`. All rows use the same captured instant at click time.

Custom labels may be included in an explicit local clipboard action because they are what the user chose to share. Never transmit the clipboard payload to analytics. No automatic copy, external message, calendar invite, duration, public link, account or backend is part of this proposal. If Clipboard API is unavailable/denied, show a small selectable-text fallback with honest “Copy manually” feedback; don't claim success. Keep focus, live-region status and mobile fit accessible.

## Steps and design verification

1. Produce `plans/021-copy-comparison-design.md` with exact sample output for12/24h, labels, different local dates/years, DST repeated hour and fractional offsets. Include empty/no-selection behavior, selected-date automatic selection, and the proposed placement. Identify any user decision still needed (in particular custom labels/output/placement); show recommendations before asking. Verify `git diff --check` exits0 and every sample lists its exact instant plus expected per-zone date/offset from the existing bundled helpers; no source edits.
2. Specify a future pure formatter and small UI boundary. Proposed future source scope (not authorized in this design plan): `src/utils/comparisonText.ts` + tests; `src/app/App.tsx`; `src/app/components/SettingsMenu.tsx` + tests; a focused browser flow and docs. Avoid a generic sharing framework. Specify tests for stable order, label escaping as text, captured exact instant, repeated/fractional hours, cross-date/year, Clipboard rejection and fallback keyboard focus. Verify the design has a concrete expected-output table and no credential/report/external-service requirement.
3. Obtain product acceptance of placement/output and update this plan with a separately approved implementation scope and test commands. Future gates: `npm test -- src/utils/comparisonText.test.ts src/app/components/SettingsMenu.test.tsx src/app/App.test.tsx`, typecheck/lint, then013 browser copy success/denied flow and integrator-owned full gates. Until that acceptance, mark this optional item DESIGN READY, not implemented.

## Done criteria

The design file exists, examples are checked against exact instants and bundled offsets, privacy/data boundaries and failure/focus behavior are explicit, and unresolved decisions are listed with recommendations. No clipboard access, product code, analytics event or external message is produced by this planning task.

## STOP conditions and maintenance

Stop if this expands into calendar-provider integration, automatically sharing private labels, or sending copied contents to analytics. Future changes to date/offset formatting must retain unambiguous shared instants and accompanying tests.
