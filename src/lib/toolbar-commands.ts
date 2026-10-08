import { useEffect } from "react";

import {
  isShortcut,
  type ShortcutKeys,
  type ToolbarCommand,
  TOOLBAR_SHORTCUTS,
} from "@/lib/shortcuts";

const RUNNERS = new Map<ToolbarCommand, () => void>();

export function registerToolbarCommand(
  command: ToolbarCommand,
  run: () => void,
): () => void {
  RUNNERS.set(command, run);

  return () => {
    if (RUNNERS.get(command) === run) RUNNERS.delete(command);
  };
}

export function runToolbarCommand(command: ToolbarCommand): void {
  RUNNERS.get(command)?.();
}

export function findToolbarCommand(
  event: ShortcutKeys,
): ToolbarCommand | undefined {
  return TOOLBAR_SHORTCUTS.find(({ shortcut }) => isShortcut(event, shortcut))
    ?.command;
}

export function useToolbarCommand(
  command: ToolbarCommand,
  run: () => void,
): void {
  useEffect(() => registerToolbarCommand(command, run), [command, run]);
}
