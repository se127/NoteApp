import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, screen, waitFor } from "@testing-library/react";

import { NoteBodyEditor } from "@/components/note-body-editor";
import { bodyEditor, pressMark, selectAllBodyText } from "./helpers/note-body";
import { renderWithProviders } from "./helpers/render";

let changes: string[] = [];

function renderBodyEditor(body = "<p>متن</p>") {
  return renderWithProviders(
    <NoteBodyEditor body={body} onChange={(html) => changes.push(html)} />,
  );
}

function bodyField(): HTMLElement {
  return screen.getByRole("textbox", { name: "متن یادداشت" });
}

function toolbar(): HTMLElement {
  return screen.getByRole("toolbar", { name: "قالب‌بندی متن" });
}

function markButton(label: string): HTMLElement {
  return screen.getByRole("button", { name: label });
}

beforeEach(() => {
  changes = [];
});

afterEach(() => {
  act(() => {
    bodyEditor().destroy();
  });
});

describe("NoteBodyEditor", () => {
  test("marks the body as an rtl multiline textbox", () => {
    renderBodyEditor();

    const field = bodyField();
    expect(field.getAttribute("aria-multiline")).toBe("true");
    expect(field.getAttribute("dir")).toBe("rtl");
  });

  test("keeps the marks from a stored html body", () => {
    renderBodyEditor("<p><strong>پررنگ</strong></p>");

    expect(bodyEditor().getHTML()).toBe("<p><strong>پررنگ</strong></p>");
  });

  test("turns a stored plain text body with newlines into paragraphs", () => {
    renderBodyEditor("خط اول\nخط دوم");

    expect(bodyEditor().getHTML()).toBe("<p>خط اول</p><p>خط دوم</p>");
  });

  test("leaves plain text that looks like a tag as text", () => {
    renderBodyEditor("use <b> for bold");

    expect(bodyEditor().getHTML()).toBe("<p>use &lt;b&gt; for bold</p>");
  });

  test("converts a plain text body into paragraphs on open", () => {
    renderBodyEditor("");

    act(() => {
      bodyEditor().commands.setContent("<p>خط اول</p><p>خط دوم</p>");
    });

    expect(bodyEditor().getHTML()).toBe("<p>خط اول</p><p>خط دوم</p>");
  });

  test("handles a stored empty body", () => {
    renderBodyEditor("");

    expect(bodyEditor().getText()).toBe("");
  });

  test("does not report a change before anything is typed", () => {
    renderBodyEditor();

    expect(changes).toHaveLength(0);
  });

  test("marks the body content for the typography plugin", () => {
    renderBodyEditor();

    const content = document.querySelector<HTMLElement>(".prose");

    expect(content).not.toBeNull();
    expect(content?.querySelector(".ProseMirror")).not.toBeNull();
  });

  test("registers a paste handler that keeps pasted text inline", () => {
    renderBodyEditor();

    const handler = bodyEditor().view.someProp("transformPasted");

    expect(typeof handler).toBe("function");
  });

  test("marks the empty body so the placeholder shows on the right", () => {
    renderBodyEditor("");

    const paragraph = bodyEditor().view.dom.querySelector("p");

    expect(paragraph?.classList.contains("is-editor-empty")).toBe(true);
    expect(paragraph?.getAttribute("data-placeholder")).toBe(
      "متن یادداشت را اینجا بنویسید...",
    );
  });
});

describe("NoteBodyEditor bubble menu", () => {
  test("stays hidden until text is selected", () => {
    renderBodyEditor();

    expect(screen.queryByRole("toolbar", { name: "قالب‌بندی متن" })).toBeNull();
  });

  test("appears on a text selection", async () => {
    renderBodyEditor();

    await selectAllBodyText();

    expect(toolbar()).toBeDefined();
  });

  test("offers exactly the four marks", async () => {
    renderBodyEditor();

    await selectAllBodyText();

    const labels = [...toolbar().querySelectorAll("button")].map((button) =>
      button.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["ضخیم", "مورب", "زیرخط", "خط خورده"]);
  });

  test("starts every mark on the ghost variant with no selection carried", async () => {
    renderBodyEditor();

    await selectAllBodyText();

    for (const label of ["ضخیم", "مورب", "زیرخط", "خط خورده"]) {
      expect(markButton(label).getAttribute("aria-pressed")).toBe("false");
      expect(markButton(label).getAttribute("data-variant")).toBe("ghost");
    }
  });

  test("bolds the selection and reports the markup", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pressMark("ضخیم");

    expect(bodyEditor().getHTML()).toBe("<p><strong>متن</strong></p>");
    expect(changes.at(-1)).toBe("<p><strong>متن</strong></p>");
  });

  test("italics the selection", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pressMark("مورب");

    expect(bodyEditor().getHTML()).toBe("<p><em>متن</em></p>");
  });

  test("underlines the selection", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pressMark("زیرخط");

    expect(bodyEditor().getHTML()).toBe("<p><u>متن</u></p>");
  });

  test("strikes the selection", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pressMark("خط خورده");

    expect(bodyEditor().getHTML()).toBe("<p><s>متن</s></p>");
  });

  test("toggles a mark off again", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pressMark("ضخیم");
    await selectAllBodyText();
    pressMark("ضخیم");

    expect(bodyEditor().getHTML()).toBe("<p>متن</p>");
  });

  test("marks a button as pressed while its mark is active", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pressMark("زیرخط");

    await waitFor(() =>
      expect(markButton("زیرخط").getAttribute("aria-pressed")).toBe("true"),
    );
    expect(markButton("ضخیم").getAttribute("aria-pressed")).toBe("false");
  });

  test("switches an active mark to the primary variant", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pressMark("زیرخط");

    await waitFor(() =>
      expect(markButton("زیرخط").getAttribute("data-variant")).toBe("default"),
    );
    expect(markButton("ضخیم").getAttribute("data-variant")).toBe("ghost");
  });

  test("only the marks the selection carries read as primary", async () => {
    renderBodyEditor("<p><strong>پررنگ</strong></p>");

    await selectAllBodyText();

    await waitFor(() =>
      expect(markButton("ضخیم").getAttribute("data-variant")).toBe("default"),
    );
    for (const label of ["مورب", "زیرخط", "خط خورده"]) {
      expect(markButton(label).getAttribute("data-variant")).toBe("ghost");
    }
  });

  test("shows two marks as primary at once when both are carried", async () => {
    renderBodyEditor("<p><strong><em>هر دو</em></strong></p>");

    await selectAllBodyText();

    await waitFor(() => {
      expect(markButton("ضخیم").getAttribute("data-variant")).toBe("default");
      expect(markButton("مورب").getAttribute("data-variant")).toBe("default");
    });
  });

  test("combines several marks on one selection", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pressMark("ضخیم");
    pressMark("خط خورده");

    expect(bodyEditor().getHTML()).toBe("<p><strong><s>متن</s></strong></p>");
  });

  test("keeps the selection so a second mark applies to the same text", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pressMark("ضخیم");
    pressMark("مورب");

    expect(bodyEditor().getHTML()).toBe("<p><strong><em>متن</em></strong></p>");
  });

  test("keeps the mark buttons out of the tab order", async () => {
    renderBodyEditor();

    await selectAllBodyText();

    for (const button of toolbar().querySelectorAll("button")) {
      expect(button.getAttribute("tabindex")).toBe("-1");
    }
  });

  test("does not move focus off the text when a mark is pressed", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    const button = markButton("ضخیم");
    act(() => {
      button.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
    });

    expect(document.activeElement).not.toBe(button);
  });
});

describe("NoteBodyEditor mark tooltips", () => {
  test("labels each mark button with its tooltip trigger", async () => {
    renderBodyEditor();

    await selectAllBodyText();

    for (const label of ["ضخیم", "مورب", "زیرخط", "خط خورده"]) {
      expect(markButton(label).getAttribute("data-slot")).toBe(
        "tooltip-trigger",
      );
    }
  });

  test("shows the bold tooltip on hover", async () => {
    renderBodyEditor();

    await selectAllBodyText();

    fireHover(markButton("ضخیم"));

    await waitFor(() => expect(screen.getByText("ضخیم")).toBeDefined());
  });

  test("shows the strikethrough tooltip on hover", async () => {
    renderBodyEditor();

    await selectAllBodyText();

    fireHover(markButton("خط خورده"));

    await waitFor(() => expect(screen.getByText("خط خورده")).toBeDefined());
  });
});

function fireHover(element: HTMLElement): void {
  act(() => {
    element.dispatchEvent(
      new MouseEvent("mouseenter", { bubbles: false, cancelable: true }),
    );
    element.dispatchEvent(
      new PointerEvent("pointerenter", { bubbles: false, cancelable: true }),
    );
    element.dispatchEvent(
      new MouseEvent("mouseover", { bubbles: true, cancelable: true }),
    );
    element.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, cancelable: true }),
    );
  });
}
