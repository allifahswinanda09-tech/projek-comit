# PRD — Aplikasi Pengatur Jadwal dan Alarm

**Nama sementara:** JadwalSiaga  
**Versi:** 1.0 — MVP  
**Platform:** Aplikasi web responsif / PWA  
**Tech stack:** HTML, CSS, JavaScript, IndexedDB

## 1. Ringkasan Produk

JadwalSiaga membantu pengguna mengatur jadwal kuliah, sekolah, kerja, dan kegiatan lainnya. Aplikasi menampilkan agenda berdasarkan waktu serta memberi alarm menjelang kegiatan.

Saat waktu pengingat tiba, aplikasi menampilkan layar peringatan merah dengan ikon segitiga warning dan memainkan suara sirine. Pengguna menghentikan alarm dengan menggeser layar peringatan ke atas, menyerupai gerakan membuka layar.

## 2. Tujuan Produk

- Membantu pengguna mencatat dan menemukan jadwal dengan cepat.
- Mengurangi kemungkinan terlambat atau melewatkan kegiatan.
- Memberikan pengingat yang mencolok dan mudah dihentikan.
- Menyimpan data jadwal secara lokal menggunakan IndexedDB.

## 3. Target Pengguna

- **Siswa dan mahasiswa:** mengatur kelas, ujian, tugas, dan kegiatan kampus.
- **Pekerja:** mengatur rapat, shift, tenggat, dan kegiatan kerja.
- **Pengguna dengan rutinitas padat:** mengatur berbagai kegiatan harian.

## 4. Ruang Lingkup MVP

### Termasuk

- Membuat, melihat, mengedit, dan menghapus jadwal.
- Mengatur judul, kategori, tanggal, jam mulai, dan durasi.
- Mengatur waktu pengingat sebelum kegiatan.
- Melihat agenda hari ini dan daftar jadwal mendatang.
- Menampilkan peringatan visual merah berbentuk segitiga warning.
- Memutar sirine saat alarm aktif.
- Menghentikan alarm dengan gestur geser ke atas.
- Menyimpan jadwal dan pengaturan secara lokal di IndexedDB.
- Meminta izin notifikasi browser jika pengguna ingin mengaktifkannya.

### Belum termasuk

- Sinkronisasi jadwal antardevice atau akun pengguna.
- Berbagi jadwal dengan orang lain.
- Integrasi kalender eksternal.
- Alarm yang dijamin aktif ketika browser atau perangkat mati.
- Alarm yang mengambil alih layar kunci perangkat.

## 5. Alur Pengguna

### Membuat jadwal

1. Pengguna membuka halaman **Agenda**.
2. Pengguna memilih **Tambah Jadwal**.
3. Pengguna mengisi judul, kategori, tanggal, jam mulai, dan durasi.
4. Pengguna memilih waktu pengingat, misalnya 5, 10, 15, atau 30 menit sebelumnya.
5. Pengguna menyimpan jadwal.
6. Aplikasi menyimpan jadwal ke IndexedDB dan menampilkannya di agenda.

### Menghentikan alarm

1. Pada waktu pengingat, aplikasi menampilkan layar peringatan.
2. Sirine berbunyi dan ikon segitiga warning merah ditampilkan.
3. Pengguna menggeser layar peringatan ke atas.
4. Aplikasi menghentikan suara dan menutup peringatan.

## 6. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| F-01 | Pengguna dapat membuat jadwal dengan judul, tanggal, jam mulai, dan durasi | Must |
| F-02 | Pengguna dapat memilih kategori Kuliah, Sekolah, Kerja, atau Lainnya | Must |
| F-03 | Pengguna dapat menentukan waktu pengingat sebelum jadwal | Must |
| F-04 | Jadwal disimpan secara lokal menggunakan IndexedDB | Must |
| F-05 | Pengguna dapat melihat agenda hari ini dan jadwal mendatang | Must |
| F-06 | Pengingat menampilkan layar peringatan merah dengan ikon segitiga warning | Must |
| F-07 | Alarm memainkan suara sirine ketika peringatan aktif | Must |
| F-08 | Pengguna dapat menghentikan alarm dengan menggeser peringatan ke atas | Must |
| F-09 | Pengguna dapat mengedit dan menghapus jadwal | Must |
| F-10 | Aplikasi mendeteksi jadwal yang waktunya bertabrakan | Should |
| F-11 | Pengguna dapat menyalakan atau mematikan suara alarm | Should |
| F-12 | Pengguna dapat menguji suara sirine dari halaman pengaturan | Should |
| F-13 | Aplikasi dapat meminta izin notifikasi browser | Should |
| F-14 | Pengguna dapat membuat jadwal berulang | Could |

## 7. Spesifikasi Alarm

### Tampilan peringatan

Saat alarm aktif, aplikasi menampilkan lapisan peringatan yang berisi:

- Latar merah dengan kontras teks yang memadai.
- Ikon segitiga warning dengan tanda seru.
- Judul kegiatan.
- Keterangan, misalnya: **“Jadwal dimulai dalam 10 menit.”**
- Instruksi: **“Geser ke atas untuk menghentikan alarm.”**
- Animasi yang jelas, tetapi tidak berkedip cepat.

### Suara dan gestur

- Sirine diputar berulang sampai alarm dihentikan atau mencapai batas durasi.
- Pengguna menghentikannya dengan menggeser layar peringatan ke atas.
- Tombol alternatif disediakan untuk aksesibilitas dan pengguna yang tidak dapat melakukan gestur.
- Jika suara tidak bisa diputar, peringatan visual tetap tampil dan aplikasi memberi opsi untuk mengaktifkan suara.
- tambahkan fitur penganti suara alarm

### Pengaturan awal yang disarankan

- Waktu pengingat bawaan: **10 menit sebelum kegiatan**.
- Durasi sirine maksimum: **2 menit**, lalu berhenti otomatis.
- Pengguna dapat mengubah waktu pengingat dan menguji suara.

## 8. Aturan Produk

- Jadwal wajib memiliki judul, tanggal, jam mulai, dan durasi.
- Waktu selesai harus lebih akhir dari waktu mulai.
- Jika pengingat tiba saat aplikasi sedang terbuka, aplikasi memunculkan peringatan visual dan mencoba memainkan sirine.
- Jika ada jadwal yang bertabrakan, aplikasi menampilkan peringatan sebelum jadwal disimpan.
- Menghapus atau mengedit jadwal harus memperbarui data alarm terkait.
- Alarm yang telah dihentikan tidak boleh muncul kembali untuk jadwal yang sama.
- Pengguna tetap dapat melihat jadwal jika izin notifikasi ditolak.

## 9. Batasan Teknis Web

MVP menggunakan HTML, CSS, JavaScript, dan IndexedDB tanpa backend. Karena itu:

- Alarm paling dapat diandalkan saat aplikasi atau tab masih terbuka.
- Browser dapat menangguhkan tab, menutup tab, atau membatasi timer. Alarm web tidak dapat dijamin selalu tepat waktu.
- Notifikasi browser memerlukan izin pengguna. Service worker dapat membantu menampilkan notifikasi, tetapi penjadwalan saat aplikasi tertutup bergantung pada browser dan platform.
- Browser umumnya tidak mengizinkan audio berjalan otomatis sebelum pengguna berinteraksi dengan halaman. Aplikasi perlu meminta pengguna mengaktifkan suara melalui interaksi, misalnya tombol **Aktifkan Alarm**.
- Aplikasi web tidak dapat menjamin menampilkan layar alarm di atas layar kunci atau membunyikan sirine saat perangkat mati.

**Implikasi produk:** Jelaskan bahwa alarm paling andal digunakan saat aplikasi tetap terbuka atau berjalan sebagai PWA. Tampilkan status izin notifikasi dan suara kepada pengguna.

## 10. Struktur Halaman

1. **Agenda**
   - Jadwal hari ini.
   - Jadwal berikutnya.
   - Tombol tambah jadwal.

2. **Kalender**
   - Navigasi tanggal.
   - Daftar jadwal per hari.

3. **Form Jadwal**
   - Judul, kategori, tanggal, jam, durasi, pengingat, dan catatan opsional.

4. **Layar Alarm**
   - Peringatan merah.
   - Ikon warning.
   - Informasi kegiatan dan waktu menuju jadwal.
   - Gestur geser ke atas untuk menghentikan alarm.

5. **Pengaturan**
   - Izin notifikasi.
   - Pengaturan suara dan waktu pengingat.
   - Tombol uji suara.
   - Keterangan keterbatasan alarm web.

## 11. Model Data IndexedDB

### Object store: `events`

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String | ID unik jadwal |
| `title` | String | Nama kegiatan |
| `category` | String | `kuliah`, `sekolah`, `kerja`, atau `lainnya` |
| `date` | String | Tanggal kegiatan |
| `startTime` | String | Jam mulai |
| `durationMinutes` | Number | Durasi dalam menit |
| `reminderMinutes` | Number | Jarak waktu pengingat sebelum jadwal |
| `notes` | String | Catatan opsional |
| `completed` | Boolean | Status selesai |
| `createdAt` | String | Waktu pembuatan |

### Object store: `settings`

Menyimpan preferensi seperti suara alarm, waktu pengingat bawaan, dan status izin notifikasi.

## 12. Kebutuhan Nonfungsional

- Antarmuka responsif pada ponsel dan desktop.
- Data tetap tersedia setelah halaman dimuat ulang.
- Aplikasi menampilkan status jika IndexedDB tidak tersedia atau gagal digunakan.
- Warna, teks, dan ikon peringatan harus mudah dibedakan.
- Gestur geser didukung pada layar sentuh.
- Tombol alternatif tersedia untuk keyboard dan teknologi bantu.
- Animasi tidak boleh menyebabkan kilatan cepat yang berisiko bagi pengguna sensitif terhadap cahaya.

## 13. Metrik Keberhasilan

- Persentase pengguna yang berhasil membuat jadwal pertama.
- Persentase alarm yang dihentikan melalui gestur geser ke atas.
- Jumlah jadwal yang ditandai selesai.
- Tingkat keberhasilan penyimpanan dan pemuatan jadwal.
- Jumlah pengguna yang mengaktifkan izin notifikasi dan suara alarm.
- Masukan pengguna mengenai kejelasan alarm dan kemudahan menghentikannya.

## 14. Kriteria Penerimaan MVP

MVP siap diuji apabila:

1. Pengguna dapat membuat, mengedit, melihat, dan menghapus jadwal.
2. Data jadwal tetap ada setelah halaman dimuat ulang.
3. Alarm muncul pada waktu pengingat selama aplikasi aktif.
4. Alarm menampilkan peringatan visual merah dan informasi jadwal.
5. Suara sirine dapat diuji dan dihentikan.
6. Gestur geser ke atas menghentikan suara dan menutup peringatan.
7. Tersedia tombol alternatif untuk menghentikan alarm.
8. Aplikasi menjelaskan batasan notifikasi dan alarm pada browser.s