# note-app

An Electron desktop note-taking app. RTL-first (`fa-IR`), with shadcn/ui on
Tailwind CSS v4.

## Stack

- Electron 44 (main + preload in plain ESM, no bundler)
- React 19 + TypeScript + Vite 8, React Compiler enabled
- Tailwind CSS v4 with the `prettier-plugin-tailwindcss` class sorter
- shadcn/ui (`radix-nova`, `rtl: true`)

## Commands

Use [bun](https://bun.sh) — do not use npm, yarn or pnpm.

| Command           | What it does                                    |
| ----------------- | ----------------------------------------------- |
| `bun run dev`     | Starts Vite, then opens the app in Electron     |
| `bun run dev:web` | Renderer only, in a browser at `localhost:5173` |
| `bun run lint`    | oxlint                                          |
| `bun run format`  | Prettier, including the Tailwind class sort     |

## Layout

```
electron/main.mjs      Electron main process (window, menu, navigation guard)
electron/preload.mjs   contextBridge API exposed as window.noteApp
scripts/dev.ts         Dev orchestrator: Vite + Electron
src/components/ui/     Vendored shadcn components — never hand-edit
src/font/vazirmatn/    Self-hosted Vazirmatn (Farsi + digits, no Latin)
```

Fonts resolve per glyph: Vazirmatn for Arabic script, Inter for Latin,
`sans-serif` as the final fallback.

## Notes

- The renderer runs with `contextIsolation: true`, `nodeIntegration: false` and
  `sandbox: true`. Extend the preload bridge rather than enabling Node in the
  page.
- `src/components/ui/**` is excluded from Prettier and oxlint so shadcn
  updates never conflict with local formatting.
- Pre-commit runs Prettier and oxlint over staged files only. See
  `lint-staged.config.mjs`.
