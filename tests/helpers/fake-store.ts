import type { NotesStore } from "@/lib/notes-store";

export type FakeStore = NotesStore;

export function createFakeStore(
  overrides: Partial<NotesStore> = {},
): NotesStore {
  const notImplemented = async (): Promise<never> => {
    throw new Error("createFakeStore: override this method in the test");
  };

  return {
    notes: [],
    totalCount: 0,
    listScrollTop: { current: 0 },
    hasMore: false,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    isSaving: false,
    setIsSaving: () => {},
    loadMore: async () => {},
    create: notImplemented,
    remove: async () => false,
    update: async () => null,
    ...overrides,
  };
}
