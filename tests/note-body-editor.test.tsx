import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, screen, waitFor } from "@testing-library/react";

import { NoteBodyEditor } from "@/components/note-body-editor";
import { BLOCK_TYPES, setBlockType, type BlockType } from "@/lib/block-type";
import { FREQUENT_EMOJI } from "@/lib/frequent-emoji";
import { FONT_SIZES, FONT_SIZE_LABEL } from "@/lib/font-size";
import {
  bodyEditor,
  focusBodyCaret,
  selectAllBodyText,
  toolbarSelect,
} from "./helpers/note-body";
import { renderWithProviders } from "./helpers/render";

const TOOLBAR_LABEL = "قالب‌بندی متن";
const BLOCK_TYPE_LABEL = "سبک متن";
const MARK_LABELS = ["ضخیم", "مورب", "زیرخط", "خط خورده"];
const LIST_LABELS = ["لیست نقطه ای", "لیست شماره دار"];

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

  test("orders direction, block style, font size, marks, lists, align and position", () => {
    renderBodyEditor();

    expect(toolbarButtonLabels()).toEqual([
      "جهت متن",
      BLOCK_TYPE_LABEL,
      FONT_SIZE_LABEL,
      ...MARK_LABELS,
      ...LIST_LABELS,
      "تراز متن",
      "موقعیت متن",
      "انتخاب ایموجی",
    ]);
  });

  test("keeps every toolbar control in the tab order", () => {
    renderBodyEditor();

    for (const control of toolbar().querySelectorAll("button")) {
      expect(control.getAttribute("tabindex")).not.toBe("-1");
    }
  });

  test("pads the toolbar and rounds it as a popover", () => {
    renderBodyEditor();

    expect(toolbar().className).toContain("p-1");
    expect(toolbar().className).toContain("rounded-lg");
    expect(toolbar().className).toContain("border-border");
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

    expect(separators()).toHaveLength(4);
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
      expect(screen.getByRole("tooltip").textContent).toBe("تراز متن"),
    );
  });

  test("names the emoji action in its tooltip", async () => {
    renderBodyEditor();

    fireHover(button("انتخاب ایموجی"));

    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toBe("انتخاب ایموجی"),
    );
  });

  test("hides a picker tooltip while its list is open", async () => {
    renderBodyEditor();

    fireHover(button("انتخاب ایموجی"));
    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toBe("انتخاب ایموجی"),
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
    expect(select.textContent).toContain("14px");
  });

  test("follows the size the selection carries", async () => {
    renderBodyEditor();

    selectAllBodyText();
    chooseFontSize(3);

    await waitFor(() =>
      expect(toolbarSelect(FONT_SIZE_LABEL).textContent).toContain("20px"),
    );
    expect(bodyEditor().getHTML()).toContain(FONT_SIZES[3].fontSize);
  });

  test("keeps the existing block alone and sizes the text typed next", () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseFontSize(4);

    expect(bodyEditor().getHTML()).toBe("<p>متن</p>");

    act(() => {
      bodyEditor().commands.insertContent("تازه");
    });

    expect(bodyEditor().getHTML()).toContain(FONT_SIZES[4].fontSize);
  });

  test("shows the pending size on the trigger before anything is typed", async () => {
    renderBodyEditor();

    focusBodyCaret();
    chooseFontSize(4);

    await waitFor(() =>
      expect(toolbarSelect(FONT_SIZE_LABEL).textContent).toContain("24px"),
    );
  });

  test("keeps the caret collapsed after sizing a bare caret", () => {
    renderBodyEditor("<p>hello world</p>");

    act(() => {
      bodyEditor().commands.focus(3);
    });
    chooseFontSize(2);

    expect(bodyEditor().state.selection.empty).toBe(true);
    expect(bodyEditor().getHTML()).toBe("<p>hello world</p>");
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
      expect(screen.getByRole("tooltip").textContent).toBe("انتخاب ایموجی"),
    );
  });
});
