import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import type { ReactElement } from "react";

import type { NotesStore } from "@/lib/notes-store";
import { createFakeStore } from "./fake-store";
import { Providers } from "./providers";

export type RenderOptionsWithProviders = Omit<RenderOptions, "wrapper"> & {
  store?: NotesStore;
  route?: string;
  withTheme?: boolean;
};

export type RenderResultWithStore = RenderResult & { store: NotesStore };

export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptionsWithProviders = {},
): RenderResultWithStore {
  const store = options.store ?? createFakeStore();
  const route = options.route ?? "/";
  const withTheme = options.withTheme ?? true;

  const result = render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <Providers route={route} store={store} withTheme={withTheme}>
        {children}
      </Providers>
    ),
  });

  return Object.assign(result, { store });
}
