const CACHE = 'calorie-v2';
const ASSETS = ['.', 'index.html', 'css/style.css', 'js/app.js', 'js/storage.js', 'js/api.js', 'js/camera.js', 'js/ui.js', 'js/history.js', 'js/advice.js', 'manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('api.deepseek.com')) return;
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
