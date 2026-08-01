# 📦 PickHub — Warehouse Management System

Aplikasi manajemen paket **retail pickup** untuk kios. Satu codebase React Native (Expo)
untuk **Android** dan **Web**, backend **Express + PostgreSQL + Socket.IO**.

## Fitur Utama

- 📋 **Import CSV** dari data VEF (khusus role Warehouse)
- 📱 **Scan barcode** paket masuk via kamera HP
- 🧍 **Self Pick Up** — customer ambil langsung ke kios
- 🛵 **Gojek/Driver** — pickup via ojek online
- 🔒 **Multi-role**: Super Admin, Admin Kios, Sales, Warehouse
- 📸 **Foto bukti** (wajah driver/pengambil, KTP, barang) — auto-resize & dikunci permanen setelah konfirmasi
- 🔄 **Realtime sync** antar semua perangkat via WebSocket
- 📊 **Dashboard** statistik harian
- 👤 **User Management** (CRUD, proteksi Super Admin terakhir)
- ↩️ **Retur & Cancel** dengan konfirmasi modal
- 📥 **Download foto** langsung ke perangkat

## Struktur Project

```
gudang-board/
├── app/                  # Aplikasi Expo (Android + Web)
│   ├── src/              # Source code React Native
│   ├── package.json
│   └── app.json
├── server/               # REST API + WebSocket
│   ├── src/              # Source code backend (ESM)
│   ├── scripts/          # Dev scripts (embedded PostgreSQL)
│   ├── Dockerfile        # Docker image untuk production
│   └── package.json
├── deploy/               # Konfigurasi deployment VPS
│   ├── docker-compose.yml
│   ├── nginx.conf.example
│   └── setup-vps.sh      # Script setup VPS otomatis
├── .env.example          # Template environment variables
└── README.md
```

## Menjalankan di Lokal (Development)

### Prasyarat
- **Node.js** v18+ (direkomendasikan v22)
- **npm** (sudah termasuk di Node.js)
- Tidak perlu install PostgreSQL — dev mode pakai embedded PostgreSQL otomatis

### Langkah

```bash
# 1. Clone repo
git clone git@github.com:zidangrh-dev/warehouse-vibe-coding.git gudang-board
cd gudang-board

# 2. Jalankan backend API (Terminal 1)
cd server
npm install
npm run dev          # API di http://localhost:4000 (PostgreSQL otomatis di port 5433)

# 3. Jalankan frontend web (Terminal 2)
cd app
npm install
npx expo start --web    # Buka http://localhost:8081

# 4. Untuk Android (HP di WiFi yang sama)
cd app
npx expo start          # Scan QR code dengan Expo Go dari Play Store
```

### Akun Login Default

| Role | Username | Password |
|------|----------|----------|
| Super Admin | superadmin | superadmin123 |
| Warehouse | gudang | gudang123 |
| Admin Kios | admin | admin123 |
| Sales | sales | sales123 |

> ⚠️ **Ganti password** sebelum dipakai di production!

## Deploy ke VPS (Ubuntu + Docker)

### Prasyarat VPS
- Ubuntu 20.04+ / Debian 11+
- Minimal 1 Core, 2 GB RAM, 40 GB Storage
- Akses root / sudo

### Cara Cepat (Script Otomatis)

```bash
# 1. SSH ke VPS
ssh root@202.10.44.147

# 2. Clone repo
git clone git@github.com:zidangrh-dev/warehouse-vibe-coding.git /opt/gudang-board
cd /opt/gudang-board

# 3. Jalankan script setup
chmod +x deploy/setup-vps.sh
./deploy/setup-vps.sh
```

Script `setup-vps.sh` akan secara otomatis:
1. Install Docker & Docker Compose
2. Generate password database & JWT secret yang aman
3. Buat file `.env` dari template
4. Build & jalankan container (PostgreSQL + API backend)
5. Install & konfigurasi Nginx sebagai reverse proxy
6. Build web frontend dari Expo

### Cara Manual

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh

# 2. Clone repo ke VPS
git clone git@github.com:zidangrh-dev/warehouse-vibe-coding.git /opt/gudang-board
cd /opt/gudang-board

# 3. Buat file .env
cd deploy
cp ../.env.example .env
nano .env    # isi DB_PASSWORD dan JWT_SECRET dengan value yang kuat

# 4. Jalankan containers
docker compose up -d --build

# 5. Build web frontend
cd ../app
npm install
npx expo export -p web
sudo mkdir -p /var/www/gudang-board
sudo cp -r dist/* /var/www/gudang-board/

# 6. Install & konfigurasi Nginx
sudo apt install -y nginx
sudo cp ../deploy/nginx.conf.example /etc/nginx/sites-available/gudang
# Edit: ganti server_name dengan IP atau domain Anda
sudo ln -sf /etc/nginx/sites-available/gudang /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### Akses Setelah Deploy
- **Web:** `http://202.10.44.147`
- **Android APK:** Build dengan `eas build` (PROD_API sudah di-set ke IP VPS)

### HTTPS (Opsional, Jika Punya Domain)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d nama-domain-anda.com
```

## Build APK Android

```bash
cd app
npm install -g eas-cli
eas login                               # akun Expo gratis
eas build -p android --profile preview  # menghasilkan .apk
```

> `PROD_API` di `app/src/api.js` sudah di-set ke `http://202.10.44.147`.

## Alur Kerja Developer (Git Workflow)

```
[Lokal: dev]  →  git push  →  [GitHub: main]  →  ssh ke VPS  →  git pull  →  rebuild
```

1. Develop & test di lokal (`npm run dev`)
2. Commit & push ke GitHub (`git push origin main`)
3. SSH ke VPS, pull perubahan terbaru:
   ```bash
   ssh root@202.10.44.147
   cd /opt/gudang-board
   git pull origin main
   cd deploy && docker compose up -d --build    # rebuild backend
   cd ../app && npm install && npx expo export -p web && sudo cp -r dist/* /var/www/gudang-board/   # rebuild frontend
   ```

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React Native (Expo 57), React 19 |
| Backend | Node.js (ESM), Express 4, Socket.IO |
| Database | PostgreSQL 17 |
| Auth | JWT + bcryptjs |
| Upload | Multer, expo-image-manipulator (auto-resize) |
| Container | Docker + Docker Compose |
| Web Server | Nginx (reverse proxy) |
