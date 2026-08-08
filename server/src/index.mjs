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

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-secret-gudang-board') {
  console.error('⚠️ JWT_SECRET belum diset di .env production! Server menolak untuk berjalan (pakai secret default = celah keamanan).');
  process.exit(1);
}

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [
      'https://apps-pickhub.cloud',
      'http://202.10.44.147',
      'http://localhost:8081',
      'http://localhost:4000',
      'http://localhost:19006',
    ];

const corsOptions = {
  origin: (origin, callback) => {
    // izinkan request tanpa origin (seperti mobile app/APK atau curl) atau origin yang terdaftar
    if (!origin || ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Akses diblokir oleh CORS policy'));
    }
  },
  credentials: true,
};

const app = express();
// Percaya satu lapis proxy (nginx). Tanpa ini `req.ip` = 127.0.0.1 untuk
// semua client di belakang proxy, sehingga rate limiter login mengunci
// seluruh server setelah 10 percobaan gabungan.
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype] || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

app.use(cors(corsOptions));
app.use(express.json());

// Foto bukti (terutama KTP/wajah) TIDAK boleh diakses publik. Memverifikasi
// JWT lewat query `?token=` (dipakai <Image>/<img> yang tidak bisa kirim
// header Authorization) ATAU header `Authorization: Bearer`.
app.use('/uploads', (req, res, next) => {
  const token = req.query.token || (req.headers.authorization || '').replace(/^Bearer /, '');
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Akses ke foto butuh autentikasi' });
  }
}, express.static(UPLOAD_DIR));

const notify = () => io.emit('packages:changed');

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    const safeError = process.env.NODE_ENV === 'production' ? 'Terjadi kesalahan pada server' : err.message;
    res.status(500).json({ error: safeError });
  });

// ---- In-Memory Rate Limiter untuk Login ----
const loginAttempts = new Map();

// IP klien yang BUKAN bisa dipalsukan. nginx (satu-satunya ingress) menata
// `X-Forwarded-For` via $proxy_add_x_forwarded_for = meneruskan spoof client
// lalu MENAMBAHKAN IP asli client di paling belakang. Jadi entri TERAKHIR
// selalu ditulis nginx = IP klien yang sebenarnya.
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const parts = String(xff).split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function rateLimitLogin(req, res, next) {
  const ip = clientIp(req) || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 menit
  const maxAttempts = 10;

  const record = loginAttempts.get(ip) || { count: 0, resetTime: now + windowMs };

  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + windowMs;
  }

  if (record.count >= maxAttempts) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.' });
  }

  record.count += 1;
  loginAttempts.set(ip, record);
  next();
}

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

app.post('/api/login', rateLimitLogin, wrap(async (req, res) => {
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

// ---- User Management (Super Admin Only) ----
const ALLOWED_ROLES = ['superadmin', 'admin', 'sales', 'warehouse'];

app.get('/api/users', requireAuth, requireRole('superadmin'), wrap(async (_req, res) => {
  const r = await pool.query('SELECT id, username, display_name, role, created_at FROM users ORDER BY id ASC');
  res.json(r.rows);
}));

app.post('/api/users', requireAuth, requireRole('superadmin'), wrap(async (req, res) => {
  const { username, password, display_name, role } = req.body;
  const uname = String(username || '').trim().toLowerCase();
  const name = String(display_name || '').trim();
  const pass = String(password || '').trim();
  const rRole = String(role || '').trim().toLowerCase();

  if (!uname || !pass || !name || !rRole) {
    return res.status(400).json({ error: 'Username, nama, password, dan role wajib diisi' });
  }
  if (pass.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }
  if (!ALLOWED_ROLES.includes(rRole)) {
    return res.status(400).json({ error: 'Role tidak valid' });
  }

  const existing = await pool.query('SELECT id FROM users WHERE username=$1', [uname]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Username sudah digunakan' });
  }

  const hash = bcrypt.hashSync(pass, 10);
  const r = await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4) RETURNING id, username, display_name, role, created_at`,
    [uname, hash, name, rRole]
  );
  res.status(201).json(r.rows[0]);
}));

app.patch('/api/users/:id', requireAuth, requireRole('superadmin'), wrap(async (req, res) => {
  const targetId = Number(req.params.id);
  const { display_name, role, password } = req.body;

  const targetRes = await pool.query('SELECT * FROM users WHERE id=$1', [targetId]);
  const targetUser = targetRes.rows[0];
  if (!targetUser) return res.status(404).json({ error: 'User tidak ditemukan' });

  const sets = [];
  const values = [targetId];

  if (display_name && String(display_name).trim()) {
    values.push(String(display_name).trim());
    sets.push(`display_name=$${values.length}`);
  }
  if (role && String(role).trim()) {
    const rRole = String(role).trim().toLowerCase();
    if (!ALLOWED_ROLES.includes(rRole)) return res.status(400).json({ error: 'Role tidak valid' });

    // Proteksi: jangan sampai role Super Admin terakhir diturunkan jabatannya
    if (targetUser.role === 'superadmin' && rRole !== 'superadmin') {
      const superRes = await pool.query("SELECT count(*)::int AS n FROM users WHERE role='superadmin'");
      if (superRes.rows[0].n <= 1) {
        return res.status(400).json({ error: 'Gagal: Minimal harus ada 1 akun Super Admin di sistem' });
      }
    }

    values.push(rRole);
    sets.push(`role=$${values.length}`);
  }
  if (password && String(password).trim()) {
    const pass = String(password).trim();
    if (pass.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }
    values.push(bcrypt.hashSync(pass, 10));
    sets.push(`password_hash=$${values.length}`);
  }

  if (!sets.length) return res.status(400).json({ error: 'Tidak ada data yang diubah' });

  const r = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id=$1 RETURNING id, username, display_name, role, created_at`,
    values
  );
  res.json(r.rows[0]);
}));

app.delete('/api/users/:id', requireAuth, requireRole('superadmin'), wrap(async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Tidak bisa menghapus akun Anda sendiri' });
  }
  const targetRes = await pool.query('SELECT * FROM users WHERE id=$1', [targetId]);
  const targetUser = targetRes.rows[0];
  if (!targetUser) return res.status(404).json({ error: 'User tidak ditemukan' });

  // Proteksi: jangan sampai akun Super Admin terakhir dihapus
  if (targetUser.role === 'superadmin') {
    const superRes = await pool.query("SELECT count(*)::int AS n FROM users WHERE role='superadmin'");
    if (superRes.rows[0].n <= 1) {
      return res.status(400).json({ error: 'Gagal: Minimal harus ada 1 akun Super Admin di sistem' });
    }
  }

  await pool.query('DELETE FROM users WHERE id=$1', [targetId]);
  res.json({ ok: true });
}));

// ---- Helpers ----
async function logEvent(pkgId, user, action, detail = '') {
  await pool.query(
    `INSERT INTO package_events (package_id, user_id, user_name, action, detail)
     VALUES ($1,$2,$3,$4,$5)`,
    [pkgId || null, user?.id || null, user?.name || 'sistem', action, detail]
  );
}

const STATUSES = [
  'data_masuk', 'absen_ambil_customer', 'absen_gojek', 'mencari_driver',
  'data_driver_ready', 'driver_sampai_kios', 'done_pickup', 'retur', 'selesai', 'cancel',
];

// Tab di aplikasi -> status + (opsional) pickup_type. selfpickup & gojek
// berbagi status done_pickup, jadi dibedakan lewat pickup_type agar tidak
// saling loncat modul. retur & cancel punya modul sendiri (cancelretur).
const TAB_FILTERS = {
  scan: { statuses: ['data_masuk'] },
  selfpickup: { statuses: ['absen_ambil_customer', 'done_pickup'], pickup_type: 'customer' },
  gojek: { statuses: ['absen_gojek', 'mencari_driver', 'data_driver_ready', 'driver_sampai_kios', 'done_pickup', 'selesai'], pickup_type: 'gojek' },
  cancelretur: { statuses: ['cancel', 'retur'] },
  selesai: { statuses: ['selesai'] },
};

// Kolom untuk daftar paket (tanpa `raw` yang berat — raw hanya dipakai di detail).
const PACKAGE_LIST_COLUMNS = `id, invoice_no, awb_no, customer_name, customer_phone, item_desc,
  platform, courier, pickup_type, status, pickup_code, admin_note, picker_name, source,
  received_at, done_at, created_at, updated_at, gojek_at, archived, archived_at,
  driver_name, driver_phone, driver_locked`;

// Syarat foto konfirmasi pengambilan:
//   Gojek        : 1 wajah driver + 1 KTP driver + 1 barang (3 foto)
//   Self Pick Up : 1 foto pengambil + barang + 1 foto barang (2 foto)
const PHOTO_KINDS = ['wajah', 'ktp', 'barang'];

async function photoStatus(pkgId) {
  const pkgRes = await pool.query('SELECT pickup_type FROM packages WHERE id=$1', [pkgId]);
  const pkg = pkgRes.rows[0];
  const isGojek = pkg?.pickup_type === 'gojek';

  const requiredMap = isGojek
    ? { wajah: 1, ktp: 1, barang: 1 }
    : { wajah: 1, barang: 1 };

  const photoKinds = Object.keys(requiredMap);

  const r = await pool.query(
    `SELECT kind, count(*)::int n FROM package_photos WHERE package_id=$1 GROUP BY kind`, [pkgId]);
  const n = Object.fromEntries(r.rows.map((x) => [x.kind, x.n]));
  const missing = photoKinds.filter((k) => (n[k] || 0) < requiredMap[k]);
  return { ok: missing.length === 0, n, missing, isGojek };
}

const PHOTO_LABEL = { wajah: 'pengambil/driver + barang', ktp: 'KTP', barang: 'barang' };

// ---- Packages ----
// Mode daftar: paginasi (page/pageSize) supaya tabel besar tetap ringan.
// Mode cari: bila ada filter / query q, cari ke seluruh data tanpa batas (unlimited).
app.get('/api/packages', requireAuth, wrap(async (req, res) => {
  const { tab, q, invoice, customer, toko, courier, code, status, pickup_type } = req.query;
  const cond = [];
  const values = [];

  // Tab arsip khusus Super Admin (archived = true)
  // Tab lain (scan, selfpickup, gojek, cancelretur, semua) hanya menampilkan data aktif (archived = false)
  if (tab === 'arsip') {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang dapat mengakses tabel arsip' });
    }
    cond.push('archived = true');
  } else {
    cond.push('archived = false');
  }

  const filter = tab && TAB_FILTERS[tab];
  if (filter) {
    values.push(filter.statuses);
    cond.push(`status = ANY($${values.length})`);
    if (filter.pickup_type) {
      values.push(filter.pickup_type);
      cond.push(`pickup_type = $${values.length}`);
    }
  }

  if (invoice && String(invoice).trim()) {
    values.push(`%${String(invoice).trim()}%`);
    cond.push(`(invoice_no ILIKE $${values.length} OR awb_no ILIKE $${values.length})`);
  }
  if (customer && String(customer).trim()) {
    values.push(`%${String(customer).trim()}%`);
    cond.push(`(customer_name ILIKE $${values.length} OR customer_phone ILIKE $${values.length})`);
  }
  if (toko && String(toko).trim()) {
    values.push(`%${String(toko).trim()}%`);
    cond.push(`(platform ILIKE $${values.length} OR item_desc ILIKE $${values.length})`);
  }
  if (courier && String(courier).trim()) {
    values.push(`%${String(courier).trim()}%`);
    cond.push(`courier ILIKE $${values.length}`);
  }
  if (code && String(code).trim()) {
    values.push(`%${String(code).trim()}%`);
    cond.push(`pickup_code ILIKE $${values.length}`);
  }
  if (status && String(status).trim()) {
    values.push(String(status).trim());
    cond.push(`status = $${values.length}`);
  }
  if (pickup_type && String(pickup_type).trim()) {
    values.push(String(pickup_type).trim());
    cond.push(`pickup_type = $${values.length}`);
  }

  const searching = !!(
    (q && String(q).trim()) ||
    (invoice && String(invoice).trim()) ||
    (customer && String(customer).trim()) ||
    (toko && String(toko).trim()) ||
    (courier && String(courier).trim()) ||
    (code && String(code).trim()) ||
    (status && String(status).trim()) ||
    (pickup_type && String(pickup_type).trim())
  );

  if (q && String(q).trim()) {
    values.push(`%${String(q).trim()}%`);
    cond.push(`(invoice_no ILIKE $${values.length} OR awb_no ILIKE $${values.length} OR customer_name ILIKE $${values.length} OR pickup_code ILIKE $${values.length} OR status ILIKE $${values.length} OR courier ILIKE $${values.length} OR platform ILIKE $${values.length} OR driver_name ILIKE $${values.length} OR driver_phone ILIKE $${values.length})`);
  }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

  const countRes = await pool.query(`SELECT count(*)::int AS n FROM packages ${where}`, values);
  const total = countRes.rows[0].n;

  // Pencarian DAN daftar sama-sama dipaginasi: server selalu mengembalikan halaman
  // kecil (max 200 baris) sehingga payload & render tetap ringan, walau pencarian
  // tetap menjangkau SELURUH data. `searching` hanya penanda untuk label UI.
  const pageSize = Math.min(200, Math.max(10, parseInt(req.query.pageSize, 10) || 50));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
  values.push(pageSize);
  const limIdx = values.length;
  values.push((page - 1) * pageSize);
  const offIdx = values.length;
  const r = await pool.query(
    `SELECT ${PACKAGE_LIST_COLUMNS} FROM packages ${where} ORDER BY updated_at DESC LIMIT $${limIdx} OFFSET $${offIdx}`, values);
  res.json({ items: r.rows, total, page, pageSize, searching });
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
// Mendukung multipart/form-data DAN JSON base64 agar aman dari bug FormData native.
app.post('/api/packages/:id/photos', requireAuth, requireRole('superadmin', 'admin'),
  (req, res, next) => {
    if (req.is('json') || (req.headers['content-type'] && req.headers['content-type'].includes('application/json'))) {
      return next();
    }
    photoUpload.single('photo')(req, res, next);
  },
  wrap(async (req, res) => {
    const id = Number(req.params.id);

    // KUNCI KEAMANAN: Cegah manipulasi foto pada transaksi yang sudah dikonfirmasi atau diarsip
    const pkgCheck = await pool.query('SELECT status, archived FROM packages WHERE id=$1', [id]);
    const pkg = pkgCheck.rows[0];
    if (!pkg) return res.status(404).json({ error: 'Paket tidak ditemukan' });
    if (pkg.archived) {
      return res.status(400).json({ error: 'Paket ini telah diarsip dan tidak dapat diubah oleh siapapun.' });
    }
    if (['done_pickup', 'selesai', 'retur', 'cancel'].includes(pkg.status)) {
      return res.status(400).json({ error: 'Foto terkunci! Tidak dapat menambah foto pada transaksi yang sudah dikonfirmasi.' });
    }

    const kind = PHOTO_KINDS.includes(req.body?.kind) ? req.body.kind : 'barang';
    let filename = '';

    if (req.file) {
      filename = req.file.filename;
    } else if (req.body?.base64 || req.body?.photoBase64) {
      const rawBase64 = req.body.base64 || req.body.photoBase64;
      const cleanBase64 = rawBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      // Ekstensi DIWHITELIST — jangan terima `ext` mentah dari client
      // (jalur multipart pakai filter MIME, jalur base64 harus konsisten).
      const ext = ['.jpg', '.png', '.webp'].includes(String(req.body?.ext || '')) ? req.body.ext : '.jpg';
      filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
    } else {
      return res.status(400).json({ error: 'File foto atau data base64 tidak ada' });
    }

    const r = await pool.query(
      'INSERT INTO package_photos (package_id, kind, filename) VALUES ($1,$2,$3) RETURNING *',
      [id, kind, filename]);
    await logEvent(id, req.user, 'foto', kind);
    notify();
    res.status(201).json(r.rows[0]);
  }));

app.delete('/api/photos/:id', requireAuth, requireRole('superadmin', 'admin'), wrap(async (req, res) => {
  const photoId = Number(req.params.id);

  // KUNCI KEAMANAN: Periksa status paket induk untuk mencegah penghapusan foto bukti
  const photoRes = await pool.query(
    `SELECT p.id, p.filename, pkg.status, pkg.archived
     FROM package_photos p
     JOIN packages pkg ON pkg.id = p.package_id
     WHERE p.id = $1`,
    [photoId]
  );
  const photo = photoRes.rows[0];
  if (!photo) return res.status(404).json({ error: 'Foto tidak ditemukan' });

  if (photo.archived) {
    return res.status(400).json({ error: 'Paket ini telah diarsip dan foto tidak dapat dihapus.' });
  }
  if (['done_pickup', 'selesai', 'retur', 'cancel'].includes(photo.status)) {
    return res.status(400).json({ error: 'Foto terkunci! Tidak dapat menghapus foto pada transaksi yang sudah dikonfirmasi.' });
  }

  await pool.query('DELETE FROM package_photos WHERE id=$1', [photoId]);
  fs.rm(path.join(UPLOAD_DIR, photo.filename), () => {});
  notify();
  res.json({ ok: true });
}));

// Input manual (paket tidak ada di data import).
app.post('/api/packages', requireAuth, requireRole('superadmin', 'admin', 'warehouse'), wrap(async (req, res) => {
  const { invoice_no, customer_name, customer_phone, item_desc, pickup_type, status, pickup_code } = req.body;
  if (!invoice_no?.trim()) return res.status(400).json({ error: 'No invoice wajib diisi' });
  const st = STATUSES.includes(status) ? status
    : pickup_type === 'gojek' ? 'absen_gojek' : 'absen_ambil_customer';
  const cleanCode = pickup_code?.trim() || null;

  const r = await pool.query(
    `INSERT INTO packages (invoice_no, customer_name, customer_phone, item_desc, pickup_type, status, pickup_code, source, received_at, gojek_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'manual',now(), CASE WHEN $6='absen_gojek' THEN now() ELSE NULL END)
     ON CONFLICT (invoice_no) DO NOTHING RETURNING *`,
    [invoice_no.trim(), customer_name || '', customer_phone || '', item_desc || '',
     pickup_type === 'gojek' ? 'gojek' : 'customer', st, cleanCode]
  );
  if (!r.rows[0]) return res.status(409).json({ error: 'No invoice sudah terdaftar' });
  await logEvent(r.rows[0].id, req.user, 'input_manual', `status awal ${st}${cleanCode ? ` (pickup code: ${cleanCode})` : ''}`);
  notify();
  res.status(201).json(r.rows[0]);
}));

app.patch('/api/packages/:id', requireAuth, wrap(async (req, res) => {
  const id = Number(req.params.id);

  // KUNCI KEAMANAN ARSIP: Paket yang diarsip terkunci permanen untuk siapapun
  const chkArc = await pool.query('SELECT archived, status, driver_locked FROM packages WHERE id=$1', [id]);
  if (chkArc.rows[0]?.archived) {
    return res.status(400).json({ error: 'Paket ini telah diarsip dan tidak dapat diubah oleh siapapun.' });
  }

  // Kunci PERMANEN data driver: setelah paket sekali dilakukan Done Pickup,
  // data driver TIDAK boleh diganti — berlaku bahkan jika paket diretur lalu
  // dimasukkan ke antrian lagi (status berubah, flag driver_locked tetap).
  if (chkArc.rows[0]?.driver_locked &&
      ('driver_name' in req.body || 'driver_phone' in req.body)) {
    return res.status(400).json({ error: 'Data driver terkunci permanen karena paket ini sudah pernah diangkut — tidak dapat diubah.' });
  }

  // Data driver & pickup code TERKUNCI setelah transaksi tuntas/dikonfirmasi
  // (done_pickup, selesai, retur, cancel) — tidak boleh diubah lagi.
  if (['done_pickup', 'selesai', 'retur', 'cancel'].includes(chkArc.rows[0]?.status)) {
    const bad = Object.keys(req.body).filter((k) => k === 'driver_name' || k === 'driver_phone' || k === 'pickup_code');
    if (bad.length > 0) {
      return res.status(400).json({ error: bad.includes('pickup_code') ? 'Pickup code terkunci setelah transaksi tuntas.' : 'Data driver terkunci setelah transaksi tuntas — tidak dapat diubah.' });
    }
  }

  // pickup_type sengaja TIDAK termasuk: jenis ambilan dikunci pada data yang
  // ditentukan admin gudang saat input/import, tidak boleh diubah sesudahnya.
  const allowed = ['customer_name', 'customer_phone', 'item_desc', 'status', 'admin_note', 'picker_name', 'pickup_code', 'driver_name', 'driver_phone'];

  // Role operasional (admin/warehouse) boleh field utama; pickup code boleh
  // sales ATAU admin (admin juga membutuhkannya saat mengisi data driver dari
  // marketplace). Field lain oleh sales wajib ditolak server.
  const isOperational = ['superadmin', 'admin', 'warehouse'].includes(req.user.role);
  const forbidden = Object.keys(req.body).filter((k) => {
    if (!allowed.includes(k)) return false;
    if (k === 'pickup_code') return !['sales', 'admin', 'superadmin', 'warehouse'].includes(req.user.role);
    if (isOperational) return false;                            // operasional boleh
    return true;                                                // sales: field lain dilarang
  });
  if (forbidden.length > 0) {
    return res.status(403).json({ error: `Role Anda tidak berhak mengubah: ${forbidden.join(', ')}` });
  }

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

  // Konfirmasi pengambilan (transisi ke done_pickup) wajib bukti foto
  // 1 wajah + 1 KTP + 1 barang — berlaku untuk gojek maupun self pick up.
  if (req.body.status === 'done_pickup') {
    const chk = await photoStatus(id);
    if (!chk.ok) {
      const need = chk.missing.map((k) => `foto ${PHOTO_LABEL[k]}`).join(', ');
      return res.status(400).json({ error: `Belum bisa dikonfirmasi — lengkapi ${need} (1 masing-masing).` });
    }
  }
  // Done Pickup untuk paket GOJEK juga WAJIB punya data driver (nama + no HP);
  // selain dijaga di UI, diamankan juga di server.
  if (req.body.status === 'done_pickup') {
    const d = await pool.query('SELECT pickup_type, driver_name, driver_phone FROM packages WHERE id=$1', [id]);
    if (d.rows[0]?.pickup_type === 'gojek') {
      const name = String(d.rows[0]?.driver_name ?? '').trim();
      const phone = String(d.rows[0]?.driver_phone ?? '').trim();
      if (!name || !phone) {
        return res.status(400).json({ error: 'Data driver (nama & no HP) wajib diisi sebelum Done Pickup.' });
      }
    }
  }
  // Status 'data_driver_ready' & 'driver_sampai_kios' WAJIB punya data driver
  // (nama + no HP) — diinput admin dari marketplace. Tanpa itu, tak boleh lanjut.
  if (req.body.status === 'data_driver_ready' || req.body.status === 'driver_sampai_kios') {
    const d = await pool.query('SELECT driver_name, driver_phone FROM packages WHERE id=$1', [id]);
    const name = String(req.body.driver_name ?? d.rows[0]?.driver_name ?? '').trim();
    const phone = String(req.body.driver_phone ?? d.rows[0]?.driver_phone ?? '').trim();
    if (!name || !phone) {
      return res.status(400).json({ error: 'Nama driver dan No HP driver wajib diisi sebelum lanjut.' });
    }
  }
  // Catat jam masuk antrian ambilan gojek.
  if (req.body.status === 'absen_gojek') sets.push('gojek_at=now()');
  if (req.body.status === 'selesai' || req.body.status === 'done_pickup') sets.push('done_at=now()');
  // Done Pickup = data driver terkunci PERMANEN (walau retur & diantrikan lagi).
  if (req.body.status === 'done_pickup') sets.push('driver_locked=true');
  const r = await pool.query(
    `UPDATE packages SET ${sets.join(', ')}, updated_at=now() WHERE id=$1 RETURNING *`, values);
  if (!r.rows[0]) return res.status(404).json({ error: 'Paket tidak ditemukan' });
  // Riwayat detail: status + data driver disebut eksplisit biar jelas record-nya.
  const detailParts = [];
  if (req.body.status) detailParts.push(`status -> ${req.body.status}`);
  if ('driver_name' in req.body) detailParts.push(`driver (nama): ${req.body.driver_name.trim() || '—'}`);
  if ('driver_phone' in req.body) detailParts.push(`driver (no HP): ${req.body.driver_phone.trim() || '—'}`);
  if (!detailParts.length) detailParts.push(`ubah ${sets.map(s => s.split('=')[0]).join(', ')}`);
  await logEvent(id, req.user, 'update', detailParts.join(' | '));
  notify();
  res.json(r.rows[0]);
}));

// Arsip data paket berdasarkan tanggal cutoff (Khusus Super Admin)
app.post('/api/packages/archive', requireAuth, requireRole('superadmin'), wrap(async (req, res) => {
  const { beforeDate, mode = 'before', onlyCompleted = true } = req.body;
  if (!beforeDate) return res.status(400).json({ error: 'Tanggal batas (beforeDate) wajib diisi' });

  let timeCondition = `created_at < $1::date`;
  if (mode === 'exact') {
    timeCondition = `created_at::date = $1::date`;
  } else if (mode === 'on_or_before') {
    timeCondition = `created_at <= ($1::date + interval '1 day')`;
  }

  let statusCondition = '';
  if (onlyCompleted) {
    statusCondition = `AND status IN ('selesai', 'done_pickup', 'retur', 'cancel')`;
  }

  const r = await pool.query(
    `UPDATE packages
     SET archived = true, archived_at = now()
     WHERE ${timeCondition} ${statusCondition} AND archived = false
     RETURNING id`,
    [beforeDate]
  );
  await logEvent(null, req.user, 'archive_packages', `Mengarsip ${r.rowCount} paket (mode: ${mode}, cutoff: ${beforeDate})`);
  notify();
  res.json({ ok: true, count: r.rowCount });
}));

// Pulihkan / Batalkan arsip paket (Khusus Super Admin)
app.post('/api/packages/:id/unarchive', requireAuth, requireRole('superadmin'), wrap(async (req, res) => {
  const { id } = req.params;
  const r = await pool.query(
    `UPDATE packages SET archived = false, archived_at = NULL WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Paket tidak ditemukan' });
  await logEvent(id, req.user, 'unarchive', 'Mengembalikan paket dari arsip ke data aktif');
  notify();
  res.json({ ok: true, package: r.rows[0] });
}));

app.post('/api/packages/unarchive-bulk', requireAuth, requireRole('superadmin'), wrap(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Pilih minimal satu paket' });
  }
  const r = await pool.query(
    `UPDATE packages SET archived = false, archived_at = NULL WHERE id = ANY($1::int[]) RETURNING id`,
    [ids]
  );
  await logEvent(null, req.user, 'unarchive_bulk', `Mengembalikan ${r.rowCount} paket dari arsip ke data aktif`);
  notify();
  res.json({ ok: true, count: r.rowCount });
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
app.post('/api/packages/:id/pickup-code', requireAuth, requireRole('sales'), wrap(async (req, res) => {
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
  pickup_code: ['pickup code', 'pickup_code', 'kode pickup', 'kode_pickup', 'pickup pin', 'pickup_pin', 'pin', 'code', 'kode', 'passcode', 'otp'],
};

// Excel sering mengkonversi angka panjang menjadi notasi ilmiah (5.85316E+17).
// Fungsi ini mengembalikannya ke string angka penuh.
function fixSciNotation(val) {
  const s = String(val ?? '').trim();
  if (/^[\d.]+[eE][+\-]?\d+$/.test(s)) {
    try {
      const n = Number(s);
      if (Number.isFinite(n)) return n.toLocaleString('fullwide', { useGrouping: false });
    } catch {}
  }
  return s;
}

function mapRow(row) {
  const lower = {};
  for (const [k, v] of Object.entries(row)) lower[k.toLowerCase().trim()] = String(v ?? '').trim();
  const pick = (field) => {
    for (const alias of COLUMN_ALIASES[field]) if (lower[alias]) return lower[alias];
    return '';
  };
  return {
    invoice_no: fixSciNotation(pick('invoice_no')),
    awb_no: fixSciNotation(pick('awb_no')),
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
//   - "Ambil Customer Langsung" (mengandung "ambil")            -> 'customer'
//   - Gojek / Grab / GoSend serta SPX Instant & SPX Same Day    -> 'gojek'
//   - selain itu (SPX Hemat/Standard, J&T, JNE, Anteraja, Paxel,
//     Kurir Internal, kosong)                                   -> null = tidak diimpor
// SPX Express punya banyak varian: Hemat/Standard = kurir reguler (bukan ojol),
// sedangkan Instant/Same Day = kurir instan/ojol.
// Nama kurir asli tetap disimpan apa adanya (tidak diseragamkan jadi "Gojek").
function classifyPickup(courierName) {
  const c = (courierName || '').toLowerCase();
  if (!c) return null;
  if (c.includes('ambil')) return 'customer';
  if (c.includes('spx')) {
    return /instant|same[\s-]*day/.test(c) ? 'gojek' : null;
  }
  if (/(gojek|grab|gosend)/.test(c)) return 'gojek';
  return null;
}

app.post('/api/packages/import', requireAuth, requireRole('superadmin', 'warehouse'),
  (req, res, next) => {
    if (req.is('json') || (req.headers['content-type'] && req.headers['content-type'].includes('application/json'))) {
      return next();
    }
    upload.single('file')(req, res, next);
  },
  wrap(async (req, res) => {
    let rows;
    if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows;
    } else {
      let text = '';
      if (req.file) {
        text = req.file.buffer.toString('utf8');
      } else if (req.body?.text || req.body?.csvText) {
        text = req.body.text || req.body.csvText;
      } else {
        return res.status(400).json({ error: 'File CSV atau data teks tidak ada' });
      }
      const delimiter = (text.split('\n')[0].match(/;/g) || []).length >
        (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
      try {
        rows = parseCsv(text, { columns: true, bom: true, trim: true, skip_empty_lines: true, delimiter });
      } catch (e) {
        return res.status(400).json({ error: `CSV tidak bisa dibaca: ${e.message}` });
      }
    }

    const norm = (str) => String(str || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
    let inserted = 0, updated = 0, skipped = 0, skippedCourier = 0;
    const invoiceSeen = new Set();

    for (const rawRow of rows) {
      const m = mapRow(rawRow);
      if (!m.invoice_no) { skipped++; continue; }

      const cleanInvoice = norm(m.invoice_no);
      if (invoiceSeen.has(cleanInvoice)) {
        skipped++;
        continue;
      }
      invoiceSeen.add(cleanInvoice);

      const ptype = classifyPickup(m.courier);
      // Hanya paket Gojek/Grab/GoSend + SPX Instant/Same Day (ojol) & Ambil Customer yang diimpor.
      // Ekspedisi reguler (SPX Hemat/Standard, J&T, JNE, dll) / kurir internal / tanpa kurir dilewati.
      if (!ptype) { skippedCourier++; continue; }

      let codeToSet = norm(m.pickup_code);
      if (codeToSet) {
        // Cek apakah pickup_code sudah dipakai oleh paket lain di database
        const codeExist = await pool.query('SELECT invoice_no FROM packages WHERE pickup_code = $1 AND invoice_no <> $2', [codeToSet, cleanInvoice]);
        if (codeExist.rows.length > 0) {
          codeToSet = '';
        }
      }

      try {
        const cleanAwb = norm(m.awb_no);
        let existingRes;
        if (cleanAwb) {
          existingRes = await pool.query('SELECT * FROM packages WHERE invoice_no = $1 OR (awb_no <> \'\' AND awb_no = $2)', [cleanInvoice, cleanAwb]);
        } else {
          existingRes = await pool.query('SELECT * FROM packages WHERE invoice_no = $1', [cleanInvoice]);
        }
        const isReturnRow = cleanInvoice.startsWith('R/') || cleanInvoice.startsWith('r/') ||
                            (m.raw?.Status || '').toLowerCase() === 'return' ||
                            String(m.raw?.['Is Return (Credit Note)'] || '') === '1';
        const initialStatus = isReturnRow ? 'retur' : 'data_masuk';

        if (!existingRes.rows.length) {
          // Paket BARU! Insert ke DB
          await pool.query(
            `INSERT INTO packages (invoice_no, awb_no, customer_name, customer_phone, item_desc, platform, courier, pickup_type, pickup_code, status, raw, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULLIF($9,''),$10,$11,'import')`,
            [cleanInvoice, norm(m.awb_no), norm(m.customer_name), norm(m.customer_phone), norm(m.item_desc),
             norm(m.platform), norm(m.courier), ptype, codeToSet, initialStatus, JSON.stringify(m.raw)]
          );
          inserted++;
        } else {
          // Paket SUDAH ADA di DB! Field lain (nama, phone, barang, dll) TIDAK BOLEH diubah oleh CSV baru.
          // Hanya Pickup Code (jika DB masih kosong) dan status retur yang boleh di-update.
          const ex = existingRes.rows[0];
          let hasChange = false;
          const updates = [];
          const vals = [ex.id];

          if (isReturnRow && ex.status !== 'retur') {
            hasChange = true; vals.push('retur'); updates.push(`status=$${vals.length}`);
          }
          if (codeToSet && codeToSet !== norm(ex.pickup_code) && (!ex.pickup_code || ex.pickup_code === '')) {
            hasChange = true; vals.push(codeToSet); updates.push(`pickup_code=$${vals.length}`);
          }

          if (hasChange) {
            vals.push(JSON.stringify(m.raw));
            updates.push(`raw=$${vals.length}`);
            await pool.query(`UPDATE packages SET ${updates.join(', ')}, updated_at=now() WHERE id=$1`, vals);
            updated++;
          } else {
            skipped++;
          }
        }
      } catch (err) {
        console.error('Error importing row:', cleanInvoice, err.message);
        skipped++;
      }
    }
    notify();
    res.json({ inserted, updated, skipped: skipped + skippedCourier, skippedCourier, total: rows.length });
  }));

// ---- Dashboard/laporan (admin only) — agregasi untuk memantau kinerja role lain ----

app.get('/api/dashboard/summary', requireAuth, requireRole('superadmin', 'admin'), wrap(async (req, res) => {
  const { startDate, endDate } = req.query;
  let byStatus, totals;
  if (startDate && endDate) {
    byStatus = await pool.query(
      `SELECT status, count(*)::int AS n FROM packages WHERE archived = false AND created_at >= $1::date AND created_at <= ($2::date + interval '1 day') GROUP BY status`,
      [startDate, endDate]
    );
    totals = await pool.query(
      `SELECT
        count(*) FILTER (WHERE created_at::date = current_date)::int AS today,
        count(*) FILTER (WHERE created_at >= $1::date AND created_at <= ($2::date + interval '1 day'))::int AS week,
        count(*) FILTER (WHERE status NOT IN ('selesai','cancel') AND created_at >= $1::date AND created_at <= ($2::date + interval '1 day'))::int AS pending,
        count(*) FILTER (WHERE pickup_type='gojek' AND status NOT IN ('selesai','cancel','retur') AND created_at >= $1::date AND created_at <= ($2::date + interval '1 day'))::int AS gojek_active,
        round(extract(epoch FROM avg(done_at - received_at) FILTER (WHERE done_at IS NOT NULL AND received_at IS NOT NULL AND created_at >= $1::date AND created_at <= ($2::date + interval '1 day'))))::int AS avg_pickup_seconds
      FROM packages
      WHERE archived = false`,
      [startDate, endDate]
    );
  } else {
    byStatus = await pool.query(`SELECT status, count(*)::int AS n FROM packages WHERE archived = false GROUP BY status`);
    totals = await pool.query(`
      SELECT
        count(*) FILTER (WHERE created_at::date = current_date)::int AS today,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week,
        count(*) FILTER (WHERE status NOT IN ('selesai','cancel'))::int AS pending,
        count(*) FILTER (WHERE pickup_type='gojek' AND status NOT IN ('selesai','cancel','retur'))::int AS gojek_active,
        round(extract(epoch FROM avg(done_at - received_at) FILTER (WHERE done_at IS NOT NULL AND received_at IS NOT NULL)))::int AS avg_pickup_seconds
      FROM packages
      WHERE archived = false`);
  }
  res.json({ by_status: byStatus.rows, ...totals.rows[0] });
}));

app.get('/api/dashboard/throughput', requireAuth, requireRole('superadmin', 'admin'), wrap(async (req, res) => {
  const { startDate, endDate } = req.query;
  let r;
  if (startDate && endDate) {
    r = await pool.query(`
      SELECT d::date AS day,
        (SELECT count(*) FROM packages WHERE archived = false AND (received_at::date = d::date OR created_at::date = d::date))::int AS received,
        (SELECT count(*) FROM packages WHERE archived = false AND done_at::date = d::date AND status='selesai')::int AS completed,
        (SELECT count(*) FROM packages WHERE archived = false AND done_at::date = d::date AND status='retur')::int AS retur
      FROM generate_series($1::date, $2::date, interval '1 day') d
      ORDER BY d`, [startDate, endDate]);
  } else {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
    r = await pool.query(`
      SELECT d::date AS day,
        (SELECT count(*) FROM packages WHERE archived = false AND (received_at::date = d::date OR created_at::date = d::date))::int AS received,
        (SELECT count(*) FROM packages WHERE archived = false AND done_at::date = d::date AND status='selesai')::int AS completed,
        (SELECT count(*) FROM packages WHERE archived = false AND done_at::date = d::date AND status='retur')::int AS retur
      FROM generate_series(current_date - ($1::int - 1), current_date, interval '1 day') d
      ORDER BY d`, [days]);
  }
  res.json(r.rows);
}));

app.get('/api/dashboard/activity', requireAuth, requireRole('superadmin', 'admin'), wrap(async (req, res) => {
  const isSuper = req.user.role === 'superadmin';
  const { startDate, endDate } = req.query;

  let timeClause = "pe.created_at >= now() - (30 * interval '1 day')";
  const params = [];

  if (startDate && endDate) {
    params.push(startDate, endDate);
    timeClause = `pe.created_at >= $1::date AND pe.created_at <= ($2::date + interval '1 day')`;
  }

  // Jika bukan Super Admin, filter HANYA aktivitas user itu sendiri
  let userClause = "";
  if (!isSuper) {
    params.push(req.user.id);
    userClause = `AND pe.user_id = $${params.length}`;
  }

  const r = await pool.query(`
    SELECT pe.user_name, u.role, pe.action, count(*)::int AS n
    FROM package_events pe
    LEFT JOIN users u ON u.id = pe.user_id
    LEFT JOIN packages pkg ON pkg.id = pe.package_id
    WHERE (pe.package_id IS NULL OR pkg.archived = false) AND ${timeClause} ${userClause}
    GROUP BY pe.user_name, u.role, pe.action
    ORDER BY pe.user_name, pe.action`, params);

  res.json(r.rows);
}));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

await migrate();
await seedIfEmpty();
server.listen(PORT, () => console.log(`API siap di http://localhost:${PORT}`));
