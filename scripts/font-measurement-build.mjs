// Isolated production measurement build. Never reads credentials from .env.
import path from "node:path";
import { build } from "vite";
if (!process.version.startsWith("v24.")) throw new Error("Use Node24");
await build({
  configFile: path.resolve("vite.config.ts"), envFile: false,
  define: {
    "import.meta.env.VITE_PUBLIC_POSTHOG_KEY": "undefined",
    "import.meta.env.VITE_PUBLIC_POSTHOG_HOST": "undefined",
  },
  build: { outDir: "node_modules/.cache/daybound-fonts/site", emptyOutDir: true },
});
