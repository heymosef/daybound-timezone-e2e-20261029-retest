import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Instant, ZoneRulesProvider } from "@js-joda/core";
import "@js-joda/timezone/dist/js-joda-timezone-empty.esm.js";

export const BUILDER_COMMIT = "dbdecb00b7fded90be6dcb09339f1bfbb8dc3101";
export const UPDATE_FILES = [
  "src/utils/timezoneRules.json", "src/utils/timezoneAliases.json",
  "tests/fixtures/timezone-regressions.json", "docs/timezone-provenance.json",
  "docs/timezone-release.md",
];
export const sha256 = value => createHash("sha256").update(value).digest("hex");
export function validateVersion(version) {
  if (typeof version !== "string" || !/^\d{4}[a-z]+$/.test(version)) throw new Error("Invalid IANA release version");
  return version;
}
export function compareVersions(a, b) {
  validateVersion(a); validateVersion(b);
  const year = Number(a.slice(0, 4)) - Number(b.slice(0, 4));
  if (year) return Math.sign(year);
  // IANA continues after z with za, zb, ...; length also handles longer suffixes.
  const suffixA = a.slice(4), suffixB = b.slice(4);
  return Math.sign(suffixA.length - suffixB.length) || Math.sign(suffixA.localeCompare(suffixB, "en"));
}
export function planRelease(current, latest, { rebuild = false, dryRun = false } = {}) {
  const order = compareVersions(latest, current);
  if (rebuild && !dryRun) throw new Error("Rebuilding the current release requires dry_run");
  if (order < 0) throw new Error(`IANA reports older release ${latest}; refusing to downgrade ${current}`);
  return { version: latest, update: order > 0 || rebuild, branch: `automation/timezone-${latest}` };
}
export async function readPinnedVersions(root) {
  const [rules, aliases, provenance, regressions] = await Promise.all([
    readFile(new URL("src/utils/timezoneRules.json", root)),
    readFile(new URL("src/utils/timezoneAliases.json", root)),
    readFile(new URL("docs/timezone-provenance.json", root), "utf8").then(JSON.parse),
    readFile(new URL("tests/fixtures/timezone-regressions.json", root)),
  ]);
  if (sha256(rules) !== provenance.rulesSha256 || sha256(aliases) !== provenance.aliasesSha256 || sha256(regressions) !== provenance.regressionsSha256) {
    throw new Error("Bundled rules or aliases do not match their source provenance hashes");
  }
  return { metadataVersion: JSON.parse(aliases).version, sourceVersion: provenance.version, providerVersion: JSON.parse(rules).version };
}

function signature(rules, time) {
  const info = rules._tzdbInfo;
  let i = 0, high = info.untils.length - 1;
  while (i < high) {
    const mid = (i + high) >>> 1;
    if (time < info.untils[mid]) high = mid; else i = mid + 1;
  }
  return `${rules.offset(Instant.ofEpochMilli(time)).totalSeconds()}|${info.abbrs[i]}`;
}

// Only selects instants. Expected values come independently from Python ZoneInfo/TZif.
export function regressionProbes(previous, next, names) {
  ZoneRulesProvider.loadTzdbData(previous);
  const oldRules = new Map(names.map(name => {
    try { return [name, ZoneRulesProvider.getRules(name)]; } catch { return [name, null]; }
  }));
  ZoneRulesProvider.loadTzdbData(next);
  const year = Number(next.version.slice(0, 4));
  const probes = [], changedZones = [];
  for (const zone of names) {
    const before = oldRules.get(zone), after = ZoneRulesProvider.getRules(zone);
    const times = new Set([Date.UTC(year, 0, 15, 12), Date.UTC(year, 6, 15, 12)]);
    const candidates = new Set([...(before?._tzdbInfo.untils ?? []), ...after._tzdbInfo.untils]);
    let changed = !before;
    for (const boundary of candidates) {
      if (!Number.isSafeInteger(boundary) || boundary < -62135596800000 || boundary >= 253402300798000) continue;
      for (const time of [boundary - 1000, boundary, boundary + 1000]) {
        if (!before || signature(before, time) !== signature(after, time)) {
          changed = true;
          for (const adjacent of [time - 1000, time, time + 1000]) times.add(adjacent);
        }
      }
    }
    if (changed) changedZones.push(zone);
    for (const time of [...times].sort((a, b) => a - b)) probes.push({ zone, instant: new Date(time).toISOString() });
  }
  return { probes, changedZones };
}

export function releaseNotes(news, version) {
  validateVersion(version);
  const section = news.split(/\n(?=Release )/).find(part => part.startsWith(`Release ${version} - `));
  if (!section) throw new Error(`IANA NEWS has no release ${version}`);
  return section.trim();
}
