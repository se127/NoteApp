# Agent Rules

## Package manager

Use **bun** exclusively: `bun install`, `bun add`, `bun remove`, `bunx`. Never `npm`, `npx`, `yarn`, or `pnpm`. Never hand-edit `bun.lock`.

## Verify

Run `bun run build` (`tsc -b && vite build`, so it covers the type check) and `bun test --parallel` before you finish. The pre-commit hook runs neither.

Do not run `bun run lint` or `bun run format`. The husky hook runs lint-staged over staged files with `prettier --write` and `oxlint --fix --deny-warnings`, and it is stricter than the standalone commands. Use `bun run lint` / `bun run format:check` only to check the whole working tree.

## Never run the dev server

Do not run `bun run dev`, `bun run dev:web`, `scripts/dev.ts`, or anything else on port 5173 — not to "check" a change, not in the background. Ask the user to run it and tell them what to look for. A server you leave running holds port 5173 and blocks the user's own `bun run dev` plus the Electron profile lock.

Never kill whatever is on 5173. It is usually the user's app. Inspect it and report: on Windows `Get-NetTCPConnection -LocalPort 5173 -State Listen` then `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`; on Linux `lsof -ti:5173` then `ps -o pid,args -p <pid>`.

A change under `electron/` needs a full app restart — Vite HMR reloads the renderer only. Never suggest a renderer reload for a main-process change. A stale main process shows up as `No handler registered for 'notes:list'` in the renderer console.

## Never touch real user data

`%APPDATA%\NoteApp` on Windows is the packaged app's live database. Never read, edit, move, or delete it. Dev runs against `%APPDATA%\NoteApp-dev`, set by `scripts/dev.ts` through `NoteApp_USER_DATA`.

## Tests

- Always pass `--parallel`. Never run a bare `bun test`.
- Build every test database with `createTestDatabase()` from `tests/helpers/test-database.ts`. Never call `openDatabase` directly and never hand the helper a path — it is the only thing that creates a test `userData` directory, and it refuses any path inside a real one.
- Call `database.dispose()` in `afterEach`. Leftover `NoteApp-test-db-*` folders in the temp directory are expected: on Bun 1.4.2 a prepared statement keeps its SQLite file locked after `close()`.
- Load `electron/preload.cjs` through `loadPreload()` from `tests/helpers/load-preload.ts`. It is CommonJS, so `mock.module("electron")` cannot reach it — its `require("electron")` is cached and another suite's mock wins the race.
- Load `electron/main.mjs` through `loadMainProcess()` from `tests/helpers/main-process.ts`. It runs its whole body at import, and `mock.module` factories are evaluated once, so the helper re-points one module-level stub per test.
- Query by accessible role and Persian label, the way a user reaches the element. Build fake stores with `createFakeStore()` and mount with `renderWithProviders()` from `tests/helpers`.
- `tests/**` is type-checked by `bun run build` through `tsconfig.test.json`. Keep new test files in that project.

happy-dom gaps, each one a way to waste a round:

- Its `listbox` cannot open, so never click a Radix `Select` option. Drive the block type through `setBlockType(editor, BLOCK_TYPES.find(...))` and the font size through `editor.chain().focus().setFontSize(...).setLineHeight(...).run()`.
- It does not evaluate `::before`, so a DOM assertion cannot prove a CSS rule matches. Read the file and match the selector instead, as `tests/note-body-css.test.ts` does. Collapse whitespace first, or `prettier --write` wrapping a long selector across lines breaks the literal lookup.
- It does not implement `document.execCommand`. Stub it, assert which command was issued, restore it in a `finally`.
- Never compare two DOM elements with `toBe`. On failure Bun's serializer walks the whole happy-dom element graph and prints tens of thousands of lines, which reads as a hang. Compare a boolean or a primitive.
- The body toolbar's emoji button and the title's emoji picker share the label `انتخاب ایموجی`, so `getByRole` finds two. Scope with `within(...)`.

`bunfig.toml` and `tests/setup/preload.ts` are load-bearing: the happy-dom preload gives component tests a `document`, and the RTL import there must stay a dynamic import inside `afterEach` so it evaluates after happy-dom installs `document`. Commit them together with `tests/`.

After writing a timing or ordering test, mutate the constant it guards and confirm the suite goes red, then revert. A test that asserts synchronously stays green even with the debounce halved.

Measure before changing CSS. Read the computed DOM rather than guessing a padding, and ask the user to paste a bubble-menu screenshot if one looks wrong.

## Code conventions

- Shortcuts are declared once in `src/lib/shortcuts.ts`. The `window` handlers in `notes-page.tsx` and `note-editor.tsx` and the list in `shortcuts-dialog.tsx` all read from it, so the documented list cannot drift.
- `isShortcut` must match `event.code` as well as `event.key`. On a Persian layout the physical S key reports `"س"`, so a key-only match leaves Ctrl+S and Ctrl+N inert while autosave fires 800 ms later and looks like the shortcut worked.
- `isShortcut` takes the whole `Shortcut`, not a bare key, and compares `altKey`/`shiftKey` against the shortcut's own `alt`/`shift`. An absent field means the modifier must **not** be held. Windows reports AltGr as `ctrlKey: true` plus `altKey: true`, which is why a shortcut with no `alt` rejects it.
- Toolbar commands register a runner through `useToolbarCommand` in `src/lib/toolbar-commands.ts`; `NoteBodyEditor` listens on `window` in the capture phase and calls `runToolbarCommand`. The capture phase matters — ProseMirror's own keymap for Ctrl+Z/Ctrl+B would otherwise run first and undo twice. The stale-runner guard in `registerToolbarCommand` is load-bearing: without it, one note's cleanup deletes a newer registration.
- **Test the shortcut's own binding, not just the action.** A test that presses the combination but passes for the wrong reason is how a dead binding ships. Point the shortcut's `code` at a different key and confirm the test goes red. happy-dom's listbox cannot be _clicked_, but a Radix `Select` does render its content when `open` is set programmatically, so assert on `[data-slot='select-content']`.
- The title is a plain `contentEditable` div that must never hold formatting. Cancel at `beforeinput`, keyed off `inputType` — that value is identical on every layout, unlike `event.key`. **React's `onBeforeInput` prop never fires for the native `beforeinput` event** even though React 19 registers it in `registerTwoPhaseEvent`; attach a native listener from a `useEffect`. Cancelling there rather than on keydown is also what keeps the caret still: the browser performs no editing operation, so no `<b>` is inserted and the selection stays put.
- `unwrapForeignMarkup` strips every element on input with `node.replaceWith(...node.childNodes)`, which _moves_ the existing text nodes so a caret inside one survives. Rebuilding `innerHTML` would drop it.
- The title's emoji picker inserts with `document.execCommand("insertText", ...)`, never `insertHTML`. A span with a smaller font once made the emoji — and everything typed after it — render smaller, because Chromium carries a typing style at the caret.
- Adding a block type means adding it to `isStoredHtml` in `src/lib/note-body.ts`, or saved headings reload as escaped text.
- `created_at` and `updated_at` come back from SQLite as `"YYYY-MM-DD HH:MM:SS"` in UTC with no zone marker, so `parseSqliteTimestamp` in `src/lib/relative-time.ts` appends the `Z` before parsing. Drop it and every time silently shifts by the machine's offset.
- Never put `scrollbar-thin` back on a scroller. It sets `scrollbar-width`, and a computed `scrollbar-width` other than `auto` makes Chromium ignore every `::-webkit-scrollbar-*` rule, which silently brings back the arrow buttons at both ends. The size lives in the `--scrollbar-thin-size` token in `src/index.css` instead.
- oxlint runs `react(only-export-components)`, so a file cannot export both components and plain constants. `BLOCK_TYPES`, `setBlockType` and `isHeadingBlock` live in `src/lib/block-type.ts` for that reason; moving them back into `note-body-editor.tsx` fails the pre-commit hook.
- oxlint runs `react-hooks/exhaustive-deps` and its warning fails the commit under `--deny-warnings`. A `window` keydown effect calling a component-local handler trips it; wrap the handler in `useCallback` with its real dependencies and depend on it rather than listing its inputs by hand.
- `src/components/ui/**` is vendored shadcn/ui. Do not hand-edit it, and do not format or lint it. Change its args or config, or re-run the CLI via `bunx shadcn@latest`, and keep `rtl: true` in `components.json` so it emits RTL-safe classes.
- Never add comments to code. Use a self-documenting name or a well-named extracted helper. Existing comments in `electron/db.mjs`, `scripts/build.ts`, `vite.config.ts` and `electron-builder.yml` are not a licence to add more.

## Never commit without asking

Never run `git commit` when a task is finished. Leave the changes staged or unstaged and report what changed. "Done" or a thumbs-up is not approval to commit — only an explicit instruction to. Never amend, revert, or rewrite commits to tidy up unless asked.

## node_modules is not portable

Do not copy `node_modules` between Windows and Linux. `bun install` fetches a platform-specific Electron binary into `node_modules/electron/dist`, so a copy carries the wrong one and `bunx electron` fails with no window opening. The symptom is an absent `node_modules/electron/path.txt` or `dist/electron.exe`, after which `index.js` tries to download and throws "Electron failed to install correctly". Fix with `Remove-Item -Recurse -Force node_modules\electron` (or `rm -rf`) then `bun install`, or `bun node_modules\electron\install.js` directly.
