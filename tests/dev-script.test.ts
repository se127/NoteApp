import { describe, expect, test } from "bun:test";
import path from "node:path";

import {
  createServerProbe,
  devUserDataDir,
  isRunning,
  serverUrl,
  stopTree,
  viteArgs,
  waitForServer,
  type ServerProbe,
} from "../scripts/dev.ts";

type ChildLike = {
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  pid?: number;
};

function child(overrides: Partial<ChildLike> = {}): ChildLike {
  return { exitCode: null, signalCode: null, pid: 100, ...overrides };
}

describe("devUserDataDir", () => {
  test("uses APPDATA when it is set", () => {
    const result = devUserDataDir(
      path.join(path.sep, "Users", "dev", "AppData", "Roaming"),
      path.join(path.sep, "home", "dev"),
    );

    expect(result).toBe(
      path.join(path.sep, "Users", "dev", "AppData", "Roaming", "NoteApp-dev"),
    );
  });

  test("falls back to the home config directory", () => {
    const result = devUserDataDir(
      undefined,
      path.join(path.sep, "home", "dev"),
    );

    expect(result).toBe(
      path.join(path.sep, "home", "dev", ".config", "NoteApp-dev"),
    );
  });

  test("keeps the dev database separate from the installed one", () => {
    const appData = path.join(path.sep, "Users", "dev", "AppData", "Roaming");
    const result = devUserDataDir(appData, path.join(path.sep, "home", "dev"));

    expect(result).not.toBe(path.join(appData, "NoteApp"));
    expect(path.basename(result)).toBe("NoteApp-dev");
  });

  test("names the dev folder after the app, not the working directory", () => {
    const result = devUserDataDir(path.sep, path.sep);

    expect(path.basename(result)).toBe("NoteApp-dev");
  });
});

describe("serverUrl", () => {
  test("builds the loopback url for a port", () => {
    expect(serverUrl(5173)).toBe("http://127.0.0.1:5173");
  });

  test("honours a custom port", () => {
    expect(serverUrl(4000)).toBe("http://127.0.0.1:4000");
  });
});

describe("viteArgs", () => {
  test("pins the host, port and strict port flag", () => {
    expect(viteArgs("127.0.0.1", 5173)).toEqual([
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      "5173",
      "--strictPort",
    ]);
  });

  test("uses strict port so a busy port fails loudly", () => {
    expect(viteArgs("127.0.0.1", 5173)).toContain("--strictPort");
  });

  test("never leaves the port free for a second server", () => {
    expect(
      viteArgs("127.0.0.1", 5173).filter((arg) => arg === "--port"),
    ).toHaveLength(1);
  });
});

describe("isRunning", () => {
  test("is true while neither exit code nor signal is set", () => {
    expect(isRunning(child())).toBe(true);
  });

  test("is false after an exit code", () => {
    expect(isRunning(child({ exitCode: 0 }))).toBe(false);
  });

  test("is false after a signal", () => {
    expect(isRunning(child({ signalCode: "SIGTERM" }))).toBe(false);
  });
});

describe("stopTree", () => {
  test("does nothing for a process that already exited", () => {
    const taskkillCalls: string[][] = [];

    stopTree(child({ exitCode: 0 }), {
      platform: "win32",
      pid: undefined,
      force: false,
      kill: () => {},
      runTaskkill: (args) => taskkillCalls.push(args),
    });

    expect(taskkillCalls).toHaveLength(0);
  });

  test("kills the whole tree on windows", () => {
    const taskkillCalls: string[][] = [];

    stopTree(child(), {
      platform: "win32",
      pid: undefined,
      force: false,
      kill: () => {},
      runTaskkill: (args) => taskkillCalls.push(args),
    });

    expect(taskkillCalls).toEqual([["/pid", "100", "/T"]]);
  });

  test("forces the tree on windows when asked", () => {
    const taskkillCalls: string[][] = [];

    stopTree(child(), {
      platform: "win32",
      pid: undefined,
      force: true,
      kill: () => {},
      runTaskkill: (args) => taskkillCalls.push(args),
    });

    expect(taskkillCalls).toEqual([["/pid", "100", "/T", "/F"]]);
  });

  test("skips taskkill on windows without a pid", () => {
    const killed: number[] = [];

    stopTree(child({ pid: undefined }), {
      platform: "win32",
      pid: undefined,
      force: false,
      kill: (pid) => killed.push(pid),
      runTaskkill: () => {},
    });

    expect(killed).toEqual([0]);
  });

  test("sends a signal off windows", () => {
    const killed: number[] = [];
    const taskkillCalls: string[][] = [];

    stopTree(child(), {
      platform: "linux",
      pid: undefined,
      force: true,
      kill: (pid) => killed.push(pid),
      runTaskkill: (args) => taskkillCalls.push(args),
    });

    expect(killed).toEqual([100]);
    expect(taskkillCalls).toHaveLength(0);
  });
});

describe("waitForServer", () => {
  function clock(): {
    now: () => number;
    sleep: (ms: number) => Promise<void>;
  } {
    let current = 0;

    return {
      now: () => current,
      sleep: async (ms: number) => {
        current += ms;
      },
    };
  }

  test("resolves as soon as the server answers", async () => {
    const time = clock();
    let calls = 0;

    const probe: ServerProbe = async () => {
      calls += 1;
      return { reachable: true, status: 200 };
    };

    await waitForServer(probe, 30_000, time.now, time.sleep);

    expect(calls).toBe(1);
  });

  test("accepts a 404 because vite serves index later", async () => {
    const time = clock();

    const probe: ServerProbe = async () => ({ reachable: true, status: 404 });

    await expect(
      waitForServer(probe, 30_000, time.now, time.sleep),
    ).resolves.toBeUndefined();
  });

  test("keeps polling while the connection fails", async () => {
    const time = clock();
    let calls = 0;

    const probe: ServerProbe = async () => {
      calls += 1;
      if (calls < 3) throw new Error("connection refused");
      return { reachable: true, status: 200 };
    };

    await waitForServer(probe, 30_000, time.now, time.sleep);

    expect(calls).toBe(3);
  });

  test("keeps polling while the status is not ready", async () => {
    const time = clock();
    let calls = 0;

    const probe: ServerProbe = async () => {
      calls += 1;
      return { reachable: true, status: calls < 2 ? 503 : 200 };
    };

    await waitForServer(probe, 30_000, time.now, time.sleep);

    expect(calls).toBe(2);
  });

  test("gives up after the timeout", async () => {
    const time = clock();

    const probe: ServerProbe = async () => {
      throw new Error("connection refused");
    };

    await expect(
      waitForServer(probe, 1000, time.now, time.sleep),
    ).rejects.toThrow("did not respond within 1s");
  });

  test("names the url it waited on", async () => {
    const time = clock();
    const probe: ServerProbe = async () => {
      throw new Error("nope");
    };

    await expect(
      waitForServer(probe, 500, time.now, time.sleep),
    ).rejects.toThrow("http://127.0.0.1:5173");
  });
});

describe("createServerProbe", () => {
  test("reports a reachable server with its status", async () => {
    const probe = createServerProbe(
      (async () =>
        new Response("", { status: 200 })) as unknown as typeof fetch,
    );

    expect(await probe()).toEqual({ reachable: true, status: 200 });
  });

  test("reports the status of a not found response", async () => {
    const probe = createServerProbe(
      (async () =>
        new Response("", { status: 404 })) as unknown as typeof fetch,
    );

    expect(await probe()).toEqual({ reachable: true, status: 404 });
  });
});
