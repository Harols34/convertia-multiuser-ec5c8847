# Navegador Embebido en Produccion

Esta guia deja documentado como desplegar el navegador embebido remoto en el servidor de produccion por SSH.

## Resumen rapido

El navegador embebido necesita dos procesos:

- la aplicacion web
- el motor remoto `browser-engine`

Ademas, el servidor debe tener un navegador Chromium real instalado:

- Google Chrome
- Chromium
- Microsoft Edge

Si no existe uno de esos binarios, el motor muestra este error:

```text
No se encontro Chromium/Chrome/Edge. Configura BROWSER_ENGINE_EXECUTABLE_PATH o instala Microsoft Edge/Chrome.
```

## Requisitos

- Ubuntu con acceso `sudo`
- Node.js instalado
- `pm2` instalado globalmente
- Git configurado
- Acceso al repositorio en:

```text
/home/devai/usuarios/convertia-multiuser-ec5c8847
```

## Importante sobre Node

Actualmente el servidor esta usando Node `18.19.1`.

El proyecto hoy compila, pero varias dependencias de Supabase ya avisan que requieren Node `20+`.

Recomendacion:

- ideal: actualizar el servidor a Node 20 o superior
- temporal: puedes seguir usando Node 18 mientras no falle ninguna dependencia, pero no es lo ideal

## Donde ejecutar los comandos

Si ya estas dentro de:

```text
root@seikajudev:/home/devai/usuarios/convertia-multiuser-ec5c8847#
```

puedes ejecutar todos los comandos desde ahi mismo.

No necesitas abrir otra sesion ni cambiar de carpeta para instalar Chrome con `apt`.

Los comandos `apt`, `wget` y `pm2` no dependen de que estes fuera del repo.

## Instalar Google Chrome

Ejecuta esto como `root`:

```bash
apt update
apt install -y wget ca-certificates gnupg

wget -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt install -y /tmp/google-chrome.deb
```

Luego valida:

```bash
which google-chrome
google-chrome --version
```

La ruta normalmente sera:

```text
/usr/bin/google-chrome
```

## Despliegue manual

Desde:

```text
/home/devai/usuarios/convertia-multiuser-ec5c8847
```

ejecuta:

```bash
git pull
npm ci
npm run build
```

## Levantar con PM2

Primero elimina procesos anteriores:

```bash
pm2 delete usuarios || true
pm2 delete usuarios-browser-engine || true
```

Luego levanta la web:

```bash
pm2 start "npm run dev" --name usuarios
```

Y el motor remoto indicando la ruta del navegador:

```bash
pm2 start "BROWSER_ENGINE_EXECUTABLE_PATH=/usr/bin/google-chrome npm run dev:browser-engine" --name usuarios-browser-engine
```

Despues guarda el estado:

```bash
pm2 save
pm2 status
```

## Verificar que quedo bien

Revisa logs:

```bash
pm2 logs usuarios --lines 100
pm2 logs usuarios-browser-engine --lines 100
```

Si el motor quedo bien, deberias ver algo parecido a:

```text
Browser engine escuchando en http://127.0.0.1:8787
```

## Problemas comunes

### 1. No se encontro Chromium/Chrome/Edge

Causa:

- no esta instalado Chrome
- o `BROWSER_ENGINE_EXECUTABLE_PATH` no apunta al binario correcto

Solucion:

```bash
which google-chrome
pm2 delete usuarios-browser-engine || true
pm2 start "BROWSER_ENGINE_EXECUTABLE_PATH=/usr/bin/google-chrome npm run dev:browser-engine" --name usuarios-browser-engine
pm2 save
```

### 2. El frontend no conecta con `/api/browser-engine`

En logs suele verse algo como:

```text
connect ECONNREFUSED 127.0.0.1:8787
```

Causa:

- `usuarios-browser-engine` no esta corriendo

Solucion:

```bash
pm2 status
pm2 logs usuarios-browser-engine --lines 100
```

## Comando completo recomendado

Si ya instalaste Chrome, este bloque deja todo arriba:

```bash
cd /home/devai/usuarios/convertia-multiuser-ec5c8847
git pull
npm ci
npm run build
pm2 delete usuarios || true
pm2 delete usuarios-browser-engine || true
pm2 start "npm run dev" --name usuarios
pm2 start "BROWSER_ENGINE_EXECUTABLE_PATH=/usr/bin/google-chrome npm run dev:browser-engine" --name usuarios-browser-engine
pm2 save
pm2 status
```

## Nota operativa

Hoy la web se esta levantando con `npm run dev`, que usa Vite en modo desarrollo.

Eso puede servir temporalmente, pero para produccion real conviene separar:

- build estatico del frontend
- servidor web para `dist/`
- proceso aparte para `browser-engine`

Mientras mantengas el esquema actual, recuerda siempre levantar ambos procesos con PM2.

















revisar
Ejecuta esto ahora:

apt update
apt install -y wget ca-certificates gnupg
wget -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt install -y /tmp/google-chrome.deb
Luego verifica:

which google-chrome
google-chrome --version
Si responde algo como /usr/bin/google-chrome, entonces ya quedó bien.

Después vuelve a levantar el motor con esa ruta:

export BROWSER_ENGINE_EXECUTABLE_PATH=/usr/bin/google-chrome
pm2 restart usuarios-browser-engine --update-env
pm2 logs usuarios-browser-engine --lines 50
Si además quieres reiniciar ambos procesos para dejar todo limpio:

export BROWSER_ENGINE_EXECUTABLE_PATH=/usr/bin/google-chrome
pm2 restart usuarios --update-env
pm2 restart usuarios-browser-engine --update-env
pm2 save
pm2 status
Punto importante: Ese export solo vive en la sesión actual. Si reinicias el server o PM2, podrías perderlo. Lo ideal después es dejar la variable fija en PM2 o en un archivo de entorno.

Si quieres, cuando termines de instalar Chrome, me pegas la salida de:

which google-chrome
pm2 logs usuarios-browser-engine --lines 50
y te digo el siguiente comando exacto sin adivinar nada.








sudo su -
git pull
npm run build
apt update
apt install -y wget ca-certificates gnupg
wget -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt install -y /tmp/google-chrome.deb
which google-chrome
google-chrome --version

cd /home/devai/usuarios/convertia-multiuser-ec5c8847
pm2 delete usuarios-browser-engine || true
BROWSER_ENGINE_EXECUTABLE_PATH=/usr/bin/google-chrome pm2 start "npm run dev:browser-engine" --name usuarios-browser-engine --update-env
pm2 restart usuarios --update-env
pm2 save
pm2 logs usuarios-browser-engine --lines 50
