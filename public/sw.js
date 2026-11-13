/* WeddingOS check-in service worker (hand-written, see docs/DECISIONS.md).
   - cache-first for immutable /_next/static assets
   - network-first with cache fallback for the check-in shell (navigations under /checkin/)
   - Background Sync: asks open clients to flush their IndexedDB scan queue */
const SHELL = "wos-shell-v1";
const STATIC = "wos-static-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, STATIC].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { c.put(req, r.clone()); return r; })));
    return;
  }
  if (req.mode === "navigate" && url.pathname.startsWith("/checkin/")) {
    e.respondWith(
      fetch(req).then((r) => { const copy = r.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); return r; }).catch(() => caches.match(req).then((r) => r || new Response("Offline: buka halaman ini sekali saat online.", { status: 503 }))),
    );
  }
});

self.addEventListener("sync", (e) => {
  if (e.tag === "checkin-sync") {
    e.waitUntil(self.clients.matchAll({ includeUncontrolled: true }).then((cs) => cs.forEach((c) => c.postMessage("flush-checkin"))));
  }
});
