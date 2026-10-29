import { bundledZonedFields } from "./bundledTimezones";
import { LocalDate, ZoneId, ZoneOffset, ZonedDateTime } from "@js-joda/core";

export type DateSelection = { mode: "live" } | { mode: "date"; date: string };
export const LIVE_SELECTION: DateSelection = { mode: "live" };
export const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function surrogate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

const keyOf = (date: Date): string =>
  `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

export function isCalendarDate(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [year, month, day] = key.split("-").map(Number);
  return year >= 1 && keyOf(surrogate(year, month, day)) === key;
}

export function calendarSurrogate(key: string): Date {
  if (!isCalendarDate(key)) throw new RangeError("Invalid calendar date");
  const [year, month, day] = key.split("-").map(Number);
  return surrogate(year, month, day);
}

export function getZonedFields(instant: Date | number, timezone: string) {
  return bundledZonedFields(instant instanceof Date ? instant.getTime() : instant, timezone);
}

/** Preserve wall-clock time; prefer the original offset in an overlap, shift forward through a gap. */
export function onCalendarDate(date: string, reference: number, timezone: string): number {
  if (!isCalendarDate(date)) throw new RangeError("Invalid calendar date");
  const fields = getZonedFields(reference, timezone);
  const local = LocalDate.parse(date).atTime(fields.hour, fields.minute, fields.second, 0);
  return ZonedDateTime.ofLocal(local, ZoneId.of(timezone), ZoneOffset.ofTotalSeconds(fields.offsetSeconds))
    .toInstant().toEpochMilli();
}

export const addCalendarDays = (key: string, days: number): string => {
  const date = calendarSurrogate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return keyOf(date);
};
export const calendarDifference = (later: string, earlier: string): number =>
  (calendarSurrogate(later).getTime() - calendarSurrogate(earlier).getTime()) / DAY_MS;
export const startOfCalendarMonth = (key: string): string => `${key.slice(0, 7)}-01`;
export function addCalendarMonths(key: string, months: number): string {
  const date = calendarSurrogate(startOfCalendarMonth(key));
  date.setUTCMonth(date.getUTCMonth() + months);
  return keyOf(date);
}
export function calendarMonthDays(key: string): string[] {
  const first = startOfCalendarMonth(key);
  const next = addCalendarMonths(first, 1);
  return Array.from({ length: calendarDifference(next, first) }, (_, i) => addCalendarDays(first, i));
}
export function formatCalendarDate(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(calendarSurrogate(key));
}

/**
 * Local-date and UTC-offset changes in [start, end), including backward date jumps.
 * Hourly OFFSET brackets assume at most
 * one offset change per hour (as in the supported IANA timezone data). They do
 * not assume that calendar dates are monotonic or last at least an hour.
 */
export function timezoneTransitions(start: number, end: number, timezone: string) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end <= start) {
    throw new RangeError("Invalid date transition interval");
  }
  const spans: { start: number; end: number; offset: number }[] = [];
  const offsetChanges: { time: number; before: number; after: number }[] = [];
  // Include the millisecond preceding the rail so a boundary at start survives.
  let spanStart = start - 1;
  let offset = getZonedFields(spanStart, timezone).offsetSeconds;
  for (let before = spanStart; before < end;) {
    const after = Math.min(before + HOUR_MS, end);
    const nextOffset = getZonedFields(after, timezone).offsetSeconds;
    if (nextOffset !== offset) {
      let low = before;
      let high = after;
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (getZonedFields(middle, timezone).offsetSeconds === offset) low = middle;
        else high = middle;
      }
      spans.push({ start: spanStart, end: high, offset });
      if (high >= start && high < end) offsetChanges.push({ time: high, before: offset, after: nextOffset });
      spanStart = high;
      offset = nextOffset;
    }
    before = after;
  }
  spans.push({ start: spanStart, end, offset });

  const candidates = new Set<number>();
  for (const span of spans) {
    if (span.start >= start && span.start < end) candidates.add(span.start);
    const offsetMs = span.offset * 1000;
    // Epoch-day arithmetic works through astronomical year zero; do not feed
    // intermediate BC fields through the public AD-only YYYY-MM-DD validator.
    let midnight = Math.ceil((span.start + offsetMs) / DAY_MS) * DAY_MS - offsetMs;
    for (; midnight < span.end; midnight += DAY_MS) {
      if (midnight < start || midnight >= end) continue;
      const fields = getZonedFields(midnight, timezone);
      if (fields.offsetSeconds !== span.offset || fields.hour !== 0 || fields.minute !== 0 || fields.second !== 0) {
        throw new RangeError("Calendar midnight does not round-trip within its offset span");
      }
      candidates.add(midnight);
    }
  }
  const dates = [...candidates]
    .filter((time) => getZonedFields(time, timezone).date !== getZonedFields(time - 1, timezone).date)
    .sort((a, b) => a - b);
  return { dates, offsetChanges };
}

export function calendarDateTransitions(start: number, end: number, timezone: string): number[] {
  return timezoneTransitions(start, end, timezone).dates;
}

/** Earliest occurrence in a bounded 72h window, including brief/repeated dates. */
export function startOfCalendarDate(key: string, timezone: string): Date | null {
  const nominal = calendarSurrogate(key).getTime();
  const boundaries = calendarDateTransitions(nominal - 36 * HOUR_MS, nominal + 36 * HOUR_MS, timezone);
  const first = boundaries.find((time) => getZonedFields(time, timezone).date === key);
  return first === undefined ? null : new Date(first);
}
