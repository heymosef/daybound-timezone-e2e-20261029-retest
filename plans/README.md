# Daybound improvement plans

Prepared2026-10-23 against `b4100f9` using the read-only improve workflow. The user authorized local implementation of the nine existing-app improvements after approving these plans. Implementation is complete; the optional product designs remain deferred from execution. Senior staff review is recorded in [review](023-staff-plan-review.md). **Latest verdict: APPROVE** from a senior staff engineer agent using **GPT-6 Astra, High effort**. Initial findings were incorporated and the bounded follow-up found no remaining handoff blockers. The plan review is historical. **Implementation review: [APPROVE](024-implementation-review.md)** from GPT-6 Astra/High after fixes and final validation. [Execution record](025-implementation-log.md).

## Scope and status

Plans012–020 cover **all nine existing-app suggestions** from the whole-app review: keyboard controls, browser automation, cross-tab saving, timezone notifications, Undo, scrubbing measurement, font measurement, documentation drift and label validation. Plans021/022 cover the adjacent copy-comparison/search product options as design work. Existing010/011 remain deferred design only; this request does not authorize their implementation.

Status labels: DONE = implemented and validated; TODO = ready for the stated prerequisites/design gates; OPTIONAL DESIGN = design only, not selected for implementation; DEFERRED = earlier explicit deferral; IN PROGRESS / DONE / BLOCKED / INVESTIGATED—NO CHANGE are execution outcomes. The current user request authorizes012–020 implementation only. Plan014's explicit conflict policy has staff approval. Plans017/018 retain evidence gates that may narrow or stop code work; no speedup or font change is presumed.

## Priority and execution order

Numbers remain monotonic after existing010/011; dependency order below takes precedence over filename order.

| Order | Plan | Priority | Effort | Change risk | Prerequisites | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [019 — Correct interaction documentation](019-interaction-documentation.md) | P2 quick prerequisite | S | Low | — | DONE |
| 1 | [012 — Keyboard-visible city controls](012-keyboard-row-controls.md) | P1 | S | Low | — | DONE |
| 1 | [013 — Offline browser regression suite](013-browser-regression-suite.md) | P1 | M | Low | Add012 assertions after012 | DONE |
| 1 | [015 — Timezone update notifications](015-timezone-update-notifications.md) | P1 | S | Low | — | DONE |
| 2 | [014 — Cross-tab storage protection](014-cross-tab-storage.md) | P1 | M | Medium | 013 for integration; explicit concurrency design gate | DONE |
| 2 | [020 — Shared label validation](020-label-validation.md) | P2 | S | Low | 012; integrate around014 | DONE |
| 3 | [016 — Undo city removal](016-undo-city-removal.md) | P2 | M | Medium | 012,014;013 browser sign-off | DONE |
| 4 | [017 — Measure scrubbing and optimize conditionally](017-scrubbing-performance.md) | P2 | M | Medium | 013,019; settle012/014/016/020 or record fixed exclusions | INVESTIGATED—NO CHANGE |
| 4 | [018 — Measure first-party font loading](018-local-font-loading.md) | P3 | S–M | Low | 013; serialize fixture edits | DONE |
| Design | [021 — Copy comparison](021-copy-time-comparison.md) | P3 | S–M | Low–medium | Design independent;013 before implementation | OPTIONAL DESIGN |
| Design | [022 — Search quality](022-search-quality.md) | P3 | M | Medium | Design independent;013 before implementation | OPTIONAL DESIGN |
| Deferred | [010 — Portable configuration](010-portable-configuration.md) | P3 | M | Medium | Refresh against014 conflict policy;013 before implementation | DEFERRED |
| Deferred | [011 — Working hours and overlap](011-working-hours-overlap.md) | P3 | L | Medium–high | Refresh against014 storage/013 browser contracts | DEFERRED |

Effort is relative engineering size, not a calendar estimate. Measurements may correctly conclude no product-code change. These plans do not require a dependency upgrade or rewrite merely because a warning exists.

## Parallel work and integration boundaries

- **Lane A — interaction:**012 then020;016 after014. These share `TimezoneRow.tsx`/`App.tsx`, so assign one integration owner and do not edit the same file concurrently.
- **Lane B — regression infrastructure:**013 can start alongside012. Add keyboard assertions once012 is integrated. Its lockfile change is serialized; two-page fixtures share a profile and only the first navigation seeds; it owns test-runner boundaries and both PR/Pages validation paths.019's behavioral correction lands before final browser assertions and any performance refactor.
- **Lane C — maintenance:**015 and019 are independent of product source changes and can run alongside A/B.015 changes timezone documentation;019 changes behavior/analytics documentation, avoiding shared files.
- **Lane D — saved-state reliability:**014 uses explicit conflict resolution with no automatic external adoption; implementation/browser sign-off follows013 after review. A tab retains its candidate even after a racing successful write is overwritten; last-writer-wins and in-memory-only recovery limits are explicit. Integrate014 before016, configuration transfer or any other replacement of saved setup.020 can be developed after012 but integrate sequentially with014 if App handlers overlap.
- **Later measurements:**017 and018 can be measured concurrently after013 and a settled baseline (including020, or recorded fixed exclusions), but serialize edits to `scripts/browser-fixtures.mjs` and keep build/environment samples comparable. Retain a refactor only if its stated evidence gate passes.
- **Product design:**021/022 and deferred010/011 can be discussed independently, without authorizing features. Search changes may alter analytics interpretation and require projection/report tests, not more data collection. No live dashboard access is part of this plan.
- Compatible independently reviewed changes may be integrated in one local tested batch. Do not force one branch, PR, release or full-suite run per plan. The primary integrator runs complete typecheck/lint/tests/build/browser gates once on the final code candidate, then records results and residual device/service limits.

## Validation and local-only boundaries

Use Node24 and `npm ci`. Focused unit/component/script checks belong to each executor; the integrator owns final complete validation. Tests use fake analytics only. A GitHub workflow file can be prepared locally; activation, notification delivery, remote CI and deployment cannot be claimed without a separately authorized remote run. No pushing, PRs, deployment, external dashboard changes or global runtime/model changes are authorized.

For this documentation-only planning candidate, validate local Markdown links, coverage of each suggestion, required plan sections, dependency consistency, scope boundaries and `git diff --check`. Do not rebuild the product or rerun430 tests solely to validate plans.

## Findings considered and rejected

- Remove full IANA history or use browser-only timezone rules: rejected; device-independent precision/history is a recorded product decision.
- Repeat LazyMotion/domMax conversion: rejected; an earlier measured experiment produced no size gain.
- Treat a large-chunk warning as proof of slow scrubbing: rejected;017 requires actual runtime evidence.
- Removing every city resurrects a default on reload: not a reachable current UI defect because the home row cannot be removed; do not invent a fix. External-clear behavior is handled explicitly in014.
- Eagerly ship all34179 analytics catalogue entries, a runtime geocoder, accounts/cloud sync, generic Undo/state frameworks or a framework rewrite: not justified by the reviewed evidence.
- Current outdated timezone data or known vulnerable dependencies: audit found neither (IANA2026e matched; npm audit reported0 advisories). Preserve ongoing checks rather than inventing a current vulnerability.

## Existing design/history references

Current product constraints: [maintenance decisions](../docs/maintenance-decisions.md). Offline fixtures: [browser testing](../docs/browser-testing.md). Existing010/011 are historical design outlines that require reconciliation before future execution, not ready implementation plans. Completed maintenance plans/reviews/request logs/screenshots were removed after preserving decisions; their historical snapshot remains at `6996580a91dc8582771ac091526eeb407a168f1a` (`git show 6996580:plans/README.md`).

## Planning validation and review outcome

Validated2026-10-23: all11 new plans have the required scope/status/step/done/stop/maintenance sections, baseline stamps, balanced code fences and resolving local Markdown links; whitespace checks pass. Only plans/ changed. No product tests/builds were rerun for this documentation-only task.

The requested GPT-6 Astra/High senior staff review first requested changes, then approved the revised handoff with no remaining blockers. Review history and per-finding reconciliation are retained in023. Maintenance plans are ready subject to stated prerequisites and implementation authorization; optional/deferred design statuses are unchanged.

## Implementation run — 2026-10-23

Authorized scope:012–020 only, assigned isolated worktree, local commits, no push/deploy/dashboard/global settings. Optional021/022 and deferred010/011 are unchanged. Owner runs focused checks per area and one complete final integrated validation; staff implementation review is separate from023's plan approval.

Documented scope refinements: integrated App regressions live in `src/app/App.maintenance.test.tsx` to keep the existing large App test readable. Scoped measurement helpers may live under scripts/ and write raw captures only into ignored node_modules/.cache/. User-facing runtime behavior still follows the approved boundaries. Any reviewed fixes are recorded with final results below.

## Final result — 2026-10-23

All nine existing-app items are complete.017 concluded that no product refactor is justified by the recorded measurements;018 retains first-party fonts with measured1.63–6.97% lower readiness medians and unchanged rendering/coverage. Optional/deferred feature statuses are unchanged.

Final Node24 checks: typecheck/lint/build passed;517 Vitest tests across29 files passed;20 offline timezone-check tests passed;28 Chromium desktop/narrow tests passed;16 local font assets/licenses/coverage verified; npm audit reported0 vulnerabilities. The one live timezone freshness check matched2026e. Final staff implementation verdict: APPROVE. Physical touch/Safari/screen-reader speech and remote activation/delivery remain unverified; nothing was pushed/deployed and no dashboard was changed. Existing local preview on127.0.0.1:4180 serves the refreshed production build.
