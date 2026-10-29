# Search discovery reports

The source implements events for search attempts, offered results, follow-up
attempts and standard city/timezone selections. These report templates require a
published build with valid public PostHog configuration and successfully delivered
events before they can show data. As of the source/document review on 2026-10-23,
live ingestion, dashboard population and deployment status are unverified here;
this local review did not access a dashboard or change production settings.
Local preview/development collection stays disabled.

Settings and manually chosen reference cities are covered in the
[structured usage reports](usage-analytics.md).

## Reports to add in PostHog

1. **Missing cities:** event `timezone_search_attempted`, filter `search_version = 2`
   and `missing_city = true`. Break down by requested_city and requested_country;
   requested_region and requested_city_id distinguish places with similar names.
   This means a city was recognized in the wider catalogue but had neither
   available picker results nor already-added results, and its standard name/timezone
   is absent from the picker. Supported names that fail to match (for example
   a country-qualified search) use search_match_failure instead. [SQL table](posthog/missing-cities.sql).
2. **Follow-up searches:** [SQL table](posthog/follow-up-searches.sql) links consecutive
   attempts within the same search after a no-result attempt. Known names are
   shown; unrecognized words appear only when sampled and eligible. `[text not
   recorded]` is deliberately not a literal search term. Country is absent for
   ambiguous names; do not assume the city belongs to a particular country.
3. **What people eventually select:** [SQL table](posthog/search-outcomes.sql)
   connects the first failed attempt to the eventual standard city/timezone.
   Utrecht → Amsterdam is classified as a different city in the same timezone,
   not successful discovery of Utrecht. No selection is an observation, not
   proof that someone abandoned their goal.
4. **Unknown failed words:** a Trends/table report on `timezone_search_attempted`,
   filtered to `filtered_query is set`, broken down by filtered_query. This is a
   sample, not all failed searches; do not divide it by all attempts to claim an
   overall conversion rate.

Use **Product analytics → SQL** for each SQL table and save it as an insight in
your dashboard after the new events exist. The templates use documented HogQL
syntax and a one-day window. Local synthetic-data checks verify their sequence
and outcome logic; the recorded local verification does not establish live HogQL execution (live status unverified as of the 2026-10-23 document review). Check the
live event/property schema before saving. Widen the window after checking volume.
The time filter is a view of data, never a deletion promise.

## What gets recorded

`timezone_search_attempted`: search_id, attempt number, elapsed milliseconds,
query length/word count, displayed available-results count (max 50), already-added
count, recognition/candidate count, no_results/follow_up/missing_city/search_match_failure flags.
For uniquely recognized cities it adds the GeoNames ID, standard name, country
code, administrative region and timezone. An ambiguous name can include its
standard name, but no guessed country or city ID.

`timezone_search_selected`: same search_id and attempt, plus the standard picker
city, country, timezone and a stable picker result ID. A GeoNames city ID is
included only when the selected place can be resolved uniquely. Custom row
labels and row IDs are excluded.

`timezone_search_closed`: observed Escape/outside-click/focus-leaving-search and
the same search_id/last attempt. Elapsed time starts at the first recorded
attempt; the offline clock fixture deliberately freezes wall time. There is no unload/beacon request. Page closure,
reload, interruption or delivery loss can therefore leave an unknown outcome.

The old count-only `timezone_search_no_results` event continues for existing
charts. It counts settled/committed no-result attempts, deduplicated within the
current search; a later new search can count the same term again. Do not add its
counts to the new attempt events; that would double-count failures.

## Collection and privacy choices

- Requests are grouped with a fresh random search_id, held only in memory.
  It is not a person identifier. Selection/observed close ends that journey;
  another journey starts after 30 minutes or 100 distinct attempts. Clear search
  keeps the journey open so the replacement can be a follow-up.
- Capture follows a 700 ms typing pause, or a final choice/close. Keystrokes are
  not individually reported. Case/space-only edits with unchanged result counts are deduplicated.
- Approximately 10% of journeys may include at most 3 filtered, unrecognized,
  no-result search terms. Inputs containing digits, emails, URLs, control
  characters, secret-like markers, more than 5 words or more than 64 characters are
  excluded as whole inputs. Filtering reduces risk; it cannot guarantee that
  text contains no personal information. Sample selection is independent of the
  words typed. Ambiguous known-city names are not sent as free text.
- **User-approved retention:** sampled words use the project's normal PostHog
  event retention. There is no seven-day deletion rule. The initially discussed
  seven-day policy was replaced by the user's explicit choice because PostHog
  does not support that per-event deletion policy.
- Opt-out/browser privacy signals/storage failure still stop collection and
  cancel pending requests. Classification waiting for a catalogue load is
  discarded on opt-out/unmount; opt-in does not replay the text already present.
  No SDK, automatic capture, replay, persistent person identity, URL/referrer,
  retry queue or unload delivery is introduced.
- Settings describes the new collection honestly. The broader catalogue is
  analytics-only, split into 27 small initial-letter files and lazy-loaded from this site's own assets while analytics is
  enabled. It does not change picker results or send queries to a geocoder.
  It covers 34,179 larger cities/capitals plus their ASCII spellings, not every
  place/alias/misspelling. A failed catalogue load emits `unavailable`, with no
  search words. Ambiguous names are kept ambiguous.

## Local verification

Run `npm test -- src/analytics/ src/app/components/AddTimezone.test.tsx
src/app/components/SettingsMenu.test.tsx`, `npm run typecheck`, and `npm run lint`.
`python3 scripts/check-search-reports.py` checks report logic with synthetic
events using SQLite-compatible equivalents; it is not a live HogQL execution.
The existing offline browser fixture generator can intercept these real events.
Use `?analytics=on&sampleSearches=1` on that fixture only to make text sampling
deterministic. Never set this on the product; normal loopback collection stays off.

References: [anonymous events](https://posthog.com/docs/data/anonymous-vs-identified-events),
[event capture](https://posthog.com/docs/api/capture),
[retention limits](https://posthog.com/docs/data/events-retention),
[GeoNames licence/data](https://download.geonames.org/export/dump/readme.txt).
