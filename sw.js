// Service Worker — Conhecendo o Social-Autonomismo
// Estratégia: stale-while-revalidate.
// Visita repetida carrega instantâneo do cache; uma cópia nova é
// buscada em paralelo e fica pronta para a PRÓXIMA visita.
// Isso evita o problema clássico de PWA (site atualizado, visitante
// preso na versão antiga pra sempre) sem exigir bump manual de versão.
//
// Este arquivo é o que a página já tenta registrar em '/sw.js' —
// ele só precisa existir na raiz do deploy para funcionar.

const CACHE_NAME = 'msa-conhecendo-v1';

const CORE_ASSETS = [
  '/',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nunca cachear chamadas a APIs externas dinâmicas (oráculo, etc).
  if (
    url.hostname.includes('generativelanguage.googleapis.com') ||
    url.hostname.includes('api.groq.com') ||
    url.hostname.includes('upstash.io') ||
    url.hostname.includes('giscus.app') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');

  if (isSameOrigin || isGoogleFonts) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
  }
});
