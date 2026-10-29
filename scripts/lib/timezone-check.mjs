const VERSION_PATTERN = /^\d{4}[a-z]+$/;
export const IANA_VERSION_URL = "https://data.iana.org/time-zones/tzdb/version";

// Fetching is injected in tests; builds never call this maintenance endpoint.
export async function fetchIanaVersion({ fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  let response;
  let text;
  try {
    response = await fetchImpl(IANA_VERSION_URL, { signal: AbortSignal.timeout(timeoutMs) });
    if (response.ok) text = await response.text();
  } catch (error) {
    const reason = error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "network error";
    throw new Error(`IANA request unavailable: ${reason}.`, { cause: error });
  }
  if (!response.ok) throw new Error(`IANA request unavailable: HTTP ${response.status}.`);
  const version = text.trim();
  if (!VERSION_PATTERN.test(version)) throw new Error("IANA request unavailable: unexpected version response.");
  return version;
}

export async function checkTimezoneData({ metadataVersion, sourceVersion, providerVersion, fetchVersion = fetchIanaVersion }) {
  const versions = [metadataVersion, sourceVersion, providerVersion];
  if (versions.some(version => typeof version !== "string" || !VERSION_PATTERN.test(version)) ||
      versions.some(version => version !== metadataVersion)) {
    return {
      exitCode: 1,
      heading: "Timezone review needed",
      message: `Pinned data mismatch: provider ${providerVersion ?? "unknown"}, source ${sourceVersion ?? "unknown"}, generated ${metadataVersion ?? "unknown"}. Review pinned dependencies and regenerate aliases; see docs/timezone-data.md.`,
    };
  }

  let latest;
  try {
    latest = await fetchVersion();
    if (typeof latest !== "string" || !VERSION_PATTERN.test(latest)) {
      throw new Error("IANA request unavailable: unexpected version response.");
    }
  } catch (error) {
    return {
      exitCode: 2,
      heading: "Timezone check unavailable",
      message: error instanceof Error ? error.message : "IANA request unavailable.",
    };
  }
  // Any discrepancy requires review, including a mirror reporting an older release.
  // Equality accepts IANA's multi-letter suffixes without lexical ordering errors.
  if (metadataVersion !== latest) {
    return {
      exitCode: 1,
      heading: "Timezone review needed",
      message: `Bundled IANA ${metadataVersion}; current IANA ${latest}. Review pinned provider/source dependencies, lockfile and regressions; see docs/timezone-data.md.`,
    };
  }
  return { exitCode: 0, heading: "Timezone data current", message: `Bundled IANA ${metadataVersion}; current IANA ${latest}.` };
}

export function timezoneCheckSummary(result) {
  return `## ${result.heading}\n\n${result.message}\n\nExit code: ${result.exitCode}. This check does not update data or deploy.\n`;
}
