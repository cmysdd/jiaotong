const CACHE = 'transport-quiz-2026-v3';
const FILES = ['./', './index.html', './styles.css', './quiz-core.js', './app.js', './data/questions.js', './assets/icon.svg', './manifest.webmanifest'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('transport-quiz-2026-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin || !event.request.url.startsWith(self.registration.scope)) return;
  const relative = new URL(event.request.url).pathname.slice(new URL(self.registration.scope).pathname.length);
  if (!FILES.includes(`./${relative}`) && relative !== '') return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const clone = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, clone))); }
    return response;
  }).catch(() => caches.match(event.request).then(response => response || caches.match('./index.html'))));
});
