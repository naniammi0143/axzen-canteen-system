const http = require("http");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "employee-web");
const port = Number(process.env.PORT || 4175);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(rootDir, relative);
  if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, ext === ".html" ? "utf8" : undefined, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end("Failed to read file");
      return;
    }
    let body = data;
    if (ext === ".html") {
      body = String(data).replace(
        "const API = (window.Capacitor || location.protocol === \"capacitor:\") ? liveApi : \"\";",
        "const API = liveApi;"
      );
    }
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Employee CRM preview http://127.0.0.1:${port}`);
});
