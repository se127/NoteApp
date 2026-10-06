import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  closeDatabase,
  createNote,
  deleteNote,
  listNotes,
  openDatabase,
  updateNote,
} from "../../electron/db.mjs";
import type { Note } from "../../src/lib/notes";

const REAL_USER_DATA_NAMES = ["note-app", "note-app-dev", "Note App"];

const TEST_ROOT_PREFIX = "note-app-test-db-";

let testRoot: string | null = null;

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

export function isRealUserDataPath(candidate: string): boolean {
  const appData = process.env["APPDATA"];
  if (appData === undefined) return false;

  return REAL_USER_DATA_NAMES.some((name) => {
    const realUserData = path.join(appData, name);
    return (
      isInside(realUserData, candidate) ||
      path.resolve(candidate) === path.resolve(realUserData)
    );
  });
}

function assertIsolated(candidate: string): void {
  if (isRealUserDataPath(candidate)) {
    throw new Error(`refusing to use a real user data directory: ${candidate}`);
  }
}

function ensureTestRoot(): string {
  if (testRoot !== null) return testRoot;

  const root = mkdtempSync(path.join(tmpdir(), TEST_ROOT_PREFIX));
  assertIsolated(root);
  testRoot = root;

  return root;
}

function removeQuietly(target: string): void {
  try {
    rmSync(target, { force: true, recursive: true });
  } catch {}
}

export type TestDatabase = {
  userDataPath: string;
  create: (title: string, body: string) => Note;
  remove: (id: number) => boolean;
  update: (id: number, title: string, body: string) => Note | null;
  list: () => Note[];
  dispose: () => void;
};

export function createTestDatabase(): TestDatabase {
  const userDataPath = mkdtempSync(path.join(ensureTestRoot(), "case-"));
  assertIsolated(userDataPath);

  openDatabase(userDataPath);

  return {
    userDataPath,
    create: (title, body) => createNote(title, body) as Note,
    remove: (id) => deleteNote(id),
    update: (id, title, body) => updateNote(id, title, body) as Note | null,
    list: () => listNotes() as Note[],
    dispose: () => {
      closeDatabase();
      removeQuietly(userDataPath);
    },
  };
}

export function removeTestDatabaseRoot(): void {
  if (testRoot === null) return;
  removeQuietly(testRoot);
  testRoot = null;
}

process.on("exit", removeTestDatabaseRoot);
