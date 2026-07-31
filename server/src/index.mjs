import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { parse as parseCsv } from 'csv-parse/sync';
import { Server } from 'socket.io';
import { pool, migrate, seedIfEmpty } from './db.mjs';

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-gudang-board';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '.jpg') || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

const notify = () => io.emit('packages:changed');

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

// ---- Auth ----
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Silakan login dulu' });
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: `Hanya untuk role: ${roles.join('/')}` });
  }
  next();
};

app.post('/api/login', wrap(async (req, res) => {
  const { username, password } = req.body;
  const r = await pool.query('SELECT * FROM users WHERE username=$1', [String(username || '').toLowerCase()]);
  const user = r.rows[0];
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }
  const payload = { id: user.id, username: user.username, name: user.display_name, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: payload });
}));

app.get('/api/me', requireAuth, (req, res) => res.json(req.user));

// ---- Helpers ----
async function logEvent(pkgId, user, action, detail = '') {
  await pool.query(
    `INSERT INTO package_events (package_id, user_id, user_name, action, detail)
     VALUES ($1,$2,$3,$4,$5)`,
    [pkgId, user?.id || null, user?.name || 'sistem', action, detail]
  );
}

const STATUSES = [
  'data_masuk', 'absen_ambil_customer', 'absen_gojek', 'mencari_driver',
  'driver_sampai_kios', 'done_pickup', 'retur', 'selesai', 'cancel',
];

// Tab di aplikasi -> kumpulan status yang ditampilkan.
// retur & cancel kini punya modul sendiri (cancelretur), bukan di gojek.
const TABS = {
  scan: ['data_masuk'],
  selfpickup: ['absen_ambil_customer'],
  gojek: ['absen_gojek', 'mencari_driver', 'driver_sampai_kios', 'done_pickup'],
  cancelretur: ['cancel', 'retur'],
  selesai: ['selesai'],
};

// Syarat foto konfirmasi pengambilan (gojek done_pickup & self-pickup selesai).
const REQUIRED_PHOTOS = { wajah: 1, ktp: 1, barang: 1 };
const PHOTO_KINDS = ['wajah', 'ktp', 'barang'];

async function photoStatus(pkgId) {
  const r = await pool.query(
    `SELECT kind, count(*)::int n FROM package_photos WHERE package_id=$1 GROUP BY kind`, [pkgId]);
  const n = Object.fromEntries(r.rows.map((x) => [x.kind, x.n]));
  const missing = PHOTO_KINDS.filter((k) => (n[k] || 0) < REQUIRED_PHOTOS[k]);
  return { ok: missing.length === 0, n, missing };
}

const PHOTO_LABEL = { wajah: 'wajah', ktp: 'KTP', barang: 'barang' };

// ---- Packages ----
// Mode daftar: paginasi (page/pageSize) supaya tabel besar tetap ringan.
// Mode cari: bila ada `q`, paginasi dibypass — cari ke seluruh data (dibatasi
// SEARCH_CAP demi keamanan), sehingga hasil tidak terpotong per halaman.
const SEARCH_CAP = 1000;
app.get('/api/packages', requireAuth, wrap(async (req, res) => {
  const { tab, q } = req.query;
  const cond = [];
  const values = [];
  if (tab && TABS[tab]) {
    values.push(TABS[tab]);
    cond.push(`status = ANY($${values.length})`);
  }
  const searching = !!(q && String(q).trim());
  if (searching) {
    values.push(`%${String(q).trim()}%`);
    cond.push(`(invoice_no ILIKE $${values.length} OR awb_no ILIKE $${values.length} OR customer_name ILIKE $${values.length} OR pickup_code ILIKE $${values.length})`);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

  const countRes = await pool.query(`SELECT count(*)::int AS n FROM packages ${where}`, values);
  const total = countRes.rows[0].n;

  if (searching) {
    const r = await pool.query(
      `SELECT * FROM packages ${where} ORDER BY updated_at DESC LIMIT ${SEARCH_CAP}`, values);
    return res.json({ items: r.rows, total, page: 1, pageSize: r.rows.length, searching: true });
  }

  const pageSize = Math.min(200, Math.max(10, parseInt(req.query.pageSize, 10) || 50));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
  values.push(pageSize);
  const limIdx = values.length;
  values.push((page - 1) * pageSize);
  const offIdx = values.length;
  const r = await pool.query(
    `SELECT * FROM packages ${where} ORDER BY updated_at DESC LIMIT $${limIdx} OFFSET $${offIdx}`, values);
  res.json({ items: r.rows, total, page, pageSize, searching: false });
}));

app.get('/api/packages/:id', requireAuth, wrap(async (req, res) => {
  const r = await pool.query('SELECT * FROM packages WHERE id=$1', [Number(req.params.id)]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Paket tidak ditemukan' });
  const events = await pool.query(
    'SELECT * FROM package_events WHERE package_id=$1 ORDER BY id DESC', [r.rows[0].id]);
  const photos = await pool.query(
    'SELECT * FROM package_photos WHERE package_id=$1 ORDER BY id', [r.rows[0].id]);
  res.json({ ...r.rows[0], events: events.rows, photos: photos.rows });
}));

// Upload bukti foto (wajah driver / barang) saat driver mengambil paket.
app.post('/api/packages/:id/photos', requireAuth, requireRole('admin'),
  photoUpload.single('photo'), wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File foto tidak ada' });
    const kind = PHOTO_KINDS.includes(req.body.kind) ? req.body.kind : 'barang';
    const id = Number(req.params.id);
    const r = await pool.query(
      'INSERT INTO package_photos (package_id, kind, filename) VALUES ($1,$2,$3) RETURNING *',
      [id, kind, req.file.filename]);
    await logEvent(id, req.user, 'foto', kind);
    notify();
    res.status(201).json(r.rows[0]);
  }));

app.delete('/api/photos/:id', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const r = await pool.query(
    'DELETE FROM package_photos WHERE id=$1 RETURNING *', [Number(req.params.id)]);
  if (r.rows[0]) {
    fs.rm(path.join(UPLOAD_DIR, r.rows[0].filename), () => {});
    notify();
  }
  res.json({ ok: true });
}));

// Input manual (paket tidak ada di data import).
app.post('/api/packages', requireAuth, requireRole('admin', 'warehouse'), wrap(async (req, res) => {
  const { invoice_no, customer_name, customer_phone, item_desc, pickup_type, status } = req.body;
  if (!invoice_no?.trim()) return res.status(400).json({ error: 'No invoice wajib diisi' });
  const st = STATUSES.includes(status) ? status
    : pickup_type === 'gojek' ? 'absen_gojek' : 'absen_ambil_customer';
  const r = await pool.query(
    `INSERT INTO packages (invoice_no, customer_name, customer_phone, item_desc, pickup_type, status, source, received_at, gojek_at)
     VALUES ($1,$2,$3,$4,$5,$6,'manual',now(), CASE WHEN $6='absen_gojek' THEN now() ELSE NULL END)
     ON CONFLICT (invoice_no) DO NOTHING RETURNING *`,
    [invoice_no.trim(), customer_name || '', customer_phone || '', item_desc || '',
     pickup_type === 'gojek' ? 'gojek' : 'customer', st]
  );
  if (!r.rows[0]) return res.status(409).json({ error: 'No invoice sudah terdaftar' });
  await logEvent(r.rows[0].id, req.user, 'input_manual', `status awal ${st}`);
  notify();
  res.status(201).json(r.rows[0]);
}));

app.patch('/api/packages/:id', requireAuth, wrap(async (req, res) => {
  const id = Number(req.params.id);
  // pickup_type sengaja TIDAK termasuk: jenis ambilan dikunci pada data yang
  // ditentukan admin gudang saat input/import, tidak boleh diubah sesudahnya.
  const allowed = ['customer_name', 'customer_phone', 'item_desc', 'status', 'admin_note', 'picker_name'];
  const sets = [];
  const values = [id];
  for (const key of allowed) {
    if (key in req.body) {
      if (key === 'status' && !STATUSES.includes(req.body.status)) {
        return res.status(400).json({ error: 'Status tidak dikenal' });
      }
      values.push(req.body[key]);
      sets.push(`${key}=$${values.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Tidak ada field yang diubah' });

  const cur = await pool.query('SELECT pickup_type, status FROM packages WHERE id=$1', [id]);
  const pt = cur.rows[0]?.pickup_type;
  // Konfirmasi pengambilan wajib bukti foto (1 wajah + 1 KTP + 1 barang):
  //   - gojek     : transisi ke done_pickup
  //   - self pick up: transisi ke selesai
  const isConfirm =
    (req.body.status === 'done_pickup' && pt === 'gojek') ||
    (req.body.status === 'selesai' && pt === 'customer');
  if (isConfirm) {
    const chk = await photoStatus(id);
    if (!chk.ok) {
      const need = chk.missing.map((k) => `foto ${PHOTO_LABEL[k]}`).join(', ');
      return res.status(400).json({ error: `Belum bisa dikonfirmasi — lengkapi ${need} (1 masing-masing).` });
    }
  }
  // Catat jam masuk antrian ambilan gojek.
  if (req.body.status === 'absen_gojek') sets.push('gojek_at=now()');
  if (req.body.status === 'selesai' || req.body.status === 'done_pickup') sets.push('done_at=now()');
  const r = await pool.query(
    `UPDATE packages SET ${sets.join(', ')}, updated_at=now() WHERE id=$1 RETURNING *`, values);
  if (!r.rows[0]) return res.status(404).json({ error: 'Paket tidak ditemukan' });
  await logEvent(id, req.user, 'update',
    req.body.status ? `status -> ${req.body.status}` : `ubah ${sets.map(s => s.split('=')[0]).join(', ')}`);
  notify();
  res.json(r.rows[0]);
}));

// Scan paket sampai kios: cocokkan invoice hasil scan dengan data import.
app.post('/api/packages/arrive', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const code = String(req.body.invoice_no || '').trim();
  if (!code) return res.status(400).json({ error: 'Invoice kosong' });
  // Label fisik paket biasanya memuat AWB/resi, kadang no order — cocokkan keduanya.
  const found = await pool.query(
    'SELECT * FROM packages WHERE invoice_no=$1 OR awb_no=$1', [code]);
  const pkg = found.rows[0];
  if (!pkg) return res.status(404).json({ error: 'Data paket tidak ditemukan. Tanya Sales, lalu input manual.' });
  if (pkg.status !== 'data_masuk') {
    return res.status(409).json({ error: `Paket sudah discan (status: ${pkg.status})`, package: pkg });
  }
  const st = pkg.pickup_type === 'gojek' ? 'absen_gojek' : 'absen_ambil_customer';
  const r = await pool.query(
    `UPDATE packages SET status=$2, received_at=now(),
       gojek_at = CASE WHEN $2='absen_gojek' THEN now() ELSE gojek_at END,
       updated_at=now() WHERE id=$1 RETURNING *`,
    [pkg.id, st]);
  await logEvent(pkg.id, req.user, 'scan_sampai', `status -> ${st}`);
  notify();
  res.json(r.rows[0]);
}));

// Cari paket berdasarkan pickup code (untuk konfirmasi self pick up).
app.post('/api/packages/find-by-code', requireAuth, requireRole('admin', 'sales'), wrap(async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Kode kosong' });
  const r = await pool.query('SELECT * FROM packages WHERE pickup_code=$1', [code]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Pickup code tidak dikenal' });
  res.json(r.rows[0]);
}));

// Sales membuat pickup code untuk paket.
app.post('/api/packages/:id/pickup-code', requireAuth, requireRole('sales', 'admin'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomInt(0, 100000000).toString().padStart(8, '0');
    try {
      const r = await pool.query(
        `UPDATE packages SET pickup_code=$2, updated_at=now() WHERE id=$1 RETURNING *`, [id, code]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Paket tidak ditemukan' });
      await logEvent(id, req.user, 'generate_code', code);
      notify();
      return res.json(r.rows[0]);
    } catch (e) {
      if (!String(e.message).includes('duplicate')) throw e; // tabrakan kode: coba lagi
    }
  }
  res.status(500).json({ error: 'Gagal membuat kode unik, coba lagi' });
}));

// Import CSV dari VEF (warehouse). Nama kolom dideteksi fleksibel;
// alias disusun berdasarkan export asli VEF/ERPNext (sales_invoice.csv).
const COLUMN_ALIASES = {
  invoice_no: ['no online order', 'no_online_order', 'id', 'invoice', 'no_invoice', 'no invoice', 'invoice_no', 'no. invoice', 'booking id'],
  awb_no: ['awb no', 'awb_no', 'awb', 'resi', 'no resi', 'no_resi', 'tracking'],
  customer_name: ['recipient', 'nama', 'nama_customer', 'nama customer', 'name', 'penerima', 'customer_name'],
  customer_phone: ['recipient number', 'recipient_number', 'hp', 'no_hp', 'no hp', 'phone', 'telp', 'telepon', 'no_telp', 'whatsapp', 'wa'],
  item_desc: ['item', 'barang', 'produk', 'product', 'deskripsi', 'description', 'nama_barang', 'nama barang', 'title'],
  platform: ['commerce platform', 'marketplace', 'platform'],
  courier: ['courier name', 'kurir', 'courier'],
  pickup_code: ['pickup code', 'pickup_code', 'kode pickup'],
};

function mapRow(row) {
  const lower = {};
  for (const [k, v] of Object.entries(row)) lower[k.toLowerCase().trim()] = String(v ?? '').trim();
  const pick = (field) => {
    for (const alias of COLUMN_ALIASES[field]) if (lower[alias]) return lower[alias];
    return '';
  };
  return {
    invoice_no: pick('invoice_no'),
    awb_no: pick('awb_no'),
    customer_name: pick('customer_name'),
    customer_phone: pick('customer_phone'),
    item_desc: pick('item_desc'),
    platform: pick('platform'),
    courier: pick('courier'),
    pickup_code: pick('pickup_code'),
    raw: row,
  };
}

// Jenis ambilan ditentukan dari nama kurir (kolom "Courier Name" VEF):
//   - "Ambil Customer Langsung" (mengandung "ambil")   -> 'customer'
//   - Gojek / Grab / SPX / GoSend (kurir instant)       -> 'gojek'
//   - selain itu (J&T, JNE, Anteraja, Paxel, Kurir Internal, kosong) -> null = tidak diimpor
// Nama kurir asli tetap disimpan apa adanya (tidak diseragamkan jadi "Gojek").
function classifyPickup(courierName) {
  const c = (courierName || '').toLowerCase();
  if (!c) return null;
  if (c.includes('ambil')) return 'customer';
  if (/(gojek|grab|spx|gosend)/.test(c)) return 'gojek';
  return null;
}

app.post('/api/packages/import', requireAuth, requireRole('warehouse', 'admin'),
  upload.single('file'), wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File CSV tidak ada' });
    const text = req.file.buffer.toString('utf8');
    const delimiter = (text.split('\n')[0].match(/;/g) || []).length >
      (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    let rows;
    try {
      rows = parseCsv(text, { columns: true, bom: true, trim: true, skip_empty_lines: true, delimiter });
    } catch (e) {
      return res.status(400).json({ error: `CSV tidak bisa dibaca: ${e.message}` });
    }
    let inserted = 0, updated = 0, skipped = 0, skippedCourier = 0;
    for (const rawRow of rows) {
      const m = mapRow(rawRow);
      if (!m.invoice_no) { skipped++; continue; }
      const ptype = classifyPickup(m.courier);
      // Hanya paket Gojek/Grab/SPX (driver) & Ambil Customer yang diimpor.
      // Ekspedisi reguler / kurir internal / tanpa kurir dilewati.
      if (!ptype) { skippedCourier++; continue; }
      const r = await pool.query(
        `INSERT INTO packages (invoice_no, awb_no, customer_name, customer_phone, item_desc, platform, courier, pickup_type, pickup_code, raw, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULLIF($9,''),$10,'import')
         ON CONFLICT (invoice_no) DO UPDATE SET
           awb_no = CASE WHEN EXCLUDED.awb_no <> '' THEN EXCLUDED.awb_no ELSE packages.awb_no END,
           customer_name = CASE WHEN EXCLUDED.customer_name <> '' THEN EXCLUDED.customer_name ELSE packages.customer_name END,
           customer_phone = CASE WHEN EXCLUDED.customer_phone <> '' THEN EXCLUDED.customer_phone ELSE packages.customer_phone END,
           item_desc = CASE WHEN EXCLUDED.item_desc <> '' THEN EXCLUDED.item_desc ELSE packages.item_desc END,
           platform = CASE WHEN EXCLUDED.platform <> '' THEN EXCLUDED.platform ELSE packages.platform END,
           courier = CASE WHEN EXCLUDED.courier <> '' THEN EXCLUDED.courier ELSE packages.courier END,
           pickup_type = EXCLUDED.pickup_type,
           pickup_code = COALESCE(packages.pickup_code, EXCLUDED.pickup_code),
           raw = EXCLUDED.raw, updated_at = now()
         RETURNING (xmax = 0) AS is_new`,
        [m.invoice_no, m.awb_no, m.customer_name, m.customer_phone, m.item_desc,
         m.platform, m.courier, ptype, m.pickup_code, JSON.stringify(m.raw)]
      );
      r.rows[0].is_new ? inserted++ : updated++;
    }
    notify();
    res.json({ inserted, updated, skipped: skipped + skippedCourier, skippedCourier, total: rows.length });
  }));

// ---- Dashboard/laporan (admin only) — agregasi untuk memantau kinerja role lain ----

app.get('/api/dashboard/summary', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const byStatus = await pool.query(`SELECT status, count(*)::int AS n FROM packages GROUP BY status`);
  const totals = await pool.query(`
    SELECT
      count(*) FILTER (WHERE created_at::date = current_date)::int AS today,
      count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week,
      count(*) FILTER (WHERE status NOT IN ('selesai','cancel'))::int AS pending,
      count(*) FILTER (WHERE pickup_type='gojek' AND status NOT IN ('selesai','cancel','retur'))::int AS gojek_active,
      round(extract(epoch FROM avg(done_at - received_at) FILTER (WHERE done_at IS NOT NULL AND received_at IS NOT NULL)))::int AS avg_pickup_seconds
    FROM packages`);
  res.json({ by_status: byStatus.rows, ...totals.rows[0] });
}));

app.get('/api/dashboard/throughput', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
  const r = await pool.query(`
    SELECT d::date AS day,
      (SELECT count(*) FROM packages WHERE received_at::date = d::date)::int AS received,
      (SELECT count(*) FROM packages WHERE done_at::date = d::date AND status='selesai')::int AS completed,
      (SELECT count(*) FROM packages WHERE done_at::date = d::date AND status='retur')::int AS retur
    FROM generate_series(current_date - ($1::int - 1), current_date, interval '1 day') d
    ORDER BY d`, [days]);
  res.json(r.rows);
}));

app.get('/api/dashboard/activity', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const days = Math.min(180, Math.max(1, Number(req.query.days) || 30));
  const r = await pool.query(`
    SELECT pe.user_name, u.role, pe.action, count(*)::int AS n
    FROM package_events pe
    LEFT JOIN users u ON u.id = pe.user_id
    WHERE pe.created_at >= now() - ($1::int * interval '1 day')
    GROUP BY pe.user_name, u.role, pe.action
    ORDER BY pe.user_name, pe.action`, [days]);
  res.json(r.rows);
}));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

await migrate();
await seedIfEmpty();
server.listen(PORT, () => console.log(`API siap di http://localhost:${PORT}`));
