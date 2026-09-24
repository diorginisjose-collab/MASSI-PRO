const CACHE_NAME = "massi-pro-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes.filter((nome) => nome !== CACHE_NAME).map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Abrir a página (HTML): tenta internet primeiro; se estiver offline, usa o que tiver salvo.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          return resposta;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Resto (JS, CSS, imagens, JSON): usa o que já tem salvo na hora (mais rápido),
  // e por baixo dos panos já busca a versão nova pra da próxima vez.
  event.respondWith(
    caches.match(request).then((cacheada) => {
      const buscaNaRede = fetch(request)
        .then((resposta) => {
          if (resposta && resposta.status === 200) {
            const copia = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          }
          return resposta;
        })
        .catch(() => cacheada);
      return cacheada || buscaNaRede;
    })
  );
});
