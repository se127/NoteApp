import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, screen, waitFor } from "@testing-library/react";

import { NoteBodyEditor } from "@/components/note-body-editor";
import { BLOCK_TYPES, setBlockType, type BlockType } from "@/lib/block-type";
import { CODE_BLOCK_LANGUAGES } from "@/lib/code-block";
import { lowlight } from "@/lib/lowlight";
import { FREQUENT_EMOJI } from "@/lib/frequent-emoji";
import {
  DEFAULT_FONT_SIZE,
  FONT_SIZES,
  FONT_SIZE_LABEL,
  MIXED_FONT_SIZE_LABEL,
  activeFontSize,
  applyFontSize,
} from "@/lib/font-size";
import {
  TOOLBAR_SHORTCUTS,
  type ToolbarCommand,
  toolbarShortcut,
} from "@/lib/shortcuts";
import {
  bodyEditor,
  focusBodyCaret,
  selectAllBodyText,
  toolbarSelect,
} from "./helpers/note-body";
import { renderWithProviders } from "./helpers/render";

const TOOLBAR_LABEL = "قالب بندی متن";
const BLOCK_TYPE_LABEL = "سبک متن";
const MARK_LABELS = ["ضخیم", "مورب", "زیرخط", "خط خورده"];
const LIST_LABELS = ["لیست نقطه ای", "لیست شماره دار"];
const HISTORY_LABELS = ["برگرداندن", "بازگرداندن"];
const COLOR_LABELS = ["رنگ متن", "رنگ پس زمینه"];
const TEXT_RED = "#ef4444";
const HIGHLIGHT_ORANGE = "#fed7aa";

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
  return screen.getByRole("toolbar", { name: TOOLBAR_LABEL });
}

function button(label: string): HTMLElement {
  return screen.getByRole("button", { name: label });
}

function blockTypeSelect(): HTMLElement {
  return toolbarSelect(BLOCK_TYPE_LABEL);
}

function separators(): Element[] {
  return [...toolbar().querySelectorAll("[data-slot='separator']")];
}

function toolbarButtonLabels(): (string | null)[] {
  return [...toolbar().querySelectorAll("button")].map((element) =>
    element.getAttribute("aria-label"),
  );
}

function openMenu(triggerLabel: string): void {
  const trigger = button(triggerLabel);
  act(() => {
    trigger.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    trigger.click();
  });
}

function openColorMenu(triggerLabel: string): void {
  const trigger = button(triggerLabel);
  act(() => {
    trigger.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        button: 0,
        ctrlKey: false,
      }),
    );
    trigger.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    trigger.click();
  });
}

function pickColor(triggerLabel: string, color: string): void {
  openColorMenu(triggerLabel);
  const swatch = screen.getByRole("button", { name: color });
  act(() => {
    swatch.click();
  });
}

function menuItemLabels(menuLabel: string): (string | null)[] {
  return [
    ...screen
      .getByRole("menu", { name: menuLabel })
      .querySelectorAll("[role='menuitemradio']"),
  ].map((item) => item.getAttribute("aria-label"));
}

function chooseMenuItem(itemLabel: string): void {
  const item = screen.getByRole("menuitemradio", { name: itemLabel });
  act(() => {
    item.click();
  });
}

function blockTypeNamed(label: string): BlockType {
  const blockType = BLOCK_TYPES.find((candidate) => candidate.label === label);
  if (blockType === undefined) throw new Error(`no block type named ${label}`);
  return blockType;
}

function chooseBlockType(label: string): void {
  act(() => {
    setBlockType(bodyEditor(), blockTypeNamed(label));
  });
}

function pressButton(label: string): void {
  act(() => {
    button(label).click();
  });
}

function pressCommand(command: ToolbarCommand): void {
  const shortcut = toolbarShortcut(command);
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: shortcut.code,
        ctrlKey: true,
        altKey: shortcut.alt === true,
        shiftKey: shortcut.shift === true,
      }),
    );
  });
}

function chooseFontSize(index: number): void {
  const size = FONT_SIZES[index];
  act(() => {
    bodyEditor()
      .chain()
      .focus()
      .setFontSize(size.fontSize)
      .setLineHeight(size.lineHeight)
      .run();
  });
}

function expectFocusNotIn(control: HTMLElement): void {
  expect(document.activeElement === control).toBe(false);
}

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
      new PointerEvent("pointerover", { bubbles: true, cancelable: true }),
    );
    element.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, cancelable: true }),
    );
  });
}

beforeEach(() => {
  changes = [];
});

afterEach(() => {
  if (document.querySelector(".ProseMirror") === null) return;
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

    expect(typeof bodyEditor().view.someProp("transformPasted")).toBe(
      "function",
    );
  });

  test("marks the empty body so the placeholder shows on the right", () => {
    renderBodyEditor("");

    const paragraph = bodyEditor().view.dom.querySelector("p");

    expect(paragraph?.classList.contains("is-editor-empty")).toBe(true);
    expect(paragraph?.getAttribute("data-placeholder")).toBe(
      "متن یادداشت را اینجا بنویسید...",
    );
  });

  test("marks an empty heading block as empty so the placeholder rule can match it", () => {
    renderBodyEditor("");

    focusBodyCaret();
    chooseBlockType("عنوان ۲");

    const heading = bodyEditor().view.dom.querySelector("h2");

    expect(heading?.classList.contains("is-editor-empty")).toBe(true);
    expect(heading?.getAttribute("data-placeholder")).toBe(
      "متن یادداشت را اینجا بنویسید...",
    );
  });
});

describe("NoteBodyEditor toolbar", () => {
  test("sits above the body in one always visible toolbar", () => {
    renderBodyEditor();

    expect(toolbar()).toBeDefined();
    expect(toolbar().compareDocumentPosition(bodyField())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("orders history, direction, block style, font size, marks, colors, lists, align, position, code block, rule and emoji", () => {
    renderBodyEditor();

    expect(toolbarButtonLabels()).toEqual([
      ...HISTORY_LABELS,
      "جهت متن",
      BLOCK_TYPE_LABEL,
      FONT_SIZE_LABEL,
      ...MARK_LABELS,
      ...COLOR_LABELS,
      ...LIST_LABELS,
      "تراز متن",
      "موقعیت متن",
      "بلاک کد",
      "نقل قول",
      "خط افقی",
      "انتخاب ایموجی",
    ]);
  });

  test("keeps every toolbar control in the tab order", () => {
    renderBodyEditor();

    for (const control of toolbar().querySelectorAll("button")) {
      expect(control.getAttribute("tabindex")).not.toBe("-1");
    }
  });

  test("runs the toolbar edge to edge with no corners and no side borders", () => {
    renderBodyEditor();

    expect(toolbar().className).toContain("px-6");
    expect(toolbar().className).not.toContain("rounded");
    expect(toolbar().className).not.toContain("border-x");
    expect(toolbar().className).not.toContain("border-l");
    expect(toolbar().className).not.toContain("border-r");
  });

  test("rules the toolbar off above and below only", () => {
    renderBodyEditor();

    expect(toolbar().className).toContain("border-y");
    expect(toolbar().className).toContain("border-border");
  });

  test("pads the toolbar above and below its controls", () => {
    renderBodyEditor();

    expect(toolbar().className).toContain("py-2");
  });

  test("keeps the note text inset from the pane edge", () => {
    renderBodyEditor();

    const scroller = document.querySelector<HTMLElement>("[data-note-scroll]");
    const gutter = scroller?.parentElement;

    expect(scroller?.className).not.toContain("px-6");
    expect(gutter?.className).toContain("px-6");
  });

  test("keeps the scrollbar inside the gutter rather than at the pane edge", () => {
    renderBodyEditor();

    const scroller = document.querySelector<HTMLElement>("[data-note-scroll]");

    expect(scroller?.className).toContain("overflow-y-auto");
    expect(scroller?.parentElement?.className).toContain("overflow-hidden");
  });

  test("runs the note text down to the bottom of the pane", () => {
    renderBodyEditor();

    const scroller = document.querySelector<HTMLElement>("[data-note-scroll]");
    const content = scroller?.firstElementChild;

    expect(scroller?.className).not.toContain("pb-");
    expect(content?.className).not.toContain("pb-");
  });

  test("draws the toolbar on a light grey in light mode and dims it in dark mode", () => {
    renderBodyEditor();

    expect(toolbar().className).toContain("bg-black/5");
    expect(toolbar().className).toContain("dark:bg-muted/40");
  });

  test("writes the toolbar controls in the foreground colour", () => {
    renderBodyEditor();

    expect(button("ضخیم").className).toContain("text-foreground");
    expect(button("انتخاب ایموجی").className).toContain("text-foreground");
  });

  test("keeps the two pickers on the background surface while hovered", () => {
    renderBodyEditor();

    for (const label of [BLOCK_TYPE_LABEL, FONT_SIZE_LABEL]) {
      const className = toolbarSelect(label).className;
      expect(className).toContain("bg-background");
      expect(className).toContain("hover:bg-background");
    }
  });

  test("groups the controls with full height vertical separators", () => {
    renderBodyEditor();

    expect(separators()).toHaveLength(6);
    for (const separator of separators()) {
      expect(separator.getAttribute("data-orientation")).toBe("vertical");
      expect(separator.className).toContain("self-stretch");
    }
  });

  test("does not move focus off the text when a mark is pressed", () => {
    renderBodyEditor();

    selectAllBodyText();
    const mark = button("ضخیم");
    act(() => {
      mark.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
    });

    expectFocusNotIn(mark);
  });

  test("does not move focus off the text when a menu trigger is pressed", () => {
    renderBodyEditor();

    const trigger = button("تراز متن");
    act(() => {
      trigger.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
    });

    expectFocusNotIn(trigger);
  });
});

describe("NoteBodyEditor blockquote", () => {
  test("wraps the current block in a blockquote", () => {
    renderBodyEditor("<p>متن</p>");

    focusBodyCaret();
    pressButton("نقل قول");

    expect(bodyEditor().getHTML()).toBe("<blockquote><p>متن</p></blockquote>");
  });

  test("unwraps the blockquote when pressed inside one", () => {
    renderBodyEditor("<blockquote><p>متن</p></blockquote>");

    focusBodyCaret();
    pressButton("نقل قول");

    expect(bodyEditor().getHTML()).toBe("<p>متن</p>");
  });

  test("reports the button as pressed while the caret is in a quote", () => {
    renderBodyEditor("<blockquote><p>متن</p></blockquote>");

    focusBodyCaret();

    expect(button("نقل قول").getAttribute("aria-pressed")).toBe("true");
  });

  test("reports the button as released while the caret is outside one", () => {
    renderBodyEditor("<p>متن</p>");

    focusBodyCaret();

    expect(button("نقل قول").getAttribute("aria-pressed")).toBe("false");
  });

  test("keeps a stored blockquote as a blockquote instead of escaping it", () => {
    renderBodyEditor("<blockquote><p>متن</p></blockquote>");

    expect(bodyEditor().getHTML()).toBe("<blockquote><p>متن</p></blockquote>");
  });

  test("keeps every block of a multi line quote inside one blockquote", () => {
    renderBodyEditor("<blockquote><p>اول</p><p>دوم</p></blockquote>");

    expect(bodyEditor().view.dom.querySelectorAll("blockquote").length).toBe(1);
  });
});

describe("NoteBodyEditor block type", () => {
  test("offers a paragraph and the h2 to h6 headings", () => {
    expect(BLOCK_TYPES.map(({ label }) => label)).toEqual([
      "پاراگراف",
      "عنوان ۲",
      "عنوان ۳",
      "عنوان ۴",
      "عنوان ۵",
      "عنوان ۶",
    ]);
  });

  test("turns the caret block into a heading and reports the markup", () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseBlockType("عنوان ۳");

    expect(bodyEditor().getHTML()).toBe("<h3>متن</h3>");
    expect(changes.at(-1)).toBe("<h3>متن</h3>");
  });

  test("turns a heading back into a paragraph", () => {
    renderBodyEditor("<h2>عنوان</h2>");

    focusBodyCaret();
    chooseBlockType("پاراگراف");

    expect(bodyEditor().getHTML()).toBe("<p>عنوان</p>");
  });

  test("draws the trigger as the icon of the block type the caret is in", async () => {
    renderBodyEditor("<h4>عنوان</h4>");

    focusBodyCaret();

    await waitFor(() =>
      expect(
        blockTypeSelect().querySelector(".lucide-heading-4"),
      ).not.toBeNull(),
    );
    expect(blockTypeSelect().textContent).toContain("عنوان ۴");
  });

  test("draws the paragraph trigger as the pilcrow icon", async () => {
    renderBodyEditor();

    focusBodyCaret();

    await waitFor(() =>
      expect(blockTypeSelect().querySelector(".lucide-pilcrow")).not.toBeNull(),
    );
    expect(blockTypeSelect().textContent).toContain("پاراگراف");
  });
});

describe("NoteBodyEditor heading typography", () => {
  const SIZED = '<p><span style="font-size: 16px;">متن</span></p>';

  test("lets a heading size itself instead of the copied text size", () => {
    renderBodyEditor(SIZED);

    focusBodyCaret();
    chooseBlockType("عنوان ۲");

    expect(bodyEditor().getHTML()).toBe("<h2>متن</h2>");
  });

  test("drops the line height the copied text carried too", () => {
    renderBodyEditor(
      '<p><span style="font-size: 16px; line-height: 1.25;">متن</span></p>',
    );

    focusBodyCaret();
    chooseBlockType("عنوان ۲");

    expect(bodyEditor().getHTML()).toBe("<h2>متن</h2>");
  });

  test("keeps the colour the copied text carried", () => {
    renderBodyEditor(
      `<p><span style="font-size: 16px; color: ${TEXT_RED};">متن</span></p>`,
    );

    focusBodyCaret();
    chooseBlockType("عنوان ۲");

    expect(bodyEditor().getHTML()).toBe(
      `<h2><span style="color: ${TEXT_RED};">متن</span></h2>`,
    );
  });

  test("keeps the bold the copied text carried", () => {
    renderBodyEditor(
      '<p><strong><span style="font-size: 16px;">متن</span></strong></p>',
    );

    focusBodyCaret();
    chooseBlockType("عنوان ۲");

    expect(bodyEditor().getHTML()).toBe("<h2><strong>متن</strong></h2>");
  });

  test("lets every heading the selection spans size itself", () => {
    renderBodyEditor(
      '<p><span style="font-size: 16px;">یک</span></p><p><span style="font-size: 40px;">دو</span></p>',
    );

    selectAllBodyText();
    chooseBlockType("عنوان ۲");

    expect(bodyEditor().getHTML()).toBe("<h2>یک</h2><h2>دو</h2>");
  });

  test("leaves a paragraph the size it was given", () => {
    renderBodyEditor();

    selectAllBodyText();
    chooseFontSize(2);

    expect(bodyEditor().getHTML()).toBe(
      `<p><span style="font-size: ${FONT_SIZES[2].fontSize}; line-height: ${FONT_SIZES[2].lineHeight};">متن</span></p>`,
    );
  });

  test("keeps the caret collapsed after the size is dropped", () => {
    renderBodyEditor("<p>hello world</p>");

    act(() => {
      bodyEditor().commands.focus(3);
    });
    chooseBlockType("عنوان ۲");

    expect(bodyEditor().state.selection.empty).toBe(true);
    expect(bodyEditor().state.selection.from).toBe(3);
  });

  test("undoes the heading and the size it dropped in one step", () => {
    renderBodyEditor(SIZED);

    focusBodyCaret();
    chooseBlockType("عنوان ۲");
    expect(bodyEditor().getHTML()).toBe("<h2>متن</h2>");

    act(() => {
      bodyEditor().commands.undo();
    });

    expect(bodyEditor().getHTML()).toBe(SIZED);
  });
});

describe("NoteBodyEditor marks", () => {
  test("starts every mark on the ghost variant with no selection carried", () => {
    renderBodyEditor();

    selectAllBodyText();

    for (const label of MARK_LABELS) {
      expect(button(label).getAttribute("aria-pressed")).toBe("false");
      expect(button(label).getAttribute("data-variant")).toBe("ghost");
    }
  });

  test("bolds the selection and reports the markup", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressButton("ضخیم");

    expect(bodyEditor().getHTML()).toBe("<p><strong>متن</strong></p>");
    expect(changes.at(-1)).toBe("<p><strong>متن</strong></p>");
  });

  test("italics the selection", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressButton("مورب");

    expect(bodyEditor().getHTML()).toBe("<p><em>متن</em></p>");
  });

  test("underlines the selection", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressButton("زیرخط");

    expect(bodyEditor().getHTML()).toBe("<p><u>متن</u></p>");
  });

  test("strikes the selection", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressButton("خط خورده");

    expect(bodyEditor().getHTML()).toBe("<p><s>متن</s></p>");
  });

  test("toggles a mark off again", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressButton("ضخیم");
    selectAllBodyText();
    pressButton("ضخیم");

    expect(bodyEditor().getHTML()).toBe("<p>متن</p>");
  });

  test("marks a button as pressed while its mark is active", async () => {
    renderBodyEditor();

    selectAllBodyText();
    pressButton("زیرخط");

    await waitFor(() =>
      expect(button("زیرخط").getAttribute("aria-pressed")).toBe("true"),
    );
    expect(button("ضخیم").getAttribute("aria-pressed")).toBe("false");
  });

  test("switches an active mark to the primary variant", async () => {
    renderBodyEditor();

    selectAllBodyText();
    pressButton("زیرخط");

    await waitFor(() =>
      expect(button("زیرخط").getAttribute("data-variant")).toBe("default"),
    );
    expect(button("ضخیم").getAttribute("data-variant")).toBe("ghost");
  });

  test("only the marks the selection carries read as primary", async () => {
    renderBodyEditor("<p><strong>پررنگ</strong></p>");

    selectAllBodyText();

    await waitFor(() =>
      expect(button("ضخیم").getAttribute("data-variant")).toBe("default"),
    );
    for (const label of ["مورب", "زیرخط", "خط خورده"]) {
      expect(button(label).getAttribute("data-variant")).toBe("ghost");
    }
  });

  test("shows two marks as primary at once when both are carried", async () => {
    renderBodyEditor("<p><strong><em>هر دو</em></strong></p>");

    selectAllBodyText();

    await waitFor(() => {
      expect(button("ضخیم").getAttribute("data-variant")).toBe("default");
      expect(button("مورب").getAttribute("data-variant")).toBe("default");
    });
  });

  test("combines several marks on one selection", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressButton("ضخیم");
    pressButton("خط خورده");

    expect(bodyEditor().getHTML()).toBe("<p><strong><s>متن</s></strong></p>");
  });

  test("keeps the selection so a second mark applies to the same text", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressButton("ضخیم");
    pressButton("مورب");

    expect(bodyEditor().getHTML()).toBe("<p><strong><em>متن</em></strong></p>");
  });
});

describe("NoteBodyEditor tooltips", () => {
  test("labels each mark button with its tooltip trigger", () => {
    renderBodyEditor();

    for (const label of MARK_LABELS) {
      expect(button(label).getAttribute("data-slot")).toBe("tooltip-trigger");
    }
  });

  test("shows the bold tooltip on hover", async () => {
    renderBodyEditor();

    fireHover(button("ضخیم"));

    await waitFor(() => expect(screen.getByText("ضخیم")).toBeDefined());
  });

  test("shows the strikethrough tooltip on hover", async () => {
    renderBodyEditor();

    fireHover(button("خط خورده"));

    await waitFor(() => expect(screen.getByText("خط خورده")).toBeDefined());
  });

  test("names the alignment action in its tooltip", async () => {
    renderBodyEditor();

    fireHover(button("تراز متن"));

    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toContain("تراز متن"),
    );
  });

  test("names the emoji action in its tooltip", async () => {
    renderBodyEditor();

    fireHover(button("انتخاب ایموجی"));

    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toContain(
        "انتخاب ایموجی",
      ),
    );
  });

  test("names the bold shortcut in its tooltip kbd", async () => {
    renderBodyEditor();

    fireHover(button("ضخیم"));

    await waitFor(() =>
      expect(
        screen.getByRole("tooltip").querySelector("kbd")?.textContent,
      ).toBe(toolbarShortcut("bold").combination),
    );
  });

  test("names the rule shortcut in its tooltip kbd", async () => {
    renderBodyEditor();

    fireHover(button("خط افقی"));

    await waitFor(() =>
      expect(
        screen.getByRole("tooltip").querySelector("kbd")?.textContent,
      ).toBe(toolbarShortcut("horizontalRule").combination),
    );
  });

  test("gives every toolbar control a trigger labelled as its shortcut", () => {
    renderBodyEditor();

    const labels = new Set(
      [...toolbar().querySelectorAll("button, [role='combobox']")].map(
        (element) => element.getAttribute("aria-label"),
      ),
    );

    for (const { shortcut } of TOOLBAR_SHORTCUTS) {
      expect(labels.has(shortcut.label)).toBe(true);
    }
  });

  test("names the body emoji shortcut apart from the title one", async () => {
    renderBodyEditor();

    fireHover(button("انتخاب ایموجی"));

    await waitFor(() =>
      expect(
        screen.getByRole("tooltip").querySelector("kbd")?.textContent,
      ).toBe(toolbarShortcut("bodyEmoji").combination),
    );
  });

  test("hides a picker tooltip while its list is open", async () => {
    renderBodyEditor();

    fireHover(button("انتخاب ایموجی"));
    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toContain(
        "انتخاب ایموجی",
      ),
    );

    act(() => {
      button("انتخاب ایموجی").click();
    });

    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });
});

describe("NoteBodyEditor font size", () => {
  test("names the size control and starts on the default size", () => {
    renderBodyEditor();

    const select = toolbarSelect(FONT_SIZE_LABEL);
    expect(select).toBeDefined();
    expect(select.textContent).toContain("16px");
  });

  test("offers 16px as the smallest size", () => {
    expect(FONT_SIZES.map((size) => size.label)).toEqual([
      "16px",
      "18px",
      "20px",
      "24px",
    ]);
  });

  test("treats 16px as the size of plain text", () => {
    renderBodyEditor();

    selectAllBodyText();

    expect(activeFontSize(bodyEditor())).toBe("base");
    expect(DEFAULT_FONT_SIZE).toBe("base");
  });

  test("offers no size below 16px", () => {
    expect(FONT_SIZES.some((size) => size.fontSize.includes("--text-sm"))).toBe(
      false,
    );
  });

  test("follows the size the selection carries", async () => {
    renderBodyEditor();

    selectAllBodyText();
    chooseFontSize(2);

    await waitFor(() =>
      expect(toolbarSelect(FONT_SIZE_LABEL).textContent).toContain("20px"),
    );
    expect(bodyEditor().getHTML()).toContain(FONT_SIZES[2].fontSize);
  });

  test("keeps the existing block alone and sizes the text typed next", () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseFontSize(3);

    expect(bodyEditor().getHTML()).toBe("<p>متن</p>");

    act(() => {
      bodyEditor().commands.insertContent("تازه");
    });

    expect(bodyEditor().getHTML()).toContain(FONT_SIZES[3].fontSize);
  });

  test("shows the pending size on the trigger before anything is typed", async () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseFontSize(3);

    await waitFor(() =>
      expect(toolbarSelect(FONT_SIZE_LABEL).textContent).toContain("24px"),
    );
  });

  test("keeps the caret collapsed after sizing a bare caret", () => {
    renderBodyEditor("<p>hello world</p>");

    act(() => {
      bodyEditor().commands.focus(3);
    });
    chooseFontSize(1);

    expect(bodyEditor().state.selection.empty).toBe(true);
    expect(bodyEditor().getHTML()).toBe("<p>hello world</p>");
  });
});

describe("NoteBodyEditor font size of text pasted from the title", () => {
  const TITLE_SIZE = '<p><span style="font-size: 30px;">متن</span></p>';

  test("reads the default for plain text the body already sizes", async () => {
    renderBodyEditor();

    selectAllBodyText();

    await waitFor(() =>
      expect(toolbarSelect(FONT_SIZE_LABEL).textContent).toContain("16px"),
    );
  });

  test("reports a size the picker does not offer as mixed", async () => {
    renderBodyEditor(TITLE_SIZE);

    selectAllBodyText();

    await waitFor(() =>
      expect(toolbarSelect(FONT_SIZE_LABEL).textContent).toContain(
        MIXED_FONT_SIZE_LABEL,
      ),
    );
    expect(toolbarSelect(FONT_SIZE_LABEL).textContent).not.toContain("16px");
  });

  test("applies a picked size straight over the pasted one", () => {
    renderBodyEditor(TITLE_SIZE);

    selectAllBodyText();
    applyFontSize(bodyEditor(), "base");

    expect(bodyEditor().getHTML()).toBe(
      `<p><span style="font-size: var(--text-base); line-height: var(--text-base--line-height);">متن</span></p>`,
    );
  });

  test("leaves the picker on a size that differs from the pasted one", () => {
    renderBodyEditor(TITLE_SIZE);

    selectAllBodyText();

    expect(activeFontSize(bodyEditor())).toBeNull();
    expect(activeFontSize(bodyEditor())).not.toBe("base");
  });

  test("reports a selection of two different sizes as mixed", async () => {
    renderBodyEditor(
      `<p><span style="font-size: 30px;">یک</span><span style="font-size: 40px;">دو</span></p>`,
    );

    selectAllBodyText();

    await waitFor(() =>
      expect(toolbarSelect(FONT_SIZE_LABEL).textContent).toContain(
        MIXED_FONT_SIZE_LABEL,
      ),
    );
  });

  test("sizes both halves of that selection in one pick", () => {
    renderBodyEditor(
      `<p><span style="font-size: 30px;">یک</span><span style="font-size: 40px;">دو</span></p>`,
    );

    selectAllBodyText();
    applyFontSize(bodyEditor(), "base");

    expect(bodyEditor().getHTML()).toBe(
      `<p><span style="font-size: var(--text-base); line-height: var(--text-base--line-height);">یکدو</span></p>`,
    );
  });

  test("follows the size once the pasted text has been resized", async () => {
    renderBodyEditor(TITLE_SIZE);

    selectAllBodyText();
    applyFontSize(bodyEditor(), "base");

    await waitFor(() =>
      expect(toolbarSelect(FONT_SIZE_LABEL).textContent).toContain("16px"),
    );
  });
});

describe("NoteBodyEditor text alignment", () => {
  test("offers the four alignments", () => {
    renderBodyEditor();

    openMenu("تراز متن");

    expect(menuItemLabels("تراز متن")).toEqual([
      "راست",
      "وسط",
      "چپ",
      "هم تراز",
    ]);
  });

  test("centres the caret block and reports the markup", () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("تراز متن");
    chooseMenuItem("وسط");

    expect(bodyEditor().getHTML()).toBe(
      '<p style="text-align: center;">متن</p>',
    );
    expect(changes.at(-1)).toBe('<p style="text-align: center;">متن</p>');
  });

  test("aligns the caret block to the left", () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("تراز متن");
    chooseMenuItem("چپ");

    expect(bodyEditor().getHTML()).toBe('<p style="text-align: left;">متن</p>');
  });

  test("justifies the caret block", () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("تراز متن");
    chooseMenuItem("هم تراز");

    expect(bodyEditor().getHTML()).toBe(
      '<p style="text-align: justify;">متن</p>',
    );
  });

  test("aligns a heading as well as a paragraph", () => {
    renderBodyEditor("<h2>عنوان</h2>");

    focusBodyCaret();
    openMenu("تراز متن");
    chooseMenuItem("وسط");

    expect(bodyEditor().getHTML()).toBe(
      '<h2 style="text-align: center;">عنوان</h2>',
    );
  });

  test("leaves no alignment style until one is chosen", () => {
    renderBodyEditor();

    focusBodyCaret();

    expect(bodyEditor().getHTML()).toBe("<p>متن</p>");
  });

  test("reads right as the alignment when none is set", () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("تراز متن");

    expect(
      screen
        .getByRole("menuitemradio", { name: "راست" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  test("marks only the active alignment as checked", () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("تراز متن");
    chooseMenuItem("وسط");

    openMenu("تراز متن");

    expect(
      screen
        .getByRole("menuitemradio", { name: "وسط" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("menuitemradio", { name: "راست" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  test("stores no text-align for the right default", () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("تراز متن");
    chooseMenuItem("راست");

    expect(bodyEditor().getHTML()).toBe("<p>متن</p>");
  });

  test("anchors the list to the toolbar edge with no gap", () => {
    renderBodyEditor();

    openMenu("تراز متن");

    const list = screen.getByRole("menu", { name: "تراز متن" });
    expect(list.className).toContain("top-full");
    expect(list.className).not.toContain("mt-");
  });

  test("closes the list when a press lands outside the toolbar", async () => {
    renderBodyEditor();

    openMenu("تراز متن");

    act(() => {
      document
        .querySelector(".ProseMirror")
        ?.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
        );
    });

    await waitFor(() =>
      expect(screen.queryByRole("menu", { name: "تراز متن" })).toBeNull(),
    );
  });

  test("closes the list on Escape", async () => {
    renderBodyEditor();

    openMenu("تراز متن");

    act(() => {
      button("تراز متن").parentElement?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await waitFor(() =>
      expect(screen.queryByRole("menu", { name: "تراز متن" })).toBeNull(),
    );
  });
});

describe("NoteBodyEditor text position", () => {
  test("offers normal, subscript and superscript", () => {
    renderBodyEditor();

    openMenu("موقعیت متن");

    expect(menuItemLabels("موقعیت متن")).toEqual([
      "معمولی",
      "زیرنویس",
      "بالانویس",
    ]);
  });

  test("subscripts the selection and reports the markup", () => {
    renderBodyEditor();

    selectAllBodyText();
    openMenu("موقعیت متن");
    chooseMenuItem("زیرنویس");

    expect(bodyEditor().getHTML()).toBe("<p><sub>متن</sub></p>");
    expect(changes.at(-1)).toBe("<p><sub>متن</sub></p>");
  });

  test("superscripts the selection", () => {
    renderBodyEditor();

    selectAllBodyText();
    openMenu("موقعیت متن");
    chooseMenuItem("بالانویس");

    expect(bodyEditor().getHTML()).toBe("<p><sup>متن</sup></p>");
  });

  test("returns a subscripted run to normal", () => {
    renderBodyEditor("<p><sub>متن</sub></p>");

    selectAllBodyText();
    openMenu("موقعیت متن");
    chooseMenuItem("معمولی");

    expect(bodyEditor().getHTML()).toBe("<p>متن</p>");
  });

  test("switches a superscript to a subscript", () => {
    renderBodyEditor("<p><sup>متن</sup></p>");

    selectAllBodyText();
    openMenu("موقعیت متن");
    chooseMenuItem("زیرنویس");

    expect(bodyEditor().getHTML()).toBe("<p><sub>متن</sub></p>");
  });

  test("keeps a mark and a subscript on the same text", () => {
    renderBodyEditor();

    selectAllBodyText();
    pressButton("ضخیم");
    openMenu("موقعیت متن");
    chooseMenuItem("بالانویس");

    expect(bodyEditor().getHTML()).toBe(
      "<p><strong><sup>متن</sup></strong></p>",
    );
  });

  test("marks normal as checked when no position mark is carried", () => {
    renderBodyEditor();

    selectAllBodyText();
    openMenu("موقعیت متن");

    expect(
      screen
        .getByRole("menuitemradio", { name: "معمولی" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });
});

describe("NoteBodyEditor text direction", () => {
  test("offers rtl and ltr", () => {
    renderBodyEditor();

    openMenu("جهت متن");

    expect(menuItemLabels("جهت متن")).toEqual(["راست به چپ", "چپ به راست"]);
  });

  test("writes ltr onto the caret block", () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("جهت متن");
    chooseMenuItem("چپ به راست");

    expect(bodyEditor().getHTML()).toBe('<p dir="ltr">متن</p>');
    expect(changes.at(-1)).toBe('<p dir="ltr">متن</p>');
  });

  test("switches a paragraph back to rtl", () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("جهت متن");
    chooseMenuItem("چپ به راست");
    openMenu("جهت متن");
    chooseMenuItem("راست به چپ");

    expect(bodyEditor().getHTML()).toBe('<p dir="rtl">متن</p>');
  });

  test("writes the direction onto a heading", () => {
    renderBodyEditor("<h3>عنوان</h3>");

    focusBodyCaret();
    openMenu("جهت متن");
    chooseMenuItem("چپ به راست");

    expect(bodyEditor().getHTML()).toBe('<h3 dir="ltr">عنوان</h3>');
  });

  test("keeps an alignment and a direction on the same block", () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("تراز متن");
    chooseMenuItem("وسط");
    openMenu("جهت متن");
    chooseMenuItem("چپ به راست");

    expect(bodyEditor().getHTML()).toBe(
      '<p style="text-align: center;" dir="ltr">متن</p>',
    );
  });

  test("reads back a stored direction", () => {
    renderBodyEditor('<p dir="ltr">latin text</p>');

    focusBodyCaret();
    openMenu("جهت متن");

    expect(
      screen
        .getByRole("menuitemradio", { name: "چپ به راست" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  test("reads rtl as the direction when none is set", () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("جهت متن");

    expect(
      screen
        .getByRole("menuitemradio", { name: "راست به چپ" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  test("stores no dir attribute for the rtl default", () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("جهت متن");
    chooseMenuItem("راست به چپ");

    expect(bodyEditor().getHTML()).toBe("<p>متن</p>");
  });
});

describe("NoteBodyEditor lists", () => {
  test("turns the caret block into a bullet list", () => {
    renderBodyEditor();

    focusBodyCaret();
    pressButton("لیست نقطه ای");

    expect(bodyEditor().getHTML()).toBe("<ul><li><p>متن</p></li></ul>");
    expect(changes.at(-1)).toBe("<ul><li><p>متن</p></li></ul>");
  });

  test("turns the caret block into an ordered list", () => {
    renderBodyEditor();

    focusBodyCaret();
    pressButton("لیست شماره دار");

    expect(bodyEditor().getHTML()).toBe("<ol><li><p>متن</p></li></ol>");
  });

  test("switches a bullet list into an ordered one", () => {
    renderBodyEditor("<ul><li><p>متن</p></li></ul>");

    focusBodyCaret();
    pressButton("لیست شماره دار");

    expect(bodyEditor().getHTML()).toBe("<ol><li><p>متن</p></li></ol>");
  });

  test("leaves the list when the active list button is pressed", () => {
    renderBodyEditor("<ul><li><p>متن</p></li></ul>");

    focusBodyCaret();
    pressButton("لیست نقطه ای");

    expect(bodyEditor().getHTML()).toBe("<p>متن</p>");
  });

  test("marks only the list the caret is in as pressed", async () => {
    renderBodyEditor("<ul><li><p>متن</p></li></ul>");

    focusBodyCaret();

    await waitFor(() =>
      expect(button("لیست نقطه ای").getAttribute("aria-pressed")).toBe("true"),
    );
    expect(button("لیست شماره دار").getAttribute("aria-pressed")).toBe("false");
  });

  test("marks only the ordered list primary inside an ordered list", async () => {
    renderBodyEditor("<ol><li><p>متن</p></li></ol>");

    focusBodyCaret();

    await waitFor(() =>
      expect(button("لیست شماره دار").getAttribute("data-variant")).toBe(
        "default",
      ),
    );
    expect(button("لیست نقطه ای").getAttribute("data-variant")).toBe("ghost");
  });

  test("starts a list block with the ghost variant", () => {
    renderBodyEditor();

    focusBodyCaret();

    expect(button("لیست نقطه ای").getAttribute("data-variant")).toBe("ghost");
  });
});

describe("NoteBodyEditor heading restrictions", () => {
  const HEADING = "<h3>عنوان</h3>";

  test("disables the font size picker inside a heading", () => {
    renderBodyEditor(HEADING);

    focusBodyCaret();

    expect(
      toolbarSelect(FONT_SIZE_LABEL).getAttribute("data-disabled"),
    ).not.toBe(null);
  });

  test("leaves the font size picker enabled inside a paragraph", () => {
    renderBodyEditor();

    focusBodyCaret();

    expect(toolbarSelect(FONT_SIZE_LABEL).getAttribute("data-disabled")).toBe(
      null,
    );
  });

  test("disables bold inside a heading", () => {
    renderBodyEditor(HEADING);

    focusBodyCaret();

    expect(button("ضخیم").hasAttribute("disabled")).toBe(true);
  });

  test("leaves the other marks enabled inside a heading", () => {
    renderBodyEditor(HEADING);

    focusBodyCaret();

    for (const label of ["مورب", "زیرخط", "خط خورده"]) {
      expect(button(label).hasAttribute("disabled")).toBe(false);
    }
  });

  test("disables both list buttons inside a heading", () => {
    renderBodyEditor(HEADING);

    focusBodyCaret();

    for (const label of LIST_LABELS) {
      expect(button(label).hasAttribute("disabled")).toBe(true);
    }
  });

  test("leaves bold and the lists enabled inside a paragraph", () => {
    renderBodyEditor();

    focusBodyCaret();

    expect(button("ضخیم").hasAttribute("disabled")).toBe(false);
    for (const label of LIST_LABELS) {
      expect(button(label).hasAttribute("disabled")).toBe(false);
    }
  });

  test("hides the font size tooltip while the picker is disabled", async () => {
    renderBodyEditor(HEADING);

    fireHover(toolbarSelect(FONT_SIZE_LABEL));

    await Bun.sleep(50);
    expect(screen.queryByText(FONT_SIZE_LABEL)).toBeNull();
  });

  test("hides the bold tooltip while bold is disabled", () => {
    renderBodyEditor(HEADING);

    fireHover(button("ضخیم"));

    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });
});

describe("NoteBodyEditor colors", () => {
  test("colours the selected text", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pickColor("رنگ متن", TEXT_RED);

    expect(bodyEditor().getHTML()).toBe(
      `<p><span style="color: ${TEXT_RED};">متن</span></p>`,
    );
  });

  test("highlights the selected text", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pickColor("رنگ پس زمینه", HIGHLIGHT_ORANGE);

    const html = bodyEditor().getHTML();
    expect(html).toContain("<mark");
    expect(html).toContain(`background-color: ${HIGHLIGHT_ORANGE}`);
  });

  test("puts the chosen colour on text typed afterwards", () => {
    renderBodyEditor();

    focusBodyCaret();
    pickColor("رنگ متن", TEXT_RED);

    act(() => {
      bodyEditor().commands.insertContent("تازه");
    });

    expect(bodyEditor().getHTML()).toContain(TEXT_RED);
  });

  test("shows a reset entry above the palette", () => {
    renderBodyEditor();

    openColorMenu("رنگ متن");

    expect(screen.getByRole("menuitem", { name: "پیش فرض" })).toBeDefined();
  });

  test("the reset entry clears the colour back to the default", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pickColor("رنگ متن", TEXT_RED);
    expect(bodyEditor().getHTML()).toContain(TEXT_RED);

    openColorMenu("رنگ متن");
    const reset = screen.getByRole("menuitem", { name: "پیش فرض" });
    act(() => {
      reset.click();
    });

    expect(bodyEditor().getHTML()).not.toContain(TEXT_RED);
  });

  test("marks the chosen swatch as the pressed one", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pickColor("رنگ متن", TEXT_RED);

    openColorMenu("رنگ متن");

    expect(
      screen
        .getByRole("button", { name: TEXT_RED })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  test("only the chosen swatch carries a ring", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pickColor("رنگ متن", TEXT_RED);

    openColorMenu("رنگ متن");

    const chosen = screen.getByRole("button", { name: TEXT_RED }).className;
    const other = screen.getByRole("button", { name: "#22c55e" }).className;

    expect(chosen.split(" ")).toContain("ring-2");
    expect(other.split(" ")).not.toContain("ring-2");
  });

  test("leaves the other swatches unpressed", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pickColor("رنگ متن", TEXT_RED);

    openColorMenu("رنگ متن");

    expect(
      screen
        .getByRole("button", { name: "#22c55e" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  test("the trigger underline reflects the current text colour", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pickColor("رنگ متن", TEXT_RED);

    const underline = button("رنگ متن").querySelector("span span");
    expect(underline?.getAttribute("style")).toBe(
      `background-color: ${TEXT_RED};`,
    );
  });

  test("picking a swatch closes the menu and leaves focus in the editor", async () => {
    renderBodyEditor();

    await selectAllBodyText();
    pickColor("رنگ متن", TEXT_RED);

    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: "پیش فرض" })).toBeNull(),
    );
    expect(document.activeElement === bodyField()).toBe(true);
  });

  test("a stored coloured body comes back as markup", () => {
    renderBodyEditor(`<p><span style="color: ${TEXT_RED};">متن</span></p>`);

    expect(bodyEditor().getHTML()).toBe(
      `<p><span style="color: ${TEXT_RED};">متن</span></p>`,
    );
  });
});

describe("NoteBodyEditor code block", () => {
  const CODE_BLOCK_LABEL = "بلاک کد";

  function openCodeBlockMenu(): void {
    const trigger = button(CODE_BLOCK_LABEL);
    act(() => {
      trigger.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          button: 0,
          ctrlKey: false,
        }),
      );
      trigger.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
      trigger.click();
    });
  }

  function chooseLanguage(label: string): void {
    openCodeBlockMenu();
    const item = screen.getByRole("menuitem", { name: label });
    act(() => {
      item.click();
    });
  }

  function languageNames(): (string | null)[] {
    return [...document.querySelectorAll("[role='menuitem']")].map(
      (item) => item.textContent,
    );
  }

  test("turns the current block into a code block", () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseLanguage("JavaScript");

    const html = bodyEditor().getHTML();
    expect(html).toContain("<pre");
    expect(html).toContain('class="language-javascript"');
  });

  test("marks the block as left to right so code reads left to right", () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseLanguage("HTML");

    expect(bodyEditor().getHTML()).toContain('dir="ltr"');
  });

  test("offers every language the lowlight instance can highlight", () => {
    renderBodyEditor();

    openCodeBlockMenu();

    expect(languageNames()).toEqual(
      CODE_BLOCK_LANGUAGES.map((option) => option.label),
    );
  });

  test("registers every offered language with lowlight", () => {
    expect(lowlight.listLanguages().toSorted()).toEqual(
      CODE_BLOCK_LANGUAGES.map((option) => option.value).toSorted(),
    );
  });

  test("highlights the code it stores", () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseLanguage("JSON");
    act(() => {
      bodyEditor().commands.insertContent('{"a":1}');
    });

    const highlighted = document.querySelectorAll(
      "pre code .hljs-string, pre code .hljs-attr",
    );
    expect(highlighted.length).toBeGreaterThan(0);
  });

  test("switches the language of the code block the caret is in", () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseLanguage("Python");
    chooseLanguage("SQL");

    expect(bodyEditor().getHTML()).toContain('class="language-sql"');
    expect(bodyEditor().getHTML()).not.toContain("language-python");
  });

  test("keeps the code when it changes language", () => {
    renderBodyEditor("<pre><code>ls</code></pre>");

    focusBodyCaret();
    chooseLanguage("Bash");
    chooseLanguage("Markdown");

    expect(bodyEditor().getText()).toBe("ls");
  });

  test("reads a stored code block back as markup", () => {
    renderBodyEditor(
      '<pre><code class="language-css">p{color:red}</code></pre>',
    );

    const html = bodyEditor().getHTML();
    expect(html).toContain("<pre");
    expect(html).toContain('class="language-css"');
  });

  test("ticks only the language the code block is written in", () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseLanguage("Python");
    openCodeBlockMenu();

    const ticked = [...document.querySelectorAll("[role='menuitem']")]
      .filter((item) => item.querySelector("svg") !== null)
      .map((item) => item.textContent);

    expect(ticked).toEqual(["Python"]);
  });

  test("leaves every language unticked outside a code block", () => {
    renderBodyEditor();

    openCodeBlockMenu();

    const ticked = [...document.querySelectorAll("[role='menuitem']")].filter(
      (item) => item.querySelector("svg") !== null,
    );

    expect(ticked.length).toBe(0);
  });

  test("scrolls the language list without opting into the platform scrollbar", () => {
    renderBodyEditor();

    openCodeBlockMenu();

    const group = document.querySelector("[data-slot='dropdown-menu-group']");
    expect(group?.className).toContain("overflow-y-auto");
    expect(group?.className).not.toContain("scrollbar");
    expect(group?.className).toContain("max-h-48");
  });

  test("reads a code block with no language as plain code", () => {
    renderBodyEditor("<pre><code>ls</code></pre>");

    expect(bodyEditor().getHTML()).toContain('class="language-plaintext"');
  });

  test("leaves the caret in the editor after picking a language", async () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseLanguage("JSON");

    await waitFor(() =>
      expect(document.querySelector("[role='menuitem']")).toBeNull(),
    );
    expect(document.activeElement === bodyField()).toBe(true);
  });

  test("presses the trigger while the caret is in a code block", () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseLanguage("Bash");

    expect(button(CODE_BLOCK_LABEL).getAttribute("aria-pressed")).toBe("true");
  });

  test("leaves the trigger unpressed in ordinary text", () => {
    renderBodyEditor();

    expect(button(CODE_BLOCK_LABEL).getAttribute("aria-pressed")).toBe("false");
  });

  test("opens the language list on Ctrl + Alt + K", () => {
    renderBodyEditor();

    focusBodyCaret();
    pressCommand("codeBlock");

    expect(screen.getByRole("menuitem", { name: "کد ساده" })).toBeDefined();
  });

  test("the shortcut only fires on its own binding", () => {
    renderBodyEditor();

    focusBodyCaret();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          code: "KeyL",
          ctrlKey: true,
          altKey: true,
        }),
      );
    });

    expect(document.querySelectorAll("[role='menuitem']").length).toBe(0);
  });

  test("undoes the code block it inserted", () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseLanguage("JSON");
    pressButton("برگرداندن");

    expect(bodyEditor().getHTML()).toBe("<p>متن</p>");
  });
});

describe("NoteBodyEditor horizontal rule", () => {
  test("inserts a rule below the current block", () => {
    renderBodyEditor();

    focusBodyCaret();
    pressButton("خط افقی");

    expect(bodyEditor().getHTML()).toBe("<p>متن</p><hr><p></p>");
  });

  test("undoes the rule it inserted", () => {
    renderBodyEditor();

    focusBodyCaret();
    pressButton("خط افقی");
    pressButton("برگرداندن");

    expect(bodyEditor().getHTML()).toBe("<p>متن</p>");
  });

  test("reads a stored rule back as markup", () => {
    renderBodyEditor("<p>متن</p><hr>");

    expect(bodyEditor().getHTML()).toBe("<p>متن</p><hr>");
  });

  test("reads a body that is only a rule as markup", () => {
    renderBodyEditor("<hr>");

    expect(bodyEditor().getHTML()).toBe("<hr>");
  });

  test("keeps the caret in the text rather than on the toolbar", () => {
    renderBodyEditor();

    focusBodyCaret();
    const rule = button("خط افقی");
    act(() => {
      rule.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
    });

    expectFocusNotIn(rule);
  });
});

describe("NoteBodyEditor stored lists", () => {
  test("reads back a stored bullet list as markup", () => {
    renderBodyEditor("<ul><li><p>متن</p></li></ul>");

    expect(bodyEditor().getHTML()).toBe("<ul><li><p>متن</p></li></ul>");
  });

  test("reads back a stored ordered list as markup", () => {
    renderBodyEditor("<ol><li><p>متن</p></li></ol>");

    expect(bodyEditor().getHTML()).toBe("<ol><li><p>متن</p></li></ol>");
  });

  test("still turns plain text into paragraphs", () => {
    renderBodyEditor("خط اول\nخط دوم");

    expect(bodyEditor().getHTML()).toBe("<p>خط اول</p><p>خط دوم</p>");
  });
});

describe("NoteBodyEditor toolbar icons", () => {
  function triggerIcon(label: string): string {
    return button(label).querySelector("svg")?.getAttribute("class") ?? "";
  }

  function menuIcons(menuLabel: string): string[] {
    openMenu(menuLabel);
    return [
      ...screen
        .getByRole("menu", { name: menuLabel })
        .querySelectorAll("[role='menuitemradio']"),
    ].map((item) => item.querySelector("svg")?.getAttribute("class") ?? "");
  }

  test("gives right and left opposite align icons", () => {
    renderBodyEditor();

    const icons = menuIcons("تراز متن");

    expect(icons[0]).toContain("text-align-end");
    expect(icons[2]).toContain("text-align-start");
  });

  test("gives rtl and ltr opposite direction icons", () => {
    renderBodyEditor();

    const icons = menuIcons("جهت متن");

    expect(icons[0]).toContain("pilcrow-left");
    expect(icons[1]).toContain("pilcrow-right");
  });

  test("draws the direction trigger as the active direction", () => {
    renderBodyEditor();

    focusBodyCaret();

    expect(triggerIcon("جهت متن")).toContain("pilcrow-left");
  });

  test("swaps the direction trigger once ltr is chosen", async () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("جهت متن");
    chooseMenuItem("چپ به راست");

    await waitFor(() =>
      expect(triggerIcon("جهت متن")).toContain("pilcrow-right"),
    );
  });

  test("draws the align trigger as the active alignment", async () => {
    renderBodyEditor();

    focusBodyCaret();
    openMenu("تراز متن");
    chooseMenuItem("وسط");

    await waitFor(() =>
      expect(triggerIcon("تراز متن")).toContain("text-align-center"),
    );
  });

  test("wraps a trigger in a flex item so no line box pads it", () => {
    renderBodyEditor();

    for (const label of ["جهت متن", "تراز متن", "موقعیت متن"]) {
      expect(button(label).parentElement?.className).toContain("flex");
    }
  });
});

describe("NoteBodyEditor emoji picker", () => {
  function openEmojiGrid() {
    renderBodyEditor();
    focusBodyCaret();

    const trigger = button("انتخاب ایموجی");
    act(() => {
      trigger.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
      trigger.click();
    });
  }

  test("opens a grid of the frequent emoji", () => {
    openEmojiGrid();

    expect(screen.getByRole("grid", { name: "انتخاب ایموجی" })).toBeDefined();
    expect(screen.getAllByRole("gridcell")).toHaveLength(FREQUENT_EMOJI.length);
  });

  test("inserts the chosen emoji into the body", () => {
    openEmojiGrid();

    act(() => {
      screen.getByRole("gridcell", { name: "🔥" }).click();
    });

    expect(bodyEditor().getText()).toBe("متن🔥");
    expect(changes.at(-1)).toBe("<p>متن🔥</p>");
  });

  test("stays open so several emoji can be picked", () => {
    openEmojiGrid();

    act(() => {
      screen.getByRole("gridcell", { name: "🔥" }).click();
    });
    act(() => {
      screen.getByRole("gridcell", { name: "🚀" }).click();
    });

    expect(bodyEditor().getText()).toBe("متن🔥🚀");
    expect(screen.getByRole("grid", { name: "انتخاب ایموجی" })).toBeDefined();
  });

  test("reports every insert as a change", () => {
    openEmojiGrid();

    act(() => {
      screen.getByRole("gridcell", { name: "🔥" }).click();
    });

    expect(changes.at(-1)).toBe("<p>متن🔥</p>");
  });

  test("sits behind a separator in the toolbar", () => {
    renderBodyEditor();

    const separator = separators().at(-1);
    const trigger = button("انتخاب ایموجی");

    expect(separator).not.toBeNull();
    expect(separator?.compareDocumentPosition(trigger)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("does not steal focus into the grid", () => {
    renderBodyEditor();

    const trigger = button("انتخاب ایموجی");
    act(() => {
      trigger.click();
    });

    expectFocusNotIn(trigger);
  });

  test("shows its tooltip on keyboard focus, not only on hover", async () => {
    renderBodyEditor();

    act(() => {
      button("انتخاب ایموجی").focus();
    });
    fireHover(button("انتخاب ایموجی"));

    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toContain(
        toolbarShortcut("bodyEmoji").combination,
      ),
    );
  });
});
