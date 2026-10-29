# Nine existing-app improvements: implementation and validation

User authorized implementation of012–020 on2026-10-23 in the assigned isolated worktree, with local commits and GPT-6 Astra/High senior staff review. Baseline: b4100f9. Optional021/022 and deferred010/011 are excluded. No push, deployment, external dashboard, live analytics credentials or global runtime/model changes.

## Implementation record

- 019: corrected canonical clock/rail/calendar interaction table; live analytics/deployment claims explicitly unverified. Added current cross-tab/reload and Undo contract.
- 012: native named rename buttons, focus-visible row actions, associated Home City label, reason-aware Enter/Escape vs blur completion and duplicate-save guard.
- 013: exact Playwright dev dependency, strict offline Chromium desktop/narrow smoke suite, test-runner/type isolation, contained owned fixture server and both CI validation paths. Initial owner run16/16; final integration adds real two-page storage and city-action flows.
- 015: deterministic timezone status classifier and20 offline Node tests; daily/manual read-only workflow. Owner's one live check passed2026e/2026e. Workflow remains local and unactivated; notification delivery was not verified.
- 014: strict external decoders with tolerant initial recovery, raw preflight/preview tokens, explicit per-key adoption/replacement, candidate preservation and no automatic synchronization. Primitive owner94 tests passed. Closing/reloading discards in-memory recovery; simultaneous storage writes remain last-writer-wins.
- 020: one1024-code-unit text limit, raw edit validation at editor/action/storage boundaries, native maxLength and associated errors; accepted legacy data preserved.
- 016: one-level removal Undo preserving row identity/data/neighbor order/chosen home/time,10-second monotonic budget with overlapping pauses, stable current-row focus handles and external/duplicate invalidation.
- 017:18 actual active10-second representative/stress samples at390/1280, p95rAF16.7–16.8ms. No optimization gate met; retain current product implementation. Stress native input cadence was lower and is reported as a limitation. Separate React diagnostic profile is not mixed with timing samples. See017 measurement record.
- 018: matched18 baseline/candidate cold samples show1.63–6.97% faster font readiness, zero layout shift and no regression;16 exact official WOFF2 subsets remove external font requests. Provenance/license/checksum/Unicode coverage and browser glyph/fallback/base-path checks are owned by the measurement executor; all completed checks and limits are recorded in018-font-measurements.md.

## Staff findings and reconciliation

First bounded implementation review (024) requested two fixes. Both were applied: first city after explicit clear is home at the live functional-updater boundary; conflict reload warning is unconditional. Root also suppressed the generic saved-success notice during conflicts to avoid contradicting recovery warnings. Added clear→add→home/non-removable→reload regression, actual home-change-before-Undo test, focused duplicate invalidation and quota+Undo cases. Root's focused four-file run passed27 tests after fixes. First focused browser integration run passed8/10; two focus-ring assertions were corrected to enter keyboard modality before checking :focus-visible, rather than treating pointer/programmatic focus as keyboard input. No product workaround was introduced; final suite will verify the correction.

The017 baseline preceded these inactive-path corrections. Its seeded nonempty/conflict-free workload does not execute the changed branches; the measurement record retains its original source fingerprint.018 starts from the revised frozen source and will compare matched candidate builds. Any timing claim applies to the recorded environment, not physical mobile hardware.

## Validation ownership and limits

Focused checks belong to area owners. Root owns one complete final typecheck/lint/Vitest/build/Node-checker/browser run on the integrated candidate, with any failed or changed areas rechecked only as justified. Final integrated results and staff delta approval are recorded below; earlier focused results remain historical evidence.

Physical touch, Safari, screen-reader speech, remote CI, scheduled notification activation/delivery and live PostHog ingestion/dashboard reports were not exercised. No routine screenshots are part of this task. Existing user preview is preserved until a final local build can refresh it.

## Final integrated validation

- Node24 typecheck: passed. Initial attempt caught two unsupported Testing Library `exact` options; removing those redundant test-only options left behavior unchanged and the targeted typecheck rerun passed.
- Full ESLint: passed with zero warnings.
- Full Vitest:517/517 tests across29 files passed.
- Production Vite build: passed with both public analytics environment variables explicitly empty; retains only the documented full-IANA large-chunk warning.
- Node built-in timezone checker suite:20/20 passed. Owner's one live read matched2026e/2026e; no repeat external request.
- Font assets:16 WOFF2 subsets, original CSS coverage/style declarations, hashes and three OFL licenses verified.
- Full Chromium suite:28/28 passed in41.7s across1280px/390px projects, including320px calendar subcase, two real tabs, explicit conflict choices, invalid/cleared/quota handling, empty-to-first-home, long unbroken previews/labels, focus-visible city actions, Undo/focus/invalidation, fonts, dates/scrubbing/DST and fake analytics cancellation.
- Font owner:24/24 paired rendering/fallback samples and16 official download hashes matched; allthree designs passed nested base-path check; final matched36 cold samples showed1.63–6.97% readiness improvement, CLS0, no external candidate requests, same source fingerprint. One FCP observation was unavailable; font readiness is the primary measured result.
- npm audit:0 vulnerabilities.
- Staff final delta review: APPROVE, GPT-6 Astra/High; no remaining blockers or optional-feature scope.024 preserves initial findings and reconciliation.
- Local preview: existing Python process on127.0.0.1:4180 preserved; HTTP200 after refreshed build. All test/measurement-owned servers stopped.

Local-only result. The daily timezone workflow is prepared in Git but was not remotely activated or dispatched; notification delivery depends on later publication/account subscriptions. No source tests/builds were repeated merely for status/commit boundaries. The only repeat checks addressed a demonstrated failure or changed candidate. Routine screenshot output was omitted.

### Vendored text handling

Staging exposed original trailing spaces/CRLF in the three upstream OFL files. Their bytes remain unchanged and checksum-verified. A narrowly scoped .gitattributes entry disables newline conversion and authored-whitespace rules only for public/fonts/*-OFL.txt, preserving portable license checksums without suppressing checks on application/source documentation. No global Git setting changed. Final staged diff whitespace and index/license checksum checks pass.

## City-removal toast follow-up — 2026-10-23

User requested a toast with the removed city's name and Undo. The recovery component now floats at bottom center, respects viewport safe areas, uses opaque theme tokens, truncates long labels, and keeps the Undo target separate. Its outer positioning layer passes pointer input through; the toast itself remains interactive. The existing timer, pause reasons, stable action ref, recovery and focus behavior are unchanged. No new toast dependency/framework or animation was added.

Focused validation:15 Undo/App tests passed,4 desktop/narrow city-action browser tests passed (including fixed positioning and viewport bounds), typecheck/scoped lint/production build passed. GPT-6 Astra/High approved the bounded presentation delta in024. The local preview build is refreshed; no push/deployment occurred.

## Toast corner and entrance follow-up — 2026-10-23

User requested a slide-in like the referenced shadcn toast and bottom-right placement to avoid covering the footer logo. The existing fixed safe-area wrapper now aligns right. A220ms ease-out entrance combines opacity with16px right-to-left movement, contained inside the existing minimum16px right margin. Motion is opt-in via prefers-reduced-motion:no-preference; reduced motion renders the toast immediately. There is no exit delay, replay on content replacement, new dependency or timing/focus/action change.

Validation passed:15 focused Undo/App tests;6 desktop/narrow browser checks including corner geometry and normal/reduced motion; typecheck, scoped lint and production build. The first reduced-motion test attempted to pointer-click a desktop hover-only control; the test now uses the same keyboard activation as the existing city-action checks. No product workaround was introduced. GPT-6 Astra/High approved the bounded delta in024. Preview refreshed; changes remain local.

## Toast auto-dismiss and exit follow-up — 2026-10-23

User requested dismissal after a few seconds and a slide-out. The removal toast now has a five-second monotonic budget and a150ms rightward fade/slide exit using the existing Motion presence boundary. Reduced motion removes it immediately. Hover, keyboard focus and hidden-page pauses still overlap safely; pointer removal returns focus to a surviving row rather than auto-focusing Undo and indefinitely pausing the toast. Keyboard removal keeps Undo focus. Exiting content is inert, hidden from assistive technology and disabled; replacement during exit cancels its removal timer and resets the recovery budget without retaining obsolete hover/focus pauses.

Validation:26 focused component/app tests passed; all8 city-action browser cases passed across desktop and narrow layouts, including actual pointer auto-dismiss and the exit animation. Typecheck, scoped lint and analytics-disabled production build passed. The final strengthened focused-old-toast replacement regression was also checked separately. Existing full-IANA bundle-size warning remains. Local preview uses the rebuilt dist at http://127.0.0.1:4180/. No external changes.
