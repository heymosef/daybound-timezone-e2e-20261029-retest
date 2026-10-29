// Serves only the generated offline fixture. Does not load environment files.
import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = await realpath(path.join(project, "node_modules/.cache/daybound-smoke/site"));
const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
};
const contained = (file) => file.startsWith(root + path.sep);
const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end(); return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1:4176").pathname);
    const candidate = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!contained(candidate)) { response.writeHead(403).end(); return; }
    const file = await realpath(candidate);
    if (!contained(file)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream" });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 404).end();
  }
});
server.on("error", (error) => { console.error(error); process.exitCode = 1; });
server.listen(4176, "127.0.0.1", () => console.log("Offline fixture listening on http://127.0.0.1:4176"));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { server.close(); server.closeAllConnections(); });
}
