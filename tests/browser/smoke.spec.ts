import { test, expect, app, timelines, timeline, strip, openFixture, settledRail, visibleCell } from "./fixtures";

test("search, add, rename and retain the saved setup on reload", async ({ page }) => {
  await openFixture(page);
  await app(page).getByRole("combobox").fill("Tokyo");
  await app(page).getByRole("option", { name: /Tokyo/ }).first().click();
  const rename = app(page).getByRole("button", { name: "Rename Tokyo", exact: true });
  await rename.click();
  const editor = app(page).getByRole("textbox", { name: "Edit Tokyo label", exact: true });
  await editor.fill("Tokyo office");
  await editor.press("Enter");
  await expect(app(page).getByRole("button", { name: "Rename Tokyo office", exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("timezone_config") ?? "[]").some((row: { label?: string }) => row.label === "Tokyo office"))).toBe(true);
  await page.reload();
  await expect(timeline(page, "Tokyo office")).toBeVisible();
  await expect(app(page).getByRole("button", { name: "Rename Tokyo office", exact: true })).toHaveCount(1);
});

test("clearing a selected future slot retains the date and rail", async ({ page }) => {
  await openFixture(page);
  await strip(page).getByRole("button").nth(2).click();
  const region = timelines(page).first();
  await settledRail(region);
  const cell = await visibleCell(region);
  const instant = await cell.getAttribute("data-instant");
  const start = await region.getByTestId("timeline-rail").getAttribute("data-start");
  const preview = await region.getAttribute("data-preview-instant");
  await cell.click();
  await expect(app(page).getByRole("status", { name: "Selected time", exact: true })).toContainText("All city clocks show this moment");
  await expect(region.locator("[data-selected]")).toHaveAttribute("data-instant", instant!);
  await region.locator(`[data-instant="${instant}"]`).click();
  await expect(app(page).getByRole("status", { name: "Selected time", exact: true })).toHaveText("Showing live time.");
  await expect(region.locator("[data-selected]")).toHaveCount(0);
  await expect(strip(page).getByRole("button").nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(region.getByTestId("timeline-rail")).toHaveAttribute("data-start", start!);
  await expect(region).toHaveAttribute("data-preview-instant", preview!);
});

test("whole-hour drag preserves cell identity, row alignment and pointer styles", async ({ page }) => {
  await openFixture(page);
  const region = timelines(page).first();
  await settledRail(region);
  const box = await region.boundingBox();
  const cell = await visibleCell(region);
  const retained = await cell.elementHandle();
  const before = await region.getByTestId("timeline-rail").getAttribute("data-start");
  const width = (await cell.boundingBox())!.width;
  await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.8 - width * 2.2, box!.y + box!.height * 0.5, { steps: 12 });
  await expect(region).toHaveAttribute("data-scrubbing", "true");
  await expect(region.getByTestId("timeline-rail")).not.toHaveAttribute("data-start", before!);
  await expect(cell).toHaveCSS("pointer-events", "none");
  await expect(cell).toHaveCSS("transition-duration", "0s");
  expect(await retained!.evaluate(node => node.isConnected), "same instant retains its DOM node across the rebase").toBe(true);
  const previews = await timelines(page).evaluateAll(nodes => nodes.map(node => node.getAttribute("data-preview-instant")));
  expect(new Set(previews).size).toBe(1);
  const starts = await app(page).getByTestId("timeline-rail").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-start")));
  expect(new Set(starts).size).toBe(1);
  await page.mouse.up();
  await expect(region).not.toHaveAttribute("data-scrubbing", "true");
  await expect(cell).toHaveCSS("pointer-events", "auto");
  await expect(cell).toHaveCSS("transition-duration", "0.075s");
  await expect(region.locator("[data-selected]")).toHaveCount(0);
  await (await visibleCell(region)).click();
  await expect(region.locator("[data-selected]")).toHaveCount(1);
});

test("date switches retain one selected tile and one stable Today indicator", async ({ page }) => {
  await openFixture(page);
  const indicator = await app(page).getByTestId("today-indicator").elementHandle();
  for (const day of [1, 3, 0, 2, 0]) {
    await strip(page).getByRole("button").nth(day).click();
    await expect(strip(page).locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(strip(page).getByRole("button").nth(day)).toHaveAttribute("aria-pressed", "true");
    await expect(strip(page).getByRole("button").nth(day)).toHaveCSS("transition-duration", "0s");
    await expect(app(page).getByTestId("today-indicator")).toHaveCount(1);
    await expect(app(page).getByTestId("today-indicator")).toHaveCSS("opacity", "1");
    expect(await indicator!.evaluate(node => node.isConnected)).toBe(true);
  }
});

test("calendar fits 390px and 320px viewports and restores trigger focus", async ({ page }) => {
  await openFixture(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    const trigger = app(page).getByRole("button", { name: "Open calendar", exact: true });
    await trigger.click();
    // The calendar is deliberately portaled outside #root.
    const calendar = page.getByRole("dialog", { name: "Choose date", exact: true });
    await expect(calendar).toBeVisible();
    await expect.poll(() => calendar.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
    })).toBe(true);
    await expect(calendar.getByRole("button", { name: "Saturday, March 7, 2026", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(calendar).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await calendar.getByRole("button", { name: "Today", exact: true }).click();
    await expect(calendar).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("keyboard timeline and row controls preserve focus destinations", async ({ page }) => {
  await openFixture(page);
  const region = timelines(page).first();
  await region.focus();
  const before = await region.getAttribute("data-preview-instant");
  await page.keyboard.press("ArrowRight");
  await expect(region).not.toHaveAttribute("data-preview-instant", before!);
  await page.keyboard.press("Enter");
  await expect(region.locator("[data-selected]")).toHaveCount(1);
  await page.keyboard.press("Space");
  await expect(region.locator("[data-selected]")).toHaveCount(0);
  await page.keyboard.press("Home");
  await expect(region).toHaveAttribute("data-date-mode", "live");
  await expect(region).toHaveAttribute("data-preview-instant", before!);
  const rename = app(page).getByRole("button", { name: "Rename Kolkata", exact: true });
  await rename.focus();
  await page.keyboard.press("Enter");
  let editor = app(page).getByRole("textbox", { name: "Edit Kolkata label", exact: true });
  await editor.fill("Desk");
  await page.keyboard.press("Escape");
  await expect(rename).toBeFocused();
  await page.keyboard.press("Enter");
  editor = app(page).getByRole("textbox", { name: "Edit Kolkata label", exact: true });
  await editor.fill("Desk");
  await page.keyboard.press("Tab");
  await expect(editor).toHaveCount(0);
  const renamed = app(page).getByRole("button", { name: "Rename Desk", exact: true });
  await expect(renamed).not.toBeFocused();
  const destination = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  expect(destination).toMatch(/Desk/);
  await renamed.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Shift+Tab");
  await expect(app(page).getByRole("textbox", { name: "Edit Desk label", exact: true })).toHaveCount(0);
  await expect(renamed).not.toBeFocused();
  const move = app(page).getByRole("button", { name: "Move Desk down", exact: true }).filter({ visible: true });
  await move.focus();
  await page.keyboard.press("Enter");
  await expect(move).toBeFocused();
  await renamed.click();
  const otherAction = app(page).getByRole("button", { name: "Move Desk up", exact: true }).filter({ visible: true });
  await otherAction.click();
  await expect(app(page).getByRole("textbox", { name: "Edit Desk label", exact: true })).toHaveCount(0);
  await expect(otherAction).toBeFocused();
});

test("Toronto rollback hint and Vancouver permanent-time difference", async ({ page }) => {
  await openFixture(page, "scenario=toronto-fall");
  await strip(page).getByRole("button").nth(1).click();
  const toronto = timeline(page, "Toronto");
  await settledRail(toronto);
  const hint = toronto.getByRole("button", { name: /Before the visible timeline\. Show clock change\./ });
  await expect(hint).toBeVisible();
  await hint.focus();
  await page.keyboard.press("Enter");
  await expect(toronto).toBeFocused();
  await expect(toronto.getByRole("img", { name: /Clocks go back/ })).toBeVisible();
  await openFixture(page, "scenario=bc-fall");
  await page.getByRole("button", { name: "Advance minute", exact: true }).click();
  // Row clocks have exact instants and a spoken local clock, independent of animated digits.
  await expect(app(page).getByTestId("row-clock").nth(0)).toHaveAttribute("aria-label", "02:00");
  await expect(app(page).getByTestId("row-clock").nth(1)).toHaveAttribute("aria-label", "01:00");
});

test("Havana keeps daylight time across its canceled November rollback", async ({ page }) => {
  await openFixture(page, "scenario=cuba-fall");
  const havana = timeline(page, "Havana");
  const clock = app(page).getByTestId("row-clock").first();
  await expect(clock).toHaveAttribute("aria-label", "00:59");
  await expect(havana.getByRole("img", { name: /Clocks go back/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Advance minute", exact: true }).click();
  await expect(clock).toHaveAttribute("aria-label", "01:00");
  await expect(havana.getByRole("img", { name: /Clocks go back/ })).toHaveCount(0);
});

test("fake analytics opt-out aborts pending intercepted requests", async ({ page }) => {
  await openFixture(page, "scenario=midnight&analytics=on");
  await strip(page).getByRole("button").nth(1).click();
  await app(page).getByRole("button", { name: "Settings", exact: true }).click();
  const toggle = app(page).getByRole("menuitemcheckbox", { name: "Allow usage analytics", exact: true });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#request-count")).toContainText(/Pending: [1-9]/);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#request-count")).toContainText(/Pending: 0 \| Aborted: [1-9]/);
  const records = await page.locator("#requests").textContent();
  expect(JSON.parse(records!).every((record: { url: string; aborted: boolean }) => record.url === "https://analytics.daybound.invalid/i/v0/e/" && record.aborted)).toBe(true);
});
