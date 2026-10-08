import { describe, expect, test } from "bun:test";

import {
  isShortcut,
  NEW_NOTE_SHORTCUT,
  SAVE_NOTE_SHORTCUT,
  SHORTCUTS,
  TITLE_EMOJI_SHORTCUT,
  TOOLBAR_SHORTCUTS,
  toolbarShortcut,
} from "../src/lib/shortcuts.ts";

function keyEvent(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

describe("SHORTCUTS", () => {
  test("documents every bound shortcut", () => {
    expect(SHORTCUTS.map((shortcut) => shortcut.combination)).toEqual([
      "Ctrl + N",
      "Ctrl + S",
      "Ctrl + Alt + G",
      "Ctrl + Z",
      "Ctrl + Y",
      "Ctrl + Alt + D",
      "Ctrl + Alt + T",
      "Ctrl + Alt + F",
      "Ctrl + B",
      "Ctrl + I",
      "Ctrl + U",
      "Ctrl + Shift + X",
      "Ctrl + Alt + C",
      "Ctrl + Alt + H",
      "Ctrl + Shift + U",
      "Ctrl + Shift + O",
      "Ctrl + Alt + A",
      "Ctrl + Alt + P",
      "Ctrl + Shift + Q",
      "Ctrl + Shift + H",
      "Ctrl + Alt + E",
    ]);
  });

  test("binds no combination to two shortcuts", () => {
    const combinations = SHORTCUTS.map((shortcut) => shortcut.combination);

    expect(new Set(combinations).size).toBe(combinations.length);
  });

  test("leaves Ctrl + S and Ctrl + N to the note shortcuts", () => {
    for (const shortcut of TOOLBAR_SHORTCUTS) {
      expect(["Ctrl + S", "Ctrl + N"]).not.toContain(
        shortcut.shortcut.combination,
      );
    }
  });

  test("avoids the combinations Chromium reserves", () => {
    const reserved = [
      "Ctrl + Shift + I",
      "Ctrl + Shift + J",
      "Ctrl + Shift + C",
      "Ctrl + Shift + T",
      "Ctrl + Shift + W",
      "Ctrl + Shift + N",
      "Ctrl + Shift + B",
      "Ctrl + W",
      "Ctrl + T",
    ];

    for (const { shortcut } of TOOLBAR_SHORTCUTS) {
      expect(reserved).not.toContain(shortcut.combination);
    }
  });

  test("gives every shortcut a Farsi label and explanation", () => {
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.label).not.toBe("");
      expect(shortcut.description).not.toBe("");
    }
  });

  test("binds the rule to a combination no accelerator can claim", () => {
    const rule = toolbarShortcut("horizontalRule");

    expect(rule.alt).toBeUndefined();
    expect(rule.combination).toBe("Ctrl + Shift + H");
  });

  test("matches each displayed combination to the modifiers it needs", () => {
    for (const { shortcut } of TOOLBAR_SHORTCUTS) {
      const shown = shortcut.combination;
      expect(shown.startsWith("Ctrl + ")).toBe(true);
      expect(shown.includes("Alt")).toBe(shortcut.alt === true);
      expect(shown.includes("Shift")).toBe(shortcut.shift === true);
    }
  });
});

describe("isShortcut", () => {
  test("matches the physical key on a latin layout", () => {
    const event = keyEvent({ key: "s", code: "KeyS", ctrlKey: true });

    expect(isShortcut(event, SAVE_NOTE_SHORTCUT)).toBe(true);
  });

  test("matches the physical key on a persian layout", () => {
    const event = keyEvent({ key: "س", code: "KeyS", ctrlKey: true });

    expect(isShortcut(event, SAVE_NOTE_SHORTCUT)).toBe(true);
  });

  test("matches the new note key on a persian layout", () => {
    const event = keyEvent({ key: "ن", code: "KeyN", ctrlKey: true });

    expect(isShortcut(event, NEW_NOTE_SHORTCUT)).toBe(true);
  });

  test("accepts the meta key", () => {
    const event = keyEvent({ key: "n", code: "KeyN", metaKey: true });

    expect(isShortcut(event, NEW_NOTE_SHORTCUT)).toBe(true);
  });

  test("rejects the key without a modifier", () => {
    const event = keyEvent({ key: "s", code: "KeyS" });

    expect(isShortcut(event, SAVE_NOTE_SHORTCUT)).toBe(false);
  });

  test("rejects another physical key", () => {
    const event = keyEvent({ key: "n", code: "KeyN", ctrlKey: true });

    expect(isShortcut(event, SAVE_NOTE_SHORTCUT)).toBe(false);
  });

  test("rejects an altgr combo that reports the ctrl key", () => {
    const event = keyEvent({
      key: "s",
      code: "KeyS",
      ctrlKey: true,
      altKey: true,
    });

    expect(isShortcut(event, SAVE_NOTE_SHORTCUT)).toBe(false);
  });

  test("matches an alt shortcut only when alt is held", () => {
    const held = keyEvent({
      key: "d",
      code: "KeyD",
      ctrlKey: true,
      altKey: true,
    });
    const plain = keyEvent({ key: "d", code: "KeyD", ctrlKey: true });

    expect(isShortcut(held, toolbarShortcut("textDirection"))).toBe(true);
    expect(isShortcut(plain, toolbarShortcut("textDirection"))).toBe(false);
  });

  test("matches a shift shortcut only when shift is held", () => {
    const held = keyEvent({
      key: "X",
      code: "KeyX",
      ctrlKey: true,
      shiftKey: true,
    });
    const plain = keyEvent({ key: "x", code: "KeyX", ctrlKey: true });

    expect(isShortcut(held, toolbarShortcut("strike"))).toBe(true);
    expect(isShortcut(plain, toolbarShortcut("strike"))).toBe(false);
  });

  test("matches the bullet list on its own key", () => {
    const event = keyEvent({
      key: "U",
      code: "KeyU",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(isShortcut(event, toolbarShortcut("bulletList"))).toBe(true);
  });

  test("matches the ordered list on its own key", () => {
    const event = keyEvent({
      key: "O",
      code: "KeyO",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(isShortcut(event, toolbarShortcut("orderedList"))).toBe(true);
  });

  test("keeps the two list shortcuts apart", () => {
    const event = keyEvent({
      key: "U",
      code: "KeyU",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(isShortcut(event, toolbarShortcut("orderedList"))).toBe(false);
  });

  test("binds no toolbar shortcut to a bare digit", () => {
    for (const { shortcut } of TOOLBAR_SHORTCUTS) {
      expect(/^[0-9]$/.test(shortcut.key)).toBe(false);
    }
  });

  test("matches the title emoji shortcut", () => {
    const event = keyEvent({
      key: "g",
      code: "KeyG",
      ctrlKey: true,
      altKey: true,
    });

    expect(isShortcut(event, TITLE_EMOJI_SHORTCUT)).toBe(true);
  });

  test("keeps the title emoji shortcut out of the body commands", () => {
    const event = keyEvent({
      key: "g",
      code: "KeyG",
      ctrlKey: true,
      altKey: true,
    });

    for (const { shortcut } of TOOLBAR_SHORTCUTS) {
      expect(isShortcut(event, shortcut)).toBe(false);
    }
  });

  test("binds a distinct shortcut to every toolbar command", () => {
    const commands = new Set(TOOLBAR_SHORTCUTS.map((entry) => entry.command));

    expect(commands.size).toBe(TOOLBAR_SHORTCUTS.length);
    for (const { command } of TOOLBAR_SHORTCUTS) {
      expect(toolbarShortcut(command)).toBeDefined();
    }
  });
});

describe("toolbarShortcut", () => {
  const unbound = "noSuchCommand" as Parameters<typeof toolbarShortcut>[0];

  test("throws for a command no shortcut is bound to", () => {
    expect(() => toolbarShortcut(unbound)).toThrow();
  });

  test("returns the shortcut that carries the command's own label", () => {
    expect(toolbarShortcut("bold").label).toBe("ضخیم");
  });
});
