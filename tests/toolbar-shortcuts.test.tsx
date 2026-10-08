import { afterEach, describe, expect, test } from "bun:test";
import { act, screen } from "@testing-library/react";

import { NoteBodyEditor } from "@/components/note-body-editor";
import {
  type Shortcut,
  TOOLBAR_SHORTCUTS,
  type ToolbarCommand,
  toolbarShortcut,
} from "@/lib/shortcuts";
import {
  findToolbarCommand,
  registerToolbarCommand,
  runToolbarCommand,
} from "@/lib/toolbar-commands";
import {
  bodyEditor,
  focusBodyCaret,
  selectAllBodyText,
  toolbarButton,
} from "./helpers/note-body";
import { renderWithProviders } from "./helpers/render";

function renderBodyEditor(body = "<p>متن</p>") {
  return renderWithProviders(
    <NoteBodyEditor body={body} onChange={() => {}} />,
  );
}

function press(shortcut: Shortcut, code: string) {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code,
        ctrlKey: true,
        altKey: shortcut.alt === true,
        shiftKey: shortcut.shift === true,
      }),
    );
  });
}

function pressCommand(command: ToolbarCommand) {
  press(toolbarShortcut(command), toolbarShortcut(command).code);
}

function html(): string {
  return bodyEditor().getHTML();
}

function hasSlot(slot: string): boolean {
  return document.querySelector(`[data-slot="${slot}"]`) !== null;
}

afterEach(() => {
  if (document.querySelector(".ProseMirror") === null) return;
  act(() => {
    bodyEditor().destroy();
  });
});

describe("NoteBodyEditor mark shortcuts", () => {
  test("bolds the selection on Ctrl + B", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressCommand("bold");

    expect(html()).toBe("<p><strong>متن</strong></p>");
  });

  test("italics the selection on Ctrl + I", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressCommand("italic");

    expect(html()).toBe("<p><em>متن</em></p>");
  });

  test("underlines the selection on Ctrl + U", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressCommand("underline");

    expect(html()).toBe("<p><u>متن</u></p>");
  });

  test("strikes the selection on Ctrl + Shift + X", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressCommand("strike");

    expect(html()).toBe("<p><s>متن</s></p>");
  });

  test("tells the underline and bullet list shortcuts apart by shift", () => {
    renderBodyEditor();

    selectAllBodyText();
    press({ ...toolbarShortcut("underline"), shift: true }, "KeyU");

    expect(html()).toBe("<ul><li><p>متن</p></li></ul>");
  });
});

describe("NoteBodyEditor history shortcuts", () => {
  test("undoes the bold on Ctrl + Z", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressCommand("bold");
    expect(html()).toBe("<p><strong>متن</strong></p>");

    pressCommand("undo");

    expect(html()).toBe("<p>متن</p>");
  });

  test("redoes the bold on Ctrl + Y", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressCommand("bold");
    pressCommand("undo");
    expect(html()).toBe("<p>متن</p>");

    pressCommand("redo");

    expect(html()).toBe("<p><strong>متن</strong></p>");
  });

  test("undoes the rule it inserted on Ctrl + Z", () => {
    renderBodyEditor();

    focusBodyCaret();
    pressCommand("horizontalRule");
    expect(html()).toBe("<p>متن</p><hr><p></p>");

    pressCommand("undo");

    expect(html()).toBe("<p>متن</p>");
  });
});

describe("NoteBodyEditor block shortcuts", () => {
  test("wraps the block in a quote on Ctrl + Shift + Q", () => {
    renderBodyEditor();

    focusBodyCaret();
    pressCommand("blockquote");

    expect(html()).toBe("<blockquote><p>متن</p></blockquote>");
  });

  test("inserts a rule on Ctrl + Shift + H", () => {
    renderBodyEditor();

    focusBodyCaret();
    pressCommand("horizontalRule");

    expect(html()).toBe("<p>متن</p><hr><p></p>");
  });

  test("turns the block into a bullet list on Ctrl + Shift + U", () => {
    renderBodyEditor();

    focusBodyCaret();
    pressCommand("bulletList");

    expect(html()).toBe("<ul><li><p>متن</p></li></ul>");
  });

  test("turns the block into an ordered list on Ctrl + Shift + O", () => {
    renderBodyEditor();

    focusBodyCaret();
    pressCommand("orderedList");

    expect(html()).toBe("<ol><li><p>متن</p></li></ol>");
  });

  test("matches the ordered list on a persian layout", () => {
    renderBodyEditor();

    focusBodyCaret();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          code: "KeyO",
          key: "خ",
          ctrlKey: true,
          shiftKey: true,
        }),
      );
    });

    expect(html()).toBe("<ol><li><p>متن</p></li></ol>");
  });
});

describe("NoteBodyEditor menu shortcuts", () => {
  test("opens the direction menu on Ctrl + Alt + D", () => {
    renderBodyEditor();

    pressCommand("textDirection");

    expect(screen.getByRole("menu", { name: "جهت متن" })).toBeDefined();
  });

  test("opens the alignment menu on Ctrl + Alt + A", () => {
    renderBodyEditor();

    pressCommand("textAlign");

    expect(screen.getByRole("menu", { name: "تراز متن" })).toBeDefined();
  });

  test("opens the position menu on Ctrl + Alt + P", () => {
    renderBodyEditor();

    pressCommand("textPosition");

    expect(screen.getByRole("menu", { name: "موقعیت متن" })).toBeDefined();
  });

  test("closes an open menu when the shortcut repeats", () => {
    renderBodyEditor();

    pressCommand("textAlign");
    expect(screen.getByRole("menu", { name: "تراز متن" })).toBeDefined();

    pressCommand("textAlign");

    expect(screen.queryByRole("menu", { name: "تراز متن" })).toBeNull();
  });

  test("leaves the body untouched when only the menu opens", () => {
    renderBodyEditor();

    focusBodyCaret();
    pressCommand("textAlign");

    expect(html()).toBe("<p>متن</p>");
  });

  test("ignores the alt combo when alt is not held", () => {
    renderBodyEditor();

    press({ ...toolbarShortcut("textAlign"), alt: false }, "KeyA");

    expect(screen.queryByRole("menu", { name: "تراز متن" })).toBeNull();
  });
});

describe("NoteBodyEditor picker shortcuts", () => {
  test("opens the block style list on Ctrl + Alt + T", () => {
    renderBodyEditor();

    pressCommand("blockType");

    expect(hasSlot("select-content")).toBe(true);
  });

  test("opens the font size list on Ctrl + Alt + F", () => {
    renderBodyEditor();

    pressCommand("fontSize");

    expect(hasSlot("select-content")).toBe(true);
  });

  test("opens the text colour palette on Ctrl + Alt + C", () => {
    renderBodyEditor();

    pressCommand("textColor");

    expect(hasSlot("dropdown-menu-content")).toBe(true);
  });

  test("opens the highlight palette on Ctrl + Alt + H", () => {
    renderBodyEditor();

    pressCommand("highlightColor");

    expect(hasSlot("dropdown-menu-content")).toBe(true);
  });

  test("opens the body emoji grid on Ctrl + Alt + E", () => {
    renderBodyEditor();

    pressCommand("bodyEmoji");

    expect(screen.getByRole("grid", { name: "انتخاب ایموجی" })).toBeDefined();
  });

  test("closes the emoji grid when the shortcut repeats", () => {
    renderBodyEditor();

    pressCommand("bodyEmoji");
    pressCommand("bodyEmoji");

    expect(screen.queryByRole("grid", { name: "انتخاب ایموجی" })).toBeNull();
  });

  test("keeps every picker closed until its own shortcut arrives", () => {
    renderBodyEditor();

    pressCommand("bodyEmoji");

    expect(hasSlot("select-content")).toBe(false);
    expect(hasSlot("dropdown-menu-content")).toBe(false);
  });

  test("keeps the emoji shortcut out of the highlight one", () => {
    renderBodyEditor();

    press({ ...toolbarShortcut("highlightColor"), alt: false }, "KeyH");

    expect(hasSlot("dropdown-menu-content")).toBe(false);
    expect(toolbarButton("خط افقی")).toBeDefined();
  });

  test("opens only the palette its own shortcut names", () => {
    renderBodyEditor();

    pressCommand("textColor");

    const triggers = [
      ...document.querySelectorAll("[data-slot='dropdown-menu-trigger']"),
    ];
    const opened = triggers.filter(
      (trigger) => trigger.getAttribute("data-state") === "open",
    );

    expect(opened.length).toBe(1);
    expect(opened[0]?.getAttribute("aria-label")).toBe("رنگ متن");
  });
});

describe("every toolbar command is bound", () => {
  const covered: ToolbarCommand[] = [
    "bold",
    "italic",
    "underline",
    "strike",
    "undo",
    "redo",
    "blockquote",
    "codeBlock",
    "horizontalRule",
    "bulletList",
    "orderedList",
    "textDirection",
    "textAlign",
    "textPosition",
    "blockType",
    "fontSize",
    "textColor",
    "highlightColor",
    "bodyEmoji",
  ];

  test("binds a shortcut to every command the toolbar offers", () => {
    const bound = TOOLBAR_SHORTCUTS.map((entry) => entry.command);

    expect([...bound].sort()).toEqual([...covered].sort());
  });

  test("labels every command with the name of a rendered control", () => {
    renderBodyEditor();

    const labels = new Set(
      [
        ...screen
          .getByRole("toolbar", { name: "قالب‌بندی متن" })
          .querySelectorAll("button, [role='combobox']"),
      ].map((element) => element.getAttribute("aria-label")),
    );

    for (const { command, shortcut } of TOOLBAR_SHORTCUTS) {
      expect(labels.has(shortcut.label)).toBe(true);
      expect(toolbarShortcut(command).label).toBe(shortcut.label);
    }
  });
});

describe("toolbar command registry", () => {
  test("runs the handler a command registered", () => {
    let ran = 0;
    const stop = registerToolbarCommand("bold", () => {
      ran += 1;
    });

    runToolbarCommand("bold");
    stop();

    expect(ran).toBe(1);
  });

  test("stops running a handler once it is unregistered", () => {
    let ran = 0;
    const stop = registerToolbarCommand("italic", () => {
      ran += 1;
    });

    stop();
    runToolbarCommand("italic");

    expect(ran).toBe(0);
  });

  test("leaves a newer handler in place when an older one unregisters", () => {
    let older = 0;
    let newer = 0;
    const stopOlder = registerToolbarCommand("strike", () => {
      older += 1;
    });
    registerToolbarCommand("strike", () => {
      newer += 1;
    });

    stopOlder();
    runToolbarCommand("strike");

    expect(older).toBe(0);
    expect(newer).toBe(1);
  });

  test("finds no command for an unbound combination", () => {
    const event = new KeyboardEvent("keydown", {
      code: "KeyQ",
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });

    expect(findToolbarCommand(event)).toBeUndefined();
  });

  test("finds the command behind every bound combination", () => {
    for (const { command, shortcut } of TOOLBAR_SHORTCUTS) {
      const event = new KeyboardEvent("keydown", {
        code: shortcut.code,
        ctrlKey: true,
        altKey: shortcut.alt === true,
        shiftKey: shortcut.shift === true,
      });

      expect(findToolbarCommand(event)).toBe(command);
    }
  });
});
