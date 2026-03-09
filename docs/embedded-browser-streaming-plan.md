# Plan de Migracion a Navegador Remoto Fluido

## Objetivo

Reemplazar el navegador embebido actual basado en snapshots por una arquitectura de sesion remota con streaming en tiempo real, para lograr:

- navegacion fluida
- cursor visible y foco real de escritura
- seleccion de texto confiable
- reproduccion de video
- reproduccion de audio
- menor latencia percibida

## Por que hay que migrar

La implementacion actual funciona por:

1. Playwright en el servidor
2. eventos HTTP para click, scroll, teclado
3. snapshots periodicos para renderizar la pagina

Ese enfoque sirve para:

- formularios
- portales internos
- sitios estables

Pero no puede ofrecer una experiencia tipo navegador real porque:

- no transmite frames en tiempo real
- no transmite audio
- no existe caret real del input en el frontend
- la seleccion de texto y el foco visual siempre llegan tarde
- video y animaciones se degradan mucho

## Arquitectura recomendada

### Opcion elegida

Usar una sesion grafica remota por usuario y transmitirla al frontend.

La propuesta recomendada para este proyecto es:

- backend de orquestacion en Node
- Chromium/Chrome real en Linux
- sesion grafica aislada por usuario
- streaming remoto al navegador del usuario
- politicas actuales de `browser_configs`
- auditoria actual en `browser_audit_logs`

### Variante mas realista para entregar rapido

Primera iteracion:

- `Xvfb` para display virtual
- `fluxbox` o entorno minimo
- `google-chrome` o `chromium`
- `x11vnc`
- `websockify`
- `noVNC`

Ventajas:

- experiencia mucho mejor que snapshots
- cursor real
- seleccion real
- soporte visual mucho mas natural
- permite una migracion incremental

Desventajas:

- no es tan fina como WebRTC puro
- puede consumir mas recursos por sesion

### Variante premium a mediano plazo

Segunda iteracion:

- stream de video por WebRTC
- canal de control por WebSocket
- audio bidireccional si aplica

Ventajas:

- menor latencia
- mejor uso de ancho de banda
- mejor experiencia para video y animacion

Desventajas:

- requiere mas trabajo de señalizacion y media pipeline

## Estado actual del proyecto

Hoy existen estos componentes:

- `browser-engine/server.ts`
- `src/lib/browser-engine-client.ts`
- `src/components/EmbeddedBrowser.tsx`

Todos dependen del modelo de snapshots.

## Nuevo objetivo tecnico

Crear una nueva capa paralela, sin romper la actual al inicio:

- `browser-engine-streaming/`
- `src/lib/browser-streaming-client.ts`
- posible `EmbeddedBrowserStreaming.tsx`

La migracion debe ser gradual.

## Fases de trabajo

### Fase 1. Orquestacion de sesiones

Crear un backend nuevo que:

- cree sesiones remotas
- reserve puertos por sesion
- valide politicas de acceso
- registre auditoria
- exponga metadata de conexion al frontend

Salida esperada:

- API de sesiones lista
- salud del servicio
- estructura de sesion estable

### Fase 2. Streaming base

Levantar por sesion:

- display virtual
- navegador
- servidor VNC
- proxy websocket para noVNC

Salida esperada:

- frontend mostrando una sesion remota navegable en tiempo real

### Fase 3. Integracion de politicas

Mantener desde backend:

- allowlist por `browser_configs`
- restricciones por dominio
- bloqueo de navegaciones prohibidas
- auditoria de eventos importantes

Salida esperada:

- mismo modelo de seguridad actual
- experiencia mucho mejor

### Fase 4. UX y controles

Agregar:

- barra de direccion
- tabs
- abrir/cerrar pestañas
- accesos rapidos
- overlays de carga
- reconexion de sesion

### Fase 5. Audio y video

Evaluar dos caminos:

- mantener noVNC solo para interaccion y aceptar limitaciones de audio
- o migrar sesiones multimedia a WebRTC

## Decision importante

Si el objetivo prioritario es:

- formularios y navegacion general: noVNC es suficiente para una primera entrega fuerte
- video/audio fluidos tipo navegador real: hay que planear WebRTC o una solucion multimedia equivalente

## Riesgos

- consumo de RAM por sesion
- consumo de CPU al abrir multiples navegadores
- manejo de puertos y limpieza de procesos
- seguridad del acceso a la sesion remota
- audio en Linux puede requerir configuracion adicional

## Requisitos de servidor

Para la version streaming se espera instalar, como minimo:

```bash
sudo apt update
sudo apt install -y xvfb fluxbox x11vnc websockify novnc
```

Y un navegador:

```bash
sudo apt install -y /tmp/google-chrome.deb
```

## Contrato inicial propuesto

El frontend no debe conocer detalles internos del streaming. Solo necesita:

- crear sesion
- consultar sesion
- cerrar sesion
- recibir `streamUrl`
- recibir `controlUrl`
- recibir estado de disponibilidad

## Estrategia de migracion

1. Mantener `EmbeddedBrowser` actual como fallback
2. Crear un nuevo modo `streaming`
3. Habilitarlo por feature flag o configuracion de empresa
4. Validar internamente con pocos usuarios
5. Migrar por etapas

## Entregables tecnicos de esta primera iteracion

- documento de arquitectura
- contratos tipados del nuevo servicio
- scaffolding del backend `browser-engine-streaming`
- cliente base para sesiones streaming

## Estado del repo

Ya existe una primera base tecnica en:

- `browser-engine-streaming/server.ts`
- `browser-engine-streaming/contracts.ts`
- `src/lib/browser-streaming-client.ts`
- `src/components/EmbeddedBrowserStreaming.tsx`
- `src/components/RemoteBrowser.tsx`

Y el frontend puede usar:

- `VITE_EMBEDDED_BROWSER_MODE=streaming`
- `VITE_EMBEDDED_BROWSER_MODE=hybrid`
- `VITE_EMBEDDED_BROWSER_MODE=snapshots`

Scripts utiles:

```bash
npm run dev:browser-streaming-engine
npm run dev:all:streaming
```

## Recomendacion final

No invertir mas esfuerzo grande en la version por snapshots si la meta es una UX tipo navegador real.

La inversion correcta es migrar a una sesion remota transmitida en tiempo real y usar el backend actual como base de seguridad, politicas y auditoria.
