import { describe, expect, test } from "bun:test";
import path from "node:path";

import {
  buildCommands,
  defaultTargets,
  distroHint,
  findWine,
  hasWow64Support,
  outputDirectory,
  preflight,
  WINE_BINARIES,
  type BuildTargets,
} from "../scripts/build.ts";

const WIN_MARKER = "drive_c/windows/syswow64/ntdll.dll";
const BIN_DIR = path.join(path.sep, "usr", "bin");
const LOCAL_BIN_DIR = path.join(path.sep, "usr", "local", "bin");

type Overrides = Partial<BuildTargets>;

function targets(overrides: Overrides = {}): BuildTargets {
  const base: BuildTargets = {
    dirOnly: false,
    platform: "linux",
    searchPath: "",
    winePrefix: undefined,
    home: "/home/dev",
    readOsRelease: () => "ID=ubuntu\nID_LIKE=debian\n",
    wineExists: () => false,
    wow64Exists: () => false,
  };

  return { ...base, ...overrides };
}

describe("findWine", () => {
  test("returns null when nothing is on the path", () => {
    expect(findWine(targets())).toBeNull();
  });

  test("finds wine in a path directory", () => {
    const result = findWine(
      targets({
        searchPath: [BIN_DIR, LOCAL_BIN_DIR].join(path.delimiter),
        wineExists: (binary) => binary === path.join(BIN_DIR, "wine"),
      }),
    );

    expect(result).toBe("wine");
  });

  test("finds an alternative name for the same binary", () => {
    const result = findWine(
      targets({
        searchPath: BIN_DIR,
        wineExists: (binary) => binary === path.join(BIN_DIR, "wine-stable"),
      }),
    );

    expect(result).toBe("wine-stable");
  });

  test("prefers the earlier name when several are present", () => {
    const result = findWine(
      targets({
        searchPath: BIN_DIR,
        wineExists: () => true,
      }),
    );

    expect(result).toBe(WINE_BINARIES[0]);
  });

  test("ignores an empty path entry", () => {
    const result = findWine(
      targets({
        searchPath: ["", BIN_DIR].join(path.delimiter),
        wineExists: (binary) => binary === path.join(BIN_DIR, "wine"),
      }),
    );

    expect(result).toBe("wine");
  });

  test("finds wine in a later path entry", () => {
    const result = findWine(
      targets({
        searchPath: ["/nowhere", BIN_DIR].join(path.delimiter),
        wineExists: (binary) => binary === path.join(BIN_DIR, "wine64"),
      }),
    );

    expect(result).toBe("wine64");
  });

  test("returns null for an empty search path", () => {
    expect(findWine(targets({ searchPath: "" }))).toBeNull();
  });
});

describe("hasWow64Support", () => {
  test("is false when no prefix exists", () => {
    expect(hasWow64Support(targets())).toBe(false);
  });

  test("is true when the wine prefix holds the marker", () => {
    const result = hasWow64Support(
      targets({
        wow64Exists: (prefix) =>
          prefix === path.join("/home/dev", ".wine") &&
          existsIn(prefix, WIN_MARKER),
      }),
    );

    expect(result).toBe(true);
  });

  test("honours an explicit WINEPREFIX", () => {
    const result = hasWow64Support(
      targets({
        winePrefix: "/opt/wine32",
        wow64Exists: (prefix) => prefix === "/opt/wine32",
      }),
    );

    expect(result).toBe(true);
  });

  test("falls back to the home prefix when WINEPREFIX is empty", () => {
    const result = hasWow64Support(
      targets({
        winePrefix: "",
        wow64Exists: (prefix) => prefix === path.join("/home/dev", ".wine"),
      }),
    );

    expect(result).toBe(true);
  });

  test("is false when neither prefix holds the marker", () => {
    const result = hasWow64Support(
      targets({ winePrefix: "", wow64Exists: () => false }),
    );

    expect(result).toBe(false);
  });
});

function existsIn(prefix: string, marker: string): boolean {
  return marker === WIN_MARKER && prefix !== "";
}

describe("distroHint", () => {
  test("suggests apt for a debian derivative", () => {
    expect(distroHint(targets())).toBe("sudo apt install wine wine64");
  });

  test("suggests apt when debian is only listed as a derivative", () => {
    const result = distroHint(
      targets({ readOsRelease: () => "ID=linuxmint\nID_LIKE=ubuntu debian\n" }),
    );

    expect(result).toBe("sudo apt install wine wine64");
  });

  test("suggests dnf for fedora", () => {
    const result = distroHint(targets({ readOsRelease: () => "ID=fedora\n" }));

    expect(result).toBe("sudo dnf install wine");
  });

  test("suggests pacman for arch", () => {
    const result = distroHint(targets({ readOsRelease: () => "ID=arch\n" }));

    expect(result).toBe("sudo pacman -S wine");
  });

  test("falls back to a generic hint for an unknown distro", () => {
    const result = distroHint(targets({ readOsRelease: () => "ID=weirdos\n" }));

    expect(result).toBe("install wine from your package manager");
  });

  test("falls back to a generic hint with no os release file", () => {
    const result = distroHint(targets({ readOsRelease: () => null }));

    expect(result).toBe("install wine from your package manager");
  });
});

describe("preflight", () => {
  test("skips the check for the unpacked build", () => {
    expect(preflight(targets({ dirOnly: true }))).toEqual({ kind: "skipped" });
  });

  test("skips the check on windows", () => {
    expect(preflight(targets({ platform: "win32" }))).toEqual({
      kind: "skipped",
    });
  });

  test("proceeds on windows even without wine", () => {
    const result = preflight(targets({ platform: "win32", searchPath: "" }));

    expect(result.kind).toBe("skipped");
  });

  test("reports missing wine on a cross compile", () => {
    const result = preflight(targets({ searchPath: "/usr/bin" }));

    expect(result.kind).toBe("missing-wine");
  });

  test("names the package command for the distro", () => {
    const result = preflight(
      targets({ searchPath: "/usr/bin", readOsRelease: () => "ID=fedora\n" }),
    );

    expect(result.kind === "missing-wine" && result.message).toContain(
      "sudo dnf install wine",
    );
  });

  test("points at the unpacked build when wine is missing", () => {
    const result = preflight(targets({ searchPath: "/usr/bin" }));

    expect(result.kind === "missing-wine" && result.message).toContain(
      "bun run build:windows:dir",
    );
  });

  test("proceeds when wine has 32 bit support", () => {
    const result = preflight(
      targets({
        searchPath: BIN_DIR,
        wineExists: (binary) => binary === path.join(BIN_DIR, "wine"),
        wow64Exists: () => true,
      }),
    );

    expect(result).toEqual({ kind: "proceed", wine: "wine" });
  });

  test("reports missing 32 bit support", () => {
    const result = preflight(
      targets({
        searchPath: BIN_DIR,
        wineExists: (binary) => binary === path.join(BIN_DIR, "wine"),
        wow64Exists: () => false,
      }),
    );

    expect(result.kind).toBe("no-wow64");
  });

  test("explains the 32 bit installer requirement", () => {
    const result = preflight(
      targets({
        searchPath: BIN_DIR,
        wineExists: () => true,
        wow64Exists: () => false,
      }),
    );

    expect(result.kind === "no-wow64" && result.message).toContain("32-bit");
  });

  test("explains how to add 32 bit support", () => {
    const result = preflight(
      targets({
        searchPath: BIN_DIR,
        wineExists: () => true,
        wow64Exists: () => false,
      }),
    );

    expect(result.kind === "no-wow64" && result.message).toContain(
      "sudo dpkg --add-architecture i386",
    );
  });

  test("offers the unpacked build when 32 bit support is missing", () => {
    const result = preflight(
      targets({
        searchPath: BIN_DIR,
        wineExists: () => true,
        wow64Exists: () => false,
      }),
    );

    expect(result.kind === "no-wow64" && result.message).toContain(
      "bun run build:windows:dir",
    );
  });

  test("names the wine binary it found when it proceeds", () => {
    const result = preflight(
      targets({
        searchPath: BIN_DIR,
        wineExists: (binary) => binary === path.join(BIN_DIR, "wine-devel"),
        wow64Exists: () => true,
      }),
    );

    expect(result.kind === "proceed" && result.wine).toBe("wine-devel");
  });
});

describe("buildCommands", () => {
  test("builds the installer by default", () => {
    const steps = buildCommands(false);

    expect(steps.map((step) => step.name)).toEqual([
      "vite build",
      "electron-builder",
    ]);
    expect(steps[1]?.args).toEqual([
      "electron-builder",
      "--win",
      "nsis",
      "--x64",
    ]);
  });

  test("skips the installer for the unpacked build", () => {
    const steps = buildCommands(true);

    expect(steps[1]?.args).toEqual([
      "electron-builder",
      "--win",
      "dir",
      "--x64",
    ]);
  });

  test("runs vite through bunx", () => {
    expect(buildCommands(false)[0]).toEqual({
      name: "vite build",
      command: "bunx",
      args: ["vite", "build"],
    });
  });

  test("the installer step targets 64 bit windows", () => {
    const installer = buildCommands(false)[1];

    expect(installer?.args).toContain("--win");
    expect(installer?.args).toContain("--x64");
  });

  test("the vite step takes no platform flags", () => {
    const vite = buildCommands(false)[0];

    expect(vite?.args).not.toContain("--win");
    expect(vite?.args).not.toContain("--x64");
  });
});

describe("outputDirectory", () => {
  test("writes into the release folder", () => {
    expect(path.basename(outputDirectory())).toBe("release");
  });

  test("lives at the project root, beside the scripts folder", () => {
    expect(path.dirname(outputDirectory())).toBe(
      path.resolve(import.meta.dir, ".."),
    );
  });
});

describe("defaultTargets", () => {
  test("reads the current platform", () => {
    expect(defaultTargets(false).platform).toBe(process.platform);
  });

  test("carries the dir only flag", () => {
    expect(defaultTargets(true).dirOnly).toBe(true);
  });

  test("supplies a home directory even when HOME is unset", () => {
    expect(typeof defaultTargets(false).home).toBe("string");
  });
});
