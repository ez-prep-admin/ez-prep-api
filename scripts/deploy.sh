#!/usr/bin/env bash

###############################################################################
# EZ Prep API Deployment Script
###############################################################################

set -Eeuo pipefail

###############################################################################
# Load NVM and select Node.js
###############################################################################

export NVM_DIR="$HOME/.nvm"

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo "❌ NVM is not installed or could not be found."
    exit 1
fi

. "$NVM_DIR/nvm.sh"

nvm use 24.16.0

echo "Using Node $(node -v)"
echo "Using npm $(npm -v)"

if [ "$(node -v)" != "v24.16.0" ]; then
    echo "❌ Unexpected Node.js version."
    exit 1
fi

echo ""
echo "======================================================="
echo "🚀 EZ Prep API Deployment Started"
echo "======================================================="

###############################################################################
# Move to project directory
###############################################################################

cd /var/www/ez-prep-api

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
echo "✅ Deployment Successful"
echo "======================================================="