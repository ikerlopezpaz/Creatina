// Guarda la app en el iPhone para que abra sin conexión.
const CACHE = "creatina-v7";
// Si la red tarda más que esto (poca cobertura), se abre la copia guardada al momento.
const NET_TIMEOUT_MS = 1500;
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Fuentes de Google: primero la copia guardada
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }

  // Archivos de la app: red si responde rápido (para recibir cambios);
  // si no hay conexión o va lenta, la copia guardada sin esperar.
  if (url.origin === self.location.origin) {
    const net = fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        return caches.open(CACHE).then(c => c.put(req, copy)).then(() => res, () => res);
      }
      return res;
    });
    // La descarga sigue en segundo plano aunque ya se haya mostrado la copia,
    // así la próxima vez que abras la app ya tendrá la versión nueva.
    event.waitUntil(net.catch(() => {}));

    const cached = () => caches.match(req, { ignoreSearch: true })
      .then(hit => hit || caches.match("index.html"));

    event.respondWith(new Promise(resolve => {
      let done = false;
      const finish = r => { if (!done && r) { done = true; resolve(r); } };
      const timer = setTimeout(() => cached().then(finish), NET_TIMEOUT_MS);
      net.then(res => { clearTimeout(timer); finish(res); })
        .catch(() => { clearTimeout(timer); cached().then(hit => finish(hit || Response.error())); });
    }));
  }
});
