import { readFileSync } from "node:fs";
import path from "node:path";

export type PreloadBridge = {
  theme: {
    get: () => unknown;
    set: (theme: string) => void;
    accent: { get: () => unknown; set: (accent: string) => void };
  };
  notes: {
    list: () => Promise<unknown>;
    count: () => Promise<unknown>;
    create: (note: unknown) => Promise<unknown>;
    remove: (id: number) => Promise<unknown>;
    update: (id: number, note: unknown) => Promise<unknown>;
    updateSync: (id: number, note: unknown) => unknown;
    onChanged: (callback: () => void) => () => void;
  };
};

export type PreloadCall = { channel: string; args: unknown[] };

export type PreloadIpcStub = {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  send: (channel: string, ...args: unknown[]) => void;
  sendSync: (channel: string, ...args: unknown[]) => unknown;
  on: (channel: string, listener: () => void) => void;
  removeListener: (channel: string, listener: () => void) => void;
};

export type LoadedPreload = {
  exposedKey: string | null;
  bridge: PreloadBridge;
  ipc: PreloadIpcStub;
  invokeCalls: PreloadCall[];
  sendCalls: PreloadCall[];
  syncCalls: PreloadCall[];
  listeners: Map<string, Set<() => void>>;
  setSyncReply: (value: unknown) => void;
};

/**
 * `electron/preload.cjs` is CommonJS and calls `require("electron")` at load,
 * so `mock.module` cannot reach it once another suite has mocked "electron"
 * for its own purposes. Evaluating the real file with an injected `require`
 * keeps the assertions honest about the actual channel names and payloads
 * while staying isolated from the module registry.
 */
export function loadPreload(): LoadedPreload {
  const source = readFileSync(
    path.join(import.meta.dir, "..", "..", "electron", "preload.cjs"),
    "utf8",
  );

  const invokeCalls: PreloadCall[] = [];
  const sendCalls: PreloadCall[] = [];
  const syncCalls: PreloadCall[] = [];
  const listeners = new Map<string, Set<() => void>>();

  let syncReply: unknown = undefined;
  let exposedKey: string | null = null;
  let exposed: unknown = null;

  const ipc: PreloadIpcStub = {
    invoke: async (channel, ...args) => {
      invokeCalls.push({ channel, args });
      return { channel };
    },
    send: (channel, ...args) => {
      sendCalls.push({ channel, args });
    },
    sendSync: (channel, ...args) => {
      syncCalls.push({ channel, args });
      return syncReply;
    },
    on: (channel, listener) => {
      const set = listeners.get(channel) ?? new Set();
      set.add(listener);
      listeners.set(channel, set);
    },
    removeListener: (channel, listener) => {
      listeners.get(channel)?.delete(listener);
    },
  };

  const factory = new Function("require", "module", "exports", source) as (
    require: (id: string) => unknown,
    module: { exports: unknown },
    exports: unknown,
  ) => void;

  const module = { exports: {} as unknown };

  factory(
    (id: string) => {
      if (id === "electron") {
        return {
          contextBridge: {
            exposeInMainWorld: (key: string, value: unknown) => {
              exposedKey = key;
              exposed = value;
            },
          },
          ipcRenderer: ipc,
        };
      }
      throw new Error(`unexpected require of "${id}" in preload.cjs`);
    },
    module,
    module.exports,
  );

  return {
    get exposedKey() {
      return exposedKey;
    },
    bridge: exposed as PreloadBridge,
    ipc,
    invokeCalls,
    sendCalls,
    syncCalls,
    listeners,
    setSyncReply: (value: unknown) => {
      syncReply = value;
    },
  };
}
