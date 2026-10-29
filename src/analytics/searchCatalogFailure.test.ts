import { loadCityCatalog, recognizeCity } from "./searchCatalog";
import { SearchJourney } from "./searchJourney";
import type { AnalyticsController } from "./analytics";

vi.mock("./data/cities/u.json", () => { throw new Error("Static catalogue unavailable"); });

it("records unavailable classification without sending words when the static catalogue fails", async () => {
  expect(await loadCityCatalog()).toBe(false);
  expect(recognizeCity("Utrecht")).toEqual({ kind: "unavailable", candidates: 0 });
  const capture = vi.fn<(event: string, properties?: unknown) => void>();
  const record: AnalyticsController["capture"] = (event, ...args) => capture(event, args[0]);
  const journey = new SearchJourney(record, loadCityCatalog, () => 0, () => "00000000-0000-4000-8000-000000000001");
  journey.setEnabled(true); journey.open();
  journey.attempt({ query: "utrectzzz", available: 0, alreadyAdded: 0 });
  await journey.settled();
  expect(capture.mock.calls[0]).toEqual(["timezone_search_attempted", expect.objectContaining({ recognition: "unavailable", candidate_count: 0 })]);
  expect(JSON.stringify(capture.mock.calls)).not.toContain("filtered_query");
  expect(JSON.stringify(capture.mock.calls)).not.toContain("utrectzzz");
});
