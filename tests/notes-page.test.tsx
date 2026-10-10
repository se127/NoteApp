import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

import type { Note } from "@/lib/notes";
import { NotesPage } from "@/pages/notes-page";
import {
  DELETE_SELECTED_SHORTCUT,
  NEW_NOTE_SHORTCUT,
  SELECT_MODE_SHORTCUT,
} from "@/lib/shortcuts";
import { createFakeStore } from "./helpers/fake-store";
import { fireHover } from "./helpers/hover";
import { renderWithProviders } from "./helpers/render";

type Store = ReturnType<typeof createFakeStore>;

const DELETE_NAME = /^حذف یادداشت های انتخاب شده/;

let created: Array<{ title: string; body: string }> = [];
let createFailure: Error | null = null;

function buildStore(overrides: Partial<Store> = {}): Store {
  const base = createFakeStore({
    create: async (note) => {
      if (createFailure !== null) throw createFailure;

      created.push({ ...note });
      return {
        id: 99,
        title: note.title,
        body: note.body,
        createdAt: "2026-01-01 10:00:00",
        updatedAt: "2026-01-01 10:00:00",
      };
    },
  });

  return { ...base, ...overrides };
}

function renderPage(
  store = buildStore(),
  notes: Note[] = [],
  totalCount = notes.length,
) {
  return renderWithProviders(<NotesPage />, {
    store: { ...store, notes, totalCount },
  });
}

beforeEach(() => {
  created = [];
  createFailure = null;
});

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
});

const NOTES: Note[] = [
  { id: 1, title: "اول", body: "", createdAt: "", updatedAt: "" },
  { id: 2, title: "دوم", body: "", createdAt: "", updatedAt: "" },
];

describe("NotesPage select mode", () => {
  test("hides the select toggle while there are no notes", () => {
    renderPage();

    expect(
      screen.queryByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    ).toBeNull();
  });

  test("shows no checkbox until the mode is on", () => {
    renderPage(buildStore(), NOTES);

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  test("adds a checkbox to every row once the mode is on", () => {
    renderPage(buildStore(), NOTES);

    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  test("marks the toggle as pressed while the mode is on", () => {
    renderPage(buildStore(), NOTES);

    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );

    expect(
      screen
        .getByRole("button", { name: "حالت انتخاب برای یادداشت ها" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  test("removes the checkboxes again when the mode is switched off", () => {
    renderPage(buildStore(), NOTES);
    const toggle = screen.getByRole("button", {
      name: "حالت انتخاب برای یادداشت ها",
    });

    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  test("opens the note from the title when no checkbox is showing", () => {
    renderPage(buildStore(), NOTES);

    expect(screen.getByRole("link", { name: "اول" })).toBeDefined();
  });

  test("shows the select toggle as an icon only button", () => {
    renderPage(buildStore(), NOTES);

    expect(
      screen
        .getByRole("button", { name: "حالت انتخاب برای یادداشت ها" })
        .getAttribute("data-size"),
    ).toBe("icon");
  });

  test("names the select shortcut in its tooltip", async () => {
    renderPage(buildStore(), NOTES);

    fireHover(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toContain(
        SELECT_MODE_SHORTCUT.combination,
      ),
    );
  });

  test("toggles the mode with its shortcut", () => {
    renderPage(buildStore(), NOTES);

    pressShortcut("e", { shiftKey: true });
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);

    pressShortcut("e", { shiftKey: true });
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  test("prevents the default window behavior of the select shortcut", () => {
    renderPage(buildStore(), NOTES);

    expect(pressShortcut("e", { shiftKey: true }).defaultPrevented).toBe(true);
  });

  test("leaves a bare shift+e to the page", () => {
    renderPage(buildStore(), NOTES);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "e",
          code: "KeyE",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe("NotesPage deleting selected notes", () => {
  let removedIds: number[] = [];
  let removeBatches: number[][] = [];
  let removeFailure: Error | null = null;

  beforeEach(() => {
    removedIds = [];
    removeBatches = [];
    removeFailure = null;
  });

  function renderSelectable() {
    const store = createFakeStore({
      remove: async (id) => {
        if (removeFailure !== null) throw removeFailure;

        removedIds.push(id);
        return true;
      },
      removeMany: async (ids) => {
        if (removeFailure !== null) throw removeFailure;

        removeBatches.push(ids);
        removedIds.push(...ids);
        return ids.length;
      },
    });

    return renderPage(store, NOTES);
  }

  async function selectFirstAndOpenDialog(): Promise<void> {
    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "اول" }));
    fireEvent.click(await screen.findByRole("button", { name: DELETE_NAME }));
  }

  test("keeps the delete button hidden until something is selected", () => {
    renderSelectable();

    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );

    expect(screen.queryByRole("button", { name: DELETE_NAME })).toBeNull();
  });

  test("counts the selected notes on the delete button", async () => {
    renderSelectable();

    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "اول" }));

    expect(
      screen.getByRole("button", { name: "حذف یادداشت های انتخاب شده (۱)" }),
    ).toBeDefined();
  });

  test("shows the label and the count as the button text", () => {
    renderSelectable();

    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "اول" }));

    expect(screen.getByRole("button", { name: DELETE_NAME }).textContent).toBe(
      "حذف یادداشت های انتخاب شده (۱)",
    );
  });

  test("shows only the delete shortcut on its tooltip", async () => {
    renderSelectable();

    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "اول" }));
    fireHover(screen.getByRole("button", { name: DELETE_NAME }));

    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toBe(
        DELETE_SELECTED_SHORTCUT.combination,
      ),
    );
  });

  test("opens the confirmation with the delete shortcut", async () => {
    renderSelectable();

    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "اول" }));
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: DELETE_SELECTED_SHORTCUT.key,
          code: DELETE_SELECTED_SHORTCUT.code,
          ctrlKey: true,
          altKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(
      await screen.findByText(
        "۱ یادداشت برای همیشه حذف می شوند و قابل بازگشت نیستند.",
      ),
    ).toBeDefined();
  });

  test("leaves the delete shortcut inert while nothing is selected", () => {
    renderSelectable();

    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );

    const event = new KeyboardEvent("keydown", {
      key: DELETE_SELECTED_SHORTCUT.key,
      code: DELETE_SELECTED_SHORTCUT.code,
      ctrlKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  test("says how many notes are about to be deleted", async () => {
    renderSelectable();

    await selectFirstAndOpenDialog();

    expect(
      await screen.findByText(
        "۱ یادداشت برای همیشه حذف می شوند و قابل بازگشت نیستند.",
      ),
    ).toBeDefined();
  });

  test("counts a multi note selection in persian digits", async () => {
    renderSelectable();
    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "اول" }));
    fireEvent.click(screen.getByRole("button", { name: "دوم" }));
    fireEvent.click(screen.getByRole("button", { name: DELETE_NAME }));

    expect(
      await screen.findByText(
        "۲ یادداشت برای همیشه حذف می شوند و قابل بازگشت نیستند.",
      ),
    ).toBeDefined();
  });

  test("deletes only the selected notes once confirmed", async () => {
    renderSelectable();
    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "اول" }));
    fireEvent.click(screen.getByRole("button", { name: "دوم" }));

    fireEvent.click(await screen.findByRole("button", { name: DELETE_NAME }));
    fireEvent.click(await screen.findByRole("button", { name: "بله" }));

    await waitFor(() => expect(removedIds).toEqual([1, 2]));
  });

  test("sends the whole selection as one batch rather than one call per note", async () => {
    renderSelectable();
    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "اول" }));
    fireEvent.click(screen.getByRole("button", { name: "دوم" }));

    fireEvent.click(await screen.findByRole("button", { name: DELETE_NAME }));
    fireEvent.click(await screen.findByRole("button", { name: "بله" }));

    await waitFor(() => expect(removeBatches).toHaveLength(1));
    expect(removeBatches[0]).toEqual([1, 2]);
  });

  test("deletes nothing before the confirmation", async () => {
    renderSelectable();

    await selectFirstAndOpenDialog();
    expect(removedIds).toHaveLength(0);
  });

  test("deletes nothing when the confirmation is cancelled", async () => {
    renderSelectable();

    await selectFirstAndOpenDialog();
    fireEvent.click(await screen.findByRole("button", { name: "انصراف" }));

    await waitFor(() =>
      expect(screen.queryByText(/قابل بازگشت نیستند/)).toBeNull(),
    );
    expect(removedIds).toHaveLength(0);
  });

  test("clears the selection and leaves the mode after deleting", async () => {
    renderSelectable();

    await selectFirstAndOpenDialog();
    fireEvent.click(await screen.findByRole("button", { name: "بله" }));

    await waitFor(() =>
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0),
    );
    expect(
      screen
        .getByRole("button", { name: "حالت انتخاب برای یادداشت ها" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  test("keeps the dialog open and reports a delete failure", async () => {
    removeFailure = new Error("حذف ناموفق بود");
    renderSelectable();

    await selectFirstAndOpenDialog();
    fireEvent.click(await screen.findByRole("button", { name: "بله" }));

    expect(await screen.findByText("حذف ناموفق بود")).toBeDefined();
  });
});

describe("NotesPage states", () => {
  test("shows a loading message while notes are read", () => {
    renderPage(buildStore({ isLoading: true }));

    expect(screen.getByText("در حال بارگذاری...")).toBeDefined();
  });

  test("shows an empty state with no notes", () => {
    renderPage();

    expect(screen.getByText("هیچ یادداشتی نیست")).toBeDefined();
  });

  test("shows the store error instead of the table", () => {
    renderPage(buildStore({ error: "پایگاه داده خراب است" }));

    expect(screen.getByRole("alert").textContent).toBe("پایگاه داده خراب است");
  });

  test("labels the notes table for assistive technology", () => {
    renderPage(buildStore(), [
      { id: 1, title: "اول", body: "", createdAt: "", updatedAt: "" },
    ]);

    expect(screen.getByRole("table", { name: "یادداشت ها" })).toBeDefined();
  });
});

describe("NotesPage heading", () => {
  test("counts the notes in persian digits below the new note button", () => {
    renderPage(buildStore(), NOTES);

    const heading = screen.getByRole("heading", { name: "یادداشت ها (۲)" });
    const newNote = screen.getByRole("button", { name: "یادداشت جدید" });

    expect(heading.tagName).toBe("H1");
    expect(
      newNote.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("counts an empty list as zero", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "یادداشت ها (۰)" }),
    ).toBeDefined();
  });

  test("shows the total from the count query rather than the page length", () => {
    renderPage(buildStore(), NOTES, 1375);

    expect(
      screen.getByRole("heading", { name: "یادداشت ها (۱٬۳۷۵)" }),
    ).toBeDefined();
  });

  test("keeps the total while the table shows a single row", () => {
    renderPage(buildStore(), [NOTES[0]!], 42);

    expect(
      screen.getByRole("heading", { name: "یادداشت ها (۴۲)" }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "اول" })).toBeDefined();
  });

  test("shows a total of one thousand with an empty table", () => {
    renderPage(buildStore(), [], 1000);

    expect(
      screen.getByRole("heading", { name: "یادداشت ها (۱٬۰۰۰)" }),
    ).toBeDefined();
    expect(screen.getByText("هیچ یادداشتی نیست")).toBeDefined();
  });

  test("carries a real heading size", () => {
    renderPage(buildStore(), NOTES);

    const heading = screen.getByRole("heading", { name: "یادداشت ها (۲)" });

    expect(heading.className).toContain("text-2xl");
    expect(heading.className).toContain("font-bold");
  });
});

describe("NotesPage scrolling", () => {
  function scrollAncestorOf(element: Element): Element | null {
    let current = element.parentElement;

    while (current !== null) {
      if (current.className.includes("overflow-auto")) return current;
      current = current.parentElement;
    }

    return null;
  }

  test("keeps the select toolbar out of the scrolling area", () => {
    renderPage(buildStore(), NOTES);

    const toggle = screen.getByRole("button", {
      name: "حالت انتخاب برای یادداشت ها",
    });

    expect(scrollAncestorOf(toggle)).toBeNull();
  });

  test("keeps the delete button out of the scrolling area", () => {
    renderPage(buildStore(), NOTES);

    fireEvent.click(
      screen.getByRole("button", { name: "حالت انتخاب برای یادداشت ها" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "اول" }));

    const deleteButton = screen.getByRole("button", { name: DELETE_NAME });
    expect(scrollAncestorOf(deleteButton)).toBeNull();
  });

  test("scrolls the table itself", () => {
    renderPage(buildStore(), NOTES);

    const table = screen.getByRole("table", { name: "یادداشت ها" });

    expect(scrollAncestorOf(table)).not.toBeNull();
  });

  test("leaves the table container free to scroll so the header can stick", () => {
    const { container } = renderPage(buildStore(), NOTES);

    const tableContainer = container.querySelector(
      '[data-slot="table-container"]',
    );

    expect(tableContainer?.parentElement?.className).toContain(
      "overflow-x-visible",
    );
  });

  test("puts the gap on the یادداشت ها heading itself", () => {
    renderPage(buildStore(), NOTES);

    const heading = screen.getByRole("heading", { name: "یادداشت ها (۲)" });

    expect(heading.className).toContain("mb-4");
  });

  test("spaces the empty notes box below the heading with no double gap", () => {
    renderPage();

    const heading = screen.getByRole("heading", { name: "یادداشت ها (۰)" });
    const scroller = screen
      .getByText("هیچ یادداشتی نیست")
      .closest(".overflow-auto");

    expect(heading.className).toContain("mb-4");
    expect(scroller?.className).not.toContain("mt-");
  });

  test("gives the table a tighter gap than the heading gets", () => {
    renderPage(buildStore(), NOTES);

    const heading = screen.getByRole("heading", { name: "یادداشت ها (۲)" });
    const toggle = screen.getByRole("button", {
      name: "حالت انتخاب برای یادداشت ها",
    });
    const bar = toggle.parentElement;

    expect(bar?.className).not.toContain("mt-");
    expect(bar?.className).toContain("mb-2");
    expect(bar?.className).not.toContain("mb-4");
    expect(heading.className).toContain("mb-4");
  });

  test("puts the heading directly above the select toolbar", () => {
    renderPage(buildStore(), NOTES);

    const heading = screen.getByRole("heading", { name: "یادداشت ها (۲)" });
    const toggle = screen.getByRole("button", {
      name: "حالت انتخاب برای یادداشت ها",
    });

    expect(heading.compareDocumentPosition(toggle.parentElement as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});

describe("NotesPage creating a note", () => {
  test("creates an empty note", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toEqual({ title: "", body: "" });
  });

  test("reports a create failure", async () => {
    createFailure = new Error("ساخت ناموفق بود");

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("ساخت ناموفق بود"),
    );
  });

  test("falls back to a generic create message", async () => {
    const store = buildStore({
      create: async () => {
        throw "boom";
      },
    });

    renderPage(store);
    fireEvent.click(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "ساخت یادداشت ناموفق بود",
      ),
    );
  });

  test("disables the button while another note is saving", () => {
    renderPage(buildStore({ isSaving: true }));

    const button = screen.getByRole("button", { name: "یادداشت جدید" });
    expect(button.hasAttribute("disabled")).toBe(true);
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

function pressShortcut(
  key: string,
  modifiers: { altKey?: boolean; shiftKey?: boolean } = {},
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    code: `Key${key.toUpperCase()}`,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe("NotesPage new note tooltip", () => {
  test("names the new note shortcut in its tooltip", async () => {
    renderPage();

    fireHover(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeDefined());
    expect(screen.getByRole("tooltip").textContent).toContain("یادداشت جدید");
  });

  test("puts the combination in the tooltip kbd", async () => {
    renderPage();

    fireHover(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeDefined());
    expect(screen.getByRole("tooltip").querySelector("kbd")?.textContent).toBe(
      NEW_NOTE_SHORTCUT.combination,
    );
  });
});

describe("NotesPage Ctrl+N new note", () => {
  test("creates an empty note", async () => {
    renderPage();

    pressCtrl("n");

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toEqual({ title: "", body: "" });
  });

  test("prevents the default window behavior", () => {
    renderPage();

    expect(pressCtrl("n").defaultPrevented).toBe(true);
  });

  test("reports a create failure", async () => {
    createFailure = new Error("ساخت ناموفق بود");

    renderPage();
    pressCtrl("n");

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("ساخت ناموفق بود"),
    );
  });

  test("ignores a repeated shortcut while a note is being created", async () => {
    let attempts = 0;
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const store = buildStore({
      create: async (note) => {
        attempts += 1;
        await gate;
        return {
          id: 99,
          title: note.title,
          body: note.body,
          createdAt: "2026-01-01 10:00:00",
          updatedAt: "2026-01-01 10:00:00",
        };
      },
    });

    renderPage(store);

    pressCtrl("n");
    await screen.findByRole("button", { name: "در حال ساخت..." });
    pressCtrl("n");

    expect(attempts).toBe(1);

    await act(async () => {
      release();
    });

    await waitFor(() => expect(attempts).toBe(1));
    expect(screen.getByRole("button", { name: "یادداشت جدید" })).toBeDefined();
  });

  test("ignores the shortcut while another note is saving", async () => {
    renderPage(buildStore({ isSaving: true }));

    pressCtrl("n");

    await Bun.sleep(200);
    expect(created).toHaveLength(0);
  });

  test("leaves a bare key to the editor", async () => {
    renderPage();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "n",
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await Bun.sleep(200);
    expect(created).toHaveLength(0);
  });

  test("creates a note on a persian keyboard layout", async () => {
    renderPage();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ن",
          code: "KeyN",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await waitFor(() => expect(created).toHaveLength(1));
  });
});
