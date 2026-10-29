import assert from "node:assert/strict";
import test from "node:test";
import { mergeTimezoneUpdate, waitForTimezoneCI } from "./lib/timezone-merge.mjs";
import { UPDATE_FILES } from "./lib/timezone-update.mjs";
import { timezoneGithubApi } from "./lib/timezone-github.mjs";

function fixture(options = {}) {
  const base = "a".repeat(40), head = "b".repeat(40), other = "c".repeat(40);
  const calls = [];
  let prReads = 0, baseReads = 0;
  const run = { id: 17, workflow_id: 1, event: "workflow_dispatch", head_branch: "automation/timezone-2026g", head_sha: head,
    head_repository: { full_name: "owner/repo" }, path: ".github/workflows/ci.yml", status: "completed", conclusion: "success", ...options.run };
  const pr = { number: 9, user: { login: "github-actions[bot]", type: "Bot" }, head: { ref: run.head_branch, sha: head, repo: { full_name: "owner/repo" } },
    base: { ref: "main", sha: base, repo: { full_name: "owner/repo" } }, state: "open", draft: false, mergeable: true, changed_files: UPDATE_FILES.length, commits: 1, ...options.pr };
  const steps = ["Install", "Typecheck", "Lint", "Test", "Test maintenance automation offline", "Install Chromium", "Browser smoke", "Build"].map(name => ({ name, conclusion: name === options.failedStep ? "failure" : "success" }));
  const args = { repo: "owner/repo", runId: 17, dryRun: options.dryRun ?? false,
    api: async (method, endpoint, body) => {
      calls.push({ method, endpoint, body });
      const url = new URL(endpoint, "https://api.github.com"), path = url.pathname;
      if (method === "GET" && path.endsWith("/actions/runs/17")) return structuredClone(run);
      if (method === "GET" && path === "/repos/owner/repo") return { default_branch: "main" };
      if (method === "GET" && path.endsWith("/pulls")) return [{ number: 9 }];
      if (method === "GET" && path.endsWith("/pulls/9")) {
        prReads++;
        return structuredClone(prReads > 1 && options.movedHead ? { ...pr, head: { ...pr.head, sha: other } } : pr);
      }
      if (method === "GET" && path.endsWith("/pulls/9/files")) return options.files ?? UPDATE_FILES.map(filename => ({ filename, status: "modified" }));
      if (method === "GET" && path.endsWith("/git/ref/heads/main")) {
        baseReads++;
        return { object: { sha: options.advanced || (options.baseRace && baseReads > 1) ? other : base } };
      }
      if (method === "GET" && path.endsWith(`/commits/${head}`)) return { parents: [{ sha: base }], author: { login: options.humanCommit ? "human" : "github-actions[bot]" }, committer: { login: "github-actions[bot]" } };
      if (method === "GET" && path.endsWith("/contents/docs/timezone-provenance.json")) return { content: Buffer.from(JSON.stringify({ version: url.searchParams.get("ref") === base ? "2026f" : options.version ?? "2026g" })).toString("base64") };
      if (method === "GET" && path.endsWith("/pulls/9/reviews")) return options.reviews ?? [];
      if (method === "GET" && path.endsWith("/actions/runs")) return { workflow_runs: options.runs ?? [structuredClone(run)] };
      if (method === "GET" && path.endsWith("/actions/runs/17/jobs")) return { jobs: [{ name: "validate", conclusion: "success", steps }] };
      if (method === "GET" && path.endsWith(`/commits/${head}/check-runs`)) return { check_runs: options.checks ?? [{ id: 1, app: { id: 1 }, name: "validate", status: "completed", conclusion: "success" }] };
      if (method === "GET" && path.endsWith(`/commits/${head}/status`)) return options.statuses ?? { total_count: 0, state: "pending" };
      if (method === "POST" && path.endsWith("/actions/runs/16/approve")) return null;
      if (method === "PUT" && path.endsWith("/pulls/9/merge")) return { merged: !options.mergeRejected, sha: other };
      if (method === "POST" && path.endsWith("/actions/workflows/pages.yml/dispatches")) return null;
      assert.fail(`Unexpected ${method} ${endpoint}`);
    } };
  return { args, calls, run };
}

test("merges only the exact fully tested commit, then explicitly dispatches Pages", async () => {
  const { args, calls } = fixture();
  const result = await mergeTimezoneUpdate(args);
  assert.equal(result.state, "merged");
  assert.deepEqual(calls.filter(call => call.method !== "GET").map(call => [call.method, call.body]), [
    ["PUT", { sha: "b".repeat(40), merge_method: "squash" }], ["POST", { ref: "main" }],
  ]);
});

for (const [name, options] of [
  ["failed CI", { run: { conclusion: "failure" } }],
  ["wrong workflow", { run: { path: ".github/workflows/other.yml" } }],
  ["fork", { run: { head_repository: { full_name: "fork/repo" } } }],
  ["other branch", { run: { head_branch: "feature/other" } }],
  ["human PR", { pr: { user: { login: "human", type: "User" } } }],
  ["draft hold", { pr: { draft: true } }],
  ["conflict", { pr: { mergeable: false } }],
  ["stale head", { pr: { head: { ref: "automation/timezone-2026g", sha: "c".repeat(40), repo: { full_name: "owner/repo" } } } }],
  ["source changes", { files: [{ filename: "src/app/App.tsx", status: "modified" }], pr: { changed_files: 1 } }],
  ["deleted generated data", { files: UPDATE_FILES.map(filename => ({ filename, status: "removed" })) }],
  ["advanced base", { advanced: true }],
  ["human edits", { humanCommit: true }],
  ["version mismatch", { version: "2026f" }],
  ["requested changes", { reviews: [{ id: 1, user: { login: "reviewer" }, state: "CHANGES_REQUESTED" }] }],
  ["failed regression step", { failedStep: "Test" }],
  ["failed maintenance step", { failedStep: "Test maintenance automation offline" }],
  ["failed browser step", { failedStep: "Browser smoke" }],
  ["pending check", { checks: [{ id: 2, app: { id: 1 }, name: "external", status: "in_progress", conclusion: null }] }],
  ["failed status", { statuses: { total_count: 1, state: "failure" } }],
  ["head race", { movedHead: true }],
  ["base race", { baseRace: true }],
]) test(`${name} prevents every merge/deployment write`, async () => {
  const { args, calls } = fixture(options);
  assert.equal((await mergeTimezoneUpdate(args)).state, "not-merged");
  assert.ok(calls.every(call => call.method === "GET"));
});

test("a newer failed or pending workflow prevents merge despite an older successful CI", async () => {
  const { args, calls, run } = fixture();
  const api = args.api;
  args.api = (method, endpoint, body) => endpoint.split("?")[0].endsWith("/actions/runs") ? Promise.resolve({ workflow_runs: [{ ...run, id: 18, status: "in_progress", conclusion: null }, run] }) : api(method, endpoint, body);
  assert.equal((await mergeTimezoneUpdate(args)).state, "not-merged");
  assert.ok(calls.every(call => call.method === "GET"));
});
test("approval-required duplicate CI is approved only after the dispatched full suite passes", async () => {
  const { args, calls, run } = fixture();
  const api = args.api;
  args.api = (method, endpoint, body) => endpoint.split("?")[0].endsWith("/actions/runs") ? Promise.resolve({ workflow_runs: [run, { ...run, id: 16, event: "pull_request", conclusion: "action_required" }] }) : api(method, endpoint, body);
  assert.equal((await mergeTimezoneUpdate(args)).state, "awaiting-ci");
  assert.deepEqual(calls.filter(call => call.method !== "GET").map(call => call.endpoint), ["/repos/owner/repo/actions/runs/16/approve"]);
});
test("dry run verifies a positive candidate without approving, merging or deploying", async () => {
  const { args, calls } = fixture({ dryRun: true });
  assert.equal((await mergeTimezoneUpdate(args)).state, "would-merge");
  assert.ok(calls.every(call => call.method === "GET"));
});
test("a rejected merge never dispatches deployment", async () => {
  const { args, calls } = fixture({ mergeRejected: true });
  await assert.rejects(mergeTimezoneUpdate(args), /declined/);
  assert.ok(!calls.some(call => call.endpoint.includes("pages.yml")));
});
test("GitHub workflow approval and dispatch accept successful empty response bodies", async () => {
  for (const status of [201, 204]) {
    const api = timezoneGithubApi("offline-only", async () => new Response(null, { status }));
    assert.equal(await api("POST", "/repos/owner/repo/actions/runs/16/approve"), null);
  }
});
test("a superseded failed check does not block its successful rerun", async () => {
  const { args } = fixture({ checks: [
    { id: 1, app: { id: 1 }, name: "validate", status: "completed", conclusion: "failure" },
    { id: 2, app: { id: 1 }, name: "validate", status: "completed", conclusion: "success" },
  ] });
  assert.equal((await mergeTimezoneUpdate(args)).state, "merged");
});
test("an explicit CI handoff waits for the source run to finish without merging early", async () => {
  let reads = 0, elapsed = 0;
  await waitForTimezoneCI({ repo: "owner/repo", runId: 17, now: () => elapsed,
    sleep: async ms => { elapsed += ms; }, api: async method => {
      assert.equal(method, "GET"); reads++;
      return { path: ".github/workflows/ci.yml", head_repository: { full_name: "owner/repo" },
        head_branch: "automation/timezone-2026g", status: reads < 3 ? "in_progress" : "completed" };
    } });
  assert.equal(reads, 3); assert.equal(elapsed, 10000);
});
test("a stuck CI handoff times out without any write request", async () => {
  let elapsed = 0;
  await assert.rejects(waitForTimezoneCI({ repo: "owner/repo", runId: 17, now: () => elapsed,
    sleep: async ms => { elapsed += ms; }, timeoutMs: 5000, api: async method => {
      assert.equal(method, "GET");
      return { path: ".github/workflows/ci.yml", head_repository: { full_name: "owner/repo" },
        head_branch: "automation/timezone-2026g", status: "in_progress" };
    } }), /no merge was attempted/);
});
