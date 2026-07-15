import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL(".", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1));
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent((request.url || "/").split("?")[0]);
    const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
    const servedRelative = relative.startsWith("vendor/gsap/")
      ? join("node_modules", "gsap", relative.slice("vendor/gsap/".length))
      : relative;
    const filePath = normalize(join(root, servedRelative));
    if (!filePath.startsWith(normalize(root))) throw new Error("Invalid path");
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`无限学期灰盒运行于 http://127.0.0.1:${port}`);
});
