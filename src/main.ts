import { toDateKey } from "./dates";
import { createDesktopSettings, hideOnEscape, isDesktop, loadDesktopBridge } from "./desktop";
import { createSyncer, httpTransport } from "./sync";
import { createSyncPanel } from "./syncPanel";
import { createApp } from "./ui";

const SYNC_EVERY_MS = 60_000;
const syncUrl = import.meta.env.VITE_SYNC_URL;

const app = createApp(document.querySelector<HTMLElement>("#app")!, {
  storage: localStorage,
  today: () => toDateKey(new Date()),
  onChange: () => syncer.scheduleSoon(),
});

const syncer = createSyncer({
  storage: localStorage,
  transport: syncUrl ? httpTransport(syncUrl) : null,
  getHabits: app.habits,
  setHabits: app.replaceHabits,
  onStatus: () => panel.renderStatus(),
});

const panelRoot = document.createElement("section");
panelRoot.className = "sync";
panelRoot.setAttribute("aria-labelledby", "sync-heading");
document.querySelector("#app")!.append(panelRoot);
const panel = createSyncPanel(panelRoot, syncer);
panelRoot.querySelector("h2")!.id = "sync-heading";

// When the phone wakes the tab (possibly on a new day), refresh "today" and pull changes.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    app.render();
    void syncer.syncNow();
  }
});
window.addEventListener("online", () => void syncer.syncNow());
setInterval(() => {
  if (document.visibilityState === "visible") void syncer.syncNow();
}, SYNC_EVERY_MS);
void syncer.syncNow();

if (isDesktop()) void setUpDesktop();

async function setUpDesktop() {
  const bridge = await loadDesktopBridge();
  const settingsRoot = document.createElement("section");
  settingsRoot.className = "desktop";
  settingsRoot.setAttribute("aria-label", "Mac app");
  document.querySelector("#app")!.append(settingsRoot);
  createDesktopSettings(settingsRoot, bridge);
  hideOnEscape(document, () => void bridge.hidePopover());
}

// Offline support for the phone. Only in production builds (in dev it would cache stale
// modules), and not in the Mac app, which ships its files inside the app bundle.
if (import.meta.env.PROD && !isDesktop() && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
