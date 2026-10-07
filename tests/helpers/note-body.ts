import { act, screen } from "@testing-library/react";

import type { BodyEditor } from "@/components/note-body-editor";

function bodyField(): HTMLElement {
  const field = document.querySelector<HTMLElement>(".ProseMirror");
  if (field === null) throw new Error("the body editor is not mounted");
  return field;
}

export function bodyEditor(): BodyEditor {
  const editor = (bodyField() as unknown as Record<string, unknown>)[
    "editor"
  ] as BodyEditor | undefined;
  if (editor === undefined) throw new Error("the body editor has no instance");
  return editor;
}

export function setBodyContent(html: string): void {
  const editor = bodyEditor();
  act(() => {
    editor.commands.setContent(html);
  });
}

export function selectAllBodyText(): void {
  const editor = bodyEditor();
  act(() => {
    editor.commands.focus();
    editor.commands.selectAll();
  });
}

export function focusBodyCaret(): void {
  const editor = bodyEditor();
  act(() => {
    editor.commands.focus("end");
  });
}

export function toolbarButton(label: string): HTMLElement {
  return screen.getByRole("button", { name: label });
}

export function toolbarSelect(label: string): HTMLElement {
  return screen.getByRole("combobox", { name: label });
}

export function pressMark(label: string): void {
  const button = toolbarButton(label);
  act(() => {
    button.click();
  });
}

export function openToolbarMenu(triggerLabel: string): void {
  const button = toolbarButton(triggerLabel);
  act(() => {
    button.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    button.click();
  });
}

export function chooseMenuItem(itemLabel: string): void {
  const item = screen.getByRole("menuitemradio", { name: itemLabel });
  act(() => {
    item.click();
  });
}

export function menuItemLabels(menuLabel: string): (string | null)[] {
  return [
    ...screen
      .getByRole("menu", { name: menuLabel })
      .querySelectorAll("[role='menuitemradio']"),
  ].map((item) => item.getAttribute("aria-label"));
}

export async function waitForEditorFrame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}
