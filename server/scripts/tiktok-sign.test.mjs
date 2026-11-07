// Regresi signing TikTok — vektor dicocokkan dengan signatureByAppSecret library npm `tiktok-shop`.
// Jalankan: node --test scripts/tiktok-sign.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// sign() tidak menyentuh database; koneksi hanya dibuat saat ada query.
process.env.DATABASE_URL ||= 'postgres://unused';
const { sign } = await import('../src/tiktok.mjs');

test('sign dengan body, sign & access_token diabaikan', () => {
  const params = { app_key: 'abc', shop_cipher: 'ROW_x', timestamp: 1700000000, ids: '5791', sign: 'zz', access_token: 'tok' };
  assert.equal(sign('/fulfillment/202309/packages/1/ship', params, JSON.stringify({ handover_method: 'PICKUP' }), 'testsecret'),
    '69338738c171e22dff81a9a8a5f9f461d34c38fa5878ab04c4421692d94d5e25');
});

test('sign tanpa body', () => {
  assert.equal(sign('/authorization/202309/shops', { app_key: 'abc', timestamp: 1700000000 }, '', 'testsecret'),
    '305398a074c821df9de7f2f3ed959247b673c3e06a6471a5a85087fca4ac8a03');
});
