import { afterEach, describe, expect, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { ThemeToggle } from "@/components/theme-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ThemeContext,
  type ResolvedTheme,
  type Theme,
  type ThemeContextValue,
} from "@/lib/theme";

const TRIGGER_LABEL = "تغییر پوسته";

function renderToggle(initial: Theme = "system") {
  const chosen: Theme[] = [];
  const resolved: ResolvedTheme = initial === "dark" ? "dark" : "light";

  const value: ThemeContextValue = {
    theme: initial,
    resolvedTheme: resolved,
    setTheme: (theme) => {
      chosen.push(theme);
    },
  };

  render(
    <ThemeContext.Provider value={value}>
      <TooltipProvider>
        <ThemeToggle />
      </TooltipProvider>
    </ThemeContext.Provider>,
  );

  return { chosen };
}

function openMenu(): HTMLElement {
  const trigger = screen.getByRole("button", { name: TRIGGER_LABEL });

  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(trigger);

  return trigger;
}

afterEach(() => {
  cleanup();
});

describe("ThemeToggle", () => {
  test("renders a labelled trigger", () => {
    renderToggle();

    expect(screen.getByRole("button", { name: TRIGGER_LABEL })).toBeDefined();
  });

  test("keeps the theme menu closed initially", () => {
    renderToggle();

    expect(screen.queryByRole("menuitemradio")).toBeNull();
  });

  test("offers the three theme choices", () => {
    renderToggle();
    openMenu();

    expect(screen.getByRole("menuitemradio", { name: "روشن" })).toBeDefined();
    expect(screen.getByRole("menuitemradio", { name: "تاریک" })).toBeDefined();
    expect(screen.getByRole("menuitemradio", { name: "سیستم" })).toBeDefined();
  });

  test("marks the active theme as checked", () => {
    renderToggle("dark");
    openMenu();

    expect(
      screen
        .getByRole("menuitemradio", { name: "تاریک" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  test("chooses a theme from the menu", () => {
    const { chosen } = renderToggle("system");
    openMenu();

    act(() => {
      fireEvent.click(screen.getByRole("menuitemradio", { name: "روشن" }));
    });

    expect(chosen.length).toBeGreaterThan(0);
  });

  test("does not navigate or throw when a choice is made", () => {
    renderToggle("system");
    openMenu();

    expect(() =>
      fireEvent.click(screen.getByRole("menuitemradio", { name: "تاریک" })),
    ).not.toThrow();
  });
});
