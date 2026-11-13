# PRD: Streaks on the Mac, synced with the phone

> Extends `PRD.md`. Every rule there still applies unless this file changes it.
> Status: **approved** (2026-11-12).

## Problem

The web app works well on the phone, but on the Mac it lives in a browser tab you have to go
looking for. And each device keeps its own data, so a habit ticked on the phone doesn't show up
on the Mac. You end up with two half-true streaks.

## Solution

1. **A Mac menu bar app.** A flame icon in the menu bar opens the existing Streaks UI in a small
   popover. Built with Tauri, so it reuses the web code and its tests.
2. **Sync without accounts.** A small Cloudflare Worker keeps one copy of your data in the cloud.
   Devices are paired with a secret **sync code**: no username, no password, no email.
3. **The phone version is hosted on GitHub Pages**, so it gets HTTPS and can be installed and
   used offline.

## User stories

### Mac app
1. As a user, I can **click the flame icon in the menu bar** to open today's habits in a popover, and click anywhere else to close it.
2. As a user, I can **open and close the popover with a keyboard shortcut** from any app.
3. As a user, the app **stays out of my Dock** and can **start when I log in**.
4. As a user who relies on the keyboard or VoiceOver, I can **use every control without a mouse**, and each checkbox and day dot reads out what it means (e.g. "Read, done today").

### Sync
5. As a user, I can **turn on sync** on one device and get a sync code to copy.
6. As a user, I can **enter that code on another device**, and the habits from both devices are combined, with nothing lost.
7. As a user, **changes sync on their own** when the device is online. Changes made offline are kept and sent later.
8. As a user, when I **un-check a day or delete a habit**, that change reaches the other device too, and doesn't come back on the next sync.
9. As a user, I can **see the sync status** (synced, offline, or an error) so I know whether to trust what I'm looking at.
10. As a user, I can **turn sync off** on a device, and my data stays on that device.

### Hosting
11. As a user, I can **open the app at https://thanycodes.github.io/streaks/** on my phone, install it, and use it offline.

## Rules (the parts that need care)

- **Days are still local `YYYY-MM-DD` strings.** Sync never decides which day something happened on.
- **Data format v2.** v1 only records the days a habit was done. To sync un-checks and deletes,
  v2 records each change with the time it was made:
  - every day mark is "done" or "not done" plus when it was set
  - a deleted habit is kept as a hidden "deleted" marker (a *tombstone*) instead of disappearing
- **Merge rule: the newest change wins**, per habit and per day. Merging the same data twice, or in
  either order, gives the same result. That's what makes sync safe to retry.
- **Change times are only for ordering changes.** They're stored as numbers (milliseconds), are never
  shown, and are never used to work out a date. *(This needs a small exception in CLAUDE.md, which
  currently says never to store timestamps.)*
- **Upgrade from v1 is automatic and one-time.** The old `streaks:v1` data is kept as a backup.
- **Bad data from the server must never wipe local data.** If the reply is corrupt, keep the local
  copy and show an error status.
- **The sync code is the only key.** It's long and random (hard to guess), and anyone who has it can
  read and change the data. The server stores data under a hash of the code, not the code itself.
- Name rules (trimmed, not empty, no case-insensitive duplicates) apply to habits *created on this
  device*. If a merge produces two habits with the same name, they become one habit with the
  days from both.

## Out of scope

User accounts or passwords, sharing habits with other people, instant push updates (a few seconds'
delay is fine), a screen for resolving conflicts by hand, change history or undo, a desktop widget,
an iPhone app, and everything already out of scope in `PRD.md` (other than sync).

## Implementation decisions

- **Folders:** the web app stays at the root. `mac/` holds the Tauri shell, `worker/` the Cloudflare
  Worker. Logic shared by both lives in `src/`.
- **Merge and sync logic are pure functions** (`src/merge.ts`, and the decisions in `src/sync.ts`),
  written test-first like `streaks.ts`. The network calls stay thin and are tested with a fake server.
- **Worker:** TypeScript on Cloudflare's free tier, storing data in Workers KV. It merges what a device
  sends with what it has stored and returns the result, using the same `merge.ts`.
- **Hosting:** a GitHub Actions workflow builds the app and publishes it to GitHub Pages. Vite's
  `base` becomes `/streaks/`, and the service worker is checked to make sure it still works there.
- **New dependencies:** `@tauri-apps/cli` (Mac app) and `wrangler` (Worker deploys). Each gets its
  reason in the commit message that adds it.

## Delivery order

1. **Hosting** (small, independent, gets the phone onto HTTPS)
2. **Data v2 + merge** (pure logic, no network yet)
3. **Worker** (deployed and tested from the command line)
4. **Sync in the web app** (pairing, auto-sync, status)
5. **Mac app** (Tauri shell, menu bar popover, shortcut, login item, accessibility)

The Mac app comes last because, once sync works, the Mac shell is just a wrapper around the
already-working app.

## Success criteria

- A habit ticked on the phone shows up on the Mac within a minute, and the other way round.
- An un-check or delete on one device stays that way on the other after several syncs.
- Using either device offline for a day, then reconnecting, loses nothing.
- `npm test` passes and `npm run build` succeeds. Merge and upgrade rules are covered by unit tests.
- Each user story lands through a GitHub issue, as in v1.

## Decisions from review (2026-11-12)

1. **Keyboard shortcut:** ⌃⌥S (Control-Option-S).
2. **Duplicate names after a merge** (e.g. "Read" added on both devices while offline): merge them
   into one habit and combine their days.
3. **Encryption with the sync code:** not in this version. Keep the format ready for it.
4. **Start at login:** off until the user turns it on.
