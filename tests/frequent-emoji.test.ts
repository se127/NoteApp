import { describe, expect, test } from "bun:test";

import { FREQUENT_EMOJI } from "@/lib/frequent-emoji";

describe("FREQUENT_EMOJI", () => {
  test("offers a full grid of emoji", () => {
    expect(FREQUENT_EMOJI.length).toBeGreaterThan(0);
  });

  test("has no duplicate emoji", () => {
    expect(new Set(FREQUENT_EMOJI).size).toBe(FREQUENT_EMOJI.length);
  });

  test("has no empty entries", () => {
    for (const emoji of FREQUENT_EMOJI) {
      expect(emoji.length).toBeGreaterThan(0);
    }
  });

  test("has no whitespace around the emoji", () => {
    for (const emoji of FREQUENT_EMOJI) {
      expect(emoji === emoji.trim()).toBe(true);
    }
  });

  test("renders as a partial final row in the eight column grid", () => {
    const remainder: number = FREQUENT_EMOJI.length % 8;

    expect(remainder).toBe(4);
  });
});
