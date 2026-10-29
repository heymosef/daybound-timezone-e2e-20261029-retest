# Plan 020: Apply one label length policy before saving

## Status and execution contract

- Status: DONE; locally implemented, validated and staff-reviewed on2026-10-23.
- Priority: P2; effort: S; change risk: LOW; category: bug.
- Planned at: `b4100f9`, 2026-10-23.
- Depends on: 012; integrate after014 if it changes App mutation boundaries.
- Repository checkout: `/Users/mohammed/Documents/Cursor/daybound-web-app`.
- Assigned isolated worktree: `/Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app`.
- After implementation is requested, use the assigned isolated worktree and local commits only. Do not push, deploy, open PRs, change dashboards, or change global runtime/model settings. The primary integrator owns index status and final validation.

Read the whole plan first. Run `git diff --stat b4100f9..HEAD -- src/utils/labels.ts src/utils/labels.test.ts src/utils/persistence.ts src/utils/persistence.test.ts src/app/components/TimezoneRow.tsx src/app/components/TimezoneRow.test.tsx src/app/App.tsx src/app/App.test.tsx` and `git status --short`. Reconcile dependency edits against the excerpts and record expected differences. Stop for unexplained semantic drift, conflicting dirty work or an incomplete dependency; never overwrite someone else's work.

## Runtime, conventions and verification ownership

Use Node24 (`node --version` reports v24.x) and npm; run `npm ci` when dependencies are absent or the lockfile changes. Session-local alternative: `npm exec --yes --package=node@24 --package=npm@11 -- npm <arguments>`. Match React18 functional components, strict TypeScript, theme-token Tailwind classes and existing Testing Library/Vitest patterns. Never use real analytics credentials for verification.

Run focused checks below plus `npm run typecheck` and `npm run lint` for retained code changes (all exit0). The primary integrator owns one complete `npm test`, `npm run build` and browser-suite run on the final integrated candidate. A planning-only/no-change outcome needs document checks, not a redundant product rebuild. Do not confuse local results with remote CI or deployment.

## Scope

Only the following paths, this plan's execution notes and the integrator-owned index may change:

- `src/utils/labels.ts`
- `src/utils/labels.test.ts`
- `src/utils/persistence.ts`
- `src/utils/persistence.test.ts`
- `src/app/components/TimezoneRow.tsx`
- `src/app/components/TimezoneRow.test.tsx`
- `src/app/App.tsx`
- `src/app/App.test.tsx`

## Why this matters

The rename input accepts any nonempty text, but persistence drops optional text longer than1024 UTF-16 code units. A long pasted label appears saved and disappears after reload. Align input/action/parser boundaries while retaining existing valid labels.

## Current state and conventions

`src/utils/persistence.ts`:
```ts
const MAX_TEXT_LENGTH = 1024;
const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.length <= MAX_TEXT_LENGTH ? value : undefined;
```
`TimezoneRow.tsx` currently calls `onRename(config.id, editName.trim())` on blur/Enter if nonempty, without `maxLength` or an error. `App.tsx` accepts the supplied string. The parser deliberately retains valid rows when invalid optional label/city/country fields are discarded, and preserves existing whitespace in valid saved text. Match `src/utils/persistence.test.ts` boundary-style cases and the native editor/focus behavior from012. Custom text must never appear in analytics.

## Steps

1. Add a tiny shared text-contract module `src/utils/labels.ts`: an exported1024-code-unit persisted optional-text limit, and a label-edit validator/normalizer that trims accepted rename input, rejects an over-limit raw edit, and returns an explicit empty/cancel outcome. Define code units, not graphemes, to match current `.length` and native maxLength. Do not reduce the limit or trim legacy stored data. Reference the shared constant from persistence without changing city/country validation behavior. Write boundary tests for0/whitespace/1023/1024/1025, surrounding whitespace and surrogate-pair emoji. Verify `npm test -- src/utils/labels.test.ts src/utils/persistence.test.ts` passes.
2. Apply the shared policy at the App rename boundary before persistence/capture. Keep empty edits as no-op/revert, preserve the previous label on invalid input, and do not emit a success event for rejected edits. The row editor uses `maxLength` and the validator, with concise associated error text/`aria-invalid` for programmatic/IME over-limit values that reach save; don't silently truncate. If normal paste is limited natively, don't show a fake error unless a rejected value actually exists. Escape cancels cleanly, Enter commits once, blur cannot overwrite a cancelled/invalid edit, and closing the editor follows012 focus handling. Verify `npm test -- src/app/components/TimezoneRow.test.tsx src/app/App.test.tsx` and typecheck/lint exit0.
3. Add a reload regression: a1024-unit accepted label survives the real serializer/parser, a1025-unit attempted rename leaves the previous valid label intact, and analytics has neither rejected-success events nor label text. Check a very long label remains visually truncated and does not expand the row at390px using013's existing city-action flow or one recorded offline browser observation. Verify the named focused tests pass and browser observations are recorded.

## Done criteria

One shared length constant owns the UI/action/storage limit. Valid legacy labels/city/country text are preserved. Accepted edits survive reload; invalid edits are visibly rejected without data loss; empty/cancel behavior is unchanged. Focused tests/typecheck/lint exit0, no analytics text leaks, and no schema migration or arbitrary new label cap.

## STOP conditions

Stop if a lower product limit is desired, if trimming existing persisted text seems necessary, or if the browser cannot honor the stated input policy without a broader editor redesign. Do not change general persistence recovery while fixing rename validation.

## Maintenance notes

Import validation and future labels must consume the same contract. A future grapheme-count limit is a separate migration/product decision; never mix it with a UTF-16 storage cap silently.

## Execution outcome — 2026-10-23

Completed under the user's implementation authorization. See [integrated validation](025-implementation-log.md) and [staff implementation approval](024-implementation-review.md). Current source/tests supersede the baseline excerpts for future drift checks; optional product designs remain excluded. No publication or deployment occurred.
