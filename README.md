# JadwalSiaga — Aplikasi Pengatur Jadwal dan Alarm (MVP 1.0)

Aplikasi web responsif / PWA untuk mengatur jadwal kuliah, sekolah, kerja, dan kegiatan lainnya yang dilengkapi alarm peringatan layar merah (*red alert*) dan suara sirine darurat dengan interaksi gestur geser ke atas (*swipe up to dismiss*).

Dibuat secara lengkap sesuai spesifikasi dokumen [PRD.md](PRD.md) dan panduan desain [DESIGN.md](DESIGN.md).

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
Pengguna dapat memilih dan mengganti suara alarm sesuai kebutuhan:
- **🚨 Sirine Ayun (*Wailing Siren*)** — Frekuensi naik-turun khas sirine darurat.
- **🚑 Dua Nada (*Hi-Lo European*)** — Bergantian dua nada tegas ala sirine ambulans Eropa.
- **⏰ Alarm Digital Beep** — Pulsa cepat elektronik bernada tinggi mirip jam beker.
- **🔔 Melodi Chime** — Arpeggio lonceng harmonis yang lembut namun jelas.
- **📢 Buzzer Klaxon** — Nada buzzer peringatan frekuensi rendah.
- **📁 Suara Kustom (*Upload Audio*)** — Pengguna dapat mengunggah berkas audio sendiri (MP3, WAV, OGG) yang disimpan langsung secara lokal di IndexedDB.
- **Pengaturan Suara Per Jadwal:** Pengguna dapat menentukan suara khusus untuk masing-masing jadwal di formulir jadwal atau mengikuti suara bawaan.

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
- **PWA & Offline:** Dukungan Service Worker dan Web App Manifest.

---

## 🚀 Cara Menjalankan Aplikasi

Cukup buka berkas [**`index.html`**](index.html) di peramban web modern (Chrome, Edge, Firefox, Safari) atau melalui server statis:
```bash
npx serve .
```

---

## 📁 Struktur Berkas

- [index.html](index.html) — Kerangka antarmuka HTML semantik, formulir jadwal, dan Layar Alarm.
- [styles.css](styles.css) — Tema visual Watch UI Kit, variasi warna jam, dan animasi gestur swipe up.
- [app.js](app.js) — Logika antarmuka, penggantian suara alarm, upload audio kustom, dan sinkronisasi data.
- [alarm.js](alarm.js) — Deteksi alarm, gestur geser ke atas, dan tombol aktivasi audio (PRD 7 Poin 4).
- [sound.js](sound.js) — Generator audio Web Audio API (Wail, Hi-Lo, Beep, Chime, Buzzer, dan Kustom).
- [db.js](db.js) — Lapisan IndexedDB untuk `events`, `settings`, dan `custom_audio`.
- [sw.js](sw.js) & [manifest.json](manifest.json) — Progressive Web App (PWA).
- [icon.svg](icon.svg) — Ikon aplikasi.
