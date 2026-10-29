// Offline verification: provenance/coverage metadata is bound to reviewed binary hashes.
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(await readFile("public/fonts/manifest.json", "utf8"));
const css = await readFile("src/styles/fonts.css", "utf8");
const html = await readFile("index.html", "utf8");
const original = await readFile("public/fonts/google-fonts-baseline.css", "utf8");
assert.equal(sha(original), manifest.baselineCssSha256, "Captured official CSS changed");
assert(!/https?:\/\/|@import/.test(css), "Product CSS must use only local faces");
assert(!/fonts\.(googleapis|gstatic)\.com/.test(html), "Obsolete external font connection");
assert.deepEqual(Object.keys(manifest.families).sort(), ["Geist Mono", "Inter", "Pixelify Sans"]);
assert.equal(manifest.files.length, 16, "Preserve every baseline Unicode subset");
const files = await readdir("public/fonts");
assert.deepEqual(files.filter(f => f.endsWith(".woff2")).sort(), manifest.files.map(f => f.file).sort());
for (const [family, provenance] of Object.entries(manifest.families)) {
  assert.match(provenance.commit, /^[a-f0-9]{40}$/);
  const license = await readFile(`public/fonts/${provenance.license}`, "utf8");
  assert.equal(sha(license), provenance.licenseSha256, `${family} license checksum`);
  assert.match(license, /Copyright/);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
}
for (const font of manifest.files) {
  assert.match(font.file, /^[a-z0-9-]+\.woff2$/);
  assert.match(font.sourceURL, /^https:\/\/fonts\.gstatic\.com\/s\//);
  const bytes = await readFile(`public/fonts/${font.file}`);
  assert.equal(bytes.toString("ascii", 0, 4), "wOF2");
  assert.equal(bytes.length, font.bytes);
  assert.equal(sha(bytes), font.sha256, `${font.file} checksum`);
  const rule = [...css.matchAll(/@font-face\s*\{[^}]+\}/g)].map(match => match[0]).find(rule => rule.includes(`/fonts/${font.file}`));
  assert(rule, `${font.file} face present`);
  for (const value of [`font-family: '${font.family}'`, `font-weight: ${font.weight}`, `unicode-range: ${font.unicodeRange}`, "font-display: swap", "font-style: normal"]) assert(rule.includes(value), `${font.file}: ${value}`);
  const baselineRule = [...original.matchAll(/@font-face\s*\{[^}]+\}/g)].map(match => match[0]).find(rule => rule.includes(font.sourceURL));
  assert.equal(rule.replace(`url("/fonts/${font.file}")`, `url(${font.sourceURL})`), baselineRule, `${font.file} baseline coverage/style equality`);
  assert(font.metadata?.cmapSha256 && font.metadata?.codepointRanges?.length, `${font.file} reviewed font metadata missing`);
}
console.log(`Verified${manifest.files.length} local WOFF2 subsets, exact baseline CSS coverage, checksums and three OFL licenses`);
