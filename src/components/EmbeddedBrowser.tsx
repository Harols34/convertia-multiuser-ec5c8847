import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Plus,
  X,
  Globe,
  ShieldAlert,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface BrowserConfig {
  id: string;
  name: string;
  enabled: boolean;
  allowed_domains: string[];
  allowed_url_prefixes: string[];
  blocked_url_patterns: string[];
  allow_new_tabs: boolean;
  allow_downloads: boolean;
  allow_popups: boolean;
  allow_http: boolean;
}

interface BrowserTab {
  id: string;
  url: string;
  title: string;
  status: "loading" | "loaded" | "blocked" | "error";
  reason?: string;
}

interface EmbeddedBrowserProps {
  companyId: string;
  userId: string;
}

export function EmbeddedBrowser({ companyId, userId }: EmbeddedBrowserProps) {
  const [configs, setConfigs] = useState<BrowserConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<BrowserConfig | null>(null);
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    loadConfigs();
  }, [companyId]);

  const loadConfigs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("browser_configs")
      .select("*")
      .eq("company_id", companyId)
      .eq("enabled", true);

    if (!error && data && data.length > 0) {
      const mapped = data.map((d: any) => ({
        ...d,
        allowed_domains: d.allowed_domains || [],
        allowed_url_prefixes: d.allowed_url_prefixes || [],
        blocked_url_patterns: d.blocked_url_patterns || [],
      }));
      setConfigs(mapped);
      setSelectedConfig(mapped[0]);
      // Create initial tab
      const initialTab: BrowserTab = {
        id: crypto.randomUUID(),
        url: "",
        title: "Nueva pestaña",
        status: "loaded",
      };
      setTabs([initialTab]);
      setActiveTabId(initialTab.id);
    }
    setLoading(false);
  };

  const validateAndNavigate = useCallback(
    async (url: string, tabId: string) => {
      if (!selectedConfig || !url.trim()) return;

      // Normalize URL
      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = "https://" + normalizedUrl;
      }

      // Block dangerous schemes client-side first
      try {
        const parsed = new URL(normalizedUrl);
        if (["javascript:", "data:", "file:", "blob:", "vbscript:"].includes(parsed.protocol)) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === tabId
                ? { ...t, status: "blocked", reason: "Protocolo no permitido", url: normalizedUrl }
                : t
            )
          );
          return;
        }
      } catch {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? { ...t, status: "error", reason: "URL inválida", url: normalizedUrl }
              : t
          )
        );
        return;
      }

      setNavigating(true);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId ? { ...t, status: "loading", url: normalizedUrl } : t
        )
      );

      try {
        // Server-side validation
        const { data, error } = await supabase.functions.invoke("browser-navigate", {
          body: {
            url: normalizedUrl,
            browser_config_id: selectedConfig.id,
            company_id: companyId,
            user_id: userId,
          },
        });

        if (error || !data?.allowed) {
          const reason = data?.reason || "Sitio no permitido";
          setTabs((prev) =>
            prev.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    status: "blocked",
                    reason:
                      reason === "domain_not_allowed"
                        ? "Dominio no permitido"
                        : reason === "http_not_allowed"
                        ? "HTTP no habilitado, solo HTTPS"
                        : reason === "protocol_not_allowed"
                        ? "Protocolo no permitido"
                        : reason === "blocked_pattern_match"
                        ? "URL bloqueada por patrón"
                        : "Sitio no permitido",
                  }
                : t
            )
          );
          toast({
            title: "Sitio no permitido",
            description: `No tienes permiso para acceder a esta URL`,
            variant: "destructive",
          });
        } else {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    status: "loaded",
                    url: normalizedUrl,
                    title: new URL(normalizedUrl).hostname,
                  }
                : t
            )
          );
        }
      } catch (err: any) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? { ...t, status: "error", reason: "Error de conexión" }
              : t
          )
        );
      }

      setNavigating(false);
    },
    [selectedConfig, companyId, userId, toast]
  );

  const handleNavigate = () => {
    if (activeTabId) {
      validateAndNavigate(urlInput, activeTabId);
    }
  };

  const addTab = () => {
    if (!selectedConfig?.allow_new_tabs) {
      toast({
        title: "No permitido",
        description: "No tienes permiso para abrir nuevas pestañas",
        variant: "destructive",
      });
      return;
    }
    const newTab: BrowserTab = {
      id: crypto.randomUUID(),
      url: "",
      title: "Nueva pestaña",
      status: "loaded",
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setUrlInput("");

    // Log tab open
    supabase.from("browser_audit_logs").insert({
      company_id: companyId,
      user_id: userId,
      browser_config_id: selectedConfig?.id,
      action: "TAB_OPEN",
      url: null,
      reason: null,
    });
  };

  const closeTab = (tabId: string) => {
    const remaining = tabs.filter((t) => t.id !== tabId);
    if (remaining.length === 0) {
      const newTab: BrowserTab = {
        id: crypto.randomUUID(),
        url: "",
        title: "Nueva pestaña",
        status: "loaded",
      };
      setTabs([newTab]);
      setActiveTabId(newTab.id);
      setUrlInput("");
    } else {
      setTabs(remaining);
      if (activeTabId === tabId) {
        setActiveTabId(remaining[remaining.length - 1].id);
        setUrlInput(remaining[remaining.length - 1].url);
      }
    }

    // Log tab close
    supabase.from("browser_audit_logs").insert({
      company_id: companyId,
      user_id: userId,
      browser_config_id: selectedConfig?.id,
      action: "TAB_CLOSE",
      url: null,
      reason: null,
    });
  };

  const handleReload = () => {
    if (activeTab?.url && activeTab.status === "loaded") {
      if (iframeRef.current) {
        iframeRef.current.src = activeTab.url;
      }
    }
  };

  useEffect(() => {
    if (activeTab) {
      setUrlInput(activeTab.url);
    }
  }, [activeTabId]);

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
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-semibold">Navegador no configurado</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Contacta al administrador para habilitar el navegador para tu empresa.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] border rounded-lg overflow-hidden bg-background">
      {/* Config selector if multiple */}
      {configs.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30 text-xs">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          {configs.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedConfig(c)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                selectedConfig?.id === c.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Tabs bar */}
      <div className="flex items-center bg-muted/50 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r min-w-[120px] max-w-[200px] group transition-colors ${
              activeTabId === tab.id
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.status === "loading" ? (
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
            ) : tab.status === "blocked" ? (
              <ShieldAlert className="h-3 w-3 text-destructive shrink-0" />
            ) : (
              <Globe className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate flex-1">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {selectedConfig?.allow_new_tabs && (
          <button
            onClick={addTab}
            className="px-2 py-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Navigation bar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-card">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled
          title="Atrás"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled
          title="Adelante"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleReload}
          disabled={!activeTab?.url || activeTab.status !== "loaded"}
          title="Recargar"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1 relative">
          <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
            placeholder="Ingresa una URL permitida..."
            className="h-7 pl-8 text-xs"
          />
        </div>
        <Button
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={handleNavigate}
          disabled={navigating || !urlInput.trim()}
        >
          {navigating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ir"}
        </Button>
      </div>

      {/* Allowed domains hint */}
      {selectedConfig && activeTab && !activeTab.url && (
        <div className="px-4 py-3 bg-muted/30 border-b">
          <p className="text-xs text-muted-foreground mb-2">Sitios permitidos:</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedConfig.allowed_domains.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setUrlInput(`https://${d}`);
                  if (activeTabId) validateAndNavigate(`https://${d}`, activeTabId);
                }}
                className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors"
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 relative">
        {activeTab?.status === "blocked" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center space-y-3">
              <div className="bg-destructive/10 p-4 rounded-full mx-auto w-fit">
                <ShieldAlert className="h-10 w-10 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold">Sitio no permitido</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {activeTab.reason || "No tienes permiso para acceder a este sitio."}
              </p>
              <p className="text-xs text-muted-foreground">
                Contacta al administrador si necesitas acceso.
              </p>
            </div>
          </div>
        )}

        {activeTab?.status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center space-y-3">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
              <h3 className="text-lg font-semibold">Error</h3>
              <p className="text-sm text-muted-foreground">
                {activeTab.reason || "No se pudo cargar la página."}
              </p>
            </div>
          </div>
        )}

        {activeTab?.status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {activeTab?.url && activeTab.status === "loaded" ? (
          <iframe
            ref={iframeRef}
            src={activeTab.url}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
            onLoad={() => {
              setTabs((prev) =>
                prev.map((t) =>
                  t.id === activeTabId ? { ...t, status: "loaded" } : t
                )
              );
            }}
            onError={() => {
              setTabs((prev) =>
                prev.map((t) =>
                  t.id === activeTabId
                    ? { ...t, status: "error", reason: "No se pudo cargar el sitio. Puede estar bloqueando la carga en iframe." }
                    : t
                )
              );
            }}
          />
        ) : (
          !activeTab?.url &&
          activeTab?.status !== "blocked" &&
          activeTab?.status !== "error" && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <Globe className="h-16 w-16 mx-auto opacity-20" />
                <p className="text-sm">Ingresa una URL para comenzar a navegar</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
