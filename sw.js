// Service worker sederhana untuk YASSA Hub.
// Hanya nge-cache "app shell" (index.html, manifest, ikon) supaya app tetap
// bisa kebuka meski koneksi lagi jelek. Konten di dalam iframe (Kotak & Donasi,
// Absensi, AWG, Penerima Manfaat) TETAP butuh internet karena itu app terpisah.

const CACHE_NAME = "yassa-hub-shell-v5";
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
      // cache: "reload" -> paksa fetch beneran ke server pas nyimpen shell
      // pertama kali, jangan sampai kena HTTP cache browser/CDN yang bisa
      // nyimpen index.html versi lama tanpa disadari.
      const requests = SHELL_FILES.map(function (url) { return new Request(url, { cache: "reload" }); });
      return cache.addAll(requests);
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

  // NETWORK-FIRST khusus buat halaman HTML (index.html): selalu coba ambil
  // versi terbaru dulu dari server tiap dibuka, biar update Hub langsung
  // kepakai tanpa perlu clear cache manual. Baru fallback ke cache kalau
  // lagi offline/gagal fetch.
  const isHTMLRequest =
    event.request.mode === "navigate" ||
    (event.request.headers.get("accept") || "").includes("text/html");

  if (isHTMLRequest) {
    event.respondWith(
      // cache: "no-store" -> paksa lewat network beneran, gak boleh dijawab
      // dari HTTP cache browser/CDN (mis. Cache-Control: max-age dari hosting).
      // Tanpa ini, "network-first" di atas kertas doang -- browser bisa aja
      // tetep nyeplak jawaban lama dari cache HTTP walau kode ini manggil fetch().
      fetch(event.request, { cache: "no-store" })
        .then(function (response) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(function () {
          return caches.match(event.request).then(function (cached) {
            return cached || caches.match("./index.html");
          });
        })
    );
    return;
  }

  // CACHE-FIRST buat aset statis (manifest, ikon): jarang berubah, aman diambil cepat dari cache.
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
