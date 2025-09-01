// גרסת קאש – עדכנו בכל שינוי קבצים
const CACHE = 'mvp-transit-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : null))
    )
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // Network falling back to cache (עדיף ל-MVP לקבל עדכונים בקלות)
  e.respondWith(
    fetch(request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => {
        if (request.method === 'GET' && request.url.startsWith(self.location.origin)) {
          c.put(request, copy);
        }
      });
      return resp;
    }).catch(() => caches.match(request))
  );
});
