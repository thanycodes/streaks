import { toDateKey } from "./dates";
import { createApp } from "./ui";

const app = createApp(document.querySelector<HTMLElement>("#app")!, {
  storage: localStorage,
  today: () => toDateKey(new Date()),
});

// When the phone wakes the tab (possibly on a new day), refresh "today".
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") app.render();
});

// Offline support. Only in production builds; in dev it would cache stale modules.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
