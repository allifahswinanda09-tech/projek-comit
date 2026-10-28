# JadwalSiaga — Aplikasi Pengatur Jadwal dan Alarm (MVP 1.0)

Aplikasi web responsif dan **Progressive Web App (PWA)** lengkap untuk mengatur jadwal kuliah, sekolah, kerja, dan kegiatan lainnya yang dilengkapi alarm peringatan layar merah (*red alert*) dan suara sirine darurat dengan interaksi gestur geser ke atas (*swipe up to dismiss*).

Dibuat secara lengkap sesuai spesifikasi dokumen [PRD.md](PRD.md) dan panduan desain [DESIGN.md](DESIGN.md).

---

## 📱 Dukungan Progressive Web App (PWA) Penuh

JadwalSiaga telah dilengkapi dukungan PWA berstandar modern:

1. **Instalasi ke Perangkat (Installable PWA):**
   - **Banner Pemasangan Otomatis:** Menampilkan banner *"📲 Pasang JadwalSiaga"* saat dibuka di peramban yang mendukung (Chrome, Edge, Samsung Internet, Android).
   - **Tombol Pasang di Pengaturan:** Tersedia tombol langsung di menu Pengaturan untuk memasang aplikasi ke layar utama ponsel atau desktop.
   - **Pintasan Cepat Aplikasi (*App Shortcuts*):** Menekan lama ikon aplikasi di layar beranda akan memunculkan menu pintasan:
     - ➕ *Tambah Jadwal Baru*
     - 📅 *Lihat Kalender*
     - 🎵 *Ganti Suara Alarm*

2. **Dukungan Offline 100% (*Offline Ready*):**
   - Dilengkapi **Service Worker (`sw.js`)** dengan strategi *Stale-While-Revalidate* yang menyimpan seluruh aset antarmuka dan logika secara lokal.
   - Indikator otomatis saat perangkat offline: *"⚡ Mode Offline Aktif — Data & Alarm Tetap Bekerja Lokal"*.
   - Seluruh data jadwal, preferensi, dan audio kustom tersimpan secara permanen di database peramban pengguna (**IndexedDB**).

3. **Kompatibilitas Lintas Perangkat:**
   - **Android / Windows / macOS / Linux:** Tampilan *standalone* tanpa bilah alamat browser, persis seperti aplikasi native.
   - **iOS / Safari:** Mendukung `apple-mobile-web-app-capable`, `apple-touch-icon`, dan mode layar penuh saat ditambahkan ke *Home Screen*.

---

## ✨ Fitur-Fitur Spesifikasi Alarm (PRD Bagian 7)

### 1. 🚨 Layar Peringatan Merah (*Red Alert Screen*)
- Lapisan peringatan penuh (*full-screen overlay*) berlatar merah berdenyut (*pulsing red emergency alert*) dengan kontras teks yang memadai.
- Ikon segitiga peringatan (*warning triangle*) beranimasi memantul (*bouncing animation*).
- Judul kegiatan dan keterangan dinamis (misal: *“Jadwal dimulai dalam 10 menit.”*).
- Instruksi gestur: *“Geser ke atas untuk matikan alarm”*.

### 2. 👆 Gestur Geser ke Atas (*Swipe Up to Dismiss*) & Aksesibilitas
- Geser kartu alarm ke atas menggunakan sentuhan (di layar HP) atau tarikan mouse (di desktop) untuk menghentikan alarm.
- Tombol alternatif aksesibilitas **"Hentikan Alarm"** (untuk keyboard/pembaca layar) dengan *shortcut* tombol **Spasi** / **Esc** / **Enter**.
- Tombol **"⏱️ Tunda 5 Mnt (Snooze)"** untuk menunda alarm sementara.
- **Pencegahan Pengulangan:** Alarm yang sudah dihentikan tidak akan berbunyi berulang untuk jadwal yang sama (PRD Bagian 8).

### 3. 🔊 Fitur Pengganti Suara Alarm (PRD Bagian 7 Poin 5)
Pengguna dapat memilih dan mengganti suara alarm dengan mudah:
- **Modal Interaktif Pemilih Suara:** Akses cepat melalui tombol `🎵 [Nama Suara]` di header.
- **Pratinjau Langsung (`▶` / `⏹`):** Dengarkan contoh suara sebelum diterapkan.
- **5 Suara Bawaan:**
  - 🚨 Sirine Ayun (*Wail Siren*)
  - 🚑 Dua Nada (*Hi-Lo European*)
  - ⏰ Alarm Digital Beep
  - 🔔 Melodi Lonceng (*Chime*)
  - 📢 Klaxon / Buzzer Tegas
- **Unggah Audio Sendiri (*Custom Sound Upload*):** Unggah file MP3, WAV, atau OGG yang tersimpan di IndexedDB.
- **Pengaturan Suara Per Jadwal:** Setiap jadwal dapat memiliki suara yang berbeda atau mengikuti bawaan.

### 4. 🔕 Opsi Pengaktifan Suara saat Tertahan Browser (PRD Bagian 7 Poin 4)
- Jika browser memblokir *autoplay* audio sebelum ada interaksi, peringatan visual merah tetap tampil dengan jelas.
- Layar alarm langsung menampilkan tombol mencolok: **"🔊 Suara Tertahan? Klik untuk Membunyikan"** sehingga pengguna dapat mengaktifkan suara sirine dengan satu ketukan.

---

## ⌚ Fitur Lainnya

- **WatchClockCard (DESIGN.md 3.2):** Jam real-time digital smartwatch, tanggal dinamis, progress ring detik melingkar, dan 4 pilihan variasi warna jam (*Oranye, Cyan, Magenta, Biru-Ungu*).
- **Jadwal Berulang (F-14):** Pengulangan *Harian*, *Hari Kerja (Senin–Jumat)*, dan *Mingguan*.
- **Deteksi Bentrok Jadwal (F-10):** Peringatan otomatis sebelum menyimpan jika waktu bertabrakan dengan kegiatan lain.
- **Pencarian Cepat & Filter:** Kotak pencarian live dan filter tab kategori.
- **Kalender Interaktif:** Navigasi bulan/tahun dan daftar jadwal berdasarkan tanggal yang dipilih.
- **Penyimpanan IndexedDB & Cadangan Data:** Ekspor JSON, Impor JSON, dan reset data aman.

---

## 🚀 Cara Menjalankan & Memasang PWA

Aplikasi berjalan langsung pada peramban modern tanpa build tools:

1. Buka berkas [**`index.html`**](index.html) menggunakan browser (Google Chrome, Microsoft Edge, Safari, Firefox) atau melalui local server:
   ```bash
   npx serve .
   ```
2. **Cara Memasang (Install PWA):**
   - **Di Komputer (Chrome / Edge):** Klik tombol **"Pasang"** pada banner yang muncul di bagian atas aplikasi, atau klik ikon instalasi di bilah alamat browser.
   - **Di HP Android (Chrome):** Klik tombol **"Pasang"** pada banner atau pilih menu titik tiga browser lalu tekan **"Tambahkan ke Layar Utama" / "Install App"**.
   - **Di iPhone / iPad (Safari):** Tekan tombol **Share (Bagikan)** di Safari, lalu pilih **"Add to Home Screen" (Tambahkan ke Layar Utama)**.

---

## 📁 Struktur Berkas

- [index.html](index.html) — Antarmuka web semantik, PWA install banner, formulir jadwal, dan Layar Alarm.
- [styles.css](styles.css) — Tema visual Watch UI Kit, banner PWA, dan animasi gestur swipe up.
- [app.js](app.js) — Logika instalasi PWA, penanganan offline/online, suara alarm, dan rendering UI.
- [alarm.js](alarm.js) — Deteksi alarm, gestur geser ke atas, dan tombol aktivasi audio (PRD 7 Poin 4).
- [sound.js](sound.js) — Generator audio Web Audio API (Wail, Hi-Lo, Beep, Chime, Buzzer, dan Kustom).
- [db.js](db.js) — Lapisan IndexedDB untuk `events`, `settings`, dan `custom_audio`.
- [manifest.json](manifest.json) — Web App Manifest lengkap dengan shortcuts, icons, dan tema standalone.
- [sw.js](sw.js) — Service Worker untuk offline cache (Stale-While-Revalidate) & background notifications.
- [icon.svg](icon.svg) — Ikon aplikasi vektor smartwatch & peringatan segitiga.
