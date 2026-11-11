# Streaks

A minimal habit tracker that runs entirely in your browser. Add habits, tick them off each
day, and watch your streaks grow. No account and no server. It works offline and can be
installed on your phone's home screen.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit + DOM tests
npm run build        # typecheck + production build in dist/
```

### On your phone (same Wi-Fi)

```bash
npm run dev:phone    # prints a Network URL like http://10.x.x.x:5173, open it on your phone
```

Offline mode and "Add to Home Screen" need HTTPS, so they only kick in once the app is
deployed (for example GitHub Pages or Netlify). Over plain LAN HTTP the app works but
won't cache itself.

## How it's built

| File | Role |
| --- | --- |
| `src/dates.ts` | Pure local-date helpers (`YYYY-MM-DD`, no time zones) |
| `src/streaks.ts` | Pure current/longest streak rules |
| `src/store.ts` | Add / toggle / delete + validated `localStorage` persistence |
| `src/ui.ts` | DOM rendering and events; no business logic |
| `vite.config.ts` | Generates the offline service worker at build time |

## How this project was made

Built end-to-end by Claude Opus 5.5 as an experiment in agentic workflow:

1. **`PRD.md`**: the problem, user stories, rules and non-goals, written first.
2. **`CLAUDE.md`**: conventions any agent working on the repo must follow.
3. **GitHub issues**: the PRD split into vertical slices (#1 to #6).
4. **TDD per slice**: failing test, then implementation, then a commit with `Closes #N`.

Read the commit log alongside the issues to follow the build step by step.
