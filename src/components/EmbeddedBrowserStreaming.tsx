import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, AlertTriangle, MonitorSmartphone, RefreshCw } from "lucide-react";
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

export function EmbeddedBrowserStreaming({
  companyId,
  userId,
  mode = "hybrid",
  fallback,
}: EmbeddedBrowserStreamingProps) {
  const [configs, setConfigs] = useState<BrowserConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<BrowserConfig | null>(null);
  const [session, setSession] = useState<RemoteBrowserStreamingSession | null>(null);
  const [health, setHealth] = useState<RemoteBrowserHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootingSession, setBootingSession] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const browserCacheKey = useMemo(() => getCacheKey(companyId, userId), [companyId, userId]);

  const loadHealth = useCallback(async () => {
    const nextHealth = await browserStreamingClient.getHealth();
    setHealth(nextHealth);
    return nextHealth;
  }, []);

  const loadConfigs = useCallback(async () => {
    const { data, error } = await supabase
      .from("browser_configs")
      .select("id, name, enabled")
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

  const ensureSession = useCallback(async () => {
    if (!selectedConfig) return;

    setBootingSession(true);
    setEngineError(null);

    try {
      const cacheKey = getSessionCacheKey(companyId, userId, selectedConfig.id);
      const cached = streamingSessionCache.get(cacheKey);

      if (cached?.sessionId) {
        sessionIdRef.current = cached.sessionId;
        setSession(cached.session || null);
        const existing = await browserStreamingClient.getSession(cached.sessionId);
        applySession(existing);
        return;
      }

      const createdSession = await browserStreamingClient.createSession({
        companyId,
        userId,
        browserConfigId: selectedConfig.id,
      });
      applySession(createdSession);
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

  return (
    <div className="flex min-h-[680px] flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <MonitorSmartphone className="h-3.5 w-3.5" />
            Streaming remoto
          </Badge>
          {session?.status === "ready" && (
            <Badge variant="outline" className="gap-1">
              <Globe className="h-3.5 w-3.5" />
              Sesion lista
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {configs.length > 1 &&
            configs.map((config) => (
              <button
                key={config.id}
                onClick={() => {
                  setUseFallback(false);
                  setSelectedConfig(config);
                }}
                className={cn(
                  "rounded px-2 py-1 text-xs transition-colors",
                  selectedConfig?.id === config.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {config.name}
              </button>
            ))}

          <Button variant="outline" size="sm" onClick={() => void ensureSession()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Reconectar
          </Button>
        </div>
      </div>

      {health && !health.ready && (
        <div className="border-b bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {health.message}
        </div>
      )}

      {engineError && (
        <div className="border-b bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {engineError}
        </div>
      )}

      {session?.warnings.length ? (
        <div className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {session.warnings[0]}
        </div>
      ) : null}

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
              <h3 className="text-lg font-semibold">No se pudo iniciar la sesion streaming</h3>
              <p className="text-sm text-muted-foreground">
                {session.error || "El motor remoto devolvio un error."}
              </p>
              {fallback && mode === "hybrid" && (
                <Button onClick={() => setUseFallback(true)}>Usar modo compatible</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-lg space-y-3 text-center">
              <MonitorSmartphone className="mx-auto h-10 w-10 text-primary" />
              <h3 className="text-lg font-semibold">Sesion remota lista para arrancar</h3>
              <p className="text-sm text-muted-foreground">
                Este modo apunta a una experiencia mucho mas fluida que snapshots, con
                interaccion visual real sobre una sesion remota del navegador.
              </p>
              <Button onClick={() => void ensureSession()}>Iniciar streaming</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
