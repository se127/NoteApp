import { afterEach, describe, expect, test } from "bun:test";

import { getNotesBridge } from "@/lib/notes";
import type { NotesBridge } from "@/lib/notes";
import {
  createFakeNotesBridge,
  installNotesBridge,
} from "./helpers/browser-bridge";

const NO_BRIDGE = Symbol("no bridge");

function stubBridge(value: unknown): void {
  if (value === NO_BRIDGE) {
    delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
    return;
  }
  (globalThis as unknown as Record<string, unknown>)["NoteApp"] = value;
}

afterEach(() => {
  stubBridge(NO_BRIDGE);
});

describe("getNotesBridge", () => {
  test("returns the notes bridge exposed by the preload", () => {
    const bridge = createFakeNotesBridge();
    installNotesBridge(bridge);

    expect(getNotesBridge()).toBe(bridge as NotesBridge);
  });

  test("returns null when the preload exposed nothing", () => {
    stubBridge(NO_BRIDGE);

    expect(getNotesBridge()).toBeNull();
  });

  test("returns null when the bridge has no notes namespace", () => {
    stubBridge({ theme: { get: () => "system", set: () => {} } });

    expect(getNotesBridge()).toBeNull();
  });

  test("returns null when the preload exposed a partial object", () => {
    stubBridge({ notes: null });

    expect(getNotesBridge()).toBeNull();
  });
});
