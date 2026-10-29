import { UPDATE_FILES, validateVersion } from "./timezone-update.mjs";

// The publishing job handles data only. No generated code, patches or scripts run here.
export async function publishTimezoneUpdate({ api, repo, base, baseSha, version, files, report, runUrl }) {
  validateVersion(version);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[a-f0-9]{40}$/.test(baseSha)) throw new Error("Invalid repository or base SHA");
  if (Object.keys(files).sort().join("\n") !== [...UPDATE_FILES].sort().join("\n")) throw new Error("Unexpected candidate files");
  const branch = `automation/timezone-${version}`, prefix = `/repos/${repo}`;
  const query = new URLSearchParams({ state: "all", head: `${repo.split("/")[0]}:${branch}`, per_page: "100" });
  const existing = (await api("GET", `${prefix}/pulls?${query}`)).find(pr => pr.head.ref === branch);
  if (existing) return { url: existing.html_url, state: "existing", number: existing.number };
  const currentBase = await api("GET", `${prefix}/git/ref/heads/${encodeURIComponent(base)}`);
  if (currentBase.object.sha !== baseSha) throw new Error("Default branch advanced during generation; rerun against the new base");
  const parent = await api("GET", `${prefix}/git/commits/${baseSha}`);
  const tree = [];
  for (const file of UPDATE_FILES) {
    const blob = await api("POST", `${prefix}/git/blobs`, { content: Buffer.from(files[file]).toString("base64"), encoding: "base64" });
    tree.push({ path: file, mode: "100644", type: "blob", sha: blob.sha });
  }
  const generated = await api("POST", `${prefix}/git/trees`, { base_tree: parent.tree.sha, tree });
  if (generated.sha === parent.tree.sha) return { state: "unchanged" };
  const refPath = `${prefix}/git/ref/heads/${branch}`;
  let ref = await api("GET", refPath);
  if (!ref) {
    const commit = await api("POST", `${prefix}/git/commits`, {
      message: `Update bundled timezone data to IANA ${version}`, tree: generated.sha, parents: [baseSha],
      author: { name: "github-actions[bot]", email: "41898282+github-actions[bot]@users.noreply.github.com" },
      committer: { name: "github-actions[bot]", email: "41898282+github-actions[bot]@users.noreply.github.com" },
    });
    try { await api("POST", `${prefix}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha }); }
    catch (error) { if (error.status !== 422) throw error; }
    ref = await api("GET", refPath);
  }
  // Recover an orphaned branch after interrupted PR creation, but never overwrite it.
  const branchCommit = await api("GET", `${prefix}/git/commits/${ref.object.sha}`);
  if (branchCommit.tree.sha !== generated.sha || branchCommit.parents[0]?.sha !== baseSha) throw new Error("Update branch contains different work; refusing to overwrite it");
  const pr = await api("POST", `${prefix}/pulls`, {
    title: `Update timezone rules to IANA ${version}`, head: branch, base, draft: false,
    body: `New IANA timezone data will merge automatically only after full CI and regression checks pass for this exact commit. Mark this PR as draft or request changes to hold it.\n\n` +
      `Full CI is dispatched on this branch after PR creation. Generation and independent oracle checks: ${runUrl}.\n\n` +
      `Review existing legislation-specific tests if CI fails; automation does not rewrite those expectations.\n\n${report.slice(0, 48000)}`,
  });
  await api("POST", `${prefix}/actions/workflows/ci.yml/dispatches`, { ref: branch });
  return { url: pr.html_url, number: pr.number, state: "created" };
}
