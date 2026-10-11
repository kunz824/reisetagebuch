// Service Worker Reisetagebuch (11.10.2026): App und Bibliotheken für
// den Offline-Betrieb unterwegs zwischenspeichern. Kartenkacheln, die
// einmal angesehen wurden, bleiben ebenfalls verfügbar.
const APP_CACHE = "reisetagebuch-app-v1";
const KACHEL_CACHE = "reisetagebuch-kacheln-v1";
const APP_DATEIEN = [
  "./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(APP_CACHE)
    .then(c => Promise.allSettled(APP_DATEIEN.map(u => c.add(u))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", ev => {
  ev.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => ![APP_CACHE, KACHEL_CACHE].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Eigene Dateien: zuerst Netz (damit Updates ankommen), sonst Cache
  if (url.origin === location.origin) {
    ev.respondWith(fetch(req).then(r => {
      const kopie = r.clone();
      caches.open(APP_CACHE).then(c => c.put(req, kopie));
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match("./index.html"))));
    return;
  }
  // Bibliotheken: Cache zuerst
  if (url.hostname === "cdnjs.cloudflare.com") {
    ev.respondWith(caches.match(req).then(r => r || fetch(req).then(n => {
      const kopie = n.clone();
      caches.open(APP_CACHE).then(c => c.put(req, kopie));
      return n;
    })));
    return;
  }
  // Kartenkacheln: Cache zuerst, sonst laden und merken
  if (url.hostname.endsWith("basemaps.cartocdn.com")) {
    ev.respondWith(caches.open(KACHEL_CACHE).then(c => c.match(req).then(r => r || fetch(req).then(n => {
      if (n.ok || n.type === "opaque") c.put(req, n.clone());
      return n;
    }))));
  }
  // Ortssuche (Nominatim) läuft immer über das Netz
});
