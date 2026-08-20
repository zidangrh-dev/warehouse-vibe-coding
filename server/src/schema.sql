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
--   selesai              : paket sudah di tangan customer / tuntas
--                         (konfirmasi pengambilan dgn foto langsung ke sini)
--   retur                : driver mengembalikan barang (bisa dicari driver lagi)
--   cancel               : dibatalkan customer
--   dikirim_ke_gudang    : admin kios menyerahkan barang cancel ke kurir untuk dikirim ke gudang
--   diterima_gudang      : tim warehouse menerima fisik barang cancel di gudang utama
CREATE TABLE IF NOT EXISTS packages (
  id SERIAL PRIMARY KEY,
  invoice_no TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  item_desc TEXT NOT NULL DEFAULT '',
  pickup_type TEXT NOT NULL DEFAULT 'customer' CHECK (pickup_type IN ('customer', 'gojek', 'anteran')),
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

-- Data driver: info driver diinput admin dalam SATU field gabungan
-- (nama / no HP / dll), di-copy sekaligus dari marketplace.
ALTER TABLE packages ADD COLUMN IF NOT EXISTS driver_info TEXT NOT NULL DEFAULT '';
-- Migrasi: gabung driver_name + driver_phone lama ke driver_info, lalu hapus
-- kolom lama. Idempoten — hanya jalan sekali (saat kolom lama masih ada).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'packages' AND column_name = 'driver_name') THEN
    UPDATE packages SET driver_info = trim(
      CASE WHEN driver_name <> '' THEN driver_name
        || CASE WHEN driver_phone <> '' THEN ' / ' || driver_phone ELSE '' END
        ELSE driver_phone END);
    ALTER TABLE packages DROP COLUMN driver_name;
    ALTER TABLE packages DROP COLUMN IF EXISTS driver_phone;
  END IF;
END $$;

-- Status 'done_pickup' dihapus dari alur — konfirmasi pengambilan langsung ke
-- 'selesai'. Paket yang masih di status itu dianggap sudah selesai.
-- Idempoten: tidak mengubah apa pun pada run berikutnya.
UPDATE packages SET status='selesai' WHERE status='done_pickup';

-- Status 'done_pickup' dihapus dari alur — konfirmasi pengambilan langsung ke
-- 'selesai'. Paket yang masih di status itu dianggap sudah selesai.
-- Idempoten: tidak mengubah apa pun pada run berikutnya.
UPDATE packages SET status='selesai' WHERE status='done_pickup';

-- Flag manual "REFRESH": menandai bahwa driver pernah diganti/cancel di tengah alur.
ALTER TABLE packages ADD COLUMN IF NOT EXISTS driver_refreshed BOOLEAN NOT NULL DEFAULT false;

-- Flag manual "HOLD": menandai paket yang ditahan/di-pause sementara.
ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_hold BOOLEAN NOT NULL DEFAULT false;

-- Flag manual "Cari Driver": menandai bahwa admin sudah mengklik Cari Driver di marketplace untuk paket ini.
ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_cari_driver BOOLEAN NOT NULL DEFAULT false;

-- Migrasi constraint pickup_type: dukung 'anteran' (kurir internal).
-- Idempoten — selalu aman dijalankan saat restart server.
ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_pickup_type_check;
ALTER TABLE packages ADD CONSTRAINT packages_pickup_type_check CHECK (pickup_type IN ('customer', 'gojek', 'anteran'));

-- Kunci PERMANEN data driver: diset true saat status bergerak ke selesai.
-- Setelah paket sekali selesai diangkut, data driver TIDAK boleh diubah lagi
-- (tetap terkunci walaupun paket diretur lalu dimasukkan ke antrian lagi).
ALTER TABLE packages ADD COLUMN IF NOT EXISTS driver_locked BOOLEAN NOT NULL DEFAULT false;
-- Backfill data lama: paket yang sudah berada di status tuntas juga terkunci
-- permanen (idempoten — tidak mengubah apa pun pada run berikutnya).
UPDATE packages SET driver_locked=true
  WHERE status IN ('selesai', 'retur', 'cancel') AND NOT driver_locked;

-- Status 'data_driver_ready' dihapus dari alur — paket yang masih di status itu
-- dianggap sudah memasuki 'driver_sampai_kios' (data driver sudah terisi).
-- Idempoten: tidak mengubah apa pun pada run berikutnya.
UPDATE packages SET status='driver_sampai_kios' WHERE status='data_driver_ready';

-- Jam terakhir kali status/kolom berubah (dipakai untuk urutan Kanban: paket baru digeser -> paling atas)
ALTER TABLE packages ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT now();
UPDATE packages SET status_changed_at = updated_at WHERE status_changed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_packages_awb ON packages(awb_no);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
CREATE INDEX IF NOT EXISTS idx_packages_pickup_code ON packages(pickup_code);
-- Kanban & daftar mengurutkan paket berdasarkan jam pergeseran status & id terbaru;
-- tanpa index ini Postgres full-scan + sort seluruh tabel setiap papan dibuka.
CREATE INDEX IF NOT EXISTS idx_packages_kanban_updated ON packages (status_changed_at DESC, id DESC) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_events_package ON package_events(package_id);

-- Daftar nama staf kios (dikelola admin) sebagai pilihan penanda siapa yang
-- memproses konfirmasi done pickup. packages.done_by menyimpan snapshot teks
-- nama — mengubah/menghapus daftar tidak mengubah paket lama.
CREATE TABLE IF NOT EXISTS staff_names (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Penanda staf yang memproses konfirmasi done pickup ('selesai').
ALTER TABLE packages ADD COLUMN IF NOT EXISTS done_by TEXT NOT NULL DEFAULT '';
