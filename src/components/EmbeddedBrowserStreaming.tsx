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
  const [barCollapsed, setBarCollapsed] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const browserCacheKey = useMemo(() => getCacheKey(companyId, userId), [companyId, userId]);

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
    const cacheKey = getSessionCacheKey(companyId, userId, selectedConfig.id);
    const cached = streamingSessionCache.get(cacheKey);
    if (cached?.sessionId) {
      void ensureSession();
    }
  }, [ensureSession, companyId, selectedConfig, useFallback, userId]);

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
    <div className="flex min-h-[400px] flex-col overflow-hidden rounded-lg border border-border/40 bg-background">
      {configs.length > 1 && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-muted/30 px-2 py-1 text-[11px]">
          <Globe className="h-3 w-3 text-muted-foreground" />
          {configs.map((config) => (
            <button
              key={config.id}
              onClick={() => {
                setUseFallback(false);
                setSelectedConfig(config);
              }}
              className={cn(
                "rounded px-1.5 py-0.5 transition-colors",
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

      {engineError && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {engineError}
        </div>
      )}

      {(!barCollapsed || session?.status !== "ready") && (
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border/50 bg-card/50 px-2 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Globe className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") launchFromInput();
            }}
            placeholder="URL o dominio..."
            className="h-8 flex-1 pl-7 pr-2 text-xs"
          />
        </div>
        <Button
          size="sm"
          className="h-8 shrink-0 px-2 text-xs"
          onClick={launchFromInput}
          disabled={bootingSession || !urlInput.trim()}
        >
          {bootingSession ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ir"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => void ensureSession(undefined, true)}
          title="Reconectar"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
        {quickAccessItems.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-xs">
                <PanelsTopLeft className="h-3 w-3" />
                <span className="hidden sm:inline">Accesos</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[320px] p-2">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-medium">
                <Sparkles className="h-3 w-3 text-primary" />
                Acceso rápido
              </div>
              <div className="grid max-h-[280px] gap-1.5 overflow-auto">
                {quickAccessItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-background px-2.5 py-2"
                  >
                    <button
                      onClick={() => {
                        if (isProblematicUrl(item.url)) {
                          toast({
                            title: "Aviso",
                            description:
                              "Sitios como Google o YouTube pueden mostrar captchas. Prueba otro sitio si falla.",
                            variant: "default",
                          });
                        }
                        void ensureSession(item.url, true);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-xs font-medium">{item.label}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{item.description}</div>
                    </button>
                    <button
                      onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
                      title="Abrir fuera"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 border-t pt-2 text-[10px] text-muted-foreground">
                Para más pestañas: usa <kbd className="rounded bg-muted px-1">Ctrl+T</kbd> o el botón + dentro del navegador.
              </p>
            </PopoverContent>
          </Popover>
        )}
        {session?.status === "ready" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setBarCollapsed((c) => !c)}
            title="Ocultar barra para más espacio"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        )}
      </div>
      )}

      {barCollapsed && session?.status === "ready" && (
        <div className="absolute left-2 top-2 z-20">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 gap-1 px-2 text-xs shadow-md"
            onClick={() => setBarCollapsed(false)}
          >
            <ChevronDown className="h-3 w-3 rotate-180" />
            Barra
          </Button>
        </div>
      )}

      <div className="relative flex-1 min-h-0 bg-background">
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
            ref={iframeRef}
            title="Navegador remoto"
            src={session.streamUrl}
            className="absolute inset-0 h-full w-full border-0 bg-background"
            allow="autoplay; clipboard-read; clipboard-write; fullscreen"
            loading="eager"
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
