---
version: alpha
name: PickHub
description: Operasional gudang yang padat dan cepat dibaca — netral, tenang, dengan satu warna sinyal untuk kegagalan.
colors:
  # --- Merek & interaksi ---
  primary: "#2E5AAC"
  primaryDark: "#1E3F80"
  primarySoft: "#E8EFFA"
  onPrimary: "#FFFFFF"

  # --- Teks ---
  ink: "#0F172A"
  sub: "#5A6472"
  faint: "#93A0AF"

  # --- Permukaan ---
  bg: "#F7F8FA"
  surface: "#FFFFFF"
  surfaceAlt: "#F1F3F6"
  header: "#FFFFFF"
  border: "#E2E6EB"
  neutralBg: "#F8FAFC"
  neutralBorder: "#CBD5E1"
  chipBg: "#E2E8F0"

  # --- Sinyal ---
  danger: "#E5484D"
  onDanger: "#FFFFFF"
  ok: "#16A34A"
  okBright: "#10B981"
  warn: "#F59E0B"

  # --- Semantik: bahaya ---
  dangerBg: "#FEF2F2"
  dangerBorder: "#FCA5A5"
  dangerText: "#991B1B"

  # --- Semantik: berhasil ---
  okBg: "#F0FDF4"
  okBorder: "#BBF7D0"
  okText: "#15803D"
  okChip: "#DCFCE7"

  # --- Semantik: hasil scan ---
  scanOkBg: "#ECFDF5"
  scanOkBorder: "#A7F3D0"
  scanOkText: "#065F46"

  # --- Semantik: peringatan ---
  warnBg: "#FFFBEB"
  warnBorder: "#FDE68A"
  warnText: "#B45309"
  amberBg: "#FEF3C7"
  amberBorder: "#FCD34D"
  amberText: "#92400E"

  # --- Semantik: informasi ---
  blueBg: "#EFF6FF"
  blueBorder: "#93C5FD"
  blueText: "#1D4ED8"
  violetBg: "#EDE9FE"
  violetBorder: "#C4B5FD"
  violetText: "#6D28D9"
  skyBg: "#E0F2FE"
  skyText: "#0369A1"

  # --- Status paket (dari STATUS_META, identik di terang & gelap) ---
  statusDataMasuk: "#64748B"
  statusDataMasukTint: "#64748B1F"
  statusAmbilCustomer: "#4F46E5"
  statusAmbilCustomerTint: "#4F46E51A"
  statusGojek: "#059669"
  statusGojekTint: "#0596691A"
  statusBuyback: "#6D28D9"
  statusBuybackTint: "#6D28D91F"
  statusMencariDriver: "#D97706"
  statusMencariDriverTint: "#D977061F"
  statusDriverSampai: "#7C3AED"
  statusDriverSampaiTint: "#7C3AED1A"
  statusRetur: "#E5484D"
  statusReturTint: "#E5484D1A"
  statusSelesai: "#16A34A"
  statusSelesaiTint: "#16A34A1A"
  statusCancel: "#475569"
  statusCancelTint: "#4755691F"
  statusKirimGudang: "#D97706"
  statusKirimGudangTint: "#D977061A"
  statusTerimaGudang: "#059669"
  statusTerimaGudangTint: "#0596691A"

# Kunci ekstensi: palet mode gelap. Nama token sengaja sama persis
# dengan palet terang di atas supaya pemetaannya satu-lawan-satu.
# Dipakai lewat useTheme() -> colors (bukan impor statis).
colorsDark:
  primary: "#5B8DEF"
  primaryDark: "#3E6BC4"
  primarySoft: "rgba(91,141,239,0.16)"
  onPrimary: "#0B1220"

  ink: "#E6EDF7"
  sub: "#9AA7BA"
  faint: "#64748B"

  bg: "#0B1220"
  surface: "#151F31"
  surfaceAlt: "#1E2A3F"
  header: "#0B1220"
  border: "#2A3A55"
  neutralBg: "#1B2637"
  neutralBorder: "#3E4E6B"
  chipBg: "#2A3852"

  danger: "#F87171"
  onDanger: "#0B1220"
  ok: "#34D399"
  okBright: "#34D399"
  warn: "#FBBF24"

  dangerBg: "#3A1D24"
  dangerBorder: "#7F3740"
  dangerText: "#FDA4AF"

  okBg: "#16291D"
  okBorder: "#2E6B44"
  okText: "#86EFAC"
  okChip: "#1F4A30"

  scanOkBg: "rgba(52,211,153,0.10)"
  scanOkBorder: "#2E8F6B"
  scanOkText: "#86EFAC"

  warnBg: "#33280F"
  warnBorder: "#8A6A24"
  warnText: "#FCD34D"
  amberBg: "#352A0F"
  amberBorder: "#92690F"
  amberText: "#FBBF24"

  blueBg: "#12203A"
  blueBorder: "#3B6EA5"
  blueText: "#93C5FD"
  violetBg: "#231A3D"
  violetBorder: "#6D4FA6"
  violetText: "#C4B5FD"
  skyBg: "#0C2A40"
  skyText: "#7DD3FC"
typography:
  display-code:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, monospace
    fontSize: 26px
    fontWeight: 800
    letterSpacing: "6px"
  h1:
    fontFamily: -apple-system, Roboto, system-ui, sans-serif
    fontSize: 22px
    fontWeight: 800
    lineHeight: 1.25
  h2:
    fontFamily: -apple-system, Roboto, system-ui, sans-serif
    fontSize: 18px
    fontWeight: 800
    lineHeight: 1.3
  h3:
    fontFamily: -apple-system, Roboto, system-ui, sans-serif
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.35
  body-md:
    fontFamily: -apple-system, Roboto, system-ui, sans-serif
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.45
  body-sm:
    fontFamily: -apple-system, Roboto, system-ui, sans-serif
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.45
  body-xs:
    fontFamily: -apple-system, Roboto, system-ui, sans-serif
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.4
  label-caps:
    fontFamily: -apple-system, Roboto, system-ui, sans-serif
    fontSize: 11px
    fontWeight: 700
    letterSpacing: "0.5px"
  mono-awb:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, monospace
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.4
  mono-code:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, monospace
    fontSize: 18px
    fontWeight: 800
    letterSpacing: "2px"
rounded:
  input: 8px
  pill: 8px
  card: 12px
  sheet: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
components:
  # --- Interaksi utama ---
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.onPrimary}"
    rounded: "{rounded.pill}"
    padding: 12px
    typography: body-md
  button-primary-pressed:
    backgroundColor: "{colors.primaryDark}"
    textColor: "{colors.onPrimary}"
    rounded: "{rounded.pill}"
    padding: 12px
  button-secondary:
    backgroundColor: "{colors.neutralBg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: 12px
    typography: body-md
  button-secondary-pressed:
    backgroundColor: "{colors.chipBg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: 12px
  button-ghost:
    backgroundColor: "{colors.primarySoft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: 8px
    typography: body-sm

  # --- Bahaya ---
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.onDanger}"
    rounded: "{rounded.pill}"
    padding: 12px
    typography: body-md
  toast-error:
    backgroundColor: "{colors.dangerBg}"
    textColor: "{colors.dangerText}"
    rounded: "{rounded.card}"
    padding: 12px
    typography: body-sm

  # --- Permukaan ---
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: 16px
    typography: body-md
  card-header:
    backgroundColor: "{colors.surfaceAlt}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: 12px
    typography: h3
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: 24px
    typography: body-md
  modal:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: 24px
    typography: body-md
  kanban-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: 12px
    typography: body-sm
  empty-state:
    backgroundColor: "{colors.neutralBg}"
    textColor: "{colors.sub}"
    rounded: "{rounded.card}"
    padding: 24px
    typography: body-sm

  # --- Chip status paket ---
  chip-status-data-masuk:
    backgroundColor: "{colors.statusDataMasukTint}"
    textColor: "{colors.statusDataMasuk}"
    rounded: "{rounded.pill}"
    padding: 4px
    typography: label-caps
  chip-status-absen-ambil-customer:
    backgroundColor: "{colors.statusAmbilCustomerTint}"
    textColor: "{colors.statusAmbilCustomer}"
    rounded: "{rounded.pill}"
    padding: 4px
    typography: label-caps
  chip-status-absen-gojek:
    backgroundColor: "{colors.statusGojekTint}"
    textColor: "{colors.statusGojek}"
    rounded: "{rounded.pill}"
    padding: 4px
    typography: label-caps
  chip-status-absen-buyback:
    backgroundColor: "{colors.statusBuybackTint}"
    textColor: "{colors.statusBuyback}"
    rounded: "{rounded.pill}"
    padding: 4px
    typography: label-caps
  chip-status-mencari-driver:
    backgroundColor: "{colors.statusMencariDriverTint}"
    textColor: "{colors.statusMencariDriver}"
    rounded: "{rounded.pill}"
    padding: 4px
    typography: label-caps
  chip-status-driver-sampai-kios:
    backgroundColor: "{colors.statusDriverSampaiTint}"
    textColor: "{colors.statusDriverSampai}"
    rounded: "{rounded.pill}"
    padding: 4px
    typography: label-caps
  chip-status-retur:
    backgroundColor: "{colors.statusReturTint}"
    textColor: "{colors.statusRetur}"
    rounded: "{rounded.pill}"
    padding: 4px
    typography: label-caps
  chip-status-selesai:
    backgroundColor: "{colors.statusSelesaiTint}"
    textColor: "{colors.statusSelesai}"
    rounded: "{rounded.pill}"
    padding: 4px
    typography: label-caps
  chip-status-cancel:
    backgroundColor: "{colors.statusCancelTint}"
    textColor: "{colors.statusCancel}"
    rounded: "{rounded.pill}"
    padding: 4px
    typography: label-caps
  chip-status-dikirim-ke-gudang:
    backgroundColor: "{colors.statusKirimGudangTint}"
    textColor: "{colors.statusKirimGudang}"
    rounded: "{rounded.pill}"
    padding: 4px
    typography: label-caps
  chip-status-diterima-gudang:
    backgroundColor: "{colors.statusTerimaGudangTint}"
    textColor: "{colors.statusTerimaGudang}"
    rounded: "{rounded.pill}"
    padding: 4px
    typography: label-caps

  # --- Penanda lain ---
  badge-count:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.onDanger}"
    rounded: "{rounded.full}"
    padding: 4px
    typography: label-caps
  toast-success:
    backgroundColor: "{colors.okBg}"
    textColor: "{colors.okText}"
    rounded: "{rounded.card}"
    padding: 12px
    typography: body-sm

  # --- Hasil scan (lihat Do's and Don'ts) ---
  scan-result-ok:
    backgroundColor: "{colors.scanOkBg}"
    textColor: "{colors.scanOkText}"
    rounded: "{rounded.card}"
    padding: 16px
    typography: h2
  scan-result-fail:
    backgroundColor: "{colors.dangerBg}"
    textColor: "{colors.dangerText}"
    rounded: "{rounded.card}"
    padding: 16px
    typography: h2

  # --- Medan masukan ---
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: 12px
    typography: body-md
  input-search:
    backgroundColor: "{colors.surfaceAlt}"
    textColor: "{colors.sub}"
    rounded: "{rounded.input}"
    padding: 12px
    typography: body-md
  input-error:
    backgroundColor: "{colors.dangerBg}"
    textColor: "{colors.dangerText}"
    rounded: "{rounded.input}"
    padding: 12px
    typography: body-md

  # --- Kode & angka ---
  text-mono-awb:
    textColor: "{colors.ink}"
    typography: mono-awb
  text-mono-code:
    textColor: "{colors.primary}"
    typography: mono-code

  # --- Struktur ---
  table-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: body-sm
  table-row-alt:
    backgroundColor: "{colors.surfaceAlt}"
    textColor: "{colors.ink}"
    typography: body-sm
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  section-plain:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.sub}"
    typography: body-xs
---

## Overview

PickHub dipakai di depan meja kios, sering sambil berdiri, kadang dengan
sarung tangan, dan selalu buru-buru. Karena itu identitas visualnya
**netral dan tenang**: latar abu muda, permukaan putih, satu warna biru
untuk hal yang bisa ditekan. Tidak ada gradien, tidak ada ornamen.

Prinsip yang menentukan hampir semua keputusan di dokumen ini:

1. **Nomor resi adalah raja.** Operator bekerja dengan deretan angka yang
   mirip satu sama lain. Semua yang berupa resi, AWB, atau kode ambil harus
   memakai huruf `mono` dan bobot tebal — supaya `0` tidak tertukar dengan
   `O`. Lihat `text-mono-awb` dan `text-mono-code`.
2. **Padat, tapi tidak sesak.** Ukuran teks dasar aplikasi ini kecil
   (12–13px) karena satu layar harus memuat banyak baris paket. Kerapatan
   itu disengaja — jangan "melonggarkan"-nya saat membangun ulang.
3. **Satu warna untuk satu arti.** Biru = bisa ditekan. Hijau = berhasil.
   Merah = **gagal**. Kuning = perhatian. Warna tidak boleh dipakai untuk
   hiasan, karena di layar ini warna adalah informasi.

## Colors

Palet terang di `colors:` adalah acuan utama. Palet gelap ada di kunci
ekstensi `colorsDark:` dengan **nama token yang sama persis**, sehingga
pemetaannya satu lawan satu.

Kelompok warna dan tugasnya:

- **Primary (`#2E5AAC`)** — satu-satunya penggerak interaksi. Tombol
  utama, tautan, ring fokus. Dipakai hemat; kalau semua biru, tidak ada
  yang menonjol.
- **Ink / Sub / Faint** — tiga tingkat teks. `ink` untuk isi, `sub` untuk
  keterangan, `faint` untuk yang benar-benar sekunder (placeholder,
  baris tidak aktif).
- **Surface / SurfaceAlt / Bg** — tiga tingkat permukaan. `bg` untuk latar
  halaman, `surface` untuk kartu, `surfaceAlt` untuk kepala kartu dan
  bidang yang perlu sedikit tenggelam.
- **Danger (`#E5484D`)** — **khusus kegagalan.** Lihat Do's and Don'ts.
- **Ok / Warn** — berhasil dan perlu perhatian.

Warna semantik berakhiran `Bg`/`Border`/`Text` datang berpasangan dan
harus dipakai bersama — jangan mencampur `dangerBg` dengan `okText`.

### Warna di atas bidang berisi warna

`onPrimary` dan `onDanger` adalah warna teks untuk bidang berisi warna
(tombol, lencana). Keduanya sudah menjadi token nyata di `theme.js`
sejak 2026-10-08; sebelumnya hanya ada di dokumen ini.

- Terang: `onPrimary` dan `onDanger` sama-sama putih.
- Gelap: keduanya **dibalik jadi gelap** (`#0B1220`). Bukan pilihan
  gaya: di mode gelap `primary` dan `danger` menjadi lebih terang, dan
  teks putih jatuh ke 3.23:1 dan 2.77:1 — di bawah ambang WCAG AA.
  Angka angkanya ada di "Temuan kontras" pada bab terakhir.

### Status paket

Sebelas warna status diambil dari `STATUS_META` dan **sama di terang
maupun gelap** (status tidak berubah warna saat tema berganti). Tiap
status punya dua token: warna pekat (untuk teks) dan `Tint` — warna sama
dengan alfa rendah (untuk latar chip).

Pasangan yang gampang tertukar dan sengaja dibedakan:

- `selesai` (hijau `#16A34A`) vs `diterima_gudang` (hijau `#059669`) —
  dua hijau berbeda. Jangan disatukan.
- `retur` memakai merah `#E5484D` yang sama dengan `danger`. Ini
  disengaja: retur memang keadaan yang perlu segera ditangani.
- `cancel` (`#475569`) sengaja abu-abu, bukan merah — cancel itu keputusan
  normal, bukan kegagalan.

### Mode gelap

Perbedaan yang perlu diperhatikan saat memetakan:

- `primary` menjadi lebih terang (`#5B8DEF`) agar tetap kontras di latar
  gelap; `onPrimary` berbalik jadi gelap (`#0B1220`)
- Latar memakai biru malam, bukan hitam murni (`#0B1220`)
- Beberapa latar semantik memakai `rgba()` agar tembus ke permukaan di
  bawahnya (`primarySoft`, `scanOkBg`)

## Typography

⚠️ **Aplikasi ini tidak memakai font kustom.** Teks biasa memakai font
bawaan sistem, dan itu memang disengaja — nol beban unduh, dan tampilannya
sudah familiar bagi operator.

Satu pengecualian penting: **font `mono`** untuk resi, AWB, kode ambil, dan
tanggal. Ini bukan pilihan gaya. Deretan 16 digit resi harus bisa
dibedakan mata dengan cepat, dan `mono` membuat tiap digit punya lebar
sama sehingga angka sejajar antar baris.

Tangga ukuran (nilai px, setara satuan bebas React Native):

| Token | Ukuran | Dipakai untuk |
|---|---|---|
| `display-code` | 26px / 800 | Kode ambil 8 digit di layar konfirmasi |
| `h1` | 22px / 800 | Judul layar |
| `h2` | 18px / 800 | Hasil scan, judul modal |
| `h3` | 16px / 700 | Judul bagian |
| `body-md` | 13px / 600 | Isi utama |
| `body-sm` | 12px / 600 | Baris tabel, keterangan |
| `body-xs` | 11px / 600 | Metadata |
| `label-caps` | 11px / 700 | Label chip & kepala kolom |
| `mono-awb` | 13px / 700 | Resi & AWB di daftar |
| `mono-code` | 18px / 800 | Kode di dalam kartu |

Bobot hanya tiga: **600, 700, 800**. Tidak ada teks tipis — di layar kios
yang sering kena cahaya, huruf tipis hilang.

## Layout

Skala jarak dari `theme.js`, kelipatan 4px:

`xs 4` · `sm 8` · `md 12` · `lg 16` · `xl 24` · `xxl 32`

Pemakaian:

- `xs`/`sm` — jarak dalam satu komponen (label ke nilainya, ikon ke teks)
- `md` — jarak antar bidang dalam satu kartu
- `lg` — padding kartu, jarak antar kartu
- `xl`/`xxl` — jarak antar bagian, padding sheet

Layout beradaptasi dengan lebar layar (`useBreakpoint`):

- **Ponsel** — satu kolom, navigasi bawah
- **Desktop** — sidebar kiri, konten memenuhi sisanya
- **Ultra-wide** — konten dibatasi lebarnya, tidak direntangkan penuh

## Elevation & Depth

Hanya dua tingkat, keduanya dari `theme.js`:

- **`shadow.card`** — opasitas 0.04, radius 6. Untuk kartu dan baris daftar.
  Nyaris tak terlihat; fungsinya memisahkan permukaan, bukan menarik mata.
- **`shadow.float`** — opasitas 0.10, radius 16. Untuk yang benar-benar
  mengambang: modal, sheet, menu jatuh.

⚠️ **Mode gelap tidak memakai bayangan.** Di latar gelap bayangan tidak
terbaca, jadi kedalaman dibedakan lewat warna permukaan (`surface` lebih
terang dari `bg`). Jangan paksakan bayangan di mode gelap.

## Shapes

Sudut membulat dari `theme.js`, sengaja sedang — tidak tajam, tidak
sepenuhnya bulat:

- `input` (8px) & `pill` (8px) — bidang masukan dan tombol
- `card` (12px) — kartu, chip, toast
- `sheet` (16px) — modal dan panel yang muncul dari bawah
- `full` (9999px) — hanya avatar dan lencana bulat

Ukuran berbeda ini konsisten: makin besar permukaannya, makin besar
lengkungnya.

## Components

Tiga puluh lebih komponen di atas dikelompokkan sebagai berikut:

**Interaksi** — `button-primary` satu-satunya aksi berpenekanan tinggi per
layar. Varian `-pressed` adalah **kunci sejajar**, bukan anak dari
komponennya. `button-ghost` untuk aksi tersier (mis. tautan "lihat semua").

**Permukaan** — `card` adalah permukaan bawaan. `sheet` dan `modal`
berbagi bentuk yang sama karena keduanya muncul dari bawah.

**Chip status** — sebelas chip, satu per status paket. Semuanya memakai
pasangan warna + `Tint` dari palet status. Bentuk dan ukurannya identik;
yang membedakan hanya warna dan label teksnya.

**Hasil scan** — `scan-result-ok` dan `scan-result-fail` adalah komponen
**paling penting di aplikasi ini**. Keduanya selalu muncul **berpasangan
dengan bunyi** (`nada-gagal.wav`). Lihat Do's and Don'ts.

**Medan masukan** — `input`, `input-search`, `input-error`. Tidak ada
bidang bertanda wajib: hampir semua isian di aplikasi ini opsional.

## Do's and Don'ts

- **Do** ambil warna lewat `useTheme()`. Jangan impor `colors` statis di
  komponen UI — mode gelap akan rusak tanpa terlihat.
- **Do** pakai token semantik (`dangerBg`, `okText`), jangan hex langsung.
  Kalau butuh warna yang belum ada, **tambahkan tokennya** di `theme.js`.
- **Do** pakai `mono` untuk semua resi, AWB, kode ambil, dan tanggal.
- **Do** sertakan label teks di samping warna status. Sebagian operator
  punya penglihatan warna yang terbatas, dan layar kios sering kena
  pantulan cahaya.
- **Don't** memakai merah untuk apa pun selain kegagalan. Merah adalah
  sinyal "scan gagal" yang berpasangan dengan bunyi — kalau merah dipakai
  untuk hiasan atau status normal, sinyal itu melemah dan operator bisa
  melewatkan kegagalan sungguhan.
- **Don't** memakai warna sebagai satu-satunya pembeda status. Selalu ada
  teksnya.
- **Don't** menambah warna di luar palet ini. Palet sudah dipakai di
  produksi pada lebih dari 46.000 paket (per Oktober 2026); perubahan warna
  adalah keputusan pemilik produk, bukan keputusan teknis.
- **Don't** bersarang varian komponen. `button-primary-pressed` sejajar
  dengan `button-primary`, bukan di dalamnya.
- **Don't** memakai bayangan di mode gelap.
- **Don't** memakai `expo-av`. Paket itu dihapus sejak Expo SDK 55; audio
  memakai `expo-audio`.
- **Don't** mengubah ukuran teks dasar menjadi lebih besar tanpa alasan.
  Kerapatan 12–13px disengaja agar satu layar memuat banyak baris paket.

### Temuan kontras

Linter tidak bisa menghitung warna ber-alfa, jadi pasangan di bawah ini
dihitung sendiri: warna tint ditempel di atas permukaan putih lebih dulu,
baru rasionya dihitung. Ambangnya WCAG AA 4.5:1, karena semua teks ini
kecil (11–13px, di bawah ambang "teks besar").

Angka di bawah **dilaporkan apa adanya**. Warnanya tidak diubah di sini:
palet sudah dipakai produksi dan perubahan warna adalah keputusan pemilik
produk.

Yang lolos:

| Pasangan | Rasio |
|---|---|
| `ink` di `surface` | 17.85:1 |
| `dangerText` di `dangerBg` | 7.60:1 |
| `scanOkText` di `scanOkBg` | 7.29:1 |
| `amberText` di `amberBg` | 6.37:1 |
| `blueText` di `blueBg` | 6.16:1 |
| `violetText` di `violetBg` | 5.98:1 |
| `sub` di `bg` | 5.65:1 |
| `absen_buyback` chip | 5.82:1 |
| `absen_ambil_customer` chip | 5.39:1 |
| `skyText` di `skyBg` | 5.17:1 |
| `driver_sampai_kios` chip | 4.91:1 |
| `warnText` di `warnBg` | 4.84:1 |
| `okText` di `okBg` | 4.79:1 |
| `cancel` chip | 6.30:1 |

Yang **gagal** AA dan perlu keputusan pemilik produk:

| Pasangan | Rasio | Catatan |
|---|---|---|
| `selesai` chip | 2.95:1 | hijau `#16A34A` di tint-nya |
| `mencari_driver` chip | 2.79:1 | amber `#D97706` di tint-nya |
| `dikirim_ke_gudang` chip | 2.86:1 | amber yang sama |
| `absen_gojek` chip | 3.33:1 | hijau `#059669` di tint-nya |
| `diterima_gudang` chip | 3.33:1 | hijau yang sama |
| `retur` chip | 3.42:1 | merah `#E5484D` di tint-nya |
| `data_masuk` chip | 4.09:1 | slate `#64748B` di tint-nya |
| `faint` di `surface` | 2.66:1 | placeholder & baris tidak aktif |
| putih di `danger` terang | 3.91:1 | teks tombol bahaya |

Untuk chip, perbaikannya bisa lewat warna teks yang lebih pekat di tint
yang sama, tanpa menyentuh warna statusnya. Perlu diingat juga aturan di
atas: warna tidak boleh jadi satu-satunya pembeda status, dan label teks
sudah ada di setiap chip — jadi kegagalan kontras ini melemahkan
keterbacaan, bukan menghilangkan infonya.
