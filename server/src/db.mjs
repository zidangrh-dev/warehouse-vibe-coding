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
  await pool.query(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('superadmin', 'warehouse', 'admin', 'sales'));
    ALTER TABLE packages ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE packages ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
    ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_pickup_type_check;
    ALTER TABLE packages ADD CONSTRAINT packages_pickup_type_check CHECK (pickup_type IN ('customer', 'gojek', 'anteran', 'buyback'));
    ALTER TABLE package_events ALTER COLUMN package_id DROP NOT NULL;
  `).catch(() => {});
}

// Akun awal — password diambil dari environment, bukan hardcoded.
// Jika tidak di-set, generate random kuat (dilihat sekali di console log).
function randomPass(len = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  const arr = new Uint32Array(len);
  globalThis.crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

const SEED_USERS = [
  { username: 'superadmin', password: process.env.SEED_SUPERADMIN_PASSWORD || randomPass(), display_name: 'Super Admin', role: 'superadmin' },
  { username: 'gudang', password: process.env.SEED_GUDANG_PASSWORD || randomPass(), display_name: 'Tim Warehouse', role: 'warehouse' },
  { username: 'admin', password: process.env.SEED_ADMIN_PASSWORD || randomPass(), display_name: 'Admin Kios', role: 'admin' },
  { username: 'sales', password: process.env.SEED_SALES_PASSWORD || randomPass(), display_name: 'Sales', role: 'sales' },
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
  console.log('[seed] User awal dibuat dengan password acak. Set env SEED_*_PASSWORD untuk password tetap.');
}
