import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, test } from "bun:test";

import { closeDatabase, listNotes, openDatabase } from "../electron/db.mjs";
import { createTestDatabase, type TestDatabase } from "./helpers/test-database";

let database: TestDatabase | null = null;
let raw: DatabaseSync | null = null;

afterEach(() => {
  database?.dispose();
  database = null;
  raw?.close();
  raw = null;
  closeDatabase();
});

describe("fresh database", () => {
  test("creates the notes table", () => {
    database = createTestDatabase();

    const tables = database.list();
    expect(tables).toEqual([]);
  });

  test("records both migrations as applied", () => {
    database = createTestDatabase();
    raw = new DatabaseSync(`${database.userDataPath}/notes.db`, {
      readOnly: true,
    });

    const { user_version } = raw.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };

    expect(user_version).toBe(2);
  });

  test("creates the created_at index the list query sorts on", () => {
    database = createTestDatabase();
    raw = new DatabaseSync(`${database.userDataPath}/notes.db`, {
      readOnly: true,
    });

    const indexes = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all() as Array<{ name: string }>;

    expect(indexes.map((index) => index.name)).toContain(
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
