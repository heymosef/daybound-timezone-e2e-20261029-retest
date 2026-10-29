// Separate diagnostic React profiling build; never use its timings as the baseline.
import { build } from "vite";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { seed, serve } from "./measurement-utils.mjs";

if (!process.version.startsWith("v24.")) throw new Error("Use Node24");
const cache = path.resolve("node_modules/.cache/daybound-scrub-profiler");
await mkdir(cache, { recursive: true });
await cp("node_modules/.cache/daybound-smoke/entries", `${cache}/entries`, { recursive: true });
const entry = `${cache}/entries/entry.jsx`;
await writeFile(entry, (await readFile(entry, "utf8"))
  .replace("<React.StrictMode>", '<React.StrictMode><React.Profiler id="App" onRender={(id, phase, actualDuration, baseDuration, startTime, commitTime) => window.scrubProfiler?.push({id, phase, actualDuration, baseDuration, startTime, commitTime})}>')
  .replace("</React.StrictMode>", "</React.Profiler></React.StrictMode>"));
await build({
  configFile: path.resolve("vite.config.ts"), root: `${cache}/entries`, envFile: false, publicDir: false, base: "./", mode: "production",
  plugins: [{
    name: "maintenance-diagnostic-profilers", enforce: "pre",
    transform(code, id) {
      const component = id.endsWith("/components/TimezoneRow.tsx") ? "TimezoneRow" : id.endsWith("/components/Timeline.tsx") ? "Timeline" : null;
      if (!component) return;
      const expression = `React.memo(${component}Inner)`;
      const wrapper = `React.memo((props: ${component}Props) => <React.Profiler id="${component}" onRender={(id, phase, actualDuration, baseDuration, startTime, commitTime) => (window as any).scrubProfiler?.push({id, phase, actualDuration, baseDuration, startTime, commitTime})}><${component}Inner {...props} /></React.Profiler>)`;
      if (!code.includes(expression)) throw new Error("Diagnostic profiler source anchor changed");
      return code.replace(expression, wrapper);
    },
  }],
  resolve: { alias: { "react-dom/client": path.resolve("node_modules/react-dom/profiling.js") } },
  define: { "import.meta.env.VITE_PUBLIC_POSTHOG_KEY": "undefined", "import.meta.env.VITE_PUBLIC_POSTHOG_HOST": "undefined" },
  build: { outDir: `${cache}/site`, emptyOutDir: true, target: "esnext" },
});
const server = await serve(`${cache}/site`, 4184);
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "UTC", locale: "en-US" });
  await context.route("**/*", route => new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort());
  await context.addInitScript(seed, { design: "te-1", count: 6, fixture: true });
  await context.addInitScript(() => { window.scrubProfiler = []; });
  const page = await context.newPage();
  await page.goto(`${server.origin}/?scenario=midnight`);
  const region = page.locator(".timeline-viewport").first(); await region.waitFor();
  await page.waitForTimeout(2000);
  const g = await region.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, cell: el.querySelector("[data-timeline-cell]").getBoundingClientRect().width }; });
  await page.evaluate(() => { window.scrubProfiler = []; });
  await page.mouse.move(g.x, g.y); await page.mouse.down();
  const start = performance.now();
  for (let i = 1; performance.now() - start < 3000; i++) {
    const wait = start + i * 1000 / 60 - performance.now(); if (wait > 0) await delay(wait);
    const elapsed = performance.now() - start;
    await page.mouse.move(g.x + Math.min(117, g.cell * 3) * Math.sin(2 * Math.PI * elapsed / 2000), g.y);
  }
  await page.mouse.up();
  const commits = await page.evaluate(() => window.scrubProfiler);
  if (!commits.length) throw new Error("React profiling renderer emitted no commits");
  await writeFile("node_modules/.cache/daybound-measurements/scrubbing-profiler.json", JSON.stringify({ diagnosticOnly: true, width: 390, count: 6, duration: 3000, commits }, null, 2));
  console.log(JSON.stringify({ diagnosticCommits: commits.length, totalActualDuration: commits.reduce((sum, commit) => sum + commit.actualDuration, 0), maxActualDuration: Math.max(...commits.map(commit => commit.actualDuration)) }));
  await context.close();
} finally { await browser.close(); await server.close(); }
