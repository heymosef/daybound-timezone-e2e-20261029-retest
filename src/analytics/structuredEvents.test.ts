import { offlineAnalyticsOptions, createFetchMock } from "../test/analytics";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAnalytics, type AnalyticsController } from "./analytics";

let request: ReturnType<typeof createFetchMock>;
let controller: AnalyticsController;
const flags = { $process_person_profile: false, $geoip_disable: true };
const privateText = "Private payroll office";
beforeEach(() => {
  localStorage.clear();
  request = createFetchMock();
  vi.stubGlobal("fetch", request);
  controller = createAnalytics(offlineAnalyticsOptions({ host: "https://analytics.invalid", hostname: "app.invalid" }));
  controller.start();
});
afterEach(() => { controller.dispose(); vi.unstubAllGlobals(); });
const capture = (event: string, properties: unknown) => (controller.capture as (event: string, properties: unknown) => void)(event, properties);
const properties = () => JSON.parse(String(request.mock.calls[0][1]!.body)).properties;

it.each([
  ["time_format", "12h"], ["time_format", "24h"],
  ["appearance", "light"], ["appearance", "dark"], ["appearance", "system"],
  ["design_theme", "te-1"], ["design_theme", "gamut"], ["design_theme", "dos"],
  ["timezone_badge", true], ["timezone_badge", false], ["weekend_indicator", true], ["weekend_indicator", false],
])("sends only allowlisted settings %s=%s", (setting, value) => {
  capture("settings_changed", { setting, value, label: privateText, home_city: privateText, nested: { secret: privateText } });
  expect(properties()).toEqual({ setting, value, ...flags });
  expect(JSON.stringify(request.mock.calls)).not.toContain(privateText);
});

it.each([
  { setting: "appearance", value: privateText }, { setting: "time_format", value: true },
  { setting: "timezone_badge", value: "false" }, { setting: "weekend_indicator", value: 1 },
  { setting: privateText, value: true }, { setting: "design_theme", value: "unknown" },
  { setting: "appearance", value: { name: "dark" } }, {}, null,
])("drops invalid settings input %j", (input) => {
  capture("settings_changed", input);
  expect(request).not.toHaveBeenCalled();
});

it("rebuilds the selected reference city from picker data, ignoring supplied labels/country", () => {
  capture("home_timezone_changed", { reference_timezone: "US/Pacific", reference_result_id: "America/Los_Angeles|Seattle",
    reference_city: privateText, reference_country: privateText, label: privateText, id: privateText });
  expect(properties()).toEqual({ reference_timezone: "America/Los_Angeles", reference_result_id: "America/Los_Angeles|Seattle",
    reference_city: "Seattle", reference_country: "USA", ...flags });
  expect(JSON.stringify(request.mock.calls)).not.toContain(privateText);
});

it("reports only a validated timezone for older rows with no standard city metadata", () => {
  capture("home_timezone_changed", { reference_timezone: "Europe/London", city: privateText, country: privateText, label: privateText });
  expect(properties()).toEqual({ reference_timezone: "Europe/London", ...flags });
});

it.each([
  {}, { reference_timezone: privateText }, { reference_timezone: "UTC", reference_result_id: privateText },
  { reference_timezone: "Europe/London", reference_result_id: "America/Los_Angeles|Seattle" },
  { reference_timezone: "+01:00" }, { reference_timezone: "UTC", reference_result_id: 1 },
])("rejects invalid or mismatched reference city/timezone %j", (input) => {
  capture("home_timezone_changed", input);
  expect(request).not.toHaveBeenCalled();
});
