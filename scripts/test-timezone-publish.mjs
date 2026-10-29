import assert from "node:assert/strict";
import test from "node:test";
import { publishTimezoneUpdate } from "./lib/timezone-publish.mjs";
import { UPDATE_FILES } from "./lib/timezone-update.mjs";

function fixture(options = {}) {
  const calls = [], baseSha = "a".repeat(40), branchSha = "b".repeat(40);
  let ref = options.ref ? { object: { sha: branchSha } } : null;
  let rejectPrOnce = options.rejectPrOnce;
  const args = { repo: "owner/repo", base: "main", baseSha, version: "2026g",
    files: Object.fromEntries(UPDATE_FILES.map(file => [file, `data for ${file}`])), report: "Release notes", runUrl: "https://example.invalid/run",
    api: async (method, endpoint, body) => {
      calls.push({ method, endpoint, body });
      if (method === "GET" && endpoint.includes("/pulls?")) return options.existing ? [{ number: 9, head: { ref: "automation/timezone-2026g" }, html_url: "existing", state: options.existing }] : [];
      if (method === "GET" && endpoint.endsWith("/git/ref/heads/main")) return { object: { sha: options.advanced ? branchSha : baseSha } };
      if (method === "GET" && endpoint.endsWith(`/git/commits/${baseSha}`)) return { tree: { sha: "base-tree" } };
      if (method === "POST" && endpoint.endsWith("/git/blobs")) return { sha: `blob-${calls.length}` };
      if (method === "POST" && endpoint.endsWith("/git/trees")) return { sha: "updated-tree" };
      if (method === "GET" && endpoint.endsWith("/git/ref/heads/automation/timezone-2026g")) return ref;
      if (method === "POST" && endpoint.endsWith("/git/commits")) return { sha: branchSha };
      if (method === "POST" && endpoint.endsWith("/git/refs")) { ref = { object: { sha: branchSha } }; return ref; }
      if (method === "GET" && endpoint.endsWith(`/git/commits/${branchSha}`)) return { tree: { sha: options.modified ? "human-work" : "updated-tree" }, parents: [{ sha: baseSha }] };
      if (method === "POST" && endpoint.endsWith("/pulls")) {
        if (rejectPrOnce) { rejectPrOnce = false; throw new Error("PR creation forbidden"); }
        return { html_url: "new-pr", number: 10 };
      }
      if (method === "POST" && endpoint.endsWith("/dispatches")) {
        if (options.dispatchFailure) throw new Error("CI dispatch failed");
        return null;
      }
      assert.fail(`Unexpected GitHub operation: ${method} ${endpoint}`);
    } };
  return { calls, args };
}
test("opens a ready PR containing only generated data and explicitly dispatches CI", async () => {
  const { args, calls } = fixture();
  assert.equal((await publishTimezoneUpdate(args)).state, "created");
  assert.equal(calls.find(call => call.endpoint.endsWith("/pulls")).body.draft, false);
  assert.deepEqual(calls.find(call => call.endpoint.endsWith("/git/trees")).body.tree.map(entry => entry.path), UPDATE_FILES);
  const commit = calls.find(call => call.endpoint.endsWith("/git/commits")).body;
  assert.equal(commit.author.email, "41898282+github-actions[bot]@users.noreply.github.com");
  assert.deepEqual(commit.committer, commit.author);
  assert.deepEqual(calls.at(-1).body, { ref: "automation/timezone-2026g" });
  assert.ok(calls.every(call => ["GET", "POST"].includes(call.method))); // No force update, merge or deployment.
});
for (const state of ["open", "closed"]) test(`an existing ${state} PR is preserved without duplicate writes`, async () => {
  const { args, calls } = fixture({ existing: state });
  assert.equal((await publishTimezoneUpdate(args)).state, "existing");
  assert.ok(calls.every(call => call.method === "GET"));
});
test("default branch movement aborts before creating Git objects", async () => {
  const { args, calls } = fixture({ advanced: true });
  await assert.rejects(publishTimezoneUpdate(args), /Default branch advanced/);
  assert.ok(calls.every(call => call.method === "GET"));
});
test("unexpected paths are rejected before contacting GitHub", async () => {
  const { args, calls } = fixture(); args.files[".github/workflows/unsafe.yml"] = "code";
  await assert.rejects(publishTimezoneUpdate(args), /Unexpected candidate files/);
  assert.equal(calls.length, 0);
});
test("human changes to an update branch are never overwritten", async () => {
  const { args, calls } = fixture({ ref: true, modified: true });
  await assert.rejects(publishTimezoneUpdate(args), /refusing to overwrite/);
  assert.ok(!calls.some(call => call.endpoint.endsWith("/git/refs") || call.endpoint.endsWith("/pulls")));
});
test("an interrupted PR creation can reuse the identical orphaned branch", async () => {
  const { args, calls } = fixture({ rejectPrOnce: true });
  await assert.rejects(publishTimezoneUpdate(args), /forbidden/);
  assert.equal((await publishTimezoneUpdate(args)).state, "created");
  assert.equal(calls.filter(call => call.endpoint.endsWith("/git/refs")).length, 1);
});
test("dispatch failure is reported instead of claiming full CI ran", async () => {
  await assert.rejects(publishTimezoneUpdate(fixture({ dispatchFailure: true }).args), /CI dispatch failed/);
});
