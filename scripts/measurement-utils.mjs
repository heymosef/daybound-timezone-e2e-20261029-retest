// Local maintenance measurements only; never imported by the application.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { once } from "node:events";
import path from "node:path";

export const percentile = (values, p) => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)] : null;
export async function fingerprint() {
  const files = ["index.html", "package.json", "package-lock.json", "vite.config.ts", "scripts/browser-fixtures.mjs"];
  async function visit(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(name);
      else if (!/\.(test|spec)\./.test(name)) files.push(name);
    }
  }
  await visit("src");
  try { await visit("public/fonts"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const manifest = {};
  for (const file of files.sort()) manifest[file] = createHash("sha256").update(await readFile(file)).digest("hex");
  return { sha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"), manifest };
}
export async function serve(directory, port) {
  const child = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", directory], { stdio: "ignore" });
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Owned server exited ${child.exitCode}`);
    try { if ((await fetch(origin)).ok) return { origin, close: async () => { const done = once(child, "exit"); child.kill("SIGTERM"); await done; } }; } catch { /* Await only initial readiness, bounded to five seconds. */ }
    await delay(50);
  }
  child.kill("SIGTERM"); throw new Error("Owned server did not become ready");
}
export const zones = ["UTC", "Asia/Kolkata", "Asia/Kathmandu", "Australia/Adelaide", "America/New_York", "Australia/Lord_Howe", "America/Vancouver", "America/Los_Angeles", "America/Edmonton", "America/Winnipeg", "America/Toronto", "America/St_Johns", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Australia/Sydney", "Pacific/Auckland", "Africa/Johannesburg", "America/Sao_Paulo"];
export function seed({ design = "te-1", count = 6, fixture = false }) {
  const selected = ["UTC", "Asia/Kolkata", "Asia/Kathmandu", "Australia/Adelaide", "America/New_York", "Australia/Lord_Howe", "America/Vancouver", "America/Los_Angeles", "America/Edmonton", "America/Winnipeg", "America/Toronto", "America/St_Johns", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Australia/Sydney", "Pacific/Auckland", "Africa/Johannesburg", "America/Sao_Paulo"];
  localStorage.setItem("timezone_config", JSON.stringify(selected.slice(0, count).map((timezone, i) => ({ id: `measure-${i}`, timezone, isHome: i === 0 }))));
  localStorage.setItem("app_settings", JSON.stringify({ use24Hour: true, theme: "light", designTheme: design, showBadge: true, showWeekends: true }));
  if (fixture) localStorage.setItem("daybound-smoke:profile", "midnight:normal:false:null");
  else {
    const RealDate = Date; const fixed = RealDate.parse("2026-03-07T23:59:30Z");
    window.Date = new Proxy(RealDate, {
      construct(target, args) { return Reflect.construct(target, args.length ? args : [fixed]); },
      apply() { return new RealDate(fixed).toString(); },
      get(target, key) { return key === "now" ? () => fixed : Reflect.get(target, key); },
    });
  }
}
