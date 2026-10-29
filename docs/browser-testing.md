# Offline browser fixtures

## Automated Chromium smoke suite

Use Node24 and install the lockfile dependencies before running the suite:

```sh
npm ci
npm exec -- playwright install chromium
npm run typecheck:browser
npm run test:browser
```

`@playwright/test` is pinned to 1.64.1. The runner builds the real offline shell
with `envFile:false`, then owns a static server at `127.0.0.1:4176`. A busy
port fails; it never reuses or stops the user-owned production preview on 4180.
The server serves only generated fixture files, rejects escaping paths, and
closes on runner shutdown. It does not read `.env` or publish fixture output.
The two projects use Chromium at 1280×900 and 390×844; the calendar test also
checks 320×568. One worker, no retries, 25-second tests, 5-second assertions,
60-second server startup and a 240-second overall limit bound the run.

Eight focused flows per project cover search/add/rename persistence, future
selection clearing, whole-hour drag rebases, date-strip switching, calendar fit
and focus, keyboard timeline/row controls, Toronto/BC clock changes and fake
analytics cancellation. Drag checks inspect computed pointer/transition styles,
DOM identity for an unchanged instant, and aligned rail frames. They do not
claim pixel-level flicker detection. Physical touch, Safari and screen-reader
speech require separate checks. No screenshot baselines or videos are recorded.
Failure traces remain locally in ignored `test-results/`; inspect them with
`npm exec -- playwright show-trace <trace.zip>`.

Browser tests import only Playwright test APIs from `tests/browser/fixtures.ts`.
Vitest retains its default exclusions and additionally excludes this directory;
Playwright collects only `tests/browser/**/*.spec.ts`. Browser TypeScript is
included in `npm run typecheck` and browser files remain subject to lint.
Both PR validation and the Pages build job install Chromium with system
dependencies and run this suite before the production build/artifact upload.
Only the production build step receives the public analytics configuration.
Remote workflows are not run by local verification.

Every context intercepts network requests and fails on unexpected external
origins, failed requests, page errors or console errors. There is no external
font or CSP exception: all three design fonts load from the fixture origin.
Fixture fetch interception and its strict CSP remain active, with synthetic
analytics only.

Tests start with isolated contexts. For a deliberate two-page storage test, use
the identical fixture scenario/profile on both pages: only pageA seeds with
`reset=1`, remove that parameter before reload, then navigate pageB without it.
Loading pageB must never reseed pageA's saved state. The initial persistence
flow follows that reset-removal convention; cross-tab conflict scenarios may
be added only alongside the corresponding storage implementation.

## Manual CUA verification

These pages mount the real App, styles and AnalyticsProvider. Controls live only
in the generated shell, never in the product. Generate them after integration
so the bundles contain the final source:

```sh
npm exec --yes --package=node@24 --package=npm@11 -- node scripts/browser-fixtures.mjs
python3 -m http.server 4174 --bind 127.0.0.1 --directory node_modules/.cache/daybound-smoke/site
```

Run the server as a separate terminal command. The generator exits after building;
it starts no server. Entries are under `node_modules/.cache/daybound-smoke/entries/`
and output is under `node_modules/.cache/daybound-smoke/site/`. Both are ignored.
No `.env` files are read. Stop the server with Ctrl-C. Use supported CUA tools
for manual browser interactions. The generator itself starts no browser;
`npm run test:browser` is the separate automated runner.

Use the regular production build separately on port4173:

```sh
npm run build
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Normal product analytics remains disabled on localhost/127.0.0.1 even if a build
has public configuration. The fixture does not alter that policy.

## Fixture routes

All routes start at `http://127.0.0.1:4174/`:

| Query | Initial clock and purpose |
| --- | --- |
| `?scenario=midnight` | 2026-03-07 23:59:30Z, UTC home; fixed-date/home-midnight lifecycle |
| `?scenario=fractional` | 2026-03-07 21:00Z; Kolkata02:30, Kathmandu02:45 and Adelaide fractional labels |
| `?scenario=dst-spring` | 2026-03-08 06:59:30Z, New York home; missing hour |
| `?scenario=dst-fall` | 2026-11-01 05:59:30Z, New York home; repeated hour and explicit offsets |
| `?scenario=cuba-fall` | 2026-11-01 04:59:30Z, Havana home; canceled 2026 rollback retains UTC−04:00 |
| `?scenario=toronto-fall` | 2026-10-31 19:00Z, Vancouver home; Toronto's rollback before Vancouver's Nov 1 |
| `?scenario=st-johns` | 2009-11-01 02:29:30Z, St Johns home; brief date and backward date crossing |
| `?storage=corrupt` | Malformed timezone/settings JSON before App initialization |
| `?storage=blocked` | localStorage property getter throws SecurityError before initialization |
| `?storage=quota` | Storage writes throw QuotaExceededError before initialization |
| `?systemTheme=dark` (or `light`) | Fixture-only system preference; seeds System mode and enables a simulated preference-change button |
| `?analytics=on` | Injected production fixture context, fake public token and .invalid host |

Combine parameters, for example
[the midnight analytics fixture](http://127.0.0.1:4174/?scenario=midnight&analytics=on).
Scenario, storage mode or analytics mode changes reset this fixture's known
storage keys. Unchanged profiles retain edits and saved opt-out through reload.
Append `&reset=1` to reseed explicitly, then remove it before checking persistence.
Fixture storage is isolated on port4174. Reload resets the clock and starts the
product in live mode; it does not persist selected dates.

Rows seed UTC, Kolkata, Kathmandu, Adelaide, New York and Lord Howe, plus St Johns
in its scenario. Choose fixed dates and home zones using actual product controls.
The fixture never sets product React state directly.

## Controls and observations

- Startup theme output records the root class, design and browser chrome color
  after App initialization and before React mounts. With `systemTheme=dark` or
  `light`, Simulate system theme change dispatches a fixture-only media event;
  explicit Light/Dark product choices should ignore it. OS preferences are untouched.
- Advance minute/day changes `Date`/`Date.now` and dispatches focus/visibility
  events so the real clock hook refreshes. Native timers and Motion remain real.
- Advance minute without focus only changes the clock; Resume focus dispatches
  lifecycle events. Real timers can still fire naturally. Actual hidden-tab
  interaction and resumption belong to the browser verification owner.
- The request status and expandable JSON expose count, complete envelopes,
  request options, pending count and each intercepted AbortSignal cancellation.
  Perform actual product actions to produce requests; there is no capture button.
- Complete pending requests resolves intercepted requests locally. Leave requests
  pending to observe cancellation when opting out in product Settings.
- Simulate other-tab opt-out persists a denial when storage allows, then dispatches
  the same StorageEvent used by the controller. Product Settings owns opt-in.

In analytics mode, the provider gets `production: true`, the fixture hostname,
`phc_offline_fixture_only`, and `https://analytics.daybound.invalid`. Browser
DNT is replaced with false only in this explicit offline fixture so the
transport is deterministic; production still respects browser privacy signals.
Fetch interception is installed before App/provider modules load and never calls
native fetch. Every unexpected fetch rejects. A content-security policy also
blocks all network connections and external fonts/assets. The generator explicitly
copies the manifest-listed local WOFF2 files; all three real design fonts load
from the same fixture origin without relaxing CSP.
No live analytics key or host is read or embedded by the generator.

This harness prepares offline verification. It is not evidence of completed
browser smoke, live ingestion, deployment, or remote CI. Record actual desktop/mobile observations with the change being verified.
See [maintenance decisions and verification limits](maintenance-decisions.md).

## BC permanent-time regression

Use `?scenario=bc-fall&reset=1` to start at 2026-11-01T08:59:30Z with
Vancouver, Los Angeles and other recently changed Canadian zones. Advance one
minute: Vancouver shows 02:00 PCT, Los Angeles 01:00 PST. Drag any timeline or
use Shift+ArrowRight to explore 24 hours ahead; advance the clock again to verify
the explored view holds while unselected row clocks advance. Tap a visible slot:
all clocks and their local dates must match that instant, matching columns are
highlighted, and Advance minute must leave those clocks fixed. A subsequent
swipe must move only the view; tapping Today restores live time. Choose another
future date to retain the selected home-city time, and change home city to retain
the same instant while updating its calendar date. While selected, there must be
no time line or time pill. Tap the highlighted column again in either row to
clear it while retaining the surfaced date and scrub position; clocks resume
live time. Enter/Space should toggle the reference slot. Today/Home explicitly
returns the timeline to now.
No live analytics are used.
The offline CSP permits the app's own blob Paint Worklet while all fetches are
intercepted and connect-src remains none. This preserves the product's corner
rendering during visual checks.

Time-selection verification, 2026-10-23: the production preview and offline fixture
were checked at desktop size and 390×844. Future row dates, synchronized slot
selection, fixed clocks after Advance minute, swipe without selection, keyboard
Enter/Home, and Today reset passed. Browser pointer controls were used; a physical
touchscreen and screen-reader speech were not tested. Automated coverage includes
implicit touch-capture transfer, fractional offsets, DST gaps/repeated hours, and
home-city date-line changes. Final checks passed on Node24: typecheck, lint,
396 tests across 23 files, and production/fixture builds.

Follow-up toggle check, 2026-10-23: the refreshed production preview showed no
time marker/pill during selection. Clicking the corresponding highlighted cell
in another city cleared all selected columns and restored live Today. Typecheck,
lint, all 402 tests across 23 files, and the production build passed.

Soft-band check, 2026-10-23: desktop and 390px preview checks confirmed aligned
selection fills without box outlines, rounded band ends, a home-row anchor dot
(each row on mobile), and tap-to-clear. Selected-label contrast measured
4.53:1–8.82:1 across TE-1, Gamut, and DOS in both appearances, using computed sRGB
colors clamped to the display gamut. Typecheck, lint, all 402 tests, and build
passed. Forced-colors styling has a system-color fallback but was not emulated.

Clock-change indicator check, 2026-10-23: only affected rows show a dashed
transition marker with Back/Forward and the exact change amount. The date-boundary
scan supplies offset changes too, without a second scan. Automated coverage
includes spring/fall, Lord Howe half-hour changes, rail endpoints, fractional
positions, selection, panning, and Vancouver's permanent Pacific time. Offline
desktop and 390px checks confirmed Back/Forward labels fit and remain visible
with a selected column, while current-time markers stay hidden. Across TE-1,
Gamut and DOS in both appearances, measured label contrast was 14.30:1–19.68:1;
the lowest observed marker contrast against a selected fill, including theme
transitions, was 7.22:1. Forced-colors fallback is present but was not emulated.
Node24 typecheck, lint, all 410 tests in 23 files, production and offline fixture
builds passed. No live analytics credentials were used.

Selection clearing update, 2026-10-23: deselection clears only the selected
instant, preserving the current rail frame and surfaced calendar date. This
supersedes the earlier tap-to-clear behavior that reset to Today. Regressions
cover both cities, future dates, scrubbing before/after selection, partial-hour
date selections, keyboard toggling, subsequent clock ticks, and explicit Today
reset. City clocks resume live time when no column is selected.
Offline browser verification confirmed a scrubbed future-date frame and calendar
selection survive clearing from another city and Advance minute; Today resets
the frame. Node24 typecheck, lint, all 413 tests, production and fixture builds
passed. The production preview on port4180 has the refreshed build.

Credits modal check, 2026-10-23: Credits is available in the desktop/mobile footer
and removed from Settings. The native modal retains GeoNames, licence, source
and adaptation details. Browser checks confirmed initial close-button focus,
Tab/Shift+Tab wrapping, blocked background app shortcuts, Escape, close-button
and backdrop dismissal, restored trigger focus, and background scroll locking.
The 320px dark appearance fits without horizontal overflow; desktop light was
also checked. Attribution links open separately to retain the current app view.
The original System appearance was restored after verification. Node24 typecheck,
lint, all 418 tests across 24 files, and the production build passed.

Credits placement update, 2026-10-23: City data credits now opens from Settings,
with the same text as the modal heading; the footer link is removed. Desktop
and 320px browser checks confirmed the modal fits, focus wraps, and closing
returns focus to the credits menu item while keeping Settings open. Typecheck,
lint, all 418 tests, and the production build passed.

Credits refinement, 2026-10-23: the modal now has one heading, City data credits.
Selecting its compact Settings entry closes the dropdown; the modal is mounted
separately so it survives the dropdown exit. Closing returns focus to Settings
without reopening the menu. Desktop verification measured the entry section at
38px (25px button); coarse-pointer styling retains a 44px touch target. Desktop
and 320px browser checks passed for dismissal, focus wrapping and modal fit.
Typecheck, lint, all 418 tests, and the production build passed.

Desktop breakpoint update, 2026-10-23: the Settings text label now appears from
1024px, matching the presentation previously reserved for 1280px. Browser checks
at 1023px, 1024px and 1280px confirmed the label threshold and no horizontal page
overflow. All nine Settings tests and the production build passed.

Breakpoint consolidation, 2026-10-23: credits modal padding now changes at 768px
instead of 640px. No app components use sm: responsive classes. Compiled modal
styles, all four credits tests, and the production build passed.

Icon-only Settings check, 2026-10-23: below 1024px, Settings matches the calendar
button's control background, 8px padding/radius, 40px width and shared height,
in both open and closed states. Browser checks at 390px, 1023px and 1024px
confirmed the matching icon controls and preserved labelled desktop styling.
All 13 Settings/credits tests and the production build passed.

Logo tint check, 2026-10-23: mobile and footer wordmarks share a restrained
accent/foreground mix in Oklab, keeping light-mode logos dark and dark-mode
logos legible. Browser-computed SVG fills matched the wordmark color in all
three designs and both appearances; the original theme selections were restored.
All 60 App/Settings tests and the final production build passed. No screenshots
were included, following the user's preference.

Logo sunrise check, 2026-10-23: the sun-shaped o rises once over 1.6 seconds,
using a translated SVG group inside a fixed clip. The other seven paths and
the final wordmark geometry stay unchanged. Desktop and 390px browser checks
observed the entrance transform and its static final position; each mounted
logo has a unique clip reference. Motion is opt-in through the no-preference
media query, leaving the logo static for reduced motion; live preference
emulation was unavailable. Node24 typecheck, lint, all 418 tests across 24 files,
and the production build passed. The local preview on port4180 is refreshed.

Curved sunrise refinement, 2026-10-23: the fixed reveal now reuses the sun's
exact SVG silhouette instead of a rectangle, matching its curved lower edge
without a second copy of the geometry. Desktop and 390px browser checks
confirmed matching clip/path data and the entrance transform; the desktop sun
settled without a transform. Duration and reduced-motion handling are unchanged.
Node24 typecheck, lint, all 418 tests, and the production build passed.

Compact off-screen clock-change check, 2026-10-23: `toronto-fall` seeds Vancouver
home on Oct 31. Select Nov 1 to expose Toronto/New York rollback hints at the
left edge. A nearby change can also appear at the right edge after scrubbing;
hints stop beyond six hours outside the viewport. Enter or click centers the
instant across every row, updates the home-calendar date, preserves selected
clock times, and returns focus to the activating timeline. Visible markers keep
their existing Undo/Redo icons; edge hints swap in directional chevrons.
At 1280px and 390px, both visible marker and hint labels measured 70.21 by 18px
for Back 1h. The transparent button target is 24px high to avoid intercepting
the hour label above it. Browser checks confirmed first-slot selection beside
the hint, light/dark appearance, hints over a selected band, both directions,
and tap/keyboard reveal without changing clocks. No page overflow or console
errors were observed. Physical touch and screen-reader speech were not tested.
Node24 typecheck, lint, all 425 tests across 24 files, and production/fixture
builds passed; final builds and mobile selection checks also passed after the
hit-area adjustment. No live analytics credentials were used. Port4180 has the
refreshed production preview.

Date control refinement, 2026-10-23: the date-and-X button replaces the calendar
icon when the surfaced date lies outside the seven-day strip. Desktop and 390px
checks on Nov 1 confirmed the date-and-X button remains, the calendar icon and
dropdown are absent, and focus moves to the date button after selection. Clicking
X returns both timelines to live Today and restores focus to the closed calendar
icon. No mobile page overflow was observed. Node24 typecheck, lint, all 427 tests,
and the production build passed.

Header cursor check, 2026-10-23: one scoped base rule supplies pointer cursors
to enabled header buttons, selects and links, including the portaled calendar.
Browser-computed cursors confirmed date strip/calendar/date-and-X buttons,
calendar navigation and enabled days, Settings actions, city search choices,
and search clear use pointer. Disabled calendar actions remain not-allowed;
the city search input retains its text cursor. All 60 date/calendar/Settings/
city-search component tests and the production build passed.

Scrub flicker correction, 2026-10-23: the supplied recording showed background
flashes while moving across whole-hour rail rebases. Cells were keyed by column,
so React reused a box for a different instant while its 75ms color transition
still reflected the previous hour. Cells now retain identity by exact instant;
regressions failed before the fix and passed in centered and fixed-date modes,
including forward/backward rebases. During pointer drags, cells suspend pointer
targeting and color transitions so moving columns cannot retrigger hover fills.
Offline browser drags at 1280px and 390px confirmed those computed styles during
the drag, restored targeting/transitions afterward, aligned row frames, and
unchanged clocks/selection. No page overflow or console errors were observed.
Physical touch was not tested. Node24 typecheck, lint, all 429 tests across
24 files, and production/fixture builds passed. Port4180 has the updated build.

Date-strip flicker correction, 2026-10-23: selected days previously used a
200ms transition on every property, including a drop-shadow filter. The Today
label/dot also exited and entered in separate fade steps. Date selection now
updates immediately, the selected tile uses an equivalent box shadow, and one
indicator remains mounted through Today/future switches. The indicator identity
regression failed before the fix and passed afterward. Desktop and 390px browser
checks across several dates and back to Today confirmed exactly one selected
day, zero-duration/no-filter selection styling, and one full-opacity indicator.
No mobile overflow or console errors were observed. Node24 typecheck, lint,
all 430 tests across 24 files, and the production build passed. Port4180 is
refreshed; no live analytics credentials were used.

## Existing-app improvement verification — 2026-10-23

The integrated candidate passed28 Chromium checks across desktop/narrow profiles,
plus517 unit/component tests,20 offline timezone-checker tests, typecheck, lint,
production build and16font asset verification. Added browser coverage exercises
real two-tab conflict resolution, safe invalid/cleared storage, quota recovery,
keyboard-visible city actions, Undo/focus/invalidation, long-label containment and
allthree local font designs. No external request/CSP allowlist remains.

The fixture build deliberately keeps publicDir:false and copies only listed font
assets after bundling. Vite may warn that /fonts public paths resolve at runtime;
actual first-party requests are verified by the strict browser suite. Production
builds resolve those public paths normally. The known full-IANA chunk-size warning
remains the documented accuracy/download tradeoff, not a failed check. Physical
touch, Safari, screen-reader speech and remote services remain outside this run.
