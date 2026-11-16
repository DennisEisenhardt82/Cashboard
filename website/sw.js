// Service Worker: macht die App installierbar und lädt die Oberfläche auch bei schlechtem Netz.
// Daten (Supabase) werden NIE zwischengespeichert – die kommen immer frisch aus der Datenbank.
const CACHE = "cashboard-v7";
const SHELL = ["./", "index.html", "styles.css", "app.js", "config.js", 
  "manifest.webmanifest", "img/traumfaenger.webp", "img/hintergrund.webp", "img/hintergrund-klein.webp", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Netzwerk zuerst (immer aktuellste Version), bei fehlendem Netz aus dem Cache
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html")))
  );
});
