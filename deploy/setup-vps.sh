#!/bin/bash
# ============================================
# PickHub — Script Setup VPS Otomatis
# ============================================
# Jalankan di VPS Ubuntu/Debian sebagai root:
#   chmod +x deploy/setup-vps.sh
#   ./deploy/setup-vps.sh
# ============================================

set -e

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   📦 PickHub — VPS Setup Script      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$PROJECT_DIR/deploy"
WEB_DIR="/var/www/gudang-board"

# -------------------------------------------
# 1. Install Docker (jika belum ada)
# -------------------------------------------
echo -e "${YELLOW}[1/6] Memeriksa Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo "  Docker belum terinstall. Menginstall..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "  ${GREEN}✅ Docker berhasil diinstall${NC}"
else
    echo -e "  ${GREEN}✅ Docker sudah terinstall$(docker --version)${NC}"
fi

# Pastikan docker compose plugin tersedia
if ! docker compose version &> /dev/null; then
    echo "  Menginstall Docker Compose plugin..."
    apt-get update -qq && apt-get install -y -qq docker-compose-plugin
fi

# -------------------------------------------
# 2. Generate .env file
# -------------------------------------------
echo -e "${YELLOW}[2/6] Membuat file .env...${NC}"
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
    JWT_SEC=$(openssl rand -hex 32)

    cat > "$DEPLOY_DIR/.env" <<EOF
DB_PASSWORD=${DB_PASS}
JWT_SECRET=${JWT_SEC}
PORT=4000
EOF
    echo -e "  ${GREEN}✅ File .env dibuat dengan password & secret yang aman${NC}"
    echo -e "  ${BLUE}   DB_PASSWORD: ${DB_PASS}${NC}"
    echo -e "  ${BLUE}   JWT_SECRET:  ${JWT_SEC:0:16}...${NC}"
else
    echo -e "  ${GREEN}✅ File .env sudah ada, dilewati${NC}"
fi

# -------------------------------------------
# 3. Build & Start Docker containers
# -------------------------------------------
echo -e "${YELLOW}[3/6] Build & menjalankan containers...${NC}"
cd "$DEPLOY_DIR"
docker compose up -d --build
echo -e "  ${GREEN}✅ Containers berjalan (PostgreSQL + API backend)${NC}"

# -------------------------------------------
# 4. Install Node.js (untuk build web)
# -------------------------------------------
echo -e "${YELLOW}[4/6] Memeriksa Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo "  Node.js belum terinstall. Menginstall Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
    echo -e "  ${GREEN}✅ Node.js $(node --version) berhasil diinstall${NC}"
else
    echo -e "  ${GREEN}✅ Node.js sudah terinstall: $(node --version)${NC}"
fi

# -------------------------------------------
# 5. Build web frontend (Expo export)
# -------------------------------------------
echo -e "${YELLOW}[5/6] Build web frontend...${NC}"
cd "$PROJECT_DIR/app"
npm install --legacy-peer-deps
npx expo export -p web
mkdir -p "$WEB_DIR"
cp -r dist/* "$WEB_DIR/"
echo -e "  ${GREEN}✅ Web frontend di-build ke $WEB_DIR${NC}"

# -------------------------------------------
# 6. Install & konfigurasi Nginx
# -------------------------------------------
echo -e "${YELLOW}[6/6] Konfigurasi Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt-get install -y -qq nginx
fi

cp "$DEPLOY_DIR/nginx.conf.example" /etc/nginx/sites-available/gudang
ln -sf /etc/nginx/sites-available/gudang /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test & reload Nginx
nginx -t && systemctl reload nginx
echo -e "  ${GREEN}✅ Nginx dikonfigurasi dan berjalan${NC}"

# -------------------------------------------
# Selesai!
# -------------------------------------------
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   🎉 PickHub berhasil di-deploy!                 ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                  ║${NC}"
echo -e "${GREEN}║   🌐 Web:  http://202.10.44.147                  ║${NC}"
echo -e "${GREEN}║   🔌 API:  http://202.10.44.147/api              ║${NC}"
echo -e "${GREEN}║                                                  ║${NC}"
echo -e "${GREEN}║   📂 Project:  $PROJECT_DIR${NC}"
echo -e "${GREEN}║   📂 Web Root: $WEB_DIR${NC}"
echo -e "${GREEN}║                                                  ║${NC}"
echo -e "${GREEN}║   Credentials tersimpan di:                      ║${NC}"
echo -e "${GREEN}║   $DEPLOY_DIR/.env${NC}"
echo -e "${GREEN}║                                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}💡 Tips selanjutnya:${NC}"
echo -e "   • Login di browser: http://202.10.44.147"
echo -e "   • Untuk update: cd $PROJECT_DIR && git pull && cd deploy && docker compose up -d --build"
echo -e "   • Untuk HTTPS (jika punya domain): sudo certbot --nginx -d domain-anda.com"
echo ""
