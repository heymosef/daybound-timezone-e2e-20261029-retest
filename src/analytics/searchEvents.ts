import { pickerCity } from "../utils/cityCatalog";
import { catalogCity, filteredFailedQuery, isSearchId, pickerHasCity, recognizeCity, samplesUnknownWords } from "./searchCatalog";

export interface SearchAttemptEvent {
  search_id: string;
  attempt: number;
  elapsed_ms: number;
  query_length: number;
  query_words: number;
  available_results: number;
  already_added_results: number;
  recognition: "city" | "ambiguous" | "unrecognized" | "unavailable";
  candidate_count: number;
  requested_city_id?: number;
  ambiguous_city?: string;
  filtered_query?: string;
  sample_index?: number;
}
export interface SearchSelectedEvent {
  search_id: string;
  attempt: number;
  elapsed_ms: number;
  selected_result_id: string;
}
export interface SearchClosedEvent {
  search_id: string;
  attempt: number;
  elapsed_ms: number;
  method: "outside_click" | "escape" | "focus_left";
}
const integer = (value: unknown, max: number, min = 0): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

/** Public city values are rebuilt from the catalogue/picker, never copied from supplied text. */
export function projectSearchEvent(event: string, p: Record<string, unknown>): Record<string, string | number | boolean> | undefined {
  if (!isSearchId(p.search_id) || !integer(p.attempt, 100, 1) || !integer(p.elapsed_ms, 1_800_000)) return;
  const base = { search_id: p.search_id, attempt: p.attempt, elapsed_ms: p.elapsed_ms, search_version: 2 };
  if (event === "timezone_search_selected") {
    const selected = typeof p.selected_result_id === "string" ? pickerCity(p.selected_result_id) : undefined;
    if (!selected) return;
    const recognized = recognizeCity(`${selected.name}, ${selected.country}`);
    return { ...base, selected_result_id: selected.id, selected_city: selected.name,
      selected_timezone: selected.timezone, selected_country: selected.country,
      ...(recognized.kind === "city" ? { selected_city_id: recognized.city.id } : {}) };
  }
  if (event === "timezone_search_closed") {
    if (!["outside_click", "escape", "focus_left"].includes(String(p.method))) return;
    return { ...base, method: String(p.method) };
  }
  if (event !== "timezone_search_attempted" || !integer(p.query_length, 1000, 1) || !integer(p.query_words, 100, 1) ||
    !integer(p.available_results, 50) || !integer(p.already_added_results, 1000) || !integer(p.candidate_count, 1000) ||
    !["city", "ambiguous", "unrecognized", "unavailable"].includes(String(p.recognition))) return;
  const city = p.recognition === "city" && typeof p.requested_city_id === "number" ? catalogCity(p.requested_city_id) : undefined;
  if (p.recognition === "city" && (!city || p.candidate_count !== 1)) return;
  if (p.recognition === "ambiguous" && p.candidate_count < 2) return;
  if (["unrecognized", "unavailable"].includes(String(p.recognition)) && p.candidate_count !== 0) return;
  const noResults = p.available_results === 0 && p.already_added_results === 0;
  const inPicker = city ? pickerHasCity(city) : false;
  const ambiguous = p.recognition === "ambiguous" && typeof p.ambiguous_city === "string" ? recognizeCity(p.ambiguous_city) : undefined;
  const filtered = noResults && p.recognition === "unrecognized" &&
    samplesUnknownWords(base.search_id) && integer(p.sample_index, 3, 1) ? filteredFailedQuery(p.filtered_query) : undefined;
  return { ...base, query_length: p.query_length, query_words: p.query_words,
    available_results: p.available_results, already_added_results: p.already_added_results,
    no_results: noResults, recognition: String(p.recognition), candidate_count: p.candidate_count,
    follow_up: p.attempt > 1, missing_city: noResults && !!city && !inPicker,
    search_match_failure: noResults && !!city && inPicker,
    ...(city ? { requested_city_id: city.id, requested_city: city.name, requested_country: city.country,
      requested_region: city.region, requested_timezone: city.timezone, city_in_picker: inPicker } : {}),
    ...(ambiguous?.kind === "ambiguous" ? { requested_city: ambiguous.name } : {}),
    ...(filtered ? { filtered_query: filtered, sample_index: p.sample_index as number } : {}) };
}
