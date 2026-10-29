# Bundled timezone rules

The app uses the `@js-joda/timezone` provider with `@js-joda/core`, pinned in
the lockfile, for offsets, date boundaries, clocks and timeline cells. Its empty
bundle loads the full reviewed rules from `src/utils/timezoneRules.json` through
the supported `ZoneRulesProvider.loadTzdbData` API before any zone is resolved.
The reviewed release, source hashes and release notes are recorded in
[timezone-provenance.json](timezone-provenance.json) and
[timezone-release.md](timezone-release.md). Rules do not depend on visitors'
browser/OS timezone data and require no runtime geocoding or timezone service.
The browser is used only to detect the initial zone and format locale-neutral
calendar labels; an unknown detected zone safely falls back to UTC.

Names and backwards-compatible aliases are generated into
`src/utils/timezoneAliases.json` from the same compiled IANA source as the rules.
No npm metadata release is required. The unsupported, non-geographic `Factory`
placeholder is excluded, matching the provider’s upstream builder. Geographic link names remain searchable, so shared rules do not remove
cities such as Kampala. Existing stored timezone identifiers and custom labels
are preserved. Validation and analytics canonicalization use the same metadata.

## PCT naming

BC's September 17, 2026 announcement establishes **PCT** as Pacific Time's official
abbreviation. For America/Vancouver and its aliases, the display uses PCT from
that announcement date onward, with a UTC−07:00 tooltip. Older dates keep their
historical database abbreviations. The offset itself always comes from the
bundled rules, including the decision not to fall back in November 2026.
This display override does not apply to every BC timezone: existing local
mountain-time arrangements remain separate.

Published IANA abbreviations and official local naming can differ. Other labels
use the pinned provider's abbreviation data; numeric abbreviations are rendered
as explicit UTC offsets. A small adapter to the pinned provider's abbreviation
table has contract tests; offset calculations use its public API. Review that
adapter when changing the provider version.

## Repeatable update process

Normal installs and builds use pinned local data. They do not download latest
rules or silently change output. To check for a published update:

```
npm run tz:check
```

This read-only command verifies bundled rules/source/generated metadata agreement,
then compares with IANA's current release. IANA multi-letter release suffixes
are supported. Every version discrepancy requires review, even if the endpoint
reports an older release; the checker never chooses an automatic downgrade.

| Exit | Outcome | Next step |
| --- | --- | --- |
| 0 | Timezone data current | Pinned local versions agree with IANA. |
| 1 | Timezone review needed | Review a published version difference or a missing/mismatched local provider, source or generated version. Follow the update process below. |
| 2 | Timezone check unavailable | IANA could not be checked because of a network error, 15-second timeout, HTTP error or unexpected response. Check availability before inferring whether data is current. |

The command prints the outcome and, in GitHub Actions, appends a matching heading
to the job summary. Neither failure outcome is silently converted to success.
Offline classification tests run with Node's built-in runner:

```sh
node --test scripts/test-timezone-check.mjs
```

### Automated update PRs

[Timezone freshness](../.github/workflows/timezone-freshness.yml) runs daily at
**14:17 UTC** and supports manual `workflow_dispatch`. With no new release, it
verifies local provenance, checks IANA once and exits successfully without writes.
A newer release runs the pinned upstream generator, prepares rules and aliases,
generates independent regression expectations, and opens **one update PR per
release** on `automation/timezone-VERSION`. The PR includes IANA release notes,
changed zones/aliases, added/removed names and source hashes.

The workflow explicitly dispatches the full [CI workflow](../.github/workflows/ci.yml)
on the PR branch. This avoids relying on a normal `pull_request` run triggered
by `GITHUB_TOKEN`, which GitHub may require a maintainer to approve. No PAT or
additional credential is needed. Typecheck, lint, unit/component tests, offline
maintenance tests, desktop/narrow Chromium checks and a production build run
against the proposed commit. CI failures remain visible for human review.

Existing legislation-specific regressions are never automatically rewritten to
make a new release pass. Review legitimate rule changes and adjust those cases
as needed when a release conflicts with them. A separate
[merge gate](../.github/workflows/timezone-auto-merge.yml) now merges eligible
updates automatically after full CI succeeds. Merging then explicitly dispatches
the existing Pages workflow, since a `GITHUB_TOKEN` merge does not trigger its
normal push event.

### Automatic merge gate

The trusted default-branch workflow reacts to completion of **Validate pull
requests**. It never checks out or executes PR code with its write token.
Before a squash merge, it verifies all of the following:

- The PR and its sole commit were created by `github-actions[bot]` in this
  repository, on `automation/timezone-VERSION`, targeting the default branch.
- Only the five generated data/provenance/report files changed, with no removals
  or renames, and the version is newer than the current bundled release.
- The exact PR head has a successful explicitly dispatched full CI run. Every
  install, typecheck, lint, unit/regression, maintenance, Chromium, browser and
  build step must have succeeded.
- All latest workflow runs, check contexts and commit statuses for that head
  are successful. Pending, failed, cancelled, neutral or skipped checks hold it.
- The PR is open, ready, mergeable and has no outstanding request for changes.
  Neither the head nor base has moved during verification. Main must still be
  the commit against which the update was generated/tested.

GitHub may hold the normal PR-triggered CI run for approval when the publisher
uses `GITHUB_TOKEN`. After verifying the data-only bot PR and successful dispatched
full CI, the gate may approve **only that PR's CI workflow run**. It waits for
that run to finish successfully too; it does not approve PR reviews or bypass
checks. Repository branch rules still apply to the merge API.

Mark a timezone PR **draft**, request changes, or close it to stop automatic
merging. Human PRs, source changes, human edits and stale-base updates remain
for manual review/regeneration. Existing draft PRs are not automatically marked
ready. This gate does not enable repository-wide native auto-merge; the repository
has no required branch checks, so that toggle alone would not enforce CI.

For inspection or recovery, manually run **Merge validated timezone updates**
on the default branch with a completed `ci_run_id`. Its **dry_run** input defaults
to true and performs no approvals, merges or deployments. Set it false only to
apply the same gates. If a merge succeeded but Pages dispatch failed, rerun the
existing Pages workflow on main; the merge is not undone.

Repeated runs preserve both open and closed PRs for the same release. Closing a
PR declines that release until an operator deliberately reopens/recreates it.
An update branch with different work is never force-pushed. If main advances
while a candidate is generated, publication fails and the next run regenerates
against the new base. Network errors, source/build failures, invalid metadata,
older endpoint releases and independent oracle failures remain failures with
Actions diagnostics; they never become an automatic downgrade or green result.

Generation runs with read-only repository permissions. A separate job receives
only an allowlisted data artifact, verifies hashes again, and uses scoped
`contents:write`, `pull-requests:write`, and `actions:write` permissions to create
the branch/PR and dispatch CI. Candidate scripts or patches are never executed
in that job. Repository Actions settings must allow GitHub Actions to create PRs
(the API names that combined creation/approval policy
`can_approve_pull_request_reviews`). Default workflow permissions can stay read-only.

To exercise the complete generator without creating any branch or PR, run the
workflow manually with **dry_run=true** and **rebuild_current=true**. The latter
is rejected without dry_run. A verified candidate artifact remains available for
seven days; publishing is also disabled on non-default workflow refs.

If PR creation succeeded but CI dispatch failed, rerun validation explicitly:

```sh
gh workflow run ci.yml --ref automation/timezone-VERSION
```

Schedules require this workflow on the default branch. GitHub can delay scheduled
runs or disable inactive schedules. Notification delivery depends on the owner's
repository/account settings; check Actions for inactivity and failures.

### Generator and independent regressions

The upstream generator is pinned to js-joda commit
`dbdecb00b7fded90be6dcb09339f1bfbb8dc3101`, with `zx@8.8.5`. It downloads the
matching official IANA tzdata/tzcode archives, builds `zic`, compiles rearguard
TZif files, and generates the provider’s full historical and projected data.
No downloading or generation occurs during a normal app install/build.

A separate Python stdlib `zoneinfo` reader loads those compiled TZif files to
produce expected offsets and wall-clock fields. It does not use the js-joda
builder’s parsed offset arrays as expected values. Tests cover January/July for
every zone/alias, plus instants immediately before/at/after changed offset or
abbreviation boundaries compared with the previous bundle. Generated expectations
live in `tests/fixtures/timezone-regressions.json`, outside production code.
Existing hand-written clock, date-boundary, alias and browser regressions also run.

The initial automated fixture records the 2026e→2026f transition: 23 changed
zones/aliases and 1,502 oracle samples. Rebuilding 2026e with the same generator
exactly matched the former provider package’s data. Source archive and output
SHA-256 hashes are recorded in the generated provenance manifest; local checks
and CI reject changed rules, aliases or fixtures without matching provenance.

For a local update, use Node24, npm dependencies, Python3 with `zoneinfo`, Git,
`make`, `cc`, `tar`, and network access to GitHub, npm and IANA:

```sh
npm ci
npm run tz:update -- --version VERSION
npm run tz:check
npm run test:maintenance
npm run typecheck
npm run lint
npm test
npm run test:browser
npm run build
npm audit
```

`tz:update` checks out the pinned builder into an isolated temporary directory and
cleans it on completion/failure. For a reviewed existing upstream checkout, supply
`--builder /absolute/path`; the commit and tracked generator source are checked.
`--baseline /absolute/path/to/previous-rules.json` can replay an older release
comparison locally. These are local generator options, not workflow inputs.

Review `docs/timezone-release.md`, provenance hashes, generated samples and any
CI failures. Check city mappings if names change. Review official display-name
overrides such as PCT when their affected rules change. Commit the five generated
files together. Provider/core upgrades and changes to the pinned generator remain
separate reviewed work. Normal `npm run tz:check` remains a read-only command
that fails for stale data, mismatches or unavailable IANA responses.

Published databases include historical records and future projections, not a
guarantee about unannounced laws or dates beyond the provider's projected data.
Using the full provider avoids the much shorter date limits of reduced-range
browser bundles. Future legislative changes require a reviewed data update and
release; this implementation does not promise to discover unknown rules offline.

The full rules add about 87 kB compressed to the initial JavaScript compared with
the prior build. This is the chosen tradeoff for device-independent rules and
historical edge cases. Builds report a large-chunk warning because the highly
compressible rules are bundled; runtime collection and network behavior are
unchanged.

Sources: [IANA releases](https://www.iana.org/time-zones),
[IANA changes](https://data.iana.org/time-zones/tzdb/NEWS),
[BC PCT announcement](https://news.gov.bc.ca/releases/2026CITZ0009-001073),
[js-joda timezone provider](https://github.com/js-joda/js-joda/tree/main/packages/timezone).
