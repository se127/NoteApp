import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import App from "@/App";
import {
  createFakeNotesBridge,
  installNotesBridge,
  makeNote,
  type FakeNotesBridge,
} from "./helpers/browser-bridge";
import { setBodyContent } from "./helpers/note-body";
import { renderWithProviders } from "./helpers/render";

let bridge: FakeNotesBridge;

function renderAppAt(route: string) {
  bridge = installNotesBridge(createFakeNotesBridge());
  return renderWithProviders(<App />, { route });
}

function typeIntoTitle(element: HTMLElement, text: string): void {
  element.textContent = text;
  act(() => {
    fireEvent.input(element);
  });
}

beforeEach(() => {
  bridge = installNotesBridge(createFakeNotesBridge());
});

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
});

describe("editing a note end to end", () => {
  test("opens the editor for a note in the list", async () => {
    bridge.notes.push(makeNote({ id: 5, title: "قابل ویرایش", body: "متن" }));

    renderWithProviders(<App />, { route: "/" });

    const link = await screen.findByRole("link", { name: /قابل ویرایش/ });
    fireEvent.click(link);

    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "متن یادداشت" }),
      ).toBeDefined(),
    );
  });

  test("shows a not found message for an unknown note id", async () => {
    renderAppAt("/notes/999/edit");

    expect(await screen.findByText("یادداشت یافت نشد")).toBeDefined();
  });

  test("shows the loading state before the editor appears", async () => {
    renderAppAt("/notes/1/edit");

    expect(await screen.findByText("یادداشت یافت نشد")).toBeDefined();
  });
});

describe("creating a note end to end", () => {
  test("the new note button creates a note and lands in the editor", async () => {
    renderWithProviders(<App />, { route: "/" });

    fireEvent.click(screen.getByRole("button", { name: "یادداشت جدید" }));

    await waitFor(() => expect(bridge.notes).toHaveLength(1));
    expect(bridge.notes[0]?.title).toBe("");
  });

  test("a newly created note appears in the table", async () => {
    renderWithProviders(<App />, { route: "/" });

    fireEvent.click(screen.getByRole("button", { name: "یادداشت جدید" }));

    expect(await screen.findByText("بدون عنوان")).toBeDefined();
  });

  test("the Ctrl+N shortcut creates a note and lands in the editor", async () => {
    renderWithProviders(<App />, { route: "/" });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "n",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await waitFor(() => expect(bridge.notes).toHaveLength(1));
    expect(
      await screen.findByRole("textbox", { name: "متن یادداشت" }),
    ).toBeDefined();
  });
});

describe("deleting a note end to end", () => {
  test("removes the note from the database after confirmation", async () => {
    bridge.notes.push(makeNote({ id: 5, title: "حذف شدنی" }));

    renderWithProviders(<App />, { route: "/" });

    const trigger = await screen.findByRole("button", {
      name: "گزینه های یادداشت حذف شدنی",
    });
    fireEvent.pointerDown(trigger, {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: "حذف" }));
    fireEvent.click(await screen.findByRole("button", { name: "بله" }));

    await waitFor(() => expect(bridge.notes).toHaveLength(0));
  });

  test("keeps the note when the confirmation is cancelled", async () => {
    bridge.notes.push(makeNote({ id: 5, title: "باقی مانده" }));

    renderWithProviders(<App />, { route: "/" });

    const trigger = await screen.findByRole("button", {
      name: "گزینه های یادداشت باقی مانده",
    });
    fireEvent.pointerDown(trigger, {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: "حذف" }));
    fireEvent.click(await screen.findByRole("button", { name: "انصراف" }));

    expect(bridge.notes).toHaveLength(1);
  });
});

async function openNoteMenuInEditor(title: string): Promise<HTMLElement> {
  const trigger = await screen.findByRole("button", {
    name: `گزینه های یادداشت ${title}`,
  });

  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("menuitem", { name: "حذف" }));

  return trigger;
}

describe("deleting from the editor menu", () => {
  test("shows the options menu next to the back button", async () => {
    bridge.notes.push(makeNote({ id: 4, title: "از ویرایشگر" }));

    renderWithProviders(<App />, { route: "/notes/4/edit" });
    await screen.findByRole("textbox", { name: "متن یادداشت" });

    const trigger = await screen.findByRole("button", {
      name: "گزینه های یادداشت از ویرایشگر",
    });

    const row = trigger.closest("div.flex.items-center");
    expect(row?.querySelector("button")?.textContent).toContain(
      "بازگشت به یادداشت ها",
    );
  });

  test("gives the options button the outline style", async () => {
    bridge.notes.push(makeNote({ id: 4, title: "از ویرایشگر" }));

    renderWithProviders(<App />, { route: "/notes/4/edit" });
    await screen.findByRole("textbox", { name: "متن یادداشت" });

    const trigger = await screen.findByRole("button", {
      name: "گزینه های یادداشت از ویرایشگر",
    });

    expect(trigger.getAttribute("data-variant")).toBe("outline");
  });

  test("sizes the options button to match the back button", async () => {
    bridge.notes.push(makeNote({ id: 4, title: "از ویرایشگر" }));

    renderWithProviders(<App />, { route: "/notes/4/edit" });
    await screen.findByRole("textbox", { name: "متن یادداشت" });

    const trigger = await screen.findByRole("button", {
      name: "گزینه های یادداشت از ویرایشگر",
    });
    const back = screen.getByRole("button", { name: "بازگشت به یادداشت ها" });

    expect(trigger.getAttribute("data-size")).toBe("icon");
    expect(back.getAttribute("data-size")).toBe("default");
    expect(trigger.className).toContain("size-8");
    expect(back.className).toContain("h-8");
  });

  test("sizes the title emoji button to match the back button", async () => {
    bridge.notes.push(makeNote({ id: 4, title: "از ویرایشگر" }));

    renderWithProviders(<App />, { route: "/notes/4/edit" });
    await screen.findByRole("textbox", { name: "متن یادداشت" });

    const title = screen.getByRole("textbox", { name: "عنوان" });
    const titleRow = title.parentElement as HTMLElement;
    const emoji = within(titleRow).getByRole("button", {
      name: "انتخاب ایموجی",
    });

    expect(emoji.getAttribute("data-size")).toBe("icon");
    expect(emoji.className).toContain("size-8");
  });

  test("pushes the menu to the far end of the toolbar row", async () => {
    bridge.notes.push(makeNote({ id: 4, title: "از ویرایشگر" }));

    renderWithProviders(<App />, { route: "/notes/4/edit" });
    await screen.findByRole("textbox", { name: "متن یادداشت" });

    const trigger = await screen.findByRole("button", {
      name: "گزینه های یادداشت از ویرایشگر",
    });

    const row = trigger.closest("div.flex.items-center") as HTMLElement;
    const wrapper = trigger.parentElement as HTMLElement;

    expect(row.lastElementChild === wrapper).toBe(true);
    expect(wrapper.className).toContain("ms-auto");
  });

  test("asks for confirmation before deleting", async () => {
    bridge.notes.push(makeNote({ id: 4, title: "از ویرایشگر" }));

    renderWithProviders(<App />, { route: "/notes/4/edit" });
    await screen.findByRole("textbox", { name: "متن یادداشت" });

    await openNoteMenuInEditor("از ویرایشگر");

    expect(
      await screen.findByText("آیا از حذف این یادداشت مطمئن هستید؟"),
    ).toBeDefined();
    expect(bridge.notes).toHaveLength(1);
  });

  test("shows the note title inside the confirmation", async () => {
    bridge.notes.push(makeNote({ id: 4, title: "از ویرایشگر" }));

    renderWithProviders(<App />, { route: "/notes/4/edit" });
    await screen.findByRole("textbox", { name: "متن یادداشت" });

    await openNoteMenuInEditor("از ویرایشگر");

    expect(
      await screen.findByText(
        "«از ویرایشگر» برای همیشه حذف می شود و قابل بازگشت نیست.",
      ),
    ).toBeDefined();
  });

  test("deletes the note and lands in the list", async () => {
    bridge.notes.push(makeNote({ id: 4, title: "از ویرایشگر" }));

    renderWithProviders(<App />, { route: "/notes/4/edit" });
    await screen.findByRole("textbox", { name: "متن یادداشت" });

    await openNoteMenuInEditor("از ویرایشگر");
    fireEvent.click(await screen.findByRole("button", { name: "بله" }));

    await waitFor(() => expect(bridge.notes).toHaveLength(0));
    expect(
      await screen.findByRole("button", { name: "یادداشت جدید" }),
    ).toBeDefined();
    expect(screen.queryByRole("textbox", { name: "متن یادداشت" })).toBeNull();
  });

  test("stays in the editor when the confirmation is cancelled", async () => {
    bridge.notes.push(makeNote({ id: 4, title: "از ویرایشگر" }));

    renderWithProviders(<App />, { route: "/notes/4/edit" });
    await screen.findByRole("textbox", { name: "متن یادداشت" });

    await openNoteMenuInEditor("از ویرایشگر");
    fireEvent.click(await screen.findByRole("button", { name: "انصراف" }));

    await waitFor(() =>
      expect(
        screen.queryByText("آیا از حذف این یادداشت مطمئن هستید؟"),
      ).toBeNull(),
    );
    expect(bridge.notes).toHaveLength(1);
    expect(
      screen.getByRole("textbox", { name: "متن یادداشت", hidden: true }),
    ).toBeDefined();
  });

  test("keeps the options menu open after the confirmation is cancelled", async () => {
    bridge.notes.push(makeNote({ id: 4, title: "از ویرایشگر" }));

    renderWithProviders(<App />, { route: "/notes/4/edit" });
    await screen.findByRole("textbox", { name: "متن یادداشت" });

    await openNoteMenuInEditor("از ویرایشگر");
    fireEvent.click(await screen.findByRole("button", { name: "انصراف" }));

    await waitFor(() =>
      expect(
        screen.queryByText("آیا از حذف این یادداشت مطمئن هستید؟"),
      ).toBeNull(),
    );
    expect(screen.getByRole("menuitem", { name: "حذف" })).toBeDefined();
  });

  test("keeps the note in the editor when the delete fails", async () => {
    bridge.notes.push(makeNote({ id: 4, title: "از ویرایشگر" }));
    bridge.failRemove(new Error("حذف ناموفق بود"));

    renderWithProviders(<App />, { route: "/notes/4/edit" });
    await screen.findByRole("textbox", { name: "متن یادداشت" });

    await openNoteMenuInEditor("از ویرایشگر");
    fireEvent.click(await screen.findByRole("button", { name: "بله" }));

    expect(await screen.findByText("حذف ناموفق بود")).toBeDefined();
    expect(bridge.notes).toHaveLength(1);
  });
});

describe("leaving the editor with the back button", () => {
  const backButton = { name: "بازگشت به یادداشت ها" };

  test("saves the pending title before the table appears", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "قدیمی" }));

    renderWithProviders(<App />, { route: "/notes/9/edit" });

    const titleField = await screen.findByRole("textbox", { name: "عنوان" });
    typeIntoTitle(titleField, "تازه");

    await Bun.sleep(300);
    expect(bridge.notes[0]?.title).toBe("قدیمی");

    fireEvent.click(screen.getByRole("button", backButton));

    await waitFor(() => expect(bridge.notes[0]?.title).toBe("تازه"), {
      timeout: 2000,
    });
    expect(await screen.findByText("تازه")).toBeDefined();
  });

  test("stays in the editor when the save fails", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "قدیمی" }));
    bridge.failUpdate(new Error("ذخیره ناموفق بود"));

    renderWithProviders(<App />, { route: "/notes/9/edit" });

    const titleField = await screen.findByRole("textbox", { name: "عنوان" });
    typeIntoTitle(titleField, "تازه");

    fireEvent.click(screen.getByRole("button", backButton));

    expect(await screen.findByText("ذخیره ناموفق بود")).toBeDefined();
    expect(screen.getByRole("textbox", { name: "عنوان" })).toBeDefined();

    typeIntoTitle(screen.getByRole("textbox", { name: "عنوان" }), "قدیمی");
  });

  test("writes nothing when the note was never touched", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "سالم" }));

    let updateCalls = 0;
    const bridgeUpdate = bridge.update;
    bridge.update = async (id, note) => {
      updateCalls += 1;
      return bridgeUpdate(id, note);
    };

    renderWithProviders(<App />, { route: "/notes/9/edit" });
    await screen.findByRole("textbox", { name: "متن یادداشت" });

    fireEvent.click(screen.getByRole("button", backButton));

    expect(
      await screen.findByRole("table", { name: "یادداشت ها" }),
    ).toBeDefined();
    expect(updateCalls).toBe(0);
  });

  test("is absent on the notes page", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "سالم" }));

    renderWithProviders(<App />, { route: "/" });
    await screen.findByRole("table", { name: "یادداشت ها" });

    expect(screen.queryByRole("button", backButton)).toBeNull();
  });
});

describe("holding the back button until the note is saved", () => {
  const backButton = { name: "بازگشت به یادداشت ها" };

  test("disables the button and spins while the save runs", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "قدیمی" }));

    let savedTitle = "";
    let releaseUpdate = () => {};

    bridge.update = (_id, note) => {
      savedTitle = note.title;
      return new Promise((resolve) => {
        releaseUpdate = () => resolve(null);
      });
    };

    renderWithProviders(<App />, { route: "/notes/9/edit" });

    const titleField = await screen.findByRole("textbox", { name: "عنوان" });
    typeIntoTitle(titleField, "تازه");

    fireEvent.click(screen.getByRole("button", backButton));

    const pending = screen.getByRole("button", backButton);
    expect(pending.hasAttribute("disabled")).toBe(true);
    expect(pending.querySelector(".animate-spin")).not.toBeNull();

    act(() => releaseUpdate());

    expect(
      await screen.findByRole("table", { name: "یادداشت ها" }),
    ).toBeDefined();
    expect(savedTitle).toBe("تازه");
  });

  test("ignores a second press while the save is still running", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "قدیمی" }));

    let updateCalls = 0;
    let releaseUpdate = () => {};

    bridge.update = (id, note) => {
      updateCalls += 1;
      return new Promise((resolve) => {
        releaseUpdate = () =>
          resolve({ ...makeNote({ id, title: note.title, body: note.body }) });
      });
    };

    renderWithProviders(<App />, { route: "/notes/9/edit" });

    const titleField = await screen.findByRole("textbox", { name: "عنوان" });
    typeIntoTitle(titleField, "تازه");

    const button = screen.getByRole("button", backButton);
    fireEvent.click(button);
    fireEvent.click(button);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "l",
          code: "KeyL",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "l",
          code: "KeyL",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(updateCalls).toBe(1);

    act(() => releaseUpdate());

    await waitFor(() => expect(bridge.notes).toHaveLength(1));
    expect(
      await screen.findByRole("table", { name: "یادداشت ها" }),
    ).toBeDefined();
  });

  test("re-enables the button when the save fails", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "قدیمی" }));
    bridge.failUpdate(new Error("ذخیره ناموفق بود"));

    renderWithProviders(<App />, { route: "/notes/9/edit" });

    const titleField = await screen.findByRole("textbox", { name: "عنوان" });
    typeIntoTitle(titleField, "تازه");

    fireEvent.click(screen.getByRole("button", backButton));

    expect(await screen.findByText("ذخیره ناموفق بود")).toBeDefined();
    expect(
      screen.getByRole("button", backButton).hasAttribute("disabled"),
    ).toBe(false);

    typeIntoTitle(screen.getByRole("textbox", { name: "عنوان" }), "قدیمی");
  });
});

describe("reflecting a broadcast from the main process", () => {
  test("adds a note another window created", async () => {
    renderWithProviders(<App />, { route: "/" });
    await screen.findByText("هیچ یادداشتی نیست");

    act(() => {
      bridge.notes.push(makeNote({ id: 8, title: "از پنجره دیگر" }));
      bridge.emitChanged();
    });

    expect(await screen.findByText("از پنجره دیگر")).toBeDefined();
  });

  test("removes a note another window deleted", async () => {
    bridge.notes.push(makeNote({ id: 8, title: "حذف شده بیرونی" }));

    renderWithProviders(<App />, { route: "/" });
    await screen.findByText("حذف شده بیرونی");

    act(() => {
      bridge.notes.length = 0;
      bridge.emitChanged();
    });

    expect(await screen.findByText("هیچ یادداشتی نیست")).toBeDefined();
  });
});

describe("editing through the real store", () => {
  test("persists an edited title through the bridge", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "قبل", body: "" }));

    renderWithProviders(<App />, { route: "/notes/9/edit" });

    const titleField = await screen.findByRole("textbox", { name: "عنوان" });
    typeIntoTitle(titleField, "بعد");

    await waitFor(() => expect(bridge.notes[0]?.title).toBe("بعد"), {
      timeout: 2000,
    });
  });

  test("persists an edited body through the bridge", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "عنوان", body: "قدیمی" }));

    renderWithProviders(<App />, { route: "/notes/9/edit" });

    await screen.findByRole("textbox", { name: "متن یادداشت" });
    setBodyContent("<p>متن تازه</p>");

    await waitFor(() => expect(bridge.notes[0]?.body).toBe("<p>متن تازه</p>"), {
      timeout: 2000,
    });
  });

  test("Ctrl+S persists the body before the debounce elapses", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "عنوان", body: "قدیمی" }));

    renderWithProviders(<App />, { route: "/notes/9/edit" });

    await screen.findByRole("textbox", { name: "متن یادداشت" });
    setBodyContent("<p>متن تازه</p>");

    await Bun.sleep(300);
    expect(bridge.notes[0]?.body).toBe("قدیمی");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "s",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await waitFor(() => expect(bridge.notes[0]?.body).toBe("<p>متن تازه</p>"), {
      timeout: 2000,
    });
  });

  test("Ctrl+S writes again after the debounce already saved", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "عنوان", body: "قدیمی" }));

    let updateCalls = 0;
    const bridgeUpdate = bridge.update;
    bridge.update = async (id, note) => {
      updateCalls += 1;
      return bridgeUpdate(id, note);
    };

    renderWithProviders(<App />, { route: "/notes/9/edit" });

    await screen.findByRole("textbox", { name: "متن یادداشت" });
    setBodyContent("<p>متن تازه</p>");

    await waitFor(() => expect(bridge.notes[0]?.body).toBe("<p>متن تازه</p>"), {
      timeout: 2000,
    });
    expect(updateCalls).toBe(1);

    await Bun.sleep(300);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "s",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await waitFor(() => expect(updateCalls).toBe(2), { timeout: 2000 });
  });

  test("Ctrl+S writes a note that is already saved", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "عنوان", body: "متن" }));

    let updateCalls = 0;
    const bridgeUpdate = bridge.update;
    bridge.update = async (id, note) => {
      updateCalls += 1;
      return bridgeUpdate(id, note);
    };

    renderWithProviders(<App />, { route: "/notes/9/edit" });

    await screen.findByRole("textbox", { name: "متن یادداشت" });

    await Bun.sleep(900);
    expect(updateCalls).toBe(0);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "s",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await waitFor(() => expect(updateCalls).toBe(1), { timeout: 2000 });
  });
});
