// Cek kesehatan toko: status harus mencerminkan jawaban TikTok, bukan tanggal token.
// fetch ditiru (TikTok asli tidak dipanggil); baris uji dibuat & dihapus di DB lokal.
// Jalankan: DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5434/postgres node --test scripts/tiktok-health.test.mjs
import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Default db.mjs (port 5433) bisa milik proyek lain, jadi wajib eksplisit.
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL wajib di-set ke DB lokal');
process.env.TIKTOK_APP_KEY = 'test-key';
process.env.TIKTOK_APP_SECRET = 'test-secret';

const { pool } = await import('../src/db.mjs');
const { checkShop } = await import('../src/tiktok.mjs');

const SHOP_ID = 'test-health-1';
const realFetch = globalThis.fetch;
const ok = (data = {}) => ({ code: 0, message: 'Success', data });
const shopList = ok({ shops: [{ id: SHOP_ID, name: 'Toko Baru', cipher: 'new-cipher', region: 'ID', code: 'IDX' }] });
const deny = { code: 105005, message: 'Access denied' };
const wrongId = { code: 21001001, message: 'invalid params' };

// Balasan per endpoint; null = TikTok tidak membalas JSON.
function mock({ shops = shopList, orders = ok({ orders: [] }), fulfillment = wrongId }) {
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    const body = path.includes('/authorization/') ? shops : path.includes('/order/') ? orders : fulfillment;
    return { status: body ? 200 : 502, json: async () => { if (!body) throw new Error('bukan JSON'); return body; } };
  };
}

async function freshShop() {
  const r = await pool.query(
    `INSERT INTO tiktok_shops (shop_id, name, cipher, access_token, access_expires_at, refresh_token)
     VALUES ($1,'Lama','old-cipher','tok',now() + interval '1 day','rt') RETURNING *`, [SHOP_ID]);
  return r.rows[0];
}

const reload = async () => (await pool.query('SELECT * FROM tiktok_shops WHERE shop_id=$1', [SHOP_ID])).rows[0];
const cleanup = () => pool.query('DELETE FROM tiktok_shops WHERE shop_id=$1', [SHOP_ID]);

beforeEach(cleanup);
afterEach(() => { globalThis.fetch = realFetch; });
after(async () => {
  await cleanup();
  await pool.end();
});

test('semua lolos: ok dan data toko ikut diperbarui', async () => {
  const shop = await freshShop();
  mock({});
  assert.equal(await checkShop(shop), 'ok');
  const row = await reload();
  assert.equal(row.health, 'ok');
  assert.equal(row.health_error, '');
  assert.ok(row.last_check_at);
  assert.deepEqual([row.name, row.cipher, row.region, row.code], ['Toko Baru', 'new-cipher', 'ID', 'IDX']);
});

test('izin Order kurang: problem', async () => {
  const shop = await freshShop();
  mock({ orders: deny });
  assert.equal(await checkShop(shop), 'problem');
  assert.match((await reload()).health_error, /Izin API kurang/);
});

test('izin Fulfillment kurang: problem', async () => {
  const shop = await freshShop();
  mock({ fulfillment: deny });
  assert.equal(await checkShop(shop), 'problem');
  assert.match((await reload()).health_error, /Izin API kurang/);
});

test('token dicabut seller: problem dengan pesan TikTok', async () => {
  const shop = await freshShop();
  mock({ shops: { code: 105002, message: 'Expired credentials' } });
  assert.equal(await checkShop(shop), 'problem');
  assert.match((await reload()).health_error, /Expired credentials/);
});

test('toko hilang dari daftar otorisasi: problem', async () => {
  const shop = await freshShop();
  mock({ shops: ok({ shops: [] }) });
  assert.equal(await checkShop(shop), 'problem');
  assert.match((await reload()).health_error, /Otorisasi ulang/);
});

test('TikTok gangguan: unknown, bukan ok dan bukan problem', async () => {
  const shop = await freshShop();
  mock({ shops: null });
  assert.equal(await checkShop(shop), 'unknown');
  assert.equal((await reload()).health, 'unknown');
});

test('jaringan putus: unknown', async () => {
  const shop = await freshShop();
  globalThis.fetch = async () => { throw new Error('fetch failed'); };
  assert.equal(await checkShop(shop), 'unknown');
  assert.match((await reload()).health_error, /fetch failed/);
});

test('status lama tertimpa saat pulih', async () => {
  const shop = await freshShop();
  mock({ orders: deny });
  await checkShop(shop);
  mock({});
  assert.equal(await checkShop(await reload()), 'ok');
  assert.equal((await reload()).health_error, '');
});
