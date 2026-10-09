import { act } from "@testing-library/react";

export function fireHover(element: Element): void {
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
