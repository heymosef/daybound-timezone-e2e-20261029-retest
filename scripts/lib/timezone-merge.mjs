import { compareVersions, UPDATE_FILES } from "./timezone-update.mjs";

const BOT = "github-actions[bot]";
const CI_PATH = ".github/workflows/ci.yml";
const REQUIRED_STEPS = ["Install", "Typecheck", "Lint", "Test", "Test maintenance automation offline", "Install Chromium", "Browser smoke", "Build"];

export async function waitForTimezoneCI({ api, repo, runId, now = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 120000 }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^\d+$/.test(String(runId))) throw new Error("Invalid repository or CI run ID");
  const deadline = now() + timeoutMs;
  for (;;) {
    const run = await api("GET", `/repos/${repo}/actions/runs/${runId}`);
    if (run.status === "completed" || run.path !== CI_PATH || run.head_repository?.full_name !== repo ||
        !/^automation\/timezone-\d{4}[a-z]+$/.test(run.head_branch ?? "")) return;
    if (now() >= deadline) throw new Error("CI did not finish its handoff within two minutes; no merge was attempted");
    await sleep(5000);
  }
}

async function all(api, endpoint, key) {
  const items = [];
  for (let page = 1; page <= 20; page++) {
    const result = await api("GET", `${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    const batch = key ? result[key] : result;
    items.push(...batch);
    if (batch.length < 100) return items;
  }
  throw new Error("Too many GitHub results to verify automatic merge safely");
}

export async function mergeTimezoneUpdate({ api, repo, runId, dryRun = false }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^\d+$/.test(String(runId))) throw new Error("Invalid repository or CI run ID");
  const prefix = `/repos/${repo}`;
  const skip = reason => ({ state: "not-merged", reason });
  const trigger = await api("GET", `${prefix}/actions/runs/${runId}`);
  const version = trigger.head_branch?.match(/^automation\/timezone-(\d{4}[a-z]+)$/)?.[1];
  if (!version || trigger.path !== CI_PATH || trigger.head_repository?.full_name !== repo ||
      trigger.status !== "completed" || trigger.conclusion !== "success") return skip("Not a successful timezone CI run in this repository");
  const metadata = await api("GET", prefix);
  const base = metadata.default_branch;
  const query = new URLSearchParams({ state: "open", base, head: `${repo.split("/")[0]}:${trigger.head_branch}` });
  const matches = await all(api, `${prefix}/pulls?${query}`);
  if (matches.length !== 1) return skip("No unique open timezone update PR");
  const number = matches[0].number;
  const pr = await api("GET", `${prefix}/pulls/${number}`);
  const head = trigger.head_sha;
  if (pr.user.login !== BOT || pr.user.type !== "Bot" || pr.head.repo.full_name !== repo ||
      pr.base.repo.full_name !== repo || pr.base.ref !== base || pr.head.ref !== trigger.head_branch ||
      pr.head.sha !== head || pr.state !== "open" || pr.draft || pr.mergeable !== true) return skip("PR identity, tested commit, ready state or mergeability changed");
  const files = await all(api, `${prefix}/pulls/${number}/files`);
  if (!files.length || files.length !== pr.changed_files || files.some(file => !UPDATE_FILES.includes(file.filename) || !["added", "modified"].includes(file.status))) {
    return skip("PR contains files outside the generated timezone data allowlist");
  }
  const currentBase = (await api("GET", `${prefix}/git/ref/heads/${encodeURIComponent(base)}`)).object.sha;
  const commit = await api("GET", `${prefix}/commits/${head}`);
  if (pr.base.sha !== currentBase || commit.parents.length !== 1 || commit.parents[0].sha !== currentBase ||
      commit.author?.login !== BOT || commit.committer?.login !== BOT || pr.commits !== 1) return skip("Base advanced or update includes human changes; fresh generation/CI is needed");
  const readJson = async (file, ref) => {
    const content = await api("GET", `${prefix}/contents/${file}?ref=${ref}`);
    return JSON.parse(Buffer.from(content.content, "base64").toString("utf8"));
  };
  const [previous, proposed] = await Promise.all([
    readJson("docs/timezone-provenance.json", currentBase), readJson("docs/timezone-provenance.json", head),
  ]);
  if (proposed.version !== version || compareVersions(version, previous.version) <= 0) return skip("This is not a newer IANA release");
  const reviews = await all(api, `${prefix}/pulls/${number}/reviews`);
  const latestReview = new Map();
  for (const review of reviews.sort((a, b) => a.id - b.id)) {
    if (["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(review.state)) latestReview.set(review.user.login, review.state);
  }
  if ([...latestReview.values()].includes("CHANGES_REQUESTED")) return skip("A reviewer requested changes");

  const runs = await all(api, `${prefix}/actions/runs?head_sha=${head}`, "workflow_runs");
  const latestRuns = new Map();
  for (const run of runs.sort((a, b) => b.id - a.id)) {
    const key = `${run.workflow_id}:${run.event}`;
    if (!latestRuns.has(key)) latestRuns.set(key, run);
  }
  const dispatch = [...latestRuns.values()].find(run => run.path === CI_PATH && run.event === "workflow_dispatch" && run.head_sha === head && run.status === "completed" && run.conclusion === "success");
  if (!dispatch) return skip("The latest explicitly dispatched full CI did not pass for this commit");
  const jobs = await all(api, `${prefix}/actions/runs/${dispatch.id}/jobs?filter=latest`, "jobs");
  const validation = jobs.find(job => job.name === "validate");
  if (!validation || validation.conclusion !== "success" || REQUIRED_STEPS.some(name => !validation.steps.some(step => step.name === name && step.conclusion === "success"))) {
    return skip("Full CI is missing a successful required validation step");
  }
  // GitHub can require workflow approval for PRs created using GITHUB_TOKEN.
  // Approve only the redundant CI run for this already-validated, data-only bot PR.
  const awaitingApproval = [...latestRuns.values()].filter(run => run.path === CI_PATH && run.event === "pull_request" && run.conclusion === "action_required" && run.head_sha === head);
  if (awaitingApproval.length) {
    if (!dryRun) for (const run of awaitingApproval) await api("POST", `${prefix}/actions/runs/${run.id}/approve`);
    return { state: dryRun ? "would-approve-ci" : "awaiting-ci", number };
  }
  if ([...latestRuns.values()].some(run => run.status !== "completed" || run.conclusion !== "success")) return skip("A workflow is pending, failed, cancelled or skipped");
  const checks = await all(api, `${prefix}/commits/${head}/check-runs?filter=latest`, "check_runs");
  const latestChecks = new Map();
  for (const check of checks.sort((a, b) => b.id - a.id)) {
    const key = `${check.app.id}:${check.name}`;
    if (!latestChecks.has(key)) latestChecks.set(key, check);
  }
  if (!latestChecks.size || [...latestChecks.values()].some(check => check.status !== "completed" || check.conclusion !== "success")) return skip("A check is pending or not successful");
  const statuses = await api("GET", `${prefix}/commits/${head}/status`);
  if (statuses.total_count > 0 && statuses.state !== "success") return skip("A commit status is pending or not successful");

  // Re-read state after verification; GitHub's merge API also compares the head SHA atomically.
  const fresh = await api("GET", `${prefix}/pulls/${number}`);
  const freshBase = (await api("GET", `${prefix}/git/ref/heads/${encodeURIComponent(base)}`)).object.sha;
  if (fresh.head.sha !== head || fresh.base.sha !== currentBase || freshBase !== currentBase || fresh.state !== "open" || fresh.draft || fresh.mergeable !== true) return skip("PR or base moved during verification");
  if (dryRun) return { state: "would-merge", number, head };
  const merged = await api("PUT", `${prefix}/pulls/${number}/merge`, { sha: head, merge_method: "squash" });
  if (!merged.merged) throw new Error("GitHub declined the verified timezone merge");
  // GITHUB_TOKEN merges do not trigger push workflows, so preserve normal Pages publication explicitly.
  await api("POST", `${prefix}/actions/workflows/pages.yml/dispatches`, { ref: base });
  return { state: "merged", number, head, sha: merged.sha };
}
