// Hors ligne : l'app, le catalogue, le moteur de scan et les images déjà vues restent disponibles.
// Les images sont rangées selon le mode de la requête : une copie « opaque » (balise <img>) n'est jamais
// servie à une requête CORS (le scanner), sinon l'image casse.
const APP = 'app-v2', IMG = 'img-v2'
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => ![APP, IMG].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())))
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url)
  if (req.method !== 'GET') return
  const isImg = url.host === 'assets.tcgdex.net'
  const isStatic = url.host === 'cdn.jsdelivr.net' || url.host.endsWith('gstatic.com') || url.host === 'fonts.googleapis.com'
  if (isImg || isStatic) {
    e.respondWith(caches.open(isImg ? IMG : APP).then(async (c) => {
      const key = isImg && req.mode === 'cors' ? new Request(req.url + '#cors') : req
      const hit = await c.match(key)
      if (hit && !(req.mode === 'cors' && hit.type === 'opaque')) return hit
      const res = await fetch(req)
      if (res.ok || res.type === 'opaque') c.put(key, res.clone())
      return res
    }))
  } else if (url.origin === location.origin) {
    // L'app : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne.
    e.respondWith(fetch(req).then((r) => { if (r.ok) caches.open(APP).then((c) => c.put(req, r.clone())); return r }).catch(() => caches.match(req)))
  }
})
