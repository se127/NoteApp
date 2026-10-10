import { afterEach, describe, expect, test } from "bun:test";

import {
  ACCENT_LABELS,
  ACCENTS,
  DARK_QUERY,
  persistAccent,
  persistTheme,
  readStoredAccent,
  readStoredTheme,
  readSystemTheme,
  resolveTheme,
  type Accent,
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
  delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
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
    window.localStorage.setItem("NoteApp-theme", "light");

    expect(readStoredTheme()).toBe("dark");
  });

  test("returns null when the bridge reports an unknown theme", () => {
    stubMatchMedia(false);
    const bridge = installThemeBridge("system");
    bridge.get = () => "neon" as Theme;

    expect(readStoredTheme()).toBeNull();
  });

  test("falls back to local storage when there is no bridge", () => {
    window.localStorage.setItem("NoteApp-theme", "dark");

    expect(readStoredTheme()).toBe("dark");
  });

  test("returns null when local storage holds an unknown theme", () => {
    window.localStorage.setItem("NoteApp-theme", "neon");

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
    expect(window.localStorage.getItem("NoteApp-theme")).toBeNull();
  });

  test("writes to local storage when there is no bridge", () => {
    persistTheme("light");

    expect(window.localStorage.getItem("NoteApp-theme")).toBe("light");
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

describe("accents", () => {
  test("offers blue, green and orange with Persian labels", () => {
    expect(ACCENTS).toEqual(["blue", "green", "orange"]);
    expect(ACCENT_LABELS).toEqual({
      blue: "آبی",
      green: "سبز",
      orange: "نارنجی",
    });
  });

  test("labels every accent", () => {
    for (const accent of ACCENTS) {
      expect(ACCENT_LABELS[accent].length).toBeGreaterThan(0);
    }
  });
});

describe("readStoredAccent", () => {
  test("prefers the electron bridge over local storage", () => {
    installThemeBridge("system", "orange");
    window.localStorage.setItem("NoteApp-accent", "green");

    expect(readStoredAccent()).toBe("orange");
  });

  test("returns null when the bridge reports an unknown accent", () => {
    installThemeBridge();
    const bridge = installThemeBridge();
    bridge.accent.get = () => "neon" as Accent;

    expect(readStoredAccent()).toBeNull();
  });

  test("falls back to local storage when there is no bridge", () => {
    window.localStorage.setItem("NoteApp-accent", "green");

    expect(readStoredAccent()).toBe("green");
  });

  test("returns null when local storage holds an unknown accent", () => {
    window.localStorage.setItem("NoteApp-accent", "neon");

    expect(readStoredAccent()).toBeNull();
  });

  test("returns null when nothing was stored", () => {
    expect(readStoredAccent()).toBeNull();
  });

  test("falls back to local storage when the bridge has no accent namespace", () => {
    window.localStorage.setItem("NoteApp-accent", "orange");
    (globalThis as unknown as Record<string, unknown>)["NoteApp"] = {
      theme: { get: () => "system", set: () => {} },
    };

    expect(readStoredAccent()).toBe("orange");
  });
});

describe("persistAccent", () => {
  test("writes to the electron bridge when present", () => {
    const bridge = installThemeBridge("system");

    persistAccent("green");

    expect(bridge.accent.get()).toBe("green");
    expect(window.localStorage.getItem("NoteApp-accent")).toBeNull();
  });

  test("writes to local storage when there is no bridge", () => {
    persistAccent("orange");

    expect(window.localStorage.getItem("NoteApp-accent")).toBe("orange");
  });

  test("does not throw when local storage is unavailable", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota exceeded");
    };

    expect(() => persistAccent("green")).not.toThrow();

    Storage.prototype.setItem = original;
  });

  test("does not overwrite the stored theme", () => {
    persistTheme("dark");

    persistAccent("green");

    expect(window.localStorage.getItem("NoteApp-theme")).toBe("dark");
    expect(window.localStorage.getItem("NoteApp-accent")).toBe("green");
  });
});
