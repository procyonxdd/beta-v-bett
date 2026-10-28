/* Scramjet v2 service worker. Only requests that belong to the proxy are handled;
   everything else (games, the site itself) goes straight through. */
importScripts("controller/controller.sw.js");
addEventListener("install", () => skipWaiting());
addEventListener("activate", (e) => e.waitUntil(clients.claim()));
addEventListener("fetch", (e) => {
  if ($scramjetController.shouldRoute(e)) e.respondWith($scramjetController.route(e));
});
