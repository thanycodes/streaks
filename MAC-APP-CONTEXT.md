# Mac App: Context & Plan (handoff)

> **Start here in a new chat.** Everything we discussed and decided while planning the Mac
> version of Streaks. Last updated 2026-11-12.
>
> Kickoff prompt for the new chat:
> *"Read MAC-APP-CONTEXT.md, PRD.md and CLAUDE.md. We're starting the Mac app. Work with me
> step by step as described in the working agreement. Start with the open decisions."*

---

## 1. Where the project is today

| | |
|---|---|
| Location | `/Users/harish_thany/Developers/streaks` |
| GitHub | https://github.com/thanycodes/streaks (private) |
| Stack | Vite + TypeScript (strict), no framework, Vitest + jsdom |
| Status | Web app v1 **done**. 6 issues closed, 36 tests passing, user confirmed it looks and works right |
| Data | Browser `localStorage`, key `streaks:v1`, JSON array of `{ id, name, createdAt, done: ["YYYY-MM-DD", …] }` |
| Phone | Installable offline PWA (issue #6). `npm run dev:phone` serves it on the LAN (`http://<mac-ip>:5173`) |

Commit history = build history: scaffold → #1 dates → #2 streaks → #3 store → #4 UI → #6 phone/PWA → #5 README.

### Still pending from the web phase
- **Hosting not decided.** Offline + "Add to Home Screen" need HTTPS. Options: GitHub Pages
  with the repo made public (free), GitHub Pages with the repo kept private (needs GitHub Pro),
  or Netlify/Vercel (free, one-time sign-in). Nothing deployed yet.

---

## 2. How v1 was built (the workflow, for reference)

1. **PRD.md** written first: problem, user stories, rules, out of scope.
2. **CLAUDE.md**: conventions any agent must follow (pure logic vs. DOM, local date keys, commands, commit format).
3. **PRD → GitHub issues** via `gh`: one vertical slice each.
4. **TDD per slice**: write the failing test → implement → `npm test && npm run build` → commit `Closes #N` → push.
5. A request that arrived mid-build (phone use) became its **own issue (#6)** instead of being folded into another one.
6. Writing a test first caught a real bug: `crypto.randomUUID` is missing on plain-HTTP LAN pages.

In v1, Claude ran this loop **autonomously**. The Mac phase changes that (see §5).

---

## 3. The goal for this phase

A Mac version you can reach quickly from the desktop to track habits:
- a **desktop widget** (on the desktop or in Notification Center), ideally tap-to-check
- quick, accessible access (menu bar, keyboard shortcut, VoiceOver labels)
- phone use is **nice-to-have**, not required

### Facts about the environment (checked 2026-11-12)
- macOS **15.5 Sequoia**, Apple Silicon (arm64): desktop widgets and interactive (tap) widgets are supported
- **Swift 6.1** available, but **only Command Line Tools: no Xcode**. Widgets (WidgetKit) need full Xcode
- **No Rust** installed (needed for Tauri)
- Phone is a **Samsung Galaxy S26 (Android)**, not an iPhone

---

## 4. Options considered

| Option | What you get | Real desktop widget? | Reuses web code | Needs |
|---|---|---|---|---|
| **1. Safari "Add to Dock"** | Web app in its own window, offline | No | 100% | Nothing (can do today) |
| **2. Tauri menu bar app** | Flame icon in the menu bar → popover with the existing UI | No | ~100% (UI + 36 tests) | Install Rust; ~10 MB app |
| **3. Native SwiftUI + WidgetKit** | Menu bar app + real desktop widget with tap-to-check | **Yes** | Logic rewritten in Swift (~200 lines), tests ported | Install Xcode (free, large) |
| Electron | Same as Tauri | No | ~100% | ~150 MB app. **Rejected**: no advantage |

### Recommendation (revised for Android)
In the first round I recommended option 3 partly because the same Swift code could also run an
iPhone app. **With an Android phone that argument no longer holds.** What still stands:

- Only **option 3** gives a *real* macOS widget. If the widget is the point, it's the only path.
- If a **menu bar popover is good enough**, **option 2 (Tauri)** is the better deal: it keeps
  one codebase (web = phone + Mac), the same tests, and the same data format, with less new code.

So the first decision is: **must it be a true desktop widget, or is a menu bar popover enough?**

### Phone ↔ Mac data
The phone uses the web PWA, and the Mac app would keep its own storage, so the data is separate by default.
Options, cheapest first:
1. **Separate data** in v1 (simplest)
2. **Export/import JSON**: works if the Mac app keeps the **exact same JSON shape** as the web
   (`streaks:v1`, see §1). Make that a design rule either way so the door stays open.
3. **Small sync backend** (e.g. Supabase/Cloudflare): real sync, but adds accounts, which
   goes against the original PRD's "no accounts" non-goal. Only if it really matters.

(iCloud sync is off the table: Android can't use it.)

---

## 5. Working agreement for this phase: user in the loop

The user wants to be **part of every step** and learn how AI-assisted building works, not just
receive a finished app. Claude should:

1. **Explain before doing.** At each step, say what's about to happen, *why*, and which AI-workflow
   tool or technique is involved (PRD, CLAUDE.md, issues, TDD, plan mode, subagents, code review…).
2. **Stop at checkpoints** and wait for approval:
   - after the open decisions (§6) are made
   - after drafting `PRD-mac.md` (user reviews and edits)
   - after the issue breakdown (user reviews before the issues are created)
   - per slice: show the **failing test** → show the **implementation** → user OKs the **commit**
3. **Keep steps small** enough to follow; prefer showing a diff over describing it.
4. Give the user chances to **drive**: e.g. let them write a test case, phrase an issue, or
   pick between two implementations.
5. Point out Claude Code features worth trying along the way: plan mode, `/code-review`,
   `/simplify`, subagents for research, hooks (e.g. run tests before each commit).

---

## 6. Decisions (settled 2026-11-12)

1. **Menu bar popover via Tauri (option 2).** No true desktop widget.
2. **Rust install: OK.** Xcode isn't needed.
3. Widget content: n/a (no widget).
4. **Real phone ↔ Mac sync** via a Cloudflare Worker + secret sync code (no accounts). The user
   also wants to learn how the cloud side works, so explain the Worker/KV parts as we go. Needs a
   data format v2 with change times and tombstones, so un-checks and deletes sync.
5. **Hosting: GitHub Pages.** The repo is now public.

Work happens on branch `mac-app`. The spec is `PRD-mac.md`.

---

## 7. Draft build plan (adjust after the decisions)

**If option 3 (native Swift):**
- **Phase 0: risk spike (~15 min).** Prove a hello-world widget can read data shared with the main
  app (App Group) when signed with a *free* Apple ID. If it can't, revisit before writing real code.
- **Phase 1: `StreaksCore` Swift package.** Dates, streaks and store ported TDD-style, reusing the
  web test cases as the spec. Same rules as PRD.md (local `YYYY-MM-DD`, today-or-yesterday
  current streak, trimmed/unique names, corrupt data → empty list). Same JSON shape.
- **Phase 2: menu bar app** (`MenuBarExtra`): today's list, check off, add/delete, keyboard shortcut, VoiceOver labels.
- **Phase 3: widget.** Small = today's progress (e.g. 2/3); medium = habit list with tap-to-check (App Intents).
- **Phase 4: data** (export/import or sync) per decision 4.

**If option 2 (Tauri):**
- Phase 0: install Rust, wrap the existing Vite app in Tauri, confirm it runs.
- Phase 1: tray icon + popover window positioned under it, hide the Dock icon.
- Phase 2: global keyboard shortcut, launch at login.
- Phase 3: export/import (shared with the web version).

**Either way:** the code goes in a new `mac/` folder in this repo, the web app stays at the root,
`PRD-mac.md` gets written and reviewed first, and CLAUDE.md gains a section for the new code.
