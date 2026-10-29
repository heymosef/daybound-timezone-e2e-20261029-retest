import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compareVersions, planRelease, readPinnedVersions, regressionProbes, releaseNotes } from "./lib/timezone-update.mjs";

test("a new release prepares an update; current data is a no-op", () => {
  assert.deepEqual(planRelease("2026e", "2026f"), { version: "2026f", update: true, branch: "automation/timezone-2026f" });
  assert.equal(planRelease("2026f", "2026f").update, false);
});
test("ordering handles year rollover and IANA's multi-letter suffixes", () => {
  for (const [before, after] of [["2026z", "2026za"], ["2026zz", "2026zza"], ["2026zz", "2027a"]]) {
    assert.ok(compareVersions(after, before) > 0);
    assert.throws(() => planRelease(after, before), /refusing to downgrade/);
  }
});
test("invalid release values cannot become branch names or executable arguments", () => {
  for (const value of [undefined, "2026f\nupdate=true", "--help", "../../x", "2026f;exit", "2026f/other"]) {
    assert.throws(() => planRelease("2026f", value), /Invalid IANA/);
  }
});
test("rebuilding a current release is only allowed without publishing", () => {
  assert.throws(() => planRelease("2026f", "2026f", { rebuild: true }), /requires dry_run/);
  assert.equal(planRelease("2026f", "2026f", { rebuild: true, dryRun: true }).update, true);
});
test("release notes select precisely the target release", () => {
  const news = "News\n\nRelease 2026g - today\nnew\n\nRelease 2026f - yesterday\nchosen\n\nRelease 2026e - earlier\nold";
  assert.equal(releaseNotes(news, "2026f"), "Release 2026f - yesterday\nchosen");
  assert.throws(() => releaseNotes(news, "2026d"), /no release/);
});
test("tampered rules or aliases fail provenance verification", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "timezone-integrity-"));
  try {
    const root = pathToFileURL(directory + path.sep);
    for (const file of ["src/utils/timezoneRules.json", "src/utils/timezoneAliases.json", "docs/timezone-provenance.json", "tests/fixtures/timezone-regressions.json"]) {
      await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
      await writeFile(path.join(directory, file), await readFile(new URL(`../${file}`, import.meta.url)));
    }
    const versions = await readPinnedVersions(root);
    assert.equal(versions.sourceVersion, versions.providerVersion);
    await writeFile(path.join(directory, "src/utils/timezoneRules.json"), '{"version":"2026g"}');
    await assert.rejects(readPinnedVersions(root), /source provenance hashes/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test("regression selection includes both sides of a changed boundary and seasonal samples", () => {
  const previous = { version: "2026e", zones: ["Test/Zone|UTC|0|0|||0|0"], links: [] };
  const next = { version: "2026f", zones: ["Test/Zone|UTC ONE|0 -10|01|10||01|0 0"], links: [] };
  const result = regressionProbes(previous, next, ["Test/Zone"]);
  assert.deepEqual(result.changedZones, ["Test/Zone"]);
  for (const instant of ["1970-01-01T00:59:59.000Z", "1970-01-01T01:00:00.000Z", "1970-01-01T01:00:01.000Z", "2026-01-15T12:00:00.000Z", "2026-07-15T12:00:00.000Z"]) {
    assert.ok(result.probes.some(probe => probe.instant === instant), instant);
  }
  assert.equal(regressionProbes(next, next, ["Test/Zone"]).changedZones.length, 0);
});
