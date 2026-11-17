// Hors ligne : l'app, le catalogue, le moteur de scan et les images déjà vues restent disponibles.
const APP = 'app-v1', IMG = 'img-v1'
self.addEventListener('install', (e) => { self.skipWaiting() })
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => ![APP, IMG].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())))
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  const isImg = url.host === 'assets.tcgdex.net'
  const isStatic = url.host === 'cdn.jsdelivr.net' || url.host.endsWith('gstatic.com') || url.host === 'fonts.googleapis.com'
  if (isImg || isStatic) {
    // Images et bibliothèques : cache d'abord.
    e.respondWith(caches.open(isImg ? IMG : APP).then(async (c) => (await c.match(e.request)) ?? fetch(e.request).then((r) => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r })))
  } else if (url.origin === location.origin) {
    // L'app : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne.
    e.respondWith(fetch(e.request).then((r) => { if (r.ok) caches.open(APP).then((c) => c.put(e.request, r.clone())); return r }).catch(() => caches.match(e.request)))
  }
})
