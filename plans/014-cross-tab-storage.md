# Plan 014: Detect and resolve stale saved setups across tabs

## Status and execution contract

- Status: DONE; locally implemented, validated and staff-reviewed on2026-10-23.
- Priority: P1; effort: M; change risk: MED; category: bug.
- Planned at: `b4100f9`, 2026-10-23.
- Depends on: 013 before final integration/browser sign-off.
- Repository checkout: `/Users/mohammed/Documents/Cursor/daybound-web-app`.
- Assigned isolated worktree: `/Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app`.
- Implementation owner uses the assigned isolated worktree and local commits only after implementation is requested. Do not push, deploy, open PRs, change dashboards, or change global runtime/model settings. The primary integrator owns `plans/README.md` status and final validation.

Read this entire file before implementation. Run `git diff --stat b4100f9..HEAD -- src/hooks/useStorage.ts src/hooks/useStorage.test.tsx src/utils/persistence.ts src/utils/persistence.test.ts src/app/App.tsx src/app/App.test.tsx src/app/components/StorageConflictNotice.tsx src/app/components/StorageConflictNotice.test.tsx tests/browser/storage.spec.ts README.md docs/maintenance-decisions.md` and `git status --short`. Reconcile expected edits from the dependencies against the current-state excerpts; record that reconciliation in the handoff. Stop for unexplained semantic drift, unrelated dirty files in scope, or a dependency that is not complete. Do not overwrite someone else's work.

## Runtime, conventions and verification ownership

Use Node24 (`node --version` must report v24.x) and npm; run `npm ci` when dependencies are missing or the lockfile changes. A session-local invocation is `npm exec --yes --package=node@24 --package=npm@11 -- npm <arguments>`; do not change global defaults. Match React18 functional components, TypeScript strict mode, Tailwind theme variables, and existing Testing Library/Vitest patterns. Never use real analytics credentials for verification.

During implementation run the focused commands below, `npm run typecheck`, and `npm run lint` (all exit 0). The primary integrator runs `npm test` and `npm run build` once on the final integrated candidate, plus the browser suite once it exists. A plan's passing focused tests are not a claim that final integration passed. Failure requires investigation, not blanket retries or wider unrelated refactors.

## Scope

Only these paths may change, plus this plan's execution notes and the integrator-owned index:

- `src/hooks/useStorage.ts`
- `src/hooks/useStorage.test.tsx`
- `src/utils/persistence.ts`
- `src/utils/persistence.test.ts`
- `src/app/App.tsx`
- `src/app/App.test.tsx`
- `src/app/components/StorageConflictNotice.tsx`
- `src/app/components/StorageConflictNotice.test.tsx`
- `tests/browser/storage.spec.ts`
- `README.md`
- `docs/maintenance-decisions.md`

## Why this matters

Each tab reads its own initial configuration and later writes an entire snapshot. A later edit in a stale tab can erase another tab's saved city/setting changes. Detect external changes, adopt them when safe, and preserve local drafts when there is a conflict. Do not invent an automatic merge policy for arbitrary React state updaters.

## Current state and constraints

`src/hooks/useStorage.ts` initializes once:
```tsx
const [snapshot, setSnapshot] = useState(() => readPersistentValue(key, initialValue, parse));
// committed effect:
window.localStorage.setItem(key, JSON.stringify(snapshot.value));
// local updater:
setSnapshot(current => ({ ...current,
  value: typeof next === "function" ? next(current.value) : next,
  needsWrite: true,
}));
```
There is no `storage` listener or comparison with the last observed stored value. `readPersistentValue` in `src/utils/persistence.ts` returns `{value,status,needsWrite,canPersist}`; failure to read means `canPersist:false` so unread data is never overwritten. Keep that rule and quota/in-memory recovery. Existing `useStorage.test.tsx` asserts pure functional updaters and one committed write under StrictMode. Keys: `timezone_config`, `app_settings`, `local_save_notice_dismissed`. Analytics consent is separately owned by its controller and is out of scope.

## Selected policy: explicit recovery, no automatic synchronization

Use raw-value stale-edit detection and explicit resolution for **every external difference**. Do not automatically adopt another tab's value, even when this tab has not edited anything or its last save succeeded. This intentionally trades automatic synchronization for a small recoverable policy. Do not add Web Locks, timestamps/version envelopes, CRDTs, schema migrations or generic merge/replay logic.

The hook retains an acknowledged raw storage value and its current in-memory candidate. A successful write clears pending-write work but retains that candidate. A differing external read enters a per-key conflict and preserves the candidate. While conflicted, local user edits may change the candidate but persistence is suspended. Storage events are invalidations: re-read current storage, ignoring stale event payloads, unrelated keys/storage areas and equal-acknowledged-raw signals. `key:null` invalidates every managed key. Increment an external revision on newly observed divergence, including malformed/absent values, and on explicit adoption; equal repeated invalidations do not increment it indefinitely.

Before every write, re-read actual storage and compare it with the acknowledged raw value. A difference stops the write and preserves the candidate. This is **not atomic compare-and-set**. Two truly simultaneous writers may both pass; localStorage's last writer wins on disk. When the subsequent invalidation is observed, the losing tab keeps its just-saved candidate and displays the conflict. Closing/reloading that tab before resolution discards its in-memory recovery; no lossless synchronization or durable draft backup is promised.

### External-read classification and parser policy

Add a small tagged external-read result: `valid` (raw string + parsed value), `invalid` (readable raw + reason), `absent` (raw null + explicit cleared-state preview), or `unavailable` (no readable value). Leave initial-load tolerant recovery unchanged. Share existing field/timezone/text predicates; do not create a second schema implementation or a schema library. Add a fourth hook argument for a typed external decoder with these rules; the three App callers and hook tests provide their appropriate decoder.

- **timezone_config:** valid JSON array, including valid `[]`; every row must have a unique nonempty id, a recognized timezone string with no duplicate exact timezone, boolean isHome if present, and valid optional text if present. Accept absent optional fields, legacy timezone aliases and normalization to exactly one home using the existing parser. If any row/field is unusable, classify the whole external payload invalid instead of silently dropping rows/text. Wrong root shapes, including null, are invalid. This stricter external-adoption contract does not change initial-load partial recovery.
- **app_settings:** accept an empty record or a recognized partial legacy settings record. Every present known field must have its accepted enum/boolean type; missing fields take existing defaults. Ignore unknown extra fields only when at least one known valid setting is present; a nonempty unknown-only object or wrong root is invalid. Do not silently turn a present invalid setting into defaults on external adoption.
- **local_save_notice_dismissed:** only JSON booleans are valid; other shapes are invalid.
- **absent/clear:** preview accepting the cleared state separately for each group: empty city list, DEFAULT_SETTINGS, or false notice dismissal. Require an explicit action named for that result (for example “Use cleared city list”). Adoption acknowledges raw null and does not write defaults back. App's one-time initial-city creation must not run again during this visit. An accepted empty city list stays empty for this visit; existing initial-load/reload behavior may seed a detected home city and must be documented separately.
- **invalid:** show a short reason without raw contents, disable adoption, retain the candidate, and permit only an explicit replacement after a successful current read. **unavailable:** disable both adoption/replacement, show saving unavailable and allow Retry; never replace unread storage.

### Resolution actions and transitions

For a valid external setup, show a concise validated preview (city count/names or changed settings) and **Use saved setup** / **Replace saved setup with this tab**. Render labels only as React text; never put raw JSON in notices/logs/analytics. Before either action, re-read and compare with the exact raw value represented by that preview. If it changed, refresh the preview and require a new action. Adoption uses the latest confirmed decoded value, updates the acknowledged raw, clears pending writes/conflict and does not write back. Replacement explicitly writes the current in-memory candidate only when the confirmed external raw still matches; retain the candidate afterward. Equal candidate/saved values can resolve without writing. Invalid/absent cases use the specialized behavior above. No conflict state or draft is persisted under a new key.

| State / event | Required transition |
| --- | --- |
| Initial clean state; normal local edit | Pure update to candidate; pending write |
| Pending write; raw still equals acknowledged value | Write committed candidate, acknowledge own raw, retain candidate |
| Pending write; preflight mismatch or event-before-effect | Conflict; preserve candidate; do not write |
| Successful local write; another tab overwrites it | Conflict on current re-read; preserve just-saved candidate |
| Clean/no-edit tab; different external value | Conflict; preserve displayed setup; no automatic adoption |
| Stale event after a newer write; actual raw equals acknowledged value | Ignore event; no rollback or new notice |
| Conflicted; local edit | Update candidate only; no persistence |
| Conflicted; external value changes again | Refresh preview/revision; preserve candidate and require fresh confirmation |
| Any state; read failure | Preserve candidate, mark unavailable, no read-dependent action/write |
| Write fails with quota; later external divergence | Preserve candidate, show both conflict and unavailable status truthfully |
| Explicit adoption | Use confirmed decoded/cleared value, no write-back; advance external revision |
| Explicit replacement fails | Preserve candidate/conflict; report unavailable, allow later successful retry |

Keep the first3 hook tuple entries stable and add fourth metadata `{conflict, resolveFromStorage, replaceFromDraft, retryExternalRead, externalRevision}` or an equivalently named typed object matching this contract. The conflict exposes only the safe preview/classification needed by App. Pure state updaters contain no storage writes or event capture; committed effects/resolution handlers own I/O.

## Steps

1. Add the external decoders/read classification in `persistence.ts`, reusing the existing validation predicates. Add hook state and failing tests for the transition table. Follow existing `renderHook`, `act`, Storage spies and StrictMode tests; test numeric hook values with a strict numeric external decoder. Verify `npm test -- src/hooks/useStorage.test.tsx src/utils/persistence.test.ts` first fails only on the intended new contract, then passes as transitions are implemented. Include wrong-shape JSON, malformed JSON, valid/invalid optional text, partial legacy settings, valid[], removeItem and key:null.
2. Implement current-raw preflight, listener/cleanup and explicit resolutions. Test two simulated writers with a controlled Storage spy: arrange for both preflight reads to see the same baseline, record both writes, then expose the winner and dispatch invalidations; the loser must retain its exact candidate and report conflict. Also test event-before-effect, stale payload after a newer write, failed read/write, changed preview before adoption/replacement, no feedback loop and unmount/StrictMode cleanup. No retries or locks are necessary. Verify the two focused suites, typecheck and lint exit0.
3. Add compact `StorageConflictNotice` with named status, validated preview, native buttons and theme-token focus styles. Preserve open rename drafts while their row exists; if explicit adoption removes that row, cancel its editor without resurrection and move focus only if the focused element disappears. Preserve selected exact instant across explicit home changes and recompute the calendar in the new home zone. Reconcile unselected browsing according to the existing manual home-change behavior; do not emit analytics for adoption, replay earlier actions or rerun default initialization. Verify `npm test -- src/app/components/StorageConflictNotice.test.tsx src/app/App.test.tsx` passes for all four external classifications, accepted empty list and focus/state preservation.
4. Add a real same-origin two-page browser test after013: use the identical scenario/profile for both pages; only A's first navigation seeds with reset=1, then remove reset before opening B. A adds a city; B receives a notice and explicitly adopts A's setup before its own edit; A then explicitly adopts B's next change. Also cover a preserved local candidate after external overwrite, explicit replacement, malformed/cleared state and unavailable recovery. The deterministic hook test owns the precise simultaneous-race proof; do not claim uncoordinated browser clicks exercise it. Verify `npm run test:browser -- tests/browser/storage.spec.ts` exits0. Document the explicit-resolution UX and last-writer/in-memory/reload limits.

## Done criteria

- Existing StrictMode, partial initial recovery and storage-failure guarantees remain intact.
- No external setup is adopted automatically; stale sequential edits pause before overwriting, and event-after-successful-write retains the local candidate behind a visible notice.
- Tagged external validation does not mistake wrong-shape JSON for a valid default replacement; clear/absence actions preview their exact outcome and do not seed a city during that visit.
- No event write-back loop, generic merge, new persistent draft/schema or consent-controller change.
- All named focused tests/typecheck/lint and two-page integration tests pass; README accurately states concurrency and reload limits.

## STOP conditions

Stop for unexplained drift, a need for durable lossless synchronization, generic merge/replay, schema migration, cloud accounts or a broader state-manager replacement. Stop if raw data cannot be read, but do not prevent in-memory editing. Never discard a candidate automatically or claim race-free storage. Changes to this selected policy require renewed review before implementation.

## Maintenance notes

Staff review must approve this selected policy; review approval makes the plan ready, not implementation authorized.016 consumes externalRevision and invalidates Undo at divergence rather than waiting for adoption. Future configuration import must use the same conflict boundary. The intentional extra confirmation for ordinary cross-tab changes is the simplicity tradeoff; revisit only with evidence of real friction.

## Execution outcome — 2026-10-23

Completed under the user's implementation authorization. See [integrated validation](025-implementation-log.md) and [staff implementation approval](024-implementation-review.md). Current source/tests supersede the baseline excerpts for future drift checks; optional product designs remain excluded. No publication or deployment occurred.
