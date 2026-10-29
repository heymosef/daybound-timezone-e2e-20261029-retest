# Font loading measurement — Plan018

**Verdict: retain self-hosting.** The final matched production comparison has zero external font requests, the same loaded font families/glyphs and CLS0 in every sample. Font-ready medians improved1.6–7.0% across all six cases; none regressed. The modest timing gain is environment-specific. The stronger retained benefit is resilience: the offline fixture now renders all three intended designs with their real fonts under its unchanged strict CSP.

## Baseline reconciliation and final source identity

Measured2026-10-23 in the assigned isolated worktree, HEAD `b4100f9e2381a555f2faff6801bd03b0c5bde0ad` plus authorized maintenance changes.013's suite/runtime dependencies were complete; unrelated dirty edits were authorized and not overwritten. The integrator froze build inputs for each capture.

The first valid18baseline/18candidate navigation samples showed3.8–7.0% font-ready median improvements. Their evidence is retained in ignored `fonts-*-pre-label-fix.json`. A focused international-label check then exposed an existing mobile grid minimum-width problem. The integrator corrected mobile row sizing (Plan020), plus conflict-preview wrapping. Both font variants were rebuilt against those corrections and **all36 cold samples were repeated**. Only that final matched pair is the acceptance evidence below.

Final complete sorted non-test `src/`, index/package/package-lock/Vite/fixture-script and local font/provenance-file SHA256 manifest fingerprint, identical for baseline and candidate, is `f635bbccff36ab9f980c54a1ee09c1fe277550427b5ffa0d7da2f594a0f88881`. Both measurement runs asserted it unchanged after capture. Selected product hashes:

| Input | SHA256 |
| --- | --- |
| `src/app/App.tsx` | `ccf7169ac124abb6c4038290a32de4b6cd5a79d7b14a6ddc548adaaef68578bd` |
| `src/app/components/TimezoneRow.tsx` | `b02a2627cd2300dcea730773da73202d76a9cf36a8fd418522c222c4a09ff8b1` |
| `src/app/components/StorageConflictNotice.tsx` | `1105b514f6189ad14b50d8c79a4b25983b7dcfdc106de995c4de9f3497aeb8fb` |
| `src/styles/theme.css` | `842dd0b6f33c2f9fa0a1959be7ea1999f05bfeea471877d5d7dc3964c41f7428` |
| `src/styles/fonts.css` | `a34524d2cc843e2da302108f36095c549aebd178911a563bd7b3383b2babacb0` |
| `index.html` | `05853a2d1868145ab52c53adc1b6f4cda1c35cc1d380ffe9ff7b6c6713497d76` |
| `scripts/browser-fixtures.mjs` | `df189f7c54fa90971e90d6f296a3bc917d7469a3cf14b74f6b053486fa4e2203` |
| `public/fonts/manifest.json` | `c616464de67dc0f4952c670e875211e91025ee9f266f711a884e0fc0f584b1d5` |
| `package-lock.json` | `007aed681c3f7861f5abaa835f407e36f524cf3439f7db80fcdfef2386ee715d` |
| `vite.config.ts` | `b0d675b92a006e8dafcde6d42b66b084157d7ece2d78befd450da013f75becd0` |

The final remote baseline is an isolated build-only override, not a temporary product edit. `font-measurement-baseline-build.mjs` loads the project Vite configuration, orders its override before Tailwind, replaces only the font import in the CSS entry with the exact original Google URL and restores both original preconnect tags. It asserts the compiled CSS contains that remote import and no local faces, and that compiled HTML contains the original preconnects. The local candidate uses `font-measurement-build.mjs` with the exact Plan018 boundary: `configFile:path.resolve("vite.config.ts")`, `envFile:false`, both public PostHog constants explicitly `undefined`, isolated ignored output, `emptyOutDir:true`. Both variants use the same current product code, dependencies, production mode and analytics boundary; no real credentials or telemetry were used.

## Environment and capture

Node24.22.1; npm11 via session-local npm exec; Playwright1.64.1/headless Chromium156.0.8078.4; macOS27.0.1 arm64. Viewports390×900 and1280×900, UTC/en-US, light theme; six synthetic UTC/home/Kolkata/Kathmandu/Adelaide/NewYork/LordHowe rows. CPU1×, CDP network40ms latency,1,250,000bytes/s down and250,000bytes/s up (10/2Mbps). Local Python HTTP serving is uncompressed, unlike a deployed CDN. No other suites/builds ran during final timing.

Each sample uses a fresh browser context/cache, with only synthetic app_settings/timezone_config and a fixed2026-03-07T23:59:30Z Date clock seeded **before its first navigation**. Monotonic performance/rAF timers are untouched. The intended design is already active before React initializes. Browser process reuse means this is a cold HTTP-context test, not a claim about fully cold operating-system DNS caches. Google CSS is fetched once for the exact returned-URL allowlist; no bytes are replayed from that request into page caches.

The baseline allows only the exact original Google stylesheet URL and the WOFF2 URLs it returned on fonts.gstatic.com. Everything else external is rejected. The candidate rejects every external URL. The automated offline fixture's CSP and request policy were never relaxed for measurements. A dedicated localhost4182 server serves only the ignored build directory and closes in finally; the user's4180 preview is untouched.

Font-ready is performance.now after the actual rows exist and document.fonts.ready resolves, from navigation start. Chromium CSS.getPlatformFontsForNode confirms actual custom glyph use on the first real row label (UTC), rather than trusting computed family/readiness alone. Every sample used the expected active face: TE-1=GeistMono-Medium, Gamut=Inter-Regular_Medium, DOS=PixelifySans-Regular_Medium. Other families remain unloaded. CLS observes shifts without recent input through this ready checkpoint; it is not a long-session layout guarantee. FCP is separately reported where Chromium had published the entry; one sample lacks it and is marked unavailable, not zero.

## Every final cold sample

All rows below have CLS0 for baseline/candidate, zero rejected/failed requests and the expected actual custom family. Baseline external requests are exactly two (Google CSS, active Latin WOFF2); candidate external requests are zero.

| Width | Design / loaded family | Sample | Baseline ready ms | Local ready ms | Baseline FCP ms | Local FCP ms |
| --- | --- | --- | --- | --- | --- | --- |
| 390 | te-1 / Geist Mono | 1 | 1555.6 | 1464.1 | 1452.0 | 1416.0 |
| 390 | te-1 / Geist Mono | 2 | 1593.0 | 1471.8 | 1484.0 | 1416.0 |
| 390 | te-1 / Geist Mono | 3 | 1524.0 | 1456.7 | 1420.0 | 1400.0 |
| 390 | gamut / Inter | 1 | 1552.2 | 1485.7 | 1424.0 | 1416.0 |
| 390 | gamut / Inter | 2 | 1548.9 | 1486.9 | 1420.0 | 1412.0 |
| 390 | gamut / Inter | 3 | 1561.0 | 1489.9 | 1428.0 | 1416.0 |
| 390 | dos / Pixelify Sans | 1 | 1513.7 | 1445.9 | 1416.0 | 1408.0 |
| 390 | dos / Pixelify Sans | 2 | 1498.7 | 1449.4 | 1404.0 | 1404.0 |
| 390 | dos / Pixelify Sans | 3 | 1511.7 | 1450.9 | 1416.0 | 1408.0 |
| 1280 | te-1 / Geist Mono | 1 | 1525.6 | 1475.0 | 1416.0 | 1416.0 |
| 1280 | te-1 / Geist Mono | 2 | 1619.8 | 1475.0 | 1448.0 | 1416.0 |
| 1280 | te-1 / Geist Mono | 3 | 1585.5 | 1483.0 | 1456.0 | 1420.0 |
| 1280 | gamut / Inter | 1 | 1547.9 | 1567.6 | 1428.0 | unavailable |
| 1280 | gamut / Inter | 2 | 1536.6 | 1518.6 | 1420.0 | 1460.0 |
| 1280 | gamut / Inter | 3 | 1543.8 | 1496.6 | 1420.0 | 1440.0 |
| 1280 | dos / Pixelify Sans | 1 | 1524.4 | 1482.7 | 1424.0 | 1440.0 |
| 1280 | dos / Pixelify Sans | 2 | 1538.5 | 1474.3 | 1440.0 | 1428.0 |
| 1280 | dos / Pixelify Sans | 3 | 1516.8 | 1475.5 | 1420.0 | 1420.0 |

| Width | Design | Baseline ready median ms | Local ready median ms | Change |
| --- | --- | --- | --- | --- |
| 390 | te-1 | 1555.6 | 1464.1 | -5.88% |
| 390 | gamut | 1552.2 | 1486.9 | -4.21% |
| 390 | dos | 1511.7 | 1449.4 | -4.12% |
| 1280 | te-1 | 1585.5 | 1475.0 | -6.97% |
| 1280 | gamut | 1543.8 | 1518.6 | -1.63% |
| 1280 | dos | 1524.4 | 1475.5 | -3.21% |

The1.63% desktop Gamut difference is small enough to be ordinary environment noise; no universal speedup is claimed. Every median remains well inside the allowed10% regression bound. Matched font-ready/glyph/no-external checks, plus offline resilience, support retaining this candidate.

## Request chain, transfer and provenance

Baseline: document → first-party stylesheet → [exact Google Fonts stylesheet](https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&family=Inter:wght@100..900&family=Pixelify+Sans:wght@400..700&display=swap) → active Latin WOFF2. Candidate: document → first-party stylesheet → active first-party WOFF2; unused design/script subsets remain unloaded. Original URLs and every original Unicode range are preserved in [the font manifest](../public/fonts/manifest.json) and [captured official CSS](../public/fonts/google-fonts-baseline.css).

Playwright request.sizes responseBodySize is retained as transport accounting; it includes protocol/encoding differences and is not a binary-size equality assertion. The exact binary sizes are23108bytes GeistMonoLatin,48432 InterLatin,12008 PixelifySansLatin. Per-design median measured responseBodySize across both viewports:

| Design | Baseline CSS+font response body bytes | Local font response body bytes |
| --- | --- | --- |
| te-1 | 24986 | 23108 |
| gamut | 50318 | 48432 |
| dos | 13877 | 12008 |

Final built first-party CSS grows from53,952 to57,852bytes (the face/range declarations move into it); HTML shrinks from2,027 to1,886bytes by removing preconnects. These are local uncompressed build bytes, separate from the network figures. All16 committed WOFF2 subsets total314,680bytes, but a normal Latin visit loads only one. Self-hosting removes external discovery/transport, not the font's necessary glyph payload. Full IANA/rule/cell identity semantics are untouched.

The files are unmodified official Google distribution downloads, versioned URLs GeistMono/v6, Inter/v20, PixelifySans/v3. Pinned official family source/license commits, internal version strings, full SIL OFL1.1 text, hashes, weights, declared Unicode ranges and actual cmap metadata are documented in [font-assets.md](../docs/font-assets.md). The official download hashes were independently checked against every bundled binary. There is no new runtime font dependency, subsetting toolchain, global setting or external-dashboard change.

## Coverage, fallback, layout and focused validation

FontTools4.60.2/Brotli1.2.1 in an ignored local virtual environment decoded the actual WOFF2 cmaps, glyph counts, name-table versions and weight axes. The source/delivery metadata is not treated as proof that broad CSS ranges contain every glyph. Every font-face declaration matches the captured Google rule exactly except its src URL, and every binary hash matches the official original. Inter retains Greek/Greek-ext; Geist Mono and Pixelify Sans retain their existing Latin/Cyrillic subsets and fallback for uncovered scripts. No ASCII-only subset was substituted.

The separate rendering diagnostic compares24 baseline/candidate text samples: accents/diacritics, arrows, Greek, Cyrillic, Vietnamese, Japanese, Arabic and Devanagari for all three families. Controlled spans use the same family plus sans-serif fallback; platform font/glyph records and widths match exactly, with no LastResort fallback. Separately, the real product label test uses its actual unchanged theme fallback stacks and verifies downloaded Latin glyphs, system fallback for uncovered scripts, exact custom-label text and no page overflow at390/1280px. Thus both byte/metadata coverage and actual rendering/fallback are checked.

That real-label test found document scrollWidth425px at390px before the integrator's two-class mobile grid correction (row380.25px right edge, rename button396.97px right edge). This was not a changed font shape: baseline/candidate glyphs were identical. The root-owned Plan020 fix constrains the first mobile grid track/item; the focused test subsequently passes every design with no overflow. Native keyboard menu activation and waiting for menu DOM removal avoid exiting-dropdown overlap in the test. Both final timing variants include the row fix and later conflict-preview wrapping.

Completed focused checks:

- `node scripts/verify-font-assets.mjs`: exit0;16file checksums, exact original declarations, reviewed metadata and three pinned OFL licenses.
- `node scripts/browser-fixtures.mjs`: exit0 as part of the focused runner; explicit manifest-only font copying, publicDir:false and strict CSP retained. Vite's expected unresolved-public-path build warnings are resolved by that explicit runtime copy, not an external request exception.
- `npm run test:browser -- tests/browser/fonts.spec.ts`:2/2pass (desktop/narrow), including all three designs, actual glyph/fallback evidence and overflow checks.
- `node scripts/check-font-rendering.mjs`:24/24paired rendering records match; all16official download checksums match. Diagnostic rerun uses final matched root builds.
- `node scripts/check-font-base-path.mjs`:all three designs load beneath `/relative/fonts/` with `base:'./'`, no external/failed requests. This focused URL-path check preceded only unrelated row/conflict wrapping edits; font URLs/configuration did not change afterward.
- Focused measurement/font script ESLint passed. After the final baseline-helper correction, the primary integrator separately completed typecheck/lint/build,517Vitest tests,20Node timezone-checker tests,16font assets,zero-vulnerability audit and28/28Chromium checks. All passed, including international/narrow labels and font checks. No duplicate full suite was run here.

## Reproduction and limits

```sh
node scripts/font-measurement-baseline-build.mjs
node scripts/font-measurement-build.mjs
node scripts/measure-fonts.mjs --baseline
node scripts/measure-fonts.mjs
node scripts/check-font-rendering.mjs
```

The final JSON summaries are ignored `node_modules/.cache/daybound-measurements/fonts-baseline.json`, `fonts-candidate.json` and `font-rendering.json`; all acceptance sample numbers are retained above. Scripts own bounded4182/4185/4186 servers and clean them up. Do not interpret headless desktop emulation as a physical-phone test or the small timing deltas as a guarantee on every network. No real analytics credentials, push, PR, deployment, dashboard mutation, global runtime/model setting or product profiling payload was used.
