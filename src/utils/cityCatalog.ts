import { CITY_ALIASES, getCommonTimezones, getCountryFromTimezone, type SearchResult } from "./timezoneUtils";

export interface PickerCity { id: string; name: string; timezone: string; country: string }
interface PickerEntry extends PickerCity { isAlias: boolean; searchText: string }
export const pickerResultId = (timezone: string, name: string) => `${timezone}|${name}`;
let cached: { entries: PickerEntry[]; cities: Map<string, PickerCity> } | undefined;

function catalogue() {
  if (!cached) {
    const entries: PickerEntry[] = [];
    const cities = new Map<string, PickerCity>();
    const add = (timezone: string, name: string, country: string, isAlias: boolean) => {
      const city = { id: pickerResultId(timezone, name), name, timezone, country };
      entries.push({ ...city, isAlias, searchText: isAlias ? name : timezone });
      // Metadata historically prefers the alias country spelling on a shared ID.
      cities.set(city.id, city);
    };
    for (const timezone of getCommonTimezones()) {
      add(timezone, timezone.split("/").pop()!.replace(/_/g, " "), getCountryFromTimezone(timezone), false);
    }
    for (const [name, info] of Object.entries(CITY_ALIASES)) add(info.timezone, name, info.country, true);
    cached = { entries, cities };
  }
  return cached;
}

export const pickerCity = (id: string) => catalogue().cities.get(id);
export const getPickerCities = () => catalogue().cities.values();

// Picker matching deliberately differs from broader analytics recognition:
// only case and underscores/spaces are normalized here; do not fold accents.
const normalize = (value: string) => value.toLowerCase().replace(/_/g, " ");
export function searchPicker(query: string, existingTimezones: ReadonlySet<string>) {
  const normalized = normalize(query).trim();
  const available: SearchResult[] = [];
  const alreadyAdded: SearchResult[] = [];
  if (!normalized) return { availableResults: available, alreadyAddedResults: alreadyAdded };
  const seen = new Set<string>();
  for (const entry of catalogue().entries) {
    if (!normalize(entry.searchText).includes(normalized) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const result = { timezone: entry.timezone, displayCity: entry.name, iana: entry.timezone, isAlias: entry.isAlias };
    // Search results historically prefer the direct IANA entry on a shared ID.
    (existingTimezones.has(entry.timezone) ? alreadyAdded : available).push(result);
  }
  return { availableResults: available.slice(0, 50), alreadyAddedResults: alreadyAdded };
}
