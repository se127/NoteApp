import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** `bun run build:windows:dir` skips the installer and just unpacks the app. */
const dirOnly = process.argv.includes("--dir");

/** Any of these on PATH is enough; distributions name them differently. */
const WINE_BINARIES = ["wine", "wine64", "wine-stable", "wine-devel"];

let shuttingDown = false;

function shutdown(code = 0): void {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function run(name: string, command: string, args: string[]): Promise<void> {
  console.log(`[build] ${name}: ${command} ${args.join(" ")}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: ["ignore", "inherit", "inherit"],
    });

    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else {
        console.error(
          `[build] ${name} failed (code ${code}, signal ${signal ?? "none"})`,
        );
        shutdown(typeof code === "number" ? code : 1);
      }
    });

    child.on("error", reject);
  });
}

function isCrossCompile(): boolean {
  return process.platform !== "win32";
}

function findWine(): string | null {
  const searchPath = process.env["PATH"] ?? "";
  for (const binary of WINE_BINARIES) {
    for (const dir of searchPath.split(path.delimiter)) {
      if (dir && existsSync(path.join(dir, binary))) return binary;
    }
  }
  return null;
}

const INSTALL_HINT: Record<string, string> = {
  debian: "sudo apt install wine wine64",
  ubuntu: "sudo apt install wine wine64",
  fedora: "sudo dnf install wine",
  arch: "sudo pacman -S wine",
  almalinux: "sudo dnf install wine",
  "opensuse-tumbleweed": "sudo zypper install wine",
};

const WOW64_MARKER = "drive_c/windows/syswow64/ntdll.dll";

function hasWow64Support(home: string): boolean {
  const prefixes = [process.env["WINEPREFIX"], path.join(home, ".wine")];

  return prefixes.some(
    (prefix) => prefix && existsSync(path.join(prefix, WOW64_MARKER)),
  );
}

function preflight(): void {
  if (dirOnly) return;
  if (!isCrossCompile()) return;

  const wine = findWine();
  if (!wine) {
    const osRelease = readFileSync("/etc/os-release", "utf8");
    const id = (/^\s*ID=(.*)$/m.exec(osRelease)?.[1] ?? "linux").trim();
    const like = (/^\s*ID_LIKE=(.*)$/m.exec(osRelease)?.[1] ?? "").split(/\s+/);
    const distro = like.includes("debian") ? "debian" : id;

    console.error(
      [
        "",
        "[build] wine is not installed, and the NSIS target needs it to build",
        "a Windows installer from a non-Windows machine.",
        "",
        `  install:  ${INSTALL_HINT[distro] ?? "install wine from your package manager"}`,
        "",
        "or skip the installer entirely and take the unpacked app:",
        "",
        "  bun run build:windows:dir",
        "",
      ].join("\n"),
    );
    shutdown(1);
  }

  const home = process.env["HOME"] ?? "";
  if (hasWow64Support(home)) {
    console.log(`[build] using ${wine} to run the NSIS installer build`);
    return;
  }

  console.error(
    [
      "",
      `[build] ${wine} cannot run 32-bit Windows executables.`,
      "",
      "The NSIS installer is 32-bit, and electron-builder has to execute it to",
      "build the uninstaller, so an amd64-only wine fails late in the build.",
      "",
      "  sudo dpkg --add-architecture i386",
      "  sudo apt update",
      "  sudo apt install wine32:i386",
      "",
      "then initialise the prefix once:",
      "",
      "  WINEARCH=win64 wineboot -u",
      "",
      "or skip the installer and take the unpacked app:",
      "",
      "  bun run build:windows:dir",
      "",
    ].join("\n"),
  );
  shutdown(1);
}

async function build(): Promise<void> {
  preflight();

  await run("vite build", "bunx", ["vite", "build"]);

  const target = dirOnly ? "dir" : "nsis";
  await run("electron-builder", "bunx", [
    "electron-builder",
    "--win",
    target,
    "--x64",
  ]);

  console.log(`\n[build] output in ${path.join(projectRoot, "release")}`);
}

try {
  await build();
} catch (error) {
  console.error(
    `[build] ${error instanceof Error ? error.message : String(error)}`,
  );
  shutdown(1);
}
