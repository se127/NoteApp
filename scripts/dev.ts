import { type ChildProcess, spawn } from "node:child_process";
import process from "node:process";

const HOST = "127.0.0.1";
const PORT = Number(process.env["PORT"] ?? 5173);
const URL = `http://${HOST}:${PORT}`;
const TIMEOUT_MS = 30_000;
const POLL_MS = 250;

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
    shutdown(typeof code === "number" ? code : 1);
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

function shutdown(code = 0): void {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`[dev] starting vite on ${URL}`);
start("vite", "bunx", ["vite", "--port", String(PORT), "--strictPort"]);

try {
  await waitForServer(URL, TIMEOUT_MS);
  console.log("[dev] vite is up, launching electron");
  start("electron", "bunx", ["electron", "."], { VITE_DEV_SERVER_URL: URL });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
}
