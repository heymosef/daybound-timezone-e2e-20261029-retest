# Scrubbing measurement — Plan017

**Verdict: INVESTIGATED—NO CHANGE.** The preselected optimization gate was not met: representative six-row p95 animation-frame gaps were16.7–16.8ms in all six samples, below the25ms reference budget. No App, row, timeline, storage, formatter, model, cell-key or IANA-data optimization was made.

## Reconciled baseline and environment

Measured2026-10-23 in the assigned isolated maintenance worktree. HEAD was `b4100f9e2381a555f2faff6801bd03b0c5bde0ad` plus the authorized dirty implementations of012/014/016/020 and013 browser infrastructure. Those sources were explicitly frozen by the integrator for capture; tests/docs changed independently. No unexplained scoped edits were overwritten. The complete sorted non-test `src/` plus index/package-lock/package/Vite/fixture-script SHA256 manifest fingerprint was `c59bdb7ba58d29bf1547e3ab4eab7de02761bec2aff6ed296fbb014c3f6cd6e6`; the helper asserted that it was unchanged after all18samples. Selected individual hashes:

| Input | SHA256 |
| --- | --- |
| `src/app/App.tsx` | `b1af32546162475bddc893800ad004a2e853ce7e06c369ca39e45dedaaaec992` |
| `src/app/components/TimezoneRow.tsx` | `f4c12ec575a5eff725167a3f1b3a66b3f5c8d5fc9f5629040bac96ceb315df95` |
| `src/app/components/Timeline.tsx` | `d314feedc44dca305ad56d3328223d53f3102d7ae52f0dcb963aea260a6bc680` |
| `src/hooks/useTimelineScrub.ts` | `d1b0f8239d07ff90ebe0dea23c45f9798cc3e5ce9d93b2ab93afe16bb870f515` |
| `src/hooks/useStorage.ts` | `8068a1b782284565b760fec0357b6de4aeb80d5f4b71b866f415dc16ae9b1b6b` |
| `src/utils/labels.ts` | `917a03d62f563353e49a3d1b9c5d5c40342b490d8232f08b05e4bb5f77e767fb` |
| `scripts/browser-fixtures.mjs` | `4bcc5cb10e3997cd301c3876a0493b131cb76ab16e5b96457c4a47cd454f4b4c` |
| `package-lock.json` | `007aed681c3f7861f5abaa835f407e36f524cf3439f7db80fcdfef2386ee715d` |
| `vite.config.ts` | `b0d675b92a006e8dafcde6d42b66b084157d7ece2d78befd450da013f75becd0` |

Node24.22.1; npm11 session-local invocation; macOS27.0.1 arm64; Playwright1.64.1 bundled headless Chromium156.0.8078.4. Observed rAF median16.70ms establishes this environment's60Hz reference; physical display refresh and physical-phone performance were not measured. No CPU/network throttle. Viewports390×900 and1280×900; light TE-1 design. Identical production offline fixture build for every timing sample, `envFile:false`, analytics undefined, external requests denied, existing strict fixture CSP unchanged. Current external font import is CSP-blocked, so this scrubbing workload deliberately measures the same fixed local fallback typography throughout; it is not the font baseline.

The normal fixture has six rows: UTC/home, Kolkata, Kathmandu, Adelaide, New York, Lord Howe. Stress cases append unique synthetic IANA rows to12/24 via browser init-script storage; no fixture/product controls were added. Fixed fixture clock2026-03-07T23:59:30Z; `performance.now()` and native rAF timestamps remain monotonic. Two seconds of settling per fresh context before capture. No other browser suites/builds ran during timing.

## Method and every sample

`scripts/measure-scrubbing.mjs` holds a native Playwright mouse pointer down at the first timeline viewport's center, moving at nominal60Hz along `x(t)=center+A*sin(2*pi*t/2000ms)`, constant y. Cell width52px; A117px narrow and156px desktop, thus at most2.25h/3h from the anchor, far from the±24h clamp. Input delivery is serialized, actual cadence is recorded below rather than assumed. Capture lasts ten seconds of active input; instrumentation also includes a few milliseconds of native down/up setup. The reported elapsed column is the last input's monotonic elapsed time from instrumentation start.

A passive pointer observer records input times; one rAF loop records frame gaps; a rail attribute observer watches only transform/data-start, reporting per-second activity and input-to-next-observed-rail-update latency. The latter is a DOM-update proxy, not photon/display latency. LongTask entries are>50ms. No tracing/profiling overhead is included in these timing samples.

| Width | Rows | Sample | Last input ms | p95 rAF ms | >25ms gaps | >50ms tasks | Inputs | Input gap p50 / p95 ms | Rail latency p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 390 | 6 | 1 | 10071.6 | 16.70 | 1 | 1 | 594 | 16.70 / 17.30 | 7.20 |
| 390 | 6 | 2 | 10028.4 | 16.70 | 1 | 0 | 595 | 16.70 / 17.30 | 7.20 |
| 390 | 6 | 3 | 10009.5 | 16.70 | 0 | 0 | 596 | 16.70 / 17.40 | 6.80 |
| 390 | 12 | 1 | 10003.4 | 16.70 | 1 | 0 | 543 | 16.70 / 33.30 | 11.40 |
| 390 | 12 | 2 | 10008.2 | 16.70 | 1 | 0 | 548 | 16.70 / 33.40 | 11.50 |
| 390 | 12 | 3 | 10015.2 | 16.80 | 0 | 0 | 556 | 16.70 / 32.90 | 11.10 |
| 390 | 24 | 1 | 10020.8 | 16.70 | 1 | 0 | 355 | 32.60 / 50.10 | 18.70 |
| 390 | 24 | 2 | 10015.9 | 16.80 | 1 | 0 | 359 | 31.90 / 50.10 | 19.10 |
| 390 | 24 | 3 | 10008.8 | 16.70 | 2 | 0 | 349 | 33.10 / 50.00 | 19.20 |
| 1280 | 6 | 1 | 10020.7 | 16.80 | 2 | 0 | 589 | 16.70 / 17.60 | 7.20 |
| 1280 | 6 | 2 | 10010.6 | 16.80 | 1 | 0 | 596 | 16.70 / 17.40 | 7.00 |
| 1280 | 6 | 3 | 10003.9 | 16.70 | 1 | 0 | 592 | 16.70 / 17.30 | 7.20 |
| 1280 | 12 | 1 | 10010.6 | 16.80 | 1 | 0 | 531 | 16.70 / 33.30 | 11.90 |
| 1280 | 12 | 2 | 10017.2 | 16.70 | 2 | 0 | 551 | 16.70 / 33.20 | 11.20 |
| 1280 | 12 | 3 | 10013.7 | 16.80 | 1 | 0 | 544 | 16.70 / 33.30 | 11.00 |
| 1280 | 24 | 1 | 10002.4 | 16.80 | 1 | 0 | 339 | 32.60 / 51.50 | 20.20 |
| 1280 | 24 | 2 | 9984.7 | 16.70 | 2 | 1 | 340 | 32.50 / 51.20 | 20.00 |
| 1280 | 24 | 3 | 10022.3 | 16.80 | 4 | 1 | 335 | 32.80 / 50.40 | 19.60 |

All samples have p50 rAF16.70ms. Representative input delivery is58.9–59.6events/s. At12rows it is53.1–55.6/s, and at24rows33.5–35.9/s: the serialized native-input driver cannot sustain60Hz in those stress cases. Their low rAF p95 must **not** be interpreted as proof of60Hz input capacity. They remain continuously active stress observations; there is no candidate speedup or matched stress acceptance claim. A future stress optimization investigation should first remove that driver bottleneck while retaining measured native event cadence.

## Continuous-pan evidence

Each vector gives rail attribute update counts for successive one-second intervals `[0,1),…,[9,10)`. Every bin also contains at least five distinct transform strings; each sample repeatedly rebases data-start across hours, with no clamp/idle plateau. Narrow first-bin data-start values span09:00–11:00Z and subsequent half-cycles alternate09:00–12:00Z /11:00–14:00Z on2026-03-07. Desktop spans08:00–14:00Z across its±3h path. Sample summaries retain the actual start identities in ignored JSON. All observed external request arrays are empty: the existing Google CSS is stopped by CSP before transport.

| Width / rows / sample | Updates per second |
| --- | --- |
| 390 / 6 / 1 | `51,59,59,60,60,60,60,60,60,60` |
| 390 / 6 / 2 | `54,60,60,60,60,58,60,60,60,60` |
| 390 / 6 / 3 | `56,60,60,60,60,60,60,60,60,59` |
| 390 / 12 / 1 | `47,54,56,56,56,56,55,51,56,55` |
| 390 / 12 / 2 | `50,54,56,53,57,55,56,55,56,54` |
| 390 / 12 / 3 | `53,54,57,55,56,54,58,58,55,54` |
| 390 / 24 / 1 | `29,35,34,35,36,35,39,39,36,35` |
| 390 / 24 / 2 | `31,37,36,36,35,37,37,37,36,36` |
| 390 / 24 / 3 | `31,36,36,37,35,33,35,36,34,34` |
| 1280 / 6 / 1 | `52,60,60,60,60,60,60,55,60,60` |
| 1280 / 6 / 2 | `56,60,59,59,61,60,60,60,60,60` |
| 1280 / 6 / 3 | `56,60,60,60,60,60,60,56,59,60` |
| 1280 / 12 / 1 | `49,57,50,56,54,51,50,54,53,55` |
| 1280 / 12 / 2 | `49,56,53,55,54,55,57,57,55,58` |
| 1280 / 12 / 3 | `47,55,53,57,53,56,53,54,59,55` |
| 1280 / 24 / 1 | `28,37,32,35,34,36,33,35,31,37` |
| 1280 / 24 / 2 | `28,36,34,35,34,35,35,34,33,35` |
| 1280 / 24 / 3 | `25,34,34,35,34,34,34,35,32,36` |

There were three isolated long tasks total: narrow6rows sample1 at42.3ms(duration75ms), desktop24rows sample2 at18.9ms(57ms), sample3 at22.1ms(63ms). They occur at drag activation, not recurring throughout the ten-second path. Maximum/p95 differences therefore do not support a repeatable representative slow-frame diagnosis.

## Separate React diagnostic

`scripts/measure-scrubbing-profiler.mjs` creates an ignored production diagnostic build using React18's profiling renderer and diagnostic-only Vite transforms wrapping App, TimezoneRow and Timeline with React.Profiler. No product file is modified. One separate three-second390px/six-row run captured179 App commits,1074 row entries and1074 timeline entries. App inclusive actualDuration median2.70ms/p954.20ms/max5.50ms; row entries median0.40ms/p950.60ms/max1.40ms; timeline entries median0.20ms/p950.40ms/max1.20ms. These nested timings overlap and must not be added; this diagnostic's timings are never compared to the normal production baseline. It confirms per-frame commits but does not establish a worthwhile stationary-row refactor.

## Reproduction, validation and limits

Run using Node24:

```sh
node scripts/browser-fixtures.mjs
node scripts/measure-scrubbing.mjs
node scripts/measure-scrubbing-profiler.mjs
```

The scripts own bounded localhost4183/4184 servers and close them in `finally`. Outputs are ignored `node_modules/.cache/daybound-measurements/scrubbing.json` and `scrubbing-profiler.json`; the full per-sample numeric summary is retained above. The fixture build exited0. The browser infrastructure owner had independently completed its16/16 regression checks before capture; final integrated browser/typecheck/lint/unit/build gates belong to the integrator. After all changes, the integrator separately reported typecheck/lint/build passing,517Vitest tests,20Node checker tests,16verifiedfont assets,zero audit vulnerabilities and28/28Chromium checks. These functional gates do not replace the frozen performance baseline. No product change requires an extra performance candidate build. Focused ESLint verification of all measurement scripts exited0.

After this frozen capture, the integrator applied conflict-warning/reload copy, suppression of the generic saved-success notice during conflicts, and a first-city-after-explicit-clear home-flag fix. They are outside this nonempty/conflict-free seeded workload; the exact old source fingerprint above remains the identity of this result. The later root-owned mobile row min-width/conflict wrapping corrections and self-hosted font delivery also postdate this capture. It is not a matched timing claim for any later product build or font change. End-to-end physical-device performance and60Hz24-row input capacity remain unverified. No speculative source optimization was retained.
