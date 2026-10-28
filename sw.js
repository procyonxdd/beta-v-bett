/* Only the Browse tab registers this worker. Anything that isn't a Scramjet
   request (games, media, the site itself) goes straight to the network, and
   any failure here falls back to a plain fetch so nothing else can break. */
importScripts("scram/scramjet.all.js");
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    try {
      await scramjet.loadConfig();
      if (scramjet.route(event)) return await scramjet.fetch(event);
    } catch (err) { /* fall through */ }
    return fetch(event.request);
  })());
});
