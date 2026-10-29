// Read-only maintenance check. Normal installs/builds use the lockfile and require no IANA network call.
import { appendFile } from "node:fs/promises";
import { checkTimezoneData, timezoneCheckSummary } from "./lib/timezone-check.mjs";
import { readPinnedVersions } from "./lib/timezone-update.mjs";

let result;
try {
  result = await checkTimezoneData(await readPinnedVersions(new URL("../", import.meta.url)));
} catch {
  result = {
    exitCode: 1,
    heading: "Timezone review needed",
    message: "Pinned timezone data or provenance could not be verified. Review rules, aliases and source hashes; see docs/timezone-data.md.",
  };
}

const log = result.exitCode === 0 ? console.log : console.error;
log(`${result.heading}: ${result.message}`);
process.exitCode = result.exitCode;
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, timezoneCheckSummary(result));
}
