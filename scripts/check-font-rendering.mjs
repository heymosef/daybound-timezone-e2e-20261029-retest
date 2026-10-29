// Diagnostic baseline/candidate glyph evidence; never changes application source.
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { seed, serve } from "./measurement-utils.mjs";
const manifest = JSON.parse(await readFile("public/fonts/manifest.json", "utf8"));
const baseline = JSON.parse(await readFile("node_modules/.cache/daybound-measurements/fonts-baseline.json", "utf8"));
const samples = ["Été Łódź São Paulo", "↑↓→←", "Ελληνικά", "Київ", "Tiếng Việt", "東京", "مرحبا", "नमस्ते"];
const browser = await chromium.launch();
const results = {};
try {
  for (const mode of ["baseline", "candidate"]) {
    const server = await serve(`node_modules/.cache/daybound-fonts/${mode === "baseline" ? "baseline-site" : "site"}`, 4185);
    results[mode] = [];
    try {
      const allowed = new Set([baseline.cssURL, ...manifest.files.map(file => file.sourceURL)]);
      for (const [design, family] of [["te-1", "Geist Mono"], ["gamut", "Inter"], ["dos", "Pixelify Sans"]]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
        await context.route("**/*", route => new URL(route.request().url()).origin === server.origin || (mode === "baseline" && allowed.has(route.request().url())) ? route.continue() : route.abort());
        await context.addInitScript(seed, { design, count: 6 });
        const page = await context.newPage();
        await page.goto(server.origin);
        await page.locator(".timeline-viewport").first().waitFor();
        const cdp = await context.newCDPSession(page); await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
        for (const [index, text] of samples.entries()) {
          await page.evaluate(async ({ text, family, index }) => {
            const span = document.createElement("span"); span.id = `font-evidence-${index}`; span.textContent = text;
            Object.assign(span.style, { position: "absolute", left: "0", top: "0", fontFamily: `"${family}", sans-serif`, fontSize: "16px", fontWeight: "500", whiteSpace: "nowrap" });
            document.body.append(span); await document.fonts.load(`500 16px "${family}"`, text); await document.fonts.ready;
          }, { text, family, index });
          const { root } = await cdp.send("DOM.getDocument"); const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `#font-evidence-${index}` });
          const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
          const width = await page.locator(`#font-evidence-${index}`).evaluate(el => el.getBoundingClientRect().width);
          assert(!fonts.some(font => /LastResort|Last Resort/i.test(font.familyName)), "Missing-glyph fallback");
          results[mode].push({ design, family, text, fonts, width });
        }
        await context.close();
      }
      if (mode === "baseline") {
        const context = await browser.newContext();
        for (const font of manifest.files) {
          const response = await context.request.get(font.sourceURL);
          assert(response.ok());
          const sha = createHash("sha256").update(await response.body()).digest("hex");
          assert.equal(sha, font.sha256, `${font.file} official/bundled byte identity`);
        }
        await context.close(); results.officialBinaryHashesMatch = true;
      }
    } finally { await server.close(); }
  }
  assert.deepEqual(results.candidate, results.baseline, "Actual glyph/fallback/layout differences");
  await writeFile("node_modules/.cache/daybound-measurements/font-rendering.json", JSON.stringify(results, null, 2));
  console.log("24 baseline/candidate glyph samples match exactly, including platform fallback, widths and official binary checksums");
} finally { await browser.close(); }
