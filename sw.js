/* Garantie Tresor Service Worker
   Zweck: App offline verfuegbar halten und auf iOS als installiert werten,
   damit die lokalen Daten nicht nach 7 Tagen geloescht werden.
   Strategie: fuer die Seite selbst NETZ ZUERST (frische Updates erreichen
   Nutzer sofort), Cache nur als Offline-Fallback. Nie das CDN cachen. */
const CACHE = 'gt-shell-v2';
const SHELL = ['./', './index.html'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // CDN etc. normal durchreichen

  const isDoc = req.mode === 'navigate' ||
                (req.destination === 'document') ||
                url.pathname.endsWith('/') ||
                url.pathname.endsWith('index.html');

  if (isDoc) {
    // Netz zuerst, Cache nur wenn offline
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Sonstige gleiche-Herkunft-Dateien: Cache zuerst, dann Netz
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => cached))
  );
});
