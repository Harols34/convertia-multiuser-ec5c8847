import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
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
  browserEngineClient,
  type BrowserSessionSnapshot,
  type BrowserSessionTab,
} from "@/lib/browser-engine-client";
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

interface BrowserSessionCacheEntry {
  sessionId: string;
  session: BrowserSessionSnapshot | null;
  urlInput: string;
  history: HistoryEntry[];
}

const REMOTE_VIEWPORT = {
  width: 1280,
  height: 800,
};

const SPECIAL_KEYS: Record<string, string> = {
  Enter: "Enter",
  Backspace: "Backspace",
  Delete: "Delete",
  Escape: "Escape",
  Tab: "Tab",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  " ": "Space",
};

const BLOCK_REASON_LABELS: Record<string, string> = {
  domain: "El dominio no esta permitido por la configuracion de tu empresa.",
  invalid: "La URL no es valida.",
  protocol: "El protocolo de la URL no esta permitido.",
  http: "Solo se permiten sitios HTTPS en esta configuracion.",
  blocked: "La URL coincide con un patron bloqueado.",
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

function getCompactTabLabel(tab: BrowserSessionTab) {
  if (tab.url) {
    try {
      const parsed = new URL(tab.url);
      const host = formatDomainLabel(parsed.hostname);
      return clampText(host, 18);
    } catch {
      // Usa el titulo si la URL no se puede parsear.
    }
  }

  return clampText(tab.title || "Nueva", 16);
}

const browserSelectedConfigCache = new Map<string, string>();
const browserSessionCache = new Map<string, BrowserSessionCacheEntry>();

function getBrowserCacheKey(companyId: string, userId: string) {
  return `${companyId}:${userId}`;
}

function getBrowserSessionCacheKey(companyId: string, userId: string, browserConfigId: string) {
  return `${companyId}:${userId}:${browserConfigId}`;
}

export function EmbeddedBrowser({ companyId, userId }: EmbeddedBrowserProps) {
  const [configs, setConfigs] = useState<BrowserConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<BrowserConfig | null>(null);
  const [session, setSession] = useState<BrowserSessionSnapshot | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [snapshotToken, setSnapshotToken] = useState(Date.now());
  const [bufferedTyping, setBufferedTyping] = useState("");
  const [fastRefreshUntil, setFastRefreshUntil] = useState(0);
  const { toast } = useToast();

  const sessionIdRef = useRef<string | null>(null);
  const wheelRef = useRef(0);
  const activeTabRef = useRef<BrowserSessionTab | null>(null);
  const typingBufferRef = useRef("");
  const typingTimeoutRef = useRef<number | null>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const browserCacheKey = useMemo(() => getBrowserCacheKey(companyId, userId), [companyId, userId]);
  const selectedSessionCacheKey = useMemo(
    () =>
      selectedConfig
        ? getBrowserSessionCacheKey(companyId, userId, selectedConfig.id)
        : null,
    [companyId, selectedConfig, userId]
  );

  const activeTab = useMemo(
    () => session?.tabs.find((tab) => tab.id === session.activeTabId) || null,
    [session]
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
        return (
          normalized === "youtube.com" ||
          normalized.endsWith(".youtube.com") ||
          normalized === "youtu.be"
        );
      }),
    [selectedConfig]
  );

  const quickAccessItems = useMemo<QuickAccessItem[]>(() => {
    if (!selectedConfig) return [];

    const items = new Map<string, QuickAccessItem>();
    const addItem = (item: QuickAccessItem) => {
      if (!items.has(item.url)) {
        items.set(item.url, item);
      }
    };

    selectedConfig.allowed_domains.forEach((domain) => {
      const normalizedDomain = normalizeDomain(domain);
      if (!normalizedDomain) return;

      addItem({
        id: `domain-${normalizedDomain}`,
        label: formatDomainLabel(normalizedDomain),
        url: `https://${normalizedDomain}`,
        description: "Sitio permitido",
        source: "domain",
      });
    });

    selectedConfig.allowed_url_prefixes.forEach((prefix, index) => {
      try {
        const parsed = new URL(prefix);
        const label = `${formatDomainLabel(parsed.hostname)}${
          parsed.pathname !== "/" ? parsed.pathname : ""
        }`;
        addItem({
          id: `prefix-${index}`,
          label,
          url: prefix,
          description: "Ruta permitida",
          source: "prefix",
        });
      } catch {
        // Ignora prefijos invalidos.
      }
    });

    history
      .filter((entry) => entry.action === "NAVIGATE_ALLOWED" && entry.url)
      .slice(0, 5)
      .forEach((entry, index) => {
        if (!entry.url) return;
        try {
          const parsed = new URL(entry.url);
          addItem({
            id: `recent-${index}`,
            label: formatDomainLabel(parsed.hostname),
            url: entry.url,
            description: "Reciente",
            source: "recent",
          });
        } catch {
          // Ignora URLs invalidas.
        }
      });

    return Array.from(items.values()).slice(0, 12);
  }, [history, selectedConfig]);

  const showEmptyState =
    !activeTab?.url &&
    activeTab?.status !== "blocked" &&
    activeTab?.status !== "error" &&
    activeTab?.status !== "loading";

  const applySession = useCallback(
    (nextSession: BrowserSessionSnapshot) => {
      setSession(nextSession);
      setSnapshotToken(Date.now());

      const cacheKey = getBrowserSessionCacheKey(
        companyId,
        userId,
        nextSession.browserConfigId
      );
      const currentCache = browserSessionCache.get(cacheKey);

      browserSessionCache.set(cacheKey, {
        sessionId: nextSession.id,
        session: nextSession,
        urlInput: currentCache?.urlInput || "",
        history: currentCache?.history || [],
      });
    },
    [companyId, userId]
  );

  const markFastRefresh = useCallback((durationMs = 5000) => {
    setFastRefreshUntil(Date.now() + durationMs);
  }, []);

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
      const cachedConfigId = browserSelectedConfigCache.get(browserCacheKey);
      const cachedConfig = mapped.find((item) => item.id === cachedConfigId);

      setConfigs(mapped);
      setSelectedConfig((current) => current || cachedConfig || mapped[0]);
    } else {
      setConfigs([]);
      setSelectedConfig(null);
    }

    setLoading(false);
  }, [browserCacheKey, companyId]);

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

    if (data) {
      setHistory(data as HistoryEntry[]);
    }

    setLoadingHistory(false);
  }, [companyId, userId]);

  const refreshSession = useCallback(async () => {
    if (!sessionIdRef.current) return null;
    const nextSession = await browserEngineClient.getSession(sessionIdRef.current);
    applySession(nextSession);
    return nextSession;
  }, [applySession]);

  const flushTypingBuffer = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    const tabId = activeTabRef.current?.id;
    const text = typingBufferRef.current;

    if (!sessionId || !tabId || !text) {
      return;
    }

    typingBufferRef.current = "";
    setBufferedTyping("");

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    setNavigating(true);
    setEngineError(null);
    markFastRefresh(5000);

    try {
      const nextSession = await browserEngineClient.type(sessionId, tabId, text);
      applySession(nextSession);
    } catch (error) {
      setEngineError(
        error instanceof Error ? error.message : "No se pudo escribir en la vista remota."
      );
    } finally {
      setNavigating(false);
    }
  }, [applySession, markFastRefresh]);

  const queueTyping = useCallback(
    (text: string) => {
      typingBufferRef.current += text;
      setBufferedTyping(typingBufferRef.current);
      markFastRefresh(5000);

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        void flushTypingBuffer();
      }, 90);
    },
    [flushTypingBuffer, markFastRefresh]
  );

  const runTabAction = useCallback(
    async (
      action: (sessionId: string, tabId: string) => Promise<BrowserSessionSnapshot>,
      opts?: { keepLoading?: boolean; flushTypedText?: boolean; fastRefreshMs?: number }
    ) => {
      const sessionId = sessionIdRef.current;
      const tabId = activeTabRef.current?.id;
      if (!sessionId || !tabId) return;

      if (opts?.flushTypedText !== false) {
        await flushTypingBuffer();
      }

      setNavigating(true);
      setEngineError(null);
      markFastRefresh(opts?.fastRefreshMs ?? 6000);

      try {
        const nextSession = await action(sessionId, tabId);
        applySession(nextSession);
      } catch (error) {
        setEngineError(
          error instanceof Error ? error.message : "No se pudo completar la accion."
        );
      } finally {
        if (!opts?.keepLoading) {
          setNavigating(false);
        }
      }
    },
    [applySession, flushTypingBuffer, markFastRefresh]
  );

  const resolveNavigationTarget = useCallback(
    (rawInput: string) => {
      const input = rawInput.trim();

      if (!input) {
        return { error: "Ingresa una URL o una busqueda." };
      }

      const googleShortcut = input.match(/^(g|google)\s+(.+)$/i);
      if (googleShortcut) {
        if (!googleAllowed) {
          return { error: "Google no esta permitido en tu configuracion actual." };
        }

        const query = googleShortcut[2].trim();
        return {
          url: buildSearchUrl("google", query),
          inputValue: query,
        };
      }

      const youtubeShortcut = input.match(/^(yt|youtube)\s+(.+)$/i);
      if (youtubeShortcut) {
        if (!youtubeAllowed) {
          return { error: "YouTube no esta permitido en tu configuracion actual." };
        }

        const query = youtubeShortcut[2].trim();
        return {
          url: buildSearchUrl("youtube", query),
          inputValue: query,
        };
      }

      if (!isLikelyUrl(input) && /\s/.test(input)) {
        if (!googleAllowed) {
          return { error: "Escribe una URL valida o usa un sitio permitido." };
        }

        return {
          url: buildSearchUrl("google", input),
          inputValue: input,
        };
      }

      const normalizedUrl =
        input.startsWith("http://") || input.startsWith("https://") ? input : `https://${input}`;

      try {
        new URL(normalizedUrl);
        return {
          url: normalizedUrl,
          inputValue: normalizedUrl,
        };
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

      await runTabAction(
        (sessionId, tabId) => browserEngineClient.navigate(sessionId, tabId, resolved.url),
        { fastRefreshMs: 9000 }
      );
    },
    [resolveNavigationTarget, runTabAction, urlInput]
  );

  const addTab = useCallback(
    async (targetUrl?: string) => {
      if (!selectedConfig?.allow_new_tabs) {
        toast({
          title: "No permitido",
          description: "No tienes permiso para abrir nuevas pestañas.",
          variant: "destructive",
        });
        return;
      }

      if (!sessionIdRef.current) return;

      await flushTypingBuffer();
      setNavigating(true);
      setEngineError(null);
      markFastRefresh(9000);

      try {
        const nextSession = await browserEngineClient.createTab(sessionIdRef.current, targetUrl);
        applySession(nextSession);
        if (!targetUrl) {
          setUrlInput("");
        }

        await supabase.from("browser_audit_logs").insert({
          company_id: companyId,
          user_id: userId,
          browser_config_id: selectedConfig.id,
          action: "TAB_OPEN",
          url: targetUrl || null,
          reason: null,
        });
      } catch (error) {
        setEngineError(
          error instanceof Error ? error.message : "No se pudo abrir una nueva pestaña."
        );
      } finally {
        setNavigating(false);
      }
    },
    [applySession, companyId, flushTypingBuffer, markFastRefresh, selectedConfig, toast, userId]
  );

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

  const closeTab = useCallback(
    (tabId: string) => {
      if (!sessionIdRef.current) return;

      setNavigating(true);
      setEngineError(null);
      markFastRefresh(5000);

      void browserEngineClient
        .closeTab(sessionIdRef.current, tabId)
        .then((nextSession) => {
          applySession(nextSession);
          return supabase.from("browser_audit_logs").insert({
            company_id: companyId,
            user_id: userId,
            browser_config_id: selectedConfig?.id,
            action: "TAB_CLOSE",
            url: null,
            reason: null,
          });
        })
        .catch((error) => {
          setEngineError(
            error instanceof Error ? error.message : "No se pudo cerrar la pestaña."
          );
        })
        .finally(() => setNavigating(false));
    },
    [applySession, companyId, markFastRefresh, selectedConfig?.id, userId]
  );

  const handleReload = useCallback(() => {
    void runTabAction((sessionId, tabId) => browserEngineClient.reload(sessionId, tabId), {
      fastRefreshMs: 7000,
    });
  }, [runTabAction]);

  const handleActivateTab = useCallback(
    (tab: BrowserSessionTab) => {
      if (!sessionIdRef.current) return;

      setNavigating(true);
      setEngineError(null);
      markFastRefresh(4000);

      void browserEngineClient
        .activateTab(sessionIdRef.current, tab.id)
        .then((nextSession) => applySession(nextSession))
        .catch((error) => {
          setEngineError(
            error instanceof Error ? error.message : "No se pudo activar la pestaña."
          );
        })
        .finally(() => setNavigating(false));
    },
    [applySession, markFastRefresh]
  );

  const handleBack = useCallback(() => {
    void runTabAction((sessionId, tabId) => browserEngineClient.back(sessionId, tabId), {
      fastRefreshMs: 7000,
    });
  }, [runTabAction]);

  const handleForward = useCallback(() => {
    void runTabAction((sessionId, tabId) => browserEngineClient.forward(sessionId, tabId), {
      fastRefreshMs: 7000,
    });
  }, [runTabAction]);

  const handleViewportClick = async (event: ReactMouseEvent<HTMLImageElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = (event.clientX - rect.left) / rect.width;
    const yRatio = (event.clientY - rect.top) / rect.height;

    await runTabAction(
      (sessionId, tabId) => browserEngineClient.click(sessionId, tabId, xRatio, yRatio),
      { flushTypedText: false, fastRefreshMs: 9000 }
    );
  };

  const handleViewportWheel = async (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!sessionIdRef.current || !activeTabRef.current) return;

    const now = Date.now();
    if (now - wheelRef.current < 120) return;
    wheelRef.current = now;

    event.preventDefault();
    await runTabAction(
      (sessionId, tabId) => browserEngineClient.scroll(sessionId, tabId, event.deltaY),
      { keepLoading: true, flushTypedText: false, fastRefreshMs: 4000 }
    );
    setNavigating(false);
  };

  const handleViewportPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData("text");
    if (!text) return;

    event.preventDefault();
    queueTyping(text);
  };

  const handleViewportKeyDown = async (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!sessionIdRef.current || !activeTabRef.current) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
      event.preventDefault();
      addressInputRef.current?.focus();
      addressInputRef.current?.select();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "t") {
      event.preventDefault();
      void addTab();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key.length === 1) {
      event.preventDefault();
      queueTyping(event.key);
      return;
    }

    const mappedKey = SPECIAL_KEYS[event.key];
    if (!mappedKey) return;

    event.preventDefault();
    await flushTypingBuffer();
    await runTabAction(
      (sessionId, tabId) => browserEngineClient.press(sessionId, tabId, mappedKey),
      { flushTypedText: false, fastRefreshMs: 7000 }
    );
  };

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (selectedConfig) {
      browserSelectedConfigCache.set(browserCacheKey, selectedConfig.id);
    }
  }, [browserCacheKey, selectedConfig]);

  useEffect(() => {
    if (!selectedSessionCacheKey || !sessionIdRef.current) return;

    const currentCache = browserSessionCache.get(selectedSessionCacheKey);
    browserSessionCache.set(selectedSessionCacheKey, {
      sessionId: sessionIdRef.current,
      session,
      urlInput: currentCache?.urlInput || "",
      history: currentCache?.history || [],
    });
  }, [selectedSessionCacheKey, session]);

  useEffect(() => {
    if (!selectedSessionCacheKey) return;

    const currentCache = browserSessionCache.get(selectedSessionCacheKey);
    if (!currentCache?.sessionId) return;

    browserSessionCache.set(selectedSessionCacheKey, {
      sessionId: currentCache.sessionId,
      session: currentCache.session,
      urlInput,
      history: currentCache.history,
    });
  }, [selectedSessionCacheKey, urlInput]);

  useEffect(() => {
    if (!selectedSessionCacheKey || !sessionIdRef.current) return;

    const currentCache = browserSessionCache.get(selectedSessionCacheKey);
    browserSessionCache.set(selectedSessionCacheKey, {
      sessionId: sessionIdRef.current,
      session: currentCache?.session || session,
      urlInput: currentCache?.urlInput || urlInput,
      history,
    });
  }, [history, selectedSessionCacheKey, session, urlInput]);

  useEffect(() => {
    if (!selectedConfig) return;

    let disposed = false;
    const cacheKey = getBrowserSessionCacheKey(companyId, userId, selectedConfig.id);
    const cachedSession = browserSessionCache.get(cacheKey);
    sessionIdRef.current = cachedSession?.sessionId || null;
    setSession(cachedSession?.session || null);
    setHistory(cachedSession?.history || []);
    setUrlInput(cachedSession?.urlInput || "");
    setEngineError(null);
    setNavigating(!cachedSession?.sessionId);

    const bootSession = async () => {
      try {
        if (cachedSession?.sessionId) {
          const existingSession = await browserEngineClient.getSession(cachedSession.sessionId);

          if (disposed) {
            return;
          }

          sessionIdRef.current = existingSession.id;
          applySession(existingSession);
          return;
        }

        const nextSession = await browserEngineClient.createSession({
          companyId,
          userId,
          browserConfigId: selectedConfig.id,
        });

        if (disposed) {
          return;
        }

        sessionIdRef.current = nextSession.id;
        applySession(nextSession);
      } catch (error) {
        if (!disposed) {
          setEngineError(
            error instanceof Error
              ? error.message
              : "No se pudo inicializar el motor del navegador."
          );
        }
      } finally {
        if (!disposed) {
          setNavigating(false);
        }
      }
    };

    void bootSession();

    return () => {
      disposed = true;
      sessionIdRef.current = null;
    };
  }, [applySession, companyId, selectedConfig, userId]);

  useEffect(() => {
    if (!session?.id) return;

    const intervalMs = activeTab?.status === "loading" ? 350 : Date.now() < fastRefreshUntil ? 750 : 1800;
    const interval = window.setInterval(() => {
      void refreshSession().catch(() => undefined);
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [activeTab?.status, fastRefreshUntil, refreshSession, session?.id]);

  useEffect(() => {
    if (!fastRefreshUntil || fastRefreshUntil <= Date.now()) return;

    const timeout = window.setTimeout(() => {
      setFastRefreshUntil(0);
    }, fastRefreshUntil - Date.now());

    return () => window.clearTimeout(timeout);
  }, [fastRefreshUntil]);

  useEffect(() => {
    if (activeTab?.url) {
      setUrlInput(activeTab.url);
    } else if (session?.activeTabId) {
      setUrlInput("");
    }
  }, [activeTab?.id, activeTab?.url, session?.activeTabId]);

  useEffect(() => {
    if (!showHistory && history.length === 0) {
      void loadHistory();
    }
  }, [history.length, loadHistory, showHistory]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleWindowShortcuts = (event: KeyboardEvent) => {
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

    window.addEventListener("keydown", handleWindowShortcuts);
    return () => window.removeEventListener("keydown", handleWindowShortcuts);
  }, [addTab]);

  const snapshotUrl =
    session?.id && activeTab
      ? browserEngineClient.getSnapshotUrl(session.id, activeTab.id, snapshotToken, {
          format: "jpeg",
          quality: activeTab.status === "loading" ? 55 : 65,
        })
      : null;

  const blockedReason =
    (activeTab?.reason && BLOCK_REASON_LABELS[activeTab.reason]) ||
    activeTab?.reason ||
    "No tienes permiso para acceder a este sitio.";

  const tabsCount = session?.tabs.length || 0;
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

      <div className="flex items-center gap-1 border-b bg-muted/50 pl-1 pr-2">
        <div className="flex flex-1 items-center overflow-x-auto">
          {session?.tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => handleActivateTab(tab)}
              title={tab.title || tab.url || "Nueva pestaña"}
              className={cn(
                "group flex h-9 min-w-[88px] max-w-[138px] cursor-pointer items-center gap-1.5 border-r px-2 py-1.5 text-[11px] transition-colors",
                session.activeTabId === tab.id
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
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
                aria-label={`Cerrar pestaña ${tab.title}`}
                className="rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
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

      <div className="border-b bg-card px-2 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={!activeTab?.canGoBack || navigating}
            title="Atras"
            onClick={handleBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={!activeTab?.canGoForward || navigating}
            title="Adelante"
            onClick={handleForward}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={handleReload}
            disabled={!activeTab?.url || activeTab.status === "loading" || navigating}
            title="Recargar"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>

          <div className="relative min-w-[280px] flex-1">
            <Globe className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={addressInputRef}
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void navigateToInput();
                }
              }}
              placeholder="URL, dominio o busqueda rapida..."
              className="h-9 pl-8 pr-3 text-xs"
            />
          </div>

          <Button
            size="sm"
            className="h-9 px-3 text-xs"
            onClick={() => void navigateToInput()}
            disabled={navigating || !urlInput.trim()}
          >
            {navigating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ir"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => {
              setShowHistory((current) => !current);
              if (!showHistory && history.length === 0) {
                void loadHistory();
              }
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
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2"
                    >
                      <button
                        onClick={() => void openQuickAccess(item)}
                        className="min-w-0 flex-1 text-left transition-opacity hover:opacity-80"
                      >
                        <div className="truncate text-xs font-medium">{item.label}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {item.description}
                        </div>
                      </button>

                      {selectedConfig?.allow_new_tabs && (
                        <button
                          onClick={() => void openQuickAccess(item, true)}
                          className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                          title={`Abrir ${item.label} en nueva pestaña`}
                          aria-label={`Abrir ${item.label} en nueva pestaña`}
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

      </div>

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
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-xs"
                onClick={() => setShowHistory(false)}
              >
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
                <div
                  key={entry.id}
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
                  <Badge
                    variant={entry.action === "NAVIGATE_BLOCKED" ? "destructive" : "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {entry.action === "NAVIGATE_ALLOWED" ? "OK" : "Bloqueado"}
                  </Badge>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString("es-ES", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative flex-1">
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
              <p className="text-xs text-muted-foreground">
                Contacta al administrador si necesitas acceso.
              </p>
            </div>
          </div>
        )}

        {activeTab?.status === "error" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <div className="space-y-3 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
              <h3 className="text-lg font-semibold">Error</h3>
              <p className="text-sm text-muted-foreground">
                {activeTab.reason || "No se pudo cargar la pagina."}
              </p>
            </div>
          </div>
        )}

        {activeTab?.status === "loading" && snapshotUrl && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="space-y-2 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                Cargando y actualizando vista remota...
              </p>
            </div>
          </div>
        )}

        {snapshotUrl && activeTab ? (
          <div
            className="h-full w-full overflow-auto bg-background outline-none"
            tabIndex={0}
            aria-label="Vista remota del navegador"
            onWheel={handleViewportWheel}
            onKeyDown={handleViewportKeyDown}
            onPaste={handleViewportPaste}
          >
            <div className="flex min-h-full flex-col items-center justify-start p-1">
              <div className="w-full">
                <img
                  src={snapshotUrl}
                  alt={`Vista remota de ${activeTab.title}`}
                  className="block h-auto max-w-full cursor-default select-none"
                  draggable={false}
                  width={REMOTE_VIEWPORT.width}
                  height={REMOTE_VIEWPORT.height}
                  onClick={(event) => {
                    void handleViewportClick(event);
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          showEmptyState && (
            <div className="absolute inset-0 overflow-auto bg-gradient-to-br from-background via-muted/20 to-background">
              <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-6 px-6 py-12">
                <div className="space-y-3 text-center">
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    Navegador remoto dinamico
                  </Badge>
                  <h3 className="text-2xl font-semibold tracking-tight">
                    Abre un sitio permitido o lanza una busqueda en segundos
                  </h3>
                  <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
                    La barra superior ahora entiende URLs, dominios y busquedas rapidas. Tambien
                    puedes abrir accesos directos en la pestaña actual o en una nueva sin pasos
                    extra.
                  </p>
                </div>

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

                      <div className="mt-4 flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => void openQuickAccess(item)}>
                          Abrir
                        </Button>
                        {selectedConfig?.allow_new_tabs && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void openQuickAccess(item, true)}
                          >
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
          )
        )}
      </div>
    </div>
  );
}
