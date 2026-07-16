# 📦 Gudang Board

Aplikasi manajemen task gudang ala Trello. Satu codebase React Native (Expo) untuk
**Android** dan **Web**, backend **Express + PostgreSQL + Socket.IO**.

Fitur: board multi-kolom, drag & drop kartu (pegangan ⠿), realtime sync antar
perangkat, prioritas berwarna, tenggat, lampiran foto barang, dan scan barcode
via kamera HP (di web: input manual).

## Struktur

- `server/` — REST API + WebSocket. Dev pakai PostgreSQL embedded (tanpa install),
  produksi pakai `DATABASE_URL` ke Postgres asli.
- `app/` — Aplikasi Expo (Android + Web).
- `deploy/` — docker-compose + contoh Nginx untuk VPS.

## Menjalankan di lokal

```bash
# Terminal 1 — API (otomatis menyalakan PostgreSQL embedded di port 5433)
cd server && npm install && npm run dev     # API di http://localhost:4000

# Terminal 2 — Web
cd app && npm install && npx expo start --web   # buka http://localhost:8081

# Android (HP di WiFi yang sama, install Expo Go dari Play Store)
cd app && npx expo start                    # scan QR dengan Expo Go
```

Alamat API terdeteksi otomatis saat development (lihat `app/src/api.js`).

## Build APK Android

```bash
cd app
npm install -g eas-cli
eas login                    # akun Expo gratis
eas build -p android --profile preview   # menghasilkan .apk yang bisa diinstall
```

Sebelum build produksi, isi `PROD_API` di `app/src/api.js` dengan domain VPS.

## Deploy ke VPS (Ubuntu + Docker)

1. Install Docker, lalu salin folder `server/` dan `deploy/` ke VPS.
2. `cd deploy && echo "DB_PASSWORD=passwordkuat" > .env && docker compose up -d --build`
3. Build web: `cd app && npx expo export -p web` → upload folder `dist/` ke
   `/var/www/gudang-board` di VPS.
4. Pasang Nginx dengan `deploy/nginx.conf.example` (ganti domain), lalu
   `certbot --nginx` untuk HTTPS.

## Catatan v1

- Belum ada login/akun — semua orang di jaringan yang sama melihat board yang sama.
  (Bisa ditambahkan di v2 bersama assignment ke pekerja.)
- Scan barcode kamera hanya di aplikasi Android; web memakai input manual.
