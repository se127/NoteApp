import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const PLACEHOLDER_SELECTOR =
  ".note-body .ProseMirror :is(p, h2, h3, h4, h5, h6).is-editor-empty:first-child::before";

const NO_TOP_MARGIN_SELECTOR =
  ".prose p, .prose h2, .prose h3, .prose h4, .prose blockquote, .prose ul, .prose ol, .prose table, .prose pre, .prose hr, .prose video, .prose img, .prose audio, .prose ul > li:first-child, .prose ol > li:first-child";

const noteBody = readFileSync(
  path.join(import.meta.dir, "..", "src", "note-body.css"),
  "utf8",
).replace(/\s+/g, " ");

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(noteBody);
  if (match === null) throw new Error(`no rule for ${selector}`);
  return match[1];
}

function marker(selector: string): string {
  return /list-style-type:\s*([\w-]+)/.exec(ruleBody(selector))?.[1] ?? "";
}

describe("note body placeholder styling", () => {
  test("reads the placeholder off the attribute", () => {
    expect(ruleBody(PLACEHOLDER_SELECTOR)).toContain(
      "content: attr(data-placeholder)",
    );
  });

  test("covers every block the body editor can hold", () => {
    for (const block of ["p", "h2", "h3", "h4", "h5", "h6"]) {
      expect(
        new RegExp(`(^|[\\s,(:])${block}([\\s,):]|$)`).test(
          PLACEHOLDER_SELECTOR,
        ),
      ).toBe(true);
    }
  });

  test("keeps the placeholder out of the text flow and unfocusable", () => {
    const body = ruleBody(PLACEHOLDER_SELECTOR);

    expect(body).toContain("pointer-events-none");
    expect(body).toContain("float-right");
  });

  test("draws the placeholder in the muted theme colour", () => {
    expect(ruleBody(PLACEHOLDER_SELECTOR)).toContain(
      "text-muted-foreground/60",
    );
  });
});

describe("note body focus ring", () => {
  test("drops the outline on the editor and while it is focused", () => {
    const body = ruleBody(
      ".note-body .ProseMirror, .note-body .ProseMirror:focus, .note-body .ProseMirror:focus-visible",
    );

    expect(body).toContain("outline-none");
  });

  test("drops the border on the editor", () => {
    expect(
      ruleBody(
        ".note-body .ProseMirror, .note-body .ProseMirror:focus, .note-body .ProseMirror:focus-visible",
      ),
    ).toContain("border: 0");
  });
});

describe("note body list markers", () => {
  test("cycles bullet depth two to a hollow circle", () => {
    expect(marker(".prose ul ul")).toBe("circle");
  });

  test("cycles bullet depth three and deeper to a filled square", () => {
    expect(marker(".prose ul ul ul")).toBe("square");
  });

  test("cycles ordered depth two to latin letters", () => {
    expect(marker(".prose ol ol")).toBe("lower-alpha");
  });

  test("cycles ordered depth three to roman letters", () => {
    expect(marker(".prose ol ol ol")).toBe("lower-roman");
  });

  test("restarts ordered depth four at numbers", () => {
    expect(marker(".prose ol ol ol ol")).toBe("decimal");
  });

  test("repeats the cycle at depth five and six", () => {
    expect(marker(".prose ol ol ol ol ol")).toBe("lower-alpha");
    expect(marker(".prose ol ol ol ol ol ol")).toBe("lower-roman");
  });

  test("restarts the cycle again at depth seven", () => {
    expect(marker(".prose ol ol ol ol ol ol ol")).toBe("decimal");
  });

  test("leaves the top level markers to the typography plugin", () => {
    expect(noteBody).not.toContain(".prose ul {");
    expect(noteBody).not.toContain(".prose ol {");
  });
});

describe("note body block spacing", () => {
  test("strips the top margin from every block", () => {
    expect(ruleBody(NO_TOP_MARGIN_SELECTOR)).toContain("mt-0");
  });

  test("covers paragraphs, headings, lists and the media blocks", () => {
    for (const block of [
      "p",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "blockquote",
      "table",
      "pre",
      "hr",
    ]) {
      expect(NO_TOP_MARGIN_SELECTOR).toContain(block);
    }
  });

  test("reaches the first item of a nested list", () => {
    expect(NO_TOP_MARGIN_SELECTOR).toContain(".prose ul > li:first-child");
    expect(NO_TOP_MARGIN_SELECTOR).toContain(".prose ol > li:first-child");
  });

  test("reaches a paragraph nested in a list", () => {
    expect(ruleBody(".prose li p")).toContain("my-0");
  });
});

describe("note body theme colours", () => {
  test("draws the prose text black in the light theme", () => {
    expect(ruleBody(".prose")).toContain("color: black");
  });

  test("draws the prose text white in the dark theme", () => {
    expect(ruleBody(".dark .prose")).toContain("color: white");
  });

  test("draws the list markers white in the dark theme", () => {
    const body = ruleBody(".dark .prose");

    expect(body).toContain("--tw-prose-bullets: white");
    expect(body).toContain("--tw-prose-counters: white");
  });

  test("lets the list marker follow the text colour", () => {
    expect(ruleBody(".prose li::marker")).toContain("color: inherit");
  });

  test("lets every heading and mark inherit the prose colour", () => {
    const body = ruleBody(
      ".prose :is(p, h2, h3, h4, h5, h6), .prose li, .prose strong, .prose em, .prose u, .prose s, .prose sub, .prose sup",
    );

    expect(body).toContain("color: inherit");
  });
});

describe("note body alignment follows the dir attribute", () => {
  test("forces no text alignment inside the body", () => {
    for (const alignment of [
      "text-right",
      "text-left",
      "text-align",
      "text-center",
      "text-justify",
    ]) {
      expect(noteBody).not.toContain(alignment);
    }
  });
});
