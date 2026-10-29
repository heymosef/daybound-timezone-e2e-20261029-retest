import { canonicalTimezone } from "./bundledTimezones";
import { MAX_TEXT_LENGTH } from "./labels";
import type { AppSettings, TimezoneConfig } from "./timezoneUtils";

export const DEFAULT_SETTINGS: AppSettings = {
  use24Hour: false,
  theme: "system",
  designTheme: "te-1",
  showBadge: true,
  showWeekends: false,
};

export type PersistenceStatus = "saved" | "unavailable";
export type PersistenceParser<T> = (value: unknown) => T;

export type ExternalStorageValue<T> =
  | { kind: "valid"; raw: string; value: T }
  | { kind: "absent"; raw: null; value: T }
  | { kind: "invalid"; raw: string; reason: string }
  | { kind: "unavailable" };
export type ExternalDecoder<T> = (raw: string | null) => ExternalStorageValue<T>;

export function readExternalValue<T>(key: string, decode: ExternalDecoder<T>): ExternalStorageValue<T> {
  try {
    return decode(window.localStorage.getItem(key));
  } catch {
    return { kind: "unavailable" };
  }
}

function decodeExternal<T>(raw: string | null, cleared: T, validate: (value: unknown) => boolean,
  parse: PersistenceParser<T>, reason: string): ExternalStorageValue<T> {
  if (raw === null) return { kind: "absent", raw, value: cleared };
  try {
    const value: unknown = JSON.parse(raw);
    return validate(value) ? { kind: "valid", raw, value: parse(value) } : { kind: "invalid", raw, reason };
  } catch {
    return { kind: "invalid", raw, reason: "The saved data could not be read as JSON." };
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const settingValidators = {
  use24Hour: (value: unknown): value is boolean => typeof value === "boolean",
  showBadge: (value: unknown): value is boolean => typeof value === "boolean",
  showWeekends: (value: unknown): value is boolean => typeof value === "boolean",
  theme: (value: unknown): value is AppSettings["theme"] => value === "light" || value === "dark" || value === "system",
  designTheme: (value: unknown): value is AppSettings["designTheme"] => value === "gamut" || value === "te-1" || value === "dos",
};

export function parseAppSettings(value: unknown): AppSettings {
  const settings = { ...DEFAULT_SETTINGS };
  if (!isRecord(value)) return settings;
  if (settingValidators.use24Hour(value.use24Hour)) settings.use24Hour = value.use24Hour;
  if (settingValidators.showBadge(value.showBadge)) settings.showBadge = value.showBadge;
  if (settingValidators.showWeekends(value.showWeekends)) settings.showWeekends = value.showWeekends;
  if (settingValidators.theme(value.theme)) {
    settings.theme = value.theme;
  }
  if (settingValidators.designTheme(value.designTheme)) {
    settings.designTheme = value.designTheme;
  }
  return settings;
}

// Retain valid rows even if an optional text field needs to be discarded.
const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.length <= MAX_TEXT_LENGTH ? value : undefined;

function isTimezone(value: unknown): value is string {
  return typeof value === "string" && canonicalTimezone(value) !== undefined;
}

export function parseTimezoneConfig(value: unknown): TimezoneConfig[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const timezones = new Set<string>();
  const rows: TimezoneConfig[] = [];
  for (const row of value) {
    if (!isRecord(row) || typeof row.id !== "string" || !row.id.trim() ||
      ids.has(row.id) || !isTimezone(row.timezone) || timezones.has(row.timezone)) continue;
    ids.add(row.id);
    timezones.add(row.timezone);
    const parsed: TimezoneConfig = { id: row.id, timezone: row.timezone, isHome: row.isHome === true };
    for (const field of ["label", "city", "country"] as const) {
      const text = optionalText(row[field]);
      if (text !== undefined) parsed[field] = text;
    }
    rows.push(parsed);
  }
  const homeIndex = Math.max(0, rows.findIndex((row) => row.isHome));
  return rows.map((row, index) => ({ ...row, isHome: index === homeIndex }));
}

export const decodeExternalTimezoneConfig: ExternalDecoder<TimezoneConfig[]> = (raw) =>
  decodeExternal(raw, [], (value) => {
    if (!Array.isArray(value)) return false;
    const ids = new Set<string>();
    const timezones = new Set<string>();
    return value.every((row: unknown) => {
      if (!isRecord(row) || typeof row.id !== "string" || !row.id.trim() || ids.has(row.id) ||
        !isTimezone(row.timezone) || timezones.has(row.timezone) ||
        ("isHome" in row && typeof row.isHome !== "boolean") ||
        ["label", "city", "country"].some((field) => field in row && optionalText(row[field]) === undefined)) return false;
      ids.add(row.id);
      timezones.add(row.timezone);
      return true;
    });
  }, parseTimezoneConfig, "The saved city list contains an invalid city or field.");

export const decodeExternalAppSettings: ExternalDecoder<AppSettings> = (raw) =>
  decodeExternal(raw, { ...DEFAULT_SETTINGS }, (value) => {
    if (!isRecord(value)) return false;
    const known = Object.keys(settingValidators) as (keyof typeof settingValidators)[];
    const present = known.filter((key) => key in value);
    return (Object.keys(value).length === 0 || present.length > 0) &&
      present.every((key) => settingValidators[key](value[key]));
  }, parseAppSettings, "The saved settings contain an invalid setting.");

export const decodeExternalNoticeDismissed: ExternalDecoder<boolean> = (raw) =>
  decodeExternal(raw, false, (value) => typeof value === "boolean", (value) => value === true,
    "The saved notice preference is not a boolean.");

export const parseNoticeDismissed = (value: unknown): boolean => value === true;

/** Read without mutating storage; recovery writes belong to the committed React effect. */
export function readPersistentValue<T>(key: string, initialValue: T, parse: PersistenceParser<T>): {
  value: T;
  status: PersistenceStatus;
  needsWrite: boolean;
  canPersist: boolean;
  acknowledgedRaw: string | null | undefined;
} {
  let saved: string | null;
  try {
    saved = window.localStorage.getItem(key);
  } catch {
    return { value: initialValue, status: "unavailable", needsWrite: false, canPersist: false, acknowledgedRaw: undefined };
  }
  let value: T;
  try {
    value = parse(saved === null ? undefined : JSON.parse(saved));
  } catch {
    value = initialValue;
  }
  return { value, status: "saved", needsWrite: saved !== JSON.stringify(value), canPersist: true, acknowledgedRaw: saved };
}
