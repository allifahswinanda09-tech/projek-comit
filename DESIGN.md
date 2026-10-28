# DESIGN.md — Panduan Desain UI JadwalSiaga

## 1. Arah Desain

Desain JadwalSiaga mengadaptasi referensi **Watch UI Kit**: panel gelap, kartu dengan sudut membulat, informasi waktu yang menonjol, serta aksen warna cerah untuk membedakan kategori dan status.

Gaya visual aplikasi:

- **Ringkas dan mudah dipindai**, seperti tampilan smartwatch.
- **Gelap sebagai tampilan utama**, dengan aksen warna cyan, biru, ungu, dan oranye.
- **Informasi jadwal menjadi fokus**, terutama waktu dan nama kegiatan.
- **Peringatan alarm tampil berbeda dan tegas** dari komponen biasa dengan warna merah.

> Acuan visual: latar ungu gelap, kartu hitam atau biru gelap, teks putih, aksen warna cerah, serta elemen melingkar pada tampilan jam.

## 2. Design Tokens

### Warna

| Token | Nilai | Penggunaan |
|---|---|---|
| `color.background` | `#211D35` | Latar utama aplikasi |
| `color.surface` | `#050505` | Kartu dan panel utama |
| `color.surface-alt` | `#09272E` | Panel alternatif seperti daftar tugas |
| `color.surface-row` | `#202020` | Baris pengaturan dan daftar |
| `color.text-primary` | `#F5F5F7` | Judul dan informasi utama |
| `color.text-secondary` | `#A9A9B3` | Keterangan dan waktu sekunder |
| `color.cyan` | `#00BDEB` | Aksen pengaturan dan jadwal kuliah |
| `color.blue` | `#2479D8` | Jadwal sekolah dan status aktif |
| `color.teal` | `#27C9B5` | Jadwal kerja |
| `color.purple` | `#A52BCC` | Aksen dan kategori lainnya |
| `color.orange` | `#FF7900` | Sorotan dan kegiatan mendatang |
| `color.lime` | `#D6F34D` | Indikator tambahan |
| `color.danger` | `#F52235` | Alarm dan peringatan |
| `color.danger-dark` | `#7C101B` | Latar pendukung peringatan |

Gunakan teks terang pada panel gelap. Pastikan teks dan ikon tetap memiliki kontras yang cukup.

### Tipografi

Gunakan font sans-serif yang tersedia di sistem, misalnya `system-ui`, `Arial`, atau sans-serif.

| Elemen | Ukuran rekomendasi | Gaya |
|---|---:|---|
| Judul halaman | 28–36 px | Regular atau medium |
| Judul panel | 15–18 px | Semibold |
| Judul jadwal | 14–16 px | Medium |
| Waktu utama | 24–32 px | Regular |
| Keterangan | 11–13 px | Regular |
| Label kecil | 10–12 px | Medium |

### Bentuk dan jarak

- Radius kartu utama: **12–16 px**
- Radius baris daftar: **8–10 px**
- Radius tombol: **8–12 px**
- Jarak antarbagian: **16–24 px**
- Jarak dalam kartu: **12–16 px**
- Ikon: konsisten, sederhana, dan mudah dikenali
- Bayangan: tipis; gunakan garis tepi halus bila diperlukan

## 3. Komponen UI

### 3.1 `AppHeader`
Header halaman dengan judul, tanggal, dan waktu saat ini.

**Isi:**
- Nama halaman, seperti **Agenda** atau **Pengaturan**
- Tanggal hari ini
- Waktu saat ini
- Tombol tambah jadwal jika relevan

### 3.2 `WatchClockCard`
Kartu jam ringkas yang terinspirasi dari panel jam melingkar pada gambar.

**Isi:**
- Tanggal
- Waktu utama
- Penanda AM/PM bila menggunakan format 12 jam
- Nama hari
- Cincin waktu atau progress ring dekoratif

**Varian warna:**
- Oranye
- Cyan
- Magenta
- Biru-ungu

**Penggunaan:**
- Menampilkan waktu sekarang di halaman ringkasan.
- Menampilkan waktu menuju jadwal berikutnya.

### 3.3 `ScheduleCard`
Kartu jadwal untuk kegiatan kuliah, sekolah, kerja, atau lainnya.

**Isi:**
- Penanda warna kategori
- Judul kegiatan
- Jam mulai dan selesai
- Tanggal atau keterangan waktu
- Lokasi atau catatan jika tersedia
- Status alarm

