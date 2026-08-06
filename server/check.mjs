import 'dotenv/config';
import { pool } from './src/db.mjs';

const search = process.argv[2]?.trim();

if (!search) {
  console.log('⚠️  Harap masukkan No Invoice atau No AWB/Resi.');
  console.log('Penggunaan: node check.mjs <NO_INVOICE_ATAU_RESI>');
  console.log('Contoh:    node check.mjs 260803CF97WT7V');
  process.exit(1);
}

async function check() {
  try {
    const res = await pool.query(
      `SELECT * FROM packages 
       WHERE invoice_no ILIKE $1 OR awb_no ILIKE $1 
       ORDER BY updated_at DESC`,
      [`%${search}%`]
    );

    if (res.rows.length === 0) {
      console.log(`❌ Tidak ditemukan data paket dengan invoice/AWB: "${search}"`);
      process.exit(0);
    }

    console.log(`\n========================================================`);
    console.log(`🔍 HASIL PENCARIAN DB (${res.rows.length} paket ditemukan)`);
    console.log(`========================================================\n`);

    res.rows.forEach((p, idx) => {
      console.log(`📦 --- [ PAKET #${idx + 1} (ID: ${p.id}) ] ---`);
      console.log(`• No Invoice       : ${p.invoice_no}`);
      console.log(`• No AWB / Resi    : ${p.awb_no || '-'}`);
      console.log(`• Status           : ${p.status?.toUpperCase()}`);
      console.log(`• Jenis Ambilan    : ${p.pickup_type}`);
      console.log(`• Pickup Code / PIN: ${p.pickup_code || '(KOSONG)'}`);
      console.log(`• Customer         : ${p.customer_name || '-'} (${p.customer_phone || '-'})`);
      console.log(`• Barang / Item    : ${p.item_desc || '-'}`);
      console.log(`• Marketplace/Toko : ${p.platform || '-'}`);
      console.log(`• Kurir            : ${p.courier || '-'}`);
      console.log(`• Admin Note       : ${p.admin_note || '-'}`);
      console.log(`• Picker           : ${p.picker_name || '-'}`);
      console.log(`• Source           : ${p.source}`);
      console.log(`• Dibuat Tanggal   : ${p.created_at ? new Date(p.created_at).toLocaleString('id-ID') : '-'}`);
      console.log(`• Diupdate Tanggal : ${p.updated_at ? new Date(p.updated_at).toLocaleString('id-ID') : '-'}`);
      console.log(`• Jam Masuk Gojek  : ${p.gojek_at ? new Date(p.gojek_at).toLocaleString('id-ID') : '-'}`);
      console.log(`• Waktu Selesai    : ${p.done_at ? new Date(p.done_at).toLocaleString('id-ID') : '-'}`);
      console.log(`• Status Arsip     : ${p.archived ? 'DIARSIPKAN' : 'AKTIF'}`);
      
      let rawObj = p.raw;
      if (typeof rawObj === 'string') {
        try { rawObj = JSON.parse(rawObj); } catch (e) {}
      }
      if (rawObj && typeof rawObj === 'object' && Object.keys(rawObj).length > 0) {
        console.log(`• Data RAW CSV (Export VEF):`);
        console.log(JSON.stringify(rawObj, null, 2));
      }
      console.log(`--------------------------------------------------------\n`);
    });

  } catch (err) {
    console.error('❌ Terjadi kesalahan saat membaca database:', err.message);
  } finally {
    process.exit(0);
  }
}

check();
