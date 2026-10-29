import { offlineAnalyticsOptions, createFetchMock } from "../test/analytics";
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import * as calendarFields from "../utils/calendarDate";
import { AnalyticsProvider } from "../analytics/AnalyticsProvider";
import { ANALYTICS_PREFERENCE_KEY, createAnalytics } from "../analytics/analytics";


const LOCAL_SAVE_NOTICE_COPY =
  "Your changes are saved locally on this device. You can close this page and come back anytime.";

it("puts City data credits in Settings instead of the footer", () => {
  localStorage.clear();
  render(<App />);
  expect(screen.queryByRole("menuitem", { name: "City data credits" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /settings/i }));
  expect(within(screen.getByRole("menu")).getByRole("menuitem", { name: "City data credits" })).toBeInTheDocument();
});

describe("App local save notice", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the local save notice by default", () => {
    render(<App />);

    expect(screen.getByText(LOCAL_SAVE_NOTICE_COPY)).toBeInTheDocument();
  });

  it("dismisses notice and keeps it hidden after reload", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.click(
      screen.getByRole("button", {
        name: "Dismiss local save notice",
      }),
    );

    expect(screen.queryByText(LOCAL_SAVE_NOTICE_COPY)).not.toBeInTheDocument();
    expect(localStorage.getItem("local_save_notice_dismissed")).toBe("true");

    unmount();
    render(<App />);

    expect(screen.queryByText(LOCAL_SAVE_NOTICE_COPY)).not.toBeInTheDocument();
  });

  it("shows notice again when dismissal flag is removed", () => {
    localStorage.setItem("local_save_notice_dismissed", "true");
    localStorage.removeItem("local_save_notice_dismissed");

    render(<App />);

    expect(screen.getByText(LOCAL_SAVE_NOTICE_COPY)).toBeInTheDocument();
  });

  it("tabs from settings trigger to dismiss button with visible focus intent", async () => {
    const user = userEvent.setup();
    render(<App />);

    const settingsButton = screen.getByRole("button", { name: /settings/i });
    const dismissButton = screen.getByRole("button", {
      name: "Dismiss local save notice",
    });

    settingsButton.focus();
    expect(settingsButton).toHaveFocus();

    await user.tab();
    expect(dismissButton).toHaveFocus();
    expect(dismissButton).toHaveClass(
      "focus-visible:ring-2",
      "focus-visible:ring-[var(--dt-accent)]",
    );
  });

  it("keeps predictable tab flow after opening and closing settings menu", async () => {
    const user = userEvent.setup();
    render(<App />);

    const settingsButton = screen.getByRole("button", { name: /settings/i });
    const dismissButton = screen.getByRole("button", {
      name: "Dismiss local save notice",
    });

    await user.click(settingsButton);
    expect(settingsButton).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(settingsButton).toHaveFocus();
    expect(settingsButton).toHaveAttribute("aria-expanded", "false");

    // AnimatePresence keeps the dropdown mounted during its exit animation.
    // Wait for it to be fully removed before testing tab order.
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    await user.tab();
    expect(dismissButton).toHaveFocus();
  });
});

const STORAGE_FAILURE_COPY = "Changes work for this visit, but cannot be saved on this device.";

describe("App persistence recovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["null settings and entries", "null", "[null]"],
    ["corrupt JSON", "{broken", "{broken"],
    ["wrong shapes", "[]", "{}"],
    ["invalid enums and timezone", '{"theme":{},"designTheme":"unknown"}', '[{"id":"bad","timezone":"Not/A_Zone"}]'],
  ])("starts with %s and persists usable recovered state", (_name, settings, rows) => {
    localStorage.setItem("app_settings", settings);
    localStorage.setItem("timezone_config", rows);
    localStorage.setItem("local_save_notice_dismissed", '"true"');
    render(<App />);
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText(LOCAL_SAVE_NOTICE_COPY)).toBeInTheDocument();
    const recoveredSettings = JSON.parse(localStorage.getItem("app_settings")!);
    const recoveredRows = JSON.parse(localStorage.getItem("timezone_config")!);
    expect(recoveredSettings.designTheme).toBe("te-1");
    expect(recoveredRows).toHaveLength(1);
    expect(recoveredRows[0].isHome).toBe(true);
    expect(() => new Intl.DateTimeFormat("en", { timeZone: recoveredRows[0].timezone })).not.toThrow();
  });

  it("preserves valid custom rows, order and IDs while migrating legacy partial settings", async () => {
    const user = userEvent.setup();
    const rows = [
      { id: "custom-1", timezone: "US/Pacific", label: "West team α", country: "Custom region", isHome: false },
      { id: "custom-2", timezone: "UTC", label: "UTC desk", isHome: true },
    ];
    localStorage.setItem("app_settings", '{"theme":"dark","showBadge":false}');
    localStorage.setItem("timezone_config", JSON.stringify([null, ...rows]));
    render(<App />);
    expect(screen.getByText("West team α")).toBeInTheDocument();
    expect(screen.getByText("UTC desk")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("timezone_config")!)).toEqual(rows);
    expect(JSON.parse(localStorage.getItem("app_settings")!)).toMatchObject({ theme: "dark", showBadge: false });
    await user.click(screen.getByRole("button", { name: /settings/i }));
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: "Timezone badge" })).toHaveAttribute("aria-checked", "false");
  });

  it("keeps the app editable when the storage property getter is blocked", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    render(<App />);
    expect(screen.getByRole("status", { name: "Local save status" })).toHaveTextContent(STORAGE_FAILURE_COPY);
    expect(screen.queryByText(LOCAL_SAVE_NOTICE_COPY)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("menuitemradio", { name: "24H" }));
    expect(screen.getByRole("menuitemradio", { name: "24H" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("status", { name: "Local save status" })).toHaveTextContent(STORAGE_FAILURE_COPY);
  });

  it.each(["app_settings", "timezone_config", "local_save_notice_dismissed"])("reports an independent read failure for %s", (blockedKey) => {
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === blockedKey) throw new Error("Blocked read");
      return read.call(this, key);
    });
    render(<App />);
    expect(screen.getByRole("status", { name: "Local save status" })).toHaveTextContent(STORAGE_FAILURE_COPY);
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });

  it("never overwrites an unread dashboard when all keys fail to read", async () => {
    const user = userEvent.setup();
    const saved = {
      app_settings: '{"theme":"dark","showBadge":false}',
      timezone_config: '[{"id":"saved-home","timezone":"Asia/Tokyo","label":"Saved team","isHome":true}]',
      local_save_notice_dismissed: "true",
    };
    for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, value);
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("All reads denied"); });
    const write = vi.spyOn(Storage.prototype, "setItem");
    render(<App />);
    expect(screen.getByRole("status", { name: "Local save status" })).toHaveTextContent(STORAGE_FAILURE_COPY);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("menuitemradio", { name: "24H" }));
    expect(screen.getByRole("menuitemradio", { name: "24H" })).toHaveAttribute("aria-checked", "true");
    expect(write).not.toHaveBeenCalled();
    for (const [key, value] of Object.entries(saved)) expect(read.call(localStorage, key)).toBe(value);
  });

  it("shows a later save failure despite an earlier successful notice dismissal", async () => {
    const user = userEvent.setup();
    render(<App />);
    const status = screen.getByRole("status", { name: "Local save status" });
    await user.click(screen.getByRole("button", { name: "Dismiss local save notice" }));
    expect(status).toBeEmptyDOMElement();
    expect(localStorage.getItem("local_save_notice_dismissed")).toBe("true");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("menuitemradio", { name: "24H" }));
    expect(screen.getByRole("menuitemradio", { name: "24H" })).toHaveAttribute("aria-checked", "true");
    expect(status).toHaveTextContent(STORAGE_FAILURE_COPY);
    expect(screen.queryByRole("button", { name: "Dismiss local save notice" })).not.toBeInTheDocument();
    expect(screen.queryByText(LOCAL_SAVE_NOTICE_COPY)).not.toBeInTheDocument();
  });

  it("does not hide a failure when writing the dismissal flag is rejected", async () => {
    const user = userEvent.setup();
    render(<App />);
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === "local_save_notice_dismissed") throw new Error("Write denied");
      write.call(this, key, value);
    });
    await user.click(screen.getByRole("button", { name: "Dismiss local save notice" }));
    expect(screen.getByRole("status", { name: "Local save status" })).toHaveTextContent(STORAGE_FAILURE_COPY);
  });

  it("uses validated settings for synchronous theme initialization without writing storage", async () => {
    localStorage.setItem("app_settings", '{"designTheme":"invalid-theme","theme":null}');
    const write = vi.spyOn(Storage.prototype, "setItem");
    vi.resetModules();
    await import("./App");
    expect(document.documentElement).toHaveAttribute("data-design-theme", "te-1");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(write).not.toHaveBeenCalled();
  });
});


describe("App fixed calendar selection lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-02T23:59:50Z"));
    localStorage.clear();
    localStorage.setItem("timezone_config", JSON.stringify([
      { id: "utc", timezone: "UTC", label: "UTC desk", isHome: true },
      { id: "west", timezone: "Pacific/Honolulu", label: "West", isHome: false },
      { id: "east", timezone: "Pacific/Kiritimati", label: "East", isHome: false },
    ]));
  });
  afterEach(() => vi.useRealTimers());

  const expectView = (mode: "live" | "date", instant: string) => {
    const rails = document.querySelectorAll("[data-date-mode]");
    expect(rails).toHaveLength(3);
    for (const rail of rails) {
      expect(rail).toHaveAttribute("data-date-mode", mode);
      expect(rail).toHaveAttribute("data-preview-instant", instant);
    }
  };
  const advanceTo = (instant: string) => act(() => {
    vi.setSystemTime(new Date(instant));
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(new Event("focus"));
  });

  const expectClocks = (instant: string) => {
    for (const clock of screen.getAllByTestId("row-clock")) expect(clock).toHaveAttribute("datetime", instant);
  };

  it("preserves the selected instant across midnight and home changes across the date line", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    fireEvent.click(screen.getByRole("button", { name: "Wednesday, April 15, 2026" }));
    expectView("date", "2026-04-15T00:00:00.000Z");
    expectClocks("2026-04-15T23:59:50.000Z");
    expect(screen.getAllByTestId("row-clock")[0].parentElement).toHaveTextContent("Wed, Apr 15");
    advanceTo("2026-03-03T00:00:00Z");
    expectClocks("2026-04-15T23:59:50.000Z");
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    fireEvent.change(within(screen.getByRole("menu")).getByRole("combobox"), { target: { value: "west" } });
    expectClocks("2026-04-15T23:59:50.000Z");
    fireEvent.change(within(screen.getByRole("menu")).getByRole("combobox"), { target: { value: "east" } });
    expectClocks("2026-04-15T23:59:50.000Z");
    expect(screen.getByRole("button", { name: "Back to today" })).toHaveTextContent("16Apr");
    expect(localStorage.getItem("selected_date")).toBeNull();
  });

  it("holds a selected time even after its date passes, until Today is explicitly chosen", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "3 Mar" }));
    expectClocks("2026-03-03T23:59:50.000Z");
    advanceTo("2026-03-04T12:00:00Z");
    expectClocks("2026-03-03T23:59:50.000Z");
    fireEvent.click(screen.getByRole("button", { current: "date" }));
    expectClocks("2026-03-04T12:00:01.000Z");
    expectView("live", "2026-03-04T12:00:01.000Z");
  });

  it("uses the home city's clock time for the initial future date", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    fireEvent.change(within(screen.getByRole("menu")).getByRole("combobox"), { target: { value: "east" } });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "4 Mar" }));
    expectClocks("2026-03-03T23:59:50.000Z");
    expectView("date", "2026-03-03T10:00:00.000Z");
    expect(screen.getAllByTestId("row-clock")[0].parentElement).toHaveTextContent("Wed, Mar 4");
  });

  it("returns live through explicit Today and starts live after reload", () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "3 Mar" }));
    fireEvent.click(screen.getByRole("button", { current: "date" }));
    expectView("live", "2026-03-02T23:59:50.000Z");
    fireEvent.click(screen.getByRole("button", { name: "3 Mar" }));
    expectClocks("2026-03-03T23:59:50.000Z");
    unmount();
    render(<App />);
    expectView("live", "2026-03-02T23:59:50.000Z");
  });

  it("preserves an instant when a new home timezone skipped its original calendar date", () => {
    vi.setSystemTime(new Date("2011-12-29T12:00:00Z"));
    localStorage.setItem("timezone_config", JSON.stringify([
      { id: "utc", timezone: "UTC", isHome: true },
      { id: "apia", timezone: "Pacific/Apia", isHome: false },
    ]));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "30 Dec" }));
    expectClocks("2011-12-30T12:00:00.000Z");
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    fireEvent.change(within(screen.getByRole("menu")).getByRole("combobox"), { target: { value: "apia" } });
    expectClocks("2011-12-30T12:00:00.000Z");
    expect(screen.getAllByTestId("row-clock")[0].parentElement).toHaveTextContent("Sat, Dec 31");
    expect(screen.getByRole("button", { name: "31 Dec", pressed: true })).toBeInTheDocument();
    expect(screen.queryByText("This date does not exist in the home timezone. Choose another date.")).not.toBeInTheDocument();
  });
});

describe("App minimal analytics transport integration", () => {
  const options = offlineAnalyticsOptions();
  let request: ReturnType<typeof createFetchMock>;
  const privateLabel = "PrivateDashboardAccount Orchid8472";
  const privateRename = "PrivateCustomerPayroll Tanager3819";
  let originalURL: string;
  let originalTitle: string;
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("timezone_config", JSON.stringify([
      { id: "private-row-id", timezone: "UTC", label: privateLabel, isHome: true },
      { id: "other-private-id", timezone: "Europe/London", label: "SecretOtherOffice Wren6681", isHome: false },
    ]));
    originalURL = window.location.href;
    originalTitle = document.title;
    window.history.replaceState({}, "", "/PrivateDashboardPath?account=PrivateAccountQuery#PrivateHash");
    document.title = "PrivateDashboardTitle";
    request = createFetchMock();
    vi.stubGlobal("fetch", request);
  });
  afterEach(() => {
    window.history.replaceState({}, "", originalURL);
    document.title = originalTitle;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends actual rename/home-change events without any editable or browser data", () => {
    render(<AnalyticsProvider options={options}><App /></AnalyticsProvider>);
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(privateLabel));
    fireEvent.change(screen.getByRole("textbox", { name: /Edit .* label/ }), { target: { value: privateRename } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: /Edit .* label/ }), { key: "Enter" });
    expect(screen.getByText(privateRename)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    fireEvent.change(within(screen.getByRole("menu")).getByRole("combobox"), { target: { value: "other-private-id" } });
    const flags = { $process_person_profile: false, $geoip_disable: true };
    expect(request.mock.calls.map(([url, init]) => {
      expect(url).toBe("https://analytics.example.invalid/i/v0/e/");
      expect(init).toEqual({ method: "POST", headers: { "Content-Type": "application/json" }, body: expect.any(String), credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: expect.any(AbortSignal) });
      const body = JSON.parse(String(init!.body));
      expect(body).toEqual({ api_key: options.token, event: expect.any(String), distinct_id: expect.stringMatching(/^[\da-f-]{36}$/), timestamp: expect.any(String),
        properties: body.event === "home_timezone_changed" ? { ...flags, reference_timezone: "Europe/London" } : flags });
      return body.event;
    })).toEqual(["timezone_renamed", "home_timezone_changed"]);
    const envelopes = JSON.stringify(request.mock.calls);
    for (const text of [privateLabel, privateRename, "SecretOtherOffice", "private-row-id", "other-private-id", "PrivateDashboardPath", "PrivateAccountQuery", "PrivateHash", "PrivateDashboardTitle", "home_city", "$current_url", "$referrer"]) expect(envelopes).not.toContain(text);
  });

  const eventBodies = () => request.mock.calls.map(([, init]) => JSON.parse(String(init!.body)));

  it("records only actual settings changes, without startup, no-op or reload snapshots", () => {
    const { unmount } = render(<AnalyticsProvider options={options}><App /></AnalyticsProvider>);
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "12H" }));
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "24H" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Gamut" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Timezone badge" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Indicate weekends" }));
    expect(eventBodies().map(({ event, properties }) => ({ event, ...properties }))).toEqual([
      { setting: "time_format", value: "24h" }, { setting: "appearance", value: "dark" },
      { setting: "design_theme", value: "gamut" }, { setting: "timezone_badge", value: false },
      { setting: "weekend_indicator", value: true },
    ].map((properties) => ({ event: "settings_changed", ...properties, $process_person_profile: false, $geoip_disable: true })));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "24H" }));
    expect(request).toHaveBeenCalledTimes(5);
    unmount();
    render(<AnalyticsProvider options={options}><App /></AnalyticsProvider>);
    expect(request).toHaveBeenCalledTimes(5);
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(screen.getByRole("menuitemradio", { name: "24H" })).toHaveAttribute("aria-checked", "true");
  });

  it("preserves a picker alias through rename/reload and reports it when explicitly made home", () => {
    const { unmount } = render(<AnalyticsProvider options={options}><App /></AnalyticsProvider>);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Seattle" } });
    fireEvent.click(screen.getByRole("option", { name: /Seattle/ }));
    const added = JSON.parse(localStorage.getItem("timezone_config")!).find((row: { city?: string }) => row.city === "Seattle");
    expect(added).toMatchObject({ timezone: "America/Los_Angeles", city: "Seattle" });
    fireEvent.click(screen.getByText("Seattle", { selector: "span.truncate" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Edit .* label/ }), { target: { value: privateRename } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: /Edit .* label/ }), { key: "Enter" });
    unmount();
    render(<AnalyticsProvider options={options}><App /></AnalyticsProvider>);
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    const homeSelect = within(screen.getByRole("menu")).getByRole("combobox");
    fireEvent.change(homeSelect, { target: { value: added.id } });
    expect(eventBodies().filter(({ event }) => event === "home_timezone_changed").map(({ properties }) => properties)).toEqual([{
      reference_timezone: "America/Los_Angeles", reference_result_id: "America/Los_Angeles|Seattle",
      reference_city: "Seattle", reference_country: "USA", $process_person_profile: false, $geoip_disable: true,
    }]);
    fireEvent.change(homeSelect, { target: { value: added.id } });
    expect(eventBodies().filter(({ event }) => event === "home_timezone_changed")).toHaveLength(1);
    expect(JSON.stringify(request.mock.calls)).not.toContain(privateRename);
    expect(JSON.stringify(request.mock.calls)).not.toContain(added.id);
  });

  it("keeps settings and home editable while opted out and does not replay them on opt-in", () => {
    localStorage.setItem(ANALYTICS_PREFERENCE_KEY, '{"version":1,"enabled":false}');
    render(<AnalyticsProvider options={options}><App /></AnalyticsProvider>);
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "24H" }));
    fireEvent.change(within(screen.getByRole("menu")).getByRole("combobox"), { target: { value: "other-private-id" } });
    expect(JSON.parse(localStorage.getItem("app_settings")!).use24Hour).toBe(true);
    expect(JSON.parse(localStorage.getItem("timezone_config")!)[0].id).toBe("other-private-id");
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Allow usage analytics" }));
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "12H" }));
    expect(eventBodies()).toHaveLength(1);
    expect(eventBodies()[0]).toMatchObject({ event: "settings_changed", properties: { setting: "time_format", value: "12h" } });
  });

  it("honors opt-out before the first real App action and after reload", () => {
    localStorage.setItem(ANALYTICS_PREFERENCE_KEY, '{"version":1,"enabled":false}');
    const { unmount } = render(<AnalyticsProvider options={options}><App /></AnalyticsProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
    expect(request).not.toHaveBeenCalled();
    unmount();
    render(<AnalyticsProvider options={options}><App /></AnalyticsProvider>);
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(screen.getByRole("menuitemcheckbox", { name: "Allow usage analytics" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("status", { name: "Usage analytics status" })).toHaveTextContent(/^Off$/);
    expect(request).not.toHaveBeenCalled();
  });

  it("renders working App and an unavailable analytics control with no configuration", () => {
    render(<AnalyticsProvider options={{ production: true, hostname: "daybound.example.invalid" }}><App /></AnalyticsProvider>);
    expect(screen.getByText(privateLabel)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(screen.getByRole("menuitemcheckbox", { name: "Allow usage analytics" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Usage analytics status" })).toHaveTextContent("Usage analytics is unavailable here.");
    expect(screen.getByRole("status", { name: "Local save status" })).toHaveTextContent(LOCAL_SAVE_NOTICE_COPY);
    expect(request).not.toHaveBeenCalled();
  });

  it("distinguishes analytics write failure from successful app preference storage", () => {
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === ANALYTICS_PREFERENCE_KEY) throw new DOMException("Full", "QuotaExceededError");
      write.call(this, key, value);
    });
    const controller = createAnalytics(options);
    render(<AnalyticsProvider controller={controller}><App /></AnalyticsProvider>);
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(screen.getByRole("status", { name: "Usage analytics status" })).toHaveTextContent("Off for this visit; preference could not be saved.");
    expect(screen.getByRole("status", { name: "Local save status" })).toHaveTextContent(LOCAL_SAVE_NOTICE_COPY);
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Allow usage analytics" }));
    expect(controller.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "unavailable" });
    expect(request).not.toHaveBeenCalled();
  });
});


it("reuses fixed-date and calendar-day resolutions through hover, closed/open minute updates", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-02T12:00:00Z"));
  localStorage.clear();
  localStorage.setItem("timezone_config", '[{"id":"utc","timezone":"UTC","isHome":true}]');
  const starts = vi.spyOn(calendarFields, "startOfCalendarDate");
  const { container, unmount } = render(<App />);
  expect(starts.mock.calls.length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "3 Mar" }));
  starts.mockClear();
  fireEvent.mouseEnter(container.querySelector('[data-timeline-cell="5"]')!);
  expect(starts).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(60000));
  expect(starts).not.toHaveBeenCalled();
  expect(container.querySelector("[data-preview-instant]")).toHaveAttribute("data-preview-instant", "2026-03-03T00:00:00.000Z");
  fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
  fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  expect(screen.getByText("April 2026")).toBeInTheDocument();
  starts.mockClear();
  act(() => vi.advanceTimersByTime(60000));
  expect(starts).not.toHaveBeenCalled();
  expect(screen.getByText("April 2026")).toBeInTheDocument();
  unmount();
  starts.mockRestore();
  vi.useRealTimers();
});


describe("synchronized timeline exploration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T19:43:00Z"));
    localStorage.clear();
    localStorage.setItem("app_settings", JSON.stringify({ use24Hour: true }));
    localStorage.setItem("timezone_config", JSON.stringify([
      { id: "utc", timezone: "UTC", isHome: true },
      { id: "tokyo", timezone: "Asia/Tokyo", isHome: false },
    ]));
  });
  afterEach(() => { vi.useRealTimers(); });
  const views = () => screen.getAllByRole("region", { name: /timeline\. Drag/ });
  const instants = () => views().map(view => view.getAttribute("data-preview-instant"));
  const clocksAt = (instant: string) => {
    for (const clock of screen.getAllByTestId("row-clock")) expect(clock).toHaveAttribute("datetime", instant);
  };
  const frames = () => views().map(view => {
    const rail = within(view).getByTestId("timeline-rail");
    return [view.getAttribute("data-preview-instant"), rail.getAttribute("data-start"), rail.style.transform];
  });
  it("reveals Toronto's off-screen rollback in every row without changing the selected clocks", () => {
    const outer = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(2500);
    const inner = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(2500);
    try {
      vi.setSystemTime(new Date("2026-10-31T19:00:00Z"));
      localStorage.setItem("timezone_config", JSON.stringify([
        { id: "vancouver", timezone: "America/Vancouver", isHome: true },
        { id: "toronto", timezone: "America/Toronto", isHome: false },
        { id: "new-york", timezone: "America/New_York", isHome: false },
      ]));
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "1 Nov" }));
      clocksAt("2026-11-01T19:00:00.000Z");
      const hint = screen.getByRole("button", { name: /Toronto\. Clocks go back 1h.*Before the visible timeline/ });
      fireEvent.click(hint);
      expect(instants()).toEqual(Array(3).fill("2026-11-01T06:00:00.000Z"));
      clocksAt("2026-11-01T19:00:00.000Z");
      expect(screen.getAllByRole("img", { name: /Clocks go back 1h/ })).toHaveLength(2);
      expect(screen.queryByRole("button", { name: /Show clock change/ })).not.toBeInTheDocument();
      expect(views()[1]).toHaveFocus();
      expect(screen.getByRole("button", { name: "31 Oct", pressed: true })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(60000));
      clocksAt("2026-11-01T19:00:00.000Z");
    } finally {
      outer.mockRestore(); inner.mockRestore();
    }
  });
  it.each([
    [false, false, "2026-10-22T20:00:00.000Z", "22 Oct"],
    [false, true, "2026-10-23T02:00:00.000Z", "23 Oct"],
    [true, false, "2026-10-23T03:00:00.000Z", "23 Oct"],
    [true, true, "2026-10-23T09:00:00.000Z", "23 Oct"],
  ] as const)("clears a selected column without resetting the view: future=%s, scrubbed=%s", (future, scrubbed, selected, date) => {
    render(<App />);
    if (future) fireEvent.click(screen.getByRole("button", { name: "23 Oct" }));
    if (scrubbed) fireEvent.keyDown(views()[0], { key: "ArrowRight", shiftKey: true });
    fireEvent.click(views()[0].querySelector(`[data-instant="${selected}"]`)!);
    const selectedFrames = frames();
    act(() => vi.advanceTimersByTime(60000));
    fireEvent.click(within(views()[1]).getByRole("button", { pressed: true }));
    clocksAt("2026-10-22T19:44:00.000Z");
    for (const rail of views()) expect(within(rail).queryByRole("button", { pressed: true })).not.toBeInTheDocument();
    expect(frames()).toEqual(selectedFrames);
    expect(screen.getByRole("button", { name: date, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Selected time" })).toHaveTextContent("Showing live time.");
    act(() => vi.advanceTimersByTime(60000));
    expect(frames()).toEqual(selectedFrames);
    clocksAt("2026-10-22T19:45:00.000Z");
    fireEvent.click(screen.getByRole("button", { name: "22 Oct" }));
    expect(instants()).toEqual(Array(2).fill("2026-10-22T19:45:00.000Z"));
  });
  it("preserves scrubbing done after selecting a column when that column is cleared", () => {
    render(<App />);
    fireEvent.click(within(views()[0]).getByRole("button", { name: /^2026-10-22 20:00 / }));
    fireEvent.keyDown(views()[0], { key: "ArrowRight", shiftKey: true });
    const scrubbedFrames = frames();
    fireEvent.click(within(views()[1]).getByRole("button", { pressed: true }));
    expect(frames()).toEqual(scrubbedFrames);
    expect(screen.getByRole("button", { name: "23 Oct", pressed: true })).toBeInTheDocument();
    for (const rail of views()) expect(within(rail).queryByRole("button", { pressed: true })).not.toBeInTheDocument();
  });
  it("clears the highlighted column even when date selection chose a time partway through that hour", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "23 Oct" }));
    clocksAt("2026-10-23T19:43:00.000Z");
    const selectedFrames = frames();
    fireEvent.click(within(views()[0]).getByRole("button", { pressed: true }));
    clocksAt("2026-10-22T19:43:00.000Z");
    expect(frames()).toEqual(selectedFrames);
    expect(screen.getByRole("button", { name: "23 Oct", pressed: true })).toBeInTheDocument();
  });
  it("lets Enter clear the same slot selected by Enter", () => {
    render(<App />);
    views()[0].focus();
    fireEvent.keyDown(views()[0], { key: "ArrowRight" });
    fireEvent.keyDown(views()[0], { key: "Enter" });
    clocksAt("2026-10-22T20:00:00.000Z");
    const selectedFrames = frames();
    expect(views()[0]).toHaveAttribute("aria-description", "Enter clears the selected time and keeps this timeline view.");
    fireEvent.keyDown(views()[0], { key: "Enter" });
    clocksAt("2026-10-22T19:43:00.000Z");
    expect(frames()).toEqual(selectedFrames);
    expect(views()[0]).toHaveFocus();
  });
  it("shows future city dates, selects a shared column, and keeps the chosen time on another date", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "23 Oct" }));
    clocksAt("2026-10-23T19:43:00.000Z");
    const clocks = screen.getAllByTestId("row-clock");
    expect(clocks[0].parentElement).toHaveTextContent("Fri, Oct 23");
    expect(clocks[1].parentElement).toHaveTextContent("Sat, Oct 24");
    const originalView = instants();
    fireEvent.click(within(views()[1]).getByRole("button", { name: /2026-10-23 12:00/ }));
    clocksAt("2026-10-23T03:00:00.000Z");
    expect(instants()).toEqual(originalView);
    expect(views()[1]).toHaveFocus();
    for (const rail of views()) expect(within(rail).getByRole("button", { pressed: true })).toHaveAttribute("data-instant", "2026-10-23T03:00:00.000Z");
    act(() => vi.advanceTimersByTime(60000));
    fireEvent.keyDown(views()[0], { key: "ArrowRight", shiftKey: true });
    clocksAt("2026-10-23T03:00:00.000Z");
    fireEvent.click(screen.getByRole("button", { name: "24 Oct" }));
    clocksAt("2026-10-24T03:00:00.000Z");
    fireEvent.click(screen.getByRole("button", { name: "22 Oct" }));
    clocksAt("2026-10-22T19:44:00.000Z");
  });
  it("selects fractional-offset slots in Today mode and updates the calendar on a home change", () => {
    localStorage.setItem("timezone_config", JSON.stringify([
      { id: "utc", timezone: "UTC", isHome: true },
      { id: "kathmandu", timezone: "Asia/Kathmandu", isHome: false },
    ]));
    render(<App />);
    fireEvent.click(within(views()[1]).getByRole("button", { name: /2026-10-23 0:45/ }));
    clocksAt("2026-10-22T19:00:00.000Z");
    expect(screen.getAllByTestId("row-clock")[1]).toHaveAttribute("aria-label", "00:45");
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    fireEvent.change(within(screen.getByRole("menu")).getByRole("combobox"), { target: { value: "kathmandu" } });
    clocksAt("2026-10-22T19:00:00.000Z");
    expect(screen.getByRole("button", { name: "23 Oct", pressed: true })).toBeInTheDocument();
  });
  it("lets the keyboard browse, select a printed time, and restore live time", () => {
    render(<App />);
    views()[0].focus();
    fireEvent.keyDown(views()[0], { key: "ArrowRight" });
    fireEvent.keyDown(views()[0], { key: "Enter" });
    clocksAt("2026-10-22T20:00:00.000Z");
    act(() => vi.advanceTimersByTime(60000));
    clocksAt("2026-10-22T20:00:00.000Z");
    fireEvent.keyDown(views()[0], { key: "Home" });
    clocksAt("2026-10-22T19:44:00.000Z");
    expect(screen.getByRole("button", { current: "date" })).toHaveFocus();
  });
  it("reaches 24 hours ahead on all rows, freezes the view across minutes, and leaves clocks live", () => {
    render(<App />);
    for (let i = 0; i < 4; i++) fireEvent.keyDown(views()[0], { key: "ArrowRight", shiftKey: true });
    expect(instants()).toEqual(["2026-10-23T19:43:00.000Z", "2026-10-23T19:43:00.000Z"]);
    fireEvent.keyDown(views()[1], { key: "ArrowRight" });
    expect(instants()).toEqual(["2026-10-23T19:43:00.000Z", "2026-10-23T19:43:00.000Z"]);
    act(() => vi.advanceTimersByTime(60000));
    expect(instants()[0]).toBe("2026-10-23T19:43:00.000Z");
    for (const clock of screen.getAllByTestId("row-clock")) expect(clock).toHaveAttribute("datetime", "2026-10-22T19:44:00.000Z");
    expect(screen.getByRole("button", { name: "23 Oct", pressed: true })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Return to now" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Exploring ·|Swipe timelines/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "22 Oct" }));
    expect(instants()[0]).toBe("2026-10-22T19:44:00.000Z");
    expect(screen.getByRole("button", { name: "22 Oct", pressed: true })).toBeInTheDocument();
  });
  it("resets browsing on date selection and preserves the selected instant on home changes", () => {
    render(<App />);
    fireEvent.keyDown(views()[0], { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "23 Oct" }));
    expect(instants()).toEqual(["2026-10-23T00:00:00.000Z", "2026-10-23T00:00:00.000Z"]);
    expect(screen.getByRole("button", { name: "23 Oct", pressed: true })).toBeInTheDocument();
    fireEvent.keyDown(views()[0], { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    fireEvent.change(within(screen.getByRole("menu")).getByRole("combobox"), { target: { value: "tokyo" } });
    expect(instants()[0]).toBe("2026-10-23T01:00:00.000Z");
    expect(screen.getByRole("button", { name: "24 Oct", pressed: true })).toBeInTheDocument();
  });
  it("updates the calendar as the rail crosses a date, and can reselect the surfaced date", () => {
    render(<App />);
    fireEvent.keyDown(views()[0], { key: "ArrowRight", shiftKey: true });
    expect(instants()[0]).toBe("2026-10-23T01:43:00.000Z");
    expect(screen.getByRole("button", { name: "23 Oct", pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
    expect(within(screen.getByRole("dialog", { name: "Choose date" })).getByRole("button", { name: "Friday, October 23, 2026", pressed: true })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "23 Oct" }));
    expect(instants()[0]).toBe("2026-10-23T00:00:00.000Z");
    for (let i = 0; i < 4; i++) fireEvent.keyDown(views()[0], { key: "ArrowRight", shiftKey: true });
    expect(screen.getByRole("button", { name: "24 Oct", pressed: true })).toBeInTheDocument();
    expect(instants()[0]).toBe("2026-10-24T00:00:00.000Z");
  });
  it("scrubs backward from a selected tomorrow into today and forward again without resetting the anchor", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "23 Oct" }));
    fireEvent.keyDown(views()[0], { key: "ArrowLeft" });
    expect(instants()).toEqual(["2026-10-22T23:00:00.000Z", "2026-10-22T23:00:00.000Z"]);
    expect(screen.getByRole("button", { name: "22 Oct", pressed: true })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60000));
    expect(instants()[0]).toBe("2026-10-22T23:00:00.000Z");
    for (const clock of screen.getAllByTestId("row-clock")) expect(clock).toHaveAttribute("datetime", "2026-10-23T19:43:00.000Z");
    fireEvent.keyDown(views()[1], { key: "ArrowRight" });
    expect(instants()).toEqual(["2026-10-23T00:00:00.000Z", "2026-10-23T00:00:00.000Z"]);
    expect(screen.getByRole("button", { name: "23 Oct", pressed: true })).toBeInTheDocument();
    fireEvent.keyDown(views()[0], { key: "ArrowLeft" });
    fireEvent.click(screen.getByRole("button", { name: "22 Oct" }));
    expect(instants()[0]).toBe("2026-10-22T19:44:00.000Z");
    expect(views()[0]).toHaveAttribute("data-date-mode", "live");
  });
  it.each([false, true])("allows 24 hours backward and shows matching fade bounds in selected-date mode=%s", (selected) => {
    render(<App />);
    if (selected) fireEvent.click(screen.getByRole("button", { name: "23 Oct" }));
    const base = Date.parse(instants()[0]!);
    const leftFade = () => views()[0].querySelector<HTMLElement>(".scroll-fade-x")!.style.getPropertyValue("--scroll-fade-left");
    expect(leftFade()).toBe("16px");
    for (let i = 0; i < 5; i++) fireEvent.keyDown(views()[0], { key: "ArrowLeft", shiftKey: true });
    expect(instants()).toEqual(Array(2).fill(new Date(base - 24 * 3_600_000).toISOString()));
    expect(leftFade()).toBe("0px");
    fireEvent.keyDown(views()[0], { key: "ArrowRight" });
    expect(instants()[0]).toBe(new Date(base - 23 * 3_600_000).toISOString());
    expect(leftFade()).toBe("16px");
  });
  it("recenters on tapping today even when the explored time is still today", () => {
    render(<App />);
    fireEvent.keyDown(views()[0], { key: "ArrowRight" });
    expect(instants()[0]).toBe("2026-10-22T20:43:00.000Z");
    fireEvent.click(screen.getByRole("button", { name: "22 Oct", pressed: true }));
    expect(instants()[0]).toBe("2026-10-22T19:43:00.000Z");
  });
  it("shows a previous surfaced date without treating it as a new calendar selection", () => {
    vi.setSystemTime(new Date("2026-10-22T02:00:00Z"));
    render(<App />);
    fireEvent.keyDown(views()[0], { key: "ArrowLeft", shiftKey: true });
    expect(instants()[0]).toBe("2026-10-21T20:00:00.000Z");
    expect(screen.getByRole("button", { name: "Back to today" })).toHaveTextContent("21Oct");
    act(() => vi.advanceTimersByTime(60000));
    expect(instants()[0]).toBe("2026-10-21T20:00:00.000Z");
    fireEvent.click(screen.getByRole("button", { name: "22 Oct" }));
    expect(instants()[0]).toBe("2026-10-22T02:01:00.000Z");
  });
  it("accepts horizontal wheels and preserves vertical page scrolling", () => {
    render(<App />);
    fireEvent.wheel(views()[0], { deltaY: 100 });
    act(() => vi.advanceTimersByTime(20));
    expect(instants()[0]).toBe("2026-10-22T19:43:00.000Z");
    const horizontal = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: 100 });
    fireEvent(views()[0], horizontal);
    expect(horizontal.defaultPrevented).toBe(true);
    act(() => vi.advanceTimersToNextFrame());
    expect(instants()[0]).not.toBe("2026-10-22T19:43:00.000Z");
    expect(instants()[0]).toBe(instants()[1]);
  });
});
