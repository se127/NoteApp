import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";

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
    expect(dialog).toContain("ویرایشگر آن را باز می‌کند");
  });

  test("lists the save shortcut with its explanation", () => {
    renderDialog();
    openDialog();

    const dialog = screen.getByRole("dialog").textContent ?? "";
    expect(dialog).toContain("Ctrl + S");
    expect(dialog).toContain("ذخیره ی یادداشت فعلی");
    expect(dialog).toContain("ذخیره خودکار معطل را لغو می‌کند");
  });

  test("documents no shortcut beyond the two bound ones", () => {
    renderDialog();
    openDialog();

    expect(screen.getAllByRole("listitem").length).toBe(2);
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
