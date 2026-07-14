// 스파이크용 최소 Service Worker — 오프라인 동작 검증이 목적입니다.
// 실제 앱에서는 Workbox(vite-plugin-pwa)를 쓰세요.
const CACHE = 'spike-v2';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './zxing.js',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './test-qr-book.png', './test-qr-student.png', './test-isbn.png',
  './register.html', './register.manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// cache-first — 비행기 모드에서도 열려야 검증이 됩니다
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then(hit => hit || fetch(e.request))
  );
});
