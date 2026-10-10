import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { ACCENTS } from "@/lib/theme";

const indexCss = readFileSync(
  path.join(import.meta.dir, "..", "src", "index.css"),
  "utf8",
).replace(/\s+/g, " ");

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(indexCss);
  if (match === null) throw new Error(`no rule for ${selector}`);
  return match[1];
}

function token(rule: string, name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(rule);
  if (match === null) throw new Error(`no ${name} in ${rule}`);
  return (match[1] ?? "").trim();
}

const SHADCN_ACCENTS: Record<string, { light: string; dark: string }> = {
  blue: {
    light: "oklch(0.488 0.243 264.376)",
    dark: "oklch(0.424 0.199 265.638)",
  },
  green: {
    light: "oklch(0.527 0.154 150.069)",
    dark: "oklch(0.448 0.119 151.328)",
  },
  orange: {
    light: "oklch(0.553 0.195 38.402)",
    dark: "oklch(0.47 0.157 37.304)",
  },
};

describe("accent colour blocks", () => {
  test("has a light and a dark rule for every offered accent", () => {
    for (const accent of ACCENTS) {
      expect(() => ruleBody(`[data-accent="${accent}"]`)).not.toThrow();
      expect(() => ruleBody(`.dark[data-accent="${accent}"]`)).not.toThrow();
    }
  });

  test("uses the shadcn primary value for each accent", () => {
    for (const accent of ACCENTS) {
      const expected = SHADCN_ACCENTS[accent];
      expect(expected).toBeDefined();

      expect(token(ruleBody(`[data-accent="${accent}"]`), "--primary")).toBe(
        expected?.light,
      );
      expect(
        token(ruleBody(`.dark[data-accent="${accent}"]`), "--primary"),
      ).toBe(expected?.dark);
    }
  });

  test("falls back to blue when no accent attribute is set", () => {
    expect(token(ruleBody(":root"), "--primary")).toBe(
      SHADCN_ACCENTS["blue"]?.light,
    );
    expect(token(ruleBody(".dark"), "--primary")).toBe(
      SHADCN_ACCENTS["blue"]?.dark,
    );
  });
});
