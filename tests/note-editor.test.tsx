import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

import { NoteEditor } from "@/components/note-editor";
import type { Note } from "@/lib/notes";
import { createFakeStore } from "./helpers/fake-store";
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
  delete (globalThis as unknown as Record<string, unknown>)["noteApp"];
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
});

describe("NoteEditor paste", () => {
  test("collapses whitespace pasted into the title", () => {
    renderEditor();

    act(() => {
      fireEvent.paste(titleField(), {
        clipboardData: { getData: () => "  چند   خط\n\tجدید  " },
      });
    });

    expect(screen.getByRole("status")).toBeDefined();
  });

  test("hands the body paste to the rich text editor", () => {
    renderEditor();

    act(() => {
      fireEvent.paste(bodyField(), {
        clipboardData: { getData: () => "چسبانده" },
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
  (globalThis as unknown as Record<string, unknown>)["noteApp"] = {
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
