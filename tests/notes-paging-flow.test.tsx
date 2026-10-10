import { afterEach, describe, expect, test } from "bun:test";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { Link } from "react-router";

import { NotesProvider } from "@/components/notes-provider";
import { useNotesStore } from "@/lib/notes-store";
import { renderWithProviders } from "./helpers/render";
import {
  createFakeNotesBridge,
  installNotesBridge,
  makeNote,
  type FakeNotesBridge,
} from "./helpers/browser-bridge";

const PAGE = 15;
const TOTAL = 60;

function installSeededBridge(count = TOTAL): FakeNotesBridge {
  const bridge = createFakeNotesBridge(
    Array.from({ length: count }, (_, index) =>
      makeNote({ id: count - index, title: `یادداشت ${count - index}` }),
    ),
  );
  installNotesBridge(bridge);
  return bridge;
}

function Probe({
  onStore,
}: {
  onStore: (store: ReturnType<typeof useNotesStore>) => void;
}) {
  const store = useNotesStore();
  useEffect(() => {
    onStore(store);
  }, [onStore, store]);
  return <p>loaded {store.notes.length}</p>;
}

function renderProvider() {
  let latest: ReturnType<typeof useNotesStore> | null = null;
  const capture = (store: ReturnType<typeof useNotesStore>) => {
    latest = store;
  };

  const result = renderWithProviders(
    <NotesProvider>
      <Probe onStore={capture} />
    </NotesProvider>,
  );

  return { ...result, latest: () => latest };
}

describe("paging in the real store", () => {
  afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
  });

  test("loading more asks only for the rows past the end", async () => {
    const bridge = installSeededBridge();
    const probe = renderProvider();

    await waitFor(() => expect(probe.latest()?.notes).toHaveLength(PAGE));

    await act(async () => {
      await probe.latest()?.loadMore();
    });

    expect(bridge.requestedOffsets.at(-1)).toBe(PAGE);
    expect(bridge.requestedLimits.at(-1)).toBe(PAGE);
  });

  test("throws away a page that arrives after the list moved on", async () => {
    const bridge = installSeededBridge();
    const probe = renderProvider();

    await waitFor(() => expect(probe.latest()?.notes).toHaveLength(PAGE));

    const read = bridge.list;
    let resolvePage = () => {};
    let pageRequested = false;

    bridge.list = async (limit: number, offset = 0) => {
      if (!pageRequested) {
        pageRequested = true;
        await new Promise<void>((resolve) => {
          resolvePage = resolve;
        });
      }
      return read(limit, offset);
    };

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = probe.latest()?.loadMore() ?? Promise.resolve();
    });

    await waitFor(() => expect(pageRequested).toBe(true));

    act(() => {
      bridge.emitChanged();
    });

    resolvePage();
    await act(async () => {
      await pending;
    });

    await waitFor(() => expect(probe.latest()?.isLoadingMore).toBe(false));

    expect(probe.latest()?.notes).toHaveLength(PAGE);
  });

  test("keeps every fetched row after a note is created", async () => {
    installSeededBridge();
    const probe = renderProvider();

    await waitFor(() => expect(probe.latest()?.notes).toHaveLength(PAGE));

    await act(async () => {
      await probe.latest()?.loadMore();
      await probe.latest()?.loadMore();
    });

    expect(probe.latest()?.notes).toHaveLength(PAGE * 3);

    await act(async () => {
      await probe.latest()?.create({ title: "تازه", body: "" });
    });

    expect(probe.latest()?.notes).toHaveLength(PAGE * 3);
    expect(probe.latest()?.totalCount).toBe(TOTAL + 1);
  });

  test("keeps every fetched row after a note is deleted", async () => {
    installSeededBridge();
    const probe = renderProvider();

    await waitFor(() => expect(probe.latest()?.notes).toHaveLength(PAGE));

    await act(async () => {
      await probe.latest()?.loadMore();
    });

    const doomed = probe.latest()?.notes.at(-1)?.id ?? 0;

    await act(async () => {
      await probe.latest()?.remove(doomed);
    });

    expect(probe.latest()?.notes).toHaveLength(PAGE * 2);
    expect(probe.latest()?.notes.some((note) => note.id === doomed)).toBe(
      false,
    );
  });

  test("shows no duplicated note after many load-more calls", async () => {
    installSeededBridge();
    const probe = renderProvider();

    await waitFor(() => expect(probe.latest()?.notes).toHaveLength(PAGE));

    for (let step = 0; step < 3; step += 1) {
      await act(async () => {
        await probe.latest()?.loadMore();
      });
    }

    const loaded = probe.latest()?.notes.map((note) => note.id) ?? [];

    expect(loaded).toHaveLength(PAGE * 4);
    expect(new Set(loaded).size).toBe(loaded.length);
  });
});

describe("the loaded list surviving navigation", () => {
  afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
  });

  function RoutedProbe() {
    const store = useNotesStore();

    return (
      <>
        <p>{`on list: ${store.notes.length}`}</p>
        <button type="button" onClick={() => void store.loadMore()}>
          load more
        </button>
        <Link to={`/notes/${store.notes[0]?.id ?? 1}/edit`}>edit</Link>
        <Link to="/">back to list</Link>
      </>
    );
  }

  function renderRouted() {
    return renderWithProviders(
      <NotesProvider>
        <RoutedProbe />
      </NotesProvider>,
    );
  }

  test("still holds every fetched row after leaving and coming back", async () => {
    installSeededBridge();
    renderRouted();

    await waitFor(() =>
      expect(screen.getByText(`on list: ${PAGE}`)).toBeDefined(),
    );

    await act(async () => {
      fireEvent.click(screen.getByText("load more"));
    });

    await waitFor(() =>
      expect(screen.getByText(`on list: ${PAGE * 2}`)).toBeDefined(),
    );

    await act(async () => {
      fireEvent.click(screen.getByText("edit"));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("back to list"));
    });

    expect(screen.getByText(`on list: ${PAGE * 2}`)).toBeDefined();
  });

  test("does not fetch again just because the page was revisited", async () => {
    const bridge = installSeededBridge();
    renderRouted();

    await waitFor(() =>
      expect(screen.getByText(`on list: ${PAGE}`)).toBeDefined(),
    );

    const readsSoFar = bridge.requestedOffsets.length;

    await act(async () => {
      fireEvent.click(screen.getByText("edit"));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("back to list"));
    });

    expect(bridge.requestedOffsets).toHaveLength(readsSoFar);
  });
});

describe("the table and the store together", () => {
  afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>)["NoteApp"];
  });

  test("the loaded count is what the table reports", async () => {
    installSeededBridge();
    const probe = renderProvider();

    await waitFor(() => expect(probe.latest()?.notes).toHaveLength(PAGE));

    expect(screen.getByText(`loaded ${PAGE}`).textContent).toBe(
      `loaded ${PAGE}`,
    );

    await act(async () => {
      await probe.latest()?.loadMore();
    });

    expect(screen.getByText(`loaded ${PAGE * 2}`)).toBeDefined();
  });
});
