import { SearchJourney } from "./searchJourney";
import { loadCityCatalog } from "./searchCatalog";
import type { AnalyticsController } from "./analytics";

beforeAll(async () => { await loadCityCatalog(); });
const sampled = "00000000-0000-4000-8000-000000000001";
const snapshot = (query: string, available = 0, alreadyAdded = 0) => ({ query, available, alreadyAdded });
const selected = { timezone: "Europe/Amsterdam", displayCity: "Amsterdam", iana: "Europe/Amsterdam", isAlias: false };
function setup(id = sampled, load = loadCityCatalog) {
  const capture = vi.fn<(event: string, properties?: unknown) => void>();
  const record: AnalyticsController["capture"] = (event, ...args) => capture(event, args[0]);
  let now = 0;
  const tracker = new SearchJourney(record, load, () => now, () => id);
  tracker.setEnabled(true); tracker.open();
  return { tracker, capture, advance: (n: number) => { now += n; } };
}
it("links missing city, follow-up search and the actual selected result in order", async () => {
  const { tracker, capture, advance } = setup();
  tracker.attempt(snapshot("Utrecht")); advance(1000);
  tracker.attempt(snapshot("Amsterdam", 1)); advance(500);
  tracker.select(snapshot("Amsterdam", 1), selected);
  await tracker.settled();
  expect(capture.mock.calls.map(call => call[0])).toEqual(["timezone_search_attempted", "timezone_search_no_results", "timezone_search_attempted", "timezone_search_selected"]);
  const attempts = capture.mock.calls.filter(call => call[0] === "timezone_search_attempted");
  expect(attempts[0][1]).toMatchObject({ search_id: sampled, attempt: 1, requested_city_id: 2745912 });
  expect(attempts[1][1]).toMatchObject({ search_id: sampled, attempt: 2, elapsed_ms: 1000 });
  expect(capture.mock.calls.at(-1)?.[1]).toMatchObject({ search_id: sampled, attempt: 2, selected_result_id: "Europe/Amsterdam|Amsterdam" });
});
it("deduplicates the settled query and immediately records a fast selection", async () => {
  const { tracker, capture } = setup();
  tracker.attempt(snapshot(" Amsterdam ", 1)); tracker.attempt(snapshot("AMSTERDAM", 1));
  tracker.select(snapshot("Amsterdam", 1), selected);
  await tracker.settled();
  expect(capture.mock.calls.map(call => call[0])).toEqual(["timezone_search_attempted", "timezone_search_selected"]);
});
it("samples at most three filtered failed terms per eligible journey", async () => {
  const { tracker, capture } = setup();
  for (const query of ["vancuver", "utrechtzzz", "parisss", "londonnn"]) tracker.attempt(snapshot(query));
  await tracker.settled();
  const props = capture.mock.calls.filter(call => call[0] === "timezone_search_attempted").map(call => call[1]);
  expect(props.filter(p => typeof p === "object" && p !== null && "filtered_query" in p)).toHaveLength(3);
});
it("does not sample text for unsampled journeys or results already present", async () => {
  const { tracker, capture } = setup("00000001-0000-4000-8000-000000000001");
  tracker.attempt(snapshot("vancuver")); tracker.attempt(snapshot("missingwordzzz", 0, 1)); await tracker.settled();
  expect(JSON.stringify(capture.mock.calls)).not.toContain("filtered_query");
  expect(capture.mock.calls.filter(call => call[0] === "timezone_search_no_results")).toHaveLength(1);
});
it("records close exactly once and never claims that a close proves failure", async () => {
  const { tracker, capture } = setup();
  tracker.close(snapshot("Utrecht"), "escape"); tracker.close(snapshot("Utrecht"), "focus_left"); await tracker.settled();
  expect(capture.mock.calls.filter(call => call[0] === "timezone_search_closed")).toEqual([["timezone_search_closed", expect.objectContaining({ method: "escape", attempt: 1 })]]);
});
it("drops pending classification on opt-out and never replays it on opt-in", async () => {
  let release!: (ready: boolean) => void;
  const loaded = new Promise<boolean>(resolve => { release = resolve; });
  const { tracker, capture } = setup(sampled, () => loaded);
  tracker.attempt(snapshot("vancuver")); tracker.setEnabled(false); tracker.setEnabled(true, "vancuver");
  release(true); await tracker.settled();
  tracker.open(); tracker.attempt(snapshot("vancuver")); await tracker.settled();
  expect(capture).not.toHaveBeenCalled();
  tracker.attempt(snapshot("Utrecht")); await tracker.settled();
  expect(capture.mock.calls[0][0]).toBe("timezone_search_attempted");
});
it("does not send delayed work after unmount/disposal", async () => {
  const { tracker, capture } = setup(); tracker.attempt(snapshot("Utrecht")); tracker.dispose();
  await tracker.settled(); expect(capture).not.toHaveBeenCalled();
});
