# Plan 013: Automate a bounded offline browser smoke suite

## Status and execution contract

- Status: DONE; locally implemented, validated and staff-reviewed on2026-10-23.
- Priority: P1; effort: M; change risk: LOW; category: tests.
- Planned at: `b4100f9`, 2026-10-23.
- Depends on: none; add Plan012-specific control assertions after012 lands.
- Repository checkout: `/Users/mohammed/Documents/Cursor/daybound-web-app`.
- Assigned isolated worktree: `/Users/mohammed/.codex/worktrees/daybound-maintenance/daybound-web-app`.
- Implementation owner uses the assigned isolated worktree and local commits only after implementation is requested. Do not push, deploy, open PRs, change dashboards, or change global runtime/model settings. The primary integrator owns `plans/README.md` status and final validation.

Read this entire file before implementation. Run `git diff --stat b4100f9..HEAD -- package.json package-lock.json playwright.config.ts tests/browser/ vitest.config.ts tsconfig.node.json eslint.config.js .gitignore .github/workflows/ci.yml .github/workflows/pages.yml scripts/browser-fixtures.mjs scripts/serve-browser-fixtures.mjs docs/browser-testing.md` and `git status --short`. Reconcile expected edits from the dependencies against the current-state excerpts; record that reconciliation in the handoff. Stop for unexplained semantic drift, unrelated dirty files in scope, or a dependency that is not complete. Do not overwrite someone else's work.

## Runtime, conventions and verification ownership

Use Node24 (`node --version` must report v24.x) and npm; run `npm ci` when dependencies are missing or the lockfile changes. A session-local invocation is `npm exec --yes --package=node@24 --package=npm@11 -- npm <arguments>`; do not change global defaults. Match React18 functional components, TypeScript strict mode, Tailwind theme variables, and existing Testing Library/Vitest patterns. Never use real analytics credentials for verification.

During implementation run the focused commands below, `npm run typecheck`, and `npm run lint` (all exit 0). The primary integrator runs `npm test` and `npm run build` once on the final integrated candidate, plus the browser suite once it exists. A plan's passing focused tests are not a claim that final integration passed. Failure requires investigation, not blanket retries or wider unrelated refactors.

## Scope

Only these paths may change, plus this plan's execution notes and the integrator-owned index:

- `package.json`
- `package-lock.json`
- `playwright.config.ts`
- `tests/browser/`
- `vitest.config.ts`
- `tsconfig.node.json`
- `eslint.config.js`
- `.gitignore`
- `.github/workflows/ci.yml`
- `.github/workflows/pages.yml`
- `scripts/browser-fixtures.mjs`
- `scripts/serve-browser-fixtures.mjs`
- `docs/browser-testing.md`

## Why this matters

Vitest uses jsdom with mocked measurements/media APIs. It cannot establish real scroll geometry, CSS visibility, pointer capture or popup fit. A small browser suite should exercise the real app via the existing offline fixtures without duplicating all430 unit/component tests or depending on production services.

## Current state and conventions

`vitest.config.ts` contains `environment: "jsdom"`, `globals: true`, and `setupFiles: ["./src/test/setup.ts"]`. Both CI workflows already run `npm ci`, typecheck, lint, Vitest and build. They currently have no real-browser step. `scripts/browser-fixtures.mjs` builds into ignored `node_modules/.cache/daybound-smoke/site` using:
```js
await build({
  configFile: path.join(project, "vite.config.ts"), root: entries,
  envFile: false, publicDir: false, base: "./", mode: "production",
  define: { "import.meta.env.VITE_PUBLIC_POSTHOG_KEY": "undefined", "import.meta.env.VITE_PUBLIC_POSTHOG_HOST": "undefined" },
  // ... ignored output directory
});
```
The shell mounts the real App and has fake clock controls, strict CSP, intercepted fetch and a fake `.invalid` analytics host. Routes include midnight, fractional, dst-spring, dst-fall, toronto-fall, bc-fall, corrupt/blocked/quota storage and fake analytics. There are no test controls in product components. The existing loopback preview on4180 is user-owned; do not reuse or stop it.

## Proposed tooling and boundaries

Use a reviewed exact development-only `@playwright/test` version compatible with Node24 and the lockfile; choose the version at execution and record it. Configure only Chromium desktop1280x900 and narrow390x844 projects initially. Emulation is not physical touch/Safari verification. No snapshot baselines, screenshot assertions, framework migration, live analytics key, real network service, or shared cloud browser is required.

Official references checked2026-10-23: [configuration](https://playwright.dev/docs/test-configuration), [CI installation](https://playwright.dev/docs/ci-intro). Follow these APIs; retain this repo's SHA-pinned Actions rather than copying the documentation's floating tags.

## Steps

1. Add exact dev dependency and scripts: `test:browser` = `playwright test`; `typecheck:browser` = `tsc --project tsconfig.node.json`. Add the Playwright config and `tests/browser/**/*.ts` to the Node tsconfig; include DOM/DOM.Iterable libraries for browser-evaluated callbacks while retaining the existing strict Node settings. These tests must not use Vitest globals. Add a Vitest exclusion for `tests/browser/**` while retaining Vitest's default exclusions (import `configDefaults`). Ignore `test-results/` and `playwright-report/`; keep the browser code subject to lint with Node globals. Verify `npm ci`, `npm run typecheck`, `npm run lint`, and `npm test -- src/app/components/DatePicker.test.tsx` exit0. `npm exec -- playwright test --list` lists only the new browser tests, not unit tests.
2. Add a small Node24 static fixture server on127.0.0.1:4176 (new file), with path containment, MIME types and clean SIGTERM shutdown. Keep it confined to the ignored generated site. Configure Playwright `webServer` to build fixtures then run this server; `reuseExistingServer:false`, bounded startup/test/global timeouts, one CI worker, no automatic retries initially, traces on failure, screenshots/video off. The server and test harness must never read `.env`. Verify `npm exec -- playwright install chromium` succeeds locally, then a single fixture navigation test exits0 and leaves4176 closed. A busy port must fail rather than claim an unrelated server.
3. Add at most8 focused flows per project, using role/name locators scoped to `#root` and existing timeline semantics/data attributes where geometry requires them: (a) search/add/rename and correct saved reload; (b) select a future date and toggle a slot off without resetting the rail/date; (c) drag past a whole-hour rebase with aligned rows, suppressed hover during drag and restored targeting afterward; (d) repeated date-strip switches with exactly one selected day and one Today indicator; (e) calendar viewport fit/open/close/focus at390px and320x568 override; (f) keyboard timeline browse/select/Today plus row actions once012 lands; (g) Toronto rollback edge hint and BC/Los Angeles rule difference; (h) fake analytics opt-out cancels intercepted requests. Use condition-based assertions/animation completion rather than arbitrary sleeps. Block/record requests outside the fixture origin and fail on unexpected requests, console errors or page errors, allowing only precisely documented intentional fixture errors. The initial narrow exception is the exact fonts.googleapis.com/css2 stylesheet URL imported by src/styles/fonts.css: its stylesheet request may be blocked by the fixture style-src CSP and emit that specific console violation. Allow at most that one known stylesheet violation per navigation; never allow all Google/CSP/network errors or relax CSP. Remove this exception if018 removes the import. Unexpected origins/resource types remain failures. Verify `npm run test:browser` exits0 for both projects without live network requests. For drag, sample computed transition/pointer styles and stable cell instant identities; do not claim a pixel-level flicker test.
4. Add Chromium install (`npm exec -- playwright install --with-deps chromium`) and `npm run test:browser` to both existing validation paths: PR CI and the Pages build job before artifact upload. Build fixtures separately from `dist`; don't publish them. Preserve minimum permissions, Node24, pinned Actions, public production analytics configuration only in the existing production build step, and no credentials in the browser job. Failure diagnostics stay in ignored local output initially; do not add an upload action solely for traces. Document commands, bounds and hardware limits. Verify all focused commands pass and inspect both workflow sequences; execution of remote CI/deployment is not authorized by this plan.

## Test plan and done criteria

- Tests interact with actual DOM controls; fixtures may seed a scenario but must not set product React state directly.
- Tests use isolated contexts; multi-page tests only share a context deliberately. For the storage test, both pages use the identical scenario/profile; only pageA first seeds with reset=1, and reset is removed before pageB loads. Opening B must not reseed or clear A's storage. Default fixtures seed/reload only when the scenario profile changes; remove `reset=1` before testing persistence.
- `npm run typecheck` includes browser code; `npm run lint` and `npm run test:browser` exit0. Vitest never collects Playwright files. Focused checks establish these runner boundaries without re-running the full suite at every step.
- The browser suite is bounded to the named smoke flows, deterministic across two projects, starts/stops its own4176 server, and makes no live analytics request. Its CI steps precede Pages artifact upload.
- Primary integrator runs the complete suite/build once on the final candidate. Manual physical touch and screen-reader speech remain separately recorded limits.

## STOP conditions

Stop if installation needs a global runtime change, tests need product-only fixture flags, fixtures leak real environment configuration, unexplained flakiness requires retries/sleeps to hide it, or a new browser version changes behavior outside this scope. Report unavailable browser binaries/network access instead of claiming browser verification. Do not run or dispatch either remote workflow during local implementation.

## Maintenance notes

Expand only for an observed regression or high-value flow. Update `docs/browser-testing.md` to distinguish manual CUA instructions from the new automated runner. Configuring automation is separate from running browser interactions through session tools; follow the current session's tool rules. Preserve fixture CSP and fetch interception as fonts/analytics evolve.

## Execution outcome — 2026-10-23

Completed under the user's implementation authorization. See [integrated validation](025-implementation-log.md) and [staff implementation approval](024-implementation-review.md). Current source/tests supersede the baseline excerpts for future drift checks; optional product designs remain excluded. No publication or deployment occurred.
