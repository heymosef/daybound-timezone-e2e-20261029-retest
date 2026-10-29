import { addCalendarDays, addCalendarMonths, calendarDifference, calendarMonthDays, getZonedFields, isCalendarDate, onCalendarDate, startOfCalendarDate } from "./calendarDate";

it.each([
  ["Asia/Kathmandu", "2026-03-07T21:00:00Z", "2026-03-09", "2026-03-08T21:00:00.000Z"],
  ["America/Vancouver", "2026-10-23T19:28:00Z", "2026-11-03", "2026-11-03T19:28:00.000Z"],
  ["America/New_York", "2026-03-07T07:30:00Z", "2026-03-08", "2026-03-08T07:30:00.000Z"],
  ["America/New_York", "2026-10-31T05:30:00Z", "2026-11-01", "2026-11-01T05:30:00.000Z"],
  ["America/New_York", "2026-11-02T06:30:00Z", "2026-11-01", "2026-11-01T06:30:00.000Z"],
])("moves a clock to another date using bundled rules in %s", (zone, reference, date, expected) => {
  expect(new Date(onCalendarDate(date, Date.parse(reference), zone)).toISOString()).toBe(expected);
});

it.each(["2026-02-29", "2026-13-01", "2026-00-01", "2026-03-00", "0000-01-01", "2026-3-01", "garbage"])("rejects invalid key %s", (key) => expect(isCalendarDate(key)).toBe(false));
it("uses UTC calendar fields for leap days and month/year arithmetic", () => {
  expect(isCalendarDate("2024-02-29")).toBe(true);
  expect(isCalendarDate("0099-01-01")).toBe(true);
  expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addCalendarMonths("2026-12-31", 1)).toBe("2027-01-01");
  expect(calendarMonthDays("2024-02-10")).toHaveLength(29);
  expect(calendarDifference("2026-03-09", "2026-03-07")).toBe(2);
});
it("extracts Kolkata fields through the Vancouver browser DST gap", () => {
  expect(getZonedFields(new Date("2026-03-07T21:00:00Z"), "Asia/Kolkata")).toMatchObject({ date: "2026-03-08", hour: 2, minute: 30, offsetSeconds: 19800 });
});
it.each([
  ["0001-01-01", "UTC", "0001-01-01T00:00:00.000Z", 0],
  ["0099-01-01", "UTC", "0099-01-01T00:00:00.000Z", 0],
  ["2026-03-08", "Asia/Kathmandu", "2026-03-07T18:15:00.000Z", 0],
  ["2026-09-06", "America/Santiago", "2026-09-06T04:00:00.000Z", 1],
  ["2026-11-01", "America/Havana", "2026-11-01T04:00:00.000Z", 0],
  ["2026-10-04", "Australia/Lord_Howe", "2026-10-03T13:30:00.000Z", 0],
  ["2026-04-05", "Australia/Lord_Howe", "2026-04-04T13:00:00.000Z", 0],
  ["2026-03-08", "America/New_York", "2026-03-08T05:00:00.000Z", 0],
  ["2026-11-01", "America/New_York", "2026-11-01T04:00:00.000Z", 0],
  ["2026-03-08", "Pacific/Kiritimati", "2026-03-07T10:00:00.000Z", 0],
])("resolves earliest date %s in %s", (date, zone, expected, hour) => {
  const start = startOfCalendarDate(date, zone)!;
  expect(start.toISOString()).toBe(expected);
  expect(getZonedFields(start, zone)).toMatchObject({ date, hour, minute: 0 });
  expect(getZonedFields(start.getTime() - 1, zone).date).not.toBe(date);
  for (let earlier = start.getTime() - 36 * 3600000; earlier < start.getTime(); earlier += 15 * 60000) {
    expect(getZonedFields(earlier, zone).date).not.toBe(date);
  }
});
it("rejects an entirely skipped date rather than choosing a different day", () => {
  expect(startOfCalendarDate("2011-12-30", "Pacific/Apia")).toBeNull();
});
// These fixtures come from explicit-zone Intl fields, including the one-minute
// appearance before a rollback crosses back to the previous calendar date.
it.each([
  ["1988-10-30", "1988-10-30T01:30:00.000Z", "1988-10-30T01:31:00.000Z", -5400, -12600],
  ["2009-11-01", "2009-11-01T02:30:00.000Z", "2009-11-01T02:31:00.000Z", -9000, -12600],
  ["2010-11-07", "2010-11-07T02:30:00.000Z", "2010-11-07T02:31:00.000Z", -9000, -12600],
])("keeps the earliest brief St Johns date %s", (date, earliest, rollback, oldOffset, newOffset) => {
  const zone = "America/St_Johns";
  const start = Date.parse(earliest);
  const jump = Date.parse(rollback);
  expect(getZonedFields(start - 1, zone).date).toBe(addCalendarDays(date, -1));
  expect(getZonedFields(start, zone)).toMatchObject({ date, hour: 0, minute: 0, offsetSeconds: oldOffset });
  expect(getZonedFields(jump - 1, zone)).toMatchObject({ date, hour: 0, minute: 0, second: 59, offsetSeconds: oldOffset });
  expect(getZonedFields(jump, zone)).toMatchObject({ date: addCalendarDays(date, -1), offsetSeconds: newOffset });
  expect(startOfCalendarDate(date, zone)?.toISOString()).toBe(earliest);
});
it("retains astronomical year zero inside the earliest public year search", () => {
  expect(isCalendarDate("0001-01-01")).toBe(true);
  expect(getZonedFields(Date.parse("0001-01-01T00:00:00Z") - 1, "UTC")).toMatchObject({ year: 0, date: "0000-12-31", offsetSeconds: 0 });
  expect(startOfCalendarDate("0001-01-01", "UTC")?.toISOString()).toBe("0001-01-01T00:00:00.000Z");
  expect(startOfCalendarDate("0099-01-01", "UTC")?.toISOString()).toBe("0099-01-01T00:00:00.000Z");
  expect(isCalendarDate("0000-12-31")).toBe(false);
});
