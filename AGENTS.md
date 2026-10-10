# Agent Rules

## Package manager

Use **bun** exclusively: `bun install`, `bun add`, `bun remove`, `bunx`. Never `npm`, `npx`, `yarn`, or `pnpm`. Never hand-edit `bun.lock`.

## Verify

Run `bun run build` (`tsc -b && vite build`, so it covers the type check) and `bun test --parallel` before you finish. The pre-commit hook runs neither.

Do not run `bun run lint` or `bun run format`. The husky hook runs lint-staged over staged files with `prettier --write` and `oxlint --fix --deny-warnings`, and it is stricter than the standalone commands. Use `bun run lint` / `bun run format:check` only to check the whole working tree.

## Tests and docs travel with the change

Every change is an add, a remove, or both — editing existing code does both at once — and every one of them ends with a passing suite and an accurate `README.md` and this file. Two cases, same rule:

- **Added**: write the test before you commit. Mutate the value it guards to confirm it goes red, then revert. If it passed before the code existed, it is not testing the new code.
- **Removed**: delete the tests of what you removed, and check the ones that stay still mean something. A test left behind either fails forever or, worse, keeps passing against a stub and hides the removal.

Between the green suite and the commit, check whether `README.md` and this file are now wrong, and fix them in the same commit. `README.md` is Persian and describes user-visible behavior, so any change a user could notice belongs there — one bullet in `رفتار برنامه`, not a new section. This file documents the traps, not the feature list: add a rule only when the change creates a way to waste a round, and never restate what a test or the README already says. Both files are meant to stay short; growth is the bug.

## Never run the dev server

Do not run `bun run dev`, `bun run dev:web`, `scripts/dev.ts`, or anything else on port 5173 — not to "check" a change, not in the background. Ask the user to run it and tell them what to look for. A server you leave running holds port 5173 and blocks the user's own `bun run dev` plus the Electron profile lock.

Never kill whatever is on 5173. It is usually the user's app. Inspect it and report: on Windows `Get-NetTCPConnection -LocalPort 5173 -State Listen` then `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`; on Linux `lsof -ti:5173` then `ps -o pid,args -p <pid>`.

A change under `electron/` needs a full app restart — Vite HMR reloads the renderer only. Never suggest a renderer reload for a main-process change. A stale main process shows up as `No handler registered for 'notes:list'` in the renderer console.

## Never touch real user data

`%APPDATA%\NoteApp` on Windows is the packaged app's live database. Never read, edit, move, or delete it. Dev runs against `%APPDATA%\NoteApp-dev`, set by `scripts/dev.ts` through `NoteApp_USER_DATA`.

`NoteApp_USER_DATA` is also the only signal that reseeds the dev notes on startup (`replaceAllNotes` in `electron/db.mjs`, titles in `electron/dev-notes.mjs`). Do not key that off `VITE_DEV_SERVER_URL` or `app.isPackaged` alone: `bun run dev:web` plus a bare `bunx electron .` has a dev server and no override, so it would empty `%APPDATA%\NoteApp`.

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
- Every unit in `elapsedParts` comes from the one elapsed-milliseconds clock, including `ماه` and `سال` — `Math.floor(elapsed / (DAYS_IN_MONTH * DAY))`. Mixing in `date.diff(now, "month")` makes the same elapsed span render differently depending on which calendar month it lands in, because February is 28 days and the month diff counts boundaries rather than duration; `tests/lib-relative-time.test.ts` pins the month and year rows to the elapsed clock, and three of them go red if the calendar diff comes back.
- Elapsed under `JUST_NOW_BELOW` returns the bare `JUST_NOW` string, which is why `elapsedParts` returns a `justNow` discriminant rather than a `count`/`unit` pair. Without it a brand new note reads «۰ ثانیه ی پیش» and then counts _up_ from zero, which is backwards. Keep the `justNow` branch ahead of the seconds branch.
- The ezafe `ی` in relative time is per unit and decided by the user: ثانیه and دقیقه take it («۵ ثانیه ی پیش»), ساعت, روز, ماه and سال do not («۱ ساعت پیش»). `elapsedParts` returns an `ezafe` boolean per unit and `agoLabel` applies it, so a unit's flag is the single place to flip it. The ezafe belongs on the past side only — the future branch builds `${IN_PREFIX}...` directly because `در` governs its complement, and adding `EZAFE` there produces «در ۵ دقیقه ی». `tests/lib-relative-time.test.ts` covers all six flags and the future branch; flipping any one of them turns a test red.
- `formatPersianNumber` in `src/lib/persian-number.ts` wraps `Intl.NumberFormat("fa-IR")`, so the count in the notes heading groups from a thousand up («۱٬۰۰۰», separator U+066C) — asserting a bare «۱۰۰۰» passes for the wrong reason. `Intl` formats a negative as `-۱۲` with U+2212 and an LRM in front, so the negative branch formats `-value` and prepends an ASCII `-` itself; a test that compares against `Intl`'s own output for a negative will fail.
- Never put `scrollbar-thin` back on a scroller. It sets `scrollbar-width`, and a computed `scrollbar-width` other than `auto` makes Chromium ignore every `::-webkit-scrollbar-*` rule, which silently brings back the arrow buttons at both ends. The size lives in the `--scrollbar-thin-size` token in `src/index.css` instead.
- The sticky notes-table header only works because the page's scroller carries `[&>[data-slot=table-container]]:overflow-x-visible`. The vendored `Table` wraps the `<table>` in `overflow-x-auto`, and `overflow-x: auto` makes the wrapper a scroll container in **both** axes, so a sticky `<th>` binds to that wrapper instead of the page scroller, never sticks, and scrolls out of view with no visible cause. Neutralize it from the parent rather than editing `src/components/ui/**`.
- happy-dom has no layout, so `sticky`, margins and stacking are untestable in the DOM. Assert the class names (`tests/notes-table.test.tsx` checks `sticky top-0 bg-background`) and the element's ancestor chain instead, then ask the user to eyeball the scroll.
- An accent lives in four places that have to agree: `ACCENTS`/`ACCENT_LABELS` in `src/lib/theme.ts`, the `ACCENTS` list in `electron/main.mjs`, the `[data-accent="..."]` and `.dark[data-accent="..."]` blocks in `src/index.css`, and the pre-paint script in `index.html`. Miss the main-process list and the picker writes a colour the main process throws away, so it silently reverts on the next launch.
- The accent blocks must stay **after** `:root`/`.dark` and the dark one must be `.dark[data-accent=...]`, not a second `[data-accent=...]`. A bare attribute selector has the same specificity as `.dark`, so whichever comes last wins and the dark theme renders light accents.
- `theme.json` holds `theme` and `accent` together, so every write in `electron/main.mjs` goes through `writeStoredAppearance`, which merges over the file as it stands. Writing the whole object instead drops the other key.
- oxlint runs `react(only-export-components)`, so a file cannot export both components and plain constants. `BLOCK_TYPES`, `setBlockType` and `isHeadingBlock` live in `src/lib/block-type.ts` for that reason; moving them back into `note-body-editor.tsx` fails the pre-commit hook.
- A shortcut test that builds its `KeyboardEvent` from the `Shortcut` object it is testing passes even when the binding is dead: `key` still matches on its own. Press a **literal** key and `code` instead, then point the shortcut's `code` at a different key and confirm the test goes red. `tests/global-shortcuts.test.tsx` keeps one literal combo per shortcut for this reason.
- A `Ctrl+Alt` combo is not reliably deliverable on Windows — AltGr arrives as `ctrlKey` plus `altKey`, and several `Ctrl+Alt+<letter>` combos are claimed by the OS. Prefer `Ctrl+Shift` for anything that must work on a Persian layout.
- `combination` is rendered inside an RTL dialog, so a non-letter key like `/` reorders visually (`/ + ctrl + alt`). Keep combos to letters; the `kbd` also carries `dir="ltr"` as a backstop.
- A shortcut's `label` is the name the shortcuts dialog lists and `tooltipLabel` is what its button hover shows. They differ on purpose for the note actions menu — the dialog says «گزینه های یادداشت فعلی» while the hover says «گزینه ها» like every other row. Overwriting `label` to shorten the tooltip also renames the dialog entry.
- `SHORTCUT_GROUPS` order is the section order in the shortcuts dialog, and the groups split by where a shortcut works: «صفحه ی اصلی» holds only what the list page binds, «یادداشت» only what the editor binds. `tests/shortcuts-dialog.test.tsx` pins the heading order, so a reshuffle fails there.
- `NoteActionsMenu` is shared by the editor header and every table row. The `shortcut` prop is what keeps `Ctrl+Shift+M` on the current note only — pass it from `note-editor.tsx` and leave `notes-table.tsx` without it, or the row menus start reacting to a key that names no particular row.
- oxlint runs `react-hooks/exhaustive-deps` and its warning fails the commit under `--deny-warnings`. A `window` keydown effect calling a component-local handler trips it; wrap the handler in `useCallback` with its real dependencies and depend on it rather than listing its inputs by hand.
- `src/components/ui/**` is vendored shadcn/ui. Do not hand-edit it, and do not format or lint it. Change its args or config, or re-run the CLI via `bunx shadcn@latest`, and keep `rtl: true` in `components.json` so it emits RTL-safe classes.
- Never add comments to code. Use a self-documenting name or a well-named extracted helper. Existing comments in `electron/db.mjs`, `scripts/build.ts`, `vite.config.ts` and `electron-builder.yml` are not a licence to add more.

- A sort control's tooltip names the order the **click** produces, not the order currently on screen: while the list is newest first, `notes-table.tsx` says «مرتب سازی از قدیم به جدید», because that is what the click will do. Asserting the tooltip against the current direction passes for the wrong reason and hides a swapped conditional. That text changes with state, so it goes through `ShortcutTooltip`'s `tooltipText` override rather than the shortcut's own `label`, which the dialog needs to stay static.
- The sort direction lives in `notes-page.tsx`, not in `notes-table.tsx`, because the page owns the `window` keydown handler and cannot reach state the table holds privately. `notes-table.tsx` takes `direction` and `onToggleDirection` as props for the same reason.

## Persian spacing

Wherever Persian orthography requires a half-space (ZWNJ), write a regular space (U+0020) instead. Never output U+200C, and never glue the parts together. This covers every stem + attached-part boundary: the verb prefixes می/نمی, plural and comparative suffixes (ها، های، تر، ترین), attached endings (ام، ات، اش، مان، تان، شان، ای), derivational prefixes and suffixes, and compound words. Apply it by principle, not just to listed examples.

Exception: if the stem's last letter doesn't connect (ا د ذ ر ز ژ و), write it joined with no space (کارها، دانشجویان).

Examples: می شوند، نمی دانم، یادداشت ها، بزرگ تر، خانه ام، بی نهایت، کتاب خانه.

When editing existing text, replace any U+200C with a regular space.

## Never commit without asking

Never run `git commit` when a task is finished. Leave the changes staged or unstaged and report what changed. "Done" or a thumbs-up is not approval to commit — only an explicit instruction to. Never amend, revert, or rewrite commits to tidy up unless asked.

## node_modules is not portable

Do not copy `node_modules` between Windows and Linux. `bun install` fetches a platform-specific Electron binary into `node_modules/electron/dist`, so a copy carries the wrong one and `bunx electron` fails with no window opening. The symptom is an absent `node_modules/electron/path.txt` or `dist/electron.exe`, after which `index.js` tries to download and throws "Electron failed to install correctly". Fix with `Remove-Item -Recurse -Force node_modules\electron` (or `rm -rf`) then `bun install`, or `bun node_modules\electron\install.js` directly.
