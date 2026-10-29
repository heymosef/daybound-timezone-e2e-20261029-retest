import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SettingsMenu } from "./SettingsMenu";
import { DEFAULT_SETTINGS } from "../../utils/persistence";

// jsdom lacks the native dialog methods; browser checks own focus containment/Escape.
const methods = ["showModal", "close"] as const;
const originals = methods.map(method => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, method));
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } },
    close: { configurable: true, value: function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    } },
  });
});
afterAll(() => methods.forEach((method, i) => {
  if (originals[i]) Object.defineProperty(HTMLDialogElement.prototype, method, originals[i]!);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, method);
}));

function mountCredits() {
  render(<SettingsMenu settings={DEFAULT_SETTINGS} onSettingsChange={vi.fn()} timezones={[]} onSetHome={vi.fn()} />);
  const settings = screen.getByRole("button", { name: /settings/i });
  fireEvent.click(settings);
  return settings;
}

it("closes Settings and keeps the named credits modal mounted after the dropdown exits", async () => {
  const settings = mountCredits();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "City data credits" }));
  const dialog = screen.getByRole("dialog", { name: "City data credits" });
  expect(dialog).toHaveAttribute("open");
  expect(settings).toHaveAttribute("aria-expanded", "false");
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getAllByRole("heading")).toHaveLength(1);
  expect(within(dialog).getByRole("link", { name: /^GeoNames/ })).toHaveAttribute("href", "https://www.geonames.org/");
  expect(within(dialog).getByRole("link", { name: /^Creative Commons Attribution 4.0/ })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
  expect(within(dialog).getByRole("link", { name: /^Source data and documentation/ })).toHaveAttribute("href", "https://download.geonames.org/export/dump/readme.txt");
  for (const link of within(dialog).getAllByRole("link")) expect(link).toHaveAttribute("target", "_blank");
  expect(dialog).toHaveTextContent("coordinates and population data removed");
});

it("closes and returns focus to Settings, and can reopen", () => {
  const settings = mountCredits();
  const trigger = screen.getByRole("menuitem", { name: "City data credits" });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "Close credits" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(settings).toHaveFocus();
  fireEvent.click(settings);
  fireEvent.click(screen.getByRole("menuitem", { name: "City data credits" }));
  expect(screen.getByRole("dialog", { name: "City data credits" })).toHaveAttribute("open");
});

it("dismisses a backdrop click while keeping content clicks open", () => {
  const settings = mountCredits();
  fireEvent.click(screen.getByRole("menuitem", { name: "City data credits" }));
  const dialog = screen.getByRole("dialog", { name: "City data credits" });
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({ left: 100, right: 500, top: 100, bottom: 400 } as DOMRect);
  fireEvent.click(within(dialog).getByRole("heading", { name: "City data credits" }));
  fireEvent.click(dialog, { clientX: 150, clientY: 150 });
  expect(dialog).toHaveAttribute("open");
  fireEvent.click(dialog, { clientX: 50, clientY: 50 });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(settings).toHaveFocus();
});

it("wraps keyboard focus between the close button and final source link", () => {
  mountCredits();
  fireEvent.click(screen.getByRole("menuitem", { name: "City data credits" }));
  const close = screen.getByRole("button", { name: "Close credits" });
  const source = screen.getByRole("link", { name: /^Source data and documentation/ });
  close.focus();
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(source).toHaveFocus();
  fireEvent.keyDown(source, { key: "Tab" });
  expect(close).toHaveFocus();
});
