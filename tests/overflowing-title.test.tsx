import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

import { OverflowingTitle } from "@/components/overflowing-title";

type Geometry = { scrollWidth: number; offsetWidth: number; direction: string };

let geometry: Geometry = {
  scrollWidth: 100,
  offsetWidth: 100,
  direction: "rtl",
};

const baseComputedStyle = window.getComputedStyle.bind(window);

function stubGeometry(next: Partial<Geometry> = {}): void {
  geometry = { ...geometry, ...next };

  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get: () => geometry.scrollWidth,
  });

  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => geometry.offsetWidth,
  });

  window.getComputedStyle = ((element: Element) => {
    const style = baseComputedStyle(element);
    return new Proxy(style, {
      get: (target, property, receiver) => {
        if (property === "direction") return geometry.direction;
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }) as typeof window.getComputedStyle;
}

function viewportOf(container: HTMLElement): HTMLElement {
  return container.querySelector("span") as HTMLElement;
}

function innerOf(container: HTMLElement): HTMLElement {
  return container.querySelectorAll("span")[1] as HTMLElement;
}

afterEach(() => {
  cleanup();
  window.getComputedStyle = baseComputedStyle;
  geometry = { scrollWidth: 100, offsetWidth: 100, direction: "rtl" };
});

describe("OverflowingTitle", () => {
  test("renders the title text", () => {
    render(<OverflowingTitle>یک عنوان بلند</OverflowingTitle>);

    expect(viewportOf(document.body).textContent).toContain("یک عنوان بلند");
  });

  test("truncates a title that fits", () => {
    stubGeometry({ scrollWidth: 100, offsetWidth: 100 });

    const { container } = render(<OverflowingTitle>عنوان</OverflowingTitle>);

    expect(viewportOf(container).className).toContain("truncate");
  });

  test("switches to nowrap while hovered on an overflowing title", () => {
    stubGeometry({ scrollWidth: 200, offsetWidth: 100 });

    const { container } = render(<OverflowingTitle>عنوان</OverflowingTitle>);

    act(() => {
      fireEvent.pointerEnter(viewportOf(container));
    });

    expect(viewportOf(container).className).toContain("whitespace-nowrap");
  });

  test("adds the scroll animation to the inner span", () => {
    stubGeometry({ scrollWidth: 200, offsetWidth: 100 });

    const { container } = render(<OverflowingTitle>عنوان</OverflowingTitle>);

    act(() => {
      fireEvent.pointerEnter(viewportOf(container));
    });

    expect(innerOf(container).className).toContain("animate-note-title-scroll");
  });

  test("offsets to the right for a right to left title", () => {
    stubGeometry({ scrollWidth: 250, offsetWidth: 100, direction: "rtl" });

    const { container } = render(<OverflowingTitle>عنوان</OverflowingTitle>);

    act(() => {
      fireEvent.pointerEnter(viewportOf(container));
    });

    expect(innerOf(container).style.getPropertyValue("--scroll-offset")).toBe(
      "150px",
    );
  });

  test("offsets to the left for a left to right title", () => {
    stubGeometry({ scrollWidth: 250, offsetWidth: 100, direction: "ltr" });

    const { container } = render(<OverflowingTitle>title</OverflowingTitle>);

    act(() => {
      fireEvent.pointerEnter(viewportOf(container));
    });

    expect(innerOf(container).style.getPropertyValue("--scroll-offset")).toBe(
      "-150px",
    );
  });

  test("does not scroll a title that fits even when hovered", () => {
    stubGeometry({ scrollWidth: 100, offsetWidth: 100 });

    const { container } = render(<OverflowingTitle>عنوان</OverflowingTitle>);

    act(() => {
      fireEvent.pointerEnter(viewportOf(container));
    });

    expect(viewportOf(container).className).toContain("truncate");
  });

  test("ignores a one pixel rounding difference", () => {
    stubGeometry({ scrollWidth: 101, offsetWidth: 100 });

    const { container } = render(<OverflowingTitle>عنوان</OverflowingTitle>);

    act(() => {
      fireEvent.pointerEnter(viewportOf(container));
    });

    expect(viewportOf(container).className).toContain("truncate");
  });

  test("stops scrolling once the pointer leaves", () => {
    stubGeometry({ scrollWidth: 200, offsetWidth: 100 });

    const { container } = render(<OverflowingTitle>عنوان</OverflowingTitle>);

    act(() => {
      fireEvent.pointerEnter(viewportOf(container));
      fireEvent.pointerLeave(viewportOf(container));
    });

    expect(viewportOf(container).className).toContain("truncate");
  });

  test("applies a caller class name to the viewport", () => {
    stubGeometry();

    const { container } = render(
      <OverflowingTitle className="text-muted-foreground">
        بدون عنوان
      </OverflowingTitle>,
    );

    expect(viewportOf(container).className).toContain("text-muted-foreground");
  });

  test("keeps the caller class name while scrolling", () => {
    stubGeometry({ scrollWidth: 200, offsetWidth: 100 });

    const { container } = render(
      <OverflowingTitle className="text-muted-foreground">
        بدون عنوان
      </OverflowingTitle>,
    );

    act(() => {
      fireEvent.pointerEnter(viewportOf(container));
    });

    expect(viewportOf(container).className).toContain("text-muted-foreground");
  });
});
