import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { EMOJI_LABEL } from "@/components/emoji-grid";
import { NoteEditor } from "@/components/note-editor";
import { FREQUENT_EMOJI } from "@/lib/frequent-emoji";
import type { Note } from "@/lib/notes";
import { BACK_TO_NOTES_SHORTCUT } from "@/lib/shortcuts";
import { createFakeStore } from "./helpers/fake-store";
import { fireHover } from "./helpers/hover";
import {
  bodyEditor,
  setBodyContent,
  waitForEditorFrame,
} from "./helpers/note-body";
import { renderWithProviders } from "./helpers/render";

type UpdateCall = { id: number; title: string; body: string };

let updates: UpdateCall[] = [];
let updateCalls = 0;
let failNextUpdate: Error | null = null;
let nonErrorFailure: unknown = null;
let savingFlags: boolean[] = [];

function takeFailure(): unknown {
  if (failNextUpdate !== null) {
    const error = failNextUpdate;
    failNextUpdate = null;
    return error;
  }
  if (nonErrorFailure !== null) {
    const failure = nonErrorFailure;
    nonErrorFailure = null;
    return failure;
  }
  return null;
}

function createStore() {
  return createFakeStore({
    update: async (id: number, note) => {
      updateCalls += 1;

      const failure = takeFailure();
      if (failure !== null) throw failure;

      updates.push({ id, ...note });
      return {
        id,
        title: note.title,
        body: note.body,
        createdAt: "2026-01-01 10:00:00",
        updatedAt: "2026-01-01 10:05:00",
      };
    },
    setIsSaving: (saving: boolean) => {
      savingFlags.push(saving);
    },
  });
}

const NOTE: Note = {
  id: 42,
  title: "عنوان اولیه",
  body: "متن اولیه",
  createdAt: "2026-01-01 10:00:00",
  updatedAt: "2026-01-01 10:00:00",
};

function renderEditor() {
  const store = createStore();
  const result = renderEditorWith(store);
  return result;
}

function renderEditorWith(store = createStore()) {
  return renderWithProviders(<NoteEditor note={NOTE} />, { store });
}

beforeEach(() => {
  updates = [];
  updateCalls = 0;
  failNextUpdate = null;
  nonErrorFailure = null;
  savingFlags = [];
});

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
});

function titleField(): HTMLElement {
  return screen.getByRole("textbox", { name: "عنوان" });
}

function bodyField(): HTMLElement {
  return screen.getByRole("textbox", { name: "متن یادداشت" });
}

function bodyText(): string {
  return bodyField().textContent ?? "";
}

function typeIntoTitle(text: string): void {
  const field = titleField();
  field.textContent = text;
  act(() => {
    fireEvent.input(field);
  });
}

function typeIntoBody(text: string): void {
  setBodyContent(`<p>${text}</p>`);
}

function appendToBody(text: string): void {
  const editor = bodyEditor();
  act(() => {
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, text);
  });
}

function pressTitleEmojiShortcut(): void {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyG",
        ctrlKey: true,
        altKey: true,
      }),
    );
  });
}

describe("NoteEditor initial render", () => {
  test("shows the stored title and body", () => {
    renderEditor();

    expect(titleField().textContent).toBe("عنوان اولیه");
    expect(bodyText()).toBe("متن اولیه");
  });

  test("does not save on mount", async () => {
    renderEditor();

    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(updateCalls).toBe(0);
  });

  test("marks the body as multiline and the title as single line", () => {
    renderEditor();

    expect(titleField().getAttribute("aria-multiline")).toBe("false");
    expect(bodyField().getAttribute("aria-multiline")).toBe("true");
  });

  test("keeps the title emoji picker on the title's own line", () => {
    renderEditor();

    const row = titleField().parentElement;

    expect(
      [...(row?.children ?? [])].map(
        (child) =>
          child.getAttribute("aria-label") ?? child.getAttribute("data-slot"),
      ),
    ).toEqual(["عنوان", "separator", "انتخاب ایموجی"]);
  });

  test("pads the note column below the body only", () => {
    renderEditor();

    const wrapper = titleField().parentElement?.parentElement;

    expect(wrapper?.className).toContain("pb-8");
    expect(wrapper?.className).not.toContain("py-");
  });

  test("keeps the title inset from the pane edge", () => {
    renderEditor();

    expect(titleField().parentElement?.className).toContain("px-6");
  });

  test("draws the title without a rule under it", () => {
    renderEditor();

    const className = titleField().className;

    expect(className).not.toContain("border-b");
    expect(className).not.toContain("focus:border-ring");
  });

  test("hides the save indicator until something happens", () => {
    renderEditor();

    expect(screen.getByRole("status").textContent).toContain("ذخیره شد");
  });
});

describe("NoteEditor autosave", () => {
  test("saves the body after the debounce delay", async () => {
    renderEditor();

    typeIntoBody("متن جدید");

    await waitFor(() => expect(updateCalls).toBe(1), { timeout: 2000 });
    expect(updates[0]).toEqual({
      id: 42,
      title: "عنوان اولیه",
      body: "<p>متن جدید</p>",
    });
  });

  test("does not save before the debounce delay elapses", async () => {
    renderEditor();

    typeIntoBody("متن جدید");

    await Bun.sleep(300);

    expect(updateCalls).toBe(0);
  });

  test("waits close to a second rather than saving straight away", async () => {
    renderEditor();

    typeIntoBody("متن جدید");

    await Bun.sleep(700);

    expect(updateCalls).toBe(0);
  });

  test("saves only once for several rapid edits", async () => {
    renderEditor();

    typeIntoBody("ی");
    typeIntoBody("یو");
    typeIntoBody("یک");

    await waitFor(() => expect(updateCalls).toBe(1), { timeout: 2000 });
    expect(updates[0]?.body).toBe("<p>یک</p>");
  });

  test("saves the title", async () => {
    renderEditor();

    typeIntoTitle("عنوان تازه");

    await waitFor(() => expect(updateCalls).toBe(1), { timeout: 2000 });
    expect(updates[0]?.title).toBe("عنوان تازه");
  });

  test("shows the saving and saved states", async () => {
    renderEditor();

    typeIntoBody("متن جدید");

    await waitFor(
      () =>
        expect(screen.getByRole("status").textContent).toContain("ذخیره شد"),
      {
        timeout: 2000,
      },
    );
  });

  test("flags saving on the shared store", async () => {
    renderEditor();

    typeIntoBody("متن جدید");

    await waitFor(() => expect(savingFlags).toContain(true), { timeout: 2000 });
    expect(savingFlags).toContain(false);
  });

  test("saves the formatting applied in the body", async () => {
    renderEditor();

    setBodyContent("<p>متن جدید</p>");
    const editor = bodyEditor();
    act(() => {
      editor.commands.selectAll();
      editor.chain().focus().toggleBold().run();
    });

    await waitFor(() => expect(updateCalls).toBe(1), { timeout: 2000 });
    expect(updates[0]?.body).toBe("<p><strong>متن جدید</strong></p>");
  });
});

describe("NoteEditor save failures", () => {
  test("reports a rejected save", async () => {
    failNextUpdate = new Error("دیتابیس قفل است");

    renderEditor();
    typeIntoBody("متن جدید");

    await waitFor(
      () =>
        expect(screen.getByRole("status").textContent).toContain(
          "دیتابیس قفل است",
        ),
      { timeout: 2000 },
    );
  });

  test("falls back to a generic message for a non error failure", async () => {
    renderEditor();

    nonErrorFailure = { reason: "not an Error instance" };
    typeIntoBody("متن جدید");

    typeIntoBody("متن جدید");

    await waitFor(
      () =>
        expect(screen.getByRole("status").textContent).toContain(
          "ذخیره یادداشت ناموفق بود",
        ),
      { timeout: 2000 },
    );
  });
});

describe("NoteEditor keyboard", () => {
  test("moves the caret to the body on Enter", async () => {
    renderEditor();

    act(() => {
      fireEvent.keyDown(titleField(), { key: "Enter" });
    });
    await waitForEditorFrame();

    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "متن یادداشت",
    );
  });

  test("leaves Tab to move focus out of the title", async () => {
    renderEditor();

    act(() => {
      fireEvent.keyDown(titleField(), { key: "Tab" });
    });
    await waitForEditorFrame();

    expect(document.activeElement?.getAttribute("aria-label")).not.toBe(
      "متن یادداشت",
    );
  });

  test("prevents default for a bold shortcut", () => {
    renderEditor();

    const event = new KeyboardEvent("keydown", {
      key: "b",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      titleField().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  test("allows an italic shortcut through the meta key", () => {
    renderEditor();

    const event = new KeyboardEvent("keydown", {
      key: "i",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      titleField().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  test("does not prevent default for an unformatted key", () => {
    renderEditor();

    const event = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      titleField().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
  });

  test("cancels a bold command on the title", () => {
    renderEditor();

    const event = new InputEvent("beforeinput", {
      inputType: "formatBold",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      titleField().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  test("cancels an italic command on the title", () => {
    renderEditor();

    const event = new InputEvent("beforeinput", {
      inputType: "formatItalic",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      titleField().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  test("cancels an underline command on the title", () => {
    renderEditor();

    const event = new InputEvent("beforeinput", {
      inputType: "formatUnderline",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      titleField().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  test("lets a plain insertion through", () => {
    renderEditor();

    const event = new InputEvent("beforeinput", {
      inputType: "insertText",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      titleField().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
  });

  test("cancels a bold shortcut on a persian keyboard layout", () => {
    renderEditor();

    const event = new KeyboardEvent("keydown", {
      key: "ب",
      code: "KeyB",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      titleField().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  test("cancels an italic shortcut on a persian keyboard layout", () => {
    renderEditor();

    const event = new KeyboardEvent("keydown", {
      key: "د",
      code: "KeyI",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      titleField().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  test("unwraps markup that reaches the title", () => {
    renderEditor();

    const field = titleField();
    field.innerHTML = "<b>پررنگ</b>";
    act(() => {
      fireEvent.input(field);
    });

    expect(field.innerHTML).toBe("پررنگ");
  });

  test("strips every element from the title", () => {
    renderEditor();

    const field = titleField();
    field.innerHTML = `<span class="text-xl leading-none">😀</span><i>کج</i>`;
    act(() => {
      fireEvent.input(field);
    });

    expect(field.innerHTML).toBe("😀کج");
  });

  test("inserts a chosen emoji as plain text", async () => {
    const commands: string[] = [];
    const original = document.execCommand;
    document.execCommand = ((command: string) => {
      commands.push(command);
      return true;
    }) as typeof document.execCommand;

    try {
      renderEditor();

      const picker = titleField().parentElement as HTMLElement;
      fireEvent.click(
        within(picker).getByRole("button", { name: EMOJI_LABEL }),
      );
      fireEvent.click(
        await screen.findByRole("gridcell", {
          name: FREQUENT_EMOJI[0] as string,
        }),
      );

      expect(commands).toEqual(["insertText"]);
    } finally {
      document.execCommand = original;
    }
  });

  test("opens the title emoji grid on Ctrl + Alt + G", () => {
    renderEditor();

    pressTitleEmojiShortcut();

    expect(screen.getByRole("grid", { name: EMOJI_LABEL })).toBeDefined();
  });

  test("opens the title emoji grid from the body too", () => {
    renderEditor();

    setBodyContent("<p>متن</p>");
    pressTitleEmojiShortcut();

    expect(screen.getByRole("grid", { name: EMOJI_LABEL })).toBeDefined();
  });

  test("closes the title emoji grid when the shortcut repeats", () => {
    renderEditor();

    pressTitleEmojiShortcut();
    pressTitleEmojiShortcut();

    expect(screen.queryByRole("grid", { name: EMOJI_LABEL })).toBeNull();
  });

  test("leaves the title emoji grid closed without alt", () => {
    renderEditor();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          code: "KeyG",
          ctrlKey: true,
        }),
      );
    });

    expect(screen.queryByRole("grid", { name: EMOJI_LABEL })).toBeNull();
  });

  test("leaves the caret where it was when a formatting command is cancelled", () => {
    renderEditor();

    const field = titleField();
    field.textContent = "عنوان اولیه";

    const range = document.createRange();
    const textNode = field.firstChild as Text;
    range.setStart(textNode, 5);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const event = new InputEvent("beforeinput", {
      inputType: "formatBold",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      field.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(selection?.anchorNode === textNode).toBe(true);
    expect(selection?.anchorOffset).toBe(5);
  });

  test("leaves Ctrl + Z to the title instead of undoing the body", () => {
    renderEditor();

    appendToBody(" تازه");
    expect(bodyText()).toBe("متن اولیه تازه");

    const event = new KeyboardEvent("keydown", {
      key: "z",
      code: "KeyZ",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      titleField().dispatchEvent(event);
    });

    expect(bodyText()).toBe("متن اولیه تازه");
    expect(event.defaultPrevented).toBe(false);
  });

  test("still undoes the body on Ctrl + Z once the body has the caret", () => {
    renderEditor();

    appendToBody(" تازه");
    expect(bodyText()).toBe("متن اولیه تازه");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "z",
          code: "KeyZ",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(bodyText()).toBe("متن اولیه");
  });

  test("keeps the caret attached to its text when markup is unwrapped", () => {
    renderEditor();

    const field = titleField();
    field.innerHTML = "عنوان <b>پررنگ</b>";

    const bold = field.querySelector("b") as HTMLElement;
    const textNode = bold.firstChild as Text;

    const range = document.createRange();
    range.setStart(textNode, 3);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    act(() => {
      fireEvent.input(field);
    });

    expect(field.innerHTML).toBe("عنوان پررنگ");
    expect(selection?.anchorNode === textNode).toBe(true);
    expect(selection?.anchorOffset).toBe(3);
  });
});

function pressCtrl(key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe("NoteEditor Ctrl+S save", () => {
  test("saves right away and drops the pending debounce", async () => {
    renderEditor();

    typeIntoBody("متن جدید");

    await Bun.sleep(300);
    expect(updateCalls).toBe(0);

    pressCtrl("s");

    await waitFor(() => expect(updateCalls).toBe(1), { timeout: 2000 });
    expect(updates[0]).toEqual({
      id: 42,
      title: "عنوان اولیه",
      body: "<p>متن جدید</p>",
    });

    await Bun.sleep(1000);
    expect(updateCalls).toBe(1);
  });

  test("saves a note that is already saved", async () => {
    renderEditor();

    await Bun.sleep(900);
    expect(updateCalls).toBe(0);

    pressCtrl("s");

    await waitFor(() => expect(updateCalls).toBe(1), { timeout: 2000 });
    expect(updates[0]).toEqual({
      id: 42,
      title: "عنوان اولیه",
      body: "متن اولیه",
    });
  });

  test("saves again after the debounce saved and the indicator faded", async () => {
    renderEditor();

    typeIntoTitle("عنوان تازه");

    await waitFor(() => expect(updateCalls).toBe(1), { timeout: 2000 });
    await Bun.sleep(2200);

    pressCtrl("s");

    await waitFor(() => expect(updateCalls).toBe(2), { timeout: 2000 });
  });

  test("saves on a persian keyboard layout", async () => {
    renderEditor();

    typeIntoBody("متن جدید");

    await waitFor(() => expect(updateCalls).toBe(1), { timeout: 2000 });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "س",
          code: "KeyS",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await waitFor(() => expect(updateCalls).toBe(2), { timeout: 2000 });
  });

  test("saves even when the editor swallows the keydown", async () => {
    renderEditor();

    const swallow = (event: KeyboardEvent) => event.stopPropagation();
    bodyField().addEventListener("keydown", swallow);

    act(() => {
      bodyField().dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "s",
          code: "KeyS",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    bodyField().removeEventListener("keydown", swallow);

    await waitFor(() => expect(updateCalls).toBe(1), { timeout: 2000 });
  });

  test("prevents the default browser save", () => {
    renderEditor();

    expect(pressCtrl("s").defaultPrevented).toBe(true);
  });

  test("leaves the save to the debounce without a modifier", async () => {
    renderEditor();

    typeIntoBody("متن جدید");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "s",
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await Bun.sleep(300);
    expect(updateCalls).toBe(0);
  });

  test("reports a rejected manual save", async () => {
    failNextUpdate = new Error("دیتابیس قفل است");

    renderEditor();
    pressCtrl("s");

    await waitFor(
      () =>
        expect(screen.getByRole("status").textContent).toContain(
          "دیتابیس قفل است",
        ),
      { timeout: 2000 },
    );
  });
});

describe("NoteEditor back to notes", () => {
  test("names the back shortcut in the back button tooltip", async () => {
    renderEditor();

    fireHover(
      screen.getByRole("button", { name: BACK_TO_NOTES_SHORTCUT.label }),
    );

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeDefined());
    expect(screen.getByRole("tooltip").textContent).toContain(
      BACK_TO_NOTES_SHORTCUT.label,
    );
  });

  test("puts the back combination in the tooltip kbd", async () => {
    renderEditor();

    fireHover(
      screen.getByRole("button", { name: BACK_TO_NOTES_SHORTCUT.label }),
    );

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeDefined());
    expect(screen.getByRole("tooltip").querySelector("kbd")?.textContent).toBe(
      BACK_TO_NOTES_SHORTCUT.combination,
    );
  });

  test("flushes the pending save on the shortcut", async () => {
    renderEditor();
    typeIntoBody("متن تازه");

    await Bun.sleep(300);
    expect(updateCalls).toBe(0);

    pressCtrl("l");

    await waitFor(() => expect(updateCalls).toBe(1), { timeout: 2000 });
    expect(updates[0]).toEqual({
      id: 42,
      title: "عنوان اولیه",
      body: "<p>متن تازه</p>",
    });
  });

  test("prevents the default window behavior", () => {
    renderEditor();

    expect(pressCtrl("l").defaultPrevented).toBe(true);
  });

  test("leaves an unchanged note unsaved", async () => {
    renderEditor();

    pressCtrl("l");

    await Bun.sleep(300);
    expect(updateCalls).toBe(0);
  });

  test("works on a persian keyboard layout", async () => {
    renderEditor();
    typeIntoBody("متن تازه");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ل",
          code: BACK_TO_NOTES_SHORTCUT.code,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await waitFor(() => expect(updateCalls).toBe(1), { timeout: 2000 });
  });
});

describe("NoteEditor paste", () => {
  function clipboardWith(text: string) {
    return { getData: (type: string) => (type === "text/plain" ? text : "") };
  }

  test("collapses whitespace pasted into the title", () => {
    renderEditor();

    act(() => {
      fireEvent.paste(titleField(), {
        clipboardData: clipboardWith("  چند   خط\n\tجدید  "),
      });
    });

    expect(screen.getByRole("status")).toBeDefined();
  });

  test("hands the body paste to the rich text editor", () => {
    renderEditor();

    act(() => {
      fireEvent.paste(bodyField(), {
        clipboardData: clipboardWith("چسبانده"),
      });
    });

    expect(bodyText()).toBe("چسباندهمتن اولیه");
  });
});

describe("NoteEditor unload flush", () => {
  test("writes a pending change synchronously before unload", () => {
    installNotesBridgeForSync();

    renderEditor();
    typeIntoBody("ذخیره نشده");

    act(() => {
      window.dispatchEvent(new Event("beforeunload"));
    });

    expect(syncedUpdates.at(-1)).toEqual({
      id: 42,
      title: "عنوان اولیه",
      body: "<p>ذخیره نشده</p>",
    });
  });

  test("does not write anything when there is no pending change", () => {
    installNotesBridgeForSync();

    renderEditor();

    act(() => {
      window.dispatchEvent(new Event("beforeunload"));
    });

    expect(syncedUpdates).toHaveLength(0);
  });
});

let syncedUpdates: Array<{ id: number; title: string; body: string }> = [];

function installNotesBridgeForSync(): void {
  syncedUpdates = [];
  (globalThis as unknown as Record<string, unknown>)["NoteApp"] = {
    notes: {
      list: async () => [],
      create: async () => NOTE,
      remove: async () => true,
      update: async () => NOTE,
      updateSync: (id: number, note: { title: string; body: string }) => {
        syncedUpdates.push({ id, ...note });
      },
      onChanged: () => () => {},
    },
  };
}
