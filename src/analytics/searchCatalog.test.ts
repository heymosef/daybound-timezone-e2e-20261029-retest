import { pickerCity } from "../utils/cityCatalog";
import { filteredFailedQuery, loadCityCatalog, recognizeCity, samplesUnknownWords } from "./searchCatalog";
import { projectSearchEvent } from "./searchEvents";

beforeAll(async () => { expect(await loadCityCatalog()).toBe(true); });
const id = "00000000-0000-4000-8000-000000000001";
const base = { search_id: id, attempt: 1, elapsed_ms: 700, query_length: 7, query_words: 1,
  available_results: 0, already_added_results: 0, recognition: "unrecognized", candidate_count: 0 };

it("recognizes a real city absent from the picker with country and timezone", () => {
  expect(recognizeCity("  UTRECHT ")).toMatchObject({ kind: "city", city: { id: 2745912, name: "Utrecht", country: "NL", timezone: "Europe/Amsterdam" } });
  expect(recognizeCity("Utrecht, Netherlands")).toMatchObject({ kind: "city", city: { id: 2745912 } });
});
it("does not invent a country for ambiguous city names; supports qualified and ASCII names", () => {
  expect(recognizeCity("Amsterdam")).toMatchObject({ kind: "ambiguous" });
  expect(recognizeCity("Amsterdam, NL")).toMatchObject({ kind: "city", city: { country: "NL" } });
  expect(recognizeCity("Springfield")).toMatchObject({ kind: "ambiguous" });
  expect(recognizeCity("Sao Paulo, Brazil")).toMatchObject({ kind: "city", city: { country: "BR" } });
  expect(recognizeCity("NotARealCityzz")).toEqual({ kind: "unrecognized", candidates: 0 });
});
it.each(["a@b.com", "https://example.com", "Jane Doe 123", "PRIVATE_BROWSER_SEARCH_7291", "secret Paris",
  "Paris\nFrance", "Paris\u202e", "A".repeat(81), "one two three four five six", "a", "90210", "New/York"])("rejects suspicious or oversized text as a whole: %s", value => {
  expect(filteredFailedQuery(value)).toBeUndefined();
});
it("retains useful unknown city-like words with case/space normalization", () => {
  expect(filteredFailedQuery(" Vancuver ")).toBe("vancuver");
  expect(filteredFailedQuery("St.  John's")).toBe("st. john's");
  expect(filteredFailedQuery("São José")).toBe("são josé");
});
it("samples consistently by random journey, not by the searched words", () => {
  expect(samplesUnknownWords(id)).toBe(true);
  expect(samplesUnknownWords("00000001-0000-4000-8000-000000000001")).toBe(false);
  expect(samplesUnknownWords("private label")).toBe(false);
});
it("projects known city values and strips arbitrary labels/metadata", () => {
  const p = projectSearchEvent("timezone_search_attempted", { ...base, recognition: "city", candidate_count: 1,
    requested_city_id: 2745912, requested_city: "PRIVATE_LABEL", label: "PRIVATE_LABEL", $current_url: "PRIVATE_URL", filtered_query: "private words" });
  expect(p).toMatchObject({ requested_city: "Utrecht", requested_country: "NL", missing_city: true });
  expect(JSON.stringify(p)).not.toContain("PRIVATE");
  expect(p).not.toHaveProperty("filtered_query");
});
it("does not call already-added results missing cities", () => {
  expect(projectSearchEvent("timezone_search_attempted", { ...base, recognition: "city", candidate_count: 1,
    requested_city_id: 2745912, already_added_results: 1 })).toMatchObject({ no_results: false, missing_city: false });
});
it("separates a missing city from a supported city whose qualified search did not match", () => {
  expect(projectSearchEvent("timezone_search_attempted", { ...base, recognition: "city", candidate_count: 1,
    requested_city_id: 2759794 })).toMatchObject({ requested_city: "Amsterdam", city_in_picker: true,
    missing_city: false, search_match_failure: true });
});
it("shows a known ambiguous city name without guessing its country", () => {
  const p = projectSearchEvent("timezone_search_attempted", { ...base, recognition: "ambiguous", candidate_count: 2, ambiguous_city: "Amsterdam" });
  expect(p).toMatchObject({ requested_city: "Amsterdam", missing_city: false });
  expect(p).not.toHaveProperty("requested_country");
  expect(p).not.toHaveProperty("requested_city_id");
});
it("limits text to eligible failed samples, revalidating at the transport boundary", () => {
  const p = { ...base, filtered_query: "vancuver", sample_index: 1 };
  expect(projectSearchEvent("timezone_search_attempted", p)).toMatchObject({ filtered_query: "vancuver" });
  for (const override of [{ available_results: 1 }, { already_added_results: 1 }, { sample_index: 4 },
    { search_id: "00000001-0000-4000-8000-000000000001" }, { filtered_query: "email@example.com" }, { recognition: "unavailable" }]) {
    expect(projectSearchEvent("timezone_search_attempted", { ...p, ...override })).not.toHaveProperty("filtered_query");
  }
});
it("projects selections only from actual picker values, ignoring editable names", () => {
  expect(pickerCity("Europe/Amsterdam|Amsterdam")).toBeDefined();
  expect(projectSearchEvent("timezone_search_selected", { search_id: id, attempt: 2, elapsed_ms: 1000,
    selected_result_id: "Europe/Amsterdam|Amsterdam", selected_city: "PRIVATE_NAME", label: "PRIVATE_NAME" })).toMatchObject({ selected_city: "Amsterdam", selected_city_id: 2759794, selected_timezone: "Europe/Amsterdam" });
  expect(projectSearchEvent("timezone_search_selected", { search_id: id, attempt: 1, elapsed_ms: 0,
    selected_result_id: "Europe/Amsterdam|PRIVATE_NAME" })).toBeUndefined();
  expect(projectSearchEvent("timezone_search_selected", { search_id: id, attempt: 1, elapsed_ms: 0,
    selected_result_id: "Europe/London|London" })).toMatchObject({ selected_city_id: 2643743 });
});
it.each([{ search_id: "not-an-id" }, { attempt: 0 }, { attempt: 101 }, { elapsed_ms: -1 },
  { available_results: 51 }, { recognition: "city", requested_city_id: -123 }, { recognition: "ambiguous", candidate_count: 1 }])("drops invalid event shapes", override => {
  expect(projectSearchEvent("timezone_search_attempted", { ...base, ...override })).toBeUndefined();
});
