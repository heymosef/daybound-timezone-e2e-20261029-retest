import { test, expect, app, openFixture } from "./fixtures";

test("two tabs explicitly adopt saved changes before editing without losing either setup", async ({ page, context }) => {
  await openFixture(page);
  const other = await context.newPage();
  await other.goto(page.url()); // Same profile; reset was removed by openFixture.
  await app(page).getByRole("combobox").fill("Tokyo");
  await app(page).getByRole("option", { name: /Tokyo/ }).first().click();
  const notice = app(other).getByRole("status", { name: "Cities changed in another tab", exact: true });
  await expect(notice).toBeVisible();
  await expect(app(other).getByRole("button", { name: "Rename Tokyo", exact: true })).toHaveCount(0);
  await notice.getByRole("button", { name: "Use saved setup", exact: true }).click();
  await app(other).getByRole("button", { name: "Rename Tokyo", exact: true }).click();
  await app(other).getByRole("textbox", { name: "Edit Tokyo label", exact: true }).fill("Tokyo office");
  await app(other).getByRole("textbox", { name: "Edit Tokyo label", exact: true }).press("Enter");
  const firstNotice = app(page).getByRole("status", { name: "Cities changed in another tab", exact: true });
  await expect(firstNotice).toContainText("Tokyo office");
  await expect(app(page).getByRole("button", { name: "Rename Tokyo", exact: true })).toBeVisible();
  await firstNotice.getByRole("button", { name: "Use saved setup", exact: true }).click();
  await expect(app(page).getByRole("button", { name: "Rename Tokyo office", exact: true })).toBeVisible();
  await page.reload();
  await expect(app(page).getByRole("button", { name: "Rename Tokyo office", exact: true })).toBeVisible();
  await other.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("timezone_config")!);
    rows[rows.length - 1].label = "x".repeat(1024);
    localStorage.setItem("timezone_config", JSON.stringify(rows));
  });
  const longPreview = app(page).getByRole("status", { name: "Cities changed in another tab", exact: true });
  await expect(longPreview).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await longPreview.getByRole("button", { name: "Use saved setup", exact: true }).click();
  await expect(app(page).getByRole("button", { name: `Rename ${"x".repeat(1024)}`, exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await other.close();
});

test("invalid and cleared external values never silently replace this tab", async ({ page, context }) => {
  await openFixture(page);
  const other = await context.newPage(); await other.goto(page.url());
  // Navigation can finish before React mounts. Corrupt only after this tab has
  // read the valid setup, otherwise its startup recovery can race the test.
  await expect(app(other).getByRole("button", { name: "Rename Kolkata", exact: true })).toBeVisible();
  await other.evaluate(() => localStorage.setItem("timezone_config", "{broken"));
  let notice = app(page).getByRole("status", { name: "Cities changed in another tab", exact: true });
  await expect(notice.getByRole("button", { name: "Use saved setup", exact: true })).toBeDisabled();
  await expect(app(page).getByRole("button", { name: "Rename Kolkata", exact: true })).toBeVisible();
  await notice.getByRole("button", { name: "Replace saved setup with this tab", exact: true }).click();
  await expect(notice).toHaveCount(0);
  await other.evaluate(() => localStorage.removeItem("timezone_config"));
  notice = app(page).getByRole("status", { name: "Cities changed in another tab", exact: true });
  await expect(notice).toContainText("an empty city list");
  await expect(app(page).getByRole("button", { name: "Rename Kolkata", exact: true })).toBeVisible();
  await notice.getByRole("button", { name: "Use cleared city list", exact: true }).click();
  await expect(app(page).getByText("No timezones added", { exact: true })).toBeVisible();
  await expect(app(page).getByRole("button", { name: /^Rename / })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("timezone_config"))).toBeNull();
  await app(page).getByRole("combobox").fill("Tokyo");
  await app(page).getByRole("option", { name: /Tokyo/ }).first().click();
  await expect(app(page).getByRole("button", { name: "Remove Tokyo", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("timezone_config")!)[0].isHome)).toBe(true);
  await page.reload();
  await expect(app(page).getByRole("button", { name: "Rename Tokyo", exact: true })).toBeVisible();
  await expect(app(page).getByRole("button", { name: "Remove Tokyo", exact: true })).toHaveCount(0);
  await other.close();
});

test("quota failures retain an editable in-memory visit with a truthful save notice", async ({ page }) => {
  await openFixture(page, "scenario=midnight&storage=quota");
  await app(page).getByRole("combobox").fill("Tokyo");
  await app(page).getByRole("option", { name: /Tokyo/ }).first().click();
  await expect(app(page).getByRole("button", { name: "Rename Tokyo", exact: true })).toBeVisible();
  await expect(app(page).getByRole("status", { name: "Local save status", exact: true })).toContainText("cannot be saved");
  await page.reload();
  await expect(app(page).getByRole("button", { name: "Rename Tokyo", exact: true })).toHaveCount(0);
});
