self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
      self.clients.claim(),
      self.registration.unregister(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
