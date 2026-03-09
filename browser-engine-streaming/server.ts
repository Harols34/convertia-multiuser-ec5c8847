import { randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import http, { type IncomingMessage } from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import express from "express";
import type { Application } from "express";
import { createClient } from "@supabase/supabase-js";
import type {
  CreateRemoteBrowserSessionInput,
  RemoteBrowserDependencyStatus,
  RemoteBrowserHealthResponse,
  RemoteBrowserSessionResponse,
  RemoteBrowserStreamingSession,
} from "./contracts";

dotenv.config();

const STREAMING_ENGINE_PORT = Number(process.env.BROWSER_STREAMING_ENGINE_PORT || 8790);
const SESSION_TTL_MS = 30 * 60 * 1000;
const STREAMING_TMP_ROOT =
  process.env.BROWSER_STREAMING_TMP_ROOT || path.join(process.cwd(), ".browser-streaming");
const NOVNC_DIR_CANDIDATES = [
  process.env.BROWSER_STREAMING_NOVNC_DIR || "",
  "/usr/share/novnc",
  "/usr/share/novnc/utils/novnc_proxy",
].filter(Boolean);
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

type SessionRuntime = {
  sessionId: string;
  display: number;
  vncPort: number;
  wsPort: number;
  userDataDir: string;
  processes: ChildProcess[];
  lastTouchedAt: number;
};

const sessions = new Map<string, RemoteBrowserStreamingSession>();
const runtimes = new Map<string, SessionRuntime>();
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function nowIso() {
  return new Date().toISOString();
}

function touchSession(sessionId: string) {
  const runtime = runtimes.get(sessionId);
  if (runtime) {
    runtime.lastTouchedAt = Date.now();
  }
}

function updateSession(
  sessionId: string,
  updater: (session: RemoteBrowserStreamingSession) => RemoteBrowserStreamingSession
) {
  const current = sessions.get(sessionId);
  if (!current) return;

  const next = updater({
    ...current,
    updatedAt: nowIso(),
  });
  sessions.set(sessionId, next);
}

function resolveCommand(command: string) {
  const whichCommand = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(whichCommand, [command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) {
    return null;
  }

  const firstLine = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine || null;
}

function resolveNoVncDir() {
  return NOVNC_DIR_CANDIDATES.find((candidate) => existsSync(path.join(candidate, "vnc.html"))) || null;
}

function resolveBrowserExecutable() {
  const explicitPath = process.env.BROWSER_ENGINE_EXECUTABLE_PATH || "";
  if (explicitPath && existsSync(explicitPath)) {
    return explicitPath;
  }

  return (
    resolveCommand("google-chrome") ||
    resolveCommand("chromium") ||
    resolveCommand("chromium-browser") ||
    resolveCommand("microsoft-edge")
  );
}

function getDependencyStatus(): RemoteBrowserDependencyStatus[] {
  const browserPath = resolveBrowserExecutable();
  const noVncDir = resolveNoVncDir();

  return [
    {
      name: "Xvfb",
      command: "Xvfb",
      available: Boolean(resolveCommand("Xvfb")),
      resolvedPath: resolveCommand("Xvfb"),
      required: true,
    },
    {
      name: "x11vnc",
      command: "x11vnc",
      available: Boolean(resolveCommand("x11vnc")),
      resolvedPath: resolveCommand("x11vnc"),
      required: true,
    },
    {
      name: "websockify",
      command: "websockify",
      available: Boolean(resolveCommand("websockify")),
      resolvedPath: resolveCommand("websockify"),
      required: true,
    },
    {
      name: "fluxbox",
      command: "fluxbox",
      available: Boolean(resolveCommand("fluxbox")),
      resolvedPath: resolveCommand("fluxbox"),
      required: false,
    },
    {
      name: "Google Chrome / Chromium",
      command: "google-chrome|chromium|chromium-browser|microsoft-edge",
      available: Boolean(browserPath),
      resolvedPath: browserPath,
      required: true,
    },
    {
      name: "noVNC static files",
      command: "/usr/share/novnc",
      available: Boolean(noVncDir),
      resolvedPath: noVncDir,
      required: true,
    },
  ];
}

function isHealthReady(dependencies: RemoteBrowserDependencyStatus[]) {
  return dependencies.every((dependency) => !dependency.required || dependency.available);
}

function buildHealthResponse(): RemoteBrowserHealthResponse {
  const dependencies = getDependencyStatus();
  const ready = isHealthReady(dependencies);

  return {
    ok: true,
    mode: "streaming",
    ready,
    message: ready
      ? "Motor de streaming listo."
      : "Faltan dependencias del sistema para habilitar el navegador remoto fluido.",
    dependencies,
  };
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

async function auditStreamingAction(
  session: RemoteBrowserStreamingSession,
  action: string,
  reason: string | null
) {
  await supabase.from("browser_audit_logs").insert({
    company_id: session.companyId,
    user_id: session.userId,
    browser_config_id: session.browserConfigId,
    action,
    url: session.homeUrl,
    reason,
  });
}

function buildSessionHomeUrl(policy: BrowserConfigPolicy) {
  const firstPrefix = policy.allowed_url_prefixes.find(Boolean);
  if (firstPrefix) return firstPrefix;

  const firstDomain = policy.allowed_domains.find(Boolean);
  if (firstDomain) {
    const sanitized = firstDomain.replace(/^https?:\/\//, "");
    return `https://${sanitized}`;
  }

  return "about:blank";
}

function resolveRequestedHomeUrl(
  requestedHomeUrl: string | undefined,
  policy: BrowserConfigPolicy
) {
  if (!requestedHomeUrl?.trim()) {
    return buildSessionHomeUrl(policy);
  }

  const rawValue = requestedHomeUrl.trim();
  const normalizedUrl =
    rawValue.startsWith("http://") || rawValue.startsWith("https://")
      ? rawValue
      : `https://${rawValue}`;

  const check = isAllowedTopLevel(
    normalizedUrl,
    policy.allowed_domains,
    policy.allowed_url_prefixes,
    policy.blocked_url_patterns,
    policy.allow_http
  );

  if (!check.ok) {
    throw new Error("La URL solicitada no esta permitida por la configuracion de la empresa.");
  }

  return normalizedUrl;
}

function buildSessionStreamUrl(sessionId: string) {
  const wsPath = `api/browser-streaming/sessions/${sessionId}/websockify`;
  return `/novnc/vnc.html?autoconnect=1&resize=remote&show_dot=1&path=${wsPath}`;
}

function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("No se pudo reservar un puerto libre."));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function reserveDisplayNumber() {
  for (let display = 100; display < 300; display += 1) {
    if (!existsSync(`/tmp/.X11-unix/X${display}`) && !existsSync(`/tmp/.X${display}-lock`)) {
      return display;
    }
  }

  throw new Error("No se pudo reservar un display virtual libre para la sesion.");
}

function waitForTcpPort(port: number, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();

    const tryConnect = () => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`No se pudo abrir el puerto ${port} a tiempo.`));
          return;
        }
        setTimeout(tryConnect, 250);
      });
    };

    tryConnect();
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDisplayReady(display: number, timeoutMs: number) {
  const startedAt = Date.now();
  const displaySocket = `/tmp/.X11-unix/X${display}`;
  const xdpyinfoExecutable = resolveCommand("xdpyinfo");

  while (Date.now() - startedAt < timeoutMs) {
    if (existsSync(displaySocket)) {
      if (!xdpyinfoExecutable) {
        await sleep(750);
        return;
      }

      const probe = spawnSync(xdpyinfoExecutable, ["-display", `:${display}`], {
        encoding: "utf8",
        stdio: "ignore",
      });

      if (probe.status === 0) {
        await sleep(500);
        return;
      }
    }

    await sleep(250);
  }

  throw new Error(`Xvfb no estuvo listo a tiempo en el display :${display}.`);
}

function spawnManagedProcess(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
): ChildProcess {
  const child = spawn(command, args, {
    env,
    stdio: "ignore",
    detached: true,
  });
  child.unref();
  return child;
}

function stopManagedProcess(child: ChildProcess) {
  if (!child.pid) return;

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // Ignora errores al detener procesos ya cerrados.
    }
  }
}

async function destroyStreamingSession(sessionId: string, reason?: string) {
  const session = sessions.get(sessionId);
  const runtime = runtimes.get(sessionId);

  if (runtime) {
    runtime.processes.forEach((child) => stopManagedProcess(child));
    runtimes.delete(sessionId);
  }

  if (session) {
    updateSession(sessionId, (current) => ({
      ...current,
      status: "closed",
      error: reason || current.error,
    }));

    await auditStreamingAction(session, "STREAMING_SESSION_CLOSE", reason || null).catch(
      () => undefined
    );
  }
}

async function bootstrapStreamingSession(
  session: RemoteBrowserStreamingSession,
  policy: BrowserConfigPolicy
) {
  const health = buildHealthResponse();
  if (!health.ready) {
    throw new Error(
      "El servidor no tiene instaladas todas las dependencias para el navegador remoto fluido."
    );
  }

  const browserExecutable = resolveBrowserExecutable();
  const xvfbExecutable = resolveCommand("Xvfb");
  const fluxboxExecutable = resolveCommand("fluxbox");
  const x11vncExecutable = resolveCommand("x11vnc");
  const websockifyExecutable = resolveCommand("websockify");

  if (!browserExecutable || !xvfbExecutable || !x11vncExecutable || !websockifyExecutable) {
    throw new Error("No se pudieron resolver los binarios requeridos para el motor de streaming.");
  }

  mkdirSync(STREAMING_TMP_ROOT, { recursive: true });

  const display = reserveDisplayNumber();
  const vncPort = await reservePort();
  const wsPort = await reservePort();
  const userDataDir = path.join(STREAMING_TMP_ROOT, session.id);
  mkdirSync(userDataDir, { recursive: true });

  const displayEnv = {
    ...process.env,
    DISPLAY: `:${display}`,
  };

  const processes: ChildProcess[] = [];

  try {
    const xvfb = spawnManagedProcess(
      xvfbExecutable,
      [`:${display}`, "-screen", "0", "1440x900x24", "-ac"],
      process.env
    );
    processes.push(xvfb);

    await waitForDisplayReady(display, 15_000);

    if (fluxboxExecutable) {
      const fluxbox = spawnManagedProcess(fluxboxExecutable, [], displayEnv);
      processes.push(fluxbox);
    }

    const chromeArgs = [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=Translate,MediaRouter",
      "--disable-sync",
      "--password-store=basic",
      "--window-position=0,0",
      "--window-size=1440,900",
      "--disable-session-crashed-bubble",
      "--disable-infobars",
      `--user-data-dir=${userDataDir}`,
      session.homeUrl || "about:blank",
    ];

    const chrome = spawnManagedProcess(browserExecutable, chromeArgs, displayEnv);
    processes.push(chrome);

    const x11vnc = spawnManagedProcess(
      x11vncExecutable,
      [
        "-display",
        `:${display}`,
        "-forever",
        "-shared",
        "-nopw",
        "-localhost",
        "-rfbport",
        String(vncPort),
        "-quiet",
      ],
      displayEnv
    );
    processes.push(x11vnc);

    const websockify = spawnManagedProcess(
      websockifyExecutable,
      [String(wsPort), `127.0.0.1:${vncPort}`],
      process.env
    );
    processes.push(websockify);

    await waitForTcpPort(wsPort, 20_000);

    runtimes.set(session.id, {
      sessionId: session.id,
      display,
      vncPort,
      wsPort,
      userDataDir,
      processes,
      lastTouchedAt: Date.now(),
    });

    updateSession(session.id, (current) => {
      const url = current.homeUrl || "about:blank";
      let tabTitle = "Nueva pestaña";
      if (url && url !== "about:blank") {
        try {
          const parsed = new URL(url);
          tabTitle = parsed.hostname.replace(/^www\./, "") || tabTitle;
        } catch {
          /* ignora */
        }
      }
      return {
        ...current,
        status: "ready",
        streamUrl: buildSessionStreamUrl(current.id),
        controlUrl: null,
        tabs: [
          {
            id: "desktop",
            title: tabTitle,
            url,
            isActive: true,
          },
        ],
        activeTabId: "desktop",
        error: null,
        warnings: [],
      };
    });

    const nextSession = sessions.get(session.id);
    if (nextSession) {
      await auditStreamingAction(nextSession, "STREAMING_SESSION_READY", null).catch(
        () => undefined
      );
    }
  } catch (error) {
    processes.forEach((child) => stopManagedProcess(child));
    throw error;
  }
}

async function createStreamingSession(payload: CreateRemoteBrowserSessionInput) {
  const policy = await loadPolicy(payload.browserConfigId, payload.companyId);
  const timestamp = nowIso();
  const sessionId = randomUUID();

  const session: RemoteBrowserStreamingSession = {
    id: sessionId,
    browserConfigId: payload.browserConfigId,
    companyId: payload.companyId,
    userId: payload.userId,
    status: "provisioning",
    streamUrl: null,
    controlUrl: null,
    tabs: [],
    activeTabId: null,
    homeUrl: resolveRequestedHomeUrl(payload.homeUrl, policy),
    error: null,
    warnings: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  sessions.set(sessionId, session);
  await auditStreamingAction(session, "STREAMING_SESSION_OPEN", null).catch(() => undefined);

  void bootstrapStreamingSession(session, policy).catch(async (error) => {
    updateSession(sessionId, (current) => ({
      ...current,
      status: "error",
      error:
        error instanceof Error ? error.message : "No se pudo inicializar la sesion remota.",
    }));

    const failedSession = sessions.get(sessionId);
    if (failedSession) {
      await auditStreamingAction(
        failedSession,
        "STREAMING_SESSION_ERROR",
        failedSession.error
      ).catch(() => undefined);
    }
  });

  return session;
}

function getSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error("Sesion de streaming no encontrada.");
  }

  touchSession(sessionId);
  return session;
}

function buildRawUpgradeRequest(request: IncomingMessage) {
  const headerPairs: string[] = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const headerName = request.rawHeaders[index];
    const headerValue = request.rawHeaders[index + 1];
    headerPairs.push(`${headerName}: ${headerValue}`);
  }

  return `${request.method || "GET"} ${request.url || "/"} HTTP/${request.httpVersion}\r\n${headerPairs.join(
    "\r\n"
  )}\r\n\r\n`;
}

function handleUpgrade(
  request: IncomingMessage,
  socket: net.Socket,
  head: Buffer
) {
  const match = request.url?.match(/^\/api\/browser-streaming\/sessions\/([^/]+)\/websockify/);
  if (!match) {
    socket.destroy();
    return;
  }

  const sessionId = decodeURIComponent(match[1]);
  const runtime = runtimes.get(sessionId);
  if (!runtime) {
    socket.destroy();
    return;
  }

  touchSession(sessionId);

  const targetSocket = net.connect(runtime.wsPort, "127.0.0.1");
  targetSocket.once("connect", () => {
    targetSocket.write(buildRawUpgradeRequest(request));
    if (head.length > 0) {
      targetSocket.write(head);
    }
    socket.pipe(targetSocket);
    targetSocket.pipe(socket);
  });

  targetSocket.once("error", () => {
    socket.destroy();
  });
}

const app = express() as Application;
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

const noVncDir = resolveNoVncDir();
if (noVncDir) {
  app.use("/novnc", express.static(noVncDir));
} else {
  app.use("/novnc", (_req, res) => {
    res.status(503).send("noVNC no esta instalado en el servidor.");
  });
}

app.get("/api/browser-streaming/health", (_req, res) => {
  res.json(buildHealthResponse());
});

app.post("/api/browser-streaming/sessions", async (req, res) => {
  try {
    const body = req.body as Partial<CreateRemoteBrowserSessionInput>;

    if (!body.companyId || !body.userId || !body.browserConfigId) {
      res.status(400).json({
        error: "companyId, userId y browserConfigId son requeridos.",
      });
      return;
    }

    const session = await createStreamingSession(body as CreateRemoteBrowserSessionInput);
    const response: RemoteBrowserSessionResponse = { session };
    res.status(202).json(response);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "No se pudo crear la sesion de streaming.",
    });
  }
});

app.get("/api/browser-streaming/sessions/:sessionId", (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    res.json({ session });
  } catch (error) {
    res.status(404).json({
      error:
        error instanceof Error ? error.message : "Sesion de streaming no encontrada.",
    });
  }
});

app.delete("/api/browser-streaming/sessions/:sessionId", async (req, res) => {
  await destroyStreamingSession(req.params.sessionId);
  res.status(204).end();
});

const server = http.createServer(app);
server.on("upgrade", handleUpgrade);

server.listen(STREAMING_ENGINE_PORT, () => {
  console.log(
    `Browser streaming engine escuchando en http://127.0.0.1:${STREAMING_ENGINE_PORT}`
  );
});

setInterval(async () => {
  const now = Date.now();
  const expiredSessions = Array.from(runtimes.values())
    .filter((runtime) => now - runtime.lastTouchedAt > SESSION_TTL_MS)
    .map((runtime) => runtime.sessionId);

  await Promise.all(expiredSessions.map((sessionId) => destroyStreamingSession(sessionId)));
}, 60_000);

const shutdown = async () => {
  await Promise.all(Array.from(sessions.keys()).map((sessionId) => destroyStreamingSession(sessionId)));
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
