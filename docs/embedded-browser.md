# Navegador Embebido Remoto


- El frontend muestra una vista remota por snapshots.
- Cada usuario obtiene una sesion con tabs reales del navegador.
- La politica de sitios permitidos se aplica desde `browser_configs`.
- Los intentos bloqueados se registran en `browser_audit_logs`.

## Como ejecutar

En desarrollo:

```bash
npm run dev:all
```

Si prefieres separarlo:

```bash
npm run dev:web
npm run dev:browser-engine
```

## Produccion

Guia paso a paso para servidor Ubuntu por SSH:

`docs/embedded-browser-production.md`

## Requisitos del motor remoto

El backend `browser-engine/server.ts` usa `playwright-core` y necesita un navegador Chromium ya instalado.
Por defecto intenta encontrar:

- Microsoft Edge
- Google Chrome

Si tu navegador no esta en una ruta estandar, define:

```bash
BROWSER_ENGINE_EXECUTABLE_PATH="ruta-al-ejecutable"
```

## Flujo tecnico

1. `UserPortal` monta `EmbeddedBrowser`.
2. `EmbeddedBrowser` crea una sesion remota contra `/api/browser-engine/sessions`.
3. El motor remoto abre un contexto aislado de Playwright.
4. La UI navega, hace click, scroll y escribe enviando comandos HTTP.
5. La vista se actualiza con snapshots PNG de la pestaña activa.

## Alcance esperado

Esta implementacion esta pensada para:

- portales internos o controlados
- formularios
- paginas relativamente estables
- flujos con allowlist estricta por empresa

## Limites operativos

Aunque esta arquitectura es mucho mas robusta que el proxy HTML anterior, sigue teniendo limites:

- No es un reemplazo completo de un navegador interactivo por streaming de video.
- La vista se actualiza por snapshots, no por canvas en tiempo real.
- Sitios con protecciones avanzadas anti-bot, DRM o flujos de media complejos pueden requerir una capa adicional.
- Para una experiencia tipo navegador comercial completo, el siguiente paso seria streaming de frame + eventos en tiempo real.

## Archivos clave

- `browser-engine/server.ts`
- `src/lib/browser-engine-client.ts`
- `src/components/EmbeddedBrowser.tsx`
- `vite.config.ts`
