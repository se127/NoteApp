import { describe, expect, test } from "bun:test";

import { cn } from "@/lib/utils";

describe("cn", () => {
  test("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  test("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  test("keeps the last of two conflicting tailwind utilities", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  test("supports arrays and objects", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });

  test("returns an empty string with no input", () => {
    expect(cn()).toBe("");
  });
});
