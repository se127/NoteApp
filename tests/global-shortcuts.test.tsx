import { afterEach, describe, expect, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { AccentToggle } from "@/components/accent-toggle";
import { NoteActionsMenu } from "@/components/note-actions-menu";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Note } from "@/lib/notes";
import {
  NOTE_ACTIONS_SHORTCUT,
  SHORTCUTS_DIALOG_SHORTCUT,
  type Shortcut,
} from "@/lib/shortcuts";
import { ThemeContext, type Accent, type ThemeContextValue } from "@/lib/theme";
import { renderWithProviders } from "./helpers/render";

const NOTE: Note = {
  id: 1,
  title: "یادداشت",
  body: "",
  createdAt: "2026-01-01 10:00:00",
  updatedAt: "2026-01-01 10:00:00",
};

const ACTIONS_COMBO = { code: "KeyM", key: "m", shiftKey: true } as const;
const ACCENT_COMBO = { code: "KeyA", key: "a", shiftKey: true } as const;
const THEME_COMBO = { code: "KeyP", key: "p", shiftKey: true } as const;
const DIALOG_COMBO = { code: "KeyK", key: "k", shiftKey: true } as const;

type Pressed = {
  altKey?: boolean;
  code: string;
  key: string;
  shiftKey?: boolean;
};

function pressCombo({ altKey, code, key, shiftKey }: Pressed): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    code,
    ctrlKey: true,
    altKey: altKey === true,
    shiftKey: shiftKey === true,
    bubbles: true,
    cancelable: true,
  });

  act(() => {
    window.dispatchEvent(event);
  });

  return event;
}

function themeValue(): ThemeContextValue {
  return {
    theme: "system",
    resolvedTheme: "light",
    setTheme: () => {},
    accent: "blue" as Accent,
    setAccent: () => {},
  };
}

function renderWithTooltip(node: React.ReactNode) {
  render(
    <ThemeContext.Provider value={themeValue()}>
      <TooltipProvider>{node}</TooltipProvider>
    </ThemeContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("note actions menu shortcut", () => {
  function renderMenu(shortcut?: Shortcut) {
    renderWithProviders(<NoteActionsMenu note={NOTE} shortcut={shortcut} />);
  }

  test("opens the menu with its shortcut", () => {
    renderMenu(NOTE_ACTIONS_SHORTCUT);

    expect(screen.queryByRole("menu")).toBeNull();
    pressCombo(ACTIONS_COMBO);

    expect(screen.getByRole("menuitem", { name: "حذف" })).toBeDefined();
  });

  test("stays shut under a bare shift+m", () => {
    renderMenu(NOTE_ACTIONS_SHORTCUT);

    pressCombo({ code: "KeyM", key: "m" });

    expect(screen.queryByRole("menuitem", { name: "حذف" })).toBeNull();
  });

  test("leaves the table row menu unshortcut", () => {
    renderMenu();

    pressCombo(ACTIONS_COMBO);

    expect(screen.queryByRole("menuitem", { name: "حذف" })).toBeNull();
  });

  test("names the combination in the editor menu tooltip", async () => {
    renderMenu(NOTE_ACTIONS_SHORTCUT);
    const trigger = screen.getByRole("button", {
      name: "گزینه های یادداشت یادداشت",
    });

    fireEvent.pointerEnter(trigger);

    expect(await screen.findByRole("tooltip")).toBeDefined();
    expect(screen.getByRole("tooltip").textContent).toContain(
      NOTE_ACTIONS_SHORTCUT.combination,
    );
  });

  test("shortens the tooltip label to match a row menu", async () => {
    renderMenu(NOTE_ACTIONS_SHORTCUT);
    const trigger = screen.getByRole("button", {
      name: "گزینه های یادداشت یادداشت",
    });

    fireEvent.pointerEnter(trigger);

    const tooltip = await screen.findByRole("tooltip");
    expect(NOTE_ACTIONS_SHORTCUT.tooltipLabel).toBe("گزینه ها");
    expect(tooltip.textContent).toContain("گزینه ها");
    expect(tooltip.textContent).not.toContain(NOTE_ACTIONS_SHORTCUT.label);
  });

  test("keeps the full label for the shortcut list", () => {
    expect(NOTE_ACTIONS_SHORTCUT.label).toBe("گزینه های یادداشت فعلی");
  });
});

describe("accent toggle shortcut", () => {
  test("opens the accent menu with its shortcut", () => {
    renderWithTooltip(<AccentToggle />);

    pressCombo(ACCENT_COMBO);

    expect(screen.getByRole("menuitemradio", { name: "آبی" })).toBeDefined();
  });

  test("closes the accent menu when pressed twice", () => {
    renderWithTooltip(<AccentToggle />);

    pressCombo(ACCENT_COMBO);
    pressCombo(ACCENT_COMBO);

    expect(screen.queryByRole("menuitemradio")).toBeNull();
  });
});

describe("theme toggle shortcut", () => {
  test("opens the theme menu with its shortcut", () => {
    renderWithTooltip(<ThemeToggle />);

    pressCombo(THEME_COMBO);

    expect(screen.getByRole("menuitemradio", { name: "روشن" })).toBeDefined();
  });

  test("closes the theme menu when pressed twice", () => {
    renderWithTooltip(<ThemeToggle />);

    pressCombo(THEME_COMBO);
    pressCombo(THEME_COMBO);

    expect(screen.queryByRole("menuitemradio")).toBeNull();
  });
});

describe("shortcuts dialog shortcut", () => {
  test("opens the shortcut list with its shortcut", () => {
    renderWithTooltip(<ShortcutsDialog />);

    expect(screen.queryByRole("dialog")).toBeNull();
    pressCombo(DIALOG_COMBO);

    expect(screen.getByRole("dialog")).toBeDefined();
  });

  test("closes the shortcut list when pressed again", () => {
    renderWithTooltip(<ShortcutsDialog />);

    pressCombo(DIALOG_COMBO);
    pressCombo(DIALOG_COMBO);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("still opens on click", () => {
    renderWithTooltip(<ShortcutsDialog />);

    fireEvent.click(
      screen.getByRole("button", { name: SHORTCUTS_DIALOG_SHORTCUT.label }),
    );

    expect(screen.getByRole("dialog")).toBeDefined();
  });
});
