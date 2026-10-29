# Plan 022: Design incremental city-search improvements from evidence

## Status and execution contract

- Status: OPTIONAL DESIGN; planning is authorized, implementation is not started.
- Priority: P3; effort: M; change risk: MED; category: direction.
- Planned at: `b4100f9`, 2026-10-23.
- Depends on: 013 before implementation; existing search reports are optional evidence, not a live-service prerequisite.
- Repository checkout: `/Users/mohammed/Documents/Cursor/daybound-web-app`.
- Assigned isolated worktree: `/Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app`.
- After implementation is requested, use the assigned isolated worktree and local commits only. Do not push, deploy, open PRs, change dashboards, or change global runtime/model settings. The primary integrator owns index status and final validation.

Read the whole plan first. Run `git diff --stat b4100f9..HEAD -- plans/022-search-quality-design.md` and `git status --short`. Reconcile dependency edits against the excerpts and record expected differences. Stop for unexplained semantic drift, conflicting dirty work or an incomplete dependency; never overwrite someone else's work.

## Runtime, conventions and verification ownership

Use Node24 (`node --version` reports v24.x) and npm; run `npm ci` when dependencies are absent or the lockfile changes. Session-local alternative: `npm exec --yes --package=node@24 --package=npm@11 -- npm <arguments>`. Match React18 functional components, strict TypeScript, theme-token Tailwind classes and existing Testing Library/Vitest patterns. Never use real analytics credentials for verification.

Run focused checks below plus `npm run typecheck` and `npm run lint` for retained code changes (all exit0). The primary integrator owns one complete `npm test`, `npm run build` and browser-suite run on the final integrated candidate. A planning-only/no-change outcome needs document checks, not a redundant product rebuild. Do not confuse local results with remote CI or deployment.

## Scope

Only the following paths, this plan's execution notes and the integrator-owned index may change:

- `plans/022-search-quality-design.md`

## Why this matters

Picker search currently normalizes only case and underscores/spaces, uses substring matching in catalogue order and caps available results at50. Better ranking and accent/alternate-name matching could improve discovery. Missing-city/follow-up/outcome reports exist, but this audit did not inspect live demand, so do not invent the most-requested cities.

## Current state and accepted boundaries

`src/utils/cityCatalog.ts` intentionally differs from analytics recognition:
```ts
const normalize = (value: string) => value.toLowerCase().replace(/_/g, " ");
// ... catalogue order, deduplicate by stable id
return { availableResults: available.slice(0, 50), alreadyAddedResults: alreadyAdded };
```
`cityCatalog.test.ts` explicitly preserves these rules: São Paulo and country-qualified Amsterdam currently do not match; stable IDs are `timezone|name`; direct IANA entries win displayed-result precedence while aliases supply preferred metadata. `AddTimezone.tsx` uses this picker for keyboard navigation and journey result counts. Analytics-only GeoNames data is lazy, covers34179 entries, and must not be eagerly shipped as the picker. Existing users cannot add two rows with the same exact timezone string. Missing-city demand does not itself authorize changing that constraint.

## Recommended initial product policy (needs acceptance before code)

1. Keep stable IDs, direct/alias metadata precedence, canonical saved labels and exact timezone duplicate behavior. Fold accents for matching only; preserve display spelling. Support existing underscore/space/IANA forms. Treat punctuation/country qualifiers with explicit tested normalization, not a locale-wide destructive ASCII rewrite.
2. Rank exact display-name matches, then word-prefix matches, then substring matches. Preserve current catalogue order as the stable tie-breaker within a tier; don't infer a user's country/location. Already-added matches retain separate semantics and don't become selectable duplicates. Keep the50 available-result cap and report actual displayed counts.
3. Add a small reviewed set of aliases/cities only when their actual timezone/identity can be verified. A different city sharing an existing row's timezone must be described honestly, not counted as successful discovery of the requested place. No ambiguous-name auto-selection.
4. Treat typo tolerance as a separate design experiment: for inputs of at least5 letters, test whether a uniquely better one-edit candidate can be suggested explicitly without auto-adding. If ambiguity/latency is poor, defer it; don't introduce a heavy fuzzy-search library or runtime geocoder for speculative value.

## Steps and design verification

1. Create `plans/022-search-quality-design.md` with an offline query/result matrix from the existing picker: exact/prefix/substring, accents, country-qualified inputs, IANA strings, aliases, same names in different countries, already-added timezone, empty input, max50 cap and a few misspellings. Record expected before/after ordering and the precise normalization/ranking contract. Verify each before row against the actual `searchPicker` source/tests and `git diff --check` exits0; don't silently redefine by-design behavior as a bug.
2. If later authorized to read PostHog, use existing aggregated missing-city/follow-up/selection reports to choose catalogue candidates. This plan grants no dashboard access, mutation or search-word export. Without live data, use a synthetic acceptance set and mark catalogue additions unselected. For any future city addition require primary-source timezone mapping/provenance and an ambiguity review; don't assume the most plausible match is correct. Verify the design distinguishes observed data, synthetic examples and unanswered demand questions.
3. Describe future implementation boundaries: `src/utils/cityCatalog.ts` + tests; `src/utils/timezoneUtils.ts` only for reviewed alias entries; `src/app/components/AddTimezone.tsx` + tests only if suggestion UI is approved; analytics projection/recognition tests and docs if picker membership changes; no changes to consent/sampling/retention. Add a test matrix that verifies `timezone_search_attempted` counts/missing_city/search_match_failure match actual new results, stable selection IDs still validate, and follow-up linking remains intact. Future focused gate: `npm test -- src/utils/cityCatalog.test.ts src/app/components/AddTimezone.test.tsx src/analytics/searchCatalog.test.ts src/analytics/searchJourney.test.ts src/analytics/analytics.test.ts src/analytics/structuredEvents.test.ts`, plus typecheck/lint and013 keyboard/search smoke. Obtain acceptance of the matching/ranking change before source edits.

## Done criteria

A self-contained design file contains the normalization/ranking truth table, unchanged identity/duplicate rules, bounded performance experiment, analytics compatibility tests, city-provenance requirements, and explicit unanswered choices. Optional typo/city additions are not hidden implementation requirements. Current phase produces no source/data/dashboard change.

## STOP conditions and maintenance

Stop if improving search requires changing one-row-per-timezone behavior, eagerly loading the wider analytics catalogue, resolving ambiguous places by guess, accessing live analytics without authorization, or broadening free-text collection. Stable picker identities and analytics projections are one product contract; update tests/documentation together when an accepted change alters membership.
