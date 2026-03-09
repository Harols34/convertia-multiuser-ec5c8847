import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Loader2,
  Globe,
  AlertTriangle,
  RefreshCw,
  Plus,
  ExternalLink,
  ChevronDown,
  PanelsTopLeft,
  Sparkles,
} from "lucide-react";
import {
  browserStreamingClient,
  type RemoteBrowserHealthResponse,
  type RemoteBrowserStreamingSession,
} from "@/lib/browser-streaming-client";
import { cn } from "@/lib/utils";

interface BrowserConfig {
  id: string;
  name: string;
  enabled: boolean;
  allowed_domains?: string[];
  allowed_url_prefixes?: string[];
}

interface QuickAccessItem {
  id: string;
  label: string;
  url: string;
  description: string;
}

interface EmbeddedBrowserStreamingProps {
  companyId: string;
  userId: string;
  mode?: "streaming" | "hybrid";
  fallback?: ReactNode;
}

interface StreamingCacheEntry {
  sessionId: string;
  session: RemoteBrowserStreamingSession | null;
}

const streamingSessionCache = new Map<string, StreamingCacheEntry>();
const streamingSelectedConfigCache = new Map<string, string>();

function getCacheKey(companyId: string, userId: string) {
  return `${companyId}:${userId}`;
}

function getSessionCacheKey(companyId: string, userId: string, browserConfigId: string) {
  return `${companyId}:${userId}:${browserConfigId}`;
}

function normalizeDomain(domain: string) {
  return domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

function formatDomainLabel(value: string) {
  return value.replace(/^www\./, "");
}

function clampText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}…` : value;
}

function getCompactTabLabel(title: string, url: string | null) {
  if (url && url !== "about:blank") {
    try {
      const parsed = new URL(url);
      return clampText(formatDomainLabel(parsed.hostname), 18);
    } catch {
      /* ignora */
    }
  }
  return clampText(title || "Nueva pestaña", 16);
}

const KNOWN_PROBLEMATIC_DOMAINS = [
  "google.com",
  "googleapis.com",
  "youtube.com",
  "youtu.be",
  "facebook.com",
];

function isKnownProblematicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return KNOWN_PROBLEMATIC_DOMAINS.some(
    (d) => host === d || host.endsWith(`.${d}`)
  );
}

function isProblematicUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return isKnownProblematicHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function EmbeddedBrowserStreaming({
  companyId,
  userId,
  mode = "hybrid",
  fallback,
}: EmbeddedBrowserStreamingProps) {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<BrowserConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<BrowserConfig | null>(null);
  const [session, setSession] = useState<RemoteBrowserStreamingSession | null>(null);
  const [health, setHealth] = useState<RemoteBrowserHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootingSession, setBootingSession] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const sessionIdRef = useRef<string | null>(null);
  const browserCacheKey = useMemo(() => getCacheKey(companyId, userId), [companyId, userId]);

  const displayTabs = useMemo(() => {
    if (session?.tabs && session.tabs.length > 0) {
      return session.tabs;
    }
    const url = session?.homeUrl || "";
    return [
      {
        id: "desktop",
        title: url && url !== "about:blank" ? url : "Nueva pestaña",
        url: url || "about:blank",
        isActive: true,
      },
    ];
  }, [session?.tabs, session?.homeUrl]);

  const tabsCount = displayTabs.length;

  const quickAccessItems = useMemo<QuickAccessItem[]>(() => {
    if (!selectedConfig) return [];

    const items = new Map<string, QuickAccessItem>();

    (selectedConfig.allowed_domains || []).forEach((domain) => {
      const normalizedDomain = normalizeDomain(domain);
      if (!normalizedDomain) return;
      items.set(`https://${normalizedDomain}`, {
        id: `domain-${normalizedDomain}`,
        label: formatDomainLabel(normalizedDomain),
        url: `https://${normalizedDomain}`,
        description: "Sitio permitido",
      });
    });

    (selectedConfig.allowed_url_prefixes || []).forEach((prefix, index) => {
      try {
        const parsed = new URL(prefix);
        items.set(prefix, {
          id: `prefix-${index}`,
          label: `${formatDomainLabel(parsed.hostname)}${parsed.pathname !== "/" ? parsed.pathname : ""}`,
          url: prefix,
          description: "Ruta permitida",
        });
      } catch {
        // Ignora prefijos invalidos.
      }
    });

    return Array.from(items.values()).slice(0, 12);
  }, [selectedConfig]);

  const loadHealth = useCallback(async () => {
    const nextHealth = await browserStreamingClient.getHealth();
    setHealth(nextHealth);
    return nextHealth;
  }, []);

  const loadConfigs = useCallback(async () => {
    const { data, error } = await supabase
      .from("browser_configs")
      .select("id, name, enabled, allowed_domains, allowed_url_prefixes")
      .eq("company_id", companyId)
      .eq("enabled", true);

    if (error || !data || data.length === 0) {
      setConfigs([]);
      setSelectedConfig(null);
      return;
    }

    const mapped = data as BrowserConfig[];
    const cachedConfigId = streamingSelectedConfigCache.get(browserCacheKey);
    const cachedConfig = mapped.find((config) => config.id === cachedConfigId) || null;

    setConfigs(mapped);
    setSelectedConfig((current) => current || cachedConfig || mapped[0]);
  }, [browserCacheKey, companyId]);

  const applySession = useCallback(
    (nextSession: RemoteBrowserStreamingSession) => {
      setSession(nextSession);
      sessionIdRef.current = nextSession.id;

      const cacheKey = getSessionCacheKey(companyId, userId, nextSession.browserConfigId);
      streamingSessionCache.set(cacheKey, {
        sessionId: nextSession.id,
        session: nextSession,
      });
    },
    [companyId, userId]
  );

  const refreshSession = useCallback(async () => {
    if (!sessionIdRef.current) return null;
    const nextSession = await browserStreamingClient.getSession(sessionIdRef.current);
    applySession(nextSession);
    return nextSession;
  }, [applySession]);

  const ensureSession = useCallback(async (homeUrl?: string, forceNew = false) => {
    if (!selectedConfig) return;

    setBootingSession(true);
    setEngineError(null);

    try {
      const cacheKey = getSessionCacheKey(companyId, userId, selectedConfig.id);
      const cached = streamingSessionCache.get(cacheKey);

      if (!forceNew && cached?.sessionId) {
        sessionIdRef.current = cached.sessionId;
        setSession(cached.session || null);
        const existing = await browserStreamingClient.getSession(cached.sessionId);
        applySession(existing);
        return;
      }

      if (cached?.sessionId) {
        await browserStreamingClient.destroySession(cached.sessionId).catch(() => undefined);
        streamingSessionCache.delete(cacheKey);
      }

      const createdSession = await browserStreamingClient.createSession({
        companyId,
        userId,
        browserConfigId: selectedConfig.id,
        homeUrl,
      });
      applySession(createdSession);
      setUrlInput(createdSession.homeUrl || "");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo iniciar el navegador remoto fluido.";
      setEngineError(message);
      if (mode === "hybrid" && fallback) {
        setUseFallback(true);
      }
    } finally {
      setBootingSession(false);
    }
  }, [applySession, companyId, fallback, mode, selectedConfig, userId]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const nextHealth = await loadHealth();
        if (cancelled) return;

        if (!nextHealth.ready && mode === "hybrid" && fallback) {
          setUseFallback(true);
          setLoading(false);
          return;
        }

        await loadConfigs();
      } catch (error) {
        if (!cancelled) {
          setEngineError(
            error instanceof Error
              ? error.message
              : "No se pudo conectar con el motor de streaming."
          );
          if (mode === "hybrid" && fallback) {
            setUseFallback(true);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [fallback, loadConfigs, loadHealth, mode]);

  useEffect(() => {
    if (selectedConfig) {
      streamingSelectedConfigCache.set(browserCacheKey, selectedConfig.id);
    }
  }, [browserCacheKey, selectedConfig]);

  useEffect(() => {
    if (!selectedConfig || useFallback) return;
    void ensureSession();
  }, [ensureSession, selectedConfig, useFallback]);

  useEffect(() => {
    if (session?.homeUrl) {
      setUrlInput(session.homeUrl);
    } else if (session?.id) {
      setUrlInput("");
    }
  }, [session?.homeUrl, session?.id]);

  useEffect(() => {
    if (!session?.id || useFallback) return;

    const interval = window.setInterval(() => {
      void refreshSession().catch(() => undefined);
    }, session.status === "provisioning" ? 1500 : 5000);

    return () => window.clearInterval(interval);
  }, [refreshSession, session?.id, session?.status, useFallback]);

  if (useFallback && fallback) {
    return <>{fallback}</>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Navegador no configurado</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Contacta al administrador para habilitar el navegador para tu empresa.
        </p>
      </Card>
    );
  }

  const launchFromInput = () => {
    if (!urlInput.trim()) return;
    void ensureSession(urlInput, true);
  };

  return (
    <div className="flex min-h-[680px] flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      {configs.length > 1 && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          {configs.map((config) => (
            <button
              key={config.id}
              onClick={() => {
                setUseFallback(false);
                setSelectedConfig(config);
              }}
              className={cn(
                "rounded px-2 py-0.5 text-xs transition-colors",
                selectedConfig?.id === config.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              {config.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 border-b bg-muted/50 pl-1 pr-2">
        <div className="flex flex-1 items-center overflow-x-auto">
          {displayTabs.map((tab) => (
            <div
              key={tab.id}
              title={tab.url || "Nueva pestaña"}
              className={cn(
                "group flex h-9 min-w-[88px] max-w-[138px] cursor-default items-center gap-1.5 border-r px-2 py-1.5 text-[11px]",
                tab.isActive
                  ? "bg-background font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Globe className="h-3 w-3 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{getCompactTabLabel(tab.title, tab.url)}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => void ensureSession("about:blank", true)}
          aria-label="Nueva pestaña"
          className="rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
          {tabsCount} pestaña{tabsCount !== 1 ? "s" : ""}
        </Badge>
      </div>

      {engineError && (
        <div className="border-b bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {engineError}
        </div>
      )}

      <div className="border-b bg-card px-2 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative min-w-[280px] flex-1">
            <Globe className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  launchFromInput();
                }
              }}
              placeholder="URL, dominio o busqueda rapida..."
              className="h-9 pl-8 pr-3 text-xs"
            />
          </div>

          <Button
            size="sm"
            className="h-9 px-3 text-xs"
            onClick={launchFromInput}
            disabled={bootingSession || !urlInput.trim()}
          >
            {bootingSession ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ir"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => void ensureSession(undefined, true)}
            title="Reconectar"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          {quickAccessItems.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 px-3 text-xs">
                  <PanelsTopLeft className="h-3.5 w-3.5" />
                  Accesos
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {quickAccessItems.length}
                  </Badge>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[360px] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Acceso rapido
                  </div>
                  <span className="text-[11px] text-muted-foreground">Actual o nueva sesión</span>
                </div>

                <div className="grid max-h-[320px] gap-2 overflow-auto pr-1">
                  {quickAccessItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2"
                    >
                      <button
                        onClick={() => {
                          if (isProblematicUrl(item.url)) {
                            toast({
                              title: "Aviso sobre este sitio",
                              description:
                                "Sitios como Google o YouTube pueden mostrar captchas o errores. Si no cargan bien, prueba con otro sitio permitido.",
                              variant: "default",
                            });
                          }
                          void ensureSession(item.url, true);
                        }}
                        className="min-w-0 flex-1 text-left transition-opacity hover:opacity-80"
                      >
                        <div className="truncate text-xs font-medium">{item.label}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {item.description}
                        </div>
                      </button>

                      <button
                        onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                        className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                        title={`Abrir ${item.label} fuera del embebido`}
                        aria-label={`Abrir ${item.label} fuera del embebido`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="relative flex-1 bg-background">
        {(bootingSession || session?.status === "provisioning") && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90">
            <div className="space-y-2 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Preparando sesion remota de navegador...
              </p>
            </div>
          </div>
        )}

        {session?.status === "ready" && session.streamUrl ? (
          <iframe
            title="Navegador remoto fluido"
            src={session.streamUrl}
            className="h-full min-h-[640px] w-full border-0 bg-background"
            allow="autoplay; clipboard-read; clipboard-write; fullscreen"
          />
        ) : session?.status === "error" ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-lg space-y-3 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
              <h3 className="text-lg font-semibold">No se pudo iniciar la sesión streaming</h3>
              <p className="text-sm text-muted-foreground">
                {session.error || "El motor remoto devolvió un error."}
              </p>
              {session.homeUrl && isProblematicUrl(session.homeUrl) && (
                <p className="text-xs text-muted-foreground">
                  Sitios como Google o YouTube suelen bloquear el acceso desde entornos remotos.
                  Prueba con otro sitio permitido.
                </p>
              )}
              {fallback && mode === "hybrid" && (
                <Button onClick={() => setUseFallback(true)}>Usar modo compatible</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-auto bg-gradient-to-br from-background via-muted/20 to-background">
            <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-6 px-6 py-12">
              <div className="space-y-3 text-center">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  Navegador remoto
                </Badge>
                <h3 className="text-2xl font-semibold tracking-tight">
                  Abre un sitio permitido o inicia una sesión
                </h3>
                <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
                  Escribe una URL en la barra superior o elige un acceso directo para comenzar.
                </p>
              </div>

              {quickAccessItems.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {quickAccessItems.map((item) => (
                    <div
                      key={`hero-${item.id}`}
                      className="rounded-2xl border bg-background/80 p-4 shadow-sm backdrop-blur"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{item.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        <Globe className="h-4 w-4 text-primary" />
                      </div>
                      <p className="mt-3 truncate text-xs text-muted-foreground">{item.url}</p>
                      <div className="mt-4">
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => void ensureSession(item.url, true)}
                        >
                          Abrir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex justify-center">
                  <Button onClick={() => void ensureSession()}>Iniciar navegador</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
