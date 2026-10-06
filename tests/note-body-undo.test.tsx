import { afterEach, describe, expect, test } from "bun:test";
import { act, screen } from "@testing-library/react";

import { NoteBodyEditor } from "@/components/note-body-editor";
import { bodyEditor, selectAllBodyText } from "./helpers/note-body";
import { renderWithProviders } from "./helpers/render";

function mountBodyEditor(body: string) {
  return renderWithProviders(
    <NoteBodyEditor body={body} onChange={() => {}} />,
  );
}

function bodyHtml(): string {
  return bodyEditor().getHTML();
}

function appendToBody(text: string): void {
  const editor = bodyEditor();
  const endOfParagraph = editor.state.doc.content.size - 1;
  editor.commands.insertContentAt(endOfParagraph, text);
}

afterEach(() => {
  act(() => {
    bodyEditor().destroy();
  });
});

describe("NoteBodyEditor undo", () => {
  test("undoes an inserted run of text", () => {
    mountBodyEditor("<p>متن</p>");

    act(() => {
      appendToBody(" تازه");
    });
    expect(bodyHtml()).toBe("<p>متن تازه</p>");

    act(() => {
      bodyEditor().commands.undo();
    });
    expect(bodyHtml()).toBe("<p>متن</p>");
  });

  test("redoes what undo took back", () => {
    mountBodyEditor("<p>متن</p>");

    act(() => {
      appendToBody(" تازه");
    });
    act(() => {
      bodyEditor().commands.undo();
    });
    expect(bodyHtml()).toBe("<p>متن</p>");

    act(() => {
      bodyEditor().commands.redo();
    });
    expect(bodyHtml()).toBe("<p>متن تازه</p>");
  });

  test("undoes a mark applied from the bubble menu", async () => {
    mountBodyEditor("<p>متن</p>");

    await selectAllBodyText();
    const bold = screen.getByRole("button", { name: "ضخیم" });
    act(() => {
      bold.click();
    });
    expect(bodyHtml()).toBe("<p><strong>متن</strong></p>");

    act(() => {
      bodyEditor().commands.undo();
    });
    expect(bodyHtml()).toBe("<p>متن</p>");
  });

  test("groups adjacent typing into a single undo step", () => {
    mountBodyEditor("<p>متن</p>");

    act(() => {
      appendToBody(" ی");
    });
    act(() => {
      appendToBody(" دو");
    });
    expect(bodyHtml()).toBe("<p>متن ی دو</p>");

    act(() => {
      bodyEditor().commands.undo();
    });
    expect(bodyHtml()).toBe("<p>متن</p>");
  });

  test("walks back a bold change and the typing before it separately", async () => {
    mountBodyEditor("<p>متن</p>");

    act(() => {
      appendToBody(" ی");
    });
    await selectAllBodyText();
    const bold = screen.getByRole("button", { name: "ضخیم" });
    act(() => {
      bold.click();
    });
    expect(bodyHtml()).toBe("<p><strong>متن ی</strong></p>");

    act(() => {
      bodyEditor().commands.undo();
    });
    expect(bodyHtml()).toBe("<p>متن ی</p>");

    act(() => {
      bodyEditor().commands.undo();
    });
    expect(bodyHtml()).toBe("<p>متن</p>");
  });

  test("cannot undo past the content the note was opened with", () => {
    mountBodyEditor("<p>متن</p>");

    act(() => {
      appendToBody(" تازه");
    });
    act(() => {
      bodyEditor().commands.undo();
    });
    expect(bodyHtml()).toBe("<p>متن</p>");

    expect(bodyEditor().can().undo()).toBe(false);
  });
});

describe("NoteBodyEditor undo across a reopen", () => {
  test("a reopened note starts with no undo history", () => {
    const first = mountBodyEditor("<p>متن</p>");

    act(() => {
      appendToBody(" تازه");
    });
    act(() => {
      bodyEditor().commands.undo();
    });
    expect(bodyEditor().can().undo()).toBe(false);

    first.unmount();

    mountBodyEditor("<p>متن</p>");

    expect(bodyEditor().can().undo()).toBe(false);
    expect(bodyEditor().can().redo()).toBe(false);
    expect(bodyHtml()).toBe("<p>متن</p>");
  });
});
