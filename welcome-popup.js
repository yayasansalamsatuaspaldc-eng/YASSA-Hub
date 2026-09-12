/**
 * ============================================================
 * YASSA — POPUP GAMBAR PEMBUKA (TAMPIL SEKALI SAJA)
 * ============================================================
 * Popup ini muncul saat aplikasi pertama kali dibuka di sebuah
 * perangkat/browser, berisi 1 gambar + tombol X untuk menutup.
 * Setelah ditutup, statusnya disimpan di localStorage sehingga
 * TIDAK akan muncul lagi di pembukaan berikutnya (kecuali user
 * menghapus data browser, ganti browser, atau install ulang app).
 *
 * CARA PAKAI:
 * 1. Simpan file ini di folder yang sama dengan index_gopay.html
 * 2. Buka index_gopay.html, cari tag </body> paling akhir,
 *    tambahkan baris ini TEPAT SEBELUM </body>:
 *
 *      <script src="welcome-popup.js"></script>
 *
 * 3. Ganti URL_GAMBAR di bawah dengan gambar Anda (lihat
 *    penjelasan cara masukin gambar di bagian bawah file ini).
 * ============================================================
 */
(function () {
  // 🔧 GANTI BAGIAN INI dengan URL gambar Anda (link online, boleh ukuran
  // besar/belum dikompres — akan otomatis dikompres lewat proxy di bawah).
  // Kalau gambarnya file lokal (bukan link http), isi nama filenya saja,
  // misal 'banner.jpg' — otomatis TIDAK ikut dikompres (lihat fungsi
  // buatUrlKompres di bawah).
  var URL_GAMBAR_ASLI = 'https://lh3.googleusercontent.com/d/1z9nazdiOT5CymRhXOeA8qYBx3EV9hLzO';

  // Lebar maksimal & kualitas kompresi otomatis (boleh diubah)
  var LEBAR_MAKS = 800;
  var KUALITAS = 75;

  // 🗜️ Kompres otomatis pakai images.weserv.nl (proxy gratis, tanpa perlu
  // akun) -- cuma jalan kalau URL_GAMBAR_ASLI berupa link http/https yang
  // sudah bisa diakses publik (misal link Google Drive/GitHub, dst).
  function buatUrlKompres(url) {
    if (!/^https?:\/\//i.test(url)) return url; // file lokal, biarkan apa adanya
    var tanpaProtokol = url.replace(/^https?:\/\//i, '');
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(tanpaProtokol) +
      '&w=' + LEBAR_MAKS + '&q=' + KUALITAS + '&output=webp';
  }

  var URL_GAMBAR = buatUrlKompres(URL_GAMBAR_ASLI);

  // Key penanda "sudah pernah ditutup" di localStorage device ini
  var STORAGE_KEY = 'yassa-welcome-popup-shown';

  // Kalau sudah pernah ditutup sebelumnya, jangan tampilkan lagi
  if (localStorage.getItem(STORAGE_KEY)) return;

  function tampilkanPopup() {
    var overlay = document.createElement('div');
    overlay.id = 'yassa-welcome-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;' +
      'background:rgba(15,23,42,0.75);' +
      'display:flex;align-items:center;justify-content:center;' +
      'padding:20px;';

    overlay.innerHTML =
      '<div style="position:relative;max-width:420px;width:100%;">' +
        '<button id="yassa-welcome-close" aria-label="Tutup" style="' +
          'position:absolute;top:-14px;right:-14px;' +
          'width:36px;height:36px;border-radius:9999px;' +
          'background:#ffffff;color:#0f172a;border:none;' +
          'font-size:20px;font-weight:700;line-height:1;' +
          'cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.25);">' +
          '&times;' +
        '</button>' +
        '<img src="' + URL_GAMBAR + '" alt="Info" style="' +
          'width:100%;border-radius:16px;display:block;' +
          'box-shadow:0 10px 30px rgba(0,0,0,0.35);" />' +
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('yassa-welcome-close').addEventListener('click', function () {
      overlay.remove();
      localStorage.setItem(STORAGE_KEY, '1');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tampilkanPopup);
  } else {
    tampilkanPopup();
  }
})();
