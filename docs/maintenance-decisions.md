# Maintenance decisions

Daybound is a static, device-local timezone comparison app. The nine original
maintenance findings are implemented. Portable configuration and working-hours
overlap remain [deferred designs](../plans/README.md).

## Behavior to preserve

### Interaction truth table

This contract was checked on 2026-10-23 against the selection, pan, date,
Today/Home and home-city handlers in [App.tsx](../src/app/App.tsx), the midnight,
reload, deselection and keyboard regressions in [App.test.tsx](../src/app/App.test.tsx),
and marker visibility in [Timeline.tsx](../src/app/components/Timeline.tsx).
A selected clock instant and the browsed rail position are independent.

| Action/state | City clocks and local dates | Shared rail | Home-calendar date |
| --- | --- | --- | --- |
| Live, before browsing | Advance with current time in each city. | Follows current time, centered. | Current home-city date. |
| Browse without a selected time | Remain live. | Freezes its base and holds the explored position, within ±24 hours of the starting point. | Home date at the reference instant: center for a centered rail, leading edge for a chosen-date rail. |
| Choose a future date | Holds the current home-city time of day on that date, or carries an already selected home-city time of day onto it. | Starts at the chosen date's first existing instant; resets pan and uses the leading edge as reference. | Chosen date. |
| Select a slot, including Enter/Space at the reference slot | Holds that exact instant in every city, including fractional offsets. | Preserves the current base and pan; highlights the corresponding hour column. Later browsing leaves the clocks fixed. | Slot's home-city date initially; later browsing follows the rail reference. |
| Deselect the highlighted hour in any row, or toggle the same reference slot | Returns to advancing live clocks and local dates. | Clears only `selected`; preserves `base`, `hours`, `centered` and `calendarTime`, including browsing after selection. | Preserves the currently surfaced home-calendar date. |
| Explicit Today, including an already selected Today, or Home on a timeline | Returns to live clocks. | Clears the view and pan; follows current time, centered. | Current home-city date. |
| Change home city | Preserves a selected exact instant; otherwise clocks remain live. | Preserves base/pan/centering when selected; resets unselected browsing to live. | Selected instant's date in the new home zone; otherwise the new home's current date. |
| Reload | Starts with live clocks; restores saved rows and settings. | Starts live, centered, with no selection or pan. | Current home-city date; selected dates are not saved. |

Selection hides the current-time line and pill. Deselecting only makes them
eligible under the existing no-selection rules: a centered rail and measured
viewport are required, and the marker can be outside the clipped viewport.
A chosen-date rail therefore does not acquire a marker merely by deselecting.

Timelines share 25 consecutive elapsed-hour cells. Missing midnight uses the
first existing instant, repeated midnight its earliest occurrence, and wholly
skipped dates are unavailable. Moving a clock time to another date shifts a
missing time forward through its gap; repeated times prefer the original UTC
offset when available. Selected instants remain fixed through midnight and
home-zone changes, even when the new home skipped the original calendar date.
Choosing another date resets pan. Vertical scrolling, pinch zoom, keyboard
navigation and reduced-motion preferences remain available.

### Other behavior

- The calendar popup fits the visible viewport, supports short-screen scrolling,
  restores keyboard focus and keeps exiting content inert.
- Valid saved rows/settings survive partial recovery. Blocked or full storage
  preserves in-memory operation and reports that saving is unavailable. Do not
  replace unread saved data with fallback defaults or recreate a default city
  during a visit after the user explicitly accepts a cleared city list.
- Date-start/model caching and minute-aligned clock refresh preserve correctness
  through hover, home changes, midnight, backgrounding and resume. Do not replace
  cached date-start resolution with a new boundary scan on every clock update.

Timezone sources, the chosen full-data download tradeoff, BC's PCT display rule
and the repeatable update process are in [timezone data](timezone-data.md).
Search sampling/retention, catalogue scope and report templates are in
[search analytics](search-analytics.md). Explicit settings/reference-city events
are in [usage analytics](usage-analytics.md). Preserve their opt-out, cancellation,
runtime projection and filtering boundaries. No automatic capture, replay,
persistent person identity, URL/referrer reporting, retry or unload delivery is
introduced. Sampled failed words use normal PostHog retention, as chosen by the
user; there is no seven-day deletion rule.

## Verification and historical context

Use Node24, `npm ci`, typecheck, lint, tests and build as described in the README.
Use [offline browser fixtures](browser-testing.md) for isolated product checks;
never use live analytics credentials. Keep timer, storage and mock teardown local
to each test suite. Test expected dates independently from production formatters.

Offline interception does not prove live PostHog ingestion/CORS or live HogQL
execution. Local builds do not prove remote CI/deployment. Narrow/short viewport
checks do not replace physical iOS/Android hardware tests. Historical physical
mobile testing and live ingestion were not performed. Changes remain local;
pushing, deployment and external dashboard edits need separate authorization.

The complete pre-cleanup audit/plans/review/browser-evidence snapshot is available
at Git commit `6996580a91dc8582771ac091526eeb407a168f1a`. Its milestone counts and
checkout statements describe their historical candidates, not current status.
A LazyMotion/domMax bundle experiment was rejected because it showed no size gain;
normal bundle measurement remains available in `scripts/measure-bundle.mjs`.
Theme application is shared between synchronous startup and one system-theme
listener. The product-owned city catalogue supplies picker entries and stable
analytics identities. Preserve platform theme/color fallbacks, direct-result
versus alias-metadata precedence, and distinct picker matching versus analytics
recognition when changing these modules.

## Cross-tab recovery and removal Undo

Saved groups (cities, display settings, save-notice dismissal) use explicit conflict resolution. A storage event triggers a fresh read; it never automatically adopts an external setup. Every actual raw difference preserves this tab's current candidate, including a successfully saved candidate subsequently overwritten by another writer. Local edits can continue in memory, with writes paused for that group.

Use saved setup adopts only the validated preview confirmed against a fresh read. Replace saved setup with this tab explicitly writes the current candidate only if that preview still matches. A changed preview requires another action. Invalid data disables adoption; unreadable storage disables both actions until Retry succeeds. External JSON validation is stricter than tolerant initial-load recovery; partial legacy settings and recognized timezone aliases remain accepted.

A cleared group has an explicit preview/action: an empty city list, default display settings or showing the save notice. Accepting an empty list keeps it empty during the current visit and does not write defaults back. Existing initial-load/reload behavior seeds a detected home city when no cities exist. The first city explicitly added to an empty visit becomes home.

Raw preflight checks are not atomic compare-and-set. Concurrent writes remain last-writer-wins on disk; a later invalidation exposes the difference and retains the losing tab's in-memory candidate. Closing/reloading discards that recovery. There are no locks, automatic merges, timestamps/schema envelopes, cloud sync or durable recovery copies. Analytics consent remains under its separate opt-out controller; conflict adoption emits no usage event.

City removal shows a compact bottom-right toast (“Toronto removed · Undo”), outside the row layout and inset from viewport safe areas. It enters from the right over220ms when motion is allowed, and slides out to the right over150ms on dismissal. Reduced motion skips both animations. It retains only the last removed row in memory. Undo restores stable identity, custom fields and order relative to surviving neighbors, without changing the selected instant or chosen home. It expires after five seconds measured monotonically, paused by overlapping hover/focus/hidden reasons. Pointer removal moves focus to a surviving row so the countdown can run; keyboard removal focuses Undo and pauses until focus leaves it. Exiting toasts are inert. External city divergence invalidates Undo immediately; focused invalidation moves focus to a surviving row, while unrelated focus is preserved. A duplicate manual re-add clears Undo with a message; quota failures still allow in-memory removal/restoration.
