# CLAUDE.md

Guidance for AI agents (and humans) working in this repo. Read `PRD.md` first: it is the
source of truth for scope. If a request conflicts with the PRD, flag it rather than guess.

**Current phase: Mac app.** Read `MAC-APP-CONTEXT.md` before doing anything. It holds the plan,
the open decisions and a working agreement: the user wants to be involved step by step, so
explain each step and stop at its checkpoints instead of building autonomously.

## Commands

- `npm run dev`: start the Vite dev server
- `npm test`: run Vitest once
- `npm run typecheck`: `tsc --noEmit`
- `npm run build`: typecheck + production build to `dist/`
- `npm run dev:phone`: dev server on the LAN, for testing on a phone
- `npm run preview:phone`: production build served on the LAN

Before every commit, run `npm test && npm run build`. Both must pass.

## Architecture

- `src/dates.ts`, `src/streaks.ts`: **pure** functions. No DOM, no `Date.now()` hidden
  inside. Callers pass in "today" so tests are deterministic.
- `src/store.ts`: state and operations, plus persistence through a `Storage`-like interface.
  Tests use an in-memory fake, never real `localStorage`.
- `src/ui.ts`, `src/main.ts`: DOM only. Keep logic out of here. If you're about to write
  an `if` about streaks in the UI, it belongs in `streaks.ts`.

The service worker is generated in `vite.config.ts` at build time. Don't hand-write
`public/sw.js`. It only registers in production builds, over HTTPS or localhost.

Dates are always local `YYYY-MM-DD` strings. Never store `Date` objects or ISO timestamps.

## Workflow

1. Each piece of work maps to a GitHub issue (one user story = one vertical slice).
2. **TDD:** write a failing test, make it pass, refactor. One behaviour at a time.
3. Commit small and often. Message format: `feat: <what> (#N)`, or `Closes #N` in the
   body on the commit that finishes the issue. Use `fix:`, `test:`, `docs:`, `chore:` as fits.
4. Don't add dependencies without a reason written in the commit message.

## Style

- TypeScript `strict`. No `any`. Prefer small named functions over clever one-liners.
- No comments that restate the code. Comment only the *why* of non-obvious rules.
