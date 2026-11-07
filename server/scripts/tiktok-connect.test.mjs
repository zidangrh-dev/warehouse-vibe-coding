// Pemilik toko saat dihubungkan: sales memiliki tokonya, superadmin tidak mengambil alih.
// fetch ditiru (TikTok asli tidak dipanggil); data di schema terpisah, data asli tidak tersentuh.
// Jalankan: DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5434/postgres node --test scripts/tiktok-connect.test.mjs
import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

assert.ok(process.env.DATABASE_URL, 'DATABASE_URL wajib di-set ke DB lokal');
process.env.TIKTOK_APP_KEY = 'test-key';
process.env.TIKTOK_APP_SECRET = 'test-secret';

const { pool } = await import('../src/db.mjs');
const { connectShops } = await import('../src/tiktok.mjs');

const SCHEMA = 'test_tiktok_connect';
pool.on('connect', (client) => client.query(`SET search_path TO ${SCHEMA}, public`));
await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA};
  CREATE TABLE ${SCHEMA}.tiktok_shops (LIKE public.tiktok_shops INCLUDING ALL);`);

const SALES_A = 11;
const SALES_B = 12;
const realFetch = globalThis.fetch;
const ok = (data = {}) => ({ code: 0, message: 'Success', data });
const inADay = () => Math.floor(Date.now() / 1000) + 86400;

beforeEach(async () => {
  await pool.query('DELETE FROM tiktok_shops');
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    let body = ok();
    if (path === '/api/v2/token/get') {
      body = ok({ access_token: 'at', access_token_expire_in: inADay(), refresh_token: 'rt', refresh_token_expire_in: inADay() });
    } else if (path === '/authorization/202309/shops') {
      body = ok({ shops: [{ id: 's1', name: 'Toko Sales', cipher: 'c1', region: 'ID', code: 'K1' }] });
    }
    return { status: 200, json: async () => body };
  };
});
afterEach(() => { globalThis.fetch = realFetch; });
after(async () => {
  await pool.query(`DROP SCHEMA ${SCHEMA} CASCADE`);
  await pool.end();
});

const owner = async () => (await pool.query("SELECT connected_by FROM tiktok_shops WHERE shop_id='s1'")).rows[0].connected_by;

test('sales menghubungkan toko: tercatat sebagai pemilik', async () => {
  assert.deepEqual(await connectShops('kode', SALES_A), ['Toko Sales']);
  assert.equal(await owner(), SALES_A);
});

test('superadmin menghubungkan toko baru: tanpa pemilik', async () => {
  await connectShops('kode');
  assert.equal(await owner(), null);
});

test('superadmin otorisasi ulang: pemilik lama tetap', async () => {
  await connectShops('kode', SALES_A);
  await connectShops('kode-baru');
  assert.equal(await owner(), SALES_A);
});

test('sales lain otorisasi ulang: pemilik berpindah', async () => {
  await connectShops('kode', SALES_A);
  await connectShops('kode-baru', SALES_B);
  assert.equal(await owner(), SALES_B);
});
