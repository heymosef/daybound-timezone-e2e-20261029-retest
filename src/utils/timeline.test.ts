import { utcOffsetLabel } from "./formatOffset";
import { createTimeline, formatZonedClock } from "./timeline";
import { getZonedFields, startOfCalendarDate } from "./calendarDate";

it("uses the same UTC-hour live anchor and elapsed progress for every row", () => {
  const now = new Date("2026-03-07T21:15:30Z");
  for (const zone of ["UTC", "Asia/Kolkata", "Asia/Kathmandu", "Australia/Adelaide", "America/New_York"]) {
    const model = createTimeline(now, zone, true);
    expect(model.anchor).toBe(Date.parse("2026-03-07T21:00:00Z"));
    expect(model.start).toBe(Date.parse("2026-03-07T09:00:00Z"));
    expect(model.progress).toBeCloseTo(12 + 15.5 / 60);
    expect(model.cells).toHaveLength(25);
    expect(model.cells.every((cell, i) => cell.time === model.start + i * 3600000)).toBe(true);
  }
});
it("preserves the exact Kathmandu day start rather than browser-hour rounding", () => {
  const start = startOfCalendarDate("2026-03-08", "Asia/Kathmandu")!;
  const model = createTimeline(start, "Asia/Kathmandu", false, true);
  expect(new Date(model.start).toISOString()).toBe("2026-03-07T18:15:00.000Z");
  expect(model.cells[0]).toMatchObject({ label: "0", fields: { hour: 0, minute: 0 } });
});
it.each([
  ["Asia/Kolkata", "5:30", 18.5],
  ["Asia/Kathmandu", "5:45", 18.25],
  ["Australia/Adelaide", "9:30", 14.5],
])("shows fractional minutes and exact midnight in %s", (zone, label, boundary) => {
  const model = createTimeline(new Date("2026-07-01T00:00:00Z"), zone, false, true);
  expect(model.cells[0].label).toBe(label);
  expect(model.boundaries.map((item) => item.index)).toContain(boundary);
  const midnight = model.boundaries.find((item) => item.index === boundary)!;
  expect(getZonedFields(midnight.time, zone)).toMatchObject({ hour: 0, minute: 0, second: 0 });
  expect(getZonedFields(midnight.time - 1, zone).date).not.toBe(midnight.date);
});
it("shows fractional minutes in both 12h and 24h rail labels", () => {
  const instant = new Date("2026-03-07T21:00:00Z");
  const twelve = createTimeline(instant, "Asia/Kolkata", true, false).cells[12];
  const twentyFour = createTimeline(instant, "Asia/Kolkata", true, true).cells[12];
  expect(twelve).toMatchObject({ label: "2:30", period: "am" });
  expect(twentyFour.label).toBe("2:30");
  expect(formatZonedClock(instant, "Asia/Kolkata", true)).toBe("02:30");
  expect(twelve.isWeekend).toBe(true);
});
it("does not invent a midnight at 00:45; finds the earlier fractional boundary", () => {
  const model = createTimeline(new Date("2026-03-07T18:15:00Z"), "Asia/Kolkata", false);
  expect(model.cells[1].fields).toMatchObject({ hour: 0, minute: 45 });
  expect(model.boundaries[0].index).toBe(0.25);
  expect(model.boundaries.some((boundary) => boundary.index === 1)).toBe(false);
  expect(model.segments.map((segment) => segment.index)).toEqual([0, 0.25, 24.25]);
});
it("searches the final cell and excludes the right endpoint", () => {
  const model = createTimeline(new Date("2026-03-07T23:30:00Z"), "UTC", false);
  expect(model.boundaries.map((boundary) => boundary.index)).toEqual([0.5, 24.5]);
  const endpoint = createTimeline(new Date("2026-03-07T23:00:00Z"), "UTC", false);
  expect(endpoint.boundaries.map((boundary) => boundary.index)).toEqual([1]);
});
it("retains 25 elapsed cells through New York's missing spring hour", () => {
  const model = createTimeline(new Date("2026-03-08T12:00:00Z"), "America/New_York", true, true);
  expect(model.cells).toHaveLength(25);
  expect(model.cells.find((cell) => cell.time === Date.parse("2026-03-08T06:00:00Z"))?.label).toBe("1");
  expect(model.cells.find((cell) => cell.time === Date.parse("2026-03-08T07:00:00Z"))?.label).toBe("3");
  expect(model.cells.filter((cell) => cell.fields.date === "2026-03-08" && cell.fields.hour === 2)).toHaveLength(0);
});
it("disambiguates New York's repeated fall hour with exact instant and offset", () => {
  const model = createTimeline(new Date("2026-11-01T12:00:00Z"), "America/New_York", true, true);
  const repeated = model.cells.filter((cell) => cell.fields.date === "2026-11-01" && cell.fields.hour === 1);
  expect(model.cells).toHaveLength(25);
  expect(repeated.map((cell) => cell.time)).toEqual([Date.parse("2026-11-01T05:00:00Z"), Date.parse("2026-11-01T06:00:00Z")]);
  expect(repeated[0].description).toContain("UTC-04:00");
  expect(repeated[1].description).toContain("UTC-05:00");
});

it.each([
  ["America/New_York", "2026-11-01T00:00:00Z", "2026-11-01T06:00:00Z", -3600, "Back 1h"],
  ["America/New_York", "2026-03-08T00:00:00Z", "2026-03-08T07:00:00Z", 3600, "Forward 1h"],
  ["Australia/Lord_Howe", "2026-04-04T13:00:00Z", "2026-04-04T15:00:00Z", -1800, "Back 30m"],
  ["Australia/Lord_Howe", "2026-10-03T13:00:00Z", "2026-10-03T15:30:00Z", 1800, "Forward 30m"],
])("marks the exact clock change in %s at %s", (zone, start, change, delta, label) => {
  const model = createTimeline(new Date(start), zone, false);
  expect(model.clockChanges).toHaveLength(1);
  expect(model.clockChanges[0]).toMatchObject({
    time: Date.parse(change), index: (Date.parse(change) - Date.parse(start)) / 3600000, delta, label,
  });
  expect(model.clockChanges[0].description).toContain("UTC");
});

it("marks only affected zones and keeps BC on permanent Pacific time", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  for (const zone of ["America/Vancouver", "UTC", "Asia/Kathmandu"]) {
    expect(createTimeline(now, zone, false).clockChanges).toEqual([]);
  }
  expect(createTimeline(now, "America/Los_Angeles", false).clockChanges[0].time).toBe(Date.parse("2026-11-01T09:00:00Z"));
});

it("includes a change at rail start and inside the final cell, excluding the right endpoint", () => {
  const zone = "America/New_York", at = Date.parse("2026-11-01T06:00:00Z");
  expect(createTimeline(new Date(at), zone, false).clockChanges[0].index).toBe(0);
  expect(createTimeline(new Date(at - 24.5 * 3600000), zone, false).clockChanges[0].index).toBe(24.5);
  expect(createTimeline(new Date(at - 25 * 3600000), zone, false).clockChanges).toEqual([]);
  expect(createTimeline(new Date(at + 1), zone, false).clockChanges).toEqual([]);
});

it("finds Toronto's nearby rollback before Vancouver's November 1 rail without adding off-rail dates or cells", () => {
  const model = createTimeline(startOfCalendarDate("2026-11-01", "America/Vancouver")!, "America/Toronto", false);
  expect(model.clockChanges).toEqual([]);
  expect(model.nearbyClockChanges).toEqual([expect.objectContaining({
    time: Date.parse("2026-11-01T06:00:00Z"), index: -1, label: "Back 1h",
  })]);
  expect(model.cells).toHaveLength(25);
  for (const boundary of model.boundaries) {
    expect(boundary.time).toBeGreaterThanOrEqual(model.start);
    expect(boundary.time).toBeLessThan(model.end);
  }
});
it.each([
  ["2026-09-06", "America/Santiago", "2026-09-06T04:00:00.000Z", 23],
  ["2026-11-01", "America/Havana", "2026-11-01T04:00:00.000Z", 24],
  ["2027-11-07", "America/Havana", "2027-11-07T04:00:00.000Z", 25],
  ["2026-10-04", "Australia/Lord_Howe", "2026-10-03T13:30:00.000Z", 23.5],
  ["2026-04-05", "Australia/Lord_Howe", "2026-04-04T13:00:00.000Z", 24.5],
])("keeps exact start and day transitions on %s in %s", (date, zone, expected, nextDateIndex) => {
  const model = createTimeline(startOfCalendarDate(date, zone)!, zone, false, true);
  expect(new Date(model.start).toISOString()).toBe(expected);
  expect(model.cells).toHaveLength(25);
  expect(model.boundaries[0].index).toBe(0);
  if (nextDateIndex < 25) expect(model.boundaries[1].index).toBe(nextDateIndex);
  else expect(model.boundaries).toHaveLength(1);
  for (const boundary of model.boundaries) {
    expect(getZonedFields(boundary.time, zone).date).toBe(boundary.date);
    expect(getZonedFields(boundary.time - 1, zone).date).not.toBe(boundary.date);
  }
});
it("keeps both Lord Howe half-hour shift labels", () => {
  const spring = createTimeline(startOfCalendarDate("2026-10-04", "Australia/Lord_Howe")!, "Australia/Lord_Howe", false, true);
  expect(spring.cells[1].label).toBe("1");
  expect(spring.cells[2].label).toBe("2:30");
  const fall = createTimeline(startOfCalendarDate("2026-04-05", "Australia/Lord_Howe")!, "Australia/Lord_Howe", false, true);
  expect(fall.cells[1].label).toBe("1");
  expect(fall.cells[2].label).toBe("1:30");
});
it("formats fractional and historical second offsets explicitly", () => {
  expect(utcOffsetLabel(20700)).toBe("UTC+05:45");
  expect(utcOffsetLabel(-12600)).toBe("UTC-03:30");
  expect(utcOffsetLabel(19828)).toBe("UTC+05:30:28");
});

it.each([
  ["1988-10-30", "1988-10-29", "01:30", "01:31", "Sun, Oct 30", "Sat, Oct 29"],
  ["2009-11-01", "2009-10-31", "02:30", "02:31", "Sun, Nov 1", "Sat, Oct 31"],
  ["2010-11-07", "2010-11-06", "02:30", "02:31", "Sun, Nov 7", "Sat, Nov 6"],
])("enumerates every St Johns date crossing on %s between hourly samples", (date, previous, midnight, rollback, label, previousLabel) => {
  const start = Date.parse(`${date}T00:05:00Z`);
  const model = createTimeline(new Date(start), "America/St_Johns", false, true);
  const expected = [`${date}T${midnight}:00.000Z`, `${date}T${rollback}:00.000Z`, `${date}T03:30:00.000Z`];
  expect(model.boundaries.map((boundary) => new Date(boundary.time).toISOString())).toEqual(expected);
  expect(model.boundaries.map((boundary) => boundary.date)).toEqual([date, previous, date]);
  expect(model.boundaries.map((boundary) => boundary.label)).toEqual([label, previousLabel, label]);
  for (const [index, boundary] of model.boundaries.entries()) {
    expect(boundary.index).toBeCloseTo((Date.parse(expected[index]) - start) / 3600000, 12);
    expect(getZonedFields(boundary.time, "America/St_Johns").date).toBe(boundary.date);
    expect(getZonedFields(boundary.time - 1, "America/St_Johns").date).toBe(index === 1 ? date : previous);
  }
  expect(model.segments.map((segment) => segment.date)).toEqual([previous, date, previous, date]);
});
