// Service Worker: Netzwerk zuerst (so kommen Updates sofort an), bei fehlender Verbindung aus dem Cache.
// Jede erfolgreich geladene Datei der eigenen Seite wird dabei zwischengespeichert.
const CACHE = "essensplan-v1";
const GRUNDDATEIEN = [
    "./", "index.html", "styles.css", "manifest.webmanifest", "persist.js",
    "sql-wasm.js", "sql-wasm.wasm", "webApp.js",
    "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => Promise.all(GRUNDDATEIEN.map((u) => cache.add(u).catch(() => {}))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res && res.ok) {
                    const kopie = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, kopie));
                }
                return res;
            })
            .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
    );
});
