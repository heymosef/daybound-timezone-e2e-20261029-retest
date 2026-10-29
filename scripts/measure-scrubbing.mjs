// Bounded, native-input production-fixture benchmark. Results are environment-specific.
import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { fingerprint, percentile, seed, serve } from "./measurement-utils.mjs";

if (!process.version.startsWith("v24.")) throw new Error("Use Node24");
const cache = "node_modules/.cache/daybound-measurements";
await mkdir(cache, { recursive: true });
const before = await fingerprint();
const server = await serve("node_modules/.cache/daybound-smoke/site", 4183);
const browser = await chromium.launch();
const results = { browser: browser.version(), node: process.version, platform: `${process.platform}/${process.arch}`, primary: "p95 rAF gap (ms), 25ms gate at observed 60Hz", fingerprint: before, samples: [] };
try {
  for (const width of [390, 1280]) for (const count of [6, 12, 24]) {
    for (let repeat = 1; repeat <= 3; repeat++) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: "UTC", locale: "en-US", serviceWorkers: "block" });
      const external = [];
      await context.route("**/*", route => {
        if (new URL(route.request().url()).origin === server.origin) return route.continue();
        external.push(route.request().url()); return route.abort();
      });
      await context.addInitScript(seed, { design: "te-1", count, fixture: true });
      const page = await context.newPage();
      await page.goto(`${server.origin}/?scenario=midnight`);
      const region = page.locator(".timeline-viewport").first();
      await region.waitFor();
      if (await page.locator(".timeline-viewport").count() !== count) throw new Error("Seed row count mismatch");
      await page.waitForTimeout(2000);
      const geometry = await region.evaluate(el => {
        const r = el.getBoundingClientRect();
        const cell = el.querySelector("[data-timeline-cell]").getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, cellWidth: cell.width, railWidth: r.width };
      });
      const amplitude = Math.min(0.3 * width, 3 * geometry.cellWidth);
      await page.evaluate(() => {
        const region = document.querySelector(".timeline-viewport");
        const rail = region.querySelector('[data-testid="timeline-rail"]');
        const state = window.measureScrub = { frames: [], events: [], changes: [], longTasks: [], start: performance.now(), active: true };
        let previous; let lastInput;
        const loop = time => { if (!state.active) return; if (previous !== undefined) state.frames.push(time - previous); previous = time; requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
        region.addEventListener("pointermove", event => { if (event.buttons === 1) { lastInput = performance.now(); state.events.push(lastInput - state.start); } });
        new MutationObserver(() => state.changes.push({ elapsed: performance.now() - state.start, latency: lastInput === undefined ? null : performance.now() - lastInput, transform: rail.style.transform, start: rail.dataset.start })).observe(rail, { attributes: true, attributeFilter: ["style", "data-start"] });
        new PerformanceObserver(list => { for (const entry of list.getEntries()) if (entry.startTime >= state.start) state.longTasks.push({ start: entry.startTime - state.start, duration: entry.duration }); }).observe({ type: "longtask", buffered: true });
      });
      await page.mouse.move(geometry.x, geometry.y);
      await page.mouse.down();
      const start = performance.now();
      for (let input = 1; performance.now() - start < 10000; input++) {
        const target = start + input * 1000 / 60;
        const wait = target - performance.now(); if (wait > 0) await delay(wait);
        const elapsed = performance.now() - start;
        await page.mouse.move(geometry.x + amplitude * Math.sin(2 * Math.PI * elapsed / 2000), geometry.y);
      }
      await page.mouse.up();
      const raw = await page.evaluate(() => { window.measureScrub.active = false; return window.measureScrub; });
      const cadence = raw.events.slice(1).map((time, i) => time - raw.events[i]);
      const bins = Array.from({ length: 10 }, (_, i) => raw.changes.filter(change => change.elapsed >= i * 1000 && change.elapsed < (i + 1) * 1000));
      const sample = { width, count, repeat, geometry, amplitude, elapsed: raw.events.at(-1), frames: raw.frames.length, p50: percentile(raw.frames, .5), p95: percentile(raw.frames, .95), max: Math.max(...raw.frames), over25: raw.frames.filter(v => v > 25).length, longTasks: raw.longTasks, events: raw.events.length, cadenceP50: percentile(cadence, .5), cadenceP95: percentile(cadence, .95), latencyP95: percentile(raw.changes.map(v => v.latency).filter(v => v !== null), .95), bins: bins.map(values => ({ changes: values.length, transforms: new Set(values.map(v => v.transform)).size, starts: [...new Set(values.map(v => v.start))] })), external };
      if (sample.bins.some(bin => bin.changes < 5 || bin.transforms < 5)) throw new Error(`Inactive sample ${JSON.stringify(sample)}`);
      results.samples.push(sample);
      await context.close();
    }
    await writeFile(`${cache}/scrubbing.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ completed: { width, count }, samples: results.samples.slice(-3).map(({ repeat, p95, events, cadenceP95, longTasks }) => ({ repeat, p95, events, cadenceP95, longTasks: longTasks.length })) }));
  }
  const after = await fingerprint();
  if (after.sha256 !== before.sha256) throw new Error("Build inputs changed during measurement; results invalid");
  results.unchanged = true;
  await writeFile(`${cache}/scrubbing.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); await server.close(); }
