import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** Any of these on PATH is enough; distributions name them differently. */
export const WINE_BINARIES = ["wine", "wine64", "wine-stable", "wine-devel"];

const INSTALL_HINT: Record<string, string> = {
  debian: "sudo apt install wine wine64",
  ubuntu: "sudo apt install wine wine64",
  fedora: "sudo dnf install wine",
  arch: "sudo pacman -S wine",
  almalinux: "sudo dnf install wine",
  "opensuse-tumbleweed": "sudo zypper install wine",
};

const WOW64_MARKER = "drive_c/windows/syswow64/ntdll.dll";

export type BuildTargets = {
  dirOnly: boolean;
  platform: NodeJS.Platform;
  searchPath: string;
  winePrefix: string | undefined;
  home: string;
  readOsRelease: () => string | null;
  wineExists: (binary: string) => boolean;
  wow64Exists: (prefix: string) => boolean;
};

export type PreflightOutcome =
  | { kind: "proceed"; wine: string | null }
  | { kind: "skipped" }
  | { kind: "missing-wine"; message: string }
  | { kind: "no-wow64"; message: string };

export function defaultTargets(dirOnly: boolean): BuildTargets {
  return {
    dirOnly,
    platform: process.platform,
    searchPath: process.env["PATH"] ?? "",
    winePrefix: process.env["WINEPREFIX"],
    home: process.env["HOME"] ?? "",
    readOsRelease: () => {
      if (!existsSync("/etc/os-release")) return null;
      return readFileSync("/etc/os-release", "utf8");
    },
    wineExists: (binary) => existsSync(binary),
    wow64Exists: (prefix) => existsSync(path.join(prefix, WOW64_MARKER)),
  };
}

export function findWine(targets: BuildTargets): string | null {
  for (const binary of WINE_BINARIES) {
    for (const dir of targets.searchPath.split(path.delimiter)) {
      if (dir && targets.wineExists(path.join(dir, binary))) return binary;
    }
  }
  return null;
}

export function hasWow64Support(targets: BuildTargets): boolean {
  const prefixes = [targets.winePrefix, path.join(targets.home, ".wine")];

  return prefixes.some((prefix) => prefix && targets.wow64Exists(prefix));
}

export function distroHint(targets: BuildTargets): string {
  const osRelease = targets.readOsRelease();
  if (osRelease === null) return "install wine from your package manager";

  const id = (/^\s*ID=(.*)$/m.exec(osRelease)?.[1] ?? "linux").trim();
  const like = (/^\s*ID_LIKE=(.*)$/m.exec(osRelease)?.[1] ?? "")
    .split(/\s+/)
    .filter(Boolean);

  const distro = like.includes("debian") ? "debian" : id;

  return INSTALL_HINT[distro] ?? "install wine from your package manager";
}

function missingWineMessage(targets: BuildTargets): string {
  return [
    "",
    "[build] wine is not installed, and the NSIS target needs it to build",
    "a Windows installer from a non-Windows machine.",
    "",
    `  install:  ${distroHint(targets)}`,
    "",
    "or skip the installer entirely and take the unpacked app:",
    "",
    "  bun run build:windows:dir",
    "",
  ].join("\n");
}

function noWow64Message(): string {
  return [
    "",
    "[build] wine cannot run 32-bit Windows executables.",
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
    "or skip the installer entirely and take the unpacked app:",
    "",
    "  bun run build:windows:dir",
    "",
  ].join("\n");
}

export function preflight(targets: BuildTargets): PreflightOutcome {
  if (targets.dirOnly) return { kind: "skipped" };
  if (targets.platform === "win32") return { kind: "skipped" };

  const wine = findWine(targets);
  if (wine === null) {
    return { kind: "missing-wine", message: missingWineMessage(targets) };
  }

  if (hasWow64Support(targets)) {
    return { kind: "proceed", wine };
  }

  return { kind: "no-wow64", message: noWow64Message() };
}

export type SpawnedCommand = {
  name: string;
  command: string;
  args: string[];
};

export function buildCommands(dirOnly: boolean): SpawnedCommand[] {
  const target = dirOnly ? "dir" : "nsis";

  return [
    { name: "vite build", command: "bunx", args: ["vite", "build"] },
    {
      name: "electron-builder",
      command: "bunx",
      args: ["electron-builder", "--win", target, "--x64"],
    },
  ];
}

export function outputDirectory(): string {
  return path.join(projectRoot, "release");
}

let shuttingDown = false;

function shutdown(code: number): void {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exit(code);
}

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

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  const dirOnly = process.argv.includes("--dir");
  const outcome = preflight(defaultTargets(dirOnly));

  if (outcome.kind === "missing-wine") {
    console.error(outcome.message);
    shutdown(1);
  } else if (outcome.kind === "no-wow64") {
    console.error(outcome.message);
    shutdown(1);
  } else if (outcome.kind === "proceed") {
    console.log(
      `[build] using ${outcome.wine} to run the NSIS installer build`,
    );
  }

  try {
    for (const step of buildCommands(dirOnly)) {
      await run(step.name, step.command, step.args);
    }

    console.log(`\n[build] output in ${outputDirectory()}`);
  } catch (error) {
    console.error(
      `[build] ${error instanceof Error ? error.message : String(error)}`,
    );
    shutdown(1);
  }
}
