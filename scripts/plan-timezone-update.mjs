import { appendFile } from "node:fs/promises";
import { fetchIanaVersion } from "./lib/timezone-check.mjs";
import { planRelease, readPinnedVersions } from "./lib/timezone-update.mjs";

const pinned = await readPinnedVersions(new URL("../", import.meta.url));
if (new Set(Object.values(pinned)).size !== 1) throw new Error("Pinned timezone versions disagree; review before updating");
const plan = planRelease(pinned.providerVersion, await fetchIanaVersion(), {
  dryRun: process.env.TZ_DRY_RUN === "true", rebuild: process.env.TZ_REBUILD_CURRENT === "true",
});
if (plan.update && process.env.GITHUB_REPOSITORY && process.env.GH_TOKEN && process.env.TZ_DRY_RUN !== "true") {
  const repo = process.env.GITHUB_REPOSITORY;
  const query = new URLSearchParams({ state: "all", head: `${repo.split("/")[0]}:${plan.branch}`, per_page: "100" });
  const response = await fetch(`https://api.github.com/repos/${repo}/pulls?${query}`, {
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Cannot check existing timezone PRs: HTTP ${response.status}`);
  const existing = (await response.json()).find(pr => pr.head.ref === plan.branch);
  if (existing) { plan.update = false; plan.existingPr = existing.html_url; plan.existingState = existing.state; }
}
console.log(JSON.stringify(plan));
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `update=${plan.update}\nversion=${plan.version}\n`);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
  `## Timezone update plan\n\nBundled ${pinned.providerVersion}; IANA ${plan.version}.\n\n` +
  (plan.existingPr ? `Existing ${plan.existingState} PR: ${plan.existingPr}. No duplicate or overwrite.\n` : plan.update ? "Preparing a candidate.\n" : "Already current; no changes.\n"));
