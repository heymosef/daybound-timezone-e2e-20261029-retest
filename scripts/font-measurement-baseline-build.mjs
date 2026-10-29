// Rebuild the official remote-font baseline against the SAME current product source.
// This build-only override avoids temporary edits to shared application files.
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { build, loadConfigFromFile } from "vite";
if (!process.version.startsWith("v24.")) throw new Error("Use Node24");
const cssPath = path.resolve("src/styles/index.css");
const manifest = JSON.parse(await readFile("public/fonts/manifest.json", "utf8"));
const loaded = await loadConfigFromFile({ command: "build", mode: "production" }, path.resolve("vite.config.ts"));
if (!loaded) throw new Error("Missing project Vite config");
await build({
  ...loaded.config, configFile: false, envFile: false,
  define: { "import.meta.env.VITE_PUBLIC_POSTHOG_KEY": "undefined", "import.meta.env.VITE_PUBLIC_POSTHOG_HOST": "undefined" },
  plugins: [{
    name: "measurement-only-remote-font-baseline", enforce: "pre",
    transform(code, id) { if (id.split("?")[0] === cssPath) return code.replace('@import "./fonts.css";', `@import url("${manifest.baselineCssURL}");`); },
    transformIndexHtml: { order: "pre", handler: html => html.replace("    <title>", '    <link rel="preconnect" href="https://fonts.googleapis.com" />\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n    <title>') },
  }, ...(loaded.config.plugins ?? [])],
  build: { outDir: "node_modules/.cache/daybound-fonts/baseline-site", emptyOutDir: true },
});

const assetDirectory = "node_modules/.cache/daybound-fonts/baseline-site/assets";
const outputCSS = (await Promise.all((await readdir(assetDirectory)).filter(file => file.endsWith(".css")).map(file => readFile(path.join(assetDirectory, file), "utf8")))).join("\n");
if (!outputCSS.includes(manifest.baselineCssURL) || outputCSS.includes("/fonts/")) throw new Error("Baseline font override did not survive CSS processing");
const outputHTML = await readFile("node_modules/.cache/daybound-fonts/baseline-site/index.html", "utf8");
if (!outputHTML.includes('rel="preconnect" href="https://fonts.googleapis.com"') || !outputHTML.includes('rel="preconnect" href="https://fonts.gstatic.com" crossorigin')) throw new Error("Original baseline preconnects missing");
