import { afterEach, describe, expect, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createRef } from "react";

import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { TooltipProvider } from "@/components/ui/tooltip";

const REVEAL_DISTANCE = 24;

function Harness() {
  const anchorRef = createRef<HTMLDivElement>();

  return (
    <TooltipProvider>
      <main>
        <div ref={anchorRef} />
        <ScrollToTopButton anchorRef={anchorRef} />
      </main>
    </TooltipProvider>
  );
}

function scroller(): HTMLElement {
  return document.querySelector("main") as HTMLElement;
}

function scrollTo(value: number): void {
  const main = scroller();
  const position: number = value;

  Object.defineProperty(main, "scrollTop", {
    configurable: true,
    get: () => position,
    set: () => {},
  });

  act(() => {
    main.dispatchEvent(new Event("scroll"));
  });
}

function wrapper(): HTMLElement {
  return screen
    .getByRole("button", { name: "رفتن به بالا" })
    .closest(".fixed") as HTMLElement;
}

afterEach(() => {
  cleanup();
});

describe("ScrollToTopButton", () => {
  test("renders a labelled button", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: "رفتن به بالا" })).toBeDefined();
  });

  test("is hidden while the editor is at the top", () => {
    render(<Harness />);

    expect(wrapper().className).toContain("opacity-0");
    expect(wrapper().className).toContain("pointer-events-none");
  });

  test("appears once the editor is scrolled past the reveal distance", () => {
    render(<Harness />);

    scrollTo(REVEAL_DISTANCE + 1);

    expect(wrapper().className).toContain("opacity-100");
  });

  test("stays hidden at exactly the reveal distance", () => {
    render(<Harness />);

    scrollTo(REVEAL_DISTANCE);

    expect(wrapper().className).toContain("opacity-0");
  });

  test("is out of the tab order while hidden", () => {
    render(<Harness />);

    expect(
      screen
        .getByRole("button", { name: "رفتن به بالا" })
        .getAttribute("tabindex"),
    ).toBe("-1");
  });

  test("enters the tab order once revealed", () => {
    render(<Harness />);
    scrollTo(100);

    expect(
      screen
        .getByRole("button", { name: "رفتن به بالا" })
        .getAttribute("tabindex"),
    ).toBe("0");
  });

  test("scrolls the editor back to the top when clicked", () => {
    render(<Harness />);
    scrollTo(500);

    const calls: Array<{ top: number; behavior: string }> = [];
    scroller().scrollTo = ((options: ScrollToOptions) => {
      calls.push({
        top: options.top ?? 0,
        behavior: options.behavior ?? "auto",
      });
    }) as HTMLElement["scrollTo"];

    fireEvent.click(screen.getByRole("button", { name: "رفتن به بالا" }));

    expect(calls).toEqual([{ top: 0, behavior: "smooth" }]);
  });

  test("hides again when the editor returns to the top", () => {
    render(<Harness />);
    scrollTo(500);
    scrollTo(0);

    expect(wrapper().className).toContain("opacity-0");
  });

  test("stops listening to scroll after unmount", () => {
    render(<Harness />);
    const main = scroller();
    scrollTo(500);

    cleanup();

    Object.defineProperty(main, "scrollTop", {
      configurable: true,
      get: () => 0,
      set: () => {},
    });

    act(() => {
      main.dispatchEvent(new Event("scroll"));
    });

    expect(screen.queryByRole("button", { name: "رفتن به بالا" })).toBeNull();
  });
});
