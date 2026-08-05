// Development runner: menyalakan PostgreSQL embedded (tanpa install ke sistem),
// lalu menjalankan API server. Di VPS/production pakai `npm start` + DATABASE_URL.
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve('pgdata');
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: 5433,
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
console.log('PostgreSQL embedded jalan di port 5433');

const server = spawn(process.execPath, ['--watch', 'src/index.mjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5433/postgres',
  },
});

async function shutdown() {
  server.kill();
  await pg.stop().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('exit', () => shutdown());
