#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/devai/usuarios/convertia-multiuser-ec5c8847}"
APP_MODE="${APP_MODE:-streaming}"
STREAMING_PORT="${BROWSER_STREAMING_ENGINE_PORT:-8790}"
BROWSER_PORT="${BROWSER_ENGINE_PORT:-8787}"

cd "$PROJECT_DIR"

if command -v google-chrome >/dev/null 2>&1; then
  BROWSER_BIN="$(command -v google-chrome)"
elif command -v chromium >/dev/null 2>&1; then
  BROWSER_BIN="$(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  BROWSER_BIN="$(command -v chromium-browser)"
elif command -v microsoft-edge >/dev/null 2>&1; then
  BROWSER_BIN="$(command -v microsoft-edge)"
else
  echo "No se encontro Chromium/Chrome/Edge en el servidor."
  exit 1
fi

echo "Usando navegador: $BROWSER_BIN"
echo "Proyecto: $PROJECT_DIR"
echo "Modo navegador embebido: $APP_MODE"

git pull
npm ci
npm run build

pm2 delete usuarios || true
pm2 delete usuarios-browser-engine || true
pm2 delete usuarios-browser-streaming-engine || true

pm2 start "VITE_EMBEDDED_BROWSER_MODE=$APP_MODE npm run dev" \
  --name usuarios \
  --update-env

pm2 start "BROWSER_ENGINE_EXECUTABLE_PATH=$BROWSER_BIN BROWSER_ENGINE_PORT=$BROWSER_PORT npm run dev:browser-engine" \
  --name usuarios-browser-engine \
  --update-env

pm2 start "BROWSER_ENGINE_EXECUTABLE_PATH=$BROWSER_BIN BROWSER_STREAMING_ENGINE_PORT=$STREAMING_PORT npm run dev:browser-streaming-engine" \
  --name usuarios-browser-streaming-engine \
  --update-env

pm2 save
pm2 status

echo
echo "Logs utiles:"
echo "  pm2 logs usuarios --lines 100"
echo "  pm2 logs usuarios-browser-engine --lines 100"
echo "  pm2 logs usuarios-browser-streaming-engine --lines 100"
