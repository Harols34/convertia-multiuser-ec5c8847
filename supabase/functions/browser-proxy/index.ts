// @ts-ignore Edge runtime remote import resolution is handled by Deno.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function parseHeaderList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
}

function buildAllowHeaders(req: Request): string {
  const base = parseHeaderList(corsHeaders["Access-Control-Allow-Headers"]);
  const requested = parseHeaderList(req.headers.get("access-control-request-headers"));
  const merged = new Set<string>([...base, ...requested]);
  return Array.from(merged).join(", ");
}

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowHeaders = buildAllowHeaders(req);
  if (origin && origin.trim().length > 0) {
    return {
      ...corsHeaders,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": allowHeaders,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin, Access-Control-Request-Headers",
    };
  }

  return {
    ...corsHeaders,
    "Access-Control-Allow-Headers": allowHeaders,
    Vary: "Access-Control-Request-Headers",
  };
}

const INTERNAL_PROXY_QUERY_KEYS = new Set([
  "url",
  "config_id",
  "company_id",
  "user_id",
  "sub",
]);

type UrlCheckResult = { ok: boolean; why: string; host?: string };

function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function hasBlockedPattern(url: string, blocked: string[]): boolean {
  for (const pattern of blocked) {
    if (pattern && url.includes(pattern)) {
      return true;
    }
  }
  return false;
}

function isAllowedTopLevel(
  url: string,
  domains: string[],
  prefixes: string[],
  blocked: string[],
  httpOk: boolean
): UrlCheckResult {
  const parsed = safeParseUrl(url);
  if (!parsed) return { ok: false, why: "invalid" };

  const host = parsed.hostname.toLowerCase();
  const protocol = parsed.protocol;

  if (["javascript:", "data:", "file:", "blob:", "vbscript:"].includes(protocol)) {
    return { ok: false, why: "protocol" };
  }
  if (protocol === "http:" && !httpOk) {
    return { ok: false, why: "http" };
  }
  if (protocol !== "https:" && protocol !== "http:") {
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
}

function isAllowedSubRequest(
  url: string,
  blocked: string[],
  httpOk: boolean
): UrlCheckResult {
  const parsed = safeParseUrl(url);
  if (!parsed) return { ok: false, why: "invalid" };

  const host = parsed.hostname.toLowerCase();
  const protocol = parsed.protocol;

  if (["javascript:", "data:", "file:", "blob:", "vbscript:"].includes(protocol)) {
    return { ok: false, why: "protocol" };
  }
  if (protocol === "http:" && !httpOk) {
    return { ok: false, why: "http" };
  }
  if (protocol !== "https:" && protocol !== "http:") {
    return { ok: false, why: "protocol" };
  }
  if (hasBlockedPattern(url, blocked)) {
    return { ok: false, why: "blocked", host };
  }

  // Sub-resources can come from CDNs and external hosts required by allowed pages.
  return { ok: true, why: "ok" };
}

function makeErrorPage(title: string, detail: string): string {
  return (
    `<html><head><meta charset="utf-8"></head>` +
    `<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0">` +
    `<div style="text-align:center"><div style="font-size:3rem">[!]</div><h2>${title}</h2><p style="color:#999">${detail}</p></div>` +
    `</body></html>`
  );
}

function buildProxyBase(
  supabaseUrl: string,
  configId: string,
  companyId: string,
  userId: string
): string {
  return `${supabaseUrl}/functions/v1/browser-proxy?config_id=${encodeURIComponent(
    configId
  )}&company_id=${encodeURIComponent(companyId)}&user_id=${encodeURIComponent(
    userId
  )}&sub=1&url=`;
}

const SKIP_PROXY_PATTERNS = [
  "gen_204",
  "/pagead/",
  "google-analytics.com/collect",
  "doubleclick.net",
  "googlesyndication.com/pagead",
];

function shouldSkipProxy(url: string): boolean {
  const lower = url.toLowerCase();
  return SKIP_PROXY_PATTERNS.some((p) => lower.includes(p));
}

function toProxiedResource(
  value: string,
  baseUrl: string,
  proxyBase: string
): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith("#")) return null;
  if (
    raw.startsWith("javascript:") ||
    raw.startsWith("mailto:") ||
    raw.startsWith("tel:") ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return null;
  }

  const resolved = safeParseUrl(new URL(raw, baseUrl).href);
  if (!resolved) return null;
  const absolute = resolved.href;

  if (absolute.includes("/functions/v1/browser-proxy?")) return absolute;
  if (shouldSkipProxy(absolute)) return null;
  return `${proxyBase}${encodeURIComponent(absolute)}`;
}

function rewriteStaticResourceUrls(
  html: string,
  baseUrl: string,
  proxyBase: string
): string {
  const srcRegex =
    /(<(?:script|img|iframe|source|audio|video|embed|object)\b[^>]*\ssrc=)(["'])([^"']+)\2/gi;
  const hrefRegex = /(<link\b[^>]*\shref=)(["'])([^"']+)\2/gi;
  const actionRegex = /(<form\b[^>]*\saction=)(["'])([^"']+)\2/gi;

  let output = html.replace(srcRegex, (match, start, quote, value) => {
    const proxied = toProxiedResource(value, baseUrl, proxyBase);
    if (!proxied) return match;
    return `${start}${quote}${proxied}${quote}`;
  });

  output = output.replace(hrefRegex, (match, start, quote, value) => {
    const proxied = toProxiedResource(value, baseUrl, proxyBase);
    if (!proxied) return match;
    return `${start}${quote}${proxied}${quote}`;
  });

  output = output.replace(actionRegex, (match, start, quote, value) => {
    const proxied = toProxiedResource(value, baseUrl, proxyBase);
    if (!proxied) return match;
    return `${start}${quote}${proxied}${quote}`;
  });

  return output;
}

function buildInterceptorScript(
  finalUrl: string,
  fallbackTitle: string,
  proxyBase: string
): string {
  const script = `
<script>
(function () {
  var CURRENT_URL = ${JSON.stringify(finalUrl)};
  var PROXY_BASE = ${JSON.stringify(proxyBase)};
  var PROXY_ORIGIN = "";
  try {
    PROXY_ORIGIN = new URL(PROXY_BASE, CURRENT_URL).origin;
  } catch (_) {}

  function getResolveBase() {
    try {
      if (document && typeof document.baseURI === "string" && document.baseURI) {
        return document.baseURI;
      }
    } catch (_) {}
    return CURRENT_URL;
  }

  function resolveUrl(raw) {
    if (!raw) return null;
    var value = String(raw).trim();
    if (!value) return null;
    if (value.charAt(0) === "#") return null;
    if (
      value.indexOf("javascript:") === 0 ||
      value.indexOf("mailto:") === 0 ||
      value.indexOf("tel:") === 0 ||
      value.indexOf("data:") === 0 ||
      value.indexOf("blob:") === 0
    ) return null;
    try {
      return new URL(value, getResolveBase()).href;
    } catch (_) {
      return null;
    }
  }

  function isProxyUrl(url) {
    return typeof url === "string" && url.indexOf("/functions/v1/browser-proxy?") !== -1;
  }

  function normalizeLeakedProxyUrl(absolute) {
    try {
      if (!absolute || !PROXY_ORIGIN || absolute.indexOf(PROXY_ORIGIN) !== 0) return absolute;
      if (isProxyUrl(absolute)) return absolute;
      var leaked = new URL(absolute);
      var current = new URL(CURRENT_URL);
      leaked.protocol = current.protocol;
      leaked.host = current.host;
      return leaked.href;
    } catch (_) {
      return absolute;
    }
  }

  function toProxy(raw) {
    var absolute = resolveUrl(raw);
    if (!absolute) return null;
    absolute = normalizeLeakedProxyUrl(absolute);
    if (isProxyUrl(absolute)) return absolute;
    return PROXY_BASE + encodeURIComponent(absolute);
  }

  function emitProxyNavigation(url) {
    if (!url) return;
    try {
      CURRENT_URL = url;
    } catch (_) {}
    try {
      window.parent.postMessage({ type: "proxy-nav", url: url }, "*");
    } catch (_) {}
  }

  function wouldCauseHistorySecurityError(url) {
    if (!url || typeof url !== "string") return false;
    try {
      var docUrl = document.location.href || "";
      if (docUrl.indexOf("about:") === 0 || docUrl.indexOf("blob:") === 0) {
        if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return true;
      }
    } catch (_) {}
    return false;
  }

  try {
    var origPush = history.pushState.bind(history);
    var origReplace = history.replaceState.bind(history);
    var origGo = history.go.bind(history);
    var origBack = history.back.bind(history);
    var origForward = history.forward.bind(history);
    history.pushState = function (state, title, url) {
      if (wouldCauseHistorySecurityError(url)) return;
      try { origPush(state, title, url); } catch (_) {}
    };
    history.replaceState = function (state, title, url) {
      if (wouldCauseHistorySecurityError(url)) return;
      try { origReplace(state, title, url); } catch (_) {}
    };
    history.go = function () { try { origGo.apply(history, arguments); } catch (_) {} };
    history.back = function () { try { origBack(); } catch (_) {} };
    history.forward = function () { try { origForward(); } catch (_) {} };
  } catch (_) {}

  function shouldSilenceMessage(message) {
    if (!message) return false;
    var msg = String(message);
    return (
      msg.indexOf("SecurityError") !== -1 ||
      msg.indexOf("replaceState") !== -1 ||
      msg.indexOf("pushState") !== -1 ||
      msg.indexOf("history state") !== -1 ||
      msg.indexOf("Cache storage is disabled") !== -1 ||
      msg.indexOf("Blocked autofocusing") !== -1 ||
      msg.indexOf("HTTP redirect error") !== -1 ||
      msg.indexOf("403") !== -1
    );
  }

  window.addEventListener("error", function (event) {
    if (shouldSilenceMessage(event && (event.message || ""))) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    var reason = "";
    try {
      reason = String(event && event.reason ? event.reason : "");
    } catch (_) {}
    if (shouldSilenceMessage(reason)) {
      event.preventDefault();
      return false;
    }
  }, true);

  try {
    var cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    if (cookieDescriptor && typeof cookieDescriptor.get === "function") {
      Object.defineProperty(Document.prototype, "cookie", {
        configurable: true,
        enumerable: !!cookieDescriptor.enumerable,
        get: function () {
          try {
            return cookieDescriptor.get.call(this);
          } catch (_) {
            return "";
          }
        },
        set: function (value) {
          try {
            if (typeof cookieDescriptor.set === "function") {
              cookieDescriptor.set.call(this, value);
            }
          } catch (_) {}
        },
      });
    }
  } catch (_) {}

  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  if (nativeFetch) {
    window.fetch = function (input, init) {
      try {
        var rawUrl = typeof input === "string" ? input : (input && input.url ? input.url : "");
        var proxied = toProxy(rawUrl);
        var nextInit = init
          ? Object.assign({}, init, { credentials: "omit" })
          : { credentials: "omit" };
        if (proxied) {
          if (typeof input === "string") {
            return nativeFetch(proxied, nextInit);
          }
          if (typeof Request !== "undefined" && input instanceof Request) {
            var proxiedRequest = new Request(proxied, input);
            return nativeFetch(proxiedRequest, nextInit);
          }
          return nativeFetch(proxied, nextInit);
        }
      } catch (_) {}
      return nativeFetch(input, init);
    };
  }

  try {
    var nativeOpen = XMLHttpRequest.prototype.open;
    var nativeSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      try {
        if (url) {
          var proxiedUrl = toProxy(String(url));
          if (proxiedUrl) {
            arguments[1] = proxiedUrl;
          }
        }
        this.withCredentials = false;
      } catch (_) {}
      return nativeOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      try {
        this.withCredentials = false;
      } catch (_) {}
      return nativeSend.apply(this, arguments);
    };
  } catch (_) {}

  function rewriteResourceAttribute(node, attr) {
    if (!node || !node.getAttribute) return;
    var current = node.getAttribute(attr);
    if (!current) return;
    var proxied = toProxy(current);
    if (!proxied || proxied === current) return;
    node.setAttribute(attr, proxied);
  }

  function rewriteNode(node) {
    if (!node || node.nodeType !== 1) return;
    var tag = node.tagName;

    // Avoid rewriting src/href to proxy to preserve third-party script origin semantics.
    if (tag === "FORM" && node.hasAttribute("action")) {
      rewriteResourceAttribute(node, "action");
    }

    if (!node.querySelectorAll) return;
    var children = node.querySelectorAll("form[action]");
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.hasAttribute("action")) rewriteResourceAttribute(child, "action");
    }
  }

  rewriteNode(document.documentElement);
  try {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        if (mutation.type === "attributes") {
          rewriteNode(mutation.target);
          continue;
        }
        if (mutation.addedNodes && mutation.addedNodes.length) {
          for (var j = 0; j < mutation.addedNodes.length; j++) {
            rewriteNode(mutation.addedNodes[j]);
          }
        }
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["action"],
    });
  } catch (_) {}

  document.addEventListener("click", function (event) {
    var element = event.target;
    while (element && element.tagName !== "A") element = element.parentElement;
    if (!element || !element.getAttribute) return;
    var resolved = resolveUrl(element.getAttribute("href"));
    if (!resolved) return;
    event.preventDefault();
    event.stopPropagation();
    emitProxyNavigation(resolved);
  }, true);

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || !form.getAttribute) return;
    var action = form.getAttribute("action") || CURRENT_URL;
    var resolved = resolveUrl(action);
    if (!resolved) return;
    event.preventDefault();
    event.stopPropagation();

    var method = (form.method || "GET").toUpperCase();
    if (method === "GET") {
      try {
        var formData = new FormData(form);
        var query = new URLSearchParams(formData).toString();
        var separator = resolved.indexOf("?") > -1 ? "&" : "?";
        emitProxyNavigation(query ? (resolved + separator + query) : resolved);
      } catch (_) {
        emitProxyNavigation(resolved);
      }
      return;
    }

    emitProxyNavigation(resolved);
  }, true);

  try {
    var nativeFormSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      try {
        var form = this;
        var action = form.getAttribute("action") || CURRENT_URL;
        var resolved = resolveUrl(action);
        if (!resolved) return;
        var method = (form.method || "GET").toUpperCase();
        if (method === "GET") {
          var formData = new FormData(form);
          var query = new URLSearchParams(formData).toString();
          var separator = resolved.indexOf("?") > -1 ? "&" : "?";
          emitProxyNavigation(query ? (resolved + separator + query) : resolved);
          return;
        }
        emitProxyNavigation(resolved);
        return;
      } catch (_) {}
      return nativeFormSubmit.apply(this, arguments);
    };

    if (typeof HTMLFormElement.prototype.requestSubmit === "function") {
      var nativeRequestSubmit = HTMLFormElement.prototype.requestSubmit;
      HTMLFormElement.prototype.requestSubmit = function () {
        try {
          return this.submit();
        } catch (_) {
          return nativeRequestSubmit.apply(this, arguments);
        }
      };
    }
  } catch (_) {}

  try {
    var nativeAssign = window.location.assign.bind(window.location);
    var nativeReplace = window.location.replace.bind(window.location);

    window.location.assign = function (next) {
      var resolved = resolveUrl(next);
      if (resolved) {
        emitProxyNavigation(resolved);
        return;
      }
      return nativeAssign(next);
    };

    window.location.replace = function (next) {
      var resolved = resolveUrl(next);
      if (resolved) {
        emitProxyNavigation(resolved);
        return;
      }
      return nativeReplace(next);
    };
  } catch (_) {}

  window.open = function (url) {
    var resolved = resolveUrl(url);
    if (resolved) {
      emitProxyNavigation(resolved);
    }
    return null;
  };

  try {
    if (navigator && typeof navigator.sendBeacon === "function") {
      var nativeSendBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
        try {
          var proxiedBeaconUrl = toProxy(String(url || ""));
          if (proxiedBeaconUrl) {
            return nativeSendBeacon(proxiedBeaconUrl, data);
          }
        } catch (_) {}
        return nativeSendBeacon(url, data);
      };
    }
  } catch (_) {}

  function notifyTitle() {
    try {
      window.parent.postMessage(
        {
          type: "proxy-title",
          title: document.title || ${JSON.stringify(fallbackTitle)},
          url: CURRENT_URL
        },
        "*"
      );
    } catch (_) {}
  }

  notifyTitle();
  try {
    new MutationObserver(notifyTitle).observe(
      document.querySelector("title") || document.head,
      { childList: true, subtree: true, characterData: true }
    );
  } catch (_) {}
})();
</script>`;

  return script;
}

function inferSubresourceContentType(req: Request, targetUrl: string): string {
  const destination = (req.headers.get("sec-fetch-dest") || "").toLowerCase();
  const accept = (req.headers.get("accept") || "").toLowerCase();
  const parsed = safeParseUrl(targetUrl);
  const pathname = parsed?.pathname.toLowerCase() || "";

  if (destination === "style" || accept.includes("text/css") || pathname.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (
    destination === "script" ||
    accept.includes("javascript") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".mjs")
  ) {
    return "application/javascript; charset=utf-8";
  }
  if (destination === "image" || accept.includes("image/")) {
    if (pathname.endsWith(".svg")) return "image/svg+xml";
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".gif")) return "image/gif";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
    return "image/png";
  }
  if (destination === "font" || accept.includes("font/")) {
    if (pathname.endsWith(".woff2")) return "font/woff2";
    if (pathname.endsWith(".woff")) return "font/woff";
    if (pathname.endsWith(".ttf")) return "font/ttf";
    if (pathname.endsWith(".otf")) return "font/otf";
    return "font/woff2";
  }
  if (
    destination === "document" ||
    destination === "iframe" ||
    destination === "frame" ||
    accept.includes("text/html")
  ) {
    return "text/html; charset=utf-8";
  }
  return "application/octet-stream";
}

function shouldAllowSubrequestHtml(req: Request): boolean {
  const destination = (req.headers.get("sec-fetch-dest") || "").toLowerCase();
  if (destination === "document" || destination === "iframe" || destination === "frame") {
    return true;
  }

  const accept = (req.headers.get("accept") || "").toLowerCase();
  if (
    accept.includes("text/html") &&
    !accept.includes("text/css") &&
    !accept.includes("javascript") &&
    !accept.includes("image/")
  ) {
    return true;
  }

  return false;
}

function emptySubresourceResponse(
  req: Request,
  targetUrl: string,
  responseCorsHeaders: Record<string, string>,
  status = 200
): Response {
  const headers = new Headers(responseCorsHeaders);
  headers.set("Content-Type", inferSubresourceContentType(req, targetUrl));
  headers.set("Cache-Control", "no-store");
  const body = status === 204 || status === 304 ? null : "";
  return new Response(body, { status, headers });
}

function buildForwardHeaders(req: Request): Headers {
  const headers = new Headers();
  const forwardHeaders = [
    "accept",
    "accept-language",
    "content-type",
    "if-modified-since",
    "if-none-match",
    "range",
    "cache-control",
    "pragma",
    "origin",
    "referer",
    "sec-fetch-dest",
    "sec-fetch-mode",
    "sec-fetch-site",
  ];

  for (const headerName of forwardHeaders) {
    const value = req.headers.get(headerName);
    if (value) headers.set(headerName, value);
  }

  if (!headers.has("user-agent")) {
    headers.set(
      "user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
    );
  }

  return headers;
}

Deno.serve(async (req) => {
  const responseCorsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: responseCorsHeaders });
  }

  let isSubRequest = false;
  let targetUrl = "";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const params = new URL(req.url).searchParams;
    targetUrl = params.get("url") || "";
    const configId = params.get("config_id") || "";
    const companyId = params.get("company_id") || "";
    const userId = params.get("user_id") || "";
    isSubRequest = params.get("sub") === "1";
    const hasForwardedQueryOnly = Array.from(params.keys()).some(
      (key) => !INTERNAL_PROXY_QUERY_KEYS.has(key)
    );

    if (!targetUrl || !configId || !companyId) {
      // Some third-party scripts can produce malformed proxy calls while the page is bootstrapping.
      // For sub-requests (or malformed forwarded URLs like /browser-proxy?q=...),
      // return an empty payload instead of an HTML error page to avoid cascading console noise.
      if (isSubRequest || hasForwardedQueryOnly) {
        return emptySubresourceResponse(req, targetUrl || req.url, responseCorsHeaders, 204);
      }

      return new Response(makeErrorPage("Error", "Parametros incompletos"), {
        status: 400,
        headers: { ...responseCorsHeaders, "Content-Type": "text/html;charset=utf-8" },
      });
    }

    const { data: config } = await supabase
      .from("browser_configs")
      .select("*")
      .eq("id", configId)
      .eq("company_id", companyId)
      .eq("enabled", true)
      .single();

    if (!config) {
      if (isSubRequest) return emptySubresourceResponse(req, targetUrl, responseCorsHeaders);
      return new Response(makeErrorPage("No configurado", "Contacta al admin"), {
        status: 403,
        headers: { ...responseCorsHeaders, "Content-Type": "text/html;charset=utf-8" },
      });
    }

    // Si la URL apunta al propio proxy/Supabase (p. ej. redirección o script), no mostrar "Bloqueado"
    const supabaseHost = safeParseUrl(supabaseUrl)?.hostname?.toLowerCase();
    const targetHost = safeParseUrl(targetUrl)?.hostname?.toLowerCase();
    if (supabaseHost && targetHost && targetHost === supabaseHost) {
      if (isSubRequest) return emptySubresourceResponse(req, targetUrl, responseCorsHeaders);
      return new Response(
        makeErrorPage(
          "Enlace no disponible",
          "No se puede cargar este enlace en el navegador embebido."
        ),
        {
          status: 200,
          headers: { ...responseCorsHeaders, "Content-Type": "text/html;charset=utf-8" },
        }
      );
    }

    const check = isSubRequest
      ? isAllowedSubRequest(
          targetUrl,
          config.blocked_url_patterns || [],
          config.allow_http || false
        )
      : isAllowedTopLevel(
          targetUrl,
          config.allowed_domains || [],
          config.allowed_url_prefixes || [],
          config.blocked_url_patterns || [],
          config.allow_http || false
        );

    if (!isSubRequest) {
      supabase.from("browser_audit_logs").insert({
        company_id: companyId,
        user_id: userId || "anon",
        browser_config_id: configId,
        action: check.ok ? "NAVIGATE_ALLOWED" : "NAVIGATE_BLOCKED",
        url: targetUrl,
        reason: check.why,
      });
    }

    if (!check.ok) {
      if (isSubRequest) return emptySubresourceResponse(req, targetUrl, responseCorsHeaders);
      return new Response(makeErrorPage("Bloqueado", `${check.host || targetUrl} no permitido`), {
        status: 200,
        headers: { ...responseCorsHeaders, "Content-Type": "text/html;charset=utf-8" },
      });
    }

    // Fusionar parámetros de la petición (ej. q= de búsqueda Google) en la URL de destino
    let urlToFetch = targetUrl;
    const parsedTarget = safeParseUrl(targetUrl);
    if (parsedTarget) {
      for (const [key, value] of params.entries()) {
        if (INTERNAL_PROXY_QUERY_KEYS.has(key)) continue;
        parsedTarget.searchParams.set(key, value);
      }
      urlToFetch = parsedTarget.href;
    }

    const method = req.method.toUpperCase();
    const requestBody =
      method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();
    const upstreamResponse = await fetch(urlToFetch, {
      method,
      headers: buildForwardHeaders(req),
      body: requestBody,
      redirect: "follow",
    });

    const finalUrl = upstreamResponse.url;
    if (finalUrl !== urlToFetch) {
      const finalHost = safeParseUrl(finalUrl)?.hostname?.toLowerCase();
      if (supabaseHost && finalHost && finalHost === supabaseHost) {
        if (isSubRequest) return emptySubresourceResponse(req, finalUrl, responseCorsHeaders);
        return new Response(
          makeErrorPage(
            "Enlace no disponible",
            "No se puede cargar este enlace en el navegador embebido."
          ),
          {
            status: 200,
            headers: { ...responseCorsHeaders, "Content-Type": "text/html;charset=utf-8" },
          }
        );
      }

      const redirectCheck = isSubRequest
        ? isAllowedSubRequest(
            finalUrl,
            config.blocked_url_patterns || [],
            config.allow_http || false
          )
        : isAllowedTopLevel(
            finalUrl,
            config.allowed_domains || [],
            config.allowed_url_prefixes || [],
            config.blocked_url_patterns || [],
            config.allow_http || false
          );

      if (!redirectCheck.ok) {
        if (!isSubRequest) {
          supabase.from("browser_audit_logs").insert({
            company_id: companyId,
            user_id: userId || "anon",
            browser_config_id: configId,
            action: "NAVIGATE_BLOCKED",
            url: finalUrl,
            reason: "redirect",
          });
        }

        if (isSubRequest) return emptySubresourceResponse(req, finalUrl, responseCorsHeaders);
        return new Response(
          makeErrorPage("Redireccion bloqueada", `${redirectCheck.host || finalUrl} no permitido`),
          {
            status: 200,
            headers: { ...responseCorsHeaders, "Content-Type": "text/html;charset=utf-8" },
          }
        );
      }
    }

    const upstreamContentType = upstreamResponse.headers.get("content-type") || "";
    const normalizedContentType = upstreamContentType.toLowerCase();
    const isHtmlResponse =
      normalizedContentType.includes("text/html") || normalizedContentType.includes("xhtml");
    const shouldTransformHtml =
      isHtmlResponse && (!isSubRequest || shouldAllowSubrequestHtml(req));

    if (shouldTransformHtml) {
      let html = await upstreamResponse.text();
      const parsedFinal = new URL(finalUrl);
      const proxyBase = buildProxyBase(supabaseUrl, configId, companyId, userId);
      const interceptorScript = buildInterceptorScript(finalUrl, parsedFinal.hostname, proxyBase);
      const baseTag = `<base href="${finalUrl}">`;

      html = html.replace(
        /(<form\b[^>]*\saction=)(["'])([^"']+)\2/gi,
        (match, start, quote, value) => {
          const proxied = toProxiedResource(value.trim(), finalUrl, proxyBase);
          return proxied ? `${start}${quote}${proxied}${quote}` : match;
        }
      );
      html = html.replace(
        /<meta[^>]*http-equiv\s*=\s*["']?(Content-Security-Policy|X-Frame-Options|Permissions-Policy)["']?[^>]*>/gi,
        ""
      );

      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/(<head[^>]*>)/i, `$1${baseTag}${interceptorScript}`);
      } else if (/<html[^>]*>/i.test(html)) {
        html = html.replace(
          /(<html[^>]*>)/i,
          `$1<head>${baseTag}${interceptorScript}</head>`
        );
      } else {
        html = `<html><head>${baseTag}${interceptorScript}</head>${html}</html>`;
      }

      let baseCount = 0;
      html = html.replace(/<base\s[^>]*>/gi, (match) => {
        baseCount += 1;
        return baseCount === 1 ? match : "";
      });

      // Supabase Edge Functions gateway overrides Content-Type to text/plain for HTML
      // and adds restrictive CSP. To bypass this, we return the HTML wrapped in JSON
      // and the client renders it using srcdoc or blob URL.
      if (!isSubRequest) {
        const jsonPayload = JSON.stringify({
          __proxy_html: true,
          html,
          url: finalUrl,
          title: parsedFinal.hostname,
        });
        const jsonHeaders = new Headers(responseCorsHeaders);
        jsonHeaders.set("Content-Type", "application/json; charset=utf-8");
        jsonHeaders.set("Cache-Control", "no-store");
        return new Response(jsonPayload, { status: 200, headers: jsonHeaders });
      }

      // For sub-request HTML (iframes within pages), return directly
      const htmlHeaders = new Headers(responseCorsHeaders);
      htmlHeaders.set("Content-Type", "text/html;charset=utf-8");
      htmlHeaders.set("Cache-Control", "no-store");
      return new Response(html, {
        status: 200,
        headers: htmlHeaders,
      });
    }

    if (isSubRequest && isHtmlResponse && !shouldTransformHtml) {
      return emptySubresourceResponse(req, finalUrl, responseCorsHeaders);
    }

    const responseHeaders = new Headers(responseCorsHeaders);
    responseHeaders.set(
      "Content-Type",
      upstreamContentType || inferSubresourceContentType(req, finalUrl)
    );
    responseHeaders.set(
      "Cache-Control",
      upstreamResponse.headers.get("cache-control") ||
        (isSubRequest ? "no-store" : "public,max-age=3600")
    );

    if (upstreamResponse.status === 204 || upstreamResponse.status === 304) {
      return new Response(null, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    // Para subrequests: si upstream devuelve 4xx/5xx, devolver 204 para no romper scripts
    if (isSubRequest && (upstreamResponse.status >= 400 || upstreamResponse.status === 0)) {
      return emptySubresourceResponse(req, finalUrl, responseCorsHeaders, 204);
    }

    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (isSubRequest) {
      return emptySubresourceResponse(req, targetUrl || req.url, responseCorsHeaders);
    }

    const message = error instanceof Error ? error.message : "Error inesperado";
    return new Response(makeErrorPage("Error", message), {
      status: 200,
      headers: { ...responseCorsHeaders, "Content-Type": "text/html;charset=utf-8" },
    });
  }
});
