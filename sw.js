// Service Worker - Pousada Aconchego
// Estratégia: network-first com fallback para cache (offline)
const CACHE = 'aconchego-v4';
const FILES = [
  'index.html', 'login.html', 'cliente.html', 'admin.html',
  'css/style.css', 'css/admin.css',
  'js/main.js', 'js/site.js', 'js/admin.js', 'js/offline.js',
  'manifest.json'
];

// Install - pré-cacheia assets e ativa imediatamente
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

// Activate - remove caches antigos e assume os clientes
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch - network-first (sempre busca versão nova), cache como fallback offline
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // API sempre vai para a rede
  if (req.url.includes('/api/')) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
