import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, test } from "bun:test";

import { closeDatabase, listNotes, openDatabase } from "../electron/db.mjs";
import {
  createTestDatabase,
  isRealUserDataPath,
  type TestDatabase,
} from "./helpers/test-database";

let database: TestDatabase | null = null;
let raw: DatabaseSync | null = null;
const legacyPaths: string[] = [];

afterEach(() => {
  database?.dispose();
  database = null;
  raw?.close();
  raw = null;
  closeDatabase();

  for (const legacyPath of legacyPaths.splice(0)) {
    try {
      rmSync(legacyPath, { force: true, recursive: true });
    } catch {}
  }
});

function legacyRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "NoteApp-test-legacy-"));
  if (isRealUserDataPath(root)) {
    throw new Error(`refusing to use a real user data directory: ${root}`);
  }

  return root;
}

function seedLegacyDatabase(version: number, title: string): string {
  const userDataPath = mkdtempSync(path.join(legacyRoot(), "legacy-"));
  legacyPaths.push(userDataPath);

  const legacy = new DatabaseSync(path.join(userDataPath, "notes.db"));
  legacy.exec(`
    CREATE TABLE notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT    NOT NULL DEFAULT '',
      body       TEXT    NOT NULL DEFAULT '',
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX notes_created_at_idx ON notes (created_at DESC);
  `);
  const insert = legacy.prepare(
    "INSERT INTO notes (title, body) VALUES (?, ?)",
  );
  for (let index = 0; index < 20; index += 1) {
    insert.run(`${title} ${index}`, "متن");
  }

  legacy.exec(`PRAGMA user_version = ${version}`);
  legacy.close();

  return userDataPath;
}

function readLegacyNotes(userDataPath: string): Array<{
  id: number;
  title: string;
}> {
  const legacy = new DatabaseSync(path.join(userDataPath, "notes.db"), {
    readOnly: true,
  });
  const rows = legacy
    .prepare("SELECT id, title FROM notes ORDER BY created_at DESC, id DESC")
    .all() as Array<{ id: number; title: string }>;
  legacy.close();

  return rows;
}

describe("fresh database", () => {
  test("creates the notes table", () => {
    database = createTestDatabase();

    const tables = database.list();
    expect(tables).toEqual([]);
  });

  test("records every migration as applied", () => {
    database = createTestDatabase();
    raw = new DatabaseSync(`${database.userDataPath}/notes.db`, {
      readOnly: true,
    });

    const { user_version } = raw.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };

    expect(user_version).toBe(3);
  });

  test("indexes the whole sort order of the list query so it needs no temp b-tree", () => {
    database = createTestDatabase();
    for (let index = 0; index < 200; index += 1) {
      database.create(`یادداشت ${index}`, "متن");
    }

    raw = new DatabaseSync(`${database.userDataPath}/notes.db`, {
      readOnly: true,
    });

    const plan = raw
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT id FROM notes ORDER BY created_at DESC, id DESC`,
      )
      .all() as Array<{ detail: string }>;

    expect(plan.map((step) => step.detail).join(" ")).not.toContain(
      "TEMP B-TREE",
    );
    expect(plan.map((step) => step.detail).join(" ")).toContain(
      "notes_created_at_id_idx",
    );
  });

  test("creates the composite index the list query sorts on", () => {
    database = createTestDatabase();
    raw = new DatabaseSync(`${database.userDataPath}/notes.db`, {
      readOnly: true,
    });

    const indexes = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all() as Array<{ name: string }>;

    expect(indexes.map((index) => index.name)).toContain(
      "notes_created_at_id_idx",
    );
  });

  test("drops the superseded single column created_at index", () => {
    database = createTestDatabase();
    raw = new DatabaseSync(`${database.userDataPath}/notes.db`, {
      readOnly: true,
    });

    const indexes = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all() as Array<{ name: string }>;

    expect(indexes.map((index) => index.name)).not.toContain(
      "notes_created_at_idx",
    );
  });

  test("drops the superseded updated_at index", () => {
    database = createTestDatabase();
    raw = new DatabaseSync(`${database.userDataPath}/notes.db`, {
      readOnly: true,
    });

    const indexes = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all() as Array<{ name: string }>;

    expect(indexes.map((index) => index.name)).not.toContain(
      "notes_updated_at_idx",
    );
  });

  test("enables foreign keys", () => {
    database = createTestDatabase();
    raw = new DatabaseSync(`${database.userDataPath}/notes.db`);

    const { foreign_keys } = raw.prepare("PRAGMA foreign_keys").get() as {
      foreign_keys: number;
    };

    expect(foreign_keys).toBe(1);
  });

  test("keeps the database in write ahead logging mode", () => {
    database = createTestDatabase();

    expect(database.pragma("journal_mode")).toBe("wal");
  });

  test("relaxes synchronous so a commit does not fsync", () => {
    database = createTestDatabase();

    expect(database.pragma("synchronous")).toBe(1);
  });

  test("waits instead of failing when the file is locked", () => {
    database = createTestDatabase();

    expect(database.pragma("busy_timeout")).toBe(5000);
  });

  test("keeps sorter output off disk", () => {
    database = createTestDatabase();

    expect(database.pragma("temp_store")).toBe(2);
  });

  test("raises the page cache above the 2 MiB default", () => {
    database = createTestDatabase();

    expect(database.pragma("cache_size")).toBe(-8192);
  });

  test("memory maps the file so reads skip the copy into the page cache", () => {
    database = createTestDatabase();

    expect(database.pragma("mmap_size")).toBe(268435456);
  });

  test("caps the write ahead log so it cannot grow without bound", () => {
    database = createTestDatabase();

    expect(database.pragma("journal_size_limit")).toBe(67108864);
  });
});

describe("opening the same directory twice", () => {
  test("ignores a request to open a different directory while open", () => {
    database = createTestDatabase();
    const path = database.userDataPath;
    database.create("یادداشت", "متن");

    openDatabase(path);

    expect(listNotes()).toHaveLength(1);
  });

  test("can reopen after closing", () => {
    database = createTestDatabase();
    database.create("یادداشت", "متن");
    const path = database.userDataPath;
    database.dispose();

    openDatabase(path);

    expect(listNotes()).toHaveLength(1);

    closeDatabase();
  });
});

describe("upgrading a database left by an older version", () => {
  test("carries the notes and their order across the upgrade", () => {
    const userDataPath = seedLegacyDatabase(2, "قدیمی");
    const seeded = readLegacyNotes(userDataPath);

    openDatabase(userDataPath);

    const upgraded = listNotes();

    expect(upgraded.map((note) => note.id)).toEqual(
      seeded.map((row) => row.id),
    );
    expect(upgraded.map((note) => note.title)).toEqual(
      seeded.map((row) => row.title),
    );

    closeDatabase();
  });

  test("replaces the old sort index with the composite one", () => {
    const userDataPath = seedLegacyDatabase(2, "قدیمی");

    openDatabase(userDataPath);
    closeDatabase();

    raw = new DatabaseSync(`${userDataPath}/notes.db`, { readOnly: true });

    const indexes = (
      raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
        .all() as Array<{ name: string }> | null
    )?.map((index) => index.name);

    expect(indexes).toEqual(["notes_created_at_id_idx"]);
  });

  test("leaves user_version at the newest migration", () => {
    const userDataPath = seedLegacyDatabase(2, "قدیمی");

    openDatabase(userDataPath);
    closeDatabase();

    raw = new DatabaseSync(`${userDataPath}/notes.db`, { readOnly: true });

    const { user_version } = raw.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };

    expect(user_version).toBe(3);
  });
});

describe("operations before the database is open", () => {
  test("throws a clear error", () => {
    closeDatabase();

    expect(() => listNotes()).toThrow("Database has not been opened yet");
  });
});

describe("an existing database", () => {
  test("keeps notes written by a previous run", () => {
    database = createTestDatabase();
    database.create("ماندگار", "متن ماندگار");
    const path = database.userDataPath;
    database.dispose();

    openDatabase(path);

    const notes = listNotes() as Array<{ title: string; body: string }>;
    expect(notes).toHaveLength(1);
    expect(notes[0]?.title).toBe("ماندگار");
    expect(notes[0]?.body).toBe("متن ماندگار");

    closeDatabase();
  });
});
