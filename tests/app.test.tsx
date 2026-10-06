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
  delete (globalThis as unknown as Record<string, unknown>)["noteApp"];
});

describe("App routing", () => {
  test("shows the welcome page at the root route", async () => {
    renderApp();

    expect(
      await screen.findByText(
        "یک یادداشت را انتخاب کنید یا یک یادداشت جدید بسازید",
      ),
    ).toBeDefined();
  });

  test("falls back to the welcome page for an unknown route", async () => {
    renderApp([makeNote({ id: 1 })], "/nothing/here");

    expect(
      await screen.findByText(
        "یک یادداشت را انتخاب کنید یا یک یادداشت جدید بسازید",
      ),
    ).toBeDefined();
  });

  test("lists notes from the database in the sidebar", async () => {
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
