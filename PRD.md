# PRD: Streaks, a minimal habit tracker

## Problem

People who want to build small daily habits (read, stretch, drink water) end up using
heavy apps with accounts, notifications, and subscriptions. They need something that
opens instantly, works offline, and answers one question: *"Did I keep it up?"*

## Solution

A single-page web app that runs entirely in the browser. You add habits, tick them off
for today, and see your current streak and best streak for each one. Data stays in
`localStorage`, so there's no backend and no sign-up.

## User stories

1. As a user, I can **add a habit** by typing a name and pressing Enter, so tracking starts right away.
2. As a user, I can **mark a habit done for today** (and undo it), so I can record progress.
3. As a user, I can **see my current streak** (consecutive days done, ending today or yesterday), so I know whether I'm on track.
4. As a user, I can **see my longest streak ever**, so I have a personal best to beat.
5. As a user, I can **see the last 7 days** for each habit as a row of dots, so I can spot gaps.
6. As a user, I can **delete a habit**, so old habits don't clutter the list.
7. As a user, **my data survives a page reload**, so I don't lose progress.

## Rules (the parts that need care)

- A "day" is the user's **local calendar date**, stored as `YYYY-MM-DD`. No timestamps, so time zones can't shift a day.
- **Current streak:** count back from today. If today isn't done yet, count back from yesterday instead, so a streak isn't "broken" just because the day isn't over. If neither today nor yesterday is done, the streak is 0.
- **Longest streak:** the longest run of consecutive dates in the habit's history.
- Habit names are trimmed. Empty names are rejected. Duplicate names (case-insensitive) are rejected.
- Corrupt or missing stored data falls back to an empty list. It must never crash the app.

## Out of scope (v1)

Accounts and sync, reminders and notifications, editing past days beyond the 7-day view,
weekly or "3x per week" goals, charts, and dark-mode toggles beyond following the OS setting.

> **Update (2026-11-12):** sync between devices (still without accounts) and a Mac menu bar app
> are now in scope. See `PRD-mac.md`.

## Implementation decisions

- **Stack:** Vite + TypeScript (strict), no UI framework. The app is small enough that the plain DOM is clearer.
- **Modules:**
  - `src/dates.ts`: pure date helpers (today, add days, format). No DOM.
  - `src/streaks.ts`: pure streak calculations. No DOM.
  - `src/store.ts`: habit state and operations, plus a `localStorage` adapter that can be swapped out.
  - `src/main.ts` + `src/ui.ts`: rendering and event wiring only.
- **Testing:** Vitest. The pure modules get full unit coverage written test-first. The store is tested with an in-memory storage fake.

## Success criteria

- All user stories work in the browser.
- `npm test` passes and `npm run build` succeeds with zero type errors.
- Each user story lands as its own commit that closes a GitHub issue.
