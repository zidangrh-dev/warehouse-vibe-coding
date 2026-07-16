import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

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

// Akun awal — WAJIB ganti password setelah aplikasi dipakai sungguhan.
const SEED_USERS = [
  { username: 'gudang', password: 'gudang123', display_name: 'Tim Warehouse', role: 'warehouse' },
  { username: 'admin', password: 'admin123', display_name: 'Admin Kios', role: 'admin' },
  { username: 'sales', password: 'sales123', display_name: 'Sales', role: 'sales' },
];

export async function seedIfEmpty() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM users');
  if (rows[0].n > 0) return;
  for (const u of SEED_USERS) {
    await pool.query(
      `INSERT INTO users (username, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)`,
      [u.username, bcrypt.hashSync(u.password, 10), u.display_name, u.role]
    );
  }
  console.log('User awal dibuat: gudang/gudang123, admin/admin123, sales/sales123');
}
