import { describe, expect, test } from "bun:test";
import { screen } from "@testing-library/react";

import { EditNotePage } from "@/pages/edit-note-page";
import type { Note } from "@/lib/notes";
import { createFakeStore } from "./helpers/fake-store";
import { renderWithProviders } from "./helpers/render";

function renderPage(route: string, notes: Note[], isLoading = false) {
  const store = createFakeStore({ notes, isLoading });
  const result = renderWithProviders(<EditNotePage />, { store, route });
  return result;
}

describe("EditNotePage", () => {
  test("shows the store error first", () => {
    const store = createFakeStore({ error: "پایگاه داده خراب است" });

    renderWithProviders(<EditNotePage />, { store, route: "/notes/1/edit" });

    expect(screen.getByRole("alert").textContent).toBe("پایگاه داده خراب است");
  });

  test("shows a loading state while notes are being read", () => {
    renderPage("/notes/1/edit", [], true);

    expect(screen.getByText("در حال بارگذاری...")).toBeDefined();
  });

  test("reports a missing note", () => {
    renderPage("/notes/1/edit", []);

    expect(screen.getByText("یادداشت یافت نشد")).toBeDefined();
  });

  test("reports a note id that is not an integer", () => {
    renderPage("/notes/abc/edit", []);

    expect(screen.getByText("یادداشت یافت نشد")).toBeDefined();
  });

  test("does not render the editor for a missing note", () => {
    renderPage("/notes/1/edit", []);

    expect(screen.queryByRole("textbox", { name: "عنوان" })).toBeNull();
  });
});
