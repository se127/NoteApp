import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SHORTCUT_GROUPS } from "@/lib/shortcuts";

const TRIGGER_LABEL = "کلیدهای میان بر";

function renderDialog() {
  render(
    <TooltipProvider>
      <ShortcutsDialog />
    </TooltipProvider>,
  );
}

function openDialog(): void {
  fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }));
}

afterEach(() => {
  cleanup();
});

describe("ShortcutsDialog", () => {
  test("renders a labelled trigger", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: TRIGGER_LABEL })).toBeDefined();
  });

  test("keeps the shortcuts hidden until the trigger is clicked", () => {
    renderDialog();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("opens on click and titles itself in Farsi", () => {
    renderDialog();
    openDialog();

    expect(screen.getByRole("dialog").textContent).toContain(TRIGGER_LABEL);
  });

  test("lists the new note shortcut with its explanation", () => {
    renderDialog();
    openDialog();

    const dialog = screen.getByRole("dialog").textContent ?? "";
    expect(dialog).toContain("Ctrl + N");
    expect(dialog).toContain("یادداشت جدید");
    expect(dialog).toContain("ویرایشگر آن را باز می‌ کند");
  });

  test("lists the back to notes shortcut with its explanation", () => {
    renderDialog();
    openDialog();

    const dialog = screen.getByRole("dialog").textContent ?? "";
    expect(dialog).toContain("Ctrl + L");
    expect(dialog).toContain("بازگشت به یادداشت ها");
    expect(dialog).toContain("به فهرست یادداشت ها بر می‌ گردد");
  });

  test("lists the save shortcut with its explanation", () => {
    renderDialog();
    openDialog();

    const dialog = screen.getByRole("dialog").textContent ?? "";
    expect(dialog).toContain("Ctrl + S");
    expect(dialog).toContain("ذخیره ی یادداشت فعلی");
    expect(dialog).toContain("ذخیره خودکار معطل را لغو می‌ کند");
  });

  test("scrolls the list without opting into the platform scrollbar", () => {
    renderDialog();
    openDialog();

    const list = screen.getByRole("dialog").querySelector(".overflow-y-auto");
    expect(list?.className).toContain("max-h-");
    expect(list?.className).not.toContain("scrollbar");
  });

  test("documents every bound shortcut", () => {
    renderDialog();
    openDialog();

    expect(screen.getAllByRole("listitem").length).toBe(
      SHORTCUT_GROUPS.flatMap(({ shortcuts }) => shortcuts).length,
    );
  });

  test("groups the note, title and body shortcuts under Farsi headings", () => {
    renderDialog();
    openDialog();

    const headings = SHORTCUT_GROUPS.map(({ heading }) => heading);

    for (const heading of headings) {
      expect(screen.getByRole("heading", { name: heading })).toBeDefined();
    }
  });

  test("documents the body emoji shortcut apart from the new note one", () => {
    renderDialog();
    openDialog();

    const dialog = screen.getByRole("dialog").textContent ?? "";
    expect(dialog).toContain("Ctrl + Alt + E");
    expect(dialog).toContain("Ctrl + Alt + G");
  });

  test("closes on Escape", () => {
    renderDialog();
    openDialog();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
