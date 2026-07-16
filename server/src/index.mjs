import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { Server } from 'socket.io';
import { pool, migrate, seedIfEmpty } from './db.mjs';

const PORT = Number(process.env.PORT || 4000);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg') || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(null, /^image\//.test(file.mimetype)),
});

// Setiap mutasi memberi tahu semua klien di board terkait agar refetch.
function notify(boardId) {
  io.to(`board:${boardId}`).emit('board:changed', { boardId });
}

io.on('connection', (socket) => {
  socket.on('board:join', (boardId) => socket.join(`board:${boardId}`));
  socket.on('board:leave', (boardId) => socket.leave(`board:${boardId}`));
});

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

async function boardIdOfList(listId) {
  const r = await pool.query('SELECT board_id FROM lists WHERE id=$1', [listId]);
  return r.rows[0]?.board_id;
}
async function boardIdOfCard(cardId) {
  const r = await pool.query(
    'SELECT l.board_id FROM cards c JOIN lists l ON l.id=c.list_id WHERE c.id=$1',
    [cardId]
  );
  return r.rows[0]?.board_id;
}

// ---- Boards ----
app.get('/api/boards', wrap(async (_req, res) => {
  const r = await pool.query('SELECT * FROM boards ORDER BY id');
  res.json(r.rows);
}));

app.post('/api/boards', wrap(async (req, res) => {
  const r = await pool.query(
    'INSERT INTO boards (name) VALUES ($1) RETURNING *',
    [String(req.body.name || 'Board Baru')]
  );
  res.status(201).json(r.rows[0]);
}));

// Board lengkap: lists + cards + photos dalam satu response.
app.get('/api/boards/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const board = await pool.query('SELECT * FROM boards WHERE id=$1', [id]);
  if (!board.rows[0]) return res.status(404).json({ error: 'Board tidak ditemukan' });
  const lists = await pool.query(
    'SELECT * FROM lists WHERE board_id=$1 ORDER BY position, id', [id]);
  const cards = await pool.query(
    `SELECT c.* FROM cards c JOIN lists l ON l.id=c.list_id
     WHERE l.board_id=$1 ORDER BY c.position, c.id`, [id]);
  const photos = await pool.query(
    `SELECT p.* FROM card_photos p
     JOIN cards c ON c.id=p.card_id JOIN lists l ON l.id=c.list_id
     WHERE l.board_id=$1 ORDER BY p.id`, [id]);
  res.json({
    ...board.rows[0],
    lists: lists.rows.map((list) => ({
      ...list,
      cards: cards.rows
        .filter((c) => c.list_id === list.id)
        .map((c) => ({
          ...c,
          photos: photos.rows.filter((p) => p.card_id === c.id),
        })),
    })),
  });
}));

// ---- Lists ----
app.post('/api/lists', wrap(async (req, res) => {
  const { board_id, name } = req.body;
  const pos = await pool.query(
    'SELECT COALESCE(MAX(position),0)+1000 AS p FROM lists WHERE board_id=$1',
    [board_id]
  );
  const r = await pool.query(
    'INSERT INTO lists (board_id, name, position) VALUES ($1,$2,$3) RETURNING *',
    [board_id, String(name || 'Kolom Baru'), pos.rows[0].p]
  );
  notify(board_id);
  res.status(201).json(r.rows[0]);
}));

app.patch('/api/lists/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { name, position } = req.body;
  const r = await pool.query(
    `UPDATE lists SET name=COALESCE($2,name), position=COALESCE($3,position)
     WHERE id=$1 RETURNING *`,
    [id, name ?? null, position ?? null]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Kolom tidak ditemukan' });
  notify(r.rows[0].board_id);
  res.json(r.rows[0]);
}));

app.delete('/api/lists/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const boardId = await boardIdOfList(id);
  await pool.query('DELETE FROM lists WHERE id=$1', [id]);
  if (boardId) notify(boardId);
  res.json({ ok: true });
}));

// ---- Cards ----
app.post('/api/cards', wrap(async (req, res) => {
  const { list_id, title, description, priority, barcode, due_date } = req.body;
  const pos = await pool.query(
    'SELECT COALESCE(MAX(position),0)+1000 AS p FROM cards WHERE list_id=$1',
    [list_id]
  );
  const r = await pool.query(
    `INSERT INTO cards (list_id, title, description, priority, barcode, due_date, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [list_id, String(title || 'Task baru'), description || '',
     priority || 'normal', barcode || null, due_date || null, pos.rows[0].p]
  );
  const boardId = await boardIdOfList(list_id);
  if (boardId) notify(boardId);
  res.status(201).json(r.rows[0]);
}));

// PATCH juga dipakai untuk memindah kartu: kirim list_id + position baru.
app.patch('/api/cards/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const allowed = ['list_id', 'title', 'description', 'priority', 'barcode', 'due_date', 'position'];
  const sets = [];
  const values = [id];
  for (const key of allowed) {
    if (key in req.body) {
      values.push(req.body[key]);
      sets.push(`${key}=$${values.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Tidak ada field yang diubah' });
  const r = await pool.query(
    `UPDATE cards SET ${sets.join(', ')}, updated_at=now() WHERE id=$1 RETURNING *`,
    values
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Kartu tidak ditemukan' });
  const boardId = await boardIdOfCard(id);
  if (boardId) notify(boardId);
  res.json(r.rows[0]);
}));

app.delete('/api/cards/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const boardId = await boardIdOfCard(id);
  await pool.query('DELETE FROM cards WHERE id=$1', [id]);
  if (boardId) notify(boardId);
  res.json({ ok: true });
}));

// ---- Photos ----
app.post('/api/cards/:id/photos', upload.single('photo'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File foto tidak ada' });
  const cardId = Number(req.params.id);
  const r = await pool.query(
    'INSERT INTO card_photos (card_id, filename) VALUES ($1,$2) RETURNING *',
    [cardId, req.file.filename]
  );
  const boardId = await boardIdOfCard(cardId);
  if (boardId) notify(boardId);
  res.status(201).json(r.rows[0]);
}));

app.delete('/api/photos/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const r = await pool.query(
    'DELETE FROM card_photos WHERE id=$1 RETURNING *', [id]);
  const photo = r.rows[0];
  if (photo) {
    fs.rm(path.join(UPLOAD_DIR, photo.filename), () => {});
    const boardId = await boardIdOfCard(photo.card_id);
    if (boardId) notify(boardId);
  }
  res.json({ ok: true });
}));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

await migrate();
await seedIfEmpty();
server.listen(PORT, () =>
  console.log(`API siap di http://localhost:${PORT}`)
);
