import { utcOffsetLabel } from "./formatOffset";
import { Instant, ZoneId, ZoneRulesProvider, type ZoneRules } from "@js-joda/core";
import "@js-joda/timezone/dist/js-joda-timezone-empty.esm.js";
import metadata from "./timezoneAliases.json";
import packedRules from "./timezoneRules.json";

// Load reviewed rules independently of the provider's npm release cadence.
// The empty bundle avoids also shipping its older database. See docs/timezone-data.md.
const provider = ZoneRulesProvider as typeof ZoneRulesProvider & {
  loadTzdbData(data: typeof packedRules): void;
  getTzdbData(): typeof packedRules;
};
provider.loadTzdbData(packedRules);

// Full published IANA history, bundled with the application, independent of device rules.
export const TIMEZONE_DATA_VERSION = provider.getTzdbData().version;
const zones = metadata.aliases as Record<string, string>;
const zoneNames = metadata.names;
const spelling = new Map(zoneNames.map(name => [name.toLowerCase(), name]));
const canonicalNames = new Map<string, string>();
for (const name of zoneNames) {
  let canonical = name;
  const visited = new Set<string>();
  while (typeof zones[canonical] === "string" && !visited.has(canonical)) {
    visited.add(canonical);
    canonical = zones[canonical];
  }
  canonicalNames.set(name, canonical);
}

/** Includes backwards-compatible aliases, independently of the browser's installed database. */
export function canonicalTimezone(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 100) return;
  const name = spelling.get(value.toLowerCase());
  if (!name) return;
  const canonical = canonicalNames.get(name)!;
  return canonical === "Etc/UTC" || canonical === "Etc/GMT" ? "UTC" : canonical;
}
// Keep geographic link names (for example Kampala) searchable, not just their rule-sharing targets.
const commonNames = ["UTC", ...zoneNames.filter(name => /^(Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)\//.test(name)).sort()];
export const getTimezoneNames = () => commonNames;

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Official naming announcement: https://news.gov.bc.ca/releases/2026CITZ0009-001073
const PCT_NAMED_FROM = Date.parse("2026-09-17T07:00:00Z");

const rulesByZone = new Map<string, ZoneRules>();
// The pinned js-joda provider retains the published IANA abbreviations here.
// Offset calculations use its public API. Contract tests protect this small display adapter.
function abbreviationAt(rules: ZoneRules, epoch: number, offset: number): string {
  const info = (rules as ZoneRules & { _tzdbInfo?: { untils: number[]; abbrs: string[] } })._tzdbInfo;
  if (!info) return utcOffsetLabel(offset);
  let low = 0, high = info.untils.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (epoch < info.untils[middle]) high = middle;
    else low = middle + 1;
  }
  return info.abbrs[low] ?? utcOffsetLabel(offset);
}

export function bundledZonedFields(epoch: number, timezone: string) {
  const canonical = canonicalTimezone(timezone);
  if (!canonical || !Number.isFinite(epoch)) throw new RangeError("Invalid timezone or instant");
  let rules = rulesByZone.get(canonical);
  if (!rules) { rules = ZoneId.of(canonical).rules(); rulesByZone.set(canonical, rules); }
  const offsetSeconds = rules.offset(Instant.ofEpochMilli(epoch)).totalSeconds();
  const local = new Date(epoch + offsetSeconds * 1000);
  if (Number.isNaN(local.getTime())) throw new RangeError("Invalid instant");
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const rawAbbreviation = canonical === "UTC" ? "UTC" : abbreviationAt(rules, epoch, offsetSeconds);
  const abbreviation = canonical === "America/Vancouver" && epoch >= PCT_NAMED_FROM ? "PCT" :
    /^[+-]/.test(rawAbbreviation) ? utcOffsetLabel(offsetSeconds) : rawAbbreviation;
  return {
    date: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    year, month, day, hour: local.getUTCHours(), minute: local.getUTCMinutes(), second: local.getUTCSeconds(),
    weekday: weekdays[local.getUTCDay()], abbreviation, offsetSeconds,
  };
}
