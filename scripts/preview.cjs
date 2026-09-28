// Dependency-free preview of the two standalone simulators (not a Jekyll build).
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };

function render(file) {
  return fs.readFileSync(file, "utf8")
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .replace(/{%\s*include\s+([\w.-]+)\s*%}/g, (_, name) => render(path.join(root, "_includes", name)))
    .replace(/{{\s*'([^']*)'\s*\|\s*relative_url\s*}}/g, "$1");
}

http.createServer((request, response) => {
  try {
    const route = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const pages = { "/": "watercolor", "/watercolor/": "watercolor", "/watercolor": "watercolor", "/watercolor/en/": "watercolor-en", "/watercolor/en": "watercolor-en", "/mayakovsky/": "mayakovsky" };
    const file = pages[route]
      ? path.join(root, "_page", `${pages[route]}.html`)
      : path.resolve(root, "." + route);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404); response.end("Not found"); return;
    }
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(path.extname(file) === ".html" ? render(file) : fs.readFileSync(file));
  } catch { response.writeHead(400); response.end("Bad request"); }
}).listen(port, "127.0.0.1", () => {
  console.log(`Watercolor: http://127.0.0.1:${port}/watercolor/`);
  console.log(`Mayakovsky: http://127.0.0.1:${port}/mayakovsky/`);
});
