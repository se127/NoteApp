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
- Run package scripts through bun: `bun run dev`, `bun run lint`, `bun run format`.
- Use the exact versions in `bun.lock`; never hand-edit it.

## Never run the build

Do **not** run `bun run build`, `vite build`, or `tsc -b`. Builds are slow and are not needed to validate a change.

Verify work with the fast commands instead:

- `bun run lint` — oxlint
- `bun run format:check` — prettier, includes the Tailwind class sort check

If a type error is suspected, ask before running any type-check or build step.

## Generated code

- `src/components/ui/**` is vendored shadcn/ui code. Do not hand-edit it, and do not format or lint it (both Prettier and oxlint already ignore it via `.prettierignore` and `.oxlintrc.json`).
- To change a shadcn component, change its args/config or re-run the CLI via `bunx shadcn@latest`.
- When adding shadcn components, keep `rtl: true` in `components.json` so the CLI emits RTL-safe classes for `fa-IR`.
