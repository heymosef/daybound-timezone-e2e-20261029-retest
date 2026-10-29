import { test, expect, app, openFixture, strip, timelines, settledRail } from "./fixtures";

test("keyboard city actions are visible and Undo restores saved order, focus and selected time", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openFixture(page);
  await strip(page).getByRole("button").nth(1).click();
  await settledRail(timelines(page).first());
  const original = await page.evaluate(() => localStorage.getItem("timezone_config"));
  const instant = await app(page).getByTestId("row-clock").first().getAttribute("datetime");
  const remove = app(page).getByRole("button", { name: "Remove Kolkata", exact: true }).filter({ visible: true });
  await page.keyboard.press("Tab"); // Enter keyboard modality before inspecting :focus-visible.
  await remove.focus();
  await expect.poll(() => remove.evaluate(node => {
    let current: Element | null = node;
    while (current) { if (Number(getComputedStyle(current).opacity) < 1) return false; current = current.parentElement; }
    return getComputedStyle(node).outlineStyle !== "none";
  })).toBe(true);
  await page.keyboard.press("Enter");
  const undo = app(page).getByRole("button", { name: "Undo removal of Kolkata", exact: true });
  await expect(undo).toBeFocused();
  const toast = app(page).getByRole("status", { name: "Removed city", exact: true });
  await expect(toast).toContainText("Kolkata removed");
  await expect(toast.locator("..")).toHaveCSS("position", "fixed");
  await expect(toast).toHaveCSS("animation-name", "city-removal-toast-enter");
  await expect.poll(() => toast.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return rect.left >= 0 && Math.abs(rect.right - (innerWidth - 16)) < 1 && rect.bottom <= innerHeight - 16 && rect.bottom >= innerHeight - 32;
  })).toBe(true);
  await undo.click();
  await expect(app(page).getByRole("button", { name: "Rename Kolkata", exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("timezone_config"))).toBe(original);
  await expect(app(page).getByTestId("row-clock").first()).toHaveAttribute("datetime", instant!);
  await expect(strip(page).getByRole("button").nth(1)).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("external divergence invalidates a focused Undo without dropping keyboard focus", async ({ page, context }) => {
  await openFixture(page); const other = await context.newPage(); await other.goto(page.url());
  const remove = app(page).getByRole("button", { name: "Remove Kolkata", exact: true }).filter({ visible: true });
  await remove.focus(); await page.keyboard.press("Enter");
  await expect(app(page).getByRole("button", { name: "Undo removal of Kolkata", exact: true })).toBeFocused();
  // A genuine other-page write, distinct from the local removal and its storage event.
  await other.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("timezone_config")!);
    rows.push({ id: "external-tokyo", timezone: "Asia/Tokyo", isHome: false });
    localStorage.setItem("timezone_config", JSON.stringify(rows));
  });
  await expect(app(page).getByRole("button", { name: "Undo removal of Kolkata", exact: true })).toHaveCount(0);
  await expect(app(page).getByRole("button", { name: "Rename UTC", exact: true })).toBeFocused();
  await other.close();
});

test("reduced motion shows the corner toast immediately without sliding", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFixture(page);
  const remove = app(page).getByRole("button", { name: "Remove Kolkata", exact: true }).filter({ visible: true });
  await remove.focus();
  await page.keyboard.press("Enter");
  const toast = app(page).getByRole("status", { name: "Removed city", exact: true });
  await expect(toast).toHaveCSS("animation-name", "none");
  await expect(toast).toHaveCSS("transform", "none");
  await expect(toast).toHaveCSS("opacity", "1");
  await toast.getByRole("button", { name: "Undo removal of Kolkata", exact: true }).click();
  await expect(app(page).getByRole("button", { name: "Rename Kolkata", exact: true })).toBeFocused();
});


test("pointer removal expires after five seconds and slides out of the corner", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openFixture(page);
  await page.evaluate(() => document.addEventListener("animationstart", event => {
    if (event.animationName === "city-removal-toast-exit") {
      document.documentElement.dataset.toastExit = event.animationName;
    }
  }));
  await app(page).locator('[data-row-id]').filter({ has: page.getByRole("button", { name: "Rename Kolkata", exact: true }) }).hover();
  await app(page).getByRole("button", { name: "Remove Kolkata", exact: true }).filter({ visible: true }).click();
  await page.mouse.move(1, 1);
  const toast = app(page).getByRole("status", { name: "Removed city", exact: true });
  await expect(toast).toBeVisible();
  await expect(toast.getByRole("button")).not.toBeFocused();
  await expect(app(page).locator("[data-undo-notice]")).toHaveCount(0, { timeout: 7000 });
  await expect(page.locator("html")).toHaveAttribute("data-toast-exit", "city-removal-toast-exit");
});
