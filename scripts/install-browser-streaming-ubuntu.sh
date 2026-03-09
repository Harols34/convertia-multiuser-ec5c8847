#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Este script debe ejecutarse como root o con sudo."
  exit 1
fi

echo "[1/5] Actualizando paquetes base..."
apt update
apt install -y wget ca-certificates gnupg curl software-properties-common

echo "[2/5] Instalando dependencias del navegador remoto..."
apt install -y \
  xvfb \
  fluxbox \
  x11vnc \
  websockify \
  novnc \
  dbus-x11 \
  x11-xserver-utils

echo "[3/5] Instalando Google Chrome si no existe..."
if ! command -v google-chrome >/dev/null 2>&1; then
  wget -O /tmp/google-chrome.deb \
    https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  apt install -y /tmp/google-chrome.deb
else
  echo "Google Chrome ya esta instalado: $(command -v google-chrome)"
fi

echo "[4/5] Verificando binarios requeridos..."
for cmd in Xvfb x11vnc websockify; do
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "OK  $cmd -> $(command -v "$cmd")"
  else
    echo "ERROR: no se encontro $cmd"
    exit 1
  fi
done

if command -v fluxbox >/dev/null 2>&1; then
  echo "OK  fluxbox -> $(command -v fluxbox)"
else
  echo "WARN: fluxbox no esta instalado. Se puede seguir, pero no es lo ideal."
fi

if command -v google-chrome >/dev/null 2>&1; then
  echo "OK  google-chrome -> $(command -v google-chrome)"
  google-chrome --version || true
elif command -v chromium >/dev/null 2>&1; then
  echo "OK  chromium -> $(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  echo "OK  chromium-browser -> $(command -v chromium-browser)"
else
  echo "ERROR: no se encontro ningun navegador Chromium compatible."
  exit 1
fi

if [ -f /usr/share/novnc/vnc.html ]; then
  echo "OK  noVNC -> /usr/share/novnc"
else
  echo "ERROR: no se encontro /usr/share/novnc/vnc.html"
  exit 1
fi

echo "[5/5] Instalacion completada."
echo "Ahora puedes ejecutar el script de despliegue con PM2."
