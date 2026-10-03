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

Run `bun run build` after making changes, once lint and format are clean, and before committing. It is `tsc -b && vite build`, so it covers the type-check too — there is no separate type-check step to remember.

| Do               | Never                               |
| ---------------- | ----------------------------------- |
| `bun run format` | `bun run build:windows`             |
| `bun run lint`   | `bun run build:windows:dir`         |
| `bun run build`  | `vite build`, `tsc -b` on their own |

The order is format, then lint, then build, then commit. Fix what each step reports before moving to the next.

The `build:windows` scripts cross-compile a Windows installer through wine. They take minutes and exist to produce a distributable, not to validate a change, so they are never part of the verify loop. Only run one when the user asks for a release artifact.

## Never run the dev server

Do **not** run `bun run dev`, `bun run dev:web`, `scripts/dev.ts`, or start a Vite server on port 5173 for any reason. Do not run it "just to check" or in the background.

- **Ask the user to run it** instead, and say what to look for.
- A dev server started by an agent keeps holding port 5173 after the work is done, which makes the user's own `bun run dev` fail with `Port 5173 is already in use`, and the leftover process can block the Electron profile lock.
- Never kill a process on port 5173 without checking first — it is usually the user's own running app. Inspect it (`lsof -ti:5173`, then `ps -o pid,args -p <pid>`) and report what you find rather than killing it.

## Main-process changes need a restart

Vite HMR only reloads the renderer. Anything under `electron/` (main process, preload, `db.mjs`) is loaded once when Electron starts, so changes there have no effect until the app is fully restarted.

- A symptom of a stale main process is `No handler registered for 'notes:list'` (or any missing IPC channel) in the renderer console.
- Never suggest the user reload the renderer to pick up main-process changes; tell them to quit and re-run `bun run dev`.

## Never commit without asking

Do **not** run `git commit` when a task is finished. Leave the changes staged or unstaged and report what changed.

- Wait for the user to review the diff and explicitly say to commit.
- "Done", "that works" or a thumbs-up on the result is not approval to commit — only an explicit instruction to commit is.
- Never amend, revert or rewrite commits to tidy up unless asked.

## Generated code

- `src/components/ui/**` is vendored shadcn/ui code. Do not hand-edit it, and do not format or lint it (both Prettier and oxlint already ignore it via `.prettierignore` and `.oxlintrc.json`).
- To change a shadcn component, change its args/config or re-run the CLI via `bunx shadcn@latest`.
- When adding shadcn components, keep `rtl: true` in `components.json` so the CLI emits RTL-safe classes for `fa-IR`.
