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

## Never run the build

Do **not** run `bun run build`, `vite build`, or `tsc -b`. Builds are slow and are not needed to validate a change.

Verify work with the fast commands instead:

- `bun run lint` — oxlint
- `bun run format:check` — prettier, includes the Tailwind class sort check

If a type error is suspected, ask before running any type-check or build step.

## Never run the dev server

Do **not** run `bun run dev`, `bun run dev:web`, `scripts/dev.ts`, or start a Vite server on port 5173 for any reason. Do not run it "just to check" or in the background.

- **Ask the user to run it** instead, and say what to look for.
- A dev server started by an agent keeps holding port 5173 after the work is done, which makes the user's own `bun run dev` fail with `Port 5173 is already in use`, and the leftover process can block the Electron profile lock.
- Never kill a process on port 5173 without checking first — it is usually the user's own running app. Inspect it (`lsof -ti:5173`, then `ps -o pid,args -p <pid>`) and report what you find rather than killing it.

## Generated code

- `src/components/ui/**` is vendored shadcn/ui code. Do not hand-edit it, and do not format or lint it (both Prettier and oxlint already ignore it via `.prettierignore` and `.oxlintrc.json`).
- To change a shadcn component, change its args/config or re-run the CLI via `bunx shadcn@latest`.
- When adding shadcn components, keep `rtl: true` in `components.json` so the CLI emits RTL-safe classes for `fa-IR`.
