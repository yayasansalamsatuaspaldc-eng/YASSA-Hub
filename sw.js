// Service worker sederhana untuk YASSA Hub.
// Hanya nge-cache "app shell" (index.html, manifest, ikon) supaya app tetap
// bisa kebuka meski koneksi lagi jelek. Konten di dalam iframe (Kotak & Donasi,
// Absensi, AWG, Penerima Manfaat) TETAP butuh internet karena itu app terpisah.

const CACHE_NAME = "yassa-hub-shell-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  // Cuma tangani request GET ke file shell sendiri (same-origin).
  // Request ke iframe app lain (domain beda) dibiarkan lewat network seperti biasa.
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return (
        cached ||
        fetch(event.request).then(function (response) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
          return response;
        }).catch(function () {
          return cached;
        })
      );
    })
  );
});
