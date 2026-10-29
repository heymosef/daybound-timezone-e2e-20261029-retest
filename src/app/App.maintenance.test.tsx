import React from "react";
import { act, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
const original = [
  { id: "home", timezone: "UTC", isHome: true },
  { id: "team", timezone: "America/Toronto", label: "Toronto team", country: "Canada", isHome: false },
  { id: "tokyo", timezone: "Asia/Tokyo", label: "Tokyo", isHome: false },
];
const stored = () => JSON.parse(localStorage.getItem("timezone_config")!);
function external(key: string, value: unknown, clear = false) {
  act(() => {
    if (clear) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new StorageEvent("storage", { key: clear ? null : key, storageArea: localStorage }));
  });
}
function remove(label: string) { fireEvent.click(screen.getAllByRole("button", { name: `Remove ${label}` })[0]); }
beforeEach(() => {
  localStorage.clear(); localStorage.setItem("timezone_config", JSON.stringify(original));
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("keeps a tab's setup until explicit adoption and preserves the selected instant on a home change", () => {
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "24 Oct" }));
  const selected = screen.getAllByTestId("row-clock")[0].getAttribute("datetime");
  const other = [{ id: "island", timezone: "Pacific/Kiritimati", isHome: true }];
  external("timezone_config", other);
  expect(screen.getByRole("button", { name: "Rename Toronto team" })).toBeInTheDocument();
  expect(screen.queryByText(/Your changes are saved locally/)).not.toBeInTheDocument();
  const notice = screen.getByRole("status", { name: "Cities changed in another tab" });
  fireEvent.click(within(notice).getByRole("button", { name: "Use saved setup" }));
  expect(screen.getByRole("button", { name: "25 Oct", pressed: true })).toBeInTheDocument();
  expect(stored()).toEqual(other);
  expect(screen.getAllByTestId("row-clock").every(clock => clock.getAttribute("datetime") === selected)).toBe(true);
});
it("requires an explicit cleared-state choice and keeps the list empty for this visit", async () => {
  render(<App />); external("timezone_config", null, true);
  expect(screen.getByRole("button", { name: "Rename Toronto team" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Use cleared city list" }));
  expect(screen.getByText("No timezones added")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("button", { name: "Rename Toronto team" })).not.toBeInTheDocument());
  expect(localStorage.getItem("timezone_config")).toBeNull();
});
it("retains the local version and permits explicit replacement of invalid saved data", () => {
  render(<App />); external("timezone_config", { invalid: true });
  const notice = screen.getByRole("status", { name: "Cities changed in another tab" });
  expect(within(notice).getByRole("button", { name: "Use saved setup" })).toBeDisabled();
  fireEvent.click(within(notice).getByRole("button", { name: "Replace saved setup with this tab" }));
  expect(stored()).toEqual(original);
  expect(screen.queryByRole("status", { name: "Cities changed in another tab" })).not.toBeInTheDocument();
});
it("restores original data/order immediately during the exit animation without moving the timeline", () => {
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "24 Oct" }));
  const rail = screen.getAllByTestId("timeline-rail")[0].getAttribute("style");
  const selected = screen.getAllByTestId("row-clock")[0].getAttribute("datetime");
  remove("Toronto team"); expect(stored()).toEqual([original[0], original[2]]);
  fireEvent.click(screen.getByRole("button", { name: "Undo removal of Toronto team" }));
  expect(stored()).toEqual(original);
  expect(screen.getByRole("button", { name: "Rename Toronto team" })).toHaveFocus();
  expect(screen.getAllByTestId("timeline-rail")[0].getAttribute("style")).toBe(rail);
  expect(screen.getAllByTestId("row-clock")[0].getAttribute("datetime")).toBe(selected);
});
it("keeps only the most recent removal", () => {
  render(<App />); remove("Toronto team"); remove("Tokyo");
  expect(screen.queryByRole("button", { name: "Undo removal of Toronto team" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Undo removal of Tokyo" }));
  expect(stored()).toEqual([original[0], original[2]]);
});
it("preserves a newly chosen home and live neighbor order when Undo restores a city", () => {
  render(<App />); remove("Toronto team");
  fireEvent.click(screen.getByRole("button", { name: "Set Tokyo as home timezone" }));
  fireEvent.click(screen.getByRole("button", { name: "Undo removal of Toronto team" }));
  expect(stored().map((row: {id: string}) => row.id)).toEqual(["team", "tokyo", "home"]);
  expect(stored().find((row: {isHome: boolean}) => row.isHome)?.id).toBe("tokyo");
  expect(stored().find((row: {id: string}) => row.id === "team").label).toBe("Toronto team");
});
it("moves focus safely if an external change invalidates focused Undo", () => {
  render(<App />); remove("Toronto team"); const undo = screen.getByRole("button", { name: "Undo removal of Toronto team" });
  undo.focus(); external("timezone_config", [original[0], original[2]]);
  expect(screen.queryByRole("button", { name: "Undo removal of Toronto team" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Rename UTC" })).toHaveFocus();
});
it("does not steal unrelated focus when a pointer removal occurs", () => {
  render(<App />); const settings = screen.getByRole("button", { name: /settings/i }); settings.focus();
  remove("Toronto team"); expect(settings).toHaveFocus();
});
it("saves a maximum-length label and keeps it through reload", async () => {
  const user = userEvent.setup(); const view = render(<App />);
  await user.click(screen.getByRole("button", { name: "Rename Toronto team" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Edit Toronto team label" }), { target: { value: "x".repeat(1024) } });
  await user.keyboard("{Enter}"); expect(stored()[1].label).toHaveLength(1024);
  view.unmount(); render(<App />);
  expect(screen.getByRole("button", { name: `Rename ${"x".repeat(1024)}` })).toBeInTheDocument();
});

it("clears a focused Undo when the same timezone is manually re-added without duplicates", () => {
  render(<App />); remove("Toronto team");
  const undo = screen.getByRole("button", { name: "Undo removal of Toronto team" });
  undo.focus(); fireEvent.change(screen.getByRole("combobox"), { target: { value: "Toronto" } });
  fireEvent.click(screen.getByRole("option", { name: /Toronto/ }));
  expect(screen.queryByRole("button", { name: "Undo removal of Toronto team" })).not.toBeInTheDocument();
  expect(screen.getByText("City is already added.")).toBeInTheDocument();
  expect(stored().filter((row: {timezone: string}) => row.timezone === "America/Toronto")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Rename UTC" })).toHaveFocus();
});
it("supports in-memory Undo when saving fails with quota errors", () => {
  render(<App />);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  remove("Toronto team");
  fireEvent.click(screen.getByRole("button", { name: "Undo removal of Toronto team" }));
  expect(screen.getByRole("button", { name: "Rename Toronto team" })).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Local save status" })).toHaveTextContent("cannot be saved");
  expect(stored()).toEqual(original);
});
it("makes the first city added after a cleared setup home, including after reload", async () => {
  const view = render(<App />); external("timezone_config", null, true);
  fireEvent.click(screen.getByRole("button", { name: "Use cleared city list" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Rename Tokyo" })).not.toBeInTheDocument());
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "Toronto" } });
  fireEvent.click(screen.getByRole("option", { name: /Toronto/ }));
  expect(stored()).toHaveLength(1); expect(stored()[0].isHome).toBe(true);
  expect(screen.queryByRole("button", { name: "Remove Toronto" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /settings/i }));
  expect(within(screen.getByRole("menu")).getByRole("combobox", { name: "Home City" })).toHaveValue(stored()[0].id);
  view.unmount(); render(<App />);
  expect(stored()[0].isHome).toBe(true);
  expect(screen.queryByRole("button", { name: "Remove Toronto" })).not.toBeInTheDocument();
});
