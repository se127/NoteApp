import { afterEach, describe, expect, test } from "bun:test";

import {
  DARK_QUERY,
  persistTheme,
  readStoredTheme,
  readSystemTheme,
  resolveTheme,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";
import {
  installThemeBridge,
  stubMatchMedia,
  type FakeMediaQuery,
} from "./helpers/browser-bridge";

let media: FakeMediaQuery | null = null;

function useMedia(matches: boolean): FakeMediaQuery {
  media = stubMatchMedia(matches);
  return media;
}

afterEach(() => {
  media?.restore();
  media = null;
  delete (globalThis as unknown as Record<string, unknown>)["noteApp"];
  window.localStorage.clear();
});

describe("resolveTheme", () => {
  test("keeps an explicit light or dark theme", () => {
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
  });

  test("follows the system theme when set to system", () => {
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("system", "light")).toBe("light");
  });
});

describe("readSystemTheme", () => {
  test("reports dark when the media query matches", () => {
    useMedia(true);

    expect(readSystemTheme()).toBe("dark");
  });

  test("reports light when the media query does not match", () => {
    useMedia(false);

    expect(readSystemTheme()).toBe("light");
  });

  test("asks for the dark colour scheme", () => {
    expect(DARK_QUERY).toBe("(prefers-color-scheme: dark)");
  });
});

describe("readStoredTheme", () => {
  test("prefers the electron bridge over local storage", () => {
    installThemeBridge("dark");
    window.localStorage.setItem("note-app-theme", "light");

    expect(readStoredTheme()).toBe("dark");
  });

  test("returns null when the bridge reports an unknown theme", () => {
    stubMatchMedia(false);
    const bridge = installThemeBridge("system");
    bridge.get = () => "neon" as Theme;

    expect(readStoredTheme()).toBeNull();
  });

  test("falls back to local storage when there is no bridge", () => {
    window.localStorage.setItem("note-app-theme", "dark");

    expect(readStoredTheme()).toBe("dark");
  });

  test("returns null when local storage holds an unknown theme", () => {
    window.localStorage.setItem("note-app-theme", "neon");

    expect(readStoredTheme()).toBeNull();
  });

  test("returns null when nothing was stored", () => {
    expect(readStoredTheme()).toBeNull();
  });
});

describe("persistTheme", () => {
  test("writes to the electron bridge when present", () => {
    const bridge = installThemeBridge("system");

    persistTheme("dark");

    expect(bridge.get()).toBe("dark");
    expect(window.localStorage.getItem("note-app-theme")).toBeNull();
  });

  test("writes to local storage when there is no bridge", () => {
    persistTheme("light");

    expect(window.localStorage.getItem("note-app-theme")).toBe("light");
  });

  test("does not throw when local storage is unavailable", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota exceeded");
    };

    expect(() => persistTheme("dark")).not.toThrow();

    Storage.prototype.setItem = original;
  });
});

describe("theme resolution across sources", () => {
  test("an explicit theme wins over the system preference", () => {
    const system: ResolvedTheme = "dark";

    expect(resolveTheme("light", system)).toBe("light");
  });
});
