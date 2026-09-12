#!/usr/bin/env bash

###############################################################################
# API Deployment Script (shared across instances)
###############################################################################

set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

###############################################################################
# Load NVM
###############################################################################

export NVM_DIR="$HOME/.nvm"

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo "❌ NVM is not installed or could not be found."
    exit 1
fi

. "$NVM_DIR/nvm.sh"

# Droplet default Node is already 24; use whatever nvm has selected / default.
nvm use default >/dev/null 2>&1 || true

echo "Using Node $(node -v)"
echo "Using npm $(npm -v)"

cd "$APP_DIR"

###############################################################################
# Load instance env (not auto-loaded by the shell / DigitalOcean)
###############################################################################

if [ -f "$APP_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$APP_DIR/.env"
    set +a
fi

INSTANCE_NAME="${INSTANCE_NAME:-API}"
INSTANCE_ID="${INSTANCE_ID:-api}"

echo ""
echo "======================================================="
echo "🚀 ${INSTANCE_NAME} API Deployment Started"
echo "   instance: ${INSTANCE_ID}"
echo "   dir:      ${APP_DIR}"
echo "======================================================="

###############################################################################
# Fetch latest code
###############################################################################

echo ""
echo "📥 Fetching latest code..."

git fetch origin

###############################################################################
# Detect dependency changes BEFORE reset
###############################################################################

PACKAGE_LOCK_CHANGED=false

if ! git diff --quiet HEAD origin/main -- package-lock.json; then
    PACKAGE_LOCK_CHANGED=true
fi

###############################################################################
# Reset to latest main
###############################################################################

echo ""
echo "🔄 Syncing repository..."

git reset --hard origin/main

###############################################################################
# Install dependencies only if needed
###############################################################################

if [ "$PACKAGE_LOCK_CHANGED" = true ]; then

    echo ""
    echo "📦 package-lock.json changed"

    echo "Installing dependencies..."

    npm ci

else

    echo ""
    echo "📦 Dependencies unchanged"

    echo "Skipping npm install."

fi

###############################################################################
# Build application
###############################################################################

echo ""
echo "🏗️ Building application..."

# Stale incremental cache at repo root survives `deleteOutDir` and can skip emit.
rm -f tsconfig.build.tsbuildinfo tsconfig.tsbuildinfo

npm run build

if [ ! -f dist/main.js ]; then
    echo "❌ Build did not produce dist/main.js"
    ls -la dist 2>/dev/null || true
    exit 1
fi

###############################################################################
# Restart application
###############################################################################

echo ""
echo "♻️ Restarting PM2..."

pm2 restart ecosystem.config.js --update-env

###############################################################################
# Health check
###############################################################################

echo ""
echo "❤️ Waiting for application..."

for i in {1..30}; do

    if curl --fail --silent http://localhost:3000/api/v1/health > /dev/null; then

        echo "✅ Health check passed."

        break

    fi

    echo "Waiting... ($i/30)"

    sleep 2

done

###############################################################################
# Final verification
###############################################################################

curl --fail --silent http://localhost:3000/api/v1/health > /dev/null

###############################################################################
# Save PM2
###############################################################################

pm2 save

###############################################################################
# Done
###############################################################################

echo ""
echo "======================================================="
echo "✅ ${INSTANCE_NAME} Deployment Successful"
echo "======================================================="
