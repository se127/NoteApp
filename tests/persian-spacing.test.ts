import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const SCANNED_ROOTS = ["src", "electron", "scripts", "tests"];
const SCANNED_FILES = ["README.md", "AGENTS.md"];
const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "release",
  ".git",
]);
const SCANNED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".md",
  ".html",
  ".css",
]);

type SourceFile = { relativePath: string; text: string };

function walk(directory: string, collected: SourceFile[]): void {
  for (const entry of readdirSync(directory)) {
    if (IGNORED_DIRECTORIES.has(entry)) continue;

    const absolutePath = path.join(directory, entry);
    if (statSync(absolutePath).isDirectory()) {
      walk(absolutePath, collected);
      continue;
    }

    if (!SCANNED_EXTENSIONS.has(path.extname(entry))) continue;

    collected.push({
      relativePath: path.relative(ROOT, absolutePath),
      text: readFileSync(absolutePath, "utf8"),
    });
  }
}

function sourceFiles(): SourceFile[] {
  const collected: SourceFile[] = [];

  for (const directory of SCANNED_ROOTS) {
    walk(path.join(ROOT, directory), collected);
  }

  for (const file of SCANNED_FILES) {
    collected.push({
      relativePath: file,
      text: readFileSync(path.join(ROOT, file), "utf8"),
    });
  }

  return collected;
}

const FILES = sourceFiles();

function zeroWidthNonJoiners(file: SourceFile): number {
  return (file.text.match(/\u200C/g) ?? []).length;
}

describe("Persian half-space", () => {
  test("there are files to scan", () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  test("no source file spells a boundary with U+200C", () => {
    const offenders = FILES.filter((file) => zeroWidthNonJoiners(file) > 0).map(
      (file) => `${file.relativePath} (${zeroWidthNonJoiners(file)})`,
    );

    expect(offenders).toEqual([]);
  });

  test("no source file doubles the space where one replaced a half-space", () => {
    const offenders = FILES.filter((file) =>
      /[\u0600-\u06FF] {2}[\u0600-\u06FF]/.test(file.text),
    ).map((file) => file.relativePath);

    expect(offenders).toEqual([]);
  });
});
