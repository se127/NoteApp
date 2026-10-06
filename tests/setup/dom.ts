import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "http://localhost/" });

class TestResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class TestDOMRect extends DOMRect {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    super(x, y, width, height);
  }
}

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;

  constructor(type: string, properties: PointerEventInit = {}) {
    super(type, properties);
    this.pointerId = properties.pointerId ?? 1;
    this.pointerType = properties.pointerType ?? "mouse";
    this.isPrimary = properties.isPrimary ?? true;
  }
}

function installMissingGlobals(): void {
  const target = globalThis as unknown as Record<string, unknown>;

  if (target["ResizeObserver"] === undefined) {
    target["ResizeObserver"] = TestResizeObserver;
  }

  if (target["DOMRect"] === undefined) {
    target["DOMRect"] = TestDOMRect;
  }

  target["PointerEvent"] = TestPointerEvent;

  const elementPrototype = globalThis.Element.prototype as unknown as Record<
    string,
    unknown
  >;

  elementPrototype["hasPointerCapture"] ??= () => false;
  elementPrototype["setPointerCapture"] ??= () => {};
  elementPrototype["releasePointerCapture"] ??= () => {};
  elementPrototype["scrollIntoView"] ??= () => {};
  elementPrototype["scrollTo"] ??= () => {};
  elementPrototype["getClientRects"] ??= () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {},
  });
}

installMissingGlobals();

document.execCommand = () => true;

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;
