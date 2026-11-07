// Development runner: menyalakan PostgreSQL embedded (tanpa install ke sistem),
// lalu menjalankan API server. Di VPS/production pakai `npm start` + DATABASE_URL.
import 'dotenv/config';
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Port bisa diganti lewat server/.env kalau bentrok dengan proyek lain di mesin ini.
const PG_PORT = Number(process.env.DEV_PG_PORT || 5433);
const API_PORT = process.env.DEV_API_PORT || '4000';
// Log server untuk menyelidiki restart atau crash (terminal bisa saja sudah tertutup).
const log = fs.createWriteStream(path.resolve('dev.log'), { flags: 'a' });
const tee = (out) => (chunk) => {
  out.write(chunk);
  log.write(`[${new Date().toISOString()}] ${chunk}`);
};

const dataDir = path.resolve('pgdata');
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: PG_PORT,
  persistent: true,
  // UTF8 agar sama dengan Postgres produksi; default Windows (WIN1252)
  // menolak karakter unicode dari CSV marketplace.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
  console.log('Inisialisasi database pertama kali...');
  await pg.initialise();
}
await pg.start();
console.log(`PostgreSQL embedded jalan di port ${PG_PORT}`);

// --watch-path: hanya perubahan di src/ yang me-restart server. --watch biasa ikut memantau
// semua dependensi, dan pernah me-restart server di tengah request tanpa ada file yang diedit.
const server = spawn(process.execPath, ['--watch-path=src', 'src/index.mjs'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: API_PORT,
    DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres`,
    MEILI_HOST: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
    MEILI_MASTER_KEY: process.env.MEILI_MASTER_KEY || '',
  },
});

server.stdout.on('data', tee(process.stdout));
server.stderr.on('data', tee(process.stderr));

async function shutdown() {
  server.kill();
  await pg.stop().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('exit', () => shutdown());
