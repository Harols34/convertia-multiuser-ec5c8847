import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
  PanelsTopLeft,
} from "lucide-react";

const SUPABASE_URL = "https://kmnwfjbiqnqsfnmmgxqd.supabase.co";

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

interface HistoryEntry {
  id: string;
  url: string | null;
  action: string;
  reason: string | null;
  created_at: string;
}

interface QuickAccessItem {
  id: string;
  label: string;
  url: string;
  description: string;
  source: "domain" | "prefix" | "recent";
}

interface EmbeddedBrowserProps {
  companyId: string;
  userId: string;
}

interface ProxyTab {
  id: string;
  title: string;
  url: string; // the real target URL
  proxyUrl: string; // the proxy URL (used for fetch, not iframe src)
  srcdoc: string; // the HTML content to render in iframe
  status: "idle" | "loading" | "loaded" | "blocked" | "error";
  reason: string | null;
  historyStack: string[];
  historyIndex: number;
}

const BLOCK_REASON_LABELS: Record<string, string> = {
  domain: "El dominio no esta permitido por la configuracion de tu empresa.",
  domain_not_allowed: "El dominio no esta permitido por la configuracion de tu empresa.",
  invalid: "La URL no es valida.",
  protocol: "El protocolo de la URL no esta permitido.",
  protocol_not_allowed: "El protocolo de la URL no esta permitido.",
  http: "Solo se permiten sitios HTTPS en esta configuracion.",
  http_not_allowed: "Solo se permiten sitios HTTPS en esta configuracion.",
  blocked: "La URL coincide con un patron bloqueado.",
  blocked_pattern_match: "La URL coincide con un patron bloqueado.",
};

function normalizeDomain(domain: string) {
  return domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

function formatDomainLabel(value: string) {
  return value.replace(/^www\./, "");
}

function isLikelyUrl(value: string) {
  return /^(https?:\/\/|localhost[:/]|[\w-]+\.[\w.-]+)/i.test(value);
}

function buildSearchUrl(provider: "google" | "youtube", query: string) {
  const encodedQuery = encodeURIComponent(query.trim());
  return provider === "youtube"
    ? `https://www.youtube.com/results?search_query=${encodedQuery}`
    : `https://www.google.com/search?q=${encodedQuery}`;
}

function clampText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}…` : value;
}

function getCompactTabLabel(tab: ProxyTab) {
  if (tab.url) {
    try {
      const parsed = new URL(tab.url);
      const host = formatDomainLabel(parsed.hostname);
      return clampText(host, 18);
    } catch {
      // fallback
    }
  }
  return clampText(tab.title || "Nueva", 16);
}

function buildProxyUrl(
  configId: string,
  companyId: string,
  userId: string,
  targetUrl: string
): string {
  return `${SUPABASE_URL}/functions/v1/browser-proxy?config_id=${encodeURIComponent(configId)}&company_id=${encodeURIComponent(companyId)}&user_id=${encodeURIComponent(userId)}&url=${encodeURIComponent(targetUrl)}`;
}

function isAllowedByConfig(
  url: string,
  config: BrowserConfig
): { allowed: boolean; reason: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (["javascript:", "data:", "file:", "blob:", "vbscript:"].includes(parsed.protocol)) {
      return { allowed: false, reason: "protocol" };
    }
    if (parsed.protocol === "http:" && !config.allow_http) {
      return { allowed: false, reason: "http" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { allowed: false, reason: "protocol" };
    }

    for (const pattern of config.blocked_url_patterns) {
      if (pattern && url.includes(pattern)) {
        return { allowed: false, reason: "blocked" };
      }
    }

    for (const prefix of config.allowed_url_prefixes) {
      if (prefix && url.startsWith(prefix)) {
        return { allowed: true, reason: "ok" };
      }
    }

    for (const domain of config.allowed_domains) {
      const d = domain.toLowerCase().trim();
      if (!d) continue;
      if (hostname === d || hostname.endsWith("." + d)) {
        return { allowed: true, reason: "ok" };
      }
    }

    return { allowed: false, reason: "domain" };
  } catch {
    return { allowed: false, reason: "invalid" };
  }
}

let nextTabId = 1;
function createTabId() {
  return `tab-${nextTabId++}`;
}

export function EmbeddedBrowser({ companyId, userId }: EmbeddedBrowserProps) {
  const [configs, setConfigs] = useState<BrowserConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<BrowserConfig | null>(null);
  const [tabs, setTabs] = useState<ProxyTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const { toast } = useToast();

  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || null,
    [tabs, activeTabId]
  );

  const googleAllowed = useMemo(
    () =>
      (selectedConfig?.allowed_domains || []).some((domain) =>
        normalizeDomain(domain).includes("google.")
      ),
    [selectedConfig]
  );

  const youtubeAllowed = useMemo(
    () =>
      (selectedConfig?.allowed_domains || []).some((domain) => {
        const normalized = normalizeDomain(domain);
        return normalized === "youtube.com" || normalized.endsWith(".youtube.com") || normalized === "youtu.be";
      }),
    [selectedConfig]
  );

  const quickAccessItems = useMemo<QuickAccessItem[]>(() => {
    if (!selectedConfig) return [];
    const items = new Map<string, QuickAccessItem>();
    const addItem = (item: QuickAccessItem) => {
      if (!items.has(item.url)) items.set(item.url, item);
    };

    selectedConfig.allowed_domains.forEach((domain) => {
      const nd = normalizeDomain(domain);
      if (!nd) return;
      addItem({
        id: `domain-${nd}`,
        label: formatDomainLabel(nd),
        url: `https://${nd}`,
        description: "Sitio permitido",
        source: "domain",
      });
    });

    selectedConfig.allowed_url_prefixes.forEach((prefix, index) => {
      try {
        const parsed = new URL(prefix);
        const label = `${formatDomainLabel(parsed.hostname)}${parsed.pathname !== "/" ? parsed.pathname : ""}`;
        addItem({ id: `prefix-${index}`, label, url: prefix, description: "Ruta permitida", source: "prefix" });
      } catch { /* ignore */ }
    });

    history
      .filter((e) => e.action === "NAVIGATE_ALLOWED" && e.url)
      .slice(0, 5)
      .forEach((entry, index) => {
        if (!entry.url) return;
        try {
          const parsed = new URL(entry.url);
          addItem({ id: `recent-${index}`, label: formatDomainLabel(parsed.hostname), url: entry.url, description: "Reciente", source: "recent" });
        } catch { /* ignore */ }
      });

    return Array.from(items.values()).slice(0, 12);
  }, [history, selectedConfig]);

  const showEmptyState = !activeTab?.url && activeTab?.status !== "blocked" && activeTab?.status !== "error";

  // Load configs
  const loadConfigs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("browser_configs")
      .select("*")
      .eq("company_id", companyId)
      .eq("enabled", true);

    if (!error && data && data.length > 0) {
      const mapped = data.map((item) => ({
        ...item,
        allowed_domains: item.allowed_domains || [],
        allowed_url_prefixes: item.allowed_url_prefixes || [],
        blocked_url_patterns: item.blocked_url_patterns || [],
      }));
      setConfigs(mapped);
      setSelectedConfig((c) => c || mapped[0]);
    } else {
      setConfigs([]);
      setSelectedConfig(null);
    }
    setLoading(false);
  }, [companyId]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from("browser_audit_logs")
      .select("id, url, action, reason, created_at")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .in("action", ["NAVIGATE_ALLOWED", "NAVIGATE_BLOCKED"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setHistory(data as HistoryEntry[]);
    setLoadingHistory(false);
  }, [companyId, userId]);

  const logAudit = useCallback(
    async (action: string, url: string | null, reason: string | null) => {
      if (!selectedConfig) return;
      await supabase.from("browser_audit_logs").insert({
        company_id: companyId,
        user_id: userId,
        browser_config_id: selectedConfig.id,
        action,
        url,
        reason,
      });
    },
    [companyId, selectedConfig, userId]
  );

  // Update a tab in state
  const updateTab = useCallback((tabId: string, updates: Partial<ProxyTab>) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t)));
  }, []);

  // Navigate a tab to a URL
  const navigateTab = useCallback(
    async (tabId: string, targetUrl: string) => {
      if (!selectedConfig) return;

      const check = isAllowedByConfig(targetUrl, selectedConfig);

      await logAudit(
        check.allowed ? "NAVIGATE_ALLOWED" : "NAVIGATE_BLOCKED",
        targetUrl,
        check.allowed ? "manual" : check.reason
      );

      if (!check.allowed) {
        updateTab(tabId, {
          status: "blocked",
          reason: check.reason,
          url: targetUrl,
        });
        setEngineError(null);
        return;
      }

      const proxyUrl = buildProxyUrl(selectedConfig.id, companyId, userId, targetUrl);

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== tabId) return t;
          const newHistory = t.historyStack.slice(0, t.historyIndex + 1);
          newHistory.push(targetUrl);
          return {
            ...t,
            url: targetUrl,
            proxyUrl,
            status: "loading" as const,
            reason: null,
            historyStack: newHistory,
            historyIndex: newHistory.length - 1,
          };
        })
      );
      setUrlInput(targetUrl);
      setEngineError(null);

      // Fetch HTML via proxy (returns JSON with HTML content)
      try {
        const resp = await fetch(proxyUrl);
        const data = await resp.json();
        if (data.__proxy_html && data.html) {
          updateTab(tabId, { srcdoc: data.html, status: "loaded", title: data.title || "" });
        } else {
          // Non-JSON or error response - show error
          updateTab(tabId, { status: "error", reason: "No se pudo cargar la página." });
        }
      } catch (err) {
        console.error("Proxy fetch error:", err);
        updateTab(tabId, { status: "error", reason: "Error al conectar con el proxy." });
      }
    },
    [companyId, logAudit, selectedConfig, updateTab, userId]
  );

  const resolveNavigationTarget = useCallback(
    (rawInput: string) => {
      const input = rawInput.trim();
      if (!input) return { error: "Ingresa una URL o una busqueda." };

      const googleShortcut = input.match(/^(g|google)\s+(.+)$/i);
      if (googleShortcut) {
        if (!googleAllowed) return { error: "Google no esta permitido en tu configuracion actual." };
        return { url: buildSearchUrl("google", googleShortcut[2].trim()), inputValue: googleShortcut[2].trim() };
      }

      const youtubeShortcut = input.match(/^(yt|youtube)\s+(.+)$/i);
      if (youtubeShortcut) {
        if (!youtubeAllowed) return { error: "YouTube no esta permitido en tu configuracion actual." };
        return { url: buildSearchUrl("youtube", youtubeShortcut[2].trim()), inputValue: youtubeShortcut[2].trim() };
      }

      if (!isLikelyUrl(input) && /\s/.test(input)) {
        if (!googleAllowed) return { error: "Escribe una URL valida o usa un sitio permitido." };
        return { url: buildSearchUrl("google", input), inputValue: input };
      }

      const normalizedUrl = input.startsWith("http://") || input.startsWith("https://") ? input : `https://${input}`;
      try {
        new URL(normalizedUrl);
        return { url: normalizedUrl, inputValue: normalizedUrl };
      } catch {
        return { error: "URL invalida." };
      }
    },
    [googleAllowed, youtubeAllowed]
  );

  const navigateToInput = useCallback(
    async (rawInput?: string) => {
      const resolved = resolveNavigationTarget(rawInput ?? urlInput);
      if (!resolved.url) {
        setEngineError(resolved.error || "No se pudo interpretar la URL.");
        return;
      }
      setEngineError(null);
      setUrlInput(resolved.inputValue || resolved.url);
      setNavigating(true);

      if (activeTabId) {
        await navigateTab(activeTabId, resolved.url);
      }
      setNavigating(false);
    },
    [activeTabId, navigateTab, resolveNavigationTarget, urlInput]
  );

  const addTab = useCallback(
    async (targetUrl?: string) => {
      if (!selectedConfig?.allow_new_tabs) {
        toast({ title: "No permitido", description: "No tienes permiso para abrir nuevas pestañas.", variant: "destructive" });
        return;
      }

      const tabId = createTabId();
      const newTab: ProxyTab = {
        id: tabId,
        title: "Nueva pestaña",
        url: "",
        proxyUrl: "",
        srcdoc: "",
        status: "idle",
        reason: null,
        historyStack: [],
        historyIndex: -1,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(tabId);

      if (targetUrl) {
        await navigateTab(tabId, targetUrl);
      } else {
        setUrlInput("");
      }

      await logAudit("TAB_OPEN", targetUrl || null, null);
    },
    [logAudit, navigateTab, selectedConfig, toast]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const filtered = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          const newActive = filtered.length > 0 ? filtered[filtered.length - 1].id : null;
          setActiveTabId(newActive);
          if (newActive) {
            const tab = filtered.find((t) => t.id === newActive);
            setUrlInput(tab?.url || "");
          }
        }
        return filtered;
      });
      iframeRefs.current.delete(tabId);
      void logAudit("TAB_CLOSE", null, null);
    },
    [activeTabId, logAudit]
  );

  const handleActivateTab = useCallback(
    (tab: ProxyTab) => {
      setActiveTabId(tab.id);
      setUrlInput(tab.url || "");
    },
    []
  );

  const handleBack = useCallback(async () => {
    if (!activeTab || activeTab.historyIndex <= 0) return;
    const prevUrl = activeTab.historyStack[activeTab.historyIndex - 1];
    if (!prevUrl || !selectedConfig) return;

    const proxyUrl = buildProxyUrl(selectedConfig.id, companyId, userId, prevUrl);
    updateTab(activeTab.id, {
      url: prevUrl,
      proxyUrl,
      status: "loading",
      reason: null,
      historyIndex: activeTab.historyIndex - 1,
    });
    setUrlInput(prevUrl);

    try {
      const resp = await fetch(proxyUrl);
      const data = await resp.json();
      if (data.__proxy_html && data.html) {
        updateTab(activeTab.id, { srcdoc: data.html, status: "loaded" });
      }
    } catch { /* ignore */ }
  }, [activeTab, companyId, selectedConfig, updateTab, userId]);

  const handleForward = useCallback(() => {
    if (!activeTab || activeTab.historyIndex >= activeTab.historyStack.length - 1) return;
    const nextUrl = activeTab.historyStack[activeTab.historyIndex + 1];
    if (!nextUrl || !selectedConfig) return;

    const proxyUrl = buildProxyUrl(selectedConfig.id, companyId, userId, nextUrl);
    updateTab(activeTab.id, {
      url: nextUrl,
      proxyUrl,
      status: "loading",
      reason: null,
      historyIndex: activeTab.historyIndex + 1,
    });
    setUrlInput(nextUrl);
  }, [activeTab, companyId, selectedConfig, updateTab, userId]);

  const handleReload = useCallback(() => {
    if (!activeTab?.proxyUrl) return;
    const iframe = iframeRefs.current.get(activeTab.id);
    if (iframe) {
      updateTab(activeTab.id, { status: "loading" });
      iframe.src = activeTab.proxyUrl;
    }
  }, [activeTab, updateTab]);

  const openQuickAccess = useCallback(
    async (item: QuickAccessItem, openInNewTab = false) => {
      setUrlInput(item.url);
      if (openInNewTab && selectedConfig?.allow_new_tabs) {
        await addTab(item.url);
        return;
      }
      await navigateToInput(item.url);
    },
    [addTab, navigateToInput, selectedConfig]
  );

  // Listen for proxy-nav and proxy-title messages from iframes
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;

      if (event.data.type === "proxy-nav" && event.data.url) {
        const newUrl = event.data.url as string;
        // Find the tab whose iframe sent this
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== activeTabId) return t;
            // Check if this URL is allowed
            if (selectedConfig) {
              const check = isAllowedByConfig(newUrl, selectedConfig);
              if (!check.allowed) {
                void logAudit("NAVIGATE_BLOCKED", newUrl, check.reason);
                return { ...t, status: "blocked" as const, reason: check.reason, url: newUrl };
              }
            }

            // Build proxy and navigate
            if (selectedConfig) {
              const proxyUrl = buildProxyUrl(selectedConfig.id, companyId, userId, newUrl);
              const newHistory = t.historyStack.slice(0, t.historyIndex + 1);
              newHistory.push(newUrl);
              void logAudit("NAVIGATE_ALLOWED", newUrl, "proxy-nav");

              // Set the iframe src
              const iframe = iframeRefs.current.get(t.id);
              if (iframe) iframe.src = proxyUrl;

              return {
                ...t,
                url: newUrl,
                proxyUrl,
                status: "loading" as const,
                reason: null,
                historyStack: newHistory,
                historyIndex: newHistory.length - 1,
              };
            }
            return t;
          })
        );
        setUrlInput(newUrl);
      }

      if (event.data.type === "proxy-title" && event.data.title) {
        const title = event.data.title as string;
        const url = event.data.url as string | undefined;
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== activeTabId) return t;
            return { ...t, title, ...(url ? { url } : {}) };
          })
        );
        if (url) setUrlInput(url);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [activeTabId, companyId, logAudit, selectedConfig, userId]);

  // Init: create first tab when config is selected
  useEffect(() => {
    if (!selectedConfig) return;
    if (tabs.length === 0) {
      const tabId = createTabId();
      setTabs([{
        id: tabId,
        title: "Nueva pestaña",
        url: "",
        proxyUrl: "",
        srcdoc: "",
        status: "idle",
        reason: null,
        historyStack: [],
        historyIndex: -1,
      }]);
      setActiveTabId(tabId);
    }
  }, [selectedConfig, tabs.length]);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    if (!showHistory && history.length === 0) {
      void loadHistory();
    }
  }, [history.length, loadHistory, showHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        addressInputRef.current?.focus();
        addressInputRef.current?.select();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "t") {
        event.preventDefault();
        void addTab();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addTab]);

  // Sync URL input with active tab
  useEffect(() => {
    if (activeTab?.url) {
      setUrlInput(activeTab.url);
    } else if (activeTab) {
      setUrlInput("");
    }
  }, [activeTab?.id, activeTab?.url]);

  const blockedReason =
    (activeTab?.reason && BLOCK_REASON_LABELS[activeTab.reason]) ||
    activeTab?.reason ||
    "No tienes permiso para acceder a este sitio.";

  const tabsCount = tabs.length;
  const interactionHint = googleAllowed || youtubeAllowed;

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
      {/* Config selector */}
      {configs.length > 1 && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          {configs.map((config) => (
            <button
              key={config.id}
              onClick={() => setSelectedConfig(config)}
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

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b bg-muted/50 pl-1 pr-2">
        <div className="flex flex-1 items-center overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => handleActivateTab(tab)}
              title={tab.title || tab.url || "Nueva pestaña"}
              className={cn(
                "group flex h-9 min-w-[88px] max-w-[138px] cursor-pointer items-center gap-1.5 border-r px-2 py-1.5 text-[11px] transition-colors",
                activeTabId === tab.id
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-muted/70"
              )}
            >
              {tab.status === "loading" ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              ) : tab.status === "blocked" ? (
                <ShieldAlert className="h-3 w-3 shrink-0 text-destructive" />
              ) : (
                <Globe className="h-3 w-3 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate font-medium">{getCompactTabLabel(tab)}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  aria-label={`Cerrar pestaña ${tab.title}`}
                  className="rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {selectedConfig?.allow_new_tabs && (
          <button
            onClick={() => void addTab()}
            aria-label="Nueva pestaña"
            className="rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}

        <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
          {tabsCount} pestañas
        </Badge>
      </div>

      {/* Address bar */}
      <div className="border-b bg-card px-2 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-9 w-9"
            disabled={!activeTab || activeTab.historyIndex <= 0 || navigating}
            title="Atras" onClick={handleBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9"
            disabled={!activeTab || activeTab.historyIndex >= activeTab.historyStack.length - 1 || navigating}
            title="Adelante" onClick={handleForward}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9"
            onClick={handleReload}
            disabled={!activeTab?.proxyUrl || activeTab.status === "loading" || navigating}
            title="Recargar"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>

          <div className="relative min-w-[280px] flex-1">
            <Globe className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={addressInputRef}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void navigateToInput(); }}
              placeholder="URL, dominio o busqueda rapida..."
              className="h-9 pl-8 pr-3 text-xs"
            />
          </div>

          <Button size="sm" className="h-9 px-3 text-xs"
            onClick={() => void navigateToInput()}
            disabled={navigating || !urlInput.trim()}
          >
            {navigating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ir"}
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9"
            onClick={() => {
              setShowHistory((c) => !c);
              if (!showHistory && history.length === 0) void loadHistory();
            }}
            title="Historial"
          >
            <Clock className="h-3.5 w-3.5" />
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
                  <span className="text-[11px] text-muted-foreground">
                    {selectedConfig?.allow_new_tabs ? "Actual o nueva pestaña" : "Pestaña actual"}
                  </span>
                </div>

                <div className="grid max-h-[320px] gap-2 overflow-auto pr-1">
                  {quickAccessItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2">
                      <button onClick={() => void openQuickAccess(item)} className="min-w-0 flex-1 text-left transition-opacity hover:opacity-80">
                        <div className="truncate text-xs font-medium">{item.label}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{item.description}</div>
                      </button>
                      {selectedConfig?.allow_new_tabs && (
                        <button onClick={() => void openQuickAccess(item, true)}
                          className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                          title={`Abrir ${item.label} en nueva pestaña`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Quick access chips */}
        {quickAccessItems.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Acceso directo rapido</span>
            <div className="flex flex-1 flex-wrap items-center gap-1 overflow-hidden">
              {quickAccessItems.slice(0, 6).map((item) => (
                <button key={`chip-${item.id}`}
                  onClick={() => void openQuickAccess(item)}
                  className="flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] hover:bg-muted"
                >
                  <span className="font-medium">{item.label}</span>
                  <Badge variant="secondary" className="h-4 px-1 text-[9px]">{item.description}</Badge>
                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                </button>
              ))}
            </div>
            {selectedConfig?.allow_new_tabs && (
              <span className="text-[10px] text-muted-foreground">Abre en actual o nueva pestaña</span>
            )}
          </div>
        )}

        {interactionHint && (
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>🔍</span>
            <span>
              Puedes escribir una busqueda directa o usar &apos;g reporte mensual&apos;.
              {youtubeAllowed && " Usa 'yt tutorial'"}
            </span>
          </div>
        )}
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="max-h-[200px] overflow-y-auto border-b bg-muted/20">
          <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Clock className="h-3 w-3" /> Historial de navegacion
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-5 px-2 text-xs" onClick={() => void loadHistory()}>
                <RotateCw className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-5 px-2 text-xs" onClick={() => setShowHistory(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">Sin historial aun</p>
          ) : (
            <div className="divide-y">
              {history.map((entry) => (
                <div key={entry.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/30"
                  onClick={() => {
                    if (entry.url && entry.action === "NAVIGATE_ALLOWED") {
                      setUrlInput(entry.url);
                      void navigateToInput(entry.url);
                      setShowHistory(false);
                    }
                  }}
                >
                  {entry.action === "NAVIGATE_ALLOWED" ? (
                    <Globe className="h-3 w-3 shrink-0 text-primary" />
                  ) : (
                    <ShieldAlert className="h-3 w-3 shrink-0 text-destructive" />
                  )}
                  <span className="flex-1 truncate">{entry.url || "-"}</span>
                  <Badge variant={entry.action === "NAVIGATE_BLOCKED" ? "destructive" : "secondary"} className="shrink-0 text-[10px]">
                    {entry.action === "NAVIGATE_ALLOWED" ? "OK" : "Bloqueado"}
                  </Badge>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString("es-ES", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main viewport */}
      <div className="relative flex-1" style={{ minHeight: 500 }}>
        {engineError && (
          <div className="absolute left-3 right-3 top-3 z-20 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {engineError}
          </div>
        )}

        {activeTab?.status === "blocked" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <div className="space-y-3 text-center">
              <div className="mx-auto w-fit rounded-full bg-destructive/10 p-4">
                <ShieldAlert className="h-10 w-10 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold">Sitio no permitido</h3>
              <p className="max-w-sm text-sm text-muted-foreground">{blockedReason}</p>
              <p className="text-xs text-muted-foreground">Contacta al administrador si necesitas acceso.</p>
            </div>
          </div>
        )}

        {/* Render iframes for all tabs (hidden unless active) */}
        {tabs.map((tab) => (
          <iframe
            key={tab.id}
            ref={(el) => {
              if (el) iframeRefs.current.set(tab.id, el);
            }}
            src={tab.proxyUrl || "about:blank"}
            title={tab.title || "Navegador"}
            className={cn(
              "absolute inset-0 h-full w-full border-0",
              activeTabId === tab.id && tab.proxyUrl && tab.status !== "blocked"
                ? "z-[1] block"
                : "hidden"
            )}
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            onLoad={() => {
              updateTab(tab.id, { status: tab.proxyUrl ? "loaded" : "idle" });
            }}
          />
        ))}

        {/* Empty state */}
        {showEmptyState && activeTabId && (
          <div className="absolute inset-0 z-[2] overflow-auto bg-gradient-to-br from-background via-muted/20 to-background">
            <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-6 px-6 py-12">
              <div className="space-y-3 text-center">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  Navegador embebido
                </Badge>
                <h3 className="text-2xl font-semibold tracking-tight">
                  Abre un sitio permitido o lanza una busqueda en segundos
                </h3>
                <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
                  La barra superior entiende URLs, dominios y busquedas rapidas. Tambien puedes abrir accesos directos en la pestaña actual o en una nueva.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {quickAccessItems.map((item) => (
                  <div key={`hero-${item.id}`} className="rounded-2xl border bg-background/80 p-4 shadow-sm backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <Globe className="h-4 w-4 text-primary" />
                    </div>
                    <p className="mt-3 truncate text-xs text-muted-foreground">{item.url}</p>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => void openQuickAccess(item)}>Abrir</Button>
                      {selectedConfig?.allow_new_tabs && (
                        <Button size="sm" variant="outline" onClick={() => void openQuickAccess(item, true)}>
                          Nueva pestaña
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="rounded-full px-3 py-1 font-normal">
                  `Ctrl + L` enfoca la barra
                </Badge>
                {selectedConfig?.allow_new_tabs && (
                  <Badge variant="outline" className="rounded-full px-3 py-1 font-normal">
                    `Ctrl + T` abre una pestaña
                  </Badge>
                )}
                {interactionHint && (
                  <Badge variant="outline" className="rounded-full px-3 py-1 font-normal">
                    Prueba con `g soporte tecnico` o `yt tutorial`
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {activeTab?.status === "loading" && activeTab.proxyUrl && (
          <div className="absolute inset-0 z-[3] flex items-center justify-center bg-background/60">
            <div className="space-y-2 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Cargando pagina...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
