// Refresh token TikTok: aman untuk request bersamaan & toko yang berbagi token.
// fetch ditiru (TikTok asli tidak dipanggil); baris uji dibuat & dihapus di DB lokal.
// Jalankan: DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5434/postgres node --test scripts/tiktok-refresh.test.mjs
import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Default db.mjs (port 5433) bisa milik proyek lain, jadi wajib eksplisit.
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL wajib di-set ke DB lokal');
process.env.TIKTOK_APP_KEY = 'test-key';
process.env.TIKTOK_APP_SECRET = 'test-secret';

const { pool } = await import('../src/db.mjs');
const { accessToken } = await import('../src/tiktok.mjs');

const realFetch = globalThis.fetch;
const inSecs = (s) => Math.floor(Date.now() / 1000) + s;
let refreshCalls;
let usedTokens;

// Meniru TikTok: refresh token sekali pakai, yang bekas ditolak.
function mockRefresh({ fail = false } = {}) {
  globalThis.fetch = async (url) => {
    refreshCalls++;
    const rt = new URL(url).searchParams.get('refresh_token');
    await new Promise((r) => setTimeout(r, 50));
    if (fail || usedTokens.has(rt)) return { json: async () => ({ code: 36004005, message: 'invalid refresh token' }) };
    usedTokens.add(rt);
    return {
      json: async () => ({
        code: 0,
        data: {
          access_token: `new-access-${refreshCalls}`,
          access_token_expire_in: inSecs(7 * 86400),
          refresh_token: `new-refresh-${refreshCalls}`,
          refresh_token_expire_in: inSecs(365 * 86400),
        },
      }),
    };
  };
}

async function insertShop(name, refreshToken, expiresAt = new Date(Date.now() - 3600 * 1000)) {
  const r = await pool.query(
    `INSERT INTO tiktok_shops (shop_id, name, cipher, access_token, access_expires_at, refresh_token)
     VALUES ($1,$1,'cipher','old-access',$2,$3) RETURNING *`,
    [`test-refresh-${name}`, expiresAt, refreshToken]);
  return r.rows[0];
}

const reload = async (id) => (await pool.query('SELECT * FROM tiktok_shops WHERE id=$1', [id])).rows[0];
const cleanup = () => pool.query("DELETE FROM tiktok_shops WHERE shop_id LIKE 'test-refresh-%'");

beforeEach(async () => {
  refreshCalls = 0;
  usedTokens = new Set();
  await cleanup();
});
afterEach(() => { globalThis.fetch = realFetch; });
after(async () => {
  await cleanup();
  await pool.end();
});

test('request bersamaan hanya memicu satu refresh', async () => {
  const shop = await insertShop('a', 'rt-a');
  mockRefresh();
  const tokens = await Promise.all(Array.from({ length: 5 }, () => accessToken({ ...shop })));
  assert.equal(refreshCalls, 1);
  assert.deepEqual([...new Set(tokens)], ['new-access-1']);
  assert.equal((await reload(shop.id)).refresh_token, 'new-refresh-1');
});

test('toko yang berbagi token ikut diperbarui', async () => {
  const a = await insertShop('b1', 'rt-shared');
  const b = await insertShop('b2', 'rt-shared');
  const other = await insertShop('b3', 'rt-other');
  mockRefresh();
  await accessToken(a);
  assert.equal((await reload(b.id)).refresh_token, 'new-refresh-1');
  assert.equal((await reload(b.id)).access_token, 'new-access-1');
  assert.equal((await reload(other.id)).refresh_token, 'rt-other');
  // Toko saudara memakai hasil yang sama, tanpa refresh kedua.
  assert.equal(await accessToken(b), 'new-access-1');
  assert.equal(refreshCalls, 1);
});

test('refresh gagal: token lama utuh dan kunci terlepas', async () => {
  const shop = await insertShop('c', 'rt-c');
  mockRefresh({ fail: true });
  await assert.rejects(accessToken({ ...shop }), /invalid refresh token/);
  assert.equal((await reload(shop.id)).refresh_token, 'rt-c');
  mockRefresh();
  assert.equal(await accessToken({ ...shop }), `new-access-${refreshCalls}`);
});

test('token masih berlaku: tidak ada refresh', async () => {
  const shop = await insertShop('d', 'rt-d', new Date(Date.now() + 86400 * 1000));
  mockRefresh();
  assert.equal(await accessToken(shop), 'old-access');
  assert.equal(refreshCalls, 0);
});
