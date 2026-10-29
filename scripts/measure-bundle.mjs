import { build } from "vite";
import { gzipSync } from "node:zlib";

const result = await build({
  logLevel: "silent",
  build: { write: false, reportCompressedSize: false },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
const assets = outputs.map((item) => {
  const data = item.type === "chunk" ? Buffer.from(item.code) : Buffer.from(item.source);
  return { file: item.fileName, bytes: data.length, gzipBytes: gzipSync(data).length };
});
const totals = (suffix) => assets.filter((asset) => asset.file.endsWith(suffix)).reduce(
  (sum, asset) => ({ bytes: sum.bytes + asset.bytes, gzipBytes: sum.gzipBytes + asset.gzipBytes }), { bytes: 0, gzipBytes: 0 });
console.log(JSON.stringify({ node: process.version, js: totals(".js"), css: totals(".css"), assets }, null, 2));
