/**
 * ============================================================
 * YASSA — POPUP GAMBAR PENGUMUMAN (BISA LEBIH DARI SATU, DIKELOLA
 * LEWAT SHEET "Pengumuman_Popup", TAMPIL SATU-SATU SETELAH LOGIN)
 * ============================================================
 * File ini menangani popup gambar/info yang muncul setelah user
 * login. Daftar pengumumannya SEKARANG diambil dari server (sheet
 * "Pengumuman_Popup" di spreadsheet Akun -- lihat getPengumumanPopup()
 * di Code_Hub.gs), BUKAN lagi 1 gambar yang di-hardcode di sini.
 * Jadi buat nambah pengumuman baru, ADMIN CUKUP nambah baris baru di
 * sheet itu (Judul, URL_Gambar, centang Aktif) -- TIDAK perlu ubah
 * file ini lagi.
 *
 * ATURAN TAMPIL:
 * - Tiap device nyimpen daftar ID pengumuman yang SUDAH pernah
 *   ditutup/dilihat (localStorage). Pengumuman yang ID-nya BELUM
 *   pernah dilihat akan tampil SATU PER SATU, urut dari yang paling
 *   lama dibuat -- begitu 1 ditutup, otomatis lanjut ke berikutnya
 *   kalau masih ada yang belum dilihat.
 * - Pengumuman yang sudah pernah dilihat TIDAK muncul otomatis lagi,
 *   tapi tetap bisa dibuka manual satu-satu lewat kartu "Info" di
 *   lonceng notifikasi (lihat renderNotifikasiModalHtml_ index.html),
 *   yang manggil window.tampilkanPengumumanById(id).
 *
 * CARA PAKAI (index.html):
 * 1. Simpan file ini di folder yang sama dengan index.html, sudah
 *    ada <script src="welcome-popup.js"></script> sebelum </body>.
 * 2. Setelah login sukses / sesi lama direstore, panggil:
 *      callGASWithRetry_("getPengumumanPopup", [authToken])
 *        .then(function (list) { window.YASSA_setPengumumanList(list); });
 * 3. Buat isi kartu-kartu di lonceng notifikasi, panggil
 *    window.YASSA_getPengumumanList() buat ambil datanya, dan render
 *    tiap item dengan onclick="window.tampilkanPengumumanById('ID')".
 * ============================================================
 */
(function () {
  // Key penanda "daftar ID pengumuman yang sudah pernah ditutup" di
  // localStorage device ini. Isinya JSON array of string, misal:
  // ["1","2","row7"].
  var STORAGE_KEY_SUDAH_DILIHAT = 'yassa-welcome-popup-shown-ids';

  // 🕰️ Kompatibilitas mundur: key lama (boolean tunggal) dari versi
  // sebelum ada banyak pengumuman. Kalau ketemu isinya "1" (artinya user
  // ini sudah pernah nutup popup versi lama), jangan tiba-tiba dibanjiri
  // semua pengumuman lama sekaligus begitu fitur ini pertama kali aktif
  // -- baris getSudahDilihat() di bawah otomatis nangani migrasinya.
  var STORAGE_KEY_LAMA = 'yassa-welcome-popup-shown';

  function getSudahDilihat() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_SUDAH_DILIHAT);
      if (raw) return JSON.parse(raw) || [];
    } catch (e) {}
    return [];
  }

  function tandaiSudahDilihat(id) {
    var list = getSudahDilihat();
    if (list.indexOf(String(id)) === -1) list.push(String(id));
    try { localStorage.setItem(STORAGE_KEY_SUDAH_DILIHAT, JSON.stringify(list)); } catch (e) {}
  }

  // Cache daftar pengumuman terakhir yang diambil dari server (dipakai
  // ulang buat bangun kartu-kartu di lonceng notifikasi tanpa perlu
  // nembak server lagi).
  var daftarPengumumanCache = [];

  // Antrean pengumuman yang BELUM pernah dilihat & lagi nunggu ditampilkan
  // satu-satu.
  var antrean = [];

  function tampilkanOverlay(urlGambar, onTutup) {
    // Jangan dobel kalau overlay-nya udah kebuka.
    if (document.getElementById('yassa-welcome-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'yassa-welcome-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;' +
      'background:rgba(15,23,42,0.75);' +
      'display:flex;align-items:center;justify-content:center;' +
      'padding:20px;overflow-y:auto;box-sizing:border-box;';

    overlay.innerHTML =
      '<div style="position:relative;max-width:420px;width:100%;margin:auto;">' +
        '<img src="' + urlGambar + '" alt="Info" style="' +
          'display:block;width:100%;height:auto;' +
          'max-height:85vh;object-fit:contain;' +
          'border-radius:16px;' +
          'box-shadow:0 10px 30px rgba(0,0,0,0.35);" />' +
        '<button id="yassa-welcome-close" aria-label="Tutup" style="' +
          'position:absolute;top:10px;right:10px;' +
          'width:34px;height:34px;border-radius:9999px;' +
          'background:rgba(15,23,42,0.65);color:#ffffff;border:none;' +
          'font-size:20px;font-weight:700;line-height:1;' +
          'cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.35);' +
          'display:flex;align-items:center;justify-content:center;">' +
          '&times;' +
        '</button>' +
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('yassa-welcome-close').addEventListener('click', function () {
      overlay.remove();
      if (typeof onTutup === 'function') onTutup();
    });
  }

  // Tampilkan 1 pengumuman berikutnya dari antrean (kalau ada). Dipanggil
  // pertama kali begitu antrean diisi, dan dipanggil lagi tiap popup
  // ditutup supaya lanjut ke pengumuman berikutnya yang belum dilihat.
  function tampilkanBerikutnyaDariAntrean() {
    if (!antrean.length) return;
    var item = antrean.shift();
    tampilkanOverlay(item.urlGambar, function () {
      tandaiSudahDilihat(item.id);
      tampilkanBerikutnyaDariAntrean();
    });
  }

  // 🔑 Dipanggil dari index.html SETELAH login/sesi berhasil, dikasih
  // hasil getPengumumanPopup(token) dari server (array of {id, judul,
  // urlGambar, tanggal}, sudah terurut lama->baru). Yang ID-nya BELUM
  // pernah dilihat device ini dimasukkan ke antrean & ditampilkan
  // satu-satu.
  window.YASSA_setPengumumanList = function (list) {
    daftarPengumumanCache = Array.isArray(list) ? list : [];

    var sudahDilihat = getSudahDilihat();
    antrean = daftarPengumumanCache.filter(function (item) {
      return item && item.id && sudahDilihat.indexOf(String(item.id)) === -1;
    });

    // Kalau overlay kebetulan lagi kebuka (jarang, tapi jaga-jaga),
    // tunggu sampai kosong dulu baru mulai antrean baru.
    if (!document.getElementById('yassa-welcome-overlay')) {
      tampilkanBerikutnyaDariAntrean();
    }
  };

  // Dipakai index.html buat bangun kartu-kartu di lonceng notifikasi
  // (satu kartu per pengumuman yang lagi aktif, terlepas sudah pernah
  // dilihat atau belum -- biar user bisa buka-buka lagi riwayatnya).
  window.YASSA_getPengumumanList = function () {
    return daftarPengumumanCache.slice();
  };

  // 🔔 Buka MANUAL 1 pengumuman spesifik berdasarkan ID-nya, dipakai
  // kartu-kartu di lonceng notifikasi. Ikut ditandai "sudah dilihat"
  // (kalaupun sebelumnya belum) supaya gak nongol lagi otomatis abis ini.
  window.tampilkanPengumumanById = function (id) {
    var item = daftarPengumumanCache.find(function (p) { return String(p.id) === String(id); });
    if (!item) return;
    tampilkanOverlay(item.urlGambar, function () {
      tandaiSudahDilihat(item.id);
    });
  };
})();
