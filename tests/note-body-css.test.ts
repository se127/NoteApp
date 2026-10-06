import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const BODY_BLOCK_SELECTORS = ["p", "h2", "h3", "h4", "h5", "h6"];

const css = readFileSync(
  path.join(import.meta.dir, "..", "src", "index.css"),
  "utf8",
);

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (match === null) throw new Error(`no rule for ${selector}`);
  return match[1];
}

describe("note body placeholder styling", () => {
  test("covers every block the body editor can hold", () => {
    expect(
      ruleBody(
        ".note-body .ProseMirror :is(p, h2, h3, h4, h5, h6).is-editor-empty:first-child::before",
      ),
    ).toContain("content: attr(data-placeholder)");
  });

  test("would not match a heading if the selector were paragraph only", () => {
    const selector =
      ".note-body .ProseMirror :is(p, h2, h3, h4, h5, h6).is-editor-empty:first-child::before";

    for (const block of BODY_BLOCK_SELECTORS) {
      expect(
        new RegExp(`(^|[\\s,(:])${block}([\\s,):]|$)`).test(selector),
      ).toBe(true);
    }
  });

  test("keeps the placeholder out of the text flow and unfocusable", () => {
    const body = ruleBody(
      ".note-body .ProseMirror :is(p, h2, h3, h4, h5, h6).is-editor-empty:first-child::before",
    );

    expect(body).toContain("pointer-events-none");
    expect(body).toContain("float-right");
  });
});

describe("note body heading styling", () => {
  test("gives every heading level a size and a bold weight", () => {
    for (const level of BODY_BLOCK_SELECTORS.filter((block) => block !== "p")) {
      expect(ruleBody(`.note-body .ProseMirror ${level}`)).toContain("text-");
      expect(ruleBody(`.note-body .ProseMirror ${level}`)).toMatch(/mt-\d|mb-/);
    }

    expect(
      ruleBody(".note-body .ProseMirror :is(h2, h3, h4, h5, h6)"),
    ).toContain("font-bold");
  });

  test("keeps headings right aligned and at least one line tall", () => {
    const body = ruleBody(".note-body .ProseMirror :is(h2, h3, h4, h5, h6)");

    expect(body).toContain("text-right");
    expect(body).toContain("min-h-[1em]");
  });

  test("scales the font size down from h2 to h6", () => {
    const sizes = ["h2", "h3", "h4", "h5", "h6"].map((level) => {
      const match = /text-(\S+)/.exec(
        ruleBody(`.note-body .ProseMirror ${level}`),
      );
      if (match === null) throw new Error(`no font size for ${level}`);
      return match[1];
    });

    expect(sizes).toEqual(["2xl", "xl", "lg", "base", "sm"]);
  });
});
