import { defineConfig, type Plugin } from "vitest/config";
import { readdirSync } from "node:fs";

/**
 * Emits `sw.js` with the exact list of built files, so the whole app is cached
 * on the first visit and opens with no signal afterwards.
 */
function serviceWorker(): Plugin {
  return {
    name: "streaks-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = ["./", ...Object.keys(bundle), ...readdirSync("public")].map((f) =>
        f === "./" ? f : `./${f}`,
      );
      const version = Date.now().toString(36);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `const CACHE = "streaks-${version}";
const FILES = ${JSON.stringify(files)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache first: the app is fully static, so it opens instantly even on gym Wi-Fi.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (hit) => hit || fetch(request).catch(() => caches.match("./")),
    ),
  );
});
`,
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [serviceWorker()],
  server: { host: process.env.HOST ? true : undefined },
  test: { globals: true, environment: "node" },
});
