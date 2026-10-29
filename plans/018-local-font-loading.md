# Plan 018: Measure and remove unnecessary external font loading

## Status and execution contract

- Status: DONE; locally implemented, validated and staff-reviewed on2026-10-23.
- Priority: P3; effort: S–M; change risk: LOW; category: perf.
- Planned at: `b4100f9`, 2026-10-23.
- Depends on: 013; serialize package-lock changes and browser-fixture edits.
- Repository checkout: `/Users/mohammed/Documents/Cursor/daybound-web-app`.
- Assigned isolated worktree: `/Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app`.
- After implementation is requested, use the assigned isolated worktree and local commits only. Do not push, deploy, open PRs, change dashboards, or change global runtime/model settings. The primary integrator owns index status and final validation.

Read the whole plan first. Run `git diff --stat b4100f9..HEAD -- src/styles/fonts.css index.html public/fonts/ scripts/verify-font-assets.mjs scripts/font-measurement-build.mjs scripts/browser-fixtures.mjs tests/browser/fonts.spec.ts docs/font-assets.md plans/018-font-measurements.md` and `git status --short`. Reconcile dependency edits against the excerpts and record expected differences. Stop for unexplained semantic drift, conflicting dirty work or an incomplete dependency; never overwrite someone else's work.

## Runtime, conventions and verification ownership

Use Node24 (`node --version` reports v24.x) and npm; run `npm ci` when dependencies are absent or the lockfile changes. Session-local alternative: `npm exec --yes --package=node@24 --package=npm@11 -- npm <arguments>`. Match React18 functional components, strict TypeScript, theme-token Tailwind classes and existing Testing Library/Vitest patterns. Never use real analytics credentials for verification.

Run focused checks below plus `npm run typecheck` and `npm run lint` for retained code changes (all exit0). The primary integrator owns one complete `npm test`, `npm run build` and browser-suite run on the final integrated candidate. A planning-only/no-change outcome needs document checks, not a redundant product rebuild. Do not confuse local results with remote CI or deployment.

## Scope

Only the following paths, this plan's execution notes and the integrator-owned index may change:

- `src/styles/fonts.css`
- `index.html`
- `public/fonts/`
- `scripts/verify-font-assets.mjs`
- `scripts/font-measurement-build.mjs`
- `scripts/browser-fixtures.mjs`
- `tests/browser/fonts.spec.ts`
- `docs/font-assets.md`
- `plans/018-font-measurements.md`

## Why this matters

The first-party stylesheet imports a Google-hosted stylesheet, which then discovers font resources. Self-hosted fonts could remove these external steps and work in the offline fixture. Actual cold-load benefit has not been measured. Preserve the three designs and international user labels; don't replace fonts merely to lower a request count.

## Current state and constraints

`src/styles/fonts.css:1` is:
```css
@import url("https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&family=Inter:wght@100..900&family=Pixelify+Sans:wght@400..700&display=swap");
```
`index.html` preconnects to fonts.googleapis.com and fonts.gstatic.com. `src/styles/theme.css` uses Inter by default, Geist Mono for te-1 and Pixelify Sans for dos. The full rule/alias data bundle is intentional and is unrelated. The browser fixture has `font-src 'self'` and `publicDir:false`, so current remote fonts are blocked and fallback fonts appear. Match existing font-family names, weights, fallbacks and `font-display:swap`; font appearance is an accepted behavior, not disposable.

## Steps

1. Record cold-load request chains, font-ready time, transfer bytes and layout shift for each design at390px and1280px under one fixed recorded network/CPU profile. Create a local-only measurement build script `scripts/font-measurement-build.mjs` with this exact Vite boundary (Node24, no global/runtime changes):
```js
import path from "node:path";
import { build } from "vite";
await build({
  configFile: path.resolve("vite.config.ts"), envFile: false,
  define: {
    "import.meta.env.VITE_PUBLIC_POSTHOG_KEY": "undefined",
    "import.meta.env.VITE_PUBLIC_POSTHOG_HOST": "undefined",
  },
  build: { outDir: "node_modules/.cache/daybound-fonts/site", emptyOutDir: true },
});
```
Run `node scripts/font-measurement-build.mjs`, then serve only that ignored directory with `python3 -m http.server 4182 --bind 127.0.0.1 --directory node_modules/.cache/daybound-fonts/site` in an owned process; stop that process after measurement and leave the user's4180 preview alone. Use a fresh browser context/cache per sample. Before its first app navigation, an init script seeds only synthetic app_settings/timezone_config for the intended design, a fixed reference clock and the same small city list; preserve real monotonic timers. Measure from that first navigation, not by switching from the default theme. Run three samples per design/viewport with the identical setup. For the baseline only, allow the exact Google Fonts CSS URL in fonts.css and its returned WOFF2 requests on fonts.gstatic.com; record their URLs/Unicode ranges and reject other external requests. Never relax the automated offline fixture CSP/allowlist for performance measurement. Don't compare fixture fallback typography with production loaded typography. Save concise measurements and a recommendation in `plans/018-font-measurements.md`. If data shows no meaningful first-render/resilience gain, finish INVESTIGATED—NO CHANGE. If remote fonts or required profiling tools are unavailable, record BLOCKED/UNVERIFIED instead of treating missing evidence as no benefit; unclear licensing is also a blocker, not permission to vendor. Verify the record identifies the build SHA, actual loaded family and environment for every sample; `git diff --check` exits0.
2. For a justified candidate, vendor WOFF2 files from a reviewed official family source/release, recording source commit/version, original URLs, weight/Unicode coverage, checksum and license text in `docs/font-assets.md` and `public/fonts/`. Resolve those sources/licensing at execution; never download arbitrary mirrored font files. Use first-party `@font-face` rules and relative/base-safe URLs. Preserve glyph coverage present in the existing font delivery (especially diacritics); don't silently ASCII-subset custom labels or assume Inter covers every script. Keep fallbacks. Load fonts when their family is used; avoid preloading every design. Remove only obsolete Google imports/preconnects. Do not add a font runtime dependency or change theme CSS in this scope. Verify a new `node scripts/verify-font-assets.mjs` checks required local files, manifest checksums, license presence and absence of external font URLs, exiting0.
3. Copy the local fonts into generated fixture output explicitly because `publicDir:false`; don't copy the entire public tree or change fixture CSP. Add a focused browser font check that switches all three designs, awaits document.fonts readiness, confirms the intended faces loaded, and observes no remote requests. Check accents, arrows and representative non-Latin custom labels still render with appropriate fallback and no header/row overflow. document.fonts readiness/computed family alone cannot prove glyph coverage: compare baseline/candidate Unicode coverage manifests and font metadata, verify representative rendered glyphs plus expected fallback for uncovered scripts, and record the method. Missing tools/evidence leave this criterion unverified. Verify `node scripts/browser-fixtures.mjs` and `npm run test:browser -- tests/browser/fonts.spec.ts` exit0.
4. Repeat the matched cold-load samples and compare loaded-font appearance/layout. Retain self-hosting only if it removes external font requests, preserves appearance/coverage and has no meaningful cold-render/layout regression (>10% font-ready median regression requires investigation). Record the tradeoff in bytes and actual browser findings; if the candidate regresses, revert font changes and retain the measurement report. Verify typecheck/lint and focused browser checks pass; primary integrator owns full gates.

## Done criteria

A well-supported NO CHANGE verdict is allowed. For retained self-hosting: source/license/checksums are recorded, automated asset verification and font/browser checks pass, no font fetch leaves the origin, fixture uses real fonts, and all three designs preserve glyph/weight behavior. Check a base-relative build as well as root hosting; do not break Pages asset URLs. No routine user-facing screenshots are required.

## STOP conditions

Stop if a font license/provenance is unclear, if the source family differs from the existing face, if glyph support regresses, or if a custom subsetting toolchain becomes necessary. A speculative bundle optimization or removing full IANA history is out of scope.

## Maintenance notes

Update font binaries, license/provenance manifest and checksum verification together. New families/themes require fixture copy and glyph checks. Font performance and bundle transfer are different measurements; report both honestly.

## Execution outcome — 2026-10-23

Completed under the user's implementation authorization. See [integrated validation](025-implementation-log.md) and [staff implementation approval](024-implementation-review.md). Current source/tests supersede the baseline excerpts for future drift checks; optional product designs remain excluded. No publication or deployment occurred.
