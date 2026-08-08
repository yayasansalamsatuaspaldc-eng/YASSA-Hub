// Service worker sederhana untuk YASSA Hub.
// Hanya nge-cache "app shell" (index.html, manifest, ikon) supaya app tetap
// bisa kebuka meski koneksi lagi jelek. Konten di dalam iframe (Kotak & Donasi,
// Absensi, AWG, Penerima Manfaat) TETAP butuh internet karena itu app terpisah.

const CACHE_NAME = "yassa-hub-shell-v6";
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
      // cache: "reload" -> paksa fetch beneran (bukan dari HTTP cache
      // browser). Query param unik -> paksa tembus cache CDN GitHub Pages
      // (Fastly) juga, biar shell yang pertama kali disimpan gak basi.
      //
      // PENTING: cache.put() pakai Request ASLI (tanpa param busting)
      // sebagai key, biar nanti "./index.html" dkk tetap bisa dicocokkan
      // dari kode lain (mis. caches.match("./index.html") di fallback offline).
      return Promise.all(
        SHELL_FILES.map(function (url) {
          const original = new Request(url, { cache: "reload" });
          const busted = new URL(url, self.location.href);
          busted.searchParams.set("_swcb", Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
          const networkReq = new Request(busted.toString(), { cache: "no-store" });

          return fetch(networkReq)
            .then(function (res) {
              if (!res.ok) throw new Error("HTTP " + res.status + " utk " + url);
              return cache.put(original, res);
            })
            .catch(function (err) {
              console.error("[SW install] gagal cache shell file:", url, err);
              throw err; // tetep gagalin install biar gak nyimpen shell yg gak lengkap
            });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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
    // Bikin URL fetch punya query param unik tiap kali, KHUSUS buat request
    // yang beneran dikirim ke jaringan. Ini buat "menembus" cache CDN GitHub
    // Pages (Fastly) yang punya lapisan cache sendiri di luar kontrol browser
    // -- cache:"no-store" di atas cuma ngomong ke browser, gak ngomong ke CDN.
    // Dengan query param beda tiap request, CDN nganggep ini resource baru
    // dan wajib ambil dari origin (GitHub), bukan dari cache edge-nya.
    //
    // PENTING: cache key yang disimpan/dicocokkan ke Cache Storage tetap
    // pakai `event.request` yang ASLI (tanpa param busting), biar fallback
    // offline (caches.match) masih bisa nemuin versi yang udah tersimpan.
    const bustedUrl = new URL(event.request.url);
    bustedUrl.searchParams.set("_swcb", Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const networkRequest = new Request(bustedUrl.toString(), {
      method: event.request.method,
      headers: event.request.headers,
      mode: event.request.mode === "navigate" ? "same-origin" : event.request.mode,
      credentials: event.request.credentials,
      redirect: "follow",
      cache: "no-store",
    });

    event.respondWith(
      fetch(networkRequest)
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
