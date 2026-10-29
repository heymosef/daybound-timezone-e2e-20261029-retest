import { getPickerCities } from "../utils/cityCatalog";

export interface CatalogCity { id: number; name: string; country: string; timezone: string; region: string }
export type Recognition = { kind: "city"; city: CatalogCity; candidates: number } |
  { kind: "ambiguous"; name: string; candidates: number } |
  { kind: "unrecognized" | "unavailable"; candidates: number };
export const normalizeSearch = (value: string): string => value.normalize("NFKD")
  .replace(/\p{M}/gu, "").toLocaleLowerCase("en").replace(/_/g, " ").trim().replace(/\s+/g, " ");

const cities = new Map<number, CatalogCity>();
const names = new Map<string, CatalogCity[]>();
const countryNames = new Map<string, string>([["uk", "GB"], ["u.k.", "GB"], ["usa", "US"],
  ["u.s.", "US"], ["turkey", "TR"], ["south korea", "KR"], ["north korea", "KP"], ["russia", "RU"]]);
type CityRow = [number, string, string, string, string, string];
const loaders = import.meta.glob<{ default: CityRow[] }>("./data/cities/*.json");
const ready = new Set<string>();
const loading = new Map<string, Promise<boolean>>();
const shardFor = (query: string) => /^[a-z]/.test(normalizeSearch(query)) ? normalizeSearch(query)[0] : "other";

/** Lazy, same-origin static data. No search text goes to a geocoding service. */
export function loadCityCatalog(query?: string): Promise<boolean> {
  return query === undefined ? Promise.all(Object.keys(loaders).map(key => loadShard(key.split("/").pop()!.replace(".json", "")))).then(values => values.every(Boolean)) : loadShard(shardFor(query));
}

function loadShard(shard: string): Promise<boolean> {
  const pending = loading.get(shard);
  if (pending) return pending;
  const load = loaders[`./data/cities/${shard}.json`];
  if (!load) return Promise.resolve(false);
  const result = load().then(({ default: rows }) => {
    const countries = new Intl.DisplayNames(["en"], { type: "region" });
    for (const [id, name, country, timezone, region, ascii] of rows) {
      if (cities.has(id)) continue;
      const city = { id, name, country, timezone, region };
      cities.set(id, city);
      if (!countryNames.has(country.toLowerCase())) {
        countryNames.set(country.toLowerCase(), country);
        countryNames.set(normalizeSearch(countries.of(country) ?? country), country);
      }
      for (const alias of new Set([name, ascii].filter(Boolean).map(normalizeSearch))) {
        const matches = names.get(alias) ?? [];
        matches.push(city);
        names.set(alias, matches);
      }
    }
    ready.add(shard);
    return true;
  }).catch(() => false);
  loading.set(shard, result);
  return result;
}

export function recognizeCity(query: string): Recognition {
  if (!ready.has(shardFor(query))) return { kind: "unavailable", candidates: 0 };
  const key = normalizeSearch(query);
  const comma = key.lastIndexOf(",");
  const country = comma >= 0 ? countryNames.get(key.slice(comma + 1).trim()) : undefined;
  const matches = country ? names.get(key.slice(0, comma).trim())?.filter(city => city.country === country) : names.get(key);
  if (!matches?.length) return { kind: "unrecognized", candidates: 0 };
  if (matches.length !== 1) return { kind: "ambiguous", name: matches[0].name, candidates: matches.length };
  return { kind: "city", city: matches[0], candidates: 1 };
}
export const catalogCity = (id: number) => cities.get(id);

export function pickerHasCity(city: CatalogCity): boolean {
  const name = normalizeSearch(city.name);
  for (const result of getPickerCities()) {
    if (normalizeSearch(result.name) === name && result.timezone === city.timezone) return true;
  }
  return false;
}

/** Reject entire suspicious inputs before normalization; never turn an email into a name. */
export function filteredFailedQuery(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length > 80 ||
    /[\p{N}\p{C}@/_=<>\\:]/u.test(raw) || /https?|www\.|\.(?:com|net|org)\b|password|secret|token|bearer|api\s*key/i.test(raw)) return;
  const value = raw.normalize("NFKC").toLocaleLowerCase("en").trim().replace(/\s+/g, " ");
  if (value.length < 3 || value.length > 64 || value.split(" ").length > 5 ||
    !/^[\p{L}\p{M}][\p{L}\p{M} .,'’-]*$/u.test(value)) return;
  return value;
}

export const isSearchId = (value: unknown): value is string => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
/** Approximately 10% of random search journeys; stable across that journey's attempts. */
export const samplesUnknownWords = (id: string) => isSearchId(id) && parseInt(id.slice(0, 8), 16) % 10 === 0;
