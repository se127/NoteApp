import { describe, expect, test } from "bun:test";

import {
  isShortcut,
  NEW_NOTE_SHORTCUT,
  SAVE_NOTE_SHORTCUT,
  SHORTCUTS,
} from "../src/lib/shortcuts.ts";

function keyEvent(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

describe("SHORTCUTS", () => {
  test("documents the two bound shortcuts", () => {
    expect(SHORTCUTS.map((shortcut) => shortcut.combination)).toEqual([
      "Ctrl + N",
      "Ctrl + S",
    ]);
  });

  test("gives every shortcut a Farsi label and explanation", () => {
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.label).not.toBe("");
      expect(shortcut.description).not.toBe("");
    }
  });
});

describe("isShortcut", () => {
  test("matches the physical key on a latin layout", () => {
    const event = keyEvent({ key: "s", code: "KeyS", ctrlKey: true });

    expect(isShortcut(event, SAVE_NOTE_SHORTCUT.key)).toBe(true);
  });

  test("matches the physical key on a persian layout", () => {
    const event = keyEvent({ key: "س", code: "KeyS", ctrlKey: true });

    expect(isShortcut(event, SAVE_NOTE_SHORTCUT.key)).toBe(true);
  });

  test("matches the new note key on a persian layout", () => {
    const event = keyEvent({ key: "ن", code: "KeyN", ctrlKey: true });

    expect(isShortcut(event, NEW_NOTE_SHORTCUT.key)).toBe(true);
  });

  test("accepts the meta key", () => {
    const event = keyEvent({ key: "n", code: "KeyN", metaKey: true });

    expect(isShortcut(event, NEW_NOTE_SHORTCUT.key)).toBe(true);
  });

  test("rejects the key without a modifier", () => {
    const event = keyEvent({ key: "s", code: "KeyS" });

    expect(isShortcut(event, SAVE_NOTE_SHORTCUT.key)).toBe(false);
  });

  test("rejects another physical key", () => {
    const event = keyEvent({ key: "n", code: "KeyN", ctrlKey: true });

    expect(isShortcut(event, SAVE_NOTE_SHORTCUT.key)).toBe(false);
  });

  test("rejects an altgr combo that reports the ctrl key", () => {
    const event = keyEvent({
      key: "s",
      code: "KeyS",
      ctrlKey: true,
      altKey: true,
    });

    expect(isShortcut(event, SAVE_NOTE_SHORTCUT.key)).toBe(false);
  });
});
