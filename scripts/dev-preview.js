const { spawn } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const isWin = process.platform === "win32";
const nodeBin = process.execPath;

function start(name, script, args = []) {
  const child = spawn(nodeBin, [path.join(rootDir, "scripts", script), ...args], {
    cwd: rootDir,
    stdio: "inherit",
    windowsHide: true
  });
  child.on("exit", code => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
}

let shuttingDown = false;
const children = [
  start("backend", path.join("..", "backend", "server.js")),
  start("preview", "preview-sa.js")
];

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try { child.kill(); } catch {}
  }
  setTimeout(() => process.exit(code), isWin ? 200 : 100);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", () => shutdown(0));

console.log("Starting backend on http://127.0.0.1:5000 and preview on http://127.0.0.1:4173");
