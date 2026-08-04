#!/usr/bin/env bash
# PickHub — update & deploy di VPS.
# Jalankan dari folder proyek:  bash deploy/update.sh
# Berhenti otomatis jika ada langkah yang gagal.
set -euo pipefail

PROJECT_DIR="/opt/gudang-board"
WEB_ROOT="/var/www/gudang-board"

echo "==> [1/5] Menarik kode terbaru dari GitHub..."
cd "$PROJECT_DIR"
git pull origin main

echo "==> [2/5] Rebuild & restart backend (Docker)..."
cd "$PROJECT_DIR/deploy"
docker compose up -d --build

echo "==> [3/5] Install dependency app..."
cd "$PROJECT_DIR/app"
npm install

echo "==> [4/5] Build web (expo export)..."
npx expo export -p web

echo "==> [5/5] Pasang web ke Nginx root..."
mkdir -p "$WEB_ROOT"
rm -rf "${WEB_ROOT:?}"/*          # bersihkan file lama (aman: WEB_ROOT wajib terisi)
cp -r "$PROJECT_DIR/app/dist/"* "$WEB_ROOT"/

echo "==> ✅ Selesai! PickHub sudah terupdate."
