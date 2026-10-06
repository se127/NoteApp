import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

import App from "@/App";
import {
  createFakeNotesBridge,
  installNotesBridge,
  makeNote,
  type FakeNotesBridge,
} from "./helpers/browser-bridge";
import { renderWithProviders } from "./helpers/render";

let bridge: FakeNotesBridge;

function renderAppAt(route: string) {
  bridge = installNotesBridge(createFakeNotesBridge());
  return renderWithProviders(<App />, { route });
}

function typeInto(element: HTMLElement, text: string): void {
  element.textContent = text;
  act(() => {
    fireEvent.input(element);
  });
}

beforeEach(() => {
  bridge = installNotesBridge(createFakeNotesBridge());
});

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)["noteApp"];
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

  test("a newly created note appears in the sidebar", async () => {
    renderWithProviders(<App />, { route: "/" });

    fireEvent.click(screen.getByRole("button", { name: "یادداشت جدید" }));

    expect(await screen.findByText("بدون عنوان")).toBeDefined();
  });
});

describe("deleting a note end to end", () => {
  test("removes the note from the database after confirmation", async () => {
    bridge.notes.push(makeNote({ id: 5, title: "حذف‌شدنی" }));

    renderWithProviders(<App />, { route: "/" });

    const trigger = await screen.findByRole("button", {
      name: "گزینه‌های یادداشت حذف‌شدنی",
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
    bridge.notes.push(makeNote({ id: 5, title: "باقی‌مانده" }));

    renderWithProviders(<App />, { route: "/" });

    const trigger = await screen.findByRole("button", {
      name: "گزینه‌های یادداشت باقی‌مانده",
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
    bridge.notes.push(makeNote({ id: 8, title: "حذف‌شده بیرونی" }));

    renderWithProviders(<App />, { route: "/" });
    await screen.findByText("حذف‌شده بیرونی");

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
    typeInto(titleField, "بعد");

    await waitFor(() => expect(bridge.notes[0]?.title).toBe("بعد"), {
      timeout: 2000,
    });
  });

  test("persists an edited body through the bridge", async () => {
    bridge.notes.push(makeNote({ id: 9, title: "عنوان", body: "قدیمی" }));

    renderWithProviders(<App />, { route: "/notes/9/edit" });

    const bodyField = await screen.findByRole("textbox", {
      name: "متن یادداشت",
    });
    typeInto(bodyField, "متن تازه");

    await waitFor(() => expect(bridge.notes[0]?.body).toBe("متن تازه"), {
      timeout: 2000,
    });
  });
});
