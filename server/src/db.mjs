import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@127.0.0.1:5433/postgres',
});

export async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

export async function seedIfEmpty() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM boards');
  if (rows[0].n > 0) return;
  const board = await pool.query(
    `INSERT INTO boards (name) VALUES ('Gudang Utama') RETURNING id`
  );
  const boardId = board.rows[0].id;
  const names = ['Barang Masuk', 'Picking', 'Packing', 'Selesai'];
  for (let i = 0; i < names.length; i++) {
    await pool.query(
      `INSERT INTO lists (board_id, name, position) VALUES ($1, $2, $3)`,
      [boardId, names[i], (i + 1) * 1000]
    );
  }
}
