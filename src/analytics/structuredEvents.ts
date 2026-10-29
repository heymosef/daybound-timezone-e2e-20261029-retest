import { canonicalTimezone } from "../utils/bundledTimezones";
import type { AppSettings } from "../utils/timezoneUtils";
import { pickerCity } from "../utils/cityCatalog";

export type SettingsChangedEvent =
  | { setting: "time_format"; value: "12h" | "24h" }
  | { setting: "appearance"; value: AppSettings["theme"] }
  | { setting: "design_theme"; value: AppSettings["designTheme"] }
  | { setting: "timezone_badge" | "weekend_indicator"; value: boolean };

export interface HomeTimezoneChangedEvent {
  reference_timezone: string;
  reference_result_id?: string;
}

/** Called only by the explicit settings action, never by restoration or effects. */
export function settingsChanges(previous: AppSettings, next: AppSettings): SettingsChangedEvent[] {
  const events: SettingsChangedEvent[] = [];
  if (previous.use24Hour !== next.use24Hour) events.push({ setting: "time_format", value: next.use24Hour ? "24h" : "12h" });
  if (previous.theme !== next.theme) events.push({ setting: "appearance", value: next.theme });
  if (previous.designTheme !== next.designTheme) events.push({ setting: "design_theme", value: next.designTheme });
  if (previous.showBadge !== next.showBadge) events.push({ setting: "timezone_badge", value: next.showBadge });
  if (previous.showWeekends !== next.showWeekends) events.push({ setting: "weekend_indicator", value: next.showWeekends });
  return events;
}

export function projectSettingsChange(p: Record<string, unknown>) {
  if (typeof p.setting !== "string") return;
  const valid = (typeof p.value === "string" && (
    (p.setting === "time_format" && ["12h", "24h"].includes(p.value)) ||
    (p.setting === "appearance" && ["light", "dark", "system"].includes(p.value)) ||
    (p.setting === "design_theme" && ["te-1", "gamut", "dos"].includes(p.value)))) ||
    (["timezone_badge", "weekend_indicator"].includes(p.setting) && typeof p.value === "boolean");
  if (!valid || (typeof p.value !== "string" && typeof p.value !== "boolean")) return;
  return { setting: p.setting, value: p.value };
}

/** Rebuild public fields from validated IANA/picker data; never use row labels/country. */
export function projectHomeChange(p: Record<string, unknown>): Record<string, string> | undefined {
  const timezone = canonicalTimezone(p.reference_timezone);
  if (!timezone) return;
  if (p.reference_result_id === undefined) return { reference_timezone: timezone };
  const city = typeof p.reference_result_id === "string" ? pickerCity(p.reference_result_id) : undefined;
  if (!city || canonicalTimezone(city.timezone) !== timezone) return;
  return { reference_timezone: timezone, reference_result_id: city.id,
    reference_city: city.name, reference_country: city.country };
}
