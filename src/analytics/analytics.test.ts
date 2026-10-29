import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_PREFERENCE_KEY as KEY,
  createAnalytics,
  type AnalyticsController,
  type AnalyticsOptions,
} from "./analytics";

const TOKEN = "phc_offline_fake_public_token";
const HOST = "https://analytics.invalid";
const legacyConsent = `__ph_opt_in_out_${TOKEN}`;
const legacyIdentity = `ph_${TOKEN}_posthog`;
const privateText = "PRIVATE_LABEL_AND_QUERY_4d1790";
const saved = (enabled: boolean) => JSON.stringify({ version: 1, enabled });
const fetchMock = vi.fn<typeof fetch>();
let controllers: AnalyticsController[];

function make(options: AnalyticsOptions = {}, start = true) {
  const controller = createAnalytics({ token: TOKEN, host: HOST, production: true, hostname: "app.invalid", ...options });
  controllers.push(controller);
  if (start) controller.start();
  return controller;
}

function request(index = 0) {
  const [url, options] = fetchMock.mock.calls[index];
  return { url, options: options!, body: JSON.parse(options!.body as string) };
}

function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
    ...overrides,
  };
}

beforeEach(() => {
  controllers = [];
  localStorage.clear();
  sessionStorage.clear();
  for (const key of [legacyConsent, legacyIdentity]) document.cookie = `${key}=; Max-Age=0; Path=/`;
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("minimal HTTP event envelopes", () => {
  it("sends only the documented envelope and projected primitive fields through actual fetch", () => {
    const controller = make();
    controller.capture("timezone_added", {
      timezone_count_after: 3, label: privateText, url: `https://${privateText}.invalid`,
      $process_person_profile: true, $geoip_disable: false, nested: { query: privateText },
    } as { timezone_count_after: number });
    const { url, options, body } = request();
    expect(url).toBe(`${HOST}/i/v0/e/`);
    expect(body).toEqual({
      api_key: TOKEN, event: "timezone_added", distinct_id: expect.any(String),
      timestamp: expect.any(String),
      properties: { timezone_count_after: 3, $process_person_profile: false, $geoip_disable: true },
    });
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    expect(body.distinct_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(options).toEqual({
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: expect.any(AbortSignal),
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(privateText);
    expect(localStorage.getItem(KEY)).toBe(saved(true));
    expect(localStorage.getItem(KEY)).not.toContain(body.distinct_id);
  });

  it("projects every permitted event and drops all unexpected free text", () => {
    const c = make();
    const input = { label: privateText, query_sanitized: privateText, home_city: privateText, $current_url: privateText };
    c.capture("timezone_removed", { ...input, timezone_count_after: 2 });
    c.capture("timezone_reordered", { ...input, direction: "up" });
    c.capture("keyboard_shortcut_used", { ...input, shortcut: "cmd_k" });
    c.capture("timezone_search_no_results", { ...input, query_length: 24, query_words: 3 });
    c.capture("date_selected_strip", { ...input, date_offset: 2 });
    c.capture("date_selected_calendar", { ...input, date_offset: 31, month_distance: 1 });
    c.capture("calendar_closed", { ...input, method: "escape" });
    c.capture("calendar_month_navigated", { ...input, direction: "forward", months_from_today: 1 });
    // Exercise untyped callers too: no-property events must never forward their input.
    const rawCapture = c.capture as (event: string, properties?: unknown) => void;
    for (const name of ["timezone_renamed", "calendar_opened"]) rawCapture(name, input);
    rawCapture("home_timezone_changed", { ...input, reference_timezone: "US/Pacific" });
    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(fetchMock.mock.calls.map((_, i) => request(i).body.properties)).toEqual([
      { timezone_count_after: 2 }, { direction: "up" }, { shortcut: "cmd_k" },
      { query_length: 24, query_words: 3 }, { date_offset: 2 }, { date_offset: 31, month_distance: 1 },
      { method: "escape" }, { direction: "forward", months_from_today: 1 }, {}, {}, { reference_timezone: "America/Los_Angeles" },
    ].map((p) => ({ ...p, $process_person_profile: false, $geoip_disable: true })));
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(privateText);
  });

  it("rejects unknown events, invalid enums, nonfinite/fractional/unbounded numbers", () => {
    const rawCapture = make().capture as (event: string, properties?: unknown) => void;
    rawCapture("$pageview", { $current_url: privateText });
    rawCapture("timezone_reordered", { direction: privateText });
    rawCapture("calendar_closed", { method: privateText });
    rawCapture("timezone_added", { timezone_count_after: 101 });
    rawCapture("date_selected_strip", { date_offset: -3661 });
    rawCapture("date_selected_calendar", { date_offset: 4, month_distance: 121 });
    rawCapture("calendar_month_navigated", { direction: "forward", months_from_today: NaN });
    for (const value of [Infinity, 1.2, -1, "24", privateText]) {
      rawCapture("timezone_search_no_results", { query_length: value, query_words: 1 });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("has an ephemeral identity per controller and rotates after opt-out/disposal", () => {
    const c = make();
    c.capture("calendar_opened");
    c.capture("calendar_opened");
    expect(request(0).body.distinct_id).toBe(request(1).body.distinct_id);
    c.setEnabled(false);
    c.setEnabled(true);
    c.capture("calendar_opened");
    c.dispose(); c.start(); c.capture("calendar_opened");
    make().capture("calendar_opened");
    expect(new Set([0, 2, 3, 4].map((i) => request(i).body.distinct_id)).size).toBe(4);
  });
});

describe("bootstrap policy", () => {
  it.each([undefined, "", "http://analytics.invalid", "https://user:pass@analytics.invalid", "https://analytics.invalid/path",
    "https://analytics.invalid/?x=1", "https://analytics.invalid/#hash", "https://analytics.invalid/./",
    "https://analytics.invalid//", "https://analytics.invalid\\@other.invalid", "https://localhost", "https://127.0.0.1"])(
    "makes no requests with invalid host %s", (host) => {
      const c = make({ host }); c.capture("calendar_opened");
      expect(c.getSnapshot().available).toBe(false); expect(fetchMock).not.toHaveBeenCalled();
    });
  it.each([undefined, "", "secret_token", "phc_with space", "phc_"])("rejects invalid token %s", (token) => {
    make({ token }).capture("calendar_opened"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["localhost", "sub.localhost", "localhost.", "127.0.0.1", "127.42.10.20", "::1", "[::1]"])(
    "rejects loopback page %s even with saved opt-in", (hostname) => {
      localStorage.setItem(KEY, saved(true));
      make({ hostname }).capture("calendar_opened"); expect(fetchMock).not.toHaveBeenCalled();
    });
  it("rejects DEV/test regardless of hostname or saved opt-in", () => {
    localStorage.setItem(KEY, saved(true));
    make({ production: false }).capture("calendar_opened");
    const c = createAnalytics({ token: TOKEN, host: HOST, hostname: "app.invalid" });
    controllers.push(c); c.start(); c.capture("calendar_opened");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("respects browser DNT and rechecks it at dispatch", () => {
    let dnt = false;
    const c = make({ doNotTrack: () => dnt });
    dnt = true; c.capture("calendar_opened");
    expect(c.getSnapshot().enabled).toBe(false);
    vi.stubGlobal("navigator", { doNotTrack: "1" });
    make().capture("calendar_opened");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("never dispatches before start, and reload preserves opt-out before the first event", () => {
    const c = make({}, false); c.capture("calendar_opened");
    c.setEnabled(false); c.start(); c.capture("calendar_opened");
    c.dispose(); make().capture("calendar_opened");
    expect(fetchMock).not.toHaveBeenCalled(); expect(localStorage.getItem(KEY)).toBe(saved(false));
  });
  it.each(["broken", "true", "null", '{"version":2,"enabled":true}', '{"version":1,"enabled":"true"}',
    '{"version":1,"enabled":true,"private":"secret"}'])("fails closed on malformed preference %s", (value) => {
    localStorage.setItem(KEY, value);
    const c = make(); c.capture("calendar_opened");
    expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "unavailable" });
    expect(localStorage.getItem(KEY)).toBe(value); expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("storage failures and consent", () => {
  it.each([saved(false), "broken", null])("rechecks persisted consent before dispatch without waiting for a storage event: %s", (value) => {
    const c = make();
    if (value === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
    c.capture("calendar_opened");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: value === saved(false) ? "saved" : "unavailable" });
    localStorage.setItem(KEY, saved(true)); c.capture("calendar_opened");
    expect(fetchMock).not.toHaveBeenCalled(); // A later opt-in elsewhere cannot enable this tab.
  });
  it.each(["getter", "read"])("fails closed when the storage %s becomes blocked after bootstrap", (failure) => {
    let blocked = false;
    const store = fakeStorage();
    const read = store.getItem;
    store.getItem = (key) => {
      if (blocked && failure === "read") throw new Error("read blocked");
      return read(key);
    };
    const c = make({ storage: () => {
      if (blocked && failure === "getter") throw new Error("getter blocked");
      return store;
    } });
    expect(c.getSnapshot().enabled).toBe(true);
    blocked = true; c.capture("calendar_opened");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "unavailable" });
  });
  it("cancels already pending work when a dispatch detects revoked storage consent", () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const c = make(); c.capture("calendar_opened");
    localStorage.setItem(KEY, saved(false)); c.capture("calendar_opened");
    expect(request().options.signal!.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(["getter", "read", "write", "quota", "silently-dropped-write"])("fails closed when storage has a %s failure", (failure) => {
    const throwError = () => { throw new DOMException("Unavailable", failure === "quota" ? "QuotaExceededError" : "SecurityError"); };
    const store = fakeStorage({
      ...(failure === "read" ? { getItem: throwError } : {}),
      ...(["write", "quota"].includes(failure) ? { setItem: throwError } : {}),
      ...(failure === "silently-dropped-write" ? { setItem: () => {} } : {}),
    });
    const c = make({ storage: failure === "getter" ? throwError : () => store });
    c.capture("calendar_opened");
    expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("disables this visit on failed opt-out, reports failure, and requires opt-in persistence", () => {
    const c = make();
    const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota", "QuotaExceededError"); });
    c.setEnabled(false); c.capture("calendar_opened");
    expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "unavailable" });
    expect(localStorage.getItem(KEY)).toBe(saved(true)); // No false claim of durable success.
    c.setEnabled(true); c.capture("calendar_opened");
    expect(fetchMock).not.toHaveBeenCalled();
    writes.mockRestore(); c.setEnabled(true); c.capture("calendar_opened");
    expect(c.getSnapshot()).toMatchObject({ enabled: true, preferenceStatus: "saved" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("preserves failed opt-out across dispose/start after writes recover until explicit opt-in", () => {
    const c = make();
    const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("write blocked"); });
    c.setEnabled(false);
    expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "unavailable" });
    expect(localStorage.getItem(KEY)).toBe(saved(true));
    c.dispose(); c.start(); // A restart while writes are blocked must also stay unavailable/off.
    expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "unavailable" });
    writes.mockRestore();
    c.dispose(); c.start(); c.capture("calendar_opened");
    expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "saved" });
    expect(localStorage.getItem(KEY)).toBe(saved(false)); // Successful repair makes off durable.
    expect(fetchMock).not.toHaveBeenCalled();
    localStorage.setItem(KEY, saved(true)); c.dispose(); c.start(); c.capture("calendar_opened");
    expect(c.getSnapshot().enabled).toBe(false); // External consent cannot clear this visit's latch.
    expect(fetchMock).not.toHaveBeenCalled();
    c.setEnabled(true); c.capture("calendar_opened");
    expect(c.getSnapshot()).toMatchObject({ enabled: true, preferenceStatus: "saved" });
    expect(localStorage.getItem(KEY)).toBe(saved(true)); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(["stored-off", "malformed", "removed", "read-blocked", "cross-tab", "dnt"])(
    "preserves fail-closed %s denial across lifecycle restart and recovered external consent", (revocation) => {
      let dnt = false;
      const c = make({ doNotTrack: () => dnt });
      let readSpy: ReturnType<typeof vi.spyOn> | undefined;
      if (revocation === "stored-off") localStorage.setItem(KEY, saved(false));
      else if (revocation === "malformed") localStorage.setItem(KEY, "broken");
      else if (revocation === "removed") localStorage.removeItem(KEY);
      else if (revocation === "read-blocked") readSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("read blocked"); });
      else if (revocation === "cross-tab") window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: saved(false) }));
      else dnt = true;
      c.capture("calendar_opened");
      expect(c.getSnapshot().enabled).toBe(false);
      readSpy?.mockRestore(); dnt = false; localStorage.setItem(KEY, saved(true));
      c.dispose(); c.start(); c.capture("calendar_opened");
      expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "saved" });
      expect(localStorage.getItem(KEY)).toBe(saved(false)); expect(fetchMock).not.toHaveBeenCalled();
      c.setEnabled(true); c.capture("calendar_opened");
      expect(c.getSnapshot().enabled).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  it("honors cross-tab opt-out and malformed/cleared preference, never cross-tab opt-in", () => {
    const c = make();
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated", newValue: saved(false) }));
    expect(c.getSnapshot().enabled).toBe(true);
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: saved(false) }));
    c.capture("calendar_opened");
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: saved(true) }));
    c.capture("calendar_opened"); expect(fetchMock).not.toHaveBeenCalled();
    expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "saved" });
    c.setEnabled(true);
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: "broken" }));
    expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "unavailable" });
    c.setEnabled(true); window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "unavailable" });
  });
});

describe("legacy consent migration and narrowly scoped cleanup", () => {
  it.each(["0", "false", "no", '"0"', '"false"', '"no"'])("preserves legacy local opt-out %s", (value) => {
    localStorage.setItem(legacyConsent, value);
    const c = make(); c.capture("calendar_opened");
    expect(localStorage.getItem(KEY)).toBe(saved(false));
    expect(localStorage.getItem(legacyConsent)).toBeNull(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("preserves fallback cookie opt-out and removes only exact keys for this project", () => {
    document.cookie = `${legacyConsent}=0; Path=/`;
    document.cookie = `${legacyIdentity}=${encodeURIComponent(JSON.stringify({ label: privateText }))}; Path=/`;
    localStorage.setItem(legacyIdentity, privateText); sessionStorage.setItem(legacyIdentity, privateText);
    sessionStorage.setItem(`ph_${TOKEN}_window_id`, privateText);
    sessionStorage.setItem(`ph_${TOKEN}_primary_window_exists`, privateText);
    for (const key of ["daybound-settings", "ph_other_project_posthog", `${legacyIdentity}_unrelated`]) localStorage.setItem(key, privateText);
    const c = make(); c.capture("calendar_opened");
    expect(localStorage.getItem(KEY)).toBe(saved(false));
    expect(localStorage.getItem(legacyIdentity)).toBeNull(); expect(sessionStorage.getItem(legacyIdentity)).toBeNull();
    expect(sessionStorage.getItem(`ph_${TOKEN}_window_id`)).toBeNull();
    expect(sessionStorage.getItem(`ph_${TOKEN}_primary_window_exists`)).toBeNull();
    expect(document.cookie).not.toContain(legacyIdentity); expect(document.cookie).not.toContain(legacyConsent);
    for (const key of ["daybound-settings", "ph_other_project_posthog", `${legacyIdentity}_unrelated`]) expect(localStorage.getItem(key)).toBe(privateText);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("gives an explicit versioned preference priority over legacy consent", () => {
    localStorage.setItem(KEY, saved(true)); localStorage.setItem(legacyConsent, "0");
    make().capture("calendar_opened"); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not erase legacy consent when new preference persistence fails", () => {
    localStorage.setItem(legacyConsent, "0");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    make().capture("calendar_opened");
    expect(localStorage.getItem(legacyConsent)).toBe("0"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails closed if legacy cleanup is blocked, including after attempted opt-in", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    const c = make(); c.setEnabled(true); c.capture("calendar_opened");
    expect(c.getSnapshot()).toMatchObject({ enabled: false, preferenceStatus: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("request cancellation and reusable lifecycle", () => {
  it.each(["opt-out", "dispose", "cross-tab"])("aborts pending requests on %s and never dispatches delayed work", async (action) => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const c = make(); c.capture("calendar_opened");
    const signal = request().options.signal!;
    if (action === "opt-out") c.setEnabled(false);
    else if (action === "dispose") c.dispose();
    else window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: saved(false) }));
    expect(signal.aborted).toBe(true);
    window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("unload"));
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(120_000); c.capture("calendar_opened");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("drops fetch failures without retry or exposing private diagnostics", async () => {
    vi.useFakeTimers(); fetchMock.mockRejectedValue(new Error(privateText));
    make().capture("calendar_opened");
    await vi.advanceTimersByTimeAsync(120_000);
    window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("unload"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("supports StrictMode start/dispose/start, stable snapshots and subscriber cleanup", () => {
    const c = make({}, false); const listener = vi.fn(); const unsubscribe = c.subscribe(listener);
    expect(c.getSnapshot()).toBe(c.getSnapshot());
    c.start(); const enabledSnapshot = c.getSnapshot(); c.start();
    expect(c.getSnapshot()).toBe(enabledSnapshot); expect(listener).toHaveBeenCalledTimes(1);
    c.dispose(); c.dispose(); c.capture("calendar_opened"); expect(fetchMock).not.toHaveBeenCalled();
    c.start(); c.capture("calendar_opened"); expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(3); unsubscribe(); c.setEnabled(false);
    expect(listener).toHaveBeenCalledTimes(3);
    c.dispose(); const snapshot = c.getSnapshot();
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: "broken" }));
    expect(c.getSnapshot()).toBe(snapshot);
  });
});
