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

## Packaging

| Command                     | What it does                                          |
| --------------------------- | ----------------------------------------------------- |
| `bun run build:windows`     | Windows NSIS installer `.exe` into `release/`         |
| `bun run build:windows:dir` | Unpacked `release/win-unpacked/`, no installer needed |

The artifact is a one-click installer: the recipient double-clicks it and it
installs per-user into `%LOCALAPPDATA%\Programs\Note App`, so there is no
administrator password prompt. It adds a desktop and Start menu shortcut and
registers an uninstaller under Apps & features. To let the user pick the install
directory, set `oneClick: false` in `electron-builder.yml` (NSIS only shows the
directory picker in the assisted installer).

Being NSIS-based, building it from Linux or macOS goes through
[wine](https://www.winehq.org/), and specifically the **32-bit** part of it.
NSIS installers are 32-bit executables, and electron-builder has to run the
generated installer under wine to produce the uninstaller — so an amd64-only
wine fails late in the build with `failed to load C:\windows\syswow64\ntdll.dll`.
On Debian and Ubuntu:

```
sudo dpkg --add-architecture i386
sudo apt update
sudo apt install wine32:i386
WINEARCH=win64 wineboot -u   # one-time prefix setup
```

The `portable` target skips the uninstaller and so needs only wine64; it is the
easier artifact to cross-compile. Building either target on Windows needs no
wine at all.

There is no code-signing certificate, so Windows SmartScreen shows a warning on
first run that the recipient has to dismiss via _More info_ → _Run anyway_.
A certificate removes that.

Config lives in `electron-builder.yml`. Output goes to `release/`, which is
gitignored. There is no app icon committed yet, so Windows shows the default
Electron icon; drop a `build/icon.ico` in to replace it.

## Layout

```
electron/main.mjs      Electron main process (window, menu, navigation guard)
electron/preload.mjs   contextBridge API exposed as window.noteApp
scripts/dev.ts         Dev orchestrator: Vite + Electron
scripts/build.ts       Packaging orchestrator: Vite + electron-builder
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
