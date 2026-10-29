# Daybound

Daybound is a time zone dashboard for comparing local times across distributed teams.

## Development

Use Node24 (`.nvmrc`) and npm. Install the locked dependencies, then start Vite:

```sh
npm ci
npm run dev
```

Vite prints the local development URL. These checks run independently:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high
```

`npm run build` writes `dist/`. To inspect that production build locally:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open [the local production build](http://127.0.0.1:4173). Analytics is disabled on loopback hosts. The offline browser fixtures use a separate port and output directory; see [fixture instructions](docs/browser-testing.md). The primary validation owner runs the complete suite once on the integrated candidate; other work uses focused checks.

## Dates and local saving

The rail contains 25 consecutive elapsed-hour cells. Choosing a future date sets all city clocks to the current home-city time on that date. Tapping a slot selects its exact instant and highlights the matching column across cities. Tapping the highlighted column again returns the clocks to live time while preserving the browsed rail and calendar date. While a time is selected, the time line and pill are hidden. Selected clocks and their local dates hold until another selection, deselection or Today; changing home city preserves the instant. Choosing another date retains the selected home-city time of day. Today and reload restore live clocks. Missing midnight uses the first existing instant, repeated midnight uses its earliest occurrence, and a wholly skipped date is unavailable. When moving a clock time between dates, a missing time shifts forward through the gap; a repeated time prefers the original UTC offset when available. Fractional offsets and DST changes retain their exact instants. See the [interaction truth table](docs/maintenance-decisions.md#interaction-truth-table) for clock, rail and calendar behavior.

Time zones, labels, themes and display settings use browser `localStorage`. Valid saved rows and fields survive partial recovery; malformed values fall back safely. If storage is blocked or full, changes can remain available for the current visit and the app displays a saving notice. It cannot promise that those changes will survive reload. Selected dates are transient. If another tab changes a saved group, Daybound keeps this tab's version and asks which setup to use. Until that choice, edits to that group stay in memory. Storage is not atomic: simultaneous writes are last-writer-wins on disk; the losing tab retains its version when it observes the difference. Resolve the notice before closing or reloading, which discards that tab's recovery copy. Cleared or invalid saved data never silently replaces a known setup during a visit.

Removing a city offers one Undo action for five seconds, paused while hovered, focused or the page is hidden. Undo restores its label and position without changing the chosen time or home city. A new removal replaces the previous Undo; an external city-list change cancels it. New labels use the same1024 UTF-16 code-unit limit as saved optional text.

## Optional usage analytics

The app works without analytics configuration. To configure a production build, copy `.env.example` to `.env.local` and supply a public PostHog project token and HTTPS ingestion origin:

```sh
cp .env.example .env.local
```

`VITE_PUBLIC_POSTHOG_KEY` expects a public `phc_` token; `VITE_PUBLIC_POSTHOG_HOST` expects an HTTPS origin without credentials, query, fragment or path. Vite embeds `VITE_*` values into the browser bundle; they must never contain secrets. Leave both blank to disable analytics. Development, tests and loopback hosts do not send usage events.

Settings includes an opt-out control. Analytics records explicit usage actions, structured settings changes, manually chosen reference cities/timezones, and linked search attempts/outcomes. Search reports include standard requested/selected cities and timezones; approximately10% of search journeys can include up to3 filtered, unrecognized failed-search terms. Those samples follow the project's normal PostHog retention, not a seven-day deletion policy. Custom row labels, page URLs/referrers, session recording and automatic interaction capture are excluded. See [settings/reference-city reports](docs/usage-analytics.md) and [search reporting and privacy details](docs/search-analytics.md) for filters, limitations and dashboard report templates.

Requests use an ephemeral identity for the current page, omit credentials and disable person profiles and GeoIP enrichment. There is no batching, retry or unload delivery. Opt-out cancels pending requests; a request already dispatched may already have reached the server. Failed consent writes disable capture for the visit and report that the preference could not be saved. Browser privacy signals and cross-tab opt-out are respected. The broader analytics city catalogue loads lazily from this site's own assets; queries are never sent to a geocoding service.

## Static deployment

The existing Pages workflow validates and builds `dist/`, then publishes it on main pushes or manual dispatch. It reads the optional public analytics variables from the configured GitHub environment. `public/CNAME` carries the custom domain `daybound.work` into the static output. DNS and Pages domain settings must match that domain. Deployment and external settings changes require separate authorization; this maintenance work creates local commits only.

## Project structure

- `src/app/`: App, controls and row/rail components.
- `src/hooks/`: Clock and persistent-state hooks.
- `src/utils/`: Calendar, timeline, persistence and timezone helpers.
- `src/analytics/`: Minimal usage transport and React provider.
- `scripts/browser-fixtures.mjs`: Ignored offline smoke-page generator.
- `docs/`: Current behavior, analytics reports, timezone updates and browser testing.
- `plans/`: Maintenance plans, review decisions and deferred feature designs; see the [plan index](plans/README.md).

See [maintenance decisions](docs/maintenance-decisions.md) for behavior to preserve
and verification limits.

## Timeline exploration and timezone updates

Drag or swipe a timeline to explore all cities together; horizontal trackpad
scrolling also works. With a timeline focused, use arrow keys, Shift+arrow keys
or Page Up/Down. Exploration
can move 24 hours in either direction from its starting point, including backward
from a selected date across midnight. Browsing holds the view without changing the clocks.
The top date controls follow the home-city date at the rail’s reference instant
(the center in Today mode, the leading edge for a chosen date); selecting a slot
sets the calendar to that instant's home-city date. Press Enter or Space to select
the slot at the reference point. Tap today’s date (or press Home) to restore live
time, including when Today is already selected. Choosing a date resets the pan.
Vertical page scrolling and pinch zoom remain available.

Clock changes show a compact Back/Forward indicator on affected rows. Changes
within six hours outside the visible timeline appear at its edge with a chevron;
activate the indicator to center the change across all rows. Selected clock
times stay unchanged, and the calendar follows the home-city date at the change.

Calendar popups fit the visible viewport, opening above the trigger or scrolling
internally when needed.

Timezone rules are bundled independently of device updates, including BC's
permanent Pacific Time/PCT. See [timezone sources and the update process](docs/timezone-data.md).
Run `npm run tz:check` to compare the pinned rules with IANA's current release.
The daily timezone workflow prepares one update PR per new IANA release,
with independent regression samples and full CI. Eligible bot updates merge and
publish automatically after every check passes; draft status or requested changes
hold the merge; see [timezone operations](docs/timezone-data.md).
