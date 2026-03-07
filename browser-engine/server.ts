import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import process from "node:process";
import dotenv from "dotenv";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
  type Route,
} from "playwright-core";

dotenv.config();

const ENGINE_PORT = Number(process.env.BROWSER_ENGINE_PORT || 8787);
const VIEWPORT = { width: 1280, height: 800 };
const SESSION_TTL_MS = 30 * 60 * 1000;
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://kmnwfjbiqnqsfnmmgxqd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttbndmamJpcW5xc2ZubW1neHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5OTc1NTUsImV4cCI6MjA3OTU3MzU1NX0.uUQ80BFTahJHwyQwa9UesH_pODuG_QZZMbC4aqhE2-o";

type BrowserConfigPolicy = {
  id: string;
  company_id: string;
  name: string;
  enabled: boolean;
  allowed_domains: string[];
  allowed_url_prefixes: string[];
  blocked_url_patterns: string[];
  allow_new_tabs: boolean;
  allow_downloads: boolean;
  allow_popups: boolean;
  allow_http: boolean;
};

type UrlCheckResult = { ok: boolean; why: string; host?: string };

type BrowserTabState = {
  id: string;
  page: Page;
  title: string;
  url: string;
  status: "idle" | "loading" | "loaded" | "blocked" | "error";
  reason: string | null;
  history: string[];
  historyIndex: number;
  navigationRunId: number;
};

type BrowserSessionState = {
  id: string;
  companyId: string;
  userId: string;
  browserConfigId: string;
  policy: BrowserConfigPolicy;
  context: BrowserContext;
  tabs: Map<string, BrowserTabState>;
  tabOrder: string[];
  activeTabId: string | null;
  lastTouchedAt: number;
};

const sessions = new Map<string, BrowserSessionState>();
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let sharedBrowserPromise: Promise<Browser> | null = null;

function touchSession(session: BrowserSessionState) {
  session.lastTouchedAt = Date.now();
}

function parseHeaderList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function hasBlockedPattern(url: string, blocked: string[]): boolean {
  return blocked.some((pattern) => pattern && url.includes(pattern));
}

function isAllowedTopLevel(
  url: string,
  domains: string[],
  prefixes: string[],
  blocked: string[],
  httpOk: boolean
): UrlCheckResult {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (["javascript:", "data:", "file:", "blob:", "vbscript:"].includes(parsed.protocol)) {
      return { ok: false, why: "protocol" };
    }
    if (parsed.protocol === "http:" && !httpOk) {
      return { ok: false, why: "http" };
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { ok: false, why: "protocol" };
    }
    if (hasBlockedPattern(url, blocked)) {
      return { ok: false, why: "blocked", host };
    }
    for (const prefix of prefixes) {
      if (prefix && url.startsWith(prefix)) {
        return { ok: true, why: "ok" };
      }
    }
    for (const domain of domains) {
      const normalizedDomain = domain.toLowerCase().trim();
      if (!normalizedDomain) continue;
      if (host === normalizedDomain || host.endsWith(`.${normalizedDomain}`)) {
        return { ok: true, why: "ok" };
      }
    }
    return { ok: false, why: "domain", host };
  } catch {
    return { ok: false, why: "invalid" };
  }
}

function getKnownExecutables(): string[] {
  return [
    process.env.BROWSER_ENGINE_EXECUTABLE_PATH || "",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean);
}

function resolveChromiumExecutable(): string {
  for (const candidate of getKnownExecutables()) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    "No se encontro Chromium/Chrome/Edge. Configura BROWSER_ENGINE_EXECUTABLE_PATH o instala Microsoft Edge/Chrome."
  );
}

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    const executablePath = resolveChromiumExecutable();
    sharedBrowserPromise = chromium.launch({
      executablePath,
      headless: true,
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });
  }

  return sharedBrowserPromise;
}

async function loadPolicy(
  browserConfigId: string,
  companyId: string
): Promise<BrowserConfigPolicy> {
  const { data, error } = await supabase
    .from("browser_configs")
    .select("*")
    .eq("id", browserConfigId)
    .eq("company_id", companyId)
    .eq("enabled", true)
    .single();

  if (error || !data) {
    throw new Error("No se encontro una configuracion activa de navegador para esta empresa.");
  }

  return {
    ...data,
    allowed_domains: data.allowed_domains || [],
    allowed_url_prefixes: data.allowed_url_prefixes || [],
    blocked_url_patterns: data.blocked_url_patterns || [],
  } as BrowserConfigPolicy;
}

async function auditNavigation(
  session: BrowserSessionState,
  action: string,
  url: string | null,
  reason: string | null
) {
  await supabase.from("browser_audit_logs").insert({
    company_id: session.companyId,
    user_id: session.userId,
    browser_config_id: session.browserConfigId,
    action,
    url,
    reason,
  });
}

function getTab(session: BrowserSessionState, tabId: string): BrowserTabState {
  const tab = session.tabs.get(tabId);
  if (!tab) {
    throw new Error("La pestaña solicitada no existe.");
  }
  return tab;
}

function getSession(sessionId: string): BrowserSessionState {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error("La sesion del navegador ya no existe.");
  }
  touchSession(session);
  return session;
}

function setTabNavigation(tab: BrowserTabState, url: string) {
  if (!url) return;

  if (tab.history[tab.historyIndex - 1] === url) {
    tab.historyIndex -= 1;
  } else if (tab.history[tab.historyIndex + 1] === url) {
    tab.historyIndex += 1;
  } else if (tab.history[tab.historyIndex] !== url) {
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(url);
    tab.historyIndex = tab.history.length - 1;
  }

  tab.url = url;
}

function beginTabLoading(tab: BrowserTabState, nextUrl?: string) {
  tab.navigationRunId += 1;
  tab.status = "loading";
  tab.reason = null;
  if (nextUrl) {
    setTabNavigation(tab, nextUrl);
  }
  return tab.navigationRunId;
}

function isLatestNavigation(tab: BrowserTabState, navigationRunId: number) {
  return tab.navigationRunId === navigationRunId;
}

async function syncTabState(tab: BrowserTabState) {
  try {
    tab.title = (await tab.page.title()) || tab.title || "Nueva pestaña";
  } catch {
    tab.title = tab.title || "Nueva pestaña";
  }

  try {
    const currentUrl = tab.page.url();
    if (currentUrl) setTabNavigation(tab, currentUrl);
  } catch {
    // Ignore.
  }
}

function serializeSession(session: BrowserSessionState) {
  const toDisplayUrl = (url: string) => (url === "about:blank" ? "" : url);

  return {
    id: session.id,
    activeTabId: session.activeTabId,
    browserConfigId: session.browserConfigId,
    tabs: session.tabOrder
      .map((tabId) => session.tabs.get(tabId))
      .filter((tab): tab is BrowserTabState => Boolean(tab))
      .map((tab) => ({
        id: tab.id,
        title: tab.title || "Nueva pestaña",
        url: toDisplayUrl(tab.url),
        status: tab.status,
        reason: tab.reason,
        canGoBack: tab.historyIndex > 0,
        canGoForward: tab.historyIndex >= 0 && tab.historyIndex < tab.history.length - 1,
        isActive: session.activeTabId === tab.id,
      })),
  };
}

function findTabByPage(session: BrowserSessionState, page: Page): BrowserTabState | null {
  for (const tab of session.tabs.values()) {
    if (tab.page === page) return tab;
  }
  return null;
}

async function attachPageToSession(
  session: BrowserSessionState,
  page: Page,
  options?: { tabId?: string; activate?: boolean }
): Promise<BrowserTabState> {
  const tabId = options?.tabId || randomUUID();
  const tab: BrowserTabState = {
    id: tabId,
    page,
    title: "Nueva pestaña",
    url: "",
    status: "idle",
    reason: null,
    history: [],
    historyIndex: -1,
    navigationRunId: 0,
  };

  session.tabs.set(tabId, tab);
  session.tabOrder.push(tabId);
  if (options?.activate !== false) {
    session.activeTabId = tabId;
  }

  page.on("popup", async (popup) => {
    if (!session.policy.allow_popups) {
      await popup.close().catch(() => undefined);
      return;
    }

    await attachPageToSession(session, popup, { activate: true });
  });

  page.on("dialog", async (dialog) => {
    await dialog.dismiss().catch(() => undefined);
  });

  page.on("framenavigated", async (frame) => {
    if (frame !== page.mainFrame()) return;

    const nextUrl = frame.url();
    const check = isAllowedTopLevel(
      nextUrl,
      session.policy.allowed_domains,
      session.policy.allowed_url_prefixes,
      session.policy.blocked_url_patterns,
      session.policy.allow_http
    );

    if (!check.ok && nextUrl && !nextUrl.startsWith("about:")) {
      tab.status = "blocked";
      tab.reason = check.why;
      await auditNavigation(session, "NAVIGATE_BLOCKED", nextUrl, check.why);
      return;
    }

    tab.status = "loaded";
    tab.reason = null;
    setTabNavigation(tab, nextUrl);
    await syncTabState(tab);
  });

  page.on("domcontentloaded", async () => {
    if (tab.status === "loading") {
      tab.status = "loaded";
      tab.reason = null;
    }
    await syncTabState(tab);
  });

  page.on("load", async () => {
    if (tab.status === "loading") {
      tab.status = "loaded";
    }
    await syncTabState(tab);
  });

  page.on("close", () => {
    session.tabs.delete(tabId);
    session.tabOrder = session.tabOrder.filter((value) => value !== tabId);
    if (session.activeTabId === tabId) {
      session.activeTabId = session.tabOrder.at(-1) || null;
    }
  });

  await page.setViewportSize(VIEWPORT);
  await page.setContent(
    "<html><body style=\"font-family:system-ui;background:#fafafa;color:#333;display:flex;align-items:center;justify-content:center;height:100vh;margin:0\"><div style=\"text-align:center\"><h2>Navegador listo</h2><p>Ingresa una URL permitida para comenzar.</p></div></body></html>"
  );
  await syncTabState(tab);

  return tab;
}

async function installContextGuards(session: BrowserSessionState) {
  await session.context.route("**/*", async (route: Route) => {
    const request = route.request();
    const url = request.url();
    const resourceType = request.resourceType();

    if (/^(javascript|data|file|vbscript):/i.test(url)) {
      await route.abort("blockedbyclient").catch(() => undefined);
      return;
    }

    if (["font", "media", "texttrack", "manifest"].includes(resourceType)) {
      await route.abort("blockedbyclient").catch(() => undefined);
      return;
    }

    if (
      /doubleclick|googletagmanager|google-analytics|analytics|\/gen_204|\/log\?|bat\.bing|hotjar|clarity/i.test(
        url
      )
    ) {
      await route.abort("blockedbyclient").catch(() => undefined);
      return;
    }

    if (request.isNavigationRequest()) {
      const page = request.frame().page();
      const tab = findTabByPage(session, page);
      if (tab && request.frame() === page.mainFrame()) {
        const check = isAllowedTopLevel(
          url,
          session.policy.allowed_domains,
          session.policy.allowed_url_prefixes,
          session.policy.blocked_url_patterns,
          session.policy.allow_http
        );

        if (!check.ok) {
          tab.status = "blocked";
          tab.reason = check.why;
          await auditNavigation(session, "NAVIGATE_BLOCKED", url, check.why);
          await route.abort("blockedbyclient").catch(() => undefined);
          return;
        }
      }
    }

    await route.continue().catch(() => undefined);
  });
}

async function createSession(params: {
  companyId: string;
  userId: string;
  browserConfigId: string;
}) {
  const browser = await getBrowser();
  const policy = await loadPolicy(params.browserConfigId, params.companyId);
  const context = await browser.newContext({
    viewport: VIEWPORT,
    acceptDownloads: policy.allow_downloads,
    ignoreHTTPSErrors: true,
    serviceWorkers: "block",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  });

  const session: BrowserSessionState = {
    id: randomUUID(),
    companyId: params.companyId,
    userId: params.userId,
    browserConfigId: params.browserConfigId,
    policy,
    context,
    tabs: new Map(),
    tabOrder: [],
    activeTabId: null,
    lastTouchedAt: Date.now(),
  };

  await installContextGuards(session);
  const page = await context.newPage();
  await attachPageToSession(session, page, { activate: true });
  sessions.set(session.id, session);

  return session;
}

async function destroySession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  await session.context.close().catch(() => undefined);
}

async function navigateTab(session: BrowserSessionState, tab: BrowserTabState, rawUrl: string) {
  const normalizedUrl = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
    ? rawUrl
    : `https://${rawUrl}`;

  const check = isAllowedTopLevel(
    normalizedUrl,
    session.policy.allowed_domains,
    session.policy.allowed_url_prefixes,
    session.policy.blocked_url_patterns,
    session.policy.allow_http
  );

  if (!check.ok) {
    tab.status = "blocked";
    tab.reason = check.why;
    await auditNavigation(session, "NAVIGATE_BLOCKED", normalizedUrl, check.why);
    return;
  }

  const navigationRunId = beginTabLoading(tab, normalizedUrl);
  await auditNavigation(session, "NAVIGATE_ALLOWED", normalizedUrl, "manual");

  void (async () => {
    try {
      await tab.page.goto(normalizedUrl, {
        waitUntil: "commit",
        timeout: 12000,
      });
      await tab.page.waitForLoadState("domcontentloaded", { timeout: 6000 }).catch(() => undefined);
      await syncTabState(tab);
      if (isLatestNavigation(tab, navigationRunId) && tab.status === "loading") {
        tab.status = "loaded";
        tab.reason = null;
      }
    } catch (error) {
      if (isLatestNavigation(tab, navigationRunId)) {
        tab.status = "error";
        tab.reason =
          error instanceof Error ? error.message : "No se pudo cargar la pagina";
      }
    }
  })();
}

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Headers", parseHeaderList(req.headers["access-control-request-headers"] as string | null).join(", ") || "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.get("/api/browser-engine/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/browser-engine/sessions", async (req, res) => {
  try {
    const session = await createSession(req.body);
    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo crear la sesion" });
  }
});

app.get("/api/browser-engine/sessions/:sessionId", (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Sesion no encontrada" });
  }
});

app.delete("/api/browser-engine/sessions/:sessionId", async (req, res) => {
  await destroySession(req.params.sessionId);
  res.status(204).end();
});

app.post("/api/browser-engine/sessions/:sessionId/activate", (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    const tab = getTab(session, req.body.tabId);
    session.activeTabId = tab.id;
    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "No se pudo activar la pestaña" });
  }
});

app.post("/api/browser-engine/sessions/:sessionId/tabs", async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    if (!session.policy.allow_new_tabs) {
      res.status(403).json({ error: "No tienes permiso para abrir nuevas pestañas." });
      return;
    }

    const page = await session.context.newPage();
    await attachPageToSession(session, page, { activate: true });
    if (req.body?.url) {
      await navigateTab(session, getTab(session, session.activeTabId!), req.body.url);
    }
    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo crear la pestaña" });
  }
});

app.delete("/api/browser-engine/sessions/:sessionId/tabs/:tabId", async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    const tab = getTab(session, req.params.tabId);
    await tab.page.close().catch(() => undefined);

    if (session.tabOrder.length === 0) {
      const page = await session.context.newPage();
      await attachPageToSession(session, page, { activate: true });
    }

    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo cerrar la pestaña" });
  }
});

app.post("/api/browser-engine/sessions/:sessionId/tabs/:tabId/navigate", async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    const tab = getTab(session, req.params.tabId);
    session.activeTabId = tab.id;
    await navigateTab(session, tab, String(req.body.url || ""));
    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo navegar" });
  }
});

app.post("/api/browser-engine/sessions/:sessionId/tabs/:tabId/back", async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    const tab = getTab(session, req.params.tabId);
    tab.status = "loading";
    await tab.page.goBack({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
    await syncTabState(tab);
    tab.status = "loaded";
    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo volver atras" });
  }
});

app.post("/api/browser-engine/sessions/:sessionId/tabs/:tabId/forward", async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    const tab = getTab(session, req.params.tabId);
    tab.status = "loading";
    await tab.page.goForward({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
    await syncTabState(tab);
    tab.status = "loaded";
    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo avanzar" });
  }
});

app.post("/api/browser-engine/sessions/:sessionId/tabs/:tabId/reload", async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    const tab = getTab(session, req.params.tabId);
    tab.status = "loading";
    await tab.page.reload({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => undefined);
    await syncTabState(tab);
    tab.status = "loaded";
    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo recargar" });
  }
});

app.post("/api/browser-engine/sessions/:sessionId/tabs/:tabId/click", async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    const tab = getTab(session, req.params.tabId);
    const xRatio = Math.max(0, Math.min(1, Number(req.body.xRatio || 0)));
    const yRatio = Math.max(0, Math.min(1, Number(req.body.yRatio || 0)));

    await tab.page.mouse.click(
      Math.round(xRatio * VIEWPORT.width),
      Math.round(yRatio * VIEWPORT.height)
    );
    await tab.page.waitForLoadState("domcontentloaded", { timeout: 1500 }).catch(() => undefined);
    await syncTabState(tab);
    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo hacer clic" });
  }
});

app.post("/api/browser-engine/sessions/:sessionId/tabs/:tabId/scroll", async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    const tab = getTab(session, req.params.tabId);
    const deltaY = Number(req.body.deltaY || 0);
    await tab.page.mouse.wheel(0, deltaY);
    await syncTabState(tab);
    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo hacer scroll" });
  }
});

app.post("/api/browser-engine/sessions/:sessionId/tabs/:tabId/type", async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    const tab = getTab(session, req.params.tabId);
    const text = String(req.body.text || "");
    if (text) {
      await tab.page.keyboard.type(text);
    }
    await syncTabState(tab);
    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo escribir" });
  }
});

app.post("/api/browser-engine/sessions/:sessionId/tabs/:tabId/press", async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    const tab = getTab(session, req.params.tabId);
    const key = String(req.body.key || "");
    if (key) {
      await tab.page.keyboard.press(key);
      await tab.page.waitForLoadState("domcontentloaded", { timeout: 1500 }).catch(() => undefined);
    }
    await syncTabState(tab);
    res.json({ session: serializeSession(session) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo enviar la tecla" });
  }
});

app.get("/api/browser-engine/sessions/:sessionId/tabs/:tabId/snapshot", async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    const tab = getTab(session, req.params.tabId);
    const format = req.query.format === "png" ? "png" : "jpeg";
    const requestedQuality = Number(req.query.quality || 65);
    const quality = Number.isFinite(requestedQuality)
      ? Math.min(90, Math.max(35, requestedQuality))
      : 65;
    const buffer = await tab.page.screenshot(
      format === "png"
        ? { type: "png" }
        : {
            type: "jpeg",
            quality,
          }
    );
    res.setHeader("Content-Type", format === "png" ? "image/png" : "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    res.end(buffer);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo generar la vista" });
  }
});

setInterval(async () => {
  const now = Date.now();
  const staleSessions = Array.from(sessions.values())
    .filter((session) => now - session.lastTouchedAt > SESSION_TTL_MS)
    .map((session) => session.id);

  await Promise.all(staleSessions.map((sessionId) => destroySession(sessionId)));
}, 60_000);

app.listen(ENGINE_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Browser engine escuchando en http://127.0.0.1:${ENGINE_PORT}`);
});
