/** What the web app can ask of the Mac shell (mac/src/main.rs). */
export interface DesktopBridge {
  hidePopover(): Promise<void>;
  autostartEnabled(): Promise<boolean>;
  setAutostart(enabled: boolean): Promise<void>;
}

/** Tauri injects this global into its webview; browsers and the phone never have it. */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function loadDesktopBridge(): Promise<DesktopBridge> {
  // Imported lazily so the phone/web build never runs Tauri code.
  const { invoke } = await import("@tauri-apps/api/core");
  return {
    hidePopover: () => invoke("hide_popover"),
    autostartEnabled: () => invoke<boolean>("autostart_enabled"),
    setAutostart: (enabled) => invoke("set_autostart", { enabled }),
  };
}

/** "Start at login" switch, shown only in the Mac app. Off until the user turns it on. */
export function createDesktopSettings(root: HTMLElement, bridge: Pick<DesktopBridge, "autostartEnabled" | "setAutostart">) {
  const heading = document.createElement("h2");
  heading.textContent = "Mac app";
  const label = document.createElement("label");
  label.className = "toggle";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.id = "autostart";
  box.disabled = true;
  label.append(box, " Start Streaks when I log in");
  const errorLine = document.createElement("p");
  errorLine.className = "error";
  errorLine.setAttribute("role", "alert");
  const hint = document.createElement("p");
  hint.className = "muted";
  hint.textContent = "Open or close Streaks from anywhere with ⌃⌥S (Control-Option-S).";
  root.replaceChildren(heading, label, hint, errorLine);

  const ready = bridge
    .autostartEnabled()
    .then((enabled) => (box.checked = enabled))
    .catch(() => (errorLine.textContent = "Couldn't read the login setting."))
    .finally(() => (box.disabled = false));

  box.addEventListener("change", async () => {
    const wanted = box.checked;
    errorLine.textContent = "";
    try {
      await bridge.setAutostart(wanted);
    } catch {
      box.checked = !wanted;
      errorLine.textContent = "Couldn't change the login setting.";
    }
  });

  return { ready };
}

/** Escape closes the popover, like a menu. The app stops the event when it used Escape itself. */
export function hideOnEscape(target: EventTarget, hide: () => void): () => void {
  const onKey = (event: Event) => {
    if ((event as KeyboardEvent).key === "Escape") hide();
  };
  target.addEventListener("keydown", onKey);
  return () => target.removeEventListener("keydown", onKey);
}
