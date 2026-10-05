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
- Never edit or delete the packaged app's data at `%APPDATA%\note-app`. That is the real user database. Dev runs against `%APPDATA%\note-app-dev`, set by `scripts/dev.ts` through `NOTE_APP_USER_DATA`, so the two are separate by design.

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
