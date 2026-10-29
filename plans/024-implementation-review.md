# Staff implementation review

Reviewed 2026-10-23 using GPT-6 Astra, High effort, against baseline `b4100f9` and the uncommitted maintenance candidate in the assigned isolated worktree.

**Latest verdict: APPROVE.** The bounded final delta review below resolves the initial findings and accepts the completed nine-plan maintenance candidate. The initial review is retained as history.

## First bounded core review

**Initial verdict: REQUEST CHANGES (superseded).** Two actionable integration findings remained in that reviewed snapshot. The integrator acknowledged both and owned their fixes. Final approval awaited a bounded review of those fixes, the pending browser integration coverage, Plans017/018 outcomes, and the integrator's final validation record.

Scope: read AGENTS.md, the plan index, Plans012–020 and the approved023 review; inspect changed/new application source, persistence and label validation, focused tests, browser harness, timezone checker/workflow and documentation. Plans017/018 measurement/source work was still active and is excluded from this core verdict. No optional/deferred feature is approved by this review.

No product source was edited, no test/build suite was duplicated, and no external service, deployment, global setting or repository publication was changed. Findings below follow actual state transitions in source rather than assuming passing author tests establish correctness. This review writes only this report.

### R1 — P2: Assign a home when adding the first city after accepting an empty setup

**Reference:** `src/app/App.tsx:221–229`, `handleAddTimezone`.

Plan014 makes an empty city list an explicitly accepted, reachable state. After accepting `[]` or a cleared city key, adding a city creates it with `isHome:false` unconditionally. App then uses that city as its home through `homeTimezone`'s first-row fallback, but the row lacks the home presentation, exposes Remove, and the Settings Home City select is controlled with an empty value. Reload normalizes the same saved row to home, so the interface and persisted semantics disagree until reload.

**Fix:** choose the new row's home flag from the live `previous` list inside the pure add updater: the first newly added city should be home; adding to a nonempty list should preserve the selected home. Preserve the explicitly accepted empty state until the user actually adds a city. Add an accept-clear/empty → add first city → assert correct home and no Remove → reload regression.

### R2 — P2: Warn about losing a candidate even after its write previously succeeded

**Reference:** `src/app/components/StorageConflictNotice.tsx:19`.

The notice says closing/reloading discards this version “if it has not been saved.” In the race Plan014 explicitly protects, this tab's write succeeds, another tab subsequently overwrites it, and the losing tab retains its candidate only in memory. Its user has already saved, yet reload still discards the candidate. The qualification undermines the recovery warning precisely in the successful-write race case.

**Fix:** warn unconditionally while the conflict is unresolved, for example: “Closing or reloading before resolving this difference discards this tab's version.” Reconcile README/maintenance documentation with the same explicit-resolution, last-writer-wins and in-memory/reload limits. The integrator is already preparing that documentation.

## Confirmed source guarantees

- The storage hook retains the current local candidate on external divergence, including after a successful write; conflicting local edits remain in memory with writes suspended. Storage events re-read actual storage rather than trusting event payload order. Normal writes have a raw-value preflight; both resolution actions re-read and compare the displayed preview, including rejecting callbacks from obsolete previews. Explicit adoption clears pending writes without writing the adopted value back. The non-atomic last-writer limitation remains real and is not hidden by the implementation.
- External decoders reject invalid complete payloads while initial loading retains tolerant partial recovery. Recognized partial settings, valid empty arrays, optional fields, exact duplicate rules, unavailable reads and explicit absent values follow the selected policy. The hook tests contain meaningful controlled two-writer and stale-preview cases.
- Rename uses a native trigger and distinguishes Enter/Escape restoration from blur. A synchronous editing guard prevents duplicate save/cancel handling; invalid over-limit drafts do not reach App persistence. Shared UTF-16 limits preserve existing stored-text behavior. The Home City select has an associated label.
- Undo restores the original row data against the current list, using surviving neighbor IDs and then the old index. It preserves the newly chosen home by marking only the restored row non-home. A conflict/revision invalidates recovery before adoption, with focused-action fallback. Callback-ref cleanup removes only its own registration. Timer bookkeeping uses a monotonic clock and an overlapping set of hover/focus/hidden reasons; token replacement resets the budget without dropping environmental pauses.
- The timezone check separates review-needed from unavailable results, uses a fixed endpoint with a timeout, recognizes multi-letter version suffixes, and does not update dependencies/data. Its workflow is bounded and read-only, with pinned Actions, offline classifier tests and one live check. Local preparation does not establish remote activation or notification delivery.
- Playwright and Vitest discovery are separated, browser types participate in typechecking, fixture serving is confined to the generated directory, and both existing CI paths run browser checks before production output is published. The fixture harness blocks unexpected external requests and keeps the known baseline font exception narrow. The documented deselection behavior matches App's independent clock/rail state.

## Required follow-up evidence

The root integrator confirmed that `tests/browser/storage.spec.ts` and `city-actions.spec.ts` were actively being added during this review. Their absence in the initial snapshot is therefore not a separate finding against the finished candidate. Review the finished tests and results in the next pass: real same-origin two-page reconciliation, retained local candidate/replacement, Undo and invalidation, actual keyboard focus/opacity, and narrow-layout behavior. A 16/16 result for the original eight smoke flows alone does not establish these new integrations.

Correct the home-preservation assertion in `src/app/App.maintenance.test.tsx:63–69`: it currently changes home **after** Undo, which cannot verify the stated guarantee. Change home before invoking Undo and assert the exact surviving home ID/order. Complete the bounded duplicate-re-add/focus and blocked/quota-save Undo cases from Plan016, plus the new R1 regression; those cases exercise integration that isolated timer/hook tests do not cover.

The final delta review should inspect only the fixes, newly completed coverage, measurement outcomes and any resulting source/font changes. The integrator owns the complete final typecheck/lint/test/build/browser gates. Physical touch, Safari, screen-reader speech and remote workflow/notification delivery remain unverified unless separately exercised and recorded.

## Final delta review — 2026-10-23

**Verdict: APPROVE. No remaining actionable blocker found in the reviewed candidate.** This pass inspected the two fixes, the related save-status correction, completed App/browser coverage, the small long-label layout correction, local font delivery/verification, and the017/018 measurement methods and evidence. It did not repeat the original audit or the integrator-owned full validation.

| Item | Reconciliation |
| --- | --- |
| R1: first city after accepting empty setup | Resolved. The functional add updater uses the current list length to make only the first added city home. App and real-browser regressions accept a cleared list, add a city, assert home/non-removability and retain that behavior after reload. |
| R2: conflict reload warning | Resolved. The conflict notice now warns unconditionally about losing this tab's version before resolution. README and maintenance decisions document successful-write races, explicit resolution, last-writer-wins storage and in-memory/reload limits. |
| Generic saved-success notice during conflicts | Resolved. Suppressing that success notice while any managed group has a conflict aligns with the selected policy. The separate saving-unavailable notice remains visible, and an App assertion guards the contradiction. |
| Undo integration evidence | Resolved. The home-change test now changes home before Undo and asserts the exact home ID and restored order. Additional tests cover focused duplicate re-add and quota-failure Undo. Real-browser tests cover visible keyboard removal, focused Undo, restored saved order/selected instant, and genuine other-page divergence invalidation. |
| Storage browser integration | Completed. Same-profile pages share storage without reseeding the second page; tests exercise explicit adoption in both directions, preserved local display, explicit replacement of invalid data, cleared-state adoption, quota failure and long external-label previews. Deterministic hook tests continue to own simultaneous-race and stale-preview proof. |
| Long-label layout | Accepted. The mobile first grid track becomes `minmax(0,1fr)` and its information item permits shrinking; conflict previews wrap unbroken text. The changes directly support the existing1024-unit/international label contract and add no new feature. Browser cases assert page containment for1024-unit and multilingual labels. |

### Measurement and font decision

Plan017 is correctly **INVESTIGATED—NO CHANGE**. Its frozen-source18 samples have continuing rail activity, a recorded nominal input path and actual cadence, monotonic timing and p95 rAF16.7–16.8ms. The representative workload does not cross the preselected25ms gate. The record expressly avoids treating the lower stress-driver cadence as proof of60Hz capacity, keeps the diagnostic React profile separate, and does not claim a speedup for later product/font changes. No speculative product optimization was retained.

Plan018's retained self-hosting satisfies its evidence gate. The final baseline override restores the original import/preconnects while sharing current product code with the candidate. Both builds disable environment-file loading and analytics constants; samples seed the intended design before first navigation. The final record contains18 baseline and18 candidate cold-context samples after the row/wrapping corrections. Ready-time medians improve1.63–6.97% with CLS0; the report correctly calls the smallest difference potentially ordinary noise and emphasizes the verified removal of external font requests and offline resilience.

Independently inspected the saved measurement data without rerunning benchmarks: both final font runs have `unchanged:true`, the same `f635bbccff36ab9f980c54a1ee09c1fe277550427b5ffa0d7da2f594a0f88881` input fingerprint, no rejected/failed requests, and CLS0. Baseline samples each record two external requests; candidate samples record zero. Every file hash in that manifest matches the final product inputs inspected here. The saved glyph comparison contains24 exactly equal baseline/candidate records and confirms all official binary hashes match. The scrubbing record contains18 samples and its documented unchanged original fingerprint.

Reviewed the16 unmodified official WOFF2 subset declarations, distribution/source/license manifest, bundled OFL records, hash/coverage verifier, real glyph/fallback diagnostic and nested-base checker. The314,680-byte binary set preserves original Unicode ranges/weights and loads subsets on demand. Actual rendered glyph/fallback records supplement metadata; system fallback for uncovered scripts is retained. Production URLs are base-aware, and the fixture explicitly copies manifest-listed runtime files while retaining `publicDir:false`, strict CSP and an external-request guard with no old Google-font exception. No new runtime font dependency or product profiling instrumentation was introduced.

### Final validation and boundaries

The primary integrator reported the following final-candidate results after the inspected fixes: typecheck PASS; lint PASS; Vitest517/517 PASS; production build PASS with the pre-existing large-IANA-chunk warning; offline timezone checker20/20 PASS; font verifier16files PASS; npm audit0 advisories; complete Chromium desktop/narrow suite28/28 PASS in41.7seconds. Browser fixture build warnings about unresolved public font URLs are accounted for by the explicit post-build manifest copy; runtime font loads pass the strict request/error guard. These are the designated validation owner's execution results, not duplicate executions by this reviewer.

The approved scope remains Plans012–020, with017 completed as an evidence-backed no-change outcome. Plans021/022 remain optional design work;010/011 remain deferred. No push, PR, deployment, external dashboard mutation or global runtime/model change is included. The timezone workflow is prepared locally; activation and notification delivery are unverified. Physical touch, Safari, screen-reader speech, real-device performance and generalization of small timing gains remain the documented limits.

No further review round is needed for the integrator's status/index/evidence-summary edits that preserve these source decisions and accurately copy the final numbers. Local commit grouping and final task reporting remain the integrator's responsibility.

Final packaging delta approved: `.gitattributes` applies `-text -whitespace` only to `public/fonts/*-OFL.txt`, preserving original upstream license bytes without changing source-file policy; independent inspection confirmed all three staged license SHA256 values match their reviewed manifest checksums, so no product checks require repetition.

## User-requested Undo toast follow-up

**Verdict: APPROVE** for the bounded presentation delta against `27eae9e`. The bottom-centered fixed wrapper respects safe-area insets and leaves surrounding pointer targets accessible; the opaque themed toast permits long city labels to shrink/truncate while retaining full accessible text, and the Undo button retains a usable touch target. The existing action ref, focus handling, monotonic expiry and overlapping pause handlers are unchanged. The new tests assert city-specific visible copy and fixed viewport-contained placement. The integrator reported15 focused tests passing and owns the pending updated browser geometry run before committing; no broader suite was duplicated for this review. No actionable layout, focus or interaction blocker was found in this delta.

**Subsequent corner/entrance delta against `f0d03e4`: APPROVE.** The user-requested bottom-right placement retains safe-area bounds; its220ms ease-out opacity/1rem horizontal entrance fits within the existing minimum1rem right margin. Animation is opt-in under `prefers-reduced-motion:no-preference`, leaving reduced-motion presentation immediate. No exit delay, remount-on-replacement, action/ref/focus or timer changes are introduced. Inspected the added normal/reduced-motion browser assertions; the integrator owns their execution and final commit, with15 focused tests already reported passing. No additional blocker found and no tests duplicated by this reviewer.

**Auto-dismiss/exit delta against `6bb86d4`: APPROVE.** Independently inspected the five-second monotonic countdown,150ms presence-managed exit, replacement cleanup, reduced-motion removal, pointer/keyboard focus distinction and focused regressions. During review, the reused toast's stale focus/hover pause risk was identified and resolved by explicitly clearing those reasons when exit makes it inert; the strengthened regression exits a focused/hovered toast, revives it with a new removal and verifies a full fresh five-second budget. Timer cleanup cancels old dismissal/exit work on replacement/revival, exiting controls are disabled/inert/hidden from accessibility, and reduced motion removes without the exit delay. Pointer removal redirects focus only when the removed row owned it, allowing expiry; keyboard activation retains focused Undo and its accessibility pause. No remaining actionable blocker was found. The integrator reported26 focused App/row/toast tests,8 desktop/narrow browser tests, the strengthened6-test toast run, typecheck, scoped lint and build passing; this reviewer ran no checks or source edits. README and the maintenance contract now describe the five-second window and exit behavior.
