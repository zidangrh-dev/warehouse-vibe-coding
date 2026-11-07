// Permintaan driver yang terputus server mati: diulang sekali, dibatasi waktu, tidak pernah dobel.
// fetch ditiru (TikTok asli tidak dipanggil); data di schema terpisah, data asli tidak tersentuh.
// Jalankan: DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5434/postgres node --test scripts/tiktok-recovery.test.mjs
import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

assert.ok(process.env.DATABASE_URL, 'DATABASE_URL wajib di-set ke DB lokal');
process.env.TIKTOK_APP_KEY = 'test-key';
process.env.TIKTOK_APP_SECRET = 'test-secret';

const { pool } = await import('../src/db.mjs');
const { recoverDriverRequests } = await import('../src/tiktok.mjs');

const SCHEMA = 'test_tiktok_recovery';
pool.on('connect', (client) => client.query(`SET search_path TO ${SCHEMA}, public`));
await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA};
  CREATE TABLE ${SCHEMA}.tiktok_shops (LIKE public.tiktok_shops INCLUDING ALL);
  CREATE TABLE ${SCHEMA}.packages (LIKE public.packages INCLUDING ALL);`);

const ORDER = '5792000000000000001';
const realFetch = globalThis.fetch;
const ok = (data = {}) => ({ code: 0, message: 'Success', data });
let ships;
let orderStatus;

function mock() {
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    let body = ok({ orders: [{ id: ORDER, status: orderStatus, packages: [{ id: 'P1' }] }] });
    if (path.endsWith('/handover_time_slots')) body = ok({ can_pickup: true });
    else if (path.endsWith('/ship')) { ships.push(path); await new Promise((r) => setTimeout(r, 30)); body = ok(); }
    else if (path.includes('/fulfillment/202309/packages/')) body = ok({ package_status: 'TO_FULFILL' });
    return { status: 200, json: async () => body };
  };
}

async function pendingPackage({ minutesAgo, status = 'mencari_driver', flag = false, lease = minutesAgo }) {
  return (await pool.query(
    `INSERT INTO packages (invoice_no, platform, seller_name, pickup_type, status, is_cari_driver,
       driver_request_pending, driver_request_at, driver_request_lease_at)
     VALUES ($1,'TikTok Shop','Toko Uji','gojek',$2,$3,true,now() - make_interval(mins => $4),now() - make_interval(mins => $5)) RETURNING *`,
    [ORDER, status, flag, minutesAgo, lease])).rows[0];
}

const reload = async (id) => (await pool.query('SELECT * FROM packages WHERE id=$1', [id])).rows[0];

beforeEach(async () => {
  ships = [];
  orderStatus = 'AWAITING_SHIPMENT';
  await pool.query('DELETE FROM packages');
  await pool.query('DELETE FROM tiktok_shops');
  await pool.query(`INSERT INTO tiktok_shops (shop_id, name, cipher, access_token, access_expires_at, refresh_token)
    VALUES ('s1','Toko Uji','c','tok',now() + interval '1 day','rt')`);
  mock();
});
afterEach(() => { globalThis.fetch = realFetch; });
after(async () => {
  await pool.query(`DROP SCHEMA ${SCHEMA} CASCADE`);
  await pool.end();
});

test('terputus 3 menit lalu: diulang, driver diminta, tanda menyala', async () => {
  const p = await pendingPackage({ minutesAgo: 3 });
  const [o] = await recoverDriverRequests();
  assert.equal(o.mode, 'auto');
  assert.equal(ships.length, 1);
  const row = await reload(p.id);
  assert.equal(row.driver_request_pending, false);
  assert.equal(row.is_cari_driver, true);
  assert.equal(row.tiktok_shop_id, 's1');
});

test('baru saja diminta (mungkin masih berjalan): tidak disentuh', async () => {
  const p = await pendingPackage({ minutesAgo: 0 });
  assert.deepEqual(await recoverDriverRequests(), []);
  assert.equal(ships.length, 0);
  assert.equal((await reload(p.id)).driver_request_pending, true);
});

test('lewat 15 menit: tidak dikirim, tanda dimatikan, dikabarkan', async () => {
  const p = await pendingPackage({ minutesAgo: 20, flag: true });
  const [o] = await recoverDriverRequests();
  assert.equal(o.mode, 'expired');
  assert.match(o.message, /Nyalakan tag Cari Driver/);
  assert.equal(ships.length, 0);
  const row = await reload(p.id);
  assert.equal(row.driver_request_pending, false);
  assert.equal(row.is_cari_driver, false);
});

test('paket sudah dibatalkan: permintaan dibuang tanpa memanggil TikTok', async () => {
  const p = await pendingPackage({ minutesAgo: 3, status: 'cancel' });
  assert.deepEqual(await recoverDriverRequests(), []);
  assert.equal(ships.length, 0);
  assert.equal((await reload(p.id)).driver_request_pending, false);
});

test('sudah terkirim sebelum server mati: tidak dikirim dua kali', async () => {
  orderStatus = 'AWAITING_COLLECTION';
  const p = await pendingPackage({ minutesAgo: 3 });
  const [o] = await recoverDriverRequests();
  assert.equal(o.mode, 'already');
  assert.equal(ships.length, 0);
  assert.equal((await reload(p.id)).is_cari_driver, true);
});

test('dua pemulihan bersamaan: hanya satu Ship Package', async () => {
  await pendingPackage({ minutesAgo: 3 });
  const results = await Promise.all([recoverDriverRequests(), recoverDriverRequests()]);
  assert.equal(results.flat().length, 1);
  assert.equal(ships.length, 1);
});

test('toko belum terhubung: jadi manual, tidak berulang', async () => {
  await pool.query('DELETE FROM tiktok_shops');
  const p = await pendingPackage({ minutesAgo: 3 });
  const [o] = await recoverDriverRequests();
  assert.equal(o.mode, 'manual');
  assert.equal((await reload(p.id)).driver_request_pending, false);
  assert.deepEqual(await recoverDriverRequests(), []);
});
