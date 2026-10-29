import { getPickerCities, pickerCity, pickerResultId, searchPicker } from "./cityCatalog";
import { getCommonTimezones } from "./timezoneUtils";

it("deduplicates direct/alias results while preserving alias metadata and stable IDs", () => {
  expect(searchPicker("London", new Set())).toEqual({ availableResults: [
    { timezone: "Europe/London", displayCity: "London", iana: "Europe/London", isAlias: false },
  ], alreadyAddedResults: [] });
  expect(pickerCity("Europe/London|London")).toEqual({ id: "Europe/London|London", name: "London", timezone: "Europe/London", country: "UK" });
  expect(pickerResultId("America/Los_Angeles", "Seattle")).toBe("America/Los_Angeles|Seattle");
  expect(pickerCity("America/Los_Angeles|Seattle")).toMatchObject({ name: "Seattle", country: "USA" });
  const cities = [...getPickerCities()];
  expect(new Set(cities.map(city => city.id)).size).toBe(cities.length);
  expect(pickerCity("Europe/London|Private label")).toBeUndefined();
});

it("retains picker matching rules instead of adopting analytics accent/country normalization", () => {
  expect(searchPicker("  NEW_YORK  ", new Set()).availableResults).toEqual([
    { timezone: "America/New_York", displayCity: "New York", iana: "America/New_York", isAlias: false },
  ]);
  expect(searchPicker("Seattle", new Set()).availableResults).toEqual([
    { timezone: "America/Los_Angeles", displayCity: "Seattle", iana: "America/Los_Angeles", isAlias: true },
  ]);
  for (const query of ["", "   ", "São Paulo", "Amsterdam, NL", "Utrecht"]) {
    expect(searchPicker(query, new Set())).toEqual({ availableResults: [], alreadyAddedResults: [] });
  }
});

it("keeps IANA entries before aliases, limits available results and retains all already-added matches", () => {
  const result = searchPicker("a", new Set());
  expect(result.availableResults).toHaveLength(50);
  expect(result.availableResults[0]).toMatchObject({ timezone: "Africa/Abidjan", isAlias: false });
  const existing = searchPicker("America", new Set(getCommonTimezones()));
  expect(existing.availableResults).toEqual([]);
  expect(existing.alreadyAddedResults.length).toBeGreaterThan(50);
  expect(searchPicker("Seattle", new Set(["America/Los_Angeles"]))).toEqual({ availableResults: [], alreadyAddedResults: [
    { timezone: "America/Los_Angeles", displayCity: "Seattle", iana: "America/Los_Angeles", isAlias: true },
  ] });
});
