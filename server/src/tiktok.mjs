// Klien TikTok Shop Partner API (app ISV, versi 202309).
// Kredensial diatur dari menu Marketplace (tabel marketplace_settings), env sebagai cadangan.
// Token per toko disimpan di tabel tiktok_shops.
import crypto from 'node:crypto';
import { pool } from './db.mjs';

const API = 'https://open-api.tiktokglobalshop.com';
const AUTH = 'https://auth.tiktok-shops.com';
let settings = {};
export const appKey = () => settings.app_key || process.env.TIKTOK_APP_KEY || '';
const appSecret = () => settings.app_secret || process.env.TIKTOK_APP_SECRET || '';

export const isConfigured = () => !!(appKey() && appSecret());
export const hasSecret = () => !!appSecret();
// Link otorisasi app ISV, disalin dari Partner Center.
export const authUrl = () => settings.auth_url || process.env.TIKTOK_AUTH_URL || '';

export async function loadSettings() {
  const r = await pool.query("SELECT * FROM marketplace_settings WHERE platform='tiktok'");
  settings = r.rows[0] || {};
}

// Field kosong = nilai lama tetap dipakai (secret tidak pernah dikirim balik ke klien).
export async function saveSettings({ app_key = '', app_secret = '', auth_url = '' }) {
  await pool.query(
    `INSERT INTO marketplace_settings (platform, app_key, app_secret, auth_url) VALUES ('tiktok',$1,$2,$3)
     ON CONFLICT (platform) DO UPDATE SET
       app_key=COALESCE(NULLIF($1,''), marketplace_settings.app_key),
       app_secret=COALESCE(NULLIF($2,''), marketplace_settings.app_secret),
       auth_url=COALESCE(NULLIF($3,''), marketplace_settings.auth_url),
       updated_at=now()`,
    [app_key, app_secret, auth_url]);
  await loadSettings();
}

// Sign: HMAC-SHA256(secret, secret + path + sorted(key+value) + body + secret), hex.
// `sign` & `access_token` tidak ikut di-sign.
export function sign(path, params, body, secret) {
  const keys = Object.keys(params).filter((k) => k !== 'sign' && k !== 'access_token').sort();
  let input = path + keys.map((k) => k + params[k]).join('');
  if (body) input += body;
  return crypto.createHmac('sha256', secret).update(secret + input + secret).digest('hex');
}

function tiktokError(json, fallback) {
  const e = new Error(`TikTok: ${json?.message || fallback} (code ${json?.code ?? '-'})`);
  e.httpCode = 502;
  e.tiktokCode = json?.code; // kosong = TikTok tidak membalas JSON (gangguan, bukan penolakan)
  return e;
}

export async function call(method, path, { shop, query = {}, body } = {}) {
  const params = { ...query, app_key: appKey(), timestamp: Math.floor(Date.now() / 1000) };
  if (shop?.cipher) params.shop_cipher = shop.cipher;
  const bodyStr = body ? JSON.stringify(body) : '';
  params.sign = sign(path, params, bodyStr, appSecret());
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(shop && { 'x-tts-access-token': await accessToken(shop) }) },
    body: bodyStr || undefined,
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => null);
  if (!json || json.code !== 0) throw tiktokError(json, `HTTP ${res.status}`);
  return json.data;
}

async function tokenRequest(path, extra) {
  const q = new URLSearchParams({ app_key: appKey(), app_secret: appSecret(), ...extra });
  // Timeout: refresh berjalan sambil memegang kunci, jangan sampai menggantung.
  const json = await fetch(`${AUTH}${path}?${q}`, { signal: AbortSignal.timeout(15000) })
    .then((r) => r.json()).catch(() => null);
  if (!json || json.code !== 0) throw tiktokError(json, 'gagal mengambil token');
  return json.data;
}

const saveTokens = (t) => [t.access_token, new Date(t.access_token_expire_in * 1000), t.refresh_token,
  new Date(t.refresh_token_expire_in * 1000)];

// Refresh 10 menit sebelum kedaluwarsa.
const isFresh = (s) => new Date(s.access_expires_at).getTime() - Date.now() > 10 * 60 * 1000;

export async function accessToken(shop) {
  if (isFresh(shop)) return shop.access_token;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // TikTok mengganti refresh token tiap refresh, jadi hanya boleh satu refresh berjalan.
    // shortcut: satu kunci untuk semua toko (refresh antre), pecah per token kalau antrean terasa di ratusan toko.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('tiktok_token_refresh'))");
    // Baca ulang: request lain mungkin sudah me-refresh selagi menunggu kunci.
    let cur = (await client.query('SELECT * FROM tiktok_shops WHERE id=$1', [shop.id])).rows[0];
    if (!cur) throw Object.assign(new Error('Toko TikTok sudah diputuskan.'), { httpCode: 400 });
    if (!isFresh(cur)) {
      const t = await tokenRequest('/api/v2/token/refresh', { refresh_token: cur.refresh_token, grant_type: 'refresh_token' });
      const [at, exp, rt, rexp] = saveTokens(t);
      // Satu otorisasi bisa mencakup beberapa toko: semua pemegang token ini ikut diperbarui.
      await client.query(
        'UPDATE tiktok_shops SET access_token=$2, access_expires_at=$3, refresh_token=$4, refresh_expires_at=$5, updated_at=now() WHERE refresh_token=$1',
        [cur.refresh_token, at, exp, rt, rexp]);
      cur = { ...cur, access_token: at, access_expires_at: exp, refresh_token: rt };
    }
    await client.query('COMMIT');
    Object.assign(shop, { access_token: cur.access_token, access_expires_at: cur.access_expires_at, refresh_token: cur.refresh_token });
    return cur.access_token;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Callback OAuth: tukar auth_code -> token, lalu simpan semua toko yang diotorisasi seller.
export async function connectShops(authCode) {
  const t = await tokenRequest('/api/v2/token/get', { auth_code: authCode, grant_type: 'authorized_code' });
  const [at, exp, rt, rexp] = saveTokens(t);
  const tmp = { id: null, access_token: at, access_expires_at: exp, refresh_token: rt };
  const data = await call('GET', '/authorization/202309/shops', { shop: tmp });
  const saved = [];
  for (const s of data.shops || []) {
    await pool.query(
      `INSERT INTO tiktok_shops (shop_id, name, cipher, access_token, access_expires_at, refresh_token, refresh_expires_at, region, code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (shop_id) DO UPDATE SET name=$2, cipher=$3, access_token=$4, access_expires_at=$5, refresh_token=$6,
         refresh_expires_at=$7, region=$8, code=$9, updated_at=now()`,
      [s.id, s.name, s.cipher, at, exp, rt, rexp, s.region || '', s.code || '']);
    saved.push(s.name);
    const row = (await pool.query('SELECT * FROM tiktok_shops WHERE shop_id=$1', [s.id])).rows[0];
    await checkShop(row);
  }
  return saved;
}

const SCOPE_DENIED = 105005;

// Tes sungguhan ke TikTok (hanya baca): token, otorisasi toko, izin Order & Fulfillment.
// ok = semua lolos | problem = TikTok menolak | unknown = TikTok tidak bisa dihubungi.
export async function checkShop(shop) {
  let health = 'ok';
  let error = '';
  try {
    const data = await call('GET', '/authorization/202309/shops', { shop: { ...shop, cipher: undefined } });
    const info = (data?.shops || []).find((s) => String(s.id) === shop.shop_id);
    if (!info) throw Object.assign(new Error('Toko tidak lagi ada di daftar otorisasi TikTok. Otorisasi ulang.'), { tiktokCode: -1 });
    await pool.query('UPDATE tiktok_shops SET name=$2, cipher=$3, region=$4, code=$5 WHERE id=$1',
      [shop.id, info.name, info.cipher, info.region || '', info.code || '']);
    const current = { ...shop, cipher: info.cipher };
    await call('POST', '/order/202309/orders/search', { shop: current, query: { page_size: 1 }, body: { order_status: 'AWAITING_SHIPMENT' } });
    // Order ID 0 sengaja tidak ada: TikTok menolak ID-nya kalau izin ada, menolak izinnya kalau tidak.
    await call('GET', '/fulfillment/202309/orders/0/handover_time_slots', { shop: current }).catch((e) => {
      if (e.tiktokCode === undefined || e.tiktokCode === SCOPE_DENIED) throw e;
    });
  } catch (e) {
    health = e.tiktokCode === undefined ? 'unknown' : 'problem';
    error = e.tiktokCode === SCOPE_DENIED
      ? `Izin API kurang: tambah scope Order & Fulfillment lalu otorisasi ulang. ${e.message}`
      : e.message;
  }
  await pool.query('UPDATE tiktok_shops SET health=$2, health_error=$3, last_check_at=now() WHERE id=$1', [shop.id, health, error]);
  return health;
}

let checking = false;

// Toko yang baru dicek dilewati kecuali force, supaya restart server tidak memborong kuota API.
export async function runChecks({ force = false } = {}) {
  if (checking || !isConfigured()) return false;
  checking = true;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tiktok_shops WHERE $1 OR last_check_at IS NULL OR last_check_at < now() - interval '25 minutes' ORDER BY id`, [force]);
    for (const shop of rows) await checkShop(shop);
    return rows.length > 0;
  } finally {
    checking = false;
  }
}

// Cari toko pemilik order: utamakan nama toko == seller_name, lalu toko lain (10 sekaligus).
// TikTok membalas sukses dengan objek kosong untuk order asing, jadi ID-nya wajib dicocokkan.
async function findOrder(orderId, sellerName) {
  const { rows } = await pool.query(
    'SELECT * FROM tiktok_shops ORDER BY (lower(name) = lower($1)) DESC, id', [sellerName || '']);
  let lastError = null;
  for (let i = 0; i < rows.length; i += 10) {
    const found = await Promise.all(rows.slice(i, i + 10).map(async (shop) => {
      const data = await call('GET', '/order/202309/orders', { shop, query: { ids: orderId } })
        .catch((e) => { lastError = e; return null; });
      const order = (data?.orders || []).find((o) => String(o.id) === orderId);
      return order ? { shop, order } : null;
    }));
    const hit = found.find(Boolean);
    if (hit) return hit;
  }
  return { lastError };
}

// Nomor order TikTok berupa angka panjang; marketplace lain tidak dicoba ke TikTok.
export function isTiktokOrder(pkg) {
  return !/shopee|lazada|blibli/i.test(pkg.platform || '') && /^\d{15,20}$/.test(pkg.invoice_no || '');
}

const SHIPPABLE = ['AWAITING_SHIPMENT', 'PARTIALLY_SHIPPING'];
const ALREADY_ARRANGED = ['AWAITING_COLLECTION', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];

async function shipOrder(shop, order) {
  const slots = await call('GET', `/fulfillment/202309/orders/${order.id}/handover_time_slots`, { shop });
  if (slots?.can_pickup === false) throw new Error('TikTok: order ini tidak mendukung penjemputan oleh kurir.');
  const body = { handover_method: 'PICKUP' };
  // Instant tidak punya slot; kurir terjadwal wajib memilih slot yang masih tersedia.
  const slot = (slots?.pickup_slots || []).find((x) => x.avaliable !== false);
  if (slot) body.pickup_slot = { start_time: slot.start_time, end_time: slot.end_time };
  const shipped = [];
  for (const { id } of order.packages || []) {
    // Lewati package yang sudah di-arrange, supaya percobaan ulang tidak dikirim dua kali.
    const pkg = await call('GET', `/fulfillment/202309/packages/${id}`, { shop });
    if (pkg?.package_status && pkg.package_status !== 'TO_FULFILL') continue;
    await call('POST', `/fulfillment/202309/packages/${id}/ship`, { shop, body });
    shipped.push(id);
  }
  return shipped;
}

const NOT_FOUND = 'Order tidak ditemukan di toko yang terhubung. Cek nomor order, atau cari driver manual di Seller Center.';

// Cari ordernya tanpa mengubah apa pun di TikTok. outcome terisi = driver tidak bisa diminta, alasannya di situ.
async function resolveOrder(pkg) {
  if (!isConfigured()) return { outcome: { mode: 'manual', message: NOT_FOUND } };
  const { shop, order, lastError } = await findOrder(pkg.invoice_no, pkg.seller_name);
  if (!order) {
    return { outcome: { mode: 'manual', message: `${NOT_FOUND}${lastError ? ` Sebagian toko gagal dicek: ${lastError.message}` : ''}` } };
  }
  if (!SHIPPABLE.includes(order.status) && !ALREADY_ARRANGED.includes(order.status)) {
    return { outcome: { mode: 'failed', message: `Order belum bisa dicarikan driver di TikTok (${order.status}).` } };
  }
  return { shop, order };
}

// Klik Cari Driver (tombol status atau tag). Geser balik dari driver_sampai_kios tidak termasuk:
// order itu sudah di-arrange.
export const asksDriver = (pkg, body) =>
  (body.status === 'mencari_driver' && ['absen_gojek', 'retur'].includes(pkg.status))
  || (body.is_cari_driver === true && !pkg.is_cari_driver);

// Paket input manual tidak punya data toko untuk dicocokkan: nomor yang tertukar bisa
// memanggil driver untuk order lain, jadi staf wajib melihat data ordernya dulu.
export const needsOrderConfirm = (pkg, body) =>
  pkg.source === 'manual' && asksDriver(pkg, body) && body.confirm_driver !== true;

function orderSummary(shop, order) {
  const items = [...new Set((order.line_items || []).map((i) => i.product_name).filter(Boolean))];
  return [
    `Toko: ${shop.name}`,
    order.recipient_address?.name && `Penerima: ${order.recipient_address.name}`,
    items.length > 0 && `Barang: ${items[0].slice(0, 60)}${items.length > 1 ? ` +${items.length - 1} lainnya` : ''}`,
    `Kurir: ${order.shipping_provider || order.delivery_option_name || '-'}`,
    `Status: ${order.status}`,
  ].filter(Boolean).join('\n');
}

// mode confirm = order ketemu, menunggu staf mencocokkan. Mode lain sama artinya dengan requestDriver.
export async function previewOrder(pkg) {
  if (!isTiktokOrder(pkg)) return { mode: 'manual', message: 'Nomor ini bukan order TikTok, cari driver manual.' };
  try {
    const { outcome, shop, order } = await resolveOrder(pkg);
    if (outcome) return outcome;
    const next = SHIPPABLE.includes(order.status)
      ? 'Driver akan diminta ke TikTok untuk order ini.'
      : 'Order ini sudah di-arrange, driver tidak diminta lagi. Paket akan ditautkan ke order ini.';
    return { mode: 'confirm', title: `Cocokkan order ${pkg.invoice_no}`, message: `${orderSummary(shop, order)}\n\n${next}` };
  } catch (e) {
    return { mode: 'failed', message: `Gagal mengecek order ke TikTok: ${e.message}` };
  }
}

// Cari driver berdasarkan nomor order. Tidak pernah melempar error: hasilnya dipakai setelah status tersimpan.
// mode: auto (driver diminta) | already (sudah di-arrange) | manual (order tidak ditemukan) | failed (TikTok menolak).
// null = bukan order TikTok, tidak perlu pemberitahuan.
export async function requestDriver(pkg) {
  if (!isTiktokOrder(pkg)) return null;
  try {
    const { outcome, shop, order } = await resolveOrder(pkg);
    if (outcome) return outcome;
    const base = { shopId: shop.shop_id, shopName: shop.name };
    if (ALREADY_ARRANGED.includes(order.status)) {
      return { ...base, mode: 'already', message: `Order sudah di-arrange di TikTok (${order.status}), tidak dikirim ulang.` };
    }
    const packageIds = await shipOrder(shop, order);
    return { ...base, mode: 'auto', packageIds, message: `Driver diminta ke TikTok untuk toko ${shop.name}.` };
  } catch (e) {
    return { mode: 'failed', message: `Gagal meminta driver ke TikTok: ${e.message}` };
  }
}

// Jalankan permintaan driver yang sudah tercatat, lalu simpan hasilnya.
// known = hasil previewOrder yang tidak butuh konfirmasi: driver tidak diminta, hasilnya saja yang disimpan.
// Tanda "sudah di MP" hanya menyala kalau memang tercatat di marketplace; mode manual membiarkannya apa adanya.
export async function finishDriverRequest(pkg, known = null) {
  const result = known || await requestDriver(pkg);
  const mp = result?.mode === 'auto' || result?.mode === 'already';
  const r = await pool.query(
    `UPDATE packages SET driver_request_pending=false, tiktok_shop_id=COALESCE($2, tiktok_shop_id),
       is_cari_driver = CASE WHEN $3 THEN true WHEN $4 THEN false ELSE is_cari_driver END, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [pkg.id, mp ? result.shopId : null, mp, result?.mode === 'failed']);
  return result && { ...result, pkg: r.rows[0] };
}

// Setelah batas ini permintaan tidak dikirim lagi: jangan sampai driver datang saat barang tidak lagi disiapkan.
const RETRY_AFTER = "interval '2 minutes'";
const RETRY_LIMIT = "interval '15 minutes'";

// Pulihkan permintaan yang terputus (server mati setelah status tersimpan, sebelum TikTok dipanggil).
export async function recoverDriverRequests() {
  await pool.query(
    `UPDATE packages SET driver_request_pending=false
     WHERE driver_request_pending AND status NOT IN ('absen_gojek', 'mencari_driver', 'driver_sampai_kios')`);
  const expired = await pool.query(
    `UPDATE packages SET driver_request_pending=false, is_cari_driver=false, updated_at=now()
     WHERE driver_request_pending AND driver_request_at < now() - ${RETRY_LIMIT} RETURNING *`);
  const outcomes = expired.rows.map((pkg) => ({
    pkg,
    mode: 'expired',
    message: `Permintaan driver order ${pkg.invoice_no} tidak terkirim karena server sempat mati. Nyalakan tag Cari Driver untuk mengulang.`,
  }));
  // Lease: hanya satu proses yang mengulang, dan tidak bentrok dengan request yang masih berjalan.
  const claimed = await pool.query(
    `UPDATE packages SET driver_request_lease_at=now()
     WHERE driver_request_pending AND driver_request_at < now() - ${RETRY_AFTER}
       AND (driver_request_lease_at IS NULL OR driver_request_lease_at < now() - ${RETRY_AFTER}) RETURNING *`);
  for (const pkg of claimed.rows) {
    const result = await finishDriverRequest(pkg);
    if (result) outcomes.push({ ...result, message: `Order ${pkg.invoice_no}: ${result.message}` });
  }
  return outcomes;
}

// action_code tracking TikTok, dari order asli.
const TRACK_SEARCHING = 21401;      // "Searching for a nearby driver."
const TRACK_ASSIGNED = 22001;       // "A driver has been assigned."
const TRACK_PICKUP_ASSIGNED = 20201; // "<nama> sudah ditugaskan ... di-pickup"
const TRACK_PICKED_UP = 30901;      // "Paket sudah di-pickup oleh <nama>."

// shortcut: nama driver baru terlihat pada teks Anteraja (Gojek/Grab Instant tidak menyertakannya), tambah pola kalau kurir lain menulisnya beda.
const DRIVER_NAME = [
  /^(\p{L}[\p{L} .'-]{0,59}?)\s+sudah ditugaskan\b/iu,
  /di-?pickup oleh\s+(\p{L}[\p{L} .'-]{0,59}?)\s*\.?\s*$/iu,
];

const byNewest = (a, b) => (b.update_time_millis || 0) - (a.update_time_millis || 0);

// Hanya event penjemputan: kurir pengantar ke pembeli bisa orang lain, bukan yang datang ke kios.
export function extractDriver(tracking = []) {
  const pickup = tracking.filter((e) => [TRACK_PICKUP_ASSIGNED, TRACK_PICKED_UP].includes(e.action_code)).sort(byNewest);
  for (const event of pickup) {
    for (const pattern of DRIVER_NAME) {
      const m = pattern.exec((event.description || '').trim());
      if (m) return m[1].trim();
    }
  }
  return '';
}

// Pencarian driver lagi setelah driver sempat ditugaskan = driver berganti.
export function countDriverResearch(tracking = []) {
  let assigned = false;
  let count = 0;
  for (const event of [...tracking].sort((a, b) => byNewest(b, a))) {
    if (event.action_code === TRACK_ASSIGNED) assigned = true;
    else if (event.action_code === TRACK_SEARCHING && assigned) { count += 1; assigned = false; }
  }
  return count;
}

// Isi nama driver dari tracking kalau datanya ada, nyalakan REFRESH kalau driver berganti.
// Tidak ada data atau izin = tidak terjadi apa-apa. Isian manual tidak ditimpa, kecuali nama dari TikTok berganti.
export async function syncDrivers() {
  if (!isConfigured()) return [];
  const { rows } = await pool.query(
    `SELECT p.id, p.invoice_no, p.driver_info, p.driver_auto_info, p.driver_research_count, s.id AS shop_row_id
     FROM packages p JOIN tiktok_shops s ON s.shop_id = p.tiktok_shop_id
     WHERE p.status IN ('mencari_driver', 'driver_sampai_kios') AND NOT p.archived AND NOT p.driver_locked`);
  const changed = [];
  const denied = new Set();
  for (const row of rows) {
    if (denied.has(row.shop_row_id)) continue;
    const shop = (await pool.query('SELECT * FROM tiktok_shops WHERE id=$1', [row.shop_row_id])).rows[0];
    if (!shop) continue;
    const data = await call('GET', `/fulfillment/202309/orders/${row.invoice_no}/tracking`, { shop }).catch((e) => {
      if (e.tiktokCode === SCOPE_DENIED) denied.add(row.shop_row_id);
      return null;
    });
    if (!data) continue;
    const name = extractDriver(data.tracking);
    const researches = countDriverResearch(data.tracking);
    const newName = !!name && name !== row.driver_auto_info;
    const researched = researches > row.driver_research_count;
    if (!newName && !researched) continue;
    const replaced = newName && !!row.driver_auto_info;
    const filled = newName && (replaced || !row.driver_info.trim());
    const refreshed = replaced || researched;
    const r = await pool.query(
      `UPDATE packages SET driver_info=$2, driver_auto_info=$3, driver_research_count=$4,
         driver_refreshed = driver_refreshed OR $5, updated_at = CASE WHEN $6 THEN now() ELSE updated_at END
       WHERE id=$1 AND NOT driver_locked AND driver_info=$7 RETURNING *`,
      [row.id, filled ? name : row.driver_info, name || row.driver_auto_info, researches, refreshed, filled || refreshed, row.driver_info]);
    if (r.rows[0] && (filled || refreshed)) changed.push({ pkg: r.rows[0], filled, refreshed });
  }
  return changed;
}
