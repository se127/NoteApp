import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const HOST = "127.0.0.1";
const PORT = Number(process.env["PORT"] ?? 5173);
const URL = `http://${HOST}:${PORT}`;
const TIMEOUT_MS = 30_000;
const POLL_MS = 250;
const GRACE_MS = 1500;

function devUserDataDir(): string {
  const appData = process.env["APPDATA"] ?? path.join(os.homedir(), ".config");
  return path.join(appData, `${path.basename(process.cwd())}-dev`);
}

const children: ChildProcess[] = [];

let shuttingDown = false;

function start(
  name: string,
  command: string,
  args: string[],
  env: Record<string, string> = {},
): ChildProcess {
  const child = spawn(command, args, {
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, ...env },
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`[dev] ${name} exited (code ${code}, signal ${signal})`);
    void shutdown(typeof code === "number" ? code : 1);
  });

  children.push(child);
  return child;
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok || response.status === 404) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  throw new Error(`[dev] ${url} did not respond within ${timeoutMs / 1000}s`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRunning(child: ChildProcess): boolean {
  return child.exitCode === null && child.signalCode === null;
}

function stopTree(child: ChildProcess, force: boolean): void {
  if (!isRunning(child)) return;

  if (process.platform === "win32" && child.pid !== undefined) {
    const args = ["/pid", String(child.pid), "/T"];
    if (force) args.push("/F");

    spawnSync("taskkill", args, { stdio: "ignore" });
    return;
  }

  child.kill();
}

async function shutdown(code = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) stopTree(child, false);

  await delay(GRACE_MS);

  for (const child of children) {
    if (!isRunning(child)) continue;
    stopTree(child, true);
    if (isRunning(child)) {
      console.error(
        `[dev] could not stop ${child.spawnargs.join(" ")}; port ${PORT} may still be held`,
      );
    }
  }

  process.exit(code);
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

console.log(`[dev] starting vite on ${URL}`);
start("vite", "bunx", [
  "vite",
  "--host",
  HOST,
  "--port",
  String(PORT),
  "--strictPort",
]);

try {
  await waitForServer(URL, TIMEOUT_MS);
  console.log("[dev] vite is up, launching electron");
  start("electron", "bunx", ["electron", "."], {
    VITE_DEV_SERVER_URL: URL,
    NOTE_APP_USER_DATA: devUserDataDir(),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  void shutdown(1);
}
