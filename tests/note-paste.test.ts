import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import {
  Fragment,
  Slice,
  type Node as ProseMirrorNode,
  type Schema,
} from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";

import { keepPastedTextInline } from "@/lib/note-paste";

const schema: Schema = getSchema([
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    link: false,
    listItem: false,
    listKeymap: false,
    orderedList: false,
    trailingNode: false,
  }),
]);

function paragraph(text: string): ProseMirrorNode {
  return schema.nodes.paragraph.create(null, schema.text(text));
}

function pastedParagraph(text: string): Slice {
  return new Slice(Fragment.from(paragraph(text)), 1, 1);
}

function markedParagraph(text: string, markName: string): Slice {
  return new Slice(
    Fragment.from(
      schema.nodes.paragraph.create(
        null,
        schema.text(text, [schema.marks[markName].create()]),
      ),
    ),
    1,
    1,
  );
}

describe("keepPastedTextInline", () => {
  test("flattens a single paragraph paste so it stays on one line", () => {
    const result = keepPastedTextInline(pastedParagraph("متن چسبانده"));

    expect(result.openStart).toBe(0);
    expect(result.openEnd).toBe(0);
    expect(result.content.childCount).toBe(1);
    expect(result.content.firstChild?.type.name).toBe("text");
    expect(result.content.textBetween(0, result.content.size)).toBe(
      "متن چسبانده",
    );
  });

  test("keeps the marks of a pasted paragraph on the flattened text", () => {
    const result = keepPastedTextInline(markedParagraph("پررنگ", "bold"));

    expect(result.content.firstChild?.type.name).toBe("text");
    expect(result.content.firstChild?.marks[0]?.type.name).toBe("bold");
    expect(result.content.textBetween(0, result.content.size)).toBe("پررنگ");
  });

  test("joins two marks onto one flattened run", () => {
    const both = new Slice(
      Fragment.from(
        schema.nodes.paragraph.create(null, [
          schema.text("هر دو", [
            schema.marks.bold.create(),
            schema.marks.italic.create(),
          ]),
        ]),
      ),
      1,
      1,
    );

    const result = keepPastedTextInline(both);

    expect(
      result.content.firstChild?.marks.map((mark) => mark.type.name),
    ).toEqual(["bold", "italic"]);
  });

  test("leaves a multi block paste as blocks", () => {
    const multi = new Slice(
      Fragment.from([paragraph("اول"), paragraph("دوم")]),
      0,
      0,
    );

    const result = keepPastedTextInline(multi);

    expect(result).toBe(multi);
    expect(result.content.childCount).toBe(2);
  });

  test("leaves a slice alone when it is already inline", () => {
    const inline = new Slice(Fragment.from(schema.text("ساده")), 0, 0);

    expect(keepPastedTextInline(inline)).toBe(inline);
  });

  test("handles an empty slice without throwing", () => {
    const empty = new Slice(Fragment.empty, 0, 0);

    expect(keepPastedTextInline(empty)).toBe(empty);
  });
});
