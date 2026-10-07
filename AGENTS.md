# Agent Rules

## Package manager

Use **bun** exclusively.

| Do              | Never           |
| --------------- | --------------- |
| `bun install`   | `npm install`   |
| `bun add <pkg>` | `npm install`   |
| `bun remove`    | `npm uninstall` |
| `bunx <pkg>`    | `npx <pkg>`     |

- Never run `npm`, `npx`, `yarn`, or `pnpm` — not for installing, running scripts, or one-off binaries.
- Run package scripts through bun: `bun run lint`, `bun run format`, `bun run format:check`.
- Use the exact versions in `bun.lock`; never hand-edit it.

## Build before commit

Run `bun run build` before committing. It is `tsc -b && vite build`, so it covers the type-check too — there is no separate type-check step to remember. The pre-commit hook does not run it, so nothing else will catch a type error.

Do **not** run `bun run format` or `bun run lint` first. The husky pre-commit hook runs lint-staged over the staged files, with `prettier --write` and `oxlint --fix --deny-warnings`. That hook is the authority on formatting and linting, and it is stricter than the standalone commands — `bun run lint` does not deny warnings, so a warning passes on its own but fails the commit.

Use `bun run lint` and `bun run format:check` only when you want to check the whole working tree rather than just the staged files.

| Do              | Never                                 |
| --------------- | ------------------------------------- |
| `bun run build` | `bun run build:windows`               |
|                 | `bun run build:windows:dir`           |
|                 | `vite build` or `tsc -b` on their own |

The `build:windows` scripts produce a Windows installer. They take minutes and exist to produce a distributable, not to validate a change, so they are never part of the verify loop. Only run one when the user asks for a release artifact. Off Windows they need wine with 32-bit support; on Windows they run natively.

## Never run the dev server

Do **not** run `bun run dev`, `bun run dev:web`, `scripts/dev.ts`, or start a Vite server on port 5173 for any reason. Do not run it "just to check" or in the background. The project may be developed on Windows as well as Linux, so platform-specific commands in these rules are labelled.

- **Ask the user to run it** instead, and say what to look for.
- A dev server started by an agent keeps holding port 5173 after the work is done, which makes the user's own `bun run dev` fail with `Port 5173 is already in use`, and the leftover process can block the Electron profile lock.
- Never kill a process on port 5173 without checking first — it is usually the user's own running app. Inspect it and report what you find rather than killing it. On Windows use `Get-NetTCPConnection -LocalPort 5173 -State Listen`, then `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"` for the command line. On Linux use `lsof -ti:5173`, then `ps -o pid,args -p <pid>`.

## Main-process changes need a restart

Vite HMR only reloads the renderer. Anything under `electron/` (main process, preload, `db.mjs`) is loaded once when Electron starts, so changes there have no effect until the app is fully restarted.

- A symptom of a stale main process is `No handler registered for 'notes:list'` (or any missing IPC channel) in the renderer console.
- Never suggest the user reload the renderer to pick up main-process changes; tell them to quit and re-run `bun run dev`.
- `bun run dev` itself is only a dev-server launcher, so tell the user to stop the previous run with ctrl+c first. Do not kill it for them.
- Never edit or delete the packaged app's data at `%APPDATA%\NoteApp`. That is the real user database. Dev runs against `%APPDATA%\NoteApp-dev`, set by `scripts/dev.ts` through `NoteApp_USER_DATA`, so the two are separate by design.

## Tests

`bun test` runs the whole suite: 476 tests over the database layer, the Electron main process, the preload bridge, the renderer, both `scripts/` files, and the body editor.

- `bunfig.toml` holds the happy-dom preload that gives the renderer tests a DOM. Without it every component test fails, so `bunfig.toml` must be committed together with `tests/`.
- `tests/setup/preload.ts` registers happy-dom and imports `@testing-library/react` with a **dynamic** import inside `afterEach`. A static import there is evaluated before happy-dom installs `document`, which silently breaks `screen` with a "global document has to be available" error. It also sets `RTL_SKIP_AUTO_CLEANUP` because RTL's own auto-cleanup calls `beforeAll` at the wrong time for Bun.
- Query elements by accessible role and Persian label, the way a user reaches them. `screen.getByRole("textbox", { name: "عنوان" })` survives a class rename; a hard-coded selector does not.
- Build fake stores with `createFakeStore()` from `tests/helpers/fake-store.ts` and drive the app through `renderWithProviders()` from `tests/helpers/render.tsx`, which mounts the same router, theme and tooltip providers as `main.tsx`.
- `tests/**` is type-checked by `bun run build` through `tsconfig.test.json`, so a type error in a test fails the build. Keep new test files inside that project.
- Always pass `--parallel`, whether running the whole suite or a single file. `bun test --parallel`, `bun test --parallel tests/note-body-editor.test.tsx`. Bun runs test files concurrently and is markedly faster; the per-file suites already isolate their own state, so it stays green. Never reach for a bare `bun test` without the flag.
- happy-dom does not evaluate `::before`, so a DOM assertion cannot prove a CSS rule matches. To guard a rule in `src/index.css`, read the file and match the selector, as `tests/note-body-css.test.ts` does. Collapse whitespace before matching, or the pre-commit `prettier --write` will wrap a long selector across lines and break a literal lookup.

### Tests get their own throwaway database

`bun test` runs against a dedicated SQLite database created per test, never against the dev or the packaged one.

- Build every test database with `createTestDatabase()` from `tests/helpers/test-database.ts`. Never call `openDatabase` directly, and never hand it a path. The helper is the only thing that creates a test `userData` directory, so it cannot be pointed at `%APPDATA%\NoteApp` by accident.
- It creates the directory with `mkdtempSync` under the system temp directory, named `NoteApp-test-db-*`, and refuses any path that resolves inside a real `userData` directory. `isRealUserDataPath` is that check, and `tests/db.test.ts` asserts it.
- A test database lives for one test only. Call `database.dispose()` in `afterEach`; it closes the connection and removes the directory on a best-effort basis.
- On Bun 1.4.2 a prepared statement keeps its SQLite file locked after `close()`, so the directory often survives until the OS reclaims it at process exit. Leftover `NoteApp-test-db-*` folders in the temp directory are expected, not a leak.
- `electron/db.mjs` is a module-level singleton, so tests share one connection and must run sequentially.

### Testing the Electron layers

`electron/preload.cjs` is CommonJS, so `mock.module("electron")` cannot reach it — its `require("electron")` is cached and another suite's mock wins the race. Load it with `loadPreload()` from `tests/helpers/load-preload.ts`, which evaluates the real file with an injected `require`.

`electron/main.mjs` runs its whole body at import, so load it through `loadMainProcess()` from `tests/helpers/main-process.ts` and append a unique `?case=N` to defeat the module cache. `mock.module` factories are evaluated once and cached too, so that helper keeps one module-level `active` stub and re-points it per test; a closure over a per-test stub would keep writing into the first one.

### Testing the scripts

`scripts/dev.ts` and `scripts/build.ts` guard their side effects behind `isDirectRun`, so importing them is safe and the pure logic can be tested. If you add work to either script, export it and keep it free of `spawn`, `process.exit` and console output; only the `isDirectRun` block may do those.

### Verify a test actually fails

A green suite proves nothing on its own. After writing a timing or ordering test, mutate the constant it guards — halve the debounce, flip a `DESC` to `ASC` — confirm the suite goes red, then revert. This caught an autosave test that asserted a flag synchronously and passed even with `SAVE_DELAY` cut to 50ms.

Measure before changing CSS. Guessing at a padding or a wrapper box costs more rounds than reading the computed DOM, and a bubble menu that "looks wrong" is often the wrong box entirely — ask the user to paste it, or add `console.log` and remove it again in the same change.

## The note body editor

`src/components/note-body-editor.tsx` holds a Tiptap editor with **one always-visible toolbar** above the body, not bubble menus. The toolbar order is: direction, block style, font size, the four marks, the two lists, alignment, text position, emoji.

- Heading levels are enabled through `heading: { levels: [2, 3, 4, 5, 6] }` in `StarterKit.configure`. There is deliberately no h1, because the note title already fills that role.
- The block style and font size controls are Radix `Select`s. Its `listbox` **cannot open under happy-dom**, so a test must never try to click an option. Drive the block type through `setBlockType(editor, BLOCK_TYPES.find(...))` and the font size through the `editor.chain().focus().setFontSize(...).setLineHeight(...).run()` chain.
- `BLOCK_TYPES`, `setBlockType` and `isHeadingBlock` live in `src/lib/block-type.ts`, not in the component. `oxlint --deny-warnings` rejects a file that exports both components and plain constants (`react(only-export-components)`), so moving them back into `note-body-editor.tsx` fails the pre-commit hook.
- Never compare two DOM elements with `toBe`. When it fails, Bun's diff serializer walks the whole happy-dom element graph and prints tens of thousands of lines that never finish, which reads as a hang. Compare a boolean (`document.activeElement === control`) or a primitive instead.
- `useSavedSelection` saves the selection on pointer-down and restores it in `SelectContent`'s `onCloseAutoFocus`, so focus returns to the editor with the caret back where it was. The restore must carry `editor.state.storedMarks` across, or a pending font size is wiped and the trigger falls back to 14px.
- Headings disable the font size, bold, and both list buttons, and their tooltips with them. `isHeadingBlock(editor)` is the shared check; `MarkAction.disablesOnHeading` opts a single mark in.
- `setFontSize` and `setLineHeight` are not chainable — each builds its own chain from `editor.state` and calls `.run()`. Chaining them after `setTextSelection` silently drops that selection.
- `.note-body .ProseMirror` sets `line-height: 2rem`, which an inline-level button inherits as a line box and pads with descender space. Any element wrapping a button inside the body must be `flex`, or a visible gap appears under it.
- `isStoredHtml` in `src/lib/note-body.ts` decides whether a stored body is markup or plain text. It matches `p` and `h1`–`h6`, so adding a block type means adding it here too, or saved headings reload as escaped text.
- The placeholder rule in `src/index.css` uses `:is(p, h2, h3, h4, h5, h6)`. Narrow it to `p` and the placeholder disappears as soon as an empty block becomes a heading.
- The toolbar paints `bg-black/5` in light mode and `dark:bg-muted/40` in dark mode. Do not swap it for `bg-muted`: `--muted` is `oklch(0.97)`, so a `ghost` button's own `hover:bg-muted` would be invisible against it. The vendored `button.tsx` hardcodes that hover, so equal-specificity Tailwind conflicts resolve by stylesheet order, not `className` order.

## Never commit without asking

Do **not** run `git commit` when a task is finished. Leave the changes staged or unstaged and report what changed.

- Wait for the user to review the diff and explicitly say to commit.
- "Done", "that works" or a thumbs-up on the result is not approval to commit — only an explicit instruction to commit is.
- Never amend, revert or rewrite commits to tidy up unless asked.

## No comments in code

Do not add comments to files you create or modify. Write code that explains itself through naming and structure; if something needs a comment to be understandable, it needs a better name or a smaller function.

| Do                           | Never                        |
| ---------------------------- | ---------------------------- |
| Pick a self-documenting name | Add `//` or `/* */` comments |
| Extract a well-named helper  | Explain a block in prose     |

Comments already in the repo (`electron/db.mjs` JSDoc, `scripts/build.ts` and `vite.config.ts`, the notes in `electron-builder.yml`) are not a licence to add more.

## node_modules is not portable

Do not copy `node_modules` between Windows and Linux. `bun install` fetches a platform-specific Electron binary into `node_modules/electron/dist`, and the copy carries the wrong one, so `bunx electron` fails with a missing or mismatched binary and no window opens.

- Symptom: `node_modules/electron/path.txt` or `node_modules/electron/dist/electron.exe` is absent. `node_modules/electron/index.js` then tries to download on first run and throws "Electron failed to install correctly".
- Fix: `Remove-Item -Recurse -Force node_modules\electron` (or `rm -rf` on Linux), then `bun install`. If that still skips it, run `bun node_modules\electron\install.js` directly.

## Generated code

- `src/components/ui/**` is vendored shadcn/ui code. Do not hand-edit it, and do not format or lint it (both Prettier and oxlint already ignore it via `.prettierignore` and `.oxlintrc.json`).
- To change a shadcn component, change its args/config or re-run the CLI via `bunx shadcn@latest`.
- When adding shadcn components, keep `rtl: true` in `components.json` so the CLI emits RTL-safe classes for `fa-IR`.
