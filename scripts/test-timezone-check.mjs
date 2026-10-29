import assert from "node:assert/strict";
import test from "node:test";
import { checkTimezoneData, fetchIanaVersion, IANA_VERSION_URL, timezoneCheckSummary } from "./lib/timezone-check.mjs";

const pinned = { metadataVersion: "2026e", sourceVersion: "2026e", providerVersion: "2026e" };
const check = fetchVersion => checkTimezoneData({ ...pinned, fetchVersion });
const response = (text, status = 200) => ({ ok: status === 200, status, text: async () => text });

// This filename deliberately belongs to node:test, outside Vitest discovery.
test("equal versions are current and produce an Actions summary", async () => {
  const result = await check(async () => "2026e");
  assert.equal(result.exitCode, 0);
  assert.equal(result.heading, "Timezone data current");
  assert.match(timezoneCheckSummary(result), /^## Timezone data current\n/);
});

test("a newer release requires review", async () => {
  const result = await check(async () => "2026f");
  assert.equal(result.exitCode, 1);
  assert.match(result.message, /2026e; current IANA 2026f/);
  assert.match(timezoneCheckSummary(result), /^## Timezone review needed\n/);
});

test("multi-letter IANA suffixes are accepted and compared exactly", async () => {
  const versions = { metadataVersion: "2026aa", sourceVersion: "2026aa", providerVersion: "2026aa" };
  assert.equal((await checkTimezoneData({ ...versions, fetchVersion: async () => "2026aa" })).exitCode, 0);
  assert.equal((await checkTimezoneData({ ...versions, fetchVersion: async () => "2026ab" })).exitCode, 1);
  assert.equal(await fetchIanaVersion({ fetchImpl: async () => response("2026aa\n") }), "2026aa");
});

test("an older endpoint release still requires review, never an automatic downgrade", async () => {
  assert.equal((await check(async () => "2026d")).exitCode, 1);
});

for (const field of ["metadataVersion", "sourceVersion", "providerVersion"]) {
  for (const value of ["2026d", undefined, "invalid"]) {
    test(`local ${field} mismatch (${value}) requires review without network`, async () => {
      const result = await checkTimezoneData({ ...pinned, [field]: value, fetchVersion: () => assert.fail("must not fetch") });
      assert.equal(result.exitCode, 1);
      assert.match(result.message, /Pinned data mismatch/);
    });
  }
}

for (const [name, fetchImpl, diagnostic] of [
  ["HTTP error", async () => response("", 503), /HTTP 503/],
  ["invalid version", async () => response("<html>error</html>"), /unexpected version response/],
  ["network error", async () => { throw new TypeError("offline"); }, /network error/],
  ["timeout", async () => { throw new DOMException("timed out", "TimeoutError"); }, /timeout/],
  ["response body failure", async () => ({ ok: true, text: async () => { throw new TypeError("body interrupted"); } }), /network error/],
]) {
  test(`${name} is unavailable, with a distinct failed-run summary`, async () => {
    const result = await check(() => fetchIanaVersion({ fetchImpl }));
    assert.equal(result.exitCode, 2);
    assert.match(result.message, diagnostic);
    assert.match(timezoneCheckSummary(result), /^## Timezone check unavailable\n/);
  });
}

test("fetch uses the fixed endpoint and a bounded abort signal", async () => {
  let signal;
  const latest = await fetchIanaVersion({ fetchImpl: async (url, options) => {
    assert.equal(url, IANA_VERSION_URL);
    signal = options.signal;
    assert.ok(signal instanceof AbortSignal);
    assert.equal(signal.aborted, false);
    return response(" 2026e\n");
  } });
  assert.equal(latest, "2026e");
});

test("injected invalid version is unavailable", async () => {
  assert.equal((await check(async () => "invalid")).exitCode, 2);
});
