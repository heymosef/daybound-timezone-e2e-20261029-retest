// Builds an offline browser shell around the real application. Never loads .env.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(project, "node_modules/.cache/daybound-smoke");
const entries = path.join(cache, "entries");
const output = path.join(cache, "site");
await mkdir(entries, { recursive: true });
const source = (file) => JSON.stringify(path.join(project, file));

await writeFile(path.join(entries, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'none'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' blob:; worker-src 'self' blob:">
<title>Daybound offline browser fixture</title></head><body>
<aside id="fixture" aria-label="Offline fixture controls" style="position:relative;z-index:9999;background:#fff;color:#111;padding:12px;font:14px system-ui">
<strong>Offline fixture — real App</strong><p id="fixture-clock"></p>
<button id="system-theme" hidden>Simulate system theme change</button> <output id="startup-theme"></output>
<button id="minute">Advance minute</button> <button id="day">Advance day</button>
<button id="background-minute">Advance minute without focus</button> <button id="focus">Resume focus</button>
<button id="external-opt-out">Simulate other-tab opt-out</button> <button id="complete">Complete pending requests</button>
<details><summary>Intercepted analytics requests</summary><pre id="requests"></pre></details>
<p id="request-count" role="status"></p></aside>
<div id="root"></div><script type="module" src="./entry.jsx"></script></body></html>`);

await writeFile(path.join(entries, "bootstrap.js"), `
const params = new URLSearchParams(location.search);
const scenario = params.get("scenario") || "midnight";
const requestedSystemTheme = params.get("systemTheme");
const systemTheme = ["light", "dark"].includes(requestedSystemTheme) ? requestedSystemTheme : null;
if (systemTheme === "light" || systemTheme === "dark") {
  const nativeMatchMedia = window.matchMedia.bind(window);
  let dark = systemTheme === "dark";
  const media = new EventTarget();
  Object.defineProperty(media, "matches", { get: () => dark });
  window.matchMedia = query => query === "(prefers-color-scheme: dark)" ? media : nativeMatchMedia(query);
  const toggle = document.getElementById("system-theme");
  toggle.hidden = false;
  toggle.onclick = () => { dark = !dark; media.dispatchEvent(new Event("change")); };
}
const clocks = {
  midnight: "2026-03-07T23:59:30Z",
  "bc-fall": "2026-11-01T08:59:30Z",
  "cuba-fall": "2026-11-01T04:59:30Z",
  "toronto-fall": "2026-10-31T19:00:00Z",
  fractional: "2026-03-07T21:00:00Z",
  "dst-spring": "2026-03-08T06:59:30Z",
  "dst-fall": "2026-11-01T05:59:30Z",
  "st-johns": "2009-11-01T02:29:30Z",
};
const RealDate = Date;
let now = RealDate.parse(clocks[scenario] || clocks.midnight);
window.Date = new Proxy(RealDate, {
  construct(target, args) { return Reflect.construct(target, args.length ? args : [now]); },
  apply() { return new RealDate(now).toString(); },
  get(target, key) { return key === "now" ? () => now : Reflect.get(target, key); },
});
const requests = [];
const pending = new Set();
const storageMode = params.get("storage") || "normal";
const analytics = params.get("analytics") === "on";
if (params.get("sampleSearches") === "1") {
  let sequence = 0;
  // Offline only: every random journey falls in the sampled bucket; IDs remain distinct.
  crypto.randomUUID = () => "00000000-0000-4000-8000-" + (++sequence).toString(16).padStart(12, "0");
}
const render = () => {
  document.getElementById("fixture-clock").textContent = new RealDate(now).toISOString() +
    " | scenario=" + scenario + " | storage=" + storageMode + " | analytics=" + analytics;
  document.getElementById("request-count").textContent = "Requests: " + requests.length +
    " | Pending: " + pending.size + " | Aborted: " + requests.filter(r => r.aborted).length;
  document.getElementById("requests").textContent = JSON.stringify(requests, null, 2);
};
// Every fetch is intercepted before App/provider modules are imported. Nothing
// delegates to the native transport, including unexpected future fetch callers.
window.fetch = (input, init = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url !== "https://analytics.daybound.invalid/i/v0/e/") {
    return Promise.reject(new Error("Offline fixture blocked unexpected fetch: " + url));
  }
  const record = { url, method: init.method, credentials: init.credentials,
    referrerPolicy: init.referrerPolicy, redirect: init.redirect, headers: init.headers,
    envelope: JSON.parse(String(init.body)), aborted: init.signal?.aborted ?? false, completed: false };
  requests.push(record);
  return new Promise((resolve, reject) => {
    const finish = () => { record.completed = true; pending.delete(finish); init.signal?.removeEventListener("abort", abort); render(); resolve(new Response("{}", {status: 200})); };
    const abort = () => { record.aborted = true; pending.delete(finish); render(); reject(new DOMException("Aborted", "AbortError")); };
    if (record.aborted) { abort(); return; }
    pending.add(finish);
    init.signal?.addEventListener("abort", abort, { once: true });
    render();
  });
};
const home = ["bc-fall", "toronto-fall"].includes(scenario) ? "America/Vancouver" : scenario === "cuba-fall" ? "America/Havana" : scenario.startsWith("dst-") ? "America/New_York" : scenario === "st-johns" ? "America/St_Johns" : "UTC";
const zones = [...new Set([home, ...(scenario === "bc-fall" ? ["America/Los_Angeles", "America/Edmonton", "America/Winnipeg"] : []), ...(scenario === "toronto-fall" ? ["America/Toronto"] : []), "UTC", "Asia/Kolkata", "Asia/Kathmandu", "Australia/Adelaide", "America/New_York", "Australia/Lord_Howe"])];
const store = window.localStorage;
const profile = scenario + ":" + storageMode + ":" + analytics + ":" + systemTheme;
if (store.getItem("daybound-smoke:profile") !== profile || params.get("reset") === "1") {
  store.setItem("timezone_config", JSON.stringify(zones.map((timezone, i) => ({id: "fixture-" + i, timezone, isHome: i === 0}))));
  store.setItem("app_settings", JSON.stringify({use24Hour: true, theme: systemTheme ? "system" : "light", designTheme: "te-1", showBadge: true, showWeekends: true}));
  store.setItem("local_save_notice_dismissed", "false");
  store.removeItem("daybound:analytics:v1");
  if (storageMode === "corrupt") {
    store.setItem("timezone_config", "{broken fixture JSON");
    store.setItem("app_settings", "{broken fixture JSON");
  }
  store.setItem("daybound-smoke:profile", profile);
}
if (storageMode === "blocked") {
  Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("Fixture storage blocked", "SecurityError"); } });
} else if (storageMode === "quota") {
  Storage.prototype.setItem = () => { throw new DOMException("Fixture quota exceeded", "QuotaExceededError"); };
}
const resume = () => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); render(); };
document.getElementById("minute").onclick = () => { now += 60000; resume(); };
document.getElementById("day").onclick = () => { now += 86400000; resume(); };
document.getElementById("background-minute").onclick = () => { now += 60000; render(); };
document.getElementById("focus").onclick = resume;
document.getElementById("complete").onclick = () => { for (const finish of pending) finish(); };
document.getElementById("external-opt-out").onclick = () => {
  const newValue = JSON.stringify({version: 1, enabled: false});
  // This event models a second tab; only the application's storage listener
  // performs the local controller transition/cancellation.
  try { window.localStorage.setItem("daybound:analytics:v1", newValue); } catch { /* Failure scenarios still exercise the event listener. */ }
  window.dispatchEvent(new StorageEvent("storage", { key: "daybound:analytics:v1", newValue }));
};
window.dayboundFixtureOptions = analytics ? {
  production: true, hostname: "fixture.daybound.invalid", token: "phc_offline_fixture_only",
  host: "https://analytics.daybound.invalid", doNotTrack: () => false,
} : { production: true, hostname: "localhost" };
render();
`);
await writeFile(path.join(entries, "entry.jsx"), `
import "./bootstrap.js";
import React from "react";
import { createRoot } from "react-dom/client";
import ${source("src/styles/index.css")};
// Dynamic imports guarantee the clock, storage and transport precede module initialization.
const [{default: App}, {AnalyticsProvider}] = await Promise.all([
  import(${source("src/app/App.tsx")}), import(${source("src/analytics/AnalyticsProvider.tsx")}),
]);
document.getElementById("startup-theme").textContent = " Startup theme before React: " + JSON.stringify({
  dark: document.documentElement.classList.contains("dark"),
  design: document.documentElement.dataset.designTheme,
  color: document.querySelector('meta[name="theme-color"]')?.content,
});
createRoot(document.getElementById("root")).render(
  <React.StrictMode><AnalyticsProvider options={window.dayboundFixtureOptions}><App /></AnalyticsProvider></React.StrictMode>
);
`);
await build({
  configFile: path.join(project, "vite.config.ts"), root: entries,
  envFile: false, publicDir: false, base: "./", mode: "production",
  define: { "import.meta.env.VITE_PUBLIC_POSTHOG_KEY": "undefined", "import.meta.env.VITE_PUBLIC_POSTHOG_HOST": "undefined" },
  build: { outDir: output, emptyOutDir: true, target: "esnext" },
});
await copyFile(path.join(project, "public/city-data-credits.html"), path.join(output, "city-data-credits.html"));
// publicDir stays disabled: copy only the reviewed runtime font files explicitly.
const fontManifest = JSON.parse(await readFile(path.join(project, "public/fonts/manifest.json"), "utf8"));
await mkdir(path.join(output, "fonts"), { recursive: true });
await Promise.all(fontManifest.files.map(({ file }) => copyFile(
  path.join(project, "public/fonts", file), path.join(output, "fonts", file),
)));
console.log(`Offline fixture built at ${output}/index.html`);
console.log(`Serve: python3 -m http.server 4174 --bind 127.0.0.1 --directory ${output}`);
console.log("Open http://127.0.0.1:4174/?scenario=midnight&analytics=on (see docs/browser-testing.md)");
