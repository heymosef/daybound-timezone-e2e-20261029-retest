import { appendFile, readFile } from "node:fs/promises";
import { mergeTimezoneUpdate, waitForTimezoneCI } from "./lib/timezone-merge.mjs";
import { timezoneGithubApi } from "./lib/timezone-github.mjs";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const runId = event.workflow_run?.id ?? event.inputs?.ci_run_id;
if (!process.env.GH_TOKEN) throw new Error("Timezone merge gate requires a workflow token");
const api = timezoneGithubApi(process.env.GH_TOKEN);
// CI dispatches this workflow as its final job. Wait for that job/run to close
// before checking the full CI conclusion; the merge gates themselves are unchanged.
await waitForTimezoneCI({ api, repo: process.env.GITHUB_REPOSITORY, runId });
const result = await mergeTimezoneUpdate({ api, repo: process.env.GITHUB_REPOSITORY, runId,
  dryRun: process.env.TZ_MERGE_DRY_RUN === "true" });
console.log(JSON.stringify(result));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Timezone merge gate\n\n${JSON.stringify(result)}\n`);
