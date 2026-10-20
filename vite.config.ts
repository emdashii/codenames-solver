import { defineConfig, type Plugin } from "vite";

/**
 * Emit dist/sw.js that precaches every built file, so the app works offline
 * after the first visit. The cache name changes whenever the worker or file list does.
 */
function offline(): Plugin {
  return {
    name: "offline-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = ["/", ...Object.keys(bundle).map((f) => `/${f}`), "/icon.svg", "/manifest.webmanifest"];
      const body = `const FILES = ${JSON.stringify(files)};
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  if (e.request.mode === "navigate") {
    // Network first, so a new deploy's HTML (and its new asset names) wins; cache when offline.
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/", { ignoreVary: true })),
    );
    return;
  }
  // Hashed assets never change, so cache first.
  e.respondWith(caches.match(e.request, { ignoreVary: true }).then((hit) => hit || fetch(e.request)));
});
`;
      const source = `const CACHE = "kcf-${Bun.hash(body).toString(36)}";
${body}`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  plugins: [offline()],
});
