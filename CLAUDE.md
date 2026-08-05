# PickHub — Aplikasi Manajemen Paket Retail Pickup (Kios Roxy)

Aplikasi tracking paket untuk kios retail pickup. Satu codebase React Native (Expo)
untuk **Android** dan **Web**, backend **Express + PostgreSQL + Socket.IO**.
Bahasa UI: Indonesia. Deploy target: VPS (belum ada per Juli 2026).

> Catatan: proyek ini sempat dibangun sebagai kanban ala Trello (v1), lalu **pivot**
> ke aplikasi retail pickup (v2) setelah flowchart kerja asli diberikan. Jangan
> bangun ulang konsep kanban.

## Menjalankan (dev)

```bash
# Terminal 1 — API + database (embedded PostgreSQL, port 5433; API port 4000)
cd server && npm install && npm run dev

# Terminal 2 — aplikasi
cd app && npm install && npx expo start      # tekan 'w' untuk web; scan QR untuk Android
```

- Alamat API terdeteksi otomatis di `app/src/api.js` (`apiBase()`).
- Setelah install paket baru saat Metro nyala, restart dengan `npx expo start -c` (cache).
- Login awal (WAJIB diganti sebelum produksi): `superadmin/superadmin123` (super admin),
  `gudang/gudang123` (warehouse), `admin/admin123` (admin kios), `sales/sales123` (sales).
  Dibuat di `server/src/db.mjs`.

## Arsitektur

- `server/` — `src/index.mjs` (semua endpoint), `src/db.mjs` (pool + seed user),
  `src/schema.sql` (skema, dijalankan tiap start). Auth JWT, role: superadmin/warehouse/admin/sales.
  Dev DB dinisialisasi **UTF8** (`scripts/dev.mjs`) — WIN1252 menolak unicode dari CSV marketplace.
- `app/` — Expo SDK 57. `App.js` → login/tabs. `src/MainTabs.js` (tab per role),
  `src/screens/` (satu file layar per tab + `ListComponents.js` + `ManualInputModal.js`),
  `src/PackageModal.js` (detail + aksi + foto),
  `src/components.js` (kartu, tabel, modal kode, chart), `src/theme.js` (design token),
  `src/ScannerModal.js` (scan barcode / input manual).
- `deploy/` — docker-compose (Postgres + API) + contoh nginx untuk VPS.

## Alur kerja (dari flowchart "Rules Kerja Kios Roxy")

1. **Warehouse** import CSV export VEF/ERPNext (tab Semua → Import CSV). Deteksi kolom
   fleksibel: `ID`→invoice, `AWB No`→awb_no, `Recipient`→customer (sering tersensor `***`),
   `Commerce Platform`, `Courier Name`. Baris mentah disimpan di kolom `raw` (JSONB).
2. **Admin kios** scan paket datang (tab Scan Paket). **Barcode paket = AWB/resi**, jadi
   `arrive` mencocokkan ke `awb_no` ATAU `invoice_no`. Cocok → status `absen_ambil_customer`
   atau `absen_gojek` (sesuai pickup_type). Tidak cocok → form input manual.
3. **Self Pick Up** (modul `selfpickup`, dulu "Customer"): Sales generate pickup code
   (QR + kirim WA bila nomor tak tersensor); customer datang → admin scan kode (membuka
   detail paket) → konfirmasi WAJIB **1 foto wajah + 1 KTP + 1 barang** → `selesai`.
4. **Gojek**: `absen_gojek` → `mencari_driver` → `driver_sampai_kios` → `done_pickup`.
   Transisi ke `done_pickup` WAJIB **1 foto wajah driver + 1 KTP driver + 1 barang**.
5. **Cancel/Retur** (modul `cancelretur`): menampung status `cancel` & `retur`; baris
   `retur` punya opsi "Cari Driver" (→ `mencari_driver`, kembali ke pipeline gojek).

**Aturan foto** (tabel `package_photos`, kind: `wajah`/`ktp`/`barang`): konfirmasi
pengambilan (gojek `done_pickup` & self-pickup `selesai`) butuh 1 masing-masing.
Ditegakkan server (tolak PATCH bila kurang) DAN UI (tombol terkunci). Endpoint lama
`redeem` dihapus → diganti `find-by-code`. Kolom `gojek_at` mencatat jam masuk antrian
gojek (dipakai di kolom "Update" tabel). Setiap datatable/kartu wajib tampilkan pickup code.

**Akses file**: foto di `/uploads` TIDAK publik — wajib JWT (`?token=` atau header
Bearer; `photoUrl()` di `app/src/api.js` menyisipkan token otomatis).

**Akses API**: `PATCH /api/packages/:id` membatasi per-field — role operasional
(superadmin/admin/warehouse) boleh semua kolom; sales hanya boleh `pickup_code`.
`/uploads` juga wajib JWT (lihat di atas).

## Keputusan produk (jangan diubah tanpa konfirmasi user)

- OTP saat retur = BUKAN urusan aplikasi (di-skip sengaja).
- Satu submit = satu paket (bukan batch multi-paket per driver).
- `done_pickup` = status final alur driver; TIDAK melacak "berhasil/gagal diantar".
- Nomor telepon tersensor marketplace (mengandung `*`) → tombol WhatsApp disembunyikan.
- Tombol "Sync" di flowchart lama tidak diperlukan (aplikasi sudah realtime via Socket.IO).

## Status & langkah berikutnya

- Selesai & teruji: v2 retail pickup + redesain UI modern (gradien indigo, kartu, pill
  status, tab bar mengambang — token di `app/src/theme.js`) + aturan foto Done Pickup.
- Belum: **build APK** (`eas build -p android --profile preview`), **deploy VPS**.
  Sebelum build produksi, isi `PROD_API` di `app/src/api.js` dengan domain VPS.
- Ada paket uji `TEST-GOJEK-01/02` di DB dev (boleh dihapus).
