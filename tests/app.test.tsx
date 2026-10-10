import { afterEach, describe, expect, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";

import App from "@/App";
import type { Note } from "@/lib/notes";
import {
  createFakeNotesBridge,
  installNotesBridge,
  makeNote,
} from "./helpers/browser-bridge";
import { renderWithProviders } from "./helpers/render";

function renderApp(notes: Note[] = [], route = "/") {
  installNotesBridge(createFakeNotesBridge(notes));
  return renderWithProviders(<App />, { route });
}

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
});

describe("App routing", () => {
  test("shows the notes table at the root route", async () => {
    renderApp();

    expect(
      await screen.findByRole("button", { name: "یادداشت جدید" }),
    ).toBeDefined();
    expect(screen.getByText("هیچ یادداشتی نیست")).toBeDefined();
  });

  test("falls back to the notes table for an unknown route", async () => {
    renderApp([makeNote({ id: 1 })], "/nothing/here");

    expect(
      await screen.findByRole("table", { name: "یادداشت ها" }),
    ).toBeDefined();
  });

  test("keeps the theme toggle and shortcuts on the notes page", async () => {
    renderApp();

    expect(
      await screen.findByRole("button", { name: "تغییر پوسته" }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "کلیدهای میان بر" }),
    ).toBeDefined();
  });

  test("keeps the theme toggle and shortcuts on the editor page", async () => {
    renderApp([makeNote({ id: 1, title: "یادداشت من" })], "/notes/1/edit");

    expect(
      await screen.findByRole("textbox", { name: "متن یادداشت" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "تغییر پوسته" })).toBeDefined();
    expect(
      screen.getByRole("button", { name: "کلیدهای میان بر" }),
    ).toBeDefined();
  });

  test("lists notes from the database in the table", async () => {
    renderApp([makeNote({ id: 1, title: "یادداشت من" })]);

    expect(await screen.findByText("یادداشت من")).toBeDefined();
  });

  test("shows an empty state when there are no notes", async () => {
    renderApp();

    expect(await screen.findByText("هیچ یادداشتی نیست")).toBeDefined();
  });

  test("renders the new note button", async () => {
    renderApp();

    expect(
      await screen.findByRole("button", { name: "یادداشت جدید" }),
    ).toBeDefined();
  });

  test("reports a database failure", async () => {
    const bridge = installNotesBridge(createFakeNotesBridge());
    bridge.failList(new Error("دیتابیس خراب است"));

    renderWithProviders(<App />, { route: "/" });

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("دیتابیس خراب است"),
    );
  });

  test("renders a placeholder title for a note without a title", async () => {
    renderApp([makeNote({ id: 1, title: "" })]);

    expect(await screen.findByText("بدون عنوان")).toBeDefined();
  });
});
