import { afterEach, describe, expect, test } from "bun:test";
import { act, render, screen } from "@testing-library/react";

import { ThemeProvider } from "@/components/theme-provider";
import { useTheme } from "@/lib/theme";
import { renderHook } from "@testing-library/react";
import {
  installThemeBridge,
  stubMatchMedia,
  type FakeMediaQuery,
} from "./helpers/browser-bridge";

let media: FakeMediaQuery | null = null;

function useSystemTheme(matches: boolean): void {
  media = stubMatchMedia(matches);
}

afterEach(() => {
  media?.restore();
  media = null;
  delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
  window.localStorage.clear();
});

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

describe("ThemeProvider", () => {
  test("defaults to the system theme", () => {
    useSystemTheme(true);

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.theme).toBe("system");
    expect(result.current.resolvedTheme).toBe("dark");
  });

  test("adds the dark class to the document element", () => {
    useSystemTheme(true);

    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    expect(isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  test("removes the dark class for a light system theme", () => {
    useSystemTheme(false);

    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    expect(isDark()).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  test("renders its children", () => {
    useSystemTheme(false);

    render(
      <ThemeProvider>
        <span>متن فرزند</span>
      </ThemeProvider>,
    );

    expect(screen.getByText("متن فرزند")).toBeDefined();
  });

  test("reads the persisted theme on mount", () => {
    useSystemTheme(false);
    installThemeBridge("dark");

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.theme).toBe("dark");
  });

  test("persists a theme chosen through the context", () => {
    useSystemTheme(false);
    const bridge = installThemeBridge("system");

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    act(() => result.current.setTheme("light"));

    expect(bridge.get()).toBe("light");
    expect(result.current.theme).toBe("light");
  });

  test("reacts to a system colour scheme change", () => {
    useSystemTheme(false);

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.resolvedTheme).toBe("light");

    act(() => media?.setMatches(true));

    expect(result.current.resolvedTheme).toBe("dark");
  });

  test("keeps an explicit theme when the system changes", () => {
    useSystemTheme(false);

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    act(() => result.current.setTheme("light"));
    act(() => media?.setMatches(true));

    expect(result.current.resolvedTheme).toBe("light");
  });

  test("honours an explicit default theme", () => {
    useSystemTheme(true);

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
      ),
    });

    expect(result.current.theme).toBe("light");
    expect(result.current.resolvedTheme).toBe("light");
  });
});

describe("ThemeProvider accent", () => {
  function currentAccent(): string | null {
    return document.documentElement.getAttribute("data-accent");
  }

  test("defaults to blue", () => {
    useSystemTheme(false);

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.accent).toBe("blue");
    expect(currentAccent()).toBe("blue");
  });

  test("sets the accent attribute on the document element", () => {
    useSystemTheme(false);
    installThemeBridge("system", "orange");

    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );

    expect(currentAccent()).toBe("orange");
  });

  test("persists an accent chosen through the context", () => {
    useSystemTheme(false);
    const bridge = installThemeBridge("system");

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    act(() => result.current.setAccent("green"));

    expect(bridge.accent.get()).toBe("green");
    expect(result.current.accent).toBe("green");
    expect(currentAccent()).toBe("green");
  });

  test("keeps the accent when the theme changes", () => {
    useSystemTheme(false);
    installThemeBridge("system", "orange");

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    act(() => result.current.setTheme("dark"));

    expect(result.current.accent).toBe("orange");
    expect(currentAccent()).toBe("orange");
  });

  test("keeps the theme when the accent changes", () => {
    useSystemTheme(false);
    const bridge = installThemeBridge("dark", "blue");

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    act(() => result.current.setAccent("orange"));

    expect(result.current.theme).toBe("dark");
    expect(bridge.get()).toBe("dark");
  });
});
