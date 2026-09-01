/**
 * Service worker do app.
 *
 * Estratégia:
 *  - assets versionados do Next (/_next/static) e ícones: cache-first, são
 *    imutáveis;
 *  - navegações: network-first com fallback para a última leitura e, em
 *    último caso, para /offline;
 *  - nada de POST/PUT/PATCH/DELETE passa por cache: escrever exige conexão;
 *  - chamadas ao Supabase são cross-origin e nunca passam por este SW
 *    (o listener de fetch já ignora tudo que não é `self.location.origin`).
 *
 * Atualização agressiva: skipWaiting + clients.claim fazem o SW novo assumir
 * a página imediatamente, sem esperar todas as abas fecharem. Quem dispara o
 * reload da tela é o componente PwaUpdater (components/pwa/pwa-updater.tsx),
 * ao ouvir `controllerchange`.
 *
 * As páginas HTML são renderizadas com os dados do usuário logado. Elas ficam
 * num cache SEPARADO (ftv-pages), que é apagado quando a sessão muda ou o
 * usuário sai — é assim que se evita misturar dados entre contas no mesmo
 * aparelho. Ver README, "Decisões de arquitetura".
 */

const VERSION = "v3";
const STATIC_CACHE = `ftv-static-${VERSION}`;
const PAGES_CACHE = `ftv-pages-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)));
  // Assume a nova versão assim que instalar, sem esperar as abas antigas
  // fecharem — a Vercel publica seguido e o cache não pode travar o usuário
  // numa versão velha.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== PAGES_CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "CLEAR_PRIVATE_CACHE") {
    event.waitUntil(caches.delete(PAGES_CACHE));
  }
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Só GET de mesma origem entra em cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // O próprio service worker e as rotas de autenticação nunca são cacheados.
  if (url.pathname === "/sw.js" || url.pathname.startsWith("/auth")) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        } catch {
          const cached = await caches.match(request, { ignoreSearch: false });
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response("Você está offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })(),
    );
  }
});
