import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { publishTimezoneUpdate } from "./lib/timezone-publish.mjs";
import { UPDATE_FILES, readPinnedVersions, sha256 } from "./lib/timezone-update.mjs";

const directory = path.resolve(process.env.TZ_CANDIDATE_DIR);
const files = Object.fromEntries(await Promise.all(UPDATE_FILES.map(async file => [file, await readFile(path.join(directory, file))])));
if (Object.values(files).some(buffer => buffer.length > 10 * 1024 * 1024)) throw new Error("Oversized timezone candidate");
const versions = await readPinnedVersions(pathToFileURL(directory + path.sep));
if (new Set(Object.values(versions)).size !== 1) throw new Error("Candidate timezone versions disagree");
const provenance = JSON.parse(files["docs/timezone-provenance.json"]);
if (sha256(files["tests/fixtures/timezone-regressions.json"]) !== provenance.regressionsSha256) throw new Error("Regression artifact hash mismatch");
if (!process.env.GH_TOKEN) throw new Error("Publishing requires the workflow GitHub token");
const api = async (method, endpoint, body) => {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method, headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json", "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
  });
  if (method === "GET" && endpoint.includes("/git/ref/") && response.status === 404) return null;
  if (!response.ok) {
    const error = new Error(`GitHub ${method} ${endpoint.split("?")[0]} failed: HTTP ${response.status}. Check Actions PR creation permissions and workflow dispatch permissions.`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
};
const result = await publishTimezoneUpdate({ api, files, version: versions.providerVersion,
  repo: process.env.GITHUB_REPOSITORY, base: process.env.TZ_BASE_BRANCH, baseSha: process.env.TZ_BASE_SHA,
  report: files["docs/timezone-release.md"].toString("utf8"),
  runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
});
console.log(JSON.stringify(result));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Timezone update PR\n\n${result.url ?? result.state}\n`);
