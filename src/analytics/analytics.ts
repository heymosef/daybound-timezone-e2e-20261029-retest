import { projectSearchEvent, type SearchAttemptEvent, type SearchClosedEvent, type SearchSelectedEvent } from "./searchEvents";
import { projectHomeChange, projectSettingsChange, type HomeTimezoneChangedEvent, type SettingsChangedEvent } from "./structuredEvents";

/** Explicit events only. Search text is restricted to the approved filtered sample. */
export interface AnalyticsEvents {
  timezone_added: { timezone_count_after: number };
  timezone_removed: { timezone_count_after: number };
  timezone_renamed: undefined;
  timezone_reordered: { direction: "up" | "down" };
  home_timezone_changed: HomeTimezoneChangedEvent;
  settings_changed: SettingsChangedEvent;
  keyboard_shortcut_used: { shortcut: "cmd_k" | "ctrl_k" };
  timezone_search_no_results: { query_length: number; query_words: number };
  timezone_search_attempted: SearchAttemptEvent;
  timezone_search_selected: SearchSelectedEvent;
  timezone_search_closed: SearchClosedEvent;
  date_selected_strip: { date_offset: number };
  date_selected_calendar: { date_offset: number; month_distance: number };
  calendar_opened: undefined;
  calendar_closed: { method: "outside_click" | "escape" | "date_selected" | "today_button" };
  calendar_month_navigated: { direction: "backward" | "forward"; months_from_today: number };
}

export const ANALYTICS_PREFERENCE_KEY = "daybound:analytics:v1";

export interface AnalyticsSnapshot {
  enabled: boolean;
  preferenceStatus: "saved" | "unavailable";
  available: boolean;
}

export interface AnalyticsOptions {
  token?: string;
  host?: string;
  /** Environment overrides are for offline policy tests; the browser defaults reject DEV/test. */
  production?: boolean;
  hostname?: string;
  storage?: () => Storage;
  doNotTrack?: () => boolean;
}

export interface AnalyticsController {
  capture<K extends keyof AnalyticsEvents>(
    event: K,
    ...args: AnalyticsEvents[K] extends undefined ? [] : [properties: AnalyticsEvents[K]]
  ): void;
  getSnapshot(): AnalyticsSnapshot;
  subscribe(listener: () => void): () => void;
  setEnabled(enabled: boolean): void;
  start(): void;
  dispose(): void;
}

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost" || host.endsWith(".localhost") ||
    /^127(?:\.\d{1,3}){3}$/.test(host) || host === "::1" || host === "[::1]";
}

function endpointFor(host: string | undefined): string | undefined {
  if (!host) return;
  try {
    const url = new URL(host);
    // Compare raw input too: reject normalized paths, credentials and origin ambiguity.
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      (host !== url.origin && host !== `${url.origin}/`) || isLoopback(url.hostname)) return;
    return `${url.origin}/i/v0/e/`;
  } catch { return; }
}

function readPreference(raw: string | null): boolean | undefined {
  if (raw === null) return undefined;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
    !("version" in value) || value.version !== 1 || !("enabled" in value) ||
    typeof value.enabled !== "boolean" || Object.keys(value).length !== 2) {
    throw new Error("Invalid analytics preference");
  }
  return value.enabled;
}

type Properties = Record<string, number | string | boolean>;
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

/** Runtime projection is intentional: TypeScript alone cannot prevent extra private fields. */
function project(event: keyof AnalyticsEvents, input: unknown): Properties | undefined {
  const p = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  switch (event) {
    case "timezone_search_attempted": case "timezone_search_selected": case "timezone_search_closed":
      return projectSearchEvent(event, p);
    case "home_timezone_changed": return projectHomeChange(p);
    case "settings_changed": return projectSettingsChange(p);
    case "timezone_renamed": case "calendar_opened": return {};
    case "timezone_added": case "timezone_removed":
      return integer(p.timezone_count_after, 0, 100) ? { timezone_count_after: p.timezone_count_after } : undefined;
    case "timezone_reordered":
      return p.direction === "up" || p.direction === "down" ? { direction: p.direction } : undefined;
    case "keyboard_shortcut_used":
      return p.shortcut === "cmd_k" || p.shortcut === "ctrl_k" ? { shortcut: p.shortcut } : undefined;
    case "timezone_search_no_results":
      return integer(p.query_length, 0, 1000) && integer(p.query_words, 0, 100) ?
        { query_length: p.query_length, query_words: p.query_words } : undefined;
    case "date_selected_strip":
      return integer(p.date_offset, -3660, 3660) ? { date_offset: p.date_offset } : undefined;
    case "date_selected_calendar":
      return integer(p.date_offset, -3660, 3660) && integer(p.month_distance, -120, 120) ?
        { date_offset: p.date_offset, month_distance: p.month_distance } : undefined;
    case "calendar_closed":
      return p.method === "outside_click" || p.method === "escape" ||
        p.method === "date_selected" || p.method === "today_button" ? { method: p.method } : undefined;
    case "calendar_month_navigated":
      return (p.direction === "backward" || p.direction === "forward") && integer(p.months_from_today, -120, 120) ?
        { direction: p.direction, months_from_today: p.months_from_today } : undefined;
    default: return undefined;
  }
}

const browserDnt = () => {
  const nav = navigator as Navigator & { msDoNotTrack?: string; globalPrivacyControl?: boolean };
  const win = window as Window & { doNotTrack?: string };
  return [nav.doNotTrack, nav.msDoNotTrack, win.doNotTrack, nav.globalPrivacyControl]
    .some((value) => value === "1" || value === "yes" || value === true);
};

function cookieValue(key: string): string | null {
  for (const part of document.cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === key) return decodeURIComponent(value.join("="));
  }
  return null;
}

// Current/legacy SDK consent accepts these primitive representations; no SDK code is imported.
function legacyDenied(raw: string | null): boolean {
  if (raw === null) return false;
  return ["0", "false", "no", '"0"', '"false"', '"no"'].includes(raw);
}

function removeLegacyCookie(key: string) {
  document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax`;
  const parts = window.location.hostname.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax; Domain=${parts.slice(i).join(".")}`;
  }
  if (cookieValue(key) !== null) throw new Error("Legacy analytics cleanup unavailable");
}

export function createAnalytics(options: AnalyticsOptions = {}): AnalyticsController {
  const token = options.token;
  const endpoint = endpointFor(options.host);
  const production = options.production ?? (!import.meta.env.DEV && import.meta.env.MODE !== "test");
  const hostname = options.hostname ?? window.location.hostname;
  const storage = options.storage ?? (() => window.localStorage);
  const dnt = options.doNotTrack ?? browserDnt;
  const configured = production && !isLoopback(hostname) && !!endpoint &&
    typeof token === "string" && /^phc_[a-zA-Z0-9_-]{1,500}$/.test(token);
  const validToken = typeof token === "string" && /^phc_[a-zA-Z0-9_-]{1,500}$/.test(token);
  const consentKey = `__ph_opt_in_out_${token}`;
  const listeners = new Set<() => void>();
  const pending = new Set<AbortController>();
  let started = false;
  // A lifecycle restart must never undo a denial when disk still contains stale consent.
  // Only a successfully persisted explicit opt-in clears this controller-local latch.
  let deniedForVisit = false;
  let identity: string | undefined;
  let snapshot: AnalyticsSnapshot = { enabled: false, preferenceStatus: "unavailable", available: false };
  const available = () => {
    try { return configured && !dnt(); } catch { return false; }
  };
  const cancel = () => {
    for (const request of pending) request.abort();
    pending.clear();
    identity = undefined;
  };
  const update = (enabled: boolean, preferenceStatus: AnalyticsSnapshot["preferenceStatus"]) => {
    const canCapture = available();
    const next = { enabled: started && enabled && !deniedForVisit && canCapture, preferenceStatus, available: canCapture };
    if (!next.enabled) cancel();
    if (next.enabled === snapshot.enabled && next.preferenceStatus === snapshot.preferenceStatus &&
      next.available === snapshot.available) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const deny = (preferenceStatus: AnalyticsSnapshot["preferenceStatus"]) => {
    deniedForVisit = true;
    update(false, preferenceStatus);
  };
  const write = (enabled: boolean) => {
    const value = JSON.stringify({ version: 1, enabled });
    const store = storage();
    store.setItem(ANALYTICS_PREFERENCE_KEY, value);
    if (store.getItem(ANALYTICS_PREFERENCE_KEY) !== value) throw new Error("Preference was not saved");
  };
  const cleanupLegacy = () => {
    if (!validToken) return;
    for (const key of [
      `ph_${token}_posthog`, consentKey, `ph_${token}_posthog_cpm`,
      `ph_${token}_posthog_cookie_identity_change_pending`, `ph_${token}_window_id`,
      `ph_${token}_primary_window_exists`, `ph_${token}_session_registered_properties`,
    ]) {
      storage().removeItem(key);
      window.sessionStorage.removeItem(key);
      removeLegacyCookie(key);
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== ANALYTICS_PREFERENCE_KEY && event.key !== null) return;
    // Cross-tab messages may disable, never silently opt another tab in.
    try {
      if (event.key === null || event.newValue === null) deny("unavailable");
      else if (readPreference(event.newValue) === false) deny("saved");
    } catch { deny("unavailable"); }
  };
  const consentAtDispatch = () => {
    if (!started || !snapshot.enabled) return false;
    try {
      const enabled = readPreference(storage().getItem(ANALYTICS_PREFERENCE_KEY));
      if (enabled !== true) {
        deny(enabled === false ? "saved" : "unavailable");
        return false;
      }
    } catch { deny("unavailable"); return false; }
    if (!available()) { deny(snapshot.preferenceStatus); return false; }
    return true;
  };
  const controller: AnalyticsController = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start() {
      if (started) return;
      started = true;
      window.addEventListener("storage", onStorage);
      try {
        const saved = readPreference(storage().getItem(ANALYTICS_PREFERENCE_KEY));
        const legacyOff = saved === undefined && validToken &&
          (legacyDenied(storage().getItem(consentKey)) || legacyDenied(cookieValue(consentKey)));
        const enabled = !deniedForVisit && (saved ?? (!legacyOff && production && !isLoopback(hostname)));
        // Probe this actual preference write before any event can leave the page.
        write(enabled);
        // Only this project's exact legacy keys, after preserving consent; never clear other data.
        cleanupLegacy();
        if (!enabled || !available()) deny("saved");
        else update(true, "saved");
      } catch { deny("unavailable"); }
    },
    dispose() {
      if (!started) return;
      started = false;
      window.removeEventListener("storage", onStorage);
      update(false, snapshot.preferenceStatus);
    },
    setEnabled(enabled) {
      // Disable synchronously even if persistence throws. Opt-in requires a successful write.
      if (!enabled) deny(snapshot.preferenceStatus);
      try {
        write(enabled);
        cleanupLegacy();
        if (enabled) deniedForVisit = false;
        update(enabled, "saved");
      } catch { deny("unavailable"); }
    },
    capture(event, ...args) {
      if (!started || !snapshot.enabled) return;
      if (!available()) { deny(snapshot.preferenceStatus); return; }
      try {
        const properties = project(event, args[0]);
        if (!properties) return;
        identity ??= crypto.randomUUID();
        const request = new AbortController();
        const body = JSON.stringify({
          api_key: token,
          event,
          distinct_id: identity,
          timestamp: new Date().toISOString(),
          properties: { ...properties, $process_person_profile: false, $geoip_disable: true },
        });
        // Recheck consent immediately before dispatch. Nothing is queued for later delivery.
        if (!consentAtDispatch()) return;
        pending.add(request);
        void fetch(endpoint!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          credentials: "omit",
          referrerPolicy: "no-referrer",
          redirect: "error",
          signal: request.signal,
        }).catch(() => { /* Dropped: intentionally no retries or diagnostics payload. */ })
          .finally(() => { pending.delete(request); });
      } catch { /* Invalid inputs or unavailable browser APIs never interrupt the app. */ }
    },
  };
  return controller;
}
