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
    isLoading: false,
    error: null,
    isSaving: false,
    setIsSaving: () => {},
    create: notImplemented,
    remove: async () => false,
    update: async () => null,
    ...overrides,
  };
}
