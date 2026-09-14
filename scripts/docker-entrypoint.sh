#!/bin/sh
set -eu
: "${DATABASE_URL:?Configure a new PostgreSQL database for FaceAds v2}"
: "${MCP_ENCRYPTION_KEY:?Configure MCP_ENCRYPTION_KEY with 64 hex characters}"
: "${MCP_BASE_URL:=${RAILWAY_PUBLIC_DOMAIN:+https://${RAILWAY_PUBLIC_DOMAIN}}}"
: "${MCP_BASE_URL:?Configure MCP_BASE_URL or generate a Railway public domain}"
export MCP_BASE_URL
node -e 'if(!/^[a-fA-F0-9]{64}$/.test(process.env.MCP_ENCRYPTION_KEY||""))process.exit(1)'
echo '[startup] Applying v2 database migrations'
./node_modules/.bin/prisma migrate deploy
echo '[startup] Starting FaceAds MCP v2'
exec node dist/index.js --http --port "${PORT:-3000}"
