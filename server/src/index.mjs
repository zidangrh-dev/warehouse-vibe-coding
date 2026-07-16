import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import crypto from 'node:crypto';
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

app.use(cors());
app.use(express.json());

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
const TABS = {
  scan: ['data_masuk'],
  customer: ['absen_ambil_customer'],
  gojek: ['absen_gojek', 'mencari_driver', 'driver_sampai_kios', 'done_pickup', 'retur'],
  selesai: ['selesai', 'cancel'],
};

// ---- Packages ----
app.get('/api/packages', requireAuth, wrap(async (req, res) => {
  const { tab, q } = req.query;
  const cond = [];
  const values = [];
  if (tab && TABS[tab]) {
    values.push(TABS[tab]);
    cond.push(`status = ANY($${values.length})`);
  }
  if (q) {
    values.push(`%${q}%`);
    cond.push(`(invoice_no ILIKE $${values.length} OR awb_no ILIKE $${values.length} OR customer_name ILIKE $${values.length} OR pickup_code ILIKE $${values.length})`);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const r = await pool.query(
    `SELECT * FROM packages ${where} ORDER BY updated_at DESC LIMIT 500`, values);
  res.json(r.rows);
}));

app.get('/api/packages/:id', requireAuth, wrap(async (req, res) => {
  const r = await pool.query('SELECT * FROM packages WHERE id=$1', [Number(req.params.id)]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Paket tidak ditemukan' });
  const events = await pool.query(
    'SELECT * FROM package_events WHERE package_id=$1 ORDER BY id DESC', [r.rows[0].id]);
  res.json({ ...r.rows[0], events: events.rows });
}));

// Input manual (paket tidak ada di data import).
app.post('/api/packages', requireAuth, requireRole('admin', 'warehouse'), wrap(async (req, res) => {
  const { invoice_no, customer_name, customer_phone, item_desc, pickup_type, status } = req.body;
  if (!invoice_no?.trim()) return res.status(400).json({ error: 'No invoice wajib diisi' });
  const st = STATUSES.includes(status) ? status
    : pickup_type === 'gojek' ? 'absen_gojek' : 'absen_ambil_customer';
  const r = await pool.query(
    `INSERT INTO packages (invoice_no, customer_name, customer_phone, item_desc, pickup_type, status, source, received_at)
     VALUES ($1,$2,$3,$4,$5,$6,'manual',now())
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
  const allowed = ['customer_name', 'customer_phone', 'item_desc', 'pickup_type', 'status', 'admin_note', 'picker_name'];
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
    `UPDATE packages SET status=$2, received_at=now(), updated_at=now() WHERE id=$1 RETURNING *`,
    [pkg.id, st]);
  await logEvent(pkg.id, req.user, 'scan_sampai', `status -> ${st}`);
  notify();
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

// Admin scan pickup code milik customer -> paket selesai.
app.post('/api/packages/redeem', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const code = String(req.body.code || '').trim();
  const found = await pool.query('SELECT * FROM packages WHERE pickup_code=$1', [code]);
  const pkg = found.rows[0];
  if (!pkg) return res.status(404).json({ error: 'Pickup code tidak dikenal' });
  if (pkg.status === 'selesai') return res.status(409).json({ error: 'Paket ini sudah diambil', package: pkg });
  const r = await pool.query(
    `UPDATE packages SET status='selesai', picker_name=$2, done_at=now(), updated_at=now()
     WHERE id=$1 RETURNING *`,
    [pkg.id, String(req.body.picker_name || '')]);
  await logEvent(pkg.id, req.user, 'diambil_customer', `kode ${code}`);
  notify();
  res.json(r.rows[0]);
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
    let inserted = 0, updated = 0, skipped = 0;
    for (const rawRow of rows) {
      const m = mapRow(rawRow);
      if (!m.invoice_no) { skipped++; continue; }
      const r = await pool.query(
        `INSERT INTO packages (invoice_no, awb_no, customer_name, customer_phone, item_desc, platform, courier, pickup_code, raw, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NULLIF($8,''),$9,'import')
         ON CONFLICT (invoice_no) DO UPDATE SET
           awb_no = CASE WHEN EXCLUDED.awb_no <> '' THEN EXCLUDED.awb_no ELSE packages.awb_no END,
           customer_name = CASE WHEN EXCLUDED.customer_name <> '' THEN EXCLUDED.customer_name ELSE packages.customer_name END,
           customer_phone = CASE WHEN EXCLUDED.customer_phone <> '' THEN EXCLUDED.customer_phone ELSE packages.customer_phone END,
           item_desc = CASE WHEN EXCLUDED.item_desc <> '' THEN EXCLUDED.item_desc ELSE packages.item_desc END,
           platform = CASE WHEN EXCLUDED.platform <> '' THEN EXCLUDED.platform ELSE packages.platform END,
           courier = CASE WHEN EXCLUDED.courier <> '' THEN EXCLUDED.courier ELSE packages.courier END,
           pickup_code = COALESCE(packages.pickup_code, EXCLUDED.pickup_code),
           raw = EXCLUDED.raw, updated_at = now()
         RETURNING (xmax = 0) AS is_new`,
        [m.invoice_no, m.awb_no, m.customer_name, m.customer_phone, m.item_desc,
         m.platform, m.courier, m.pickup_code, JSON.stringify(m.raw)]
      );
      r.rows[0].is_new ? inserted++ : updated++;
    }
    notify();
    res.json({ inserted, updated, skipped, total: rows.length });
  }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

await migrate();
await seedIfEmpty();
server.listen(PORT, () => console.log(`API siap di http://localhost:${PORT}`));
