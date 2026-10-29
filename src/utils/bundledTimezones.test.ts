import metadata from "./timezoneAliases.json";
import provenance from "../../docs/timezone-provenance.json";
import { ZoneId } from "@js-joda/core";
import { canonicalTimezone, getTimezoneNames, TIMEZONE_DATA_VERSION } from "./bundledTimezones";
import { getZonedFields, startOfCalendarDate, timezoneTransitions } from "./calendarDate";

it("bundles the current reviewed IANA version and resolves legacy names", () => {
  expect(TIMEZONE_DATA_VERSION).toBe(provenance.version);
  expect(canonicalTimezone("Canada/Pacific")).toBe("America/Vancouver");
  expect(canonicalTimezone("US/Pacific")).toBe("America/Los_Angeles");
  expect(canonicalTimezone("utc")).toBe("UTC");
  expect(canonicalTimezone("Not/A_Zone")).toBeUndefined();
  expect(getTimezoneNames()).toEqual(expect.arrayContaining(["America/Vancouver", "Africa/Kampala", "Asia/Kolkata"]));
});
it.each([
  ["2026-11-01T08:59:59Z", "America/Vancouver", "2026-11-01", 1, 59, -25200, "PCT"],
  ["2026-11-01T09:00:00Z", "America/Vancouver", "2026-11-01", 2, 0, -25200, "PCT"],
  ["2027-01-15T12:00:00Z", "Canada/Pacific", "2027-01-15", 5, 0, -25200, "PCT"],
  ["2027-01-15T12:00:00Z", "America/Los_Angeles", "2027-01-15", 4, 0, -28800, "PST"],
  ["2027-01-15T12:00:00Z", "America/Dawson_Creek", "2027-01-15", 5, 0, -25200, "MST"],
  ["2025-12-15T12:00:00Z", "America/Vancouver", "2025-12-15", 4, 0, -28800, "PST"],
  ["2026-09-16T12:00:00Z", "America/Vancouver", "2026-09-16", 5, 0, -25200, "PDT"],
  ["2026-11-02T12:00:00Z", "America/Edmonton", "2026-11-02", 6, 0, -21600, "CST"],
  ["2026-11-02T12:00:00Z", "America/Winnipeg", "2026-11-02", 7, 0, -18000, "EST"],
  ["2026-11-02T12:00:00Z", "America/Inuvik", "2026-11-02", 6, 0, -21600, "CST"],
  ["2026-11-01T04:59:59Z", "America/Havana", "2026-11-01", 0, 59, -14400, "CDT"],
  ["2026-11-01T05:00:00Z", "America/Havana", "2026-11-01", 1, 0, -14400, "CDT"],
  ["2027-01-15T12:00:00Z", "Cuba", "2027-01-15", 8, 0, -14400, "CDT"],
  ["2027-11-07T04:59:59Z", "America/Havana", "2027-11-07", 0, 59, -14400, "CDT"],
  ["2027-11-07T05:00:00Z", "America/Havana", "2027-11-07", 0, 0, -18000, "CST"],
  ["1965-04-01T01:59:59Z", "America/Sao_Paulo", "1965-03-31", 23, 59, -7200, "UTC-02:00"],
  ["1965-04-01T02:00:00Z", "America/Sao_Paulo", "1965-03-31", 23, 0, -10800, "UTC-03:00"],
  ["1966-03-01T02:59:59Z", "America/Sao_Paulo", "1966-03-01", 0, 59, -7200, "UTC-02:00"],
  ["1966-03-01T03:00:00Z", "America/Sao_Paulo", "1966-03-01", 0, 0, -10800, "UTC-03:00"],
])("uses published rules for %s in %s", (date, zone, day, hour, minute, offsetSeconds, abbreviation) => {
  expect(getZonedFields(new Date(date), zone)).toMatchObject({ date: day, hour, minute, offsetSeconds, abbreviation });
});
it("does not show a canceled Cuba rollback or lengthen its calendar day", () => {
  const start = startOfCalendarDate("2026-11-01", "Cuba")!.getTime();
  const end = startOfCalendarDate("2026-11-02", "Cuba")!.getTime();
  expect(end - start).toBe(24 * 3_600_000);
  expect(timezoneTransitions(start, end, "Cuba").offsetChanges).toEqual([]);
});
it("is independent of stale or unavailable device Intl timezone rules", () => {
  const formatter = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => { throw new Error("Device timezone data unavailable"); });
  try {
    expect(getZonedFields(new Date("2027-01-15T12:00Z"), "America/Vancouver")).toMatchObject({ hour: 5, offsetSeconds: -25200, abbreviation: "PCT" });
  } finally { formatter.mockRestore(); }
});
it("preserves a skipped calendar day and exact historical seconds", () => {
  expect(startOfCalendarDate("2011-12-30", "Pacific/Apia")).toBeNull();
  expect(getZonedFields(new Date("1900-01-01T00:00Z"), "Asia/Kathmandu").offsetSeconds).toBe(20476);
});

it("loads every selectable zone and alias into the active provider", () => {
  expect(TIMEZONE_DATA_VERSION).toBe(metadata.version);
  for (const name of getTimezoneNames()) {
    expect(() => ZoneId.of(name).rules()).not.toThrow();
  }
});
