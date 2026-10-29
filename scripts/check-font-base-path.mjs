// Focused nested-hosting check; this build has the same isolated analytics boundary.
import path from "node:path";
import assert from "node:assert/strict";
import { build } from "vite";
import { chromium } from "@playwright/test";
import { seed, serve } from "./measurement-utils.mjs";
if (!process.version.startsWith("v24.")) throw new Error("Use Node24");
await build({
  configFile: path.resolve("vite.config.ts"), envFile: false, base: "./",
  define: { "import.meta.env.VITE_PUBLIC_POSTHOG_KEY": "undefined", "import.meta.env.VITE_PUBLIC_POSTHOG_HOST": "undefined" },
  build: { outDir: "node_modules/.cache/daybound-fonts/relative", emptyOutDir: true },
});
const server = await serve("node_modules/.cache/daybound-fonts", 4186);
const browser = await chromium.launch();
try {
  for (const [design, family] of [["te-1", "Geist Mono"], ["gamut", "Inter"], ["dos", "Pixelify Sans"]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const errors = [], fonts = [];
    await context.route("**/*", route => new URL(route.request().url()).origin === server.origin ? route.continue() : (errors.push(route.request().url()), route.abort()));
    await context.addInitScript(seed, { design, count: 6 });
    const page = await context.newPage();
    page.on("requestfailed", request => errors.push(request.url()));
    page.on("response", response => { if (response.url().endsWith(".woff2")) { fonts.push(response.url()); if (!response.ok()) errors.push(`HTTP${response.status()} ${response.url()}`); } });
    await page.goto(`${server.origin}/relative/`); await page.locator(".timeline-viewport").first().waitFor();
    assert(await page.evaluate(async family => { await document.fonts.ready; return [...document.fonts].some(face => face.family.replaceAll('"', "") === family && face.status === "loaded"); }, family));
    assert(fonts.length > 0 && fonts.every(url => new URL(url).pathname.startsWith("/relative/fonts/")), "Nested font URLs must remain under the build base");
    assert.deepEqual(errors, []); await context.close();
  }
  console.log("All three designs load local fonts beneath /relative/ with base './'");
} finally { await browser.close(); await server.close(); }
