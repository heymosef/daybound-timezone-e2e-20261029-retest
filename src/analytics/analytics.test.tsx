import { offlineAnalyticsOptions, createFetchMock } from "../test/analytics";
import React, { StrictMode, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AnalyticsProvider, useAnalytics } from "./AnalyticsProvider";
import { ANALYTICS_PREFERENCE_KEY, createAnalytics } from "./analytics";
import { DatePicker } from "../app/components/DatePicker";

const OPTIONS = offlineAnalyticsOptions();
let request: ReturnType<typeof createFetchMock>;
beforeEach(() => {
  localStorage.clear();
  request = createFetchMock();
  vi.stubGlobal("fetch", request);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function Probe() {
  const analytics = useAnalytics();
  return <>
    <output>{analytics.enabled ? "Enabled" : "Disabled"}</output>
    <button onClick={() => analytics.capture("calendar_opened")}>Capture</button>
    <button onClick={() => analytics.setEnabled(false)}>Deny</button>
    <button onClick={() => analytics.setEnabled(true)}>Allow</button>
  </>;
}

it("has a stable disabled no-op fallback without touching storage", () => {
  const read = vi.spyOn(Storage.prototype, "getItem");
  const write = vi.spyOn(Storage.prototype, "setItem");
  render(<Probe />);
  fireEvent.click(screen.getByRole("button", { name: "Capture" }));
  fireEvent.click(screen.getByRole("button", { name: "Allow" }));
  expect(screen.getByText("Disabled")).toBeInTheDocument();
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

it("retains the same controller and visit denial through ordinary provider rerenders", () => {
  function Harness() {
    const [count, setCount] = useState(0);
    return <AnalyticsProvider options={{ ...OPTIONS }}><Probe /><button onClick={() => setCount(count + 1)}>Rerender {count}</button></AnalyticsProvider>;
  }
  render(<Harness />);
  expect(screen.getByText("Enabled")).toBeInTheDocument();
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Write blocked"); });
  fireEvent.click(screen.getByRole("button", { name: "Deny" }));
  expect(localStorage.getItem(ANALYTICS_PREFERENCE_KEY)).toBe('{"version":1,"enabled":true}');
  write.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Rerender 0" }));
  fireEvent.click(screen.getByRole("button", { name: "Capture" }));
  expect(screen.getByText("Disabled")).toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Allow" }));
  fireEvent.click(screen.getByRole("button", { name: "Capture" }));
  expect(request).toHaveBeenCalledTimes(1);
});

it("reuses the committed controller under StrictMode, aborts on unmount, and never autocaptures", () => {
  request.mockImplementation(() => new Promise<Response>(() => {}));
  const controller = createAnalytics(OPTIONS);
  const { unmount } = render(<StrictMode><AnalyticsProvider controller={controller}><Probe /></AnalyticsProvider></StrictMode>);
  expect(screen.getByText("Enabled")).toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Capture" }));
  expect(request).toHaveBeenCalledTimes(1);
  const signal = request.mock.calls[0][1]!.signal!;
  expect(signal.aborted).toBe(false);
  unmount();
  expect(signal.aborted).toBe(true);
  expect(controller.getSnapshot().enabled).toBe(false);
});

it("keeps a failed opt-out latched through StrictMode controller reuse until explicit persisted opt-in", () => {
  const controller = createAnalytics(OPTIONS);
  const { unmount } = render(<StrictMode><AnalyticsProvider controller={controller}><Probe /></AnalyticsProvider></StrictMode>);
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Write blocked"); });
  fireEvent.click(screen.getByRole("button", { name: "Deny" }));
  unmount();
  write.mockRestore();
  render(<StrictMode><AnalyticsProvider controller={controller}><Probe /></AnalyticsProvider></StrictMode>);
  expect(screen.getByText("Disabled")).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(ANALYTICS_PREFERENCE_KEY)!).enabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Capture" }));
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Allow" }));
  fireEvent.click(screen.getByRole("button", { name: "Capture" }));
  expect(request).toHaveBeenCalledTimes(1);
});

it("responds to cross-tab opt-out without recreating the provider", () => {
  render(<AnalyticsProvider options={OPTIONS}><Probe /></AnalyticsProvider>);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: ANALYTICS_PREFERENCE_KEY, newValue: '{"version":1,"enabled":false}' })));
  expect(screen.getByText("Disabled")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Capture" }));
  expect(request).not.toHaveBeenCalled();
});

it("projects actual DatePicker/calendar actions into complete minimal transport envelopes", () => {
  render(<AnalyticsProvider options={OPTIONS}><DatePicker selection={{ mode: "live" }} now={new Date("2026-03-02T14:30:00Z")} homeTimezone="UTC" onSelectDate={vi.fn()} /></AnalyticsProvider>);
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "3 Mar" }));
  fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
  fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  fireEvent.click(screen.getByRole("button", { name: "Wednesday, April 15, 2026" }));
  const bodies = request.mock.calls.map(([url, init]) => {
    expect(url).toBe("https://analytics.example.invalid/i/v0/e/");
    expect(init).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer", redirect: "error" });
    const body = JSON.parse(String(init!.body));
    expect(Object.keys(body).sort()).toEqual(["api_key", "distinct_id", "event", "properties", "timestamp"]);
    expect(body.api_key).toBe(OPTIONS.token);
    expect(body.distinct_id).toMatch(/^[\da-f-]{36}$/);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    return { event: body.event, properties: body.properties };
  });
  const flags = { $process_person_profile: false, $geoip_disable: true };
  expect(bodies).toEqual([
    { event: "date_selected_strip", properties: { date_offset: 1, ...flags } },
    { event: "calendar_opened", properties: flags },
    { event: "calendar_month_navigated", properties: { direction: "forward", months_from_today: 1, ...flags } },
    { event: "date_selected_calendar", properties: { date_offset: 44, month_distance: 1, ...flags } },
    { event: "calendar_closed", properties: { method: "date_selected", ...flags } },
  ]);
});
