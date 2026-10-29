import { offlineAnalyticsOptions, createFetchMock } from "../../test/analytics";
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddTimezone } from "./AddTimezone";
import { SettingsMenu } from "./SettingsMenu";
import { DEFAULT_SETTINGS } from "../../utils/persistence";
import { AnalyticsProvider } from "../../analytics/AnalyticsProvider";
import { loadCityCatalog } from "../../analytics/searchCatalog";
import { createAnalytics } from "../../analytics/analytics";

const OPTIONS = offlineAnalyticsOptions();
const PRIVATE_QUERY = "PrivateZebraProject ConfidentialSearch-8472";
let request: ReturnType<typeof createFetchMock>;
beforeAll(async () => { await loadCityCatalog(); });
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  request = createFetchMock();
  vi.stubGlobal("fetch", request);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("filters suspicious search text and retains the existing no-result count without metadata", async () => {
  render(<AnalyticsProvider options={OPTIONS}><AddTimezone onAdd={vi.fn()} existingTimezones={[]} /></AnalyticsProvider>);
  expect(request).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText("Search major city"), { target: { value: PRIVATE_QUERY } });
  await act(async () => { vi.advanceTimersByTime(701); });
  expect(request).toHaveBeenCalledTimes(2);
  const [url, init] = request.mock.calls.find(call => JSON.parse(String(call[1]!.body)).event === "timezone_search_no_results")!;
  expect(url).toBe("https://analytics.example.invalid/i/v0/e/");
  const body = JSON.parse(String(init!.body));
  expect(body).toEqual({
    api_key: OPTIONS.token, event: "timezone_search_no_results", distinct_id: expect.stringMatching(/^[\da-f-]{36}$/),
    timestamp: expect.any(String), properties: {
      query_length: PRIVATE_QUERY.length, query_words: 2, $process_person_profile: false, $geoip_disable: true,
    },
  });
  expect(init).toEqual({ method: "POST", headers: { "Content-Type": "application/json" }, body: expect.any(String), credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: expect.any(AbortSignal) });
  const envelope = JSON.stringify(request.mock.calls);
  for (const privateText of [PRIVATE_QUERY, "privatezebraproject", "ConfidentialSearch", "8472", "query_sanitized", "$current_url", "$referrer"]) expect(envelope).not.toContain(privateText);
});

it("retains the search keyboard shortcut event without adding browser metadata", () => {
  render(<AnalyticsProvider options={OPTIONS}><AddTimezone onAdd={vi.fn()} existingTimezones={[]} /></AnalyticsProvider>);
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  act(() => vi.advanceTimersByTime(11));
  expect(screen.getByPlaceholderText("Search major city")).toHaveFocus();
  expect(JSON.parse(String(request.mock.calls[0][1]!.body))).toMatchObject({ event: "keyboard_shortcut_used", properties: { shortcut: "ctrl_k", $process_person_profile: false, $geoip_disable: true } });
});

it("does not flush an already scheduled failed-search event after opting out", () => {
  const controller = createAnalytics(OPTIONS);
  render(<AnalyticsProvider controller={controller}><AddTimezone onAdd={vi.fn()} existingTimezones={[]} /></AnalyticsProvider>);
  fireEvent.change(screen.getByPlaceholderText("Search major city"), { target: { value: PRIVATE_QUERY } });
  act(() => controller.setEnabled(false));
  act(() => vi.advanceTimersByTime(5000));
  fireEvent(window, new Event("online"));
  fireEvent(window, new Event("unload"));
  expect(request).not.toHaveBeenCalled();
});

const events = () => request.mock.calls.map(call => JSON.parse(String(call[1]!.body)) as { event: string; distinct_id: string; properties: Record<string, unknown> });
const settle = async () => { await act(async () => { vi.advanceTimersByTime(701); }); };
function mountSearch(existingTimezones: string[] = []) {
  const controller = createAnalytics(OPTIONS);
  render(<AnalyticsProvider controller={controller}><AddTimezone onAdd={vi.fn()} existingTimezones={existingTimezones} /></AnalyticsProvider>);
  return controller;
}

it("links an actual missing-city attempt, follow-up and clicked standard city", async () => {
  mountSearch();
  const input = screen.getByPlaceholderText("Search major city");
  fireEvent.change(input, { target: { value: "Utrecht" } }); await settle();
  expect(screen.getByText("No results found")).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "Amsterdam" } }); await settle();
  fireEvent.click(screen.getByRole("option", { name: "Amsterdam Europe/Amsterdam" }));
  await act(async () => {});
  const attempts = events().filter(e => e.event === "timezone_search_attempted");
  const selected = events().find(e => e.event === "timezone_search_selected")!;
  expect(attempts).toHaveLength(2);
  expect(attempts[0].properties).toMatchObject({ missing_city: true, requested_city: "Utrecht", requested_country: "NL", attempt: 1 });
  expect(attempts[1].properties).toMatchObject({ missing_city: false, follow_up: true, attempt: 2 });
  expect(selected.properties).toMatchObject({ search_id: attempts[0].properties.search_id, attempt: 2,
    selected_city: "Amsterdam", selected_timezone: "Europe/Amsterdam", selected_city_id: 2759794 });
  expect(attempts[1].properties.search_id).toBe(attempts[0].properties.search_id);
  // Utrecht and Amsterdam share a timezone; selection is an observed alternative, not proof of intended-city success.
  expect(selected.properties.selected_city_id).not.toBe(attempts[0].properties.requested_city_id);
});

it("captures quick keyboard selections before the pause without recording each keystroke", async () => {
  mountSearch();
  const input = screen.getByPlaceholderText("Search major city");
  for (const value of ["L", "Lo", "Lon", "London"]) fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" }); await act(async () => {});
  expect(events().filter(e => e.event === "timezone_search_attempted")).toHaveLength(1);
  expect(events().filter(e => e.event === "timezone_search_selected")).toHaveLength(1);
  expect(events().find(e => e.event === "timezone_search_selected")!.properties.selected_city).toBe("London");
  await settle();
  expect(events().filter(e => e.event === "timezone_search_attempted")).toHaveLength(1);
});

it("retains selection when Safari blurs input to null before a result click", async () => {
  mountSearch();
  const input = screen.getByPlaceholderText("Search major city");
  fireEvent.change(input, { target: { value: "London" } }); await settle();
  fireEvent.blur(input, { relatedTarget: null });
  fireEvent.click(screen.getByRole("option", { name: "London Europe/London" }));
  await act(async () => {});
  expect(events().filter(e => e.event === "timezone_search_selected")).toHaveLength(1);
  expect(events().filter(e => e.event === "timezone_search_closed")).toHaveLength(0);
});
it("records a native result click without closed Settings stealing focus", async () => {
  vi.useRealTimers();
  const user = userEvent.setup();
  render(<AnalyticsProvider options={OPTIONS}>
    <AddTimezone onAdd={vi.fn()} existingTimezones={[]} />
    <SettingsMenu settings={DEFAULT_SETTINGS} onSettingsChange={vi.fn()} timezones={[]} onSetHome={vi.fn()} />
  </AnalyticsProvider>);
  const input = screen.getByPlaceholderText("Search major city");
  await user.click(input);
  await user.type(input, "London");
  await user.click(screen.getByRole("option", { name: "London Europe/London" }));
  await act(async () => {});
  expect(events().filter(e => e.event === "timezone_search_selected")).toHaveLength(1);
  expect(events().filter(e => e.event === "timezone_search_closed")).toHaveLength(0);
});

it("does not count a city already in the timeline as missing", async () => {
  mountSearch(["Europe/Amsterdam"]);
  fireEvent.change(screen.getByPlaceholderText("Search major city"), { target: { value: "Amsterdam" } }); await settle();
  const attempt = events().find(e => e.event === "timezone_search_attempted")!;
  expect(attempt.properties).toMatchObject({ available_results: 0, already_added_results: 1, no_results: false, missing_city: false });
  expect(events().filter(e => e.event === "timezone_search_no_results")).toHaveLength(0);
});

it("records observed Escape/outside/focus closes once, with distinct journeys on reopening", async () => {
  mountSearch();
  const input = screen.getByPlaceholderText("Search major city");
  fireEvent.change(input, { target: { value: "Utrecht" } });
  fireEvent.keyDown(input, { key: "Escape" }); await act(async () => {});
  fireEvent.change(input, { target: { value: "Amsterdam" } });
  fireEvent.mouseDown(document.body); fireEvent.blur(input, { relatedTarget: document.body }); await act(async () => {});
  const closed = events().filter(e => e.event === "timezone_search_closed");
  expect(closed.map(e => e.properties.method)).toEqual(["escape", "outside_click"]);
  expect(closed[0].properties.search_id).not.toBe(closed[1].properties.search_id);
});

it("keeps Clear search in the same journey so the next city can be a follow-up", async () => {
  mountSearch();
  const input = screen.getByPlaceholderText("Search major city");
  fireEvent.change(input, { target: { value: "Utrecht" } }); await settle();
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  fireEvent.change(input, { target: { value: "Amsterdam" } }); await settle();
  const attempts = events().filter(e => e.event === "timezone_search_attempted");
  expect(attempts[1].properties).toMatchObject({ search_id: attempts[0].properties.search_id, attempt: 2 });
});

it("captures only eligible unknown words in sampled journeys, bounded at the actual fetch", async () => {
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  mountSearch();
  fireEvent.change(screen.getByPlaceholderText("Search major city"), { target: { value: "Vancuver" } }); await settle();
  expect(events().find(e => e.event === "timezone_search_attempted")!.properties).toMatchObject({ filtered_query: "vancuver", recognition: "unrecognized", sample_index: 1 });
  fireEvent.change(screen.getByPlaceholderText("Search major city"), { target: { value: "email@example.com" } }); await settle();
  expect(JSON.stringify(events())).not.toContain("email@example.com");
});

it("drops pending search work on opt-out and does not retrospectively collect after opting in", async () => {
  const controller = mountSearch();
  const input = screen.getByPlaceholderText("Search major city");
  fireEvent.change(input, { target: { value: "Vancuver" } });
  act(() => controller.setEnabled(false)); await settle();
  act(() => controller.setEnabled(true)); await settle();
  expect(request).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "Utrecht" } }); await settle();
  expect(events().find(e => e.event === "timezone_search_attempted")!.properties.requested_city).toBe("Utrecht");
});

it("does not replay a pending attempt when off/on are batched before React rerenders", async () => {
  const controller = mountSearch();
  fireEvent.change(screen.getByPlaceholderText("Search major city"), { target: { value: "Vancuver" } });
  act(() => { vi.advanceTimersByTime(701); controller.setEnabled(false); controller.setEnabled(true); });
  await act(async () => {});
  expect(request).not.toHaveBeenCalled();
});
