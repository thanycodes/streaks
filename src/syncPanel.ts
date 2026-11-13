import type { Syncer, SyncStatus } from "./sync";
import { formatSyncCode } from "./syncCode";

export type SyncControls = Pick<Syncer, "state" | "turnOn" | "join" | "turnOff" | "syncNow">;

const STATUS_TEXT: Record<SyncStatus, string> = {
  off: "",
  syncing: "Syncing…",
  synced: "✓ Synced",
  offline: "Offline. Changes will sync when you're back online.",
  error: "Couldn't reach the sync server. Will try again.",
};

function button(text: string, onClick: () => void, className = "secondary"): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

/** The "Sync" section under the habit list. DOM only: every decision lives in sync.ts. */
export function createSyncPanel(root: HTMLElement, sync: SyncControls) {
  let error = "";
  let copied = false;

  const heading = document.createElement("h2");
  heading.textContent = "Sync";
  const body = document.createElement("div");
  // Status changes (Syncing… → Synced) are announced without moving focus.
  const status = document.createElement("p");
  status.className = "sync-status";
  status.setAttribute("role", "status");
  root.replaceChildren(heading, body, status);

  function renderOff() {
    const intro = document.createElement("p");
    intro.className = "muted";
    intro.textContent = "Keep your phone and Mac in step. No account needed.";

    const input = document.createElement("input");
    input.id = "sync-code";
    input.placeholder = "XXXXX-XXXXX-XXXXX-XXXXX";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Sync code from your other device");
    const join = document.createElement("form");
    join.className = "add join";
    join.append(input, button("Join", () => join.requestSubmit(), "primary"));
    join.addEventListener("submit", (event) => {
      event.preventDefault();
      error = sync.join(input.value) ?? "";
      render();
    });

    const errorLine = document.createElement("p");
    errorLine.className = "error";
    errorLine.setAttribute("role", "alert");
    errorLine.textContent = error;

    const or = document.createElement("p");
    or.className = "muted";
    or.textContent = "Already using sync on another device? Enter its code:";

    body.replaceChildren(
      intro,
      button("Turn on sync", () => {
        error = "";
        sync.turnOn();
        render();
      }, "primary"),
      or,
      join,
      errorLine,
    );
  }

  function renderOn(code: string) {
    const label = document.createElement("p");
    label.className = "muted";
    label.textContent = "Your sync code. Enter it on your other device, and keep it private.";
    const codeText = document.createElement("code");
    codeText.className = "sync-code";
    codeText.textContent = formatSyncCode(code);

    const copy = button(copied ? "Copied" : "Copy", async () => {
      try {
        await navigator.clipboard.writeText(formatSyncCode(code));
        copied = true;
      } catch {
        // No clipboard over plain http: select the code so the user can copy it by hand.
        getSelection()?.selectAllChildren(codeText);
      }
      render();
    });
    copy.setAttribute("aria-label", "Copy sync code");

    const actions = document.createElement("div");
    actions.className = "sync-actions";
    actions.append(
      button("Sync now", () => void sync.syncNow()),
      button("Turn off sync", () => {
        copied = false;
        sync.turnOff();
        render();
      }),
    );

    const row = document.createElement("div");
    row.className = "sync-code-row";
    row.append(codeText, copy);
    body.replaceChildren(label, row, actions);
  }

  function render() {
    const state = sync.state();
    if (!state.available) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = "Sync isn't set up in this build.";
      body.replaceChildren(note);
      status.textContent = "";
      return;
    }
    if (state.code) renderOn(state.code);
    else renderOff();
    status.textContent = STATUS_TEXT[state.status];
  }

  /** Cheaper than render(): only the status line, so typing focus isn't disturbed. */
  function renderStatus() {
    status.textContent = STATUS_TEXT[sync.state().status];
  }

  render();
  return { render, renderStatus };
}
