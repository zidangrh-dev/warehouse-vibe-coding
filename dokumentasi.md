# Dokumen Arsitektur & Operasional PickHub (v2 - Retail Pickup Tracking)

Sistem tracking dan manajemen paket retail pickup kios retail (PickHub).
Memuat satu codebase **React Native (Expo SDK 57)** untuk Web & Android (Native/Expo Go), serta backend **Express + PostgreSQL + Socket.IO + Meilisearch**.

---

## 1. Arsitektur Umum & Struktur Repositori

```
whelk/
├── app/                        # Expo SDK 57 Frontend (Web + Android)
│   ├── App.js                  # Entry point React Native (providers, auth wrapper, global web scrollbar)
│   ├── index.js                # Register root component Expo
│   ├── app.json                # Expo config (SDK 57, plugins, Android package com.pickhub.app)
│   ├── eas.json                # Configuration EAS build cloud (profile: preview, buildType: apk)
│   └── src/
│       ├── api.js              # HTTP Request wrapper, auth token management, Socket.IO client, import handler
│       ├── theme.js            # Design tokens (colors, radius, STATUS_META, NEXT_ACTIONS, notice toast)
│       ├── Icon.js             # Mapper Lucide-React-Native ke komponen Icon
│       ├── components.js       # PackageRow, PackageTable, StatusPill, NameTag, CodeModal, TagPicker
│       ├── PackageModal.js     # Modal detail paket (Aksi, Foto, Tag, Driver, Retur/Cancel, Paste Ctrl+V)
│       ├── ScannerModal.js     # Camera scanner (Android) & manual input fallback
│       ├── ArchiveModal.js     # Modal pengarsipan otomatis per tanggal cutoff (Super Admin)
│       ├── ChangePasswordModal.js# Modal ubah password user
│       ├── ConfirmActionModal.js# Modal konfirmasi retur & cancel paket
│       ├── UserManagementModal.js# Kelola user operasional (Super Admin)
│       ├── MainTabs.js         # Navigation bar & penentu tab sesuai Role user
│       ├── DashboardScreen.js  # Analytic & grafik kinerja kios
      └── screens/
          ├── ScanScreen.js     # Tab 1: Scan paket sampai kios (hardware & kamera)
          ├── SelfPickupScreen.js# Tab 2: Ambilan customer kios (Self Pick Up)
          ├── GojekScreen.js    # Tab 3: Antrian pengiriman driver marketplace (Gojek/Grab)
          ├── BuybackScreen.js  # Tab 4: Modul khusus Buyback (Paste AWB-Kode, tanpa foto/driver)
          ├── CancelReturScreen.js# Tab 5: Manajemen paket Retur, Cancel, & Serah Terima Gudang
          ├── SemuaScreen.js    # Tab 6: Semua data paket & Import CSV
          ├── KanbanScreen.js   # Tab 7: Papan Kanban (Drag & drop, 9 kolom, windowing render, sort)
          ├── ManualInputModal.js# Modal input paket manual (saat barcode tak ditemukan)
          └── styles.js         # Layout styles terpusat untuk screens
├── server/                     # Backend Express.js API
│   ├── src/
│   │   ├── index.mjs           # Express API endpoints, status state machine, authorization, socket events
│   │   ├── db.mjs              # PostgreSQL pool setup, schema migration runner, initial seed users
│   │   ├── meili.mjs           # Meilisearch client wrapper, indexing & full-text search
│   │   └── schema.sql          # Skema DDL tabel & index PostgreSQL
│   ├── scripts/
│   │   └── dev.mjs             # Development script: jalankan embedded PostgreSQL di port 5433 & server
│   └── uploads/                # Direktori penyimpanan foto bukti konfirmasi (privat, butuh JWT)
└── deploy/                     # Docker & Production VPS Deployment
    ├── docker-compose.yml      # Service Postgres 17, Meilisearch, API, CloudBeaver
    ├── setup-vps.sh            # Script setup otomatis VPS Ubuntu/Debian
    ├── update.sh               # Script update & build otomatis VPS (pickhub-update)
    └── nginx.conf.example      # Template reverse proxy Nginx untuk VPS
```

---

## 2. Database Schema & Data Models (`server/src/schema.sql`)

### 2.1 Tabel `packages`
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | ID unik paket |
| `invoice_no` | `TEXT UNIQUE NOT NULL` | Nomor invoice / order (selalu di-UPPERCASE) |
| `awb_no` | `TEXT` | Nomor resi / AWB (selalu di-UPPERCASE) |
| `customer_name` | `TEXT NOT NULL DEFAULT ''` | Nama pembeli / penerima |
| `customer_phone` | `TEXT NOT NULL DEFAULT ''` | Nomor telepon customer (bisa tersensor `***` di CSV) |
| `item_desc` | `TEXT NOT NULL DEFAULT ''` | Deskripsi barang / produk |
| `seller_name` | `TEXT NOT NULL DEFAULT ''` | Nama toko / seller (diambil dari kolom `Customer` CSV) |
| `platform` | `TEXT NOT NULL DEFAULT ''` | Marketplace (Tokopedia, Shopee, TikTok, dll) |
| `courier` | `TEXT NOT NULL DEFAULT ''` | Kurir pengiriman dari CSV (mis. `Gosend`, `Shipped by Seller`) |
| `pickup_type` | `TEXT CHECK ('customer','gojek','anteran','buyback')` | Jenis alur pengambilan paket |
| `status` | `TEXT NOT NULL DEFAULT 'data_masuk'` | Status terkini dalam state machine |
| `pickup_code` | `TEXT UNIQUE` | Kode PIN pengambilan (di-generate sales/admin atau diisi paste) |
| `admin_note` | `TEXT NOT NULL DEFAULT ''` | Catatan internal kios (auto-save debounce 700ms) |
| `picker_name` | `TEXT NOT NULL DEFAULT ''` | Nama pengambil barang |
| `driver_info` | `TEXT NOT NULL DEFAULT ''` | Data driver marketplace (nama / no HP) |
| `driver_locked` | `BOOLEAN NOT NULL DEFAULT false` | Flag pengunci data driver permanen setelah `selesai` |
| `driver_refreshed` | `BOOLEAN NOT NULL DEFAULT false` | Tag `REFRESH` (menandai driver berganti) |
| `is_hold` | `BOOLEAN NOT NULL DEFAULT false` | Tag `HOLD` (menandai paket ditahan/pause) |
| `is_cari_driver` | `BOOLEAN NOT NULL DEFAULT false` | Tag `CARI DRIVER` (menandai admin sudah klik di MP) |
| `done_by` | `TEXT NOT NULL DEFAULT ''` | Nama staf kios yang memproses transaksi `selesai` |
| `source` | `TEXT NOT NULL DEFAULT 'import'` | Sumber data (`import` atau `manual`) |
| `raw` | `JSONB` | Data mentah baris CSV asli VEF |
| `archived` | `BOOLEAN NOT NULL DEFAULT false` | Flag pengarsipan otomatis |
| `archived_at` | `TIMESTAMPTZ` | Waktu paket diarsip |
| `received_at` | `TIMESTAMPTZ` | Jam paket discan tiba di kios |
| `gojek_at` | `TIMESTAMPTZ` | Jam paket masuk antrian ambilan driver |
| `done_at` | `TIMESTAMPTZ` | Jam paket transaksi selesai |
| `status_changed_at`| `TIMESTAMPTZ DEFAULT now()` | Jam terakhir kali status berubah (digunakan urutan Kanban) |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | Tanggal dibuat |
| `updated_at` | `TIMESTAMPTZ DEFAULT now()` | Tanggal diperbarui |

### 2.2 Tabel `package_photos`
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | ID foto |
| `package_id` | `INTEGER REFERENCES packages(id) ON DELETE CASCADE` | FK ke paket |
| `kind` | `TEXT CHECK ('wajah', 'ktp', 'barang')` | Jenis foto bukti |
| `filename` | `TEXT NOT NULL` | Nama file fisik di folder `server/uploads/` |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | Jam upload |

### 2.3 Tabel `package_events`
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | ID log riwayat |
| `package_id` | `INTEGER REFERENCES packages(id) ON DELETE CASCADE` | FK ke paket |
| `user_id` | `INTEGER` | ID user pelaku |
| `user_name` | `TEXT NOT NULL DEFAULT ''` | Nama user pelaku |
| `action` | `TEXT NOT NULL` | Jenis aksi (update, foto, scan_sampai, dll) |
| `detail` | `TEXT NOT NULL DEFAULT ''` | Detail rekaman perubahan |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | Jam kejadian |

### 2.4 Tabel `users`
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | ID user |
| `username` | `TEXT UNIQUE NOT NULL` | Username login |
| `password_hash`| `TEXT NOT NULL` | Hash bcrypt password |
| `display_name` | `TEXT NOT NULL` | Nama lengkap user |
| `role` | `TEXT CHECK ('superadmin','warehouse','admin','sales')` | Hak akses role |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | Jam dibuat |

### 2.5 Tabel `staff_names`
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | ID staf |
| `name` | `TEXT UNIQUE NOT NULL` | Nama staf kios |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | Tanggal didaftarkan |

---

## 3. State Machine & Aturan Alur Kerja Paket

```
                                [ Import CSV VEF / Input Manual ]
                                               │
                                               ▼
                                         (data_masuk)
                                               │
                      ┌────────────────────────┼────────────────────────┐
                      │ (Scan / Arrive)        │ (Scan / Arrive)        │ (Paste AWB-Kode)
                      ▼                        ▼                        ▼
           (absen_ambil_customer)        (absen_gojek)            (absen_buyback)
                      │                        │                        │
                      │                        ▼                        │
                      │                 (mencari_driver)                │
                      │                  ▲          │                   │
                      │                  │ (geser)  ▼                   │
                      │                 (driver_sampai_kios)            │
                      │                        │                        │
                      │ (Foto: 1 Wajah+1 Barang│ (Foto: Wajah+KTP+Barang) │ (Tanpa Foto)
                      └───────────────────────►┼◄───────────────────────┘
                                               │
                                               ▼
                                           (selesai)
                                               │
                                               ▼
                                            (retur)
                                    ┌──────────┴──────────┐
                                    │ (Gojek)             │ (Semua Tipe)
                                    ▼                     ▼
                             (mencari_driver)          (cancel)
                                                          │
                                                          ▼
                                                  (dikirim_ke_gudang)
                                                          │
                                                          ▼
                                                  (diterima_gudang)
```

### 3.1 Penjelasan Status (`STATUSES`)
1. **`data_masuk`**: Paket baru di-import CSV atau di-input manual. Belum tiba di kios.
2. **`absen_ambil_customer`**: Paket tiba di kios untuk ambilan sendiri customer (`customer` / `anteran` yang di-scan).
3. **`absen_gojek`**: Paket tiba di kios untuk pengiriman driver marketplace (`gojek`).
4. **`absen_buyback`**: Paket buyback diproses via paste AWB-Kode di tab Buyback (tanpa foto & tanpa driver).
5. **`mencari_driver`**: Admin kios sedang mencari driver di marketplace (Shopee/Gojek/Grab).
6. **`driver_sampai_kios`**: Driver marketplace sudah tiba di kios membawa armada.
7. **`selesai`**: Transaksi tuntas. Pengambilan dikonfirmasi dengan bukti foto (kecuali buyback) + penanda staf pemroses (`done_by`).
8. **`retur`**: Pengambilan gagal / driver mengembalikan barang / customer retur.
9. **`cancel`**: Dibatalkan oleh customer/marketplace.
10. **`dikirim_ke_gudang`**: Admin kios menyerahkan fisik barang cancel/retur ke kurir internal untuk dikembalikan ke gudang utama.
11. **`diterima_gudang`**: Tim warehouse menerima fisik barang di gudang utama (status final).

### 3.2 Syarat Foto Bukti Konfirmasi (`selesai`)
- **Paket Gojek**: Wajib 1 foto wajah driver + 1 foto KTP driver + 1 foto barang (3 foto).
- **Paket Self Pick Up (Customer)**: Wajib 1 foto pengambil + barang + 1 foto barang saja (2 foto).
- **Paket Buyback**: **Bebas / Tanpa foto** (server & UI melewatkan validasi foto).

### 3.3 Aturan Retur Berdasarkan Tipe Paket
- **Paket Gojek (`pickup_type === 'gojek'`)**: Di status `retur`, boleh di-antrikan lagi ke **`mencari_driver`** (cari driver baru) ATAU di-**`cancel`**.
- **Paket Ambilan / Buyback (`pickup_type !== 'gojek'`)**: Di status `retur`, **HANYA bisa di-`cancel`** (ditolak server jika mencoba ke `mencari_driver`).

---

## 4. API Endpoints Reference (`server/src/index.mjs`)

### 4.1 Authentikasi & User
- `POST /api/login` — Login user (body: `{ username, password }`), rate limiter max 10 percobaan / IP.
- `GET /api/users` — Daftar user (Super Admin).
- `POST /api/users` — Tambah user baru (Super Admin).
- `PATCH /api/users/:id` — Edit user / reset password (Super Admin).
- `DELETE /api/users/:id` — Hapus user (Super Admin).
- `POST /api/change-password` — Ganti password user sendiri.

### 4.2 Manajemen Paket
- `GET /api/packages` — Daftar & pencarian paket. Supports query params: `tab`, `q`, `invoice`, `customer`, `toko`, `courier`, `code`, `status`, `pickup_type`, `date`, `kanban=1`, `page`, `pageSize`.
- `GET /api/packages/:id` — Detail paket lengkap (termasuk events & photos).
- `POST /api/packages` — Input manual paket baru (body: `{ invoice_no, customer_name, customer_phone, item_desc, pickup_type, status, pickup_code }`). Invoice otomatis di-UPPERCASE.
- `PATCH /api/packages/:id` — Update paket.
  - Dilengkapi **`baseUpdatedAt` 409 conflict guard** (pengecekan presisi milidetik `date_trunc`).
  - Dilengkapi **Row Lock (`SELECT ... FOR UPDATE`)** & **`TRANSITIONS` state machine map**.
  - Mengukur `driver_locked` permanen dan penguncian transaksi tuntas (`selesai`, `retur`, `cancel`).
  - Membroadcast event socket **`package:updated` secara instan (0ms)**.
- `POST /api/packages/arrive` — Scan paket tiba di kios (by invoice/AWB uppercase). Status `data_masuk` → `absen_gojek` / `absen_ambil_customer`.
- `POST /api/packages/bulk-arrive` — Bulk scan paket anteran → customer.
- `DELETE /api/packages/bulk` — Bulk delete paket status `data_masuk`.
- `POST /api/packages/buyback-arrive` — Paste daftar `AWB - Kode` buyback → set `pickup_type='buyback'`, `pickup_code`, status `absen_buyback`.
- `POST /api/packages/ship-to-warehouse` — Serahkan fisik barang cancel ke kurir (`cancel` → `dikirim_ke_gudang`).
- `POST /api/packages/receive-at-warehouse` — Warehouse terima fisik barang (`dikirim_ke_gudang` → `diterima_gudang`).
- `POST /api/packages/find-by-code` — Cari paket by `pickup_code` (untuk scanner/sales).
- `POST /api/packages/:id/pickup-code` — Generate 8-digit random pickup code (Sales/Admin).

### 4.3 Foto Bukti & Pengarsipan
- `POST /api/packages/:id/photos` — Upload foto bukti (`kind`: `wajah`/`ktp`/`barang`). Dukung multipart & JSON base64.
- `DELETE /api/photos/:id` — Hapus foto bukti (terkunci jika paket tuntas/diarsip).
- `GET /uploads/:filename` — Akses file foto privat (wajib query `?token=` atau header `Bearer`).
- `POST /api/packages/archive` — Pengarsipan otomatis paket tuntas berdasarkan tanggal cutoff (Super Admin).
- `GET /api/archives/summary` — Ringkasan arsip per tanggal.
- `POST /api/archives/restore-by-date` — Pulihkan paket arsip ke aktif per tanggal (Super Admin).
- `POST /api/packages/:id/unarchive` — Pulihkan 1 paket dari arsip.

### 4.4 Import CSV (`POST /api/packages/import`)
- Menerima file multipart `file`, array JSON `{ rows }`, atau string mentah `{ csvText }`.
- Dukung delimiter `;`, `,`, dan `\t` (Tab TSV) via auto-detect.
- `csv-parse` terkonfigurasi `relax_quotes: true`, `relax_column_count: true` untuk menangani multiline string di dalam sel alamat/notes.
- Mengubah invoice & AWB menjadi **UPPERCASE** untuk cegah duplikat.
- Mengabaikan `pickup_code = '0'` dari export VEF.
- `COLUMN_ALIASES` fleksibel:
  - `invoice_no`: `no online order`, `id`, `invoice`, `no_invoice`, `booking id`, dll.
  - `awb_no`: `awb no`, `awb`, `resi`, `no_resi`, `tracking`, dll.
  - `customer_name`: `recipient`, `nama`, `customer_name`, dll.
  - `seller_name`: `customer`, `customer name`, `title`
  - `courier`: `courier name`, `kurir`, `courier`
  - `pickup_code`: `pickup code`, `kode pickup`, `pickup pin`, `passcode`, `otp`, dll.
- Klasifikasi kurir (`classifyPickup`):
  - mengandung `ambil` / `shipped by seller` → `customer`
  - mengandung `kurir internal` / `internal` → `anteran`
  - `spx` + `instant`/`same day` → `gojek`
  - `gojek`/`grab`/`gosend` → `gojek`
  - lainnya → `null` (skipped)

---

## 5. Fitur Utama Frontend & Komponen Utama

### 5.1 Real-Time Synchronized Socket
- `Socket.IO` membroadcast event:
  - **`package:updated`**: Broadcast paket spesifik yang baru diperbarui → Client menerima & mengupdate state array memory dalam **0–10ms** (tanpa re-fetch HTTP).
  - **`packages:changed`**: Refetch fallback untuk aksi massal (import/bulk).

### 5.2 Papan Kanban (`app/src/screens/KanbanScreen.js`)
- 9 Kolom Pipeline: `absen_ambil_customer`, `absen_gojek`, `absen_buyback`, `mencari_driver`, `driver_sampai_kios`, `selesai`, `retur`, `cancel`, `dikirim_ke_gudang`, `diterima_gudang`.
- **Urutan Stabil**: `ORDER BY COALESCE(status_changed_at, created_at) DESC, id DESC` — kartu yang baru digeser melompat ke **PALING ATAS** kolom baru; edit data in-place tidak mengubah posisi kartu.
- **Performance Windowing**: Setiap kolom hanya me-render **30 kartu pertama di awal**, dengan **Auto Infinite Scroll** (otomatis memuat +30 kartu saat discroll mendekati bawah, sisa 120px).
- **React.memo Optimization**: `KanbanCard` dibungkus `memo` dengan callback handler konstan (`useCallback`) sehingga re-render 1 kartu tidak membebankan kartu lain.
- **Sort By Toggle Per Kolom**: Setiap header kolom memiliki icon toggle `📉 Terbaru` / `📈 Terlama (FIFO)` independen per kolom.
- **HTML5 Drag & Drop (Web)**: Geser kartu antar-kolom di browser web dengan indikator slot putus-putus.

### 5.3 Modal Detail Paket (`app/src/PackageModal.js`)
- **Trello-Style Tag Picker (`TagPicker`)**: Satu chip `+ Tag` / `Tag (N)` → klik buka dropdown popover:
  - 🔴 `REFRESH (Driver Berganti)`
  - 🟡 `HOLD (Paket Ditahan)`
  - 🔵 `Cari Driver (sudah di MP)`
- **Paste Gambar `Ctrl+V` (Web)**: Tekan `Ctrl+V` di mana saja saat modal terbuka → foto dari clipboard otomatis di-upload dan di-assign ke slot foto yang belum lengkap (`wajah` → `ktp` → `barang`).
- **Layout Terurut**: Field *Data driver (Gojek)* diposisikan di atas *Admin note*.
- **Aksi Khusus**:
  - Gojek aktif (`absen_gojek`, `mencari_driver`, `driver_sampai_kios`): Tombol *"Batalkan Paket"* (Cancel) tersedia langsung di modal.
  - Driver sampai kios: Tombol *"Kembali ke Mencari Driver"* tersedia.
  - Buyback: Sembunyikan area foto & driver; tampilkan tombol *"Selesai"* langsung.

### 5.4 Modul Buyback (`app/src/screens/BuybackScreen.js`)
- Tab khusus untuk paket Buyback (`pickup_type === 'buyback'`).
- Area paste teks `AWB - Kode` (dukung delimiter ` - `, koma, tab, spasi).
- Tombol *"Proses Absen Buyback"* → memanggil API `POST /api/packages/buyback-arrive` → mengubah status ke `absen_buyback`.
- Menampilkan panel detail hasil: baris yang berhasil vs error (paket tak ditemukan, status bukan data_masuk, dll).

---

## 6. Riwayat Perbaikan Bug Penting & Pelajaran Terpetik

1. **409 Mismatch Presisi Timestamptz**:
   - *Masalah*: Postgres `timestamptz` menyimpan mikrodetik (`.221456Z`), tapi JSON `toISOString()` hanya membawa milidetik (`.221Z`). `WHERE updated_at = $base` selalu gagal 409.
   - *Solusi*: Dibandingkan dengan `date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', $base::timestamptz)`.

2. **Duplikat Paket Manual vs Import (Case-Sensitivity)**:
   - *Masalah*: Manual `inv-123` vs Import `INV-123` membuat 2 paket duplikat karena string Postgres case-sensitive.
   - *Solusi*: Semua invoice_no dan awb_no di-`UPPERCASE()` pada semua pintu masuk (input manual, import, scan).

3. **CSV Multiline di Sel Teks Quote**:
   - *Masalah*: Sel alamat/catatan VEF ber-Enter (`\n`) memecah baris CSV jika diparse naive di client JS.
   - *Solusi*: Client mengirim `csvText` mentah ke server; server memparse dengan `csv-parse` (`relax_quotes: true`, `relax_column_count: true`). `express.json()` limit diperbesar ke `20mb`.

4. **Constraint Database OVERWRITE saat Server Restart**:
   - *Masalah*: `db.mjs` memiliki hardcoded `ALTER TABLE packages ADD CONSTRAINT packages_pickup_type_check CHECK (pickup_type IN ('customer', 'gojek', 'anteran'))` yang dijalankan di `migrate()` tiap startup → menimpa `'buyback'`.
   - *Solusi*: `db.mjs` diperbarui menyertakan `'buyback'`.

5. **Toast Warning Crash (`react-native-toast-message`)**:
   - *Masalah*: Library Toast hanya mendukung `'success'`, `'error'`, `'info'`. Tipe `'warning'` melempar unhandled exception.
   - *Solusi*: `notice()` di `theme.js` memetakan `'warning'` → `'info'` secara aman.

6. **Native Gesture Handler Mismatch pada Expo Go**:
   - *Masalah*: `react-native-gesture-handler@3.2.1` membuat error `Unable to resolve ./hostInstance` di Expo Go SDK 57.
   - *Solusi*: Downgrade ke versi SDK 57 resmi `~2.32.0`.

---

## 7. Panduan Jalankan & Deployment

### 7.1 Menjalankan Dev Environment
```bash
# Terminal 1 — Backend & Database (Port API 4000, Embedded PG 5433)
cd server && npm install && npm run dev

# Terminal 2 — Frontend Expo (Port 8081)
cd app && npm install && npx expo start -c
# Tekan 'w' untuk buka Web Browser; scan QR code untuk Android
```

### 7.2 Credentials Login Dev Awal
- `superadmin` / `superadmin123` (Super Admin)
- `gudang` / `gudang123` (Warehouse)
- `admin` / `admin123` (Admin Kios)
- `sales` / `sales123` (Sales)

### 7.3 Deployment VPS & Update
```bash
# Di VPS Ubuntu/Debian (sebagai root di /opt/gudang-board):
git checkout -- .
git pull origin main
cd deploy && docker compose up -d --build
```
Atau jalankan alias script: `pickhub-update`.

---

## 8. Catatan untuk Agent Selanjutnnya
- **Jangan ubah alur VEF v2 retail pickup menjadi Kanban v1 ala Trello.**
- **Selalu sertakan `baseUpdatedAt: pkg.updated_at` saat mengirim `api.updatePackage`** agar guard concurrency 409 tetap melindungi data dari *stale overwrite*.
- **Semua No Invoice & AWB harus selalu di-upper-case-kan.**
- **Jika menambah kolom pickup_type / status baru**, pastikan memperbarui `schema.sql`, `db.mjs:migrate()`, `server/src/index.mjs:STATUSES/TRANSITIONS/TAB_FILTERS`, dan `app/src/theme.js:STATUS_META/NEXT_ACTIONS`.
