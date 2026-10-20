import { MeiliSearch } from 'meilisearch';

const MEILI_HOST = process.env.MEILI_HOST || 'http://127.0.0.1:7700';
const MEILI_KEY = process.env.MEILI_MASTER_KEY || '';

export const meili = MEILI_HOST ? new MeiliSearch({
  host: MEILI_HOST,
  apiKey: MEILI_KEY || undefined,
}) : null;

const INDEX_NAME = 'packages';

const SEARCHABLE = [
  'invoice_no', 'awb_no', 'customer_name', 'seller_name', 'pickup_code',
  'courier', 'platform', 'item_desc', 'driver_info', 'status',
];
const FILTERABLE = ['status', 'pickup_type', 'archived', 'courier', 'platform', 'seller_name', 'pickup_code', 'has_pickup_code'];
const SORTABLE = ['updated_at', 'created_at', 'received_at'];

export async function ensureIndex() {
  if (!meili) return false;
  try {
    const index = meili.index(INDEX_NAME);
    await index.updateSettings({
      searchableAttributes: SEARCHABLE,
      filterableAttributes: FILTERABLE,
      sortableAttributes: SORTABLE,
    });
    return true;
  } catch (err) {
    console.warn('Meilisearch tidak tersedia, search fallback ke ILIKE:', err.message);
    return false;
  }
}

function pkgToDoc(pkg) {
  const hasCode = !!(pkg.pickup_code && String(pkg.pickup_code).trim());
  return {
    id: pkg.id,
    invoice_no: pkg.invoice_no || '',
    awb_no: pkg.awb_no || '',
    customer_name: pkg.customer_name || '',
    seller_name: pkg.seller_name || '',
    customer_phone: pkg.customer_phone || '',
    item_desc: pkg.item_desc || '',
    platform: pkg.platform || '',
    courier: pkg.courier || '',
    pickup_type: pkg.pickup_type || '',
    status: pkg.status || '',
    pickup_code: pkg.pickup_code || '',
    has_pickup_code: hasCode,
    driver_info: pkg.driver_info || '',
    archived: pkg.archived || false,
    updated_at: pkg.updated_at ? new Date(pkg.updated_at).getTime() : 0,
    created_at: pkg.created_at ? new Date(pkg.created_at).getTime() : 0,
    received_at: pkg.received_at ? new Date(pkg.received_at).getTime() : 0,
  };
}

export async function indexPackage(pkg) {
  if (!meili) return;
  try {
    await meili.index(INDEX_NAME).addDocuments([pkgToDoc(pkg)]);
  } catch (err) {
    console.error('Meilisearch indexPackage error:', err.message);
  }
}

export async function removePackage(id) {
  if (!meili) return;
  try {
    await meili.index(INDEX_NAME).deleteDocument(id);
  } catch (err) {
    console.error('Meilisearch removePackage error:', err.message);
  }
}

export async function bulkIndexPackages(pkgs) {
  if (!meili || !pkgs.length) return;
  try {
    await meili.index(INDEX_NAME).addDocuments(pkgs.map(pkgToDoc));
  } catch (err) {
    console.error('Meilisearch bulkIndexPackages error:', err.message);
  }
}

export async function searchPackages(q, filters = {}) {
  if (!meili) return null;
  try {
    const filterArr = [];
    if (filters.archived !== undefined) filterArr.push(`archived = ${filters.archived}`);
    if (filters.pickup_type) filterArr.push(`pickup_type = "${filters.pickup_type}"`);
    if (filters.statuses?.length) {
      filterArr.push(filters.statuses.map((s) => `status = "${s}"`).join(' OR '));
    }
    // Filter kondisi pickup code (tab selfpickup) — pakai flag boolean
    // has_pickup_code karena Meilisearch tidak bisa filter string kosong dengan andal.
    if (filters.pickup_code === 'empty') {
      filterArr.push(`has_pickup_code = false`);
    } else if (filters.pickup_code === 'filled') {
      filterArr.push(`has_pickup_code = true`);
    }
    // Filter per kolom (search spesifik per field)
    // Dengan attributesToSearchOn, pencarian difokuskan ke field tertentu
    // (lebih akurat daripada exact filter yang butuh full match).
    let searchOn = undefined;
    if (filters.invoice) {
      searchOn = ['invoice_no', 'awb_no'];
      q = filters.invoice;
    } else if (filters.customer) {
      searchOn = ['customer_name'];
      q = filters.customer;
    } else if (filters.toko) {
      searchOn = ['seller_name'];
      q = filters.toko;
    } else if (filters.courier) {
      searchOn = ['courier'];
      q = filters.courier;
    } else if (filters.code) {
      searchOn = ['pickup_code'];
      q = filters.code;
    }
    const filterStr = filterArr.length ? filterArr.join(' AND ') : undefined;

    // Strategi pencarian general (tanpa filter per kolom):
    // - Exact code: query ada '/' DAN >=8 char -> exact filter + matchingStrategy 'all'
    //   (mencegah 'SO/1026/96EB793' terpecah jadi token 'SO','1026','96EB793'
    //   yang mengembalikan 1000 paket terbaru karena sort updated_at:desc).
    //   Syarat '/' wajib: tanpa itu, nama toko panjang seperti 'rizkyapple'
    //   (10 char) salah masuk mode exact dan hanya disisir ke invoice_no.
    // - Numeric: query murni digit >=3 -> fokus ke kolom bernomor (index trigram).
    // - Code campuran: alphanumeric 5+ TANPA spasi DAN mengandung digit ->
    //   fokus ke kolom kode (mencegah 5-7 char nyasar ke nama/HP).
    //   Syarat mengandung digit wajib: 'rizkyapple' (huruf saja, 10 char) bukan
    //   kode paket, tetap masuk mode nama biar seller/customer ketemu.
    // - Lainnya (nama/umum): pakai seluruh SEARCHABLE list supaya nama
    //   customer/toko tetap ketemu.
    const qTrim = String(q || '').trim();
    const isExact = /[\/]/.test(qTrim) && qTrim.length >= 8;
    const isNumericOnly = /^\d{3,}$/.test(qTrim);
    const isCodeQuery = /^(?=.*\d)[A-Za-z0-9]{5,}$/.test(qTrim) && !qTrim.includes(' ');
    const generalOn = ['invoice_no', 'awb_no', 'pickup_code'];

    const opts = {
      limit: filters.limit || 200,
      offset: filters.offset || 0,
      sort: ['updated_at:desc'],
      attributesToRetrieve: [
        'id', 'invoice_no', 'awb_no', 'customer_name', 'seller_name', 'customer_phone', 'item_desc',
        'platform', 'courier', 'pickup_type', 'status', 'pickup_code', 'admin_note',
        'picker_name', 'source', 'received_at', 'done_at', 'created_at', 'updated_at',
        'gojek_at', 'archived', 'archived_at', 'driver_info', 'driver_locked', 'driver_refreshed',
        'done_by', 'is_hold', 'is_cari_driver',
      ],
    };
    if (searchOn) {
      // Filter per kolom: pakai field spesifik
      opts.attributesToSearchOn = searchOn;
    } else if (isExact && !qTrim.includes(' ')) {
      // Exact code: hanya invoice_no/awb_no, semua token wajib ada
      opts.attributesToSearchOn = ['invoice_no', 'awb_no'];
      opts.matchingStrategy = 'all';
    } else if (isNumericOnly || isCodeQuery) {
      // Query angka/kode: fokus ke field kode, bukan nama/toko
      opts.attributesToSearchOn = generalOn;
    } else {
      // Query nama/umum: cari di semua field (default SEARCHABLE list)
      // biar user bisa cari nama customer, seller, dll
    }
    if (filterStr) opts.filter = filterStr;

    const result = await meili.index(INDEX_NAME).search(q, opts);
    return {
      hits: result.hits,
      total: result.estimatedTotalHits,
    };
  } catch (err) {
    console.error('Meilisearch searchPackages error:', err.message);
    return null;
  }
}
