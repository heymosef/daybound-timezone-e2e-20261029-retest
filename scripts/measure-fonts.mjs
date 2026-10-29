// Cold-context font investigation; production build is isolated and analytics-free.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fingerprint, seed, serve } from "./measurement-utils.mjs";

if (!process.version.startsWith("v24.")) throw new Error("Use Node24");
const cache = "node_modules/.cache/daybound-measurements";
await mkdir(cache, { recursive: true });
const baselineMode = process.argv.includes("--baseline");
const cssURL = baselineMode ? JSON.parse(await readFile("public/fonts/manifest.json", "utf8")).baselineCssURL
  : (await readFile("src/styles/fonts.css", "utf8")).match(/@import url\("([^"]+)"\)/)?.[1];
const browser = await chromium.launch();
const before = await fingerprint();
const server = await serve(`node_modules/.cache/daybound-fonts/${baselineMode ? "baseline-site" : "site"}`, 4182);
const results = { baselineMode, browser: browser.version(), node: process.version, fingerprint: before, network: { latency: 40, downloadThroughput: 1250000, uploadThroughput: 250000 }, cpuRate: 1, cssURL, css: null, cssFailure: null, samples: [] };
const allowedFonts = new Set();
try {
  if (cssURL) {
    const context = await browser.newContext();
    const userAgent = await (await context.newPage()).evaluate(() => navigator.userAgent);
    try {
      const response = await context.request.get(cssURL, { headers: { "User-Agent": userAgent }, timeout: 20000 });
      if (!response.ok()) throw new Error(`CSS HTTP ${response.status()}`);
      results.css = await response.text();
      for (const match of results.css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g)) allowedFonts.add(match[1]);
      if (!allowedFonts.size) throw new Error("CSS supplied no WOFF2 font URLs");
    } catch (error) { results.cssFailure = String(error); }
    await context.close();
  }
  for (const width of [390, 1280]) for (const design of ["te-1", "gamut", "dos"]) {
    for (let repeat = 1; repeat <= 3; repeat++) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: "UTC", locale: "en-US", serviceWorkers: "block" });
      const external = [], rejected = [], failures = [], requests = [], sizes = [];
      await context.route("**/*", async route => {
        const request = route.request(); const url = request.url();
        if (new URL(url).origin === server.origin) return route.continue();
        external.push(url);
        if (cssURL && (url === cssURL || allowedFonts.has(url))) return route.continue();
        rejected.push(url); await route.abort();
      });
      await context.addInitScript(seed, { design, count: 6 });
      await context.addInitScript(() => {
        window.measureFontCLS = [];
        new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.measureFontCLS.push(e.value); }).observe({ type: "layout-shift", buffered: true });
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: 1250000, uploadThroughput: 250000 });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
      page.on("requestfailed", request => failures.push({ url: request.url(), reason: request.failure()?.errorText }));
      page.on("requestfinished", request => { requests.push(request.url()); sizes.push(request.sizes().then(size => ({ url: request.url(), ...size }))); });
      await page.goto(server.origin, { waitUntil: "load", timeout: 30000 });
      await page.locator(".timeline-viewport").first().waitFor();
      const timing = await page.evaluate(async () => {
        await document.fonts.ready;
        return { ready: performance.now(), design: document.documentElement.dataset.designTheme, computed: getComputedStyle(document.querySelector('[data-row-action="rename"] > span')).fontFamily, faces: [...document.fonts].map(face => ({ family: face.family, weight: face.weight, status: face.status, unicodeRange: face.unicodeRange })), cls: window.measureFontCLS.reduce((a, b) => a + b, 0), fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime, resources: performance.getEntriesByType("resource").filter(e => /fonts\.(googleapis|gstatic)\.com|\.woff2/.test(e.name)).map(e => ({ name: e.name, start: e.startTime, duration: e.duration, transferSize: e.transferSize, encodedBodySize: e.encodedBodySize })) };
      });
      const { root } = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: '[data-row-action="rename"] > span' });
      const platform = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      const sample = { width, design, repeat, ...timing, platformFonts: platform.fonts, external, rejected, failures, sizes: await Promise.all(sizes), requests };
      results.samples.push(sample);
      await context.close();
    }
    await writeFile(`${cache}/fonts-${cssURL ? "baseline" : "candidate"}.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ completed: { width, design }, samples: results.samples.slice(-3).map(({ repeat, ready, cls, platformFonts, failures }) => ({ repeat, ready, cls, platformFonts, failures })) }));
  }
  if ((await fingerprint()).sha256 !== before.sha256) throw new Error("Build input drift during font measurement");
  results.unchanged = true;
  await writeFile(`${cache}/fonts-${cssURL ? "baseline" : "candidate"}.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); await server.close(); }
