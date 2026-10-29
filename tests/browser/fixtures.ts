import { test as base, expect, type Page, type Locator } from "@playwright/test";

const origin = "http://127.0.0.1:4176";

export const test = base.extend<{ offlineGuard: void }>({
  offlineGuard: [async ({ context }, use) => {
    const errors: string[] = [];
    await context.route("**/*", async route => {
      const request = route.request();
      if (new URL(request.url()).origin === origin) return route.continue();
      errors.push(`External ${request.resourceType()}: ${request.url()}`);
      await route.abort("blockedbyclient");
    });
    context.on("page", page => {
      page.on("pageerror", error => errors.push(`Page error: ${error.message}`));
      page.on("console", message => {
        if (message.type() !== "error") return;
        const value = message.text();
        errors.push(`Console: ${value}`);
      });
      page.on("requestfailed", request => {
        errors.push(`Failed request: ${request.url()} (${request.failure()?.errorText})`);
      });
    });
    await use();
    expect(errors, "offline requests and browser errors").toEqual([]);
  }, { auto: true }],
});
export { expect };
export const app = (page: Page) => page.locator("#root");
export const timelines = (page: Page) => app(page).getByRole("region", { name: /timeline\. Drag horizontally/ });
export const strip = (page: Page) => app(page).getByRole("group", { name: "Next seven days" });
export const timeline = (page: Page, city: string) => app(page).getByRole("region", { name: new RegExp(`^${city} timeline\\.`) });

export async function openFixture(page: Page, query = "scenario=midnight") {
  await page.goto(`/?${query}&reset=1`);
  await expect(timelines(page).first()).toBeVisible();
  // Reloads and any second page with the same profile must retain the saved setup.
  await page.evaluate(() => { const url = new URL(location.href); url.searchParams.delete("reset"); history.replaceState(null, "", url); });
}

export async function settledRail(region: Locator) {
  await expect.poll(() => region.getByTestId("timeline-rail").locator(":scope > div").evaluate(node => {
    const style = getComputedStyle(node);
    return style.opacity === "1" && (style.transform === "none" || style.transform === "matrix(1, 0, 0, 1, 0, 0)");
  })).toBe(true);
}

export async function visibleCell(region: Locator) {
  const box = await region.boundingBox();
  if (!box) throw new Error("Timeline has no geometry");
  const cells = region.locator("[data-timeline-cell]");
  const index = await cells.evaluateAll((nodes, viewport) => nodes.findIndex(node => {
    const rect = node.getBoundingClientRect();
    return rect.left >= viewport.x + 8 && rect.right <= viewport.x + viewport.width - 8;
  }), box);
  if (index < 0) throw new Error("No fully visible timeline cell");
  return cells.nth(index);
}
