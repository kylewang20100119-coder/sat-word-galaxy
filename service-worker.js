const CACHE_VERSION = "lexiverse-shell-20260718-sat-architect4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./words.js",
  "./wordbank.js",
  "./gre.js",
  "./lexical-senses.js",
  "./lexical-expansion.js",
  "./gre-expansion-2.js",
  "./confusables.js",
  "./progress-store.js",
  "./app.js",
  "./architect-readings.js",
  "./architect-passage-overrides.js",
  "./architect-reading-engine.js",
  "./answer-layout.js",
  "./group-study.js",
  "./confusable-study.js",
  "./offline-questions.js",
  "./generated-questions.js",
  "./review-readings.js",
  "./prep.js",
  "./section-nav.js",
  "./smart-route.js",
  "./progress-vault.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./icons/lexiverse-192.png",
  "./icons/lexiverse-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("lexiverse-shell-") && key !== CACHE_VERSION).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response?.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || (request.mode === "navigate" ? cache.match("./index.html") : undefined);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response?.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes("/media/")) return;
  const isCore = request.mode === "navigate" || ["script", "style", "document", "manifest"].includes(request.destination);
  event.respondWith(isCore ? networkFirst(request) : cacheFirst(request));
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
