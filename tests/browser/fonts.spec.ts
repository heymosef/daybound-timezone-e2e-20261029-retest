import { test, expect, app, openFixture } from "./fixtures";

const designs = [
  { design: "te-1", menu: "TE-1", family: "Geist Mono" },
  { design: "gamut", menu: "Gamut", family: "Inter" },
  { design: "dos", menu: "DOS", family: "Pixelify Sans" },
];

test("each design loads local fonts and renders international labels with fallback", async ({ page, context }) => {
  await openFixture(page);
  const label = "Été Łódź São Paulo → 東京 مرحبا नमस्ते";
  await app(page).getByRole("button", { name: "Rename UTC", exact: true }).click();
  await app(page).getByRole("textbox", { name: "Edit UTC label", exact: true }).fill(label);
  await page.keyboard.press("Enter");
  const city = app(page).getByRole("button", { name: `Rename ${label}`, exact: true }).locator("span").first();
  const cdp = await context.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  for (const { design, menu, family } of designs) {
    await app(page).getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("menuitemradio", { name: menu, exact: true }).press("Enter");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-design-theme", design);
    const faces = await page.evaluate(async ({ family, label }) => {
      await document.fonts.load(`500 16px "${family}"`, label);
      await document.fonts.ready;
      return [...document.fonts].filter(face => face.family.replaceAll('"', "") === family && face.status === "loaded").length;
    }, { family, label });
    expect(faces, `${family} loaded faces`).toBeGreaterThan(0);
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: '[data-row-action="rename"] > span' });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    expect(fonts.some(font => font.familyName === family && font.isCustomFont && font.glyphCount > 0), "Latin glyphs use intended downloaded face").toBe(true);
    expect(fonts.some(font => !font.isCustomFont && font.glyphCount > 0), "uncovered scripts use system fallback").toBe(true);
    expect(fonts.some(font => /LastResort|Last Resort/i.test(font.familyName)), "no missing-glyph fallback").toBe(false);
    await expect(city).toHaveText(label);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no page overflow").toBe(true);
    const requests = await page.evaluate(() => performance.getEntriesByType("resource").filter(entry => /\.woff2(?:$|\?)/.test(entry.name)).map(entry => new URL(entry.name).origin));
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every(origin => origin === "http://127.0.0.1:4176")).toBe(true);
  }
});
