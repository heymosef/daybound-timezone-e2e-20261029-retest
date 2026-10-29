# Plan 010: Plan portable dashboard export and import

## Status

- Category: direction/design; priority P3.
- Planned at: b77ff08, 2026-10-22.
- Status: DEFERRED — planning only, as explicitly selected by the user.
- Depends on the existing validated storage/recovery layer in `src/utils/persistence.ts`.
- Repository: /Users/mohammed/Documents/Cursor/daybound-web-app.
- Worktree for future implementation: /Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app.

## Current state and intent

The user explicitly deferred implementation. Current App persists timezone_config/app_settings/local_save_notice_dismissed in localStorage; there is no import/export UI. Reuse the validated schema/migration layer in `src/utils/persistence.ts`.

Daybound uses React18, bundled IANA timezone rules, Tailwind theme variables and localStorage. Existing Testing Library/Vitest patterns are in src/app/App.test.tsx and DatePicker.test.tsx. Retain device-local operation, keyboard focus, theme tokens and reduced-motion behavior.

## Proposed scope and design investigation

Export a versioned JSON object containing validated timezone records and app display settings only. Exclude analytics identifiers/preferences, transient selected date, notices, logs and private credentials. Treat imported JSON as untrusted, enforce a small file-size limit, validate before any write, and present a preview with explicit Replace or Cancel. Keep current config unchanged on parse/validation failure; preserve order/labels and enforce one home. Do not silently accept newer unsupported schema versions. A later product decision should confirm whether Replace-only is sufficient or Merge is needed, whether a typed copy/paste path is useful, and the size limit. Do not implement these choices now.

Potential source scope, subject to a future approved implementation plan: src/utils/persistence.ts; src/utils/configTransfer.ts (future); src/app/components/SettingsMenu.tsx; src/app/components/ConfigTransfer.tsx (future); focused tests and README.

## Steps for the future owner

1. Reconcile against current HEAD using git diff; read live validators/time helpers and `docs/maintenance-decisions.md`. Do not copy stale audit snippets as implementation.
2. Ask the unresolved product-policy questions above, with concrete examples and a recommended small initial contract. Do not assume answers or implement while questions are pending.
3. Write a self-contained final API/UX specification, schema migration and regression matrix; obtain staff review.
4. Only after explicit implementation authorization, use an isolated local worktree/branch, implement focused commits, and run the stated gates. No pushes, public issues/PRs or deployment.

## Test plan and verification criteria

Import validation is stricter than tolerant storage recovery: validate the entire import/preview before replacing anything, report invalid records and require confirmation instead of silently accepting partially corrupt input.

Round-trip supported configurations; malformed/null/oversize/newer-version inputs; partial legacy migrations; exactly one home; no state mutation on error/cancel; export contains no analytics identity/transient state; keyboard and screen-reader error/preview flow. Run the established npm test/typecheck/lint/build gates, with offline browser file-import/export verification.

For this planning deliverable now: the plan exists, defines data boundaries and deferred decisions, names dependencies and tests, and is marked DEFERRED in the index. No feature code/UI/data schema has been added for this plan.

## STOP conditions and maintenance

Main trust boundary is browser file input and local state replacement. No backend, account system, cloud synchronization or sharing link is part of this proposal. Preserve local-storage fallback. Coarse effort M; fix risk MED.

Stop for missing product decisions, drift in storage/time contracts, unsupported schemas, privacy-impacting scope expansion, or two failed verification attempts. Never expose secrets or user data in diagnostics. Future code requires renewed explicit authorization; this task authorizes these two plan artifacts only.
