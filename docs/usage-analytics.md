# Structured settings and reference-city reports

These explicit events restore useful product choices without sending editable
labels or arbitrary settings objects. They use the existing PostHog transport,
opt-out, browser privacy signals and normal event retention. Reports require a published build with valid public analytics configuration and
successful event delivery. As of the source/document review on 2026-10-23,
deployment, live ingestion and report population are unverified here. This local
review did not access a dashboard or change production settings.

## Settings choices

Event: `settings_changed`. Each event contains only `setting` and `value`, plus
the transport's existing anonymous-event flags.

| setting | permitted value |
| --- | --- |
| time_format | 12h, 24h |
| appearance | light, dark, system |
| design_theme | te-1, gamut, dos |
| timezone_badge | true, false |
| weekend_indicator | true, false |

In PostHog Trends, select `settings_changed`, filter `setting` to the row you want,
and break down by `value`. This answers which choices people actively make.
Clicking an already-selected choice does not count as a change. Appearance records
the selected option; system means the system option, not the resolved screen color.

There is no settings snapshot on startup, reload, restoration or opt-in, so these
reports cannot describe the current settings of all visitors. Counts are actions,
not unique people. The existing identity lasts only for the current page.

## Chosen reference city

The existing `home_timezone_changed` event now includes:

- `reference_timezone`: a validated, canonical IANA timezone.
- `reference_result_id`, `reference_city`, `reference_country`: included only when
  a standard picker city is known and matches that timezone. All are rebuilt from
  fixed picker data; editable row labels and stored custom country strings are ignored.

For example, choosing Seattle and then renaming its row to a team name still
reports Seattle and America/Los_Angeles when explicitly made the reference city.
The standard picker city is retained in the existing local row's `city` field;
renaming changes only `label`. This metadata is saved even with analytics off,
so later explicit actions can retain the correct standard identity.

Older saved rows and automatically initialized rows may lack reliable standard
city metadata. They report only the timezone when manually made the reference
city. We do not guess a city from an editable label or assume Los Angeles when a
row might originally have represented Seattle. Legacy IANA aliases are canonicalized.
Unknown/mismatched city identifiers cannot inject custom text into the payload.

In Trends, choose `home_timezone_changed`, filter `reference_timezone is set` to
exclude older count-only events, and break down by `reference_timezone`. For a
city report, additionally filter `reference_city is set` and break down by
`reference_city` (use country/result ID when distinguishing places).

Only a deliberate change to another reference row emits this event. Initial
browser timezone detection, saved-row restoration, reload and selecting the
already-current reference row do not emit it. These reports describe chosen
comparison references, not verified physical locations or all visitors' home cities.

## Boundaries

Only new actions after opt-in are eligible; choices made while opted out are not
replayed. Custom labels, row IDs, full settings snapshots, URLs, referrers and
persistent person profiles remain excluded. Session replay and automatic capture
remain disabled. The existing filtered search sampling/retention policy is
unchanged; see [search reports](search-analytics.md).

Browser checks use the offline fixture and fake credentials only. The local
product preview keeps collection disabled. Reporting setup is manual; these
instructions do not claim that reports already exist in a live PostHog project.

References: [event capture](https://posthog.com/docs/api/capture),
[anonymous events](https://posthog.com/docs/data/anonymous-vs-identified-events).
