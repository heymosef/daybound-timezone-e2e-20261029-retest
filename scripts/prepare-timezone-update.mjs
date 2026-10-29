import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { BUILDER_COMMIT, UPDATE_FILES, regressionProbes, releaseNotes, sha256, validateVersion } from "./lib/timezone-update.mjs";

const { values } = parseArgs({ options: { version: { type: "string" }, builder: { type: "string" }, baseline: { type: "string" } } });
const version = validateVersion(values.version);
const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), "daybound-tz-"));
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: "inherit", timeout: 180000 });
try {
  const checkout = values.builder ? path.resolve(values.builder) : path.join(temporary, "builder");
  if (!values.builder) {
    await mkdir(checkout);
    run("git", ["init", "--quiet"], checkout);
    run("git", ["remote", "add", "origin", "https://github.com/js-joda/js-joda.git"], checkout);
    run("git", ["sparse-checkout", "set", "packages/tzdb-builder"], checkout);
    run("git", ["fetch", "--quiet", "--depth=1", "origin", BUILDER_COMMIT], checkout);
    run("git", ["checkout", "--quiet", "--detach", "FETCH_HEAD"], checkout);
  }
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: checkout, encoding: "utf8" }).trim();
  if (revision !== BUILDER_COMMIT) throw new Error("Builder checkout is not the pinned reviewed commit");
  // Also reject local modifications to the generator, including when --builder is supplied.
  run("git", ["diff", "--exit-code", "HEAD", "--", "packages/tzdb-builder/src"], checkout);
  const builder = path.join(checkout, "packages/tzdb-builder");
  run("npm", ["install", "--ignore-scripts", "--no-package-lock", "--workspaces=false", "--save-exact", "zx@8.8.5", "--registry=https://registry.npmjs.org"], builder);
  run("npm", ["run", "generate", "--", version], builder);
  const cache = path.join(builder, ".cache", version);
  const rules = await readFile(path.join(checkout, "packages/timezone/data/packed", `${version}.json`));
  const next = JSON.parse(rules);
  if (next.version !== version) throw new Error("Generator returned a different IANA version");
  const { readNames } = await import(pathToFileURL(path.join(builder, "src/compile.js")));
  const names = await readNames({ tzdbDir: path.join(cache, "tzdb") });
  const aliases = JSON.stringify({ version, names: [...names.zones, ...Object.keys(names.links)].sort(), aliases: names.links }) + "\n";
  const previous = JSON.parse(await readFile(values.baseline ?? path.join(root, UPDATE_FILES[0]), "utf8"));
  const { probes, changedZones } = regressionProbes(previous, next, JSON.parse(aliases).names);
  const oracle = execFileSync("python3", [path.join(root, "scripts/timezone-oracle.py"), path.join(cache, "zoneinfo")], {
    input: JSON.stringify(probes), encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024,
  });
  const fixtures = JSON.stringify({ version, previousVersion: previous.version, changedZones, samples: JSON.parse(oracle) }) + "\n";
  const archives = {};
  for (const kind of ["data", "code"]) archives[`tz${kind}${version}.tar.gz`] = sha256(await readFile(path.join(cache, `tz${kind}${version}.tar.gz`)));
  const provenance = JSON.stringify({ version, builderCommit: BUILDER_COMMIT, archives,
    rulesSha256: sha256(rules), aliasesSha256: sha256(aliases), regressionsSha256: sha256(fixtures) }, null, 2) + "\n";
  const notes = releaseNotes(await readFile(path.join(cache, "tzdb/NEWS"), "utf8"), version);
  const oldNames = new Set([...previous.zones.map(zone => zone.split("|")[0]), ...previous.links.map(link => link.split("|")[1])]);
  const currentNames = new Set(JSON.parse(aliases).names);
  const added = [...currentNames].filter(name => !oldNames.has(name));
  const removed = [...oldNames].filter(name => !currentNames.has(name));
  const report = `# IANA ${version} update\n\nPrevious rules: ${previous.version}. Generated with upstream builder ${BUILDER_COMMIT}.\n\n` +
    `Independent Python ZoneInfo/TZif regression samples: ${probes.length}.\n\nChanged offset/abbreviation zones and aliases: ${changedZones.join(", ") || "none"}.\n\n` +
    `Added names: ${added.join(", ") || "none"}. Removed names: ${removed.join(", ") || "none"}.\n\n` +
    `Review release notes, changed zones, city mappings and existing legislative expectations before merging. Existing regressions are never rewritten automatically.\n\n` +
    `Source: https://data.iana.org/time-zones/releases/tzdata${version}.tar.gz\n\n## IANA release notes\n\n\`\`\`text\n${notes.replaceAll("```", "'''")}\n\`\`\`\n`;
  const contents = [rules, aliases, fixtures, provenance, report];
  for (const [index, file] of UPDATE_FILES.entries()) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), contents[index]);
    if (process.env.TZ_CANDIDATE_DIR) {
      const target = path.join(process.env.TZ_CANDIDATE_DIR, file);
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(root, file), target);
    }
  }
  console.log(`Prepared IANA ${version}: ${changedZones.length} changed zones; ${probes.length} independent regression samples.`);
} finally { await rm(temporary, { recursive: true, force: true }); }
