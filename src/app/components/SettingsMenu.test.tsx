import { offlineAnalyticsOptions, createFetchMock } from "../../test/analytics";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsMenu } from "./SettingsMenu";
import { AnalyticsProvider } from "../../analytics/AnalyticsProvider";
import { ANALYTICS_PREFERENCE_KEY, createAnalytics, type AnalyticsOptions } from "../../analytics/analytics";
import { DEFAULT_SETTINGS } from "../../utils/persistence";

const OPTIONS = offlineAnalyticsOptions();
let request: ReturnType<typeof createFetchMock>;
beforeEach(() => {
  localStorage.clear();
  request = createFetchMock();
  vi.stubGlobal("fetch", request);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function mountSettings(options: AnalyticsOptions = OPTIONS) {
  const controller = createAnalytics(options);
  const view = render(<AnalyticsProvider controller={controller}><SettingsMenu settings={DEFAULT_SETTINGS} onSettingsChange={vi.fn()} timezones={[]} onSetHome={vi.fn()} /></AnalyticsProvider>);
  fireEvent.click(screen.getByRole("button", { name: /settings/i }));
  return { ...view, controller };
}
const toggle = () => screen.getByRole("menuitemcheckbox", { name: "Allow usage analytics" });
const status = () => screen.getByRole("status", { name: "Usage analytics status" });

it("has a named, described native toggle with keyboard activation and focus styling", async () => {
  const user = userEvent.setup();
  mountSettings();
  expect(toggle()).toHaveAttribute("aria-checked", "true");
  expect(toggle()).toHaveAccessibleDescription("Help improve Daybound by sharing usage and city search data.");
  expect(toggle()).toHaveClass("focus-visible:ring-2", "focus-visible:ring-[var(--dt-accent)]");
  toggle().focus();
  await user.keyboard(" ");
  expect(toggle()).toHaveAttribute("aria-checked", "false");
  expect(JSON.parse(localStorage.getItem(ANALYTICS_PREFERENCE_KEY)!).enabled).toBe(false);
  await user.keyboard("{Enter}");
  expect(toggle()).toHaveAttribute("aria-checked", "true");
  expect(request).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: /settings/i })).toHaveFocus();
});

it("reads a durable opt-out before any event and retains it after reload", () => {
  localStorage.setItem(ANALYTICS_PREFERENCE_KEY, '{"version":1,"enabled":false}');
  const { unmount } = mountSettings();
  expect(toggle()).toHaveAttribute("aria-checked", "false");
  expect(status()).toHaveTextContent(/^Off$/);
  unmount();
  mountSettings();
  expect(toggle()).toHaveAttribute("aria-checked", "false");
  expect(request).not.toHaveBeenCalled();
});

it("shows failed opt-out/opt-in persistence truthfully and requires successful explicit opt-in", () => {
  mountSettings();
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  fireEvent.click(toggle());
  expect(toggle()).toHaveAttribute("aria-checked", "false");
  expect(status()).toHaveTextContent("Off for this visit; preference could not be saved.");
  expect(JSON.parse(localStorage.getItem(ANALYTICS_PREFERENCE_KEY)!).enabled).toBe(true);
  fireEvent.click(toggle());
  expect(toggle()).toHaveAttribute("aria-checked", "false");
  expect(status()).toHaveTextContent("Off for this visit; preference could not be saved.");
  write.mockRestore();
  fireEvent.click(toggle());
  expect(toggle()).toHaveAttribute("aria-checked", "true");
  expect(status()).toHaveTextContent(/^On$/);
  expect(request).not.toHaveBeenCalled();
});

it.each([
  { ...OPTIONS, token: undefined }, { ...OPTIONS, host: "http://invalid.example" },
  { ...OPTIONS, production: false }, { ...OPTIONS, hostname: "127.0.0.1" },
  { ...OPTIONS, doNotTrack: () => true },
])("shows an unavailable off control for gated policy %j", (options) => {
  mountSettings(options);
  expect(toggle()).toBeDisabled();
  expect(toggle()).toHaveAttribute("aria-checked", "false");
  expect(status()).toHaveTextContent("Usage analytics is unavailable here.");
  fireEvent.click(toggle());
  expect(request).not.toHaveBeenCalled();
});

it("aborts pending requests when the real Settings control opts out", () => {
  request.mockImplementation(() => new Promise<Response>(() => {}));
  const { controller } = mountSettings();
  controller.capture("calendar_opened");
  const signal = request.mock.calls[0][1]!.signal!;
  expect(signal.aborted).toBe(false);
  fireEvent.click(toggle());
  expect(signal.aborted).toBe(true);
  controller.capture("calendar_opened");
  expect(request).toHaveBeenCalledTimes(1);
});

it("associates the Home City label with its keyboard-operable select", async () => {
  const user = userEvent.setup(); const onSetHome = vi.fn();
  render(<SettingsMenu settings={DEFAULT_SETTINGS} onSettingsChange={vi.fn()} onSetHome={onSetHome}
    timezones={[{ id: "utc", timezone: "UTC", isHome: true }, { id: "toronto", timezone: "America/Toronto" }]} />);
  await user.click(screen.getByRole("button", { name: /settings/i }));
  const select = screen.getByRole("combobox", { name: "Home City" });
  select.focus(); await user.selectOptions(select, "toronto");
  expect(onSetHome).toHaveBeenCalledWith("toronto");
});
