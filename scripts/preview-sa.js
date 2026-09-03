const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const os = require("os");

const rootDir = path.resolve(__dirname, "..", "sa");
const port = Number(process.env.PORT || 4173);
const clients = new Set();
const watchers = new Set();
let fallbackWatching = false;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function safeFilePath(requestPath) {
  try {
    const normalized = path.normalize(decodeURIComponent(requestPath)).replace(/^([/\\])+/, "");
    const fullPath = path.resolve(rootDir, normalized);
    const relative = path.relative(rootDir, fullPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    return fullPath;
  } catch {
    return null;
  }
}

function injectLiveReload(html) {
  const snippet = `
<script>
(function () {
  try {
    var source = new EventSource('/__live_reload');
    source.onmessage = function (event) {
      if (event.data === 'reload') window.location.reload();
    };
  } catch (err) {
    console.warn('Live reload unavailable', err);
  }
})();
</script>`;
  if (html.includes("</body>")) return html.replace("</body>", `${snippet}</body>`);
  return html + snippet;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = mimeTypes[ext] || "application/octet-stream";
  const isHtml = ext === ".html";
  fs.readFile(filePath, isHtml ? "utf8" : undefined, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Failed to read file");
      return;
    }
    const body = isHtml ? injectLiveReload(data) : data;
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store"
    });
    res.end(body);
  });
}

function broadcastReload() {
  for (const res of [...clients]) {
    try {
      res.write("data: reload\n\n");
    } catch {
      clients.delete(res);
    }
  }
}

function startFallbackWatcher() {
  if (fallbackWatching) return;
  fallbackWatching = true;
  fs.watchFile(path.join(rootDir, "index.html"), { interval: 500 }, () => broadcastReload());
}

function watchTree(dir) {
  if (watchers.has(dir)) return;
  try {
    const watcher = fs.watch(dir, () => broadcastReload());
    watchers.add(dir);
    watcher.on("error", () => {
      try { watcher.close(); } catch {}
      watchers.delete(dir);
    });
  } catch {
    if (dir === rootDir) startFallbackWatcher();
    return;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      watchTree(path.join(dir, entry.name));
    }
  }
}

function localIpAddresses() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family === "IPv4" && !net.internal) ips.push(net.address);
    }
  }
  return [...new Set(ips)];
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "/", true);
  if (parsed.pathname === "/__live_reload") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    res.write("\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  const requestPath = parsed.pathname === "/" ? "/index.html" : parsed.pathname;
  const filePath = safeFilePath(requestPath);

  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath);
    return;
  }

  sendFile(res, path.join(rootDir, "index.html"));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Axzen preview running at http://127.0.0.1:${port}`);
  for (const ip of localIpAddresses()) {
    console.log(`Axzen preview on local network: http://${ip}:${port}`);
  }
  console.log("Edit sa/index.html in any editor and refresh will happen automatically.");
});

try {
  watchTree(rootDir);
} catch {
  startFallbackWatcher();
}
