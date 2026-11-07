// Cari Driver per nomor order & isi nama driver otomatis.
// fetch ditiru (TikTok asli tidak dipanggil, tidak ada driver sungguhan yang diminta).
// Jalankan: DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5434/postgres node --test scripts/tiktok-driver.test.mjs
import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Default db.mjs (port 5433) bisa milik proyek lain, jadi wajib eksplisit.
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL wajib di-set ke DB lokal');
process.env.TIKTOK_APP_KEY = 'test-key';
process.env.TIKTOK_APP_SECRET = 'test-secret';

const { pool } = await import('../src/db.mjs');

// Schema terpisah: toko & paket asli (termasuk tokennya) tidak ikut terhapus atau ter-refresh.
const SCHEMA = 'test_tiktok_driver';
pool.on('connect', (client) => client.query(`SET search_path TO ${SCHEMA}, public`));
await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA};
  CREATE TABLE ${SCHEMA}.tiktok_shops (LIKE public.tiktok_shops INCLUDING ALL);
  CREATE TABLE ${SCHEMA}.packages (LIKE public.packages INCLUDING ALL);`);
const { requestDriver, extractDriver, countDriverResearch, isTiktokOrder, syncDrivers, asksDriver, needsOrderConfirm, previewOrder, finishDriverRequest } = await import('../src/tiktok.mjs');

const SHOP = 'test-driver-shop';
const ORDER = '5791000000000000001';
const realFetch = globalThis.fetch;
const ok = (data = {}) => ({ code: 0, message: 'Success', data });
const emptyOrder = ok({ orders: [{ has_updated_recipient_address: false, packages: [] }] });
const order = (status, packages = [{ id: 'P1' }]) => ok({ orders: [{ id: ORDER, status, packages }] });
let calls;
let ships;

// Balasan per endpoint; shipBody merekam isi Ship Package.
function mock({ orderDetail = order('AWAITING_SHIPMENT'), slots = ok({ can_pickup: true }), pkgStatus = () => 'TO_FULFILL', ship = ok(), tracking = ok({ tracking: [] }) } = {}) {
  globalThis.fetch = async (url, opts = {}) => {
    const path = new URL(url).pathname;
    calls.push(path);
    let body = orderDetail;
    if (path.endsWith('/handover_time_slots')) body = slots;
    else if (path.endsWith('/ship')) { ships.push({ path, body: JSON.parse(opts.body || '{}') }); body = ship; }
    else if (path.endsWith('/tracking')) body = tracking;
    else if (path.includes('/fulfillment/202309/packages/')) body = ok({ package_status: pkgStatus(path.split('/').pop()) });
    return { status: 200, json: async () => body };
  };
}

const addShop = () => pool.query(
  `INSERT INTO tiktok_shops (shop_id, name, cipher, access_token, access_expires_at, refresh_token)
   VALUES ($1,'Toko Uji','c','tok',now() + interval '1 day','rt') RETURNING *`, [SHOP]);
const pkg = { invoice_no: ORDER, platform: 'TikTok Shop', seller_name: 'Toko Uji' };

async function addPackage(fields = {}) {
  const f = { status: 'mencari_driver', driver_info: '', driver_auto_info: '', driver_locked: false, ...fields };
  return (await pool.query(
    `INSERT INTO packages (invoice_no, pickup_type, status, tiktok_shop_id, driver_info, driver_auto_info, driver_locked)
     VALUES ($1,'gojek',$2,$3,$4,$5,$6) RETURNING *`,
    [ORDER, f.status, SHOP, f.driver_info, f.driver_auto_info, f.driver_locked])).rows[0];
}

const reload = async (id) => (await pool.query('SELECT * FROM packages WHERE id=$1', [id])).rows[0];
const cleanup = async () => {
  await pool.query('DELETE FROM packages WHERE invoice_no=$1', [ORDER]);
  await pool.query('DELETE FROM tiktok_shops WHERE shop_id=$1', [SHOP]);
};

beforeEach(async () => {
  calls = [];
  ships = [];
  await cleanup();
});
afterEach(() => { globalThis.fetch = realFetch; });
after(async () => {
  await pool.query(`DROP SCHEMA ${SCHEMA} CASCADE`);
  await pool.end();
});

test('nomor order TikTok dikenali, marketplace lain tidak', () => {
  assert.equal(isTiktokOrder({ invoice_no: ORDER, platform: 'TikTok Shop' }), true);
  assert.equal(isTiktokOrder({ invoice_no: ORDER, platform: '' }), true);
  assert.equal(isTiktokOrder({ invoice_no: ORDER, platform: 'Shopee' }), false);
  assert.equal(isTiktokOrder({ invoice_no: 'INV/2026/1', platform: 'TikTok Shop' }), false);
});

test('bukan order TikTok: tidak ada panggilan sama sekali', async () => {
  await addShop();
  mock();
  assert.equal(await requestDriver({ ...pkg, platform: 'Shopee' }), null);
  assert.equal(calls.length, 0);
});

test('belum ada toko terhubung: manual tanpa panggilan Ship', async () => {
  mock();
  const r = await requestDriver(pkg);
  assert.equal(r.mode, 'manual');
  assert.equal(ships.length, 0);
});

test('order bukan milik toko terhubung (balasan kosong TikTok): manual', async () => {
  await addShop();
  mock({ orderDetail: emptyOrder });
  const r = await requestDriver(pkg);
  assert.equal(r.mode, 'manual');
  assert.match(r.message, /Seller Center/);
  assert.equal(ships.length, 0);
});

test('toko terhubung & siap kirim: Ship Package PICKUP tanpa slot', async () => {
  await addShop();
  mock();
  const r = await requestDriver(pkg);
  assert.equal(r.mode, 'auto');
  assert.equal(r.shopId, SHOP);
  assert.deepEqual(ships, [{ path: '/fulfillment/202309/packages/P1/ship', body: { handover_method: 'PICKUP' } }]);
});

test('kurir terjadwal: slot pertama yang tersedia dipakai', async () => {
  await addShop();
  mock({ slots: ok({ can_pickup: true, pickup_slots: [{ avaliable: false, start_time: 1, end_time: 2 }, { avaliable: true, start_time: 3, end_time: 4 }] }) });
  await requestDriver(pkg);
  assert.deepEqual(ships[0].body, { handover_method: 'PICKUP', pickup_slot: { start_time: 3, end_time: 4 } });
});

test('order sudah di-arrange: tidak dikirim ulang', async () => {
  await addShop();
  mock({ orderDetail: order('AWAITING_COLLECTION') });
  const r = await requestDriver(pkg);
  assert.equal(r.mode, 'already');
  assert.equal(ships.length, 0);
});

test('order dibatalkan: failed tanpa Ship', async () => {
  await addShop();
  mock({ orderDetail: order('CANCELLED') });
  const r = await requestDriver(pkg);
  assert.equal(r.mode, 'failed');
  assert.equal(ships.length, 0);
});

test('tidak bisa dijemput: failed tanpa Ship', async () => {
  await addShop();
  mock({ slots: ok({ can_pickup: false }) });
  assert.equal((await requestDriver(pkg)).mode, 'failed');
  assert.equal(ships.length, 0);
});

test('TikTok menolak Ship: failed dengan alasannya', async () => {
  await addShop();
  mock({ ship: { code: 21011001, message: 'Package cannot be shipped' } });
  const r = await requestDriver(pkg);
  assert.equal(r.mode, 'failed');
  assert.match(r.message, /Package cannot be shipped/);
});

test('coba ulang: package yang sudah di-arrange dilewati', async () => {
  await addShop();
  mock({ orderDetail: order('PARTIALLY_SHIPPING', [{ id: 'P1' }, { id: 'P2' }]), pkgStatus: (id) => (id === 'P1' ? 'PROCESSING' : 'TO_FULFILL') });
  const r = await requestDriver(pkg);
  assert.equal(r.mode, 'auto');
  assert.deepEqual(r.packageIds, ['P2']);
  assert.equal(ships.length, 1);
});

test('paket input manual wajib konfirmasi, paket import tidak', () => {
  const body = { status: 'mencari_driver' };
  const manual = { source: 'manual', status: 'absen_gojek', is_cari_driver: false };
  assert.equal(needsOrderConfirm(manual, body), true);
  assert.equal(needsOrderConfirm(manual, { is_cari_driver: true }), true);
  assert.equal(needsOrderConfirm(manual, { ...body, confirm_driver: true }), false);
  assert.equal(needsOrderConfirm(manual, { ...body, confirm_driver: 'true' }), true);
  assert.equal(needsOrderConfirm({ ...manual, source: 'import' }, body), false);
});

test('geser balik & ubah field lain bukan permintaan driver', () => {
  assert.equal(asksDriver({ status: 'driver_sampai_kios' }, { status: 'mencari_driver' }), false);
  assert.equal(asksDriver({ status: 'retur' }, { status: 'mencari_driver' }), true);
  assert.equal(asksDriver({ status: 'mencari_driver', is_cari_driver: true }, { is_cari_driver: true }), false);
  assert.equal(asksDriver({ status: 'absen_gojek' }, { admin_note: 'x' }), false);
});

const detail = (status) => ok({ orders: [{
  id: ORDER, status, packages: [{ id: 'P1' }], shipping_provider: 'GrabExpress Instant',
  recipient_address: { name: 'B***i' },
  line_items: [{ product_name: 'Kabel Data' }, { product_name: 'Kabel Data' }, { product_name: 'Charger' }],
}] });

test('order siap kirim: data order tampil, TikTok hanya dibaca', async () => {
  await addShop();
  mock({ orderDetail: detail('AWAITING_SHIPMENT') });
  const r = await previewOrder(pkg);
  assert.equal(r.mode, 'confirm');
  assert.match(r.title, new RegExp(ORDER));
  for (const text of ['Toko Uji', 'B***i', 'Kabel Data +1 lainnya', 'GrabExpress Instant', 'AWAITING_SHIPMENT', 'Driver akan diminta']) {
    assert.ok(r.message.includes(text), text);
  }
  assert.deepEqual(calls, ['/order/202309/orders']);
});

test('order sudah di-arrange: konfirmasi menyebut driver tidak diminta lagi', async () => {
  await addShop();
  mock({ orderDetail: detail('COMPLETED') });
  const r = await previewOrder(pkg);
  assert.equal(r.mode, 'confirm');
  assert.match(r.message, /driver tidak diminta lagi/);
  assert.equal(ships.length, 0);
});

test('order tidak ditemukan: pesan menyebut cek nomor, tanpa konfirmasi', async () => {
  await addShop();
  mock({ orderDetail: emptyOrder });
  const r = await previewOrder(pkg);
  assert.equal(r.mode, 'manual');
  assert.match(r.message, /tidak ditemukan.*Cek nomor order/);
  assert.equal(ships.length, 0);
});

test('nomor bukan format TikTok: diberi tahu, TikTok tidak dihubungi', async () => {
  await addShop();
  mock();
  const r = await previewOrder({ invoice_no: 'INV/2026/1' });
  assert.equal(r.mode, 'manual');
  assert.match(r.message, /bukan order TikTok/);
  assert.equal(calls.length, 0);
});

test('order dibatalkan: tanda dimatikan tanpa Ship', async () => {
  await addShop();
  const p = await addPackage();
  await pool.query('UPDATE packages SET is_cari_driver=true WHERE id=$1', [p.id]);
  mock({ orderDetail: order('CANCELLED') });
  const known = await previewOrder(pkg);
  assert.equal(known.mode, 'failed');
  const r = await finishDriverRequest(p, known);
  assert.equal(r.pkg.is_cari_driver, false);
  assert.equal(ships.length, 0);
});

test('hasil pengecekan disimpan tanpa memanggil TikTok lagi', async () => {
  await addShop();
  const p = await addPackage();
  mock();
  const r = await finishDriverRequest(p, { mode: 'manual', message: 'x' });
  assert.equal(r.mode, 'manual');
  assert.equal(calls.length, 0);
});

// Teks & action_code di bawah mengikuti tracking asli TikTok (nama diganti).
const at = (action_code, description, update_time_millis) => ({ action_code, description, update_time_millis });
const INSTANT_GANTI_DRIVER = [
  at(21401, 'Searching for a nearby driver.', 1),
  at(22001, 'A driver has been assigned.', 2),
  at(21401, 'Searching for a nearby driver.', 3),
  at(22001, 'A driver has been assigned.', 4),
  at(20201, 'Driver is heading to pick up your package.', 5),
  at(30901, 'Package collected by the driver.', 6),
];
const INSTANT_NORMAL = [
  at(21401, 'Searching for a nearby driver.', 1),
  at(20101, 'The seller is preparing your package, and will hand it over to our carrier for shipping.', 2),
  at(22001, 'A driver has been assigned.', 3),
  at(20201, 'Driver is heading to pick up your package.', 4),
];
const SAMEDAY = [
  at(20201, 'BUDI sudah ditugaskan dan paket akan segera di-pickup.', 1),
  at(20301, 'Parsel belum siap di pickup dan akan dijadwalkan ulang.', 2),
  at(30901, 'Paket sudah di-pickup oleh BUDI.', 3),
  at(40501, 'SARI sudah ditugaskan dan paket akan segera diantar ke penerima.', 4),
  at(50101, 'Delivery sukses oleh SARI dan paket telah diterima oleh keluarga(Keluarga ).', 5),
];

test('nama driver hanya dibaca dari event penjemputan', () => {
  assert.equal(extractDriver(SAMEDAY), 'BUDI');
  assert.equal(extractDriver(SAMEDAY.slice(0, 2)), 'BUDI');
  assert.equal(extractDriver(SAMEDAY.slice(3)), '');
});

test('Gojek/Grab Instant: tidak ada nama, kalimat Driver tidak salah dibaca', () => {
  assert.equal(extractDriver(INSTANT_GANTI_DRIVER), '');
  assert.equal(extractDriver(INSTANT_NORMAL), '');
  assert.equal(extractDriver(undefined), '');
});

test('pergantian driver dihitung dari pencarian ulang setelah ditugaskan', () => {
  assert.equal(countDriverResearch(INSTANT_GANTI_DRIVER), 1);
  assert.equal(countDriverResearch(INSTANT_NORMAL), 0);
  assert.equal(countDriverResearch(SAMEDAY), 0);
  assert.equal(countDriverResearch(undefined), 0);
});

const trackingOf = (events) => ok({ tracking: events });

test('nama driver ada: kolom driver terisi, tanpa REFRESH', async () => {
  await addShop();
  const p = await addPackage();
  mock({ tracking: trackingOf(SAMEDAY) });
  const [c] = await syncDrivers();
  assert.equal(c.filled, true);
  assert.equal(c.refreshed, false);
  const row = await reload(p.id);
  assert.equal(row.driver_info, 'BUDI');
  assert.equal(row.driver_refreshed, false);
});

test('Instant tanpa nama & tanpa pergantian: tidak terjadi apa-apa', async () => {
  await addShop();
  const p = await addPackage();
  mock({ tracking: trackingOf(INSTANT_NORMAL) });
  assert.deepEqual(await syncDrivers(), []);
  const row = await reload(p.id);
  assert.equal(row.driver_info, '');
  assert.equal(row.driver_refreshed, false);
});

test('Instant driver berganti: REFRESH menyala, isian manual tetap', async () => {
  await addShop();
  const p = await addPackage({ driver_info: 'Isian Admin / 0812' });
  mock({ tracking: trackingOf(INSTANT_GANTI_DRIVER) });
  const [c] = await syncDrivers();
  assert.equal(c.refreshed, true);
  assert.equal(c.filled, false);
  const row = await reload(p.id);
  assert.equal(row.driver_info, 'Isian Admin / 0812');
  assert.equal(row.driver_refreshed, true);
});

test('REFRESH yang sudah dimatikan admin tidak menyala lagi untuk pergantian yang sama', async () => {
  await addShop();
  const p = await addPackage();
  mock({ tracking: trackingOf(INSTANT_GANTI_DRIVER) });
  await syncDrivers();
  await pool.query('UPDATE packages SET driver_refreshed=false WHERE id=$1', [p.id]);
  assert.deepEqual(await syncDrivers(), []);
  assert.equal((await reload(p.id)).driver_refreshed, false);
  // Pergantian baru menyalakannya lagi.
  mock({ tracking: trackingOf([...INSTANT_GANTI_DRIVER, at(21401, 'Searching for a nearby driver.', 7)]) });
  const [c] = await syncDrivers();
  assert.equal(c.refreshed, true);
});

test('izin tracking belum ada: diam, kolom tidak berubah', async () => {
  await addShop();
  const p = await addPackage();
  mock({ tracking: { code: 105005, message: 'Access denied' } });
  assert.deepEqual(await syncDrivers(), []);
  assert.equal((await reload(p.id)).driver_info, '');
});

test('nama driver berganti: nama diganti dan REFRESH menyala', async () => {
  await addShop();
  const p = await addPackage({ driver_info: 'ANDI', driver_auto_info: 'ANDI' });
  mock({ tracking: trackingOf(SAMEDAY) });
  const [c] = await syncDrivers();
  assert.equal(c.refreshed, true);
  const row = await reload(p.id);
  assert.equal(row.driver_info, 'BUDI');
  assert.equal(row.driver_refreshed, true);
});

test('isian manual tidak ditimpa oleh pembacaan pertama', async () => {
  await addShop();
  const p = await addPackage({ driver_info: 'Isian Admin / 0812' });
  mock({ tracking: trackingOf(SAMEDAY) });
  assert.deepEqual(await syncDrivers(), []);
  const row = await reload(p.id);
  assert.equal(row.driver_info, 'Isian Admin / 0812');
  assert.equal(row.driver_auto_info, 'BUDI');
});

test('data driver terkunci tidak disentuh', async () => {
  await addShop();
  const p = await addPackage({ driver_info: 'Lama', driver_auto_info: 'Lama', driver_locked: true });
  mock({ tracking: trackingOf(SAMEDAY) });
  assert.deepEqual(await syncDrivers(), []);
  assert.equal((await reload(p.id)).driver_info, 'Lama');
});
