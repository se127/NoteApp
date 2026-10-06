import { act } from "@testing-library/react";

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

const BUBBLE_MENU_DELAY = 300;

export async function waitForEditorFrame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

export async function selectAllBodyText(): Promise<void> {
  const editor = bodyEditor();
  act(() => {
    editor.commands.focus();
    editor.commands.selectAll();
  });
  await Bun.sleep(BUBBLE_MENU_DELAY);
}

export async function focusBodyCaret(): Promise<void> {
  const editor = bodyEditor();
  act(() => {
    editor.commands.focus("end");
  });
  await Bun.sleep(BUBBLE_MENU_DELAY);
}

export function pressMark(label: string): void {
  const button = document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (button === null) throw new Error(`no mark button named ${label}`);
  act(() => {
    button.click();
  });
}
