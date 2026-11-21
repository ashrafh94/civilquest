// CivilQuest offline support.
// Change VERSION whenever you upload new game files, so phones pick up the update.
const VERSION = 'cq-v3';
const CORE = ['./', './index.html', './config.js', './app.js', './styles.css', './courses/air-quality.js', './privacy.html', './terms.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const LIBS = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    await Promise.all(LIBS.map(u => c.add(new Request(u, {mode:'cors'})).catch(()=>{})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache Firebase traffic (sign-in and saving results)
  if (/googleapis\.com$|firebaseio\.com$/.test(url.hostname) && !url.hostname.startsWith('fonts.')) return;

  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin) {
    // Game files: try the network first so updates arrive, fall back to the saved copy offline
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch (err) {
        return (await c.match(req, {ignoreSearch:true})) || (req.mode === 'navigate' ? c.match('./index.html') : Response.error());
      }
    })());
    return;
  }
  // Libraries and fonts: use the saved copy, fetch once if missing
  if (/gstatic\.com$|fonts\.googleapis\.com$/.test(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }
      catch (err) { return Response.error(); }
    })());
  }
});
