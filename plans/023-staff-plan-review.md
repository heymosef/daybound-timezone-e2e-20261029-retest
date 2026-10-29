# Staff review of the Daybound improvement plans

Reviewed 2026-10-23 against baseline `b4100f9` and the proposed Plans012–022. **Latest verdict: APPROVE**, following the bounded reconciliation review recorded at the end of this file. All initial findings are resolved in the revised plans. This approves their handoff readiness and stated investigation/design gates; it authorizes no implementation. The initial REQUEST CHANGES review below is retained as history, not the current verdict.

Read the applicable AGENTS instructions, handoff template, index and all new plans, with targeted inspection of storage implementation/tests, App state and handlers, row editor/controls, fixture generation, TypeScript/Vitest/ESLint configuration, workflow files, timezone checker and existing design outlines. No dependency installation, product changes, test/build reruns, commits or remote operations were performed.

## Initial review: required revisions (subsequently resolved)

### R1 — P1: Select the cross-tab strategy and preserve successfully saved local candidates

**References:** [Plan014](014-cross-tab-storage.md), Explicit conflict policy and Steps1–4; [index](README.md), saved-state lane and readiness status.

The plan currently delegates a choice between locks and best-effort writes, while also requiring staff approval of that choice. More seriously, “clean” is undefined after a successful local write. If two tabs both pass a pre-write check, one may overwrite the other; treating the losing tab as clean and automatically adopting the winner destroys its local candidate before the required visible reconciliation signal. Documenting last-writer-wins alone does not satisfy the draft-preservation requirement.

**Recommended strategy, refined with the integrator:** use raw-value stale-edit detection and explicit conflict resolution for every actual external difference, with **no automatic external adoption**. Preserve the current in-memory candidate even if this tab has never edited it or its last save succeeded. Do not introduce Web Locks, a storage schema change, clocks/version identifiers, merges or a generic synchronization layer in this plan. This intentionally trades automatic cross-tab synchronization for a smaller, recoverable contract.

Write the following transitions into the plan before handoff:

- Keep an acknowledged raw value and the current in-memory candidate. A successful write clears the pending-write flag, but does **not** authorize later external events to replace that candidate.
- A differing external stored value always produces a per-key conflict and preserves the current candidate, whether the most recent write succeeded, failed or is pending. While conflicted, suspend persistence; local user edits may continue updating the candidate. Equal-current-raw events are harmless invalidations, not new conflicts. This deliberately requires a notice/action for ordinary cross-tab changes too; explicitly accept that UX cost rather than promising automatic synchronization.
- Before every write, re-read and compare the current raw value with the acknowledged value. A mismatch stops the write and preserves the candidate. Storage events re-read current storage; event payload order must not restore stale data.
- **Use saved setup** explicitly accepts the latest displayed valid candidate, acknowledges its raw value and clears the conflict without a write-back. Re-read before adoption and refresh/reconfirm if the displayed candidate changed. **Replace saved setup with this tab** also re-reads storage; if it differs from the value shown by the notice, refresh the notice and require a new action. Otherwise perform the explicit replacement and retain the in-memory candidate afterward. A read failure never authorizes replacement of unread data.
- A completed local write followed by another tab's write must leave the losing tab's candidate available behind a visible conflict. Reload/closing the tab discards that in-memory recovery, and localStorage remains last-writer-wins during a truly simultaneous race. State these limits plainly.

Add a transition table covering dirty/pending/saved/unavailable states, event-before-effect and event-after-successful-write. Increment the external revision on detected divergence as well as explicit adoption so Undo invalidates promptly. Require deterministic hook tests for both writers reading the same baseline before either writes, and for stale events after a newer write. The real two-page test verifies integration; uncoordinated concurrent clicks alone are not proof that the race was exercised. Update its sequential scenario to assert B receives a notice and explicitly adopts A's setup before editing. Mark014 as design-gated until this selected policy is incorporated and reviewed;016 remains blocked on its resulting API.

### R2 — P1: Make rename focus restoration depend on how editing ends

**Resolved during review:** the integrator revised012 Step2/test plan to make restoration reason-aware, including Tab/Shift+Tab and click destination assertions. Verified in the current plan. Plan020 already defers to012's focus handling, so this is no longer an open blocker.

**References:** [Plan012](012-keyboard-row-controls.md), Step2 and test plan; [Plan020](020-label-validation.md), Step2.

Plan012 says to restore focus after “commit/cancel,” but blur is a commit path. An unconditional focus effect can steal focus back when the user presses Tab/Shift+Tab or clicks another action, undermining the keyboard fix. The existing editor uses the same save handler for Enter and blur.

Specify explicit completion reasons: Enter commits once and restores the rename trigger; Escape cancels and restores it; blur commits once while preserving the destination focus. Blur after Enter/Escape must not commit again. Add component and browser checks for Tab and Shift+Tab leaving the editor, clicking another row action, and Enter/Escape followed by blur. Plan020 must inherit this rule, including rejection of an invalid edit without trapping focus.

### R3 — P2: Define external invalid/empty storage resolution instead of relying on tolerant parsers

**Reference:** [Plan014](014-cross-tab-storage.md), Explicit conflict policy and Steps1–3.

The current parsers always return a normalized value: `parseTimezoneConfig(null)` becomes an empty list, and invalid settings become defaults. The proposed hook therefore cannot distinguish “validated saved setup” from recovery defaults merely by calling the existing parser. The notice's **Use saved setup** action is also undefined for malformed JSON, removed keys and `clear()`.

Specify a small tagged external-read result that distinguishes readable valid/recognized legacy data, invalid data, absent data and read failure, while leaving initial-load tolerant recovery intact. Define which existing normalization is accepted externally; reject wholly unusable payloads rather than quietly adopting an empty/default replacement. For malformed data, disable adoption with an explanation and allow only an explicit readable-raw replacement from the preserved local candidate. For absence/clear, explicitly present what accepting the cleared state means per key (empty city list, default settings, false notice dismissal), require that choice, and do not re-run App's initial default-city creation. Read failures keep recovery actions unavailable until a successful re-read.

Test syntactically valid but wrong-shape JSON as well as malformed JSON, normalized legacy values, valid `[]`, removed keys and `key:null`. Verify an explicitly accepted empty configuration remains empty during that visit, and document the existing reload/default-city policy separately. None of these cases may automatically overwrite a known good local setup with defaults.

### R4 — P2: Complete Undo's focus and timer contract within its declared scope

**References:** [Plan016](016-undo-city-removal.md), Product contract, Step2 and test plan; [Plan012](012-keyboard-row-controls.md), row trigger contract.

Pausing expiry while focused handles normal timeout, but external invalidation and duplicate re-add can still remove a focused Undo button and drop focus onto the body. Returning focus to a restored row also needs a stable target contract;012 currently promises only a label-derived accessible name, and016 excludes `TimezoneRow.tsx` from its scope. The present App uses animated row exits, so an outgoing row is not necessarily already absent from the DOM when a focus query runs.

Specify a stable row/rename focus handle in012, or explicitly add the smallest row/ref integration to016's scope. If an invalidation removes the currently focused notice action, move focus to a deterministic surviving app control; if focus is elsewhere, do not steal it. After successful Undo, focus the restored current row after commit, not an outgoing animated node or a text-derived global selector. Cover invalidation while Undo has focus, duplicate re-add, immediate Undo during exit animation, and pointer removal with unrelated focus.

Specify pause reasons as an overlapping set: clearing hover must not resume a timer while focus/hidden remains active. Measure remaining duration with a monotonic clock, and test overlapping reasons, second-removal replacement while paused, StrictMode cleanup and unmount. The fixture freezes `Date.now()`, so wall-clock subtraction would not verify this contract. Reclassify this plan as at least medium effort/risk, or explicitly simplify its chosen contract; the current S/LOW estimate understates these requirements.

### R5 — P2: Define a continuously active, comparable scrubbing workload

**Reference:** [Plan017](017-scrubbing-performance.md), Steps1,2 and4.

Three “10-second drags” are not yet a reproducible workload. App clamps exploration to +/-24 hours; a one-direction drag can spend much of the sample at the clamp, measuring idle frames. The fixture also freezes `Date`/`Date.now`, and the plan does not select the primary metric before experiments. These gaps could produce a misleading performance gate despite the otherwise sound thresholds.

Specify a repeatable back-and-forth pointer path that crosses hour boundaries while staying inside the clamp, a recorded input cadence, and proof that pan changes continue throughout each sample. Use `performance.now()`/rAF timestamps, not the fixture's wall clock. Include the normal fixture row count as a representative case and label12/24 rows as stress cases; decide the diagnosed primary metric before the candidate comparison. Run timing comparisons with identical build/profiling overhead and keep diagnostic React profiling separate. Mark all related editor work, including020, as settled or explicitly excluded in the index before recording the baseline.

### R6 — P2: Make the font baseline start in the intended design with a known isolated build

**Reference:** [Plan018](018-local-font-loading.md), Steps1–4.

The provenance, license, Unicode and base-path requirements are good. The remaining measurement gap is that the standard build reads environment files, while the offline fixture blocks remote fonts. Switching designs after the first navigation also loads the default design's fonts first and is not a cold-load sample of the target design.

Provide an exact local build recipe using Vite's `envFile:false` and explicit undefined analytics configuration, with isolated output. For each sample, seed only synthetic settings for the intended design before the first app navigation, then measure a fresh context/cache from that navigation. Identify the bounded Google Fonts requests allowed for the baseline only; keep the automated offline harness's external-request prohibition intact. Record the actual loaded faces and supplied Unicode ranges. Browser font readiness/computed family alone is insufficient evidence of glyph coverage: compare the baseline/candidate coverage manifest plus representative rendered glyph/fallback checks. If remote fonts or profiling tools are unavailable, record the measurement as blocked/unverified rather than inferring a no-benefit result.

### R7 — P3: Close two browser-harness setup details

**Reference:** [Plan013](013-browser-regression-suite.md), Steps1 and3.

**DOM types resolved during review:** the integrator added DOM/DOM.Iterable to013's setup instructions while retaining strict Node settings and excluding Vitest globals. Verified in the current plan. The additional015 Node-runner test filename change to `test-timezone-check.mjs` also correctly avoids accidental Vitest discovery.

Also name the initial fixture's intentional Google stylesheet CSP violation in the narrow console/request allowlist, and remove that exception if018 removes the remote import. The suite must neither fail permanently on that known baseline nor mute all CSP/network errors. Confirm the two-page test uses identical fixture profiles and only the first page seeds/resets storage, so loading the second page cannot manufacture the conflict being tested.

## What is already sound

- Plans013 and015 keep credentials, fixture controls and external maintenance checks separate from production behavior. Runner isolation, two validation workflows, owned server lifecycle, pinned Actions, bounded jobs and truthful remote-verification limits are appropriate.
- Plan019 corrects a source-confirmed documentation error without changing behavior. Plan020 preserves the existing1024-code-unit storage contract rather than inventing a new limit or migration.
- Plans017/018 allow an evidence-backed no-change result and reject speculative architectural work. Font licensing, official provenance, checksums, fallback coverage and Pages base paths are already explicit.
- Plans021/022 are properly optional design work with concrete future acceptance questions. Plans010/011 remain deferred. Bundled IANA rules, local-only operation, analytics privacy and one integrator for full validation are consistently preserved.

## Initial readiness verdict (superseded)

**REQUEST CHANGES** for the complete handoff until open R1/R3–R6 are reconciled; the remaining R7 allowlist/seeding details are small setup corrections. R2 and R7's DOM-type portion are resolved. Plans012/015/019/020 are implementation-ready within the stated authorization/dependency boundary. Plan013 becomes ready after its small harness clarification. Plan014 needs the selected state/validation policy reviewed before code;016 depends on that result and its own focus/timer contract. Plans017/018 are investigation-ready after their measurement recipes are tightened, with product changes still conditional on evidence. Plans021/022 remain optional design, and010/011 remain deferred.

The primary integrator owns revisions, index/status reconciliation and final document validation. A follow-up review should inspect the changed plan sections only; it need not repeat the application audit or product test suite.

## Follow-up review and final reconciliation — 2026-10-23

**Verdict: APPROVE.** Inspected the revised policy, steps, tests, scope and dependency sections in012–020 and the index, without repeating the source audit, installing dependencies or running product tests/builds. No remaining actionable contradiction or implementation-readiness blocker was found within that bounded review.

| Initial finding | Reconciliation |
| --- | --- |
| R1 — Cross-tab policy and successful-write preservation | Resolved.014 selects explicit resolution for every actual external raw difference, preserves the in-memory candidate after success/failure, suspends writes during conflict, validates preview tokens before either action, and states non-atomic last-writer/reload limits. Deterministic hook interleavings own race proof; two-page tests own integration. No automatic adoption, locks, merge or persisted recovery framework is required. |
| R2 — Rename focus | Resolved.012 distinguishes Enter/Escape from blur and requires Tab/Shift+Tab/click destination tests;020 inherits that contract. |
| R3 — Invalid/absent external storage | Resolved.014 specifies per-key strict external decoding while retaining tolerant initial recovery, tagged valid/invalid/absent/unavailable results, explicit cleared-state previews, disabled unreadable/invalid adoption and accepted-empty-list behavior. |
| R4 — Undo focus and timing | Resolved.016 includes the row integration in scope, an App-owned stable callback-ref map, current-row/post-commit focus handling, focused-notice invalidation fallbacks and non-stealing pointer behavior. Overlapping pause reasons, monotonic remaining time, replacement/StrictMode cleanup tests and M/MED sizing are explicit. |
| R5 — Scrubbing measurement | Resolved.017 defines a symmetric active path, recorded cadence and continuous pan evidence, monotonic timing, representative versus stress rows, a preselected primary metric and a settled baseline including020 or explicit fixed exclusions. Matching instrumentation and independent diagnostic profiling remain required. |
| R6 — Font measurement | Resolved.018 specifies an isolated environment-free build with analytics constants disabled, per-design seeding before initial navigation, fresh contexts, a bounded baseline-only font request policy, coverage manifests/rendered checks and blocked/unverified outcomes when evidence is unavailable. Licensing/provenance and base-path gates remain intact. |
| R7 — Browser harness details | Resolved.013 names DOM libraries, retains separate runner ownership, constrains the known baseline font CSP exception and requires identical two-page fixture profiles with only first-page seeding.015's Node test filename also avoids accidental Vitest collection. |

The selected014 policy is approved: the extra confirmation for ordinary cross-tab changes is an explicit simplicity tradeoff, and in-memory recovery is not represented as durable or race-free storage. Its staff-policy gate is satisfied by this review; the integrator may update the index accordingly. Later changes to that policy still require review.

Plans012–016/019/020 are ready for implementation when separately authorized and their stated dependencies are met. Plan013 provides the browser infrastructure;014 precedes016; overlapping App/row edits remain serialized as specified. Plans017/018 are ready for bounded investigation, with source changes conditional on the recorded performance/font gates and a valid no-change outcome permitted. Plans021/022 remain optional design work, and010/011 remain deferred; this approval does not select or authorize those features.

No further staff-review round is required for editorial/index reconciliation that preserves these contracts. The primary integrator owns final document validation and status updates. Implementation must still satisfy the plans' focused checks and the integrator-owned final validation; this review is not evidence that product changes, remote CI or deployment have run.
