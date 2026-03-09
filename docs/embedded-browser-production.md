# Navegador Embebido en Produccion

Esta guia documenta como desplegar el navegador embebido remoto en Ubuntu por SSH.

## Lo que necesitas levantar

Hay tres procesos recomendados:

- `usuarios`: frontend
- `usuarios-browser-engine`: motor actual por snapshots, usado como fallback
- `usuarios-browser-streaming-engine`: motor nuevo de streaming remoto

## Archivos utiles del repo

- `scripts/install-browser-streaming-ubuntu.sh`
- `scripts/deploy-browser-streaming-ubuntu.sh`
- `ecosystem.browser-streaming.config.cjs`
- `docs/embedded-browser-streaming-plan.md`

## Requisitos del servidor

- Ubuntu con `sudo`
- Git
- Node.js
- npm
- PM2

Recomendado:

- Node.js `20+`

## Si ya estas dentro del servidor

Si estas parado en:

```text
root@seikajudev:/home/devai/usuarios/convertia-multiuser-ec5c8847#
```

puedes ejecutar todos los comandos desde ahi mismo.

## Instalacion de dependencias Linux

Desde el root del proyecto:

```bash
chmod +x scripts/install-browser-streaming-ubuntu.sh
bash scripts/install-browser-streaming-ubuntu.sh
```

Ese script instala:

- `xvfb`
- `fluxbox`
- `x11vnc`
- `websockify`
- `novnc`
- `google-chrome` si no existe

## Verificacion manual

Despues puedes validar:

```bash
which google-chrome
which Xvfb
which x11vnc
which websockify
ls /usr/share/novnc/vnc.html
```

## Despliegue recomendado con script

Desde el root del proyecto:

```bash
chmod +x scripts/deploy-browser-streaming-ubuntu.sh
bash scripts/deploy-browser-streaming-ubuntu.sh
```

Ese script hace:

- `git pull`
- `npm ci`
- `npm run build`
- elimina procesos PM2 viejos
- levanta los tres procesos necesarios
- guarda PM2

## Variables del script de despliegue

Puedes sobreescribir valores asi:

```bash
APP_MODE=streaming PROJECT_DIR=/home/devai/usuarios/convertia-multiuser-ec5c8847 bash scripts/deploy-browser-streaming-ubuntu.sh
```

Valores soportados:

- `APP_MODE=hybrid`
- `APP_MODE=streaming`
- `APP_MODE=snapshots`
- `PROJECT_DIR=/ruta/al/proyecto`
- `BROWSER_ENGINE_PORT=8787`
- `BROWSER_STREAMING_ENGINE_PORT=8790`

## Despliegue con PM2 ecosystem

Tambien puedes usar:

```bash
pm2 delete usuarios || true
pm2 delete usuarios-browser-engine || true
pm2 delete usuarios-browser-streaming-engine || true
pm2 start ecosystem.browser-streaming.config.cjs
pm2 save
pm2 status
```

Si usas esta opcion y tu Chrome no esta en `/usr/bin/google-chrome`, edita antes:

- `ecosystem.browser-streaming.config.cjs`

## Logs utiles

```bash
pm2 logs usuarios --lines 100
pm2 logs usuarios-browser-engine --lines 100
pm2 logs usuarios-browser-streaming-engine --lines 100
```

## Problemas comunes

### 1. No se encontro Chromium/Chrome/Edge

Verifica:

```bash
which google-chrome
google-chrome --version
```

Si no existe, vuelve a correr:

```bash
bash scripts/install-browser-streaming-ubuntu.sh
```

### 2. El motor streaming no inicia

Verifica:

```bash
pm2 logs usuarios-browser-streaming-engine --lines 100
curl http://127.0.0.1:8790/api/browser-streaming/health
```

### 3. Faltan dependencias como `x11vnc` o `websockify`

Verifica:

```bash
which Xvfb
which x11vnc
which websockify
ls /usr/share/novnc/vnc.html
```

## Recomendacion operativa

Para una transicion segura usa:

```bash
APP_MODE=hybrid
```

Asi el sistema intenta usar streaming y, si no esta disponible, cae al modo compatible actual.

## Nota importante

Hoy la app web sigue corriendo con `npm run dev` por la forma en que esta montado el proyecto.

Eso puede funcionar temporalmente, pero para produccion robusta despues conviene:

- servir `dist/` con un servidor dedicado
- dejar los motores remotos como procesos aparte
- mover configuracion a un `ecosystem` final o `systemd`
