import { pickerResultId } from "../utils/cityCatalog";
import type { AnalyticsController } from "./analytics";
import { filteredFailedQuery, loadCityCatalog, normalizeSearch, recognizeCity, samplesUnknownWords } from "./searchCatalog";
import type { SearchClosedEvent } from "./searchEvents";
import type { SearchResult } from "../utils/timezoneUtils";

export interface SearchSnapshot { query: string; available: number; alreadyAdded: number }
interface Journey { id: string; attempt: number; started: number; key: string; samples: number }

/** One temporary in-memory journey per open search. No disk, retry, unload or identity persistence. */
export class SearchJourney {
  private enabled = false;
  private generation = 0;
  private current: Journey | undefined;
  private closed = true;
  private suppressedKey: string | undefined;
  private chain = Promise.resolve();
  constructor(private capture: AnalyticsController["capture"],
    private load = loadCityCatalog, private clock = Date.now, private uuid: () => string = () => crypto.randomUUID()) {}

  setEnabled(enabled: boolean, existingQuery?: string) {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.generation++;
    this.current = undefined;
    this.suppressedKey = enabled && existingQuery ? normalizeSearch(existingQuery) : undefined;
  }
  open() {
    this.closed = false;
  }
  dispose() { this.setEnabled(false); this.closed = true; }
  private enqueue(work: () => void, query?: string) {
    const generation = this.generation;
    this.chain = this.chain.then(async () => {
      if (!this.enabled || generation !== this.generation) return;
      if (query !== undefined) await this.load(query);
      if (this.enabled && generation === this.generation) work();
    }).catch(() => { /* Missing catalogue/telemetry never breaks search. */ });
  }
  private elapsed(journey: Journey) { return Math.max(0, Math.min(1_800_000, Math.round(this.clock() - journey.started))); }
  attempt(snapshot: SearchSnapshot) {
    const query = snapshot.query.trim();
    if (!this.enabled || this.closed || !query || query.length > 1000 || query.split(/\s+/).length > 100) return;
    const now = this.clock();
    const normalized = normalizeSearch(query);
    if (normalized === this.suppressedKey) return;
    this.suppressedKey = undefined;
    const key = `${normalized}|${snapshot.available}|${snapshot.alreadyAdded}`;
    if (!this.current || now - this.current.started > 1_800_000 ||
      (this.current.attempt >= 100 && this.current.key !== key)) {
      this.current = { id: this.uuid(), attempt: 0, started: now, key: "", samples: 0 };
    }
    const journey = this.current;
    if (journey.key === key) return journey;
    journey.key = key;
    const attempt = ++journey.attempt;
    const elapsed = this.elapsed(journey);
    this.enqueue(() => {
      const recognized = recognizeCity(query);
      const noResults = snapshot.available === 0 && snapshot.alreadyAdded === 0;
      const filtered = noResults && recognized.kind === "unrecognized" &&
        samplesUnknownWords(journey.id) && journey.samples < 3 ? filteredFailedQuery(query) : undefined;
      if (filtered) journey.samples++;
      this.capture("timezone_search_attempted", {
        search_id: journey.id, attempt, elapsed_ms: elapsed, query_length: query.length,
        query_words: query.split(/\s+/).length, available_results: Math.min(50, snapshot.available),
        already_added_results: Math.min(1000, snapshot.alreadyAdded), recognition: recognized.kind,
        candidate_count: Math.min(1000, recognized.candidates),
        ...(recognized.kind === "city" ? { requested_city_id: recognized.city.id } : {}),
        ...(recognized.kind === "ambiguous" ? { ambiguous_city: recognized.name } : {}),
        ...(filtered ? { filtered_query: filtered, sample_index: journey.samples } : {}),
      });
      // Preserve existing aggregate no-result charts; no text is added to this legacy event.
      if (noResults) this.capture("timezone_search_no_results", { query_length: query.length, query_words: query.split(/\s+/).length });
    }, query);
    return journey;
  }
  select(snapshot: SearchSnapshot, result: SearchResult) {
    const journey = this.attempt(snapshot);
    if (journey) {
      const attempt = journey.attempt;
      const elapsed = this.elapsed(journey);
      const resultId = pickerResultId(result.timezone, result.displayCity);
      this.enqueue(() => this.capture("timezone_search_selected", { search_id: journey.id, attempt,
        elapsed_ms: elapsed, selected_result_id: resultId }), result.displayCity);
    }
    this.current = undefined;
    this.closed = true;
  }
  close(snapshot: SearchSnapshot, method: SearchClosedEvent["method"]) {
    if (this.closed) return;
    const journey = this.attempt(snapshot) ?? this.current;
    if (journey && this.enabled) {
      const attempt = journey.attempt;
      const elapsed = this.elapsed(journey);
      this.enqueue(() => this.capture("timezone_search_closed", { search_id: journey.id, attempt, elapsed_ms: elapsed, method }));
    }
    this.current = undefined;
    this.closed = true;
  }
  /** Allows deterministic verification without polling timers/network. */
  settled() { return this.chain; }
}
