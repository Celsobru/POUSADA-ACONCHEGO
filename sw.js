// Service Worker - Pousada Aconchego
// Estratégia: network-first com fallback para cache (offline)
const CACHE = 'aconchego-v6';
const FILES = [
  'index.html', 'login.html', 'cliente.html', 'admin.html',
  'css/style.css', 'css/admin.css',
  'js/main.js', 'js/site.js', 'js/admin.js', 'js/offline.js',
  'manifest.json'
];

// Install - pré-cacheia assets e ativa imediatamente
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // add() por arquivo: uma falha não quebra o install
    await Promise.all(FILES.map(f => c.add(f).catch(() => {})));
    await self.skipWaiting();
  })());
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
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;   // deixa CDNs/terceiros passarem
  // API sempre vai para a rede
  if (url.pathname.startsWith('/api/')) return;

  // HTML/JS/CSS: ignora o cache HTTP e busca sempre a versão nova
  // (sem isso, o app/PWA instalado no celular fica preso numa versão antiga)
  const fresh = req.mode === 'navigate' || ['document', 'script', 'style', 'worker'].includes(req.destination);

  e.respondWith(
    fetch(req, fresh ? { cache: 'reload' } : undefined)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
