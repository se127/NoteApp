import { afterEach, describe, expect, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { AccentToggle } from "@/components/accent-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeContext, type Accent, type ThemeContextValue } from "@/lib/theme";

const TRIGGER_LABEL = "تغییر رنگ";

function renderToggle(initial: Accent = "blue") {
  const chosen: Accent[] = [];

  const value: ThemeContextValue = {
    theme: "system",
    resolvedTheme: "light",
    setTheme: () => {},
    accent: initial,
    setAccent: (accent) => {
      chosen.push(accent);
    },
  };

  render(
    <ThemeContext.Provider value={value}>
      <TooltipProvider>
        <AccentToggle />
      </TooltipProvider>
    </ThemeContext.Provider>,
  );

  return { chosen };
}

function openMenu(): void {
  const trigger = screen.getByRole("button", { name: TRIGGER_LABEL });

  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(trigger);
}

function checkedAccent(label: string): string | null {
  return screen
    .getByRole("menuitemradio", { name: label })
    .getAttribute("aria-checked");
}

afterEach(() => {
  cleanup();
});

describe("AccentToggle", () => {
  test("renders a labelled trigger", () => {
    renderToggle();

    expect(screen.getByRole("button", { name: TRIGGER_LABEL })).toBeDefined();
  });

  test("keeps the accent menu closed initially", () => {
    renderToggle();

    expect(screen.queryByRole("menuitemradio")).toBeNull();
  });

  test("offers exactly blue, green and orange", () => {
    renderToggle();
    openMenu();

    expect(screen.getByRole("menuitemradio", { name: "آبی" })).toBeDefined();
    expect(screen.getByRole("menuitemradio", { name: "سبز" })).toBeDefined();
    expect(screen.getByRole("menuitemradio", { name: "نارنجی" })).toBeDefined();
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(3);
  });

  test("marks the active accent as checked", () => {
    renderToggle("green");
    openMenu();

    expect(checkedAccent("سبز")).toBe("true");
    expect(checkedAccent("آبی")).toBe("false");
  });

  test("chooses an accent from the menu", () => {
    const { chosen } = renderToggle("blue");
    openMenu();

    act(() => {
      fireEvent.click(screen.getByRole("menuitemradio", { name: "نارنجی" }));
    });

    expect(chosen).toEqual(["orange"]);
  });

  test("shows a swatch in the accent of each option", () => {
    renderToggle();
    openMenu();

    const swatch = screen
      .getByRole("menuitemradio", { name: "نارنجی" })
      .querySelector("[data-accent='orange']");

    expect(swatch?.getAttribute("data-accent")).toBe("orange");
  });

  test("shows the active accent in the trigger", () => {
    renderToggle("green");

    const swatch = screen
      .getByRole("button", { name: TRIGGER_LABEL })
      .querySelector("[data-accent='green']");

    expect(swatch?.getAttribute("data-accent")).toBe("green");
  });

  test("writes the same accent again when it is re-chosen", () => {
    const { chosen } = renderToggle("blue");
    openMenu();

    expect(() =>
      fireEvent.click(screen.getByRole("menuitemradio", { name: "آبی" })),
    ).not.toThrow();
    expect(chosen).toEqual(["blue"]);
  });
});
