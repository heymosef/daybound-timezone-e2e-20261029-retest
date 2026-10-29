import { utcOffsetLabel } from "./formatOffset";
import { timezoneTransitions, formatCalendarDate, getZonedFields, HOUR_MS } from "./calendarDate";

export const TOTAL_HOURS = 25;
export const PAN_LIMIT_HOURS = 24;
export const CENTER_INDEX = 12;
export const CLOCK_CHANGE_LOOKAROUND_HOURS = 6;
type ZonedFields = ReturnType<typeof getZonedFields>;

export function formatClock(fields: ZonedFields, use24Hour: boolean, alwaysMinutes = true, pad24 = false): string {
  const hour = use24Hour ? fields.hour : fields.hour % 12 || 12;
  const hourText = pad24 && use24Hour ? String(hour).padStart(2, "0") : String(hour);
  const minutes = alwaysMinutes || fields.minute !== 0 ? `:${String(fields.minute).padStart(2, "0")}` : "";
  return `${hourText}${minutes}`;
}
export const dayPeriod = (fields: ZonedFields): string => fields.hour < 12 ? "AM" : "PM";
export function formatZonedClock(instant: Date, timezone: string, use24Hour: boolean, pad24 = true): string {
  const fields = getZonedFields(instant, timezone);
  return `${formatClock(fields, use24Hour, true, pad24)}${use24Hour ? "" : ` ${dayPeriod(fields)}`}`;
}
export function createTimeline(instant: Date, timezone: string, isLive: boolean, use24Hour = false) {
  const epoch = instant.getTime();
  const anchor = isLive ? Math.floor(epoch / HOUR_MS) * HOUR_MS : epoch;
  const start = isLive ? anchor - CENTER_INDEX * HOUR_MS : anchor;
  const end = start + TOTAL_HOURS * HOUR_MS;
  const progress = isLive ? CENTER_INDEX + (epoch - anchor) / HOUR_MS : 0;
  const cells = Array.from({ length: TOTAL_HOURS }, (_, index) => {
    const time = start + index * HOUR_MS;
    const fields = getZonedFields(time, timezone);
    return {
      index, time, fields,
      label: formatClock(fields, use24Hour, false), period: dayPeriod(fields).toLowerCase(),
      isNight: fields.hour < 7 || fields.hour >= 19,
      isWeekend: fields.weekday === "Sat" || fields.weekday === "Sun",
      description: `${fields.date} ${formatClock(fields, true)} ${utcOffsetLabel(fields.offsetSeconds)} (${new Date(time).toISOString()})`,
    };
  });

  const boundaryAt = (time: number) => {
    const fields = getZonedFields(time, timezone);
    return {
      time, index: (time - start) / HOUR_MS, date: fields.date,
      label: formatCalendarDate(fields.date, { weekday: "short", month: "short", day: "numeric" }),
      key: `${fields.date}-${time}`,
    };
  };
  // Shared offset spans find brief and backward date crossings through the
  // final cell, while excluding the rail's right endpoint.
  const lookaround = CLOCK_CHANGE_LOOKAROUND_HOURS * HOUR_MS;
  const { dates, offsetChanges } = timezoneTransitions(start - lookaround, end + lookaround, timezone);
  const boundaries = dates.filter(time => time >= start && time < end).map(boundaryAt);
  const segments = [boundaryAt(start), ...boundaries.filter((boundary) => boundary.time > start)];
  const nearbyClockChanges = offsetChanges.map(({ time, before, after }) => {
    const delta = after - before;
    const seconds = Math.abs(delta);
    const duration = [
      seconds >= 3600 ? `${Math.floor(seconds / 3600)}h` : "",
      seconds % 3600 >= 60 ? `${Math.floor(seconds % 3600 / 60)}m` : "",
      seconds % 60 ? `${seconds % 60}s` : "",
    ].filter(Boolean).join(" ");
    return {
      time, index: (time - start) / HOUR_MS, delta,
      label: `${delta < 0 ? "Back" : "Forward"} ${duration}`,
      description: `Clocks go ${delta < 0 ? "back" : "forward"} ${duration}. ${utcOffsetLabel(before)} to ${utcOffsetLabel(after)}.`,
    };
  });
  const clockChanges = nearbyClockChanges.filter(change => change.time >= start && change.time < end);
  return { start, end, anchor, progress, cells, boundaries, segments, clockChanges, nearbyClockChanges };
}
