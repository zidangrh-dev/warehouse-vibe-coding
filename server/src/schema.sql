-- v2: pivot dari kanban ke tracking paket retail pickup.
-- Tabel v1 (kanban) dibuang — hanya berisi data uji coba.
DROP TABLE IF EXISTS card_photos;
DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS lists;
DROP TABLE IF EXISTS boards;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'warehouse', 'admin', 'sales')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Status paket:
--   data_masuk           : hasil import CSV VEF, paket belum sampai kios
--   absen_ambil_customer : paket sampai & discan, menunggu diambil customer
--   absen_gojek          : paket sampai, akan diambilkan driver Gojek
--   mencari_driver       : admin sedang mencari driver di marketplace
--   driver_sampai_kios   : driver tiba di kios
--   done_pickup          : paket dibawa driver
--   retur                : driver mengembalikan barang (bisa dicari driver lagi)
--   selesai              : paket sudah di tangan customer / tuntas
--   cancel               : dibatalkan customer
CREATE TABLE IF NOT EXISTS packages (
  id SERIAL PRIMARY KEY,
  invoice_no TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  item_desc TEXT NOT NULL DEFAULT '',
  pickup_type TEXT NOT NULL DEFAULT 'customer' CHECK (pickup_type IN ('customer', 'gojek')),
  status TEXT NOT NULL DEFAULT 'data_masuk',
  pickup_code TEXT UNIQUE,
  admin_note TEXT NOT NULL DEFAULT '',
  picker_name TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'import',
  raw JSONB,
  received_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS package_events (
  id SERIAL PRIMARY KEY,
  package_id INTEGER REFERENCES packages(id) ON DELETE CASCADE,
  user_id INTEGER,
  user_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kolom tambahan menyesuaikan export VEF asli (sales_invoice.csv).
ALTER TABLE packages ADD COLUMN IF NOT EXISTS awb_no TEXT;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT '';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS courier TEXT NOT NULL DEFAULT '';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Bukti foto konfirmasi pengambilan (gojek & self pick up):
-- 'wajah' (wajah driver/pengambil), 'ktp' (KTP driver/pengambil), 'barang'.
-- Syarat konfirmasi: 1 foto wajah + 1 foto KTP + 1 foto barang.
CREATE TABLE IF NOT EXISTS package_photos (
  id SERIAL PRIMARY KEY,
  package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photos_package ON package_photos(package_id);

-- Migrasi: perbarui jenis foto (dulu hanya driver/barang) -> wajah/ktp/barang.
ALTER TABLE package_photos DROP CONSTRAINT IF EXISTS package_photos_kind_check;
UPDATE package_photos SET kind='wajah' WHERE kind='driver';
ALTER TABLE package_photos ADD CONSTRAINT package_photos_kind_check
  CHECK (kind IN ('wajah', 'ktp', 'barang'));

-- Waktu paket masuk ke antrian ambilan gojek (untuk kolom "Update" modul Gojek).
ALTER TABLE packages ADD COLUMN IF NOT EXISTS gojek_at TIMESTAMPTZ;

-- Data driver (status 'data_driver_ready'): nama & no HP driver yang diinput
-- admin dari data marketplace sebelum paket dijemput driver.
ALTER TABLE packages ADD COLUMN IF NOT EXISTS driver_name TEXT NOT NULL DEFAULT '';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS driver_phone TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_packages_awb ON packages(awb_no);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
CREATE INDEX IF NOT EXISTS idx_packages_pickup_code ON packages(pickup_code);
CREATE INDEX IF NOT EXISTS idx_events_package ON package_events(package_id);
