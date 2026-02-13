import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function isAllowedUrl(
  url: string,
  allowedDomains: string[],
  allowedPrefixes: string[],
  blockedPatterns: string[],
  allowHttp: boolean
): { allowed: boolean; reason: string } {
  try {
    const parsed = new URL(url);
    if (
      ["javascript:", "data:", "file:", "blob:", "vbscript:"].includes(
        parsed.protocol
      )
    ) {
      return { allowed: false, reason: "protocol_not_allowed" };
    }
    if (parsed.protocol === "http:" && !allowHttp) {
      return { allowed: false, reason: "http_not_allowed" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { allowed: false, reason: "protocol_not_allowed" };
    }
    for (const pattern of blockedPatterns) {
      if (url.includes(pattern)) {
        return { allowed: false, reason: "blocked_pattern_match" };
      }
    }
    const hostname = parsed.hostname.toLowerCase();
    for (const domain of allowedDomains) {
      const d = domain.toLowerCase().trim();
      if (hostname === d || hostname.endsWith("." + d)) {
        return { allowed: true, reason: "allowed" };
      }
    }
    for (const prefix of allowedPrefixes) {
      if (url.startsWith(prefix)) {
        return { allowed: true, reason: "allowed" };
      }
    }
    return { allowed: false, reason: "domain_not_allowed" };
  } catch {
    return { allowed: false, reason: "invalid_url" };
  }
}

function blockedHtml(message: string, detail: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0}
    .c{text-align:center;padding:2rem}.icon{font-size:3rem;margin-bottom:1rem}h2{margin:.5rem 0}p{color:#999;font-size:.9rem}
  </style></head><body><div class="c"><div class="icon">🛡️</div><h2>${message}</h2><p>${detail}</p></div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const params = new URL(req.url).searchParams;
    const targetUrl = params.get("url") || "";
    const configId = params.get("config_id") || "";
    const companyId = params.get("company_id") || "";
    const userId = params.get("user_id") || "";

    if (!targetUrl || !configId || !companyId) {
      return new Response(blockedHtml("Error", "Parámetros incompletos."), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Fetch browser config
    const { data: config, error: configError } = await supabase
      .from("browser_configs")
      .select("*")
      .eq("id", configId)
      .eq("company_id", companyId)
      .eq("enabled", true)
      .single();

    if (configError || !config) {
      return new Response(
        blockedHtml("Navegador no configurado", "Contacta al administrador."),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8",
          },
        }
      );
    }

    // Validate URL
    const result = isAllowedUrl(
      targetUrl,
      config.allowed_domains || [],
      config.allowed_url_prefixes || [],
      config.blocked_url_patterns || [],
      config.allow_http || false
    );

    // Log navigation
    await supabase.from("browser_audit_logs").insert({
      company_id: companyId,
      user_id: userId || "anonymous",
      browser_config_id: configId,
      action: result.allowed ? "NAVIGATE_ALLOWED" : "NAVIGATE_BLOCKED",
      url: targetUrl,
      reason: result.reason,
    });

    if (!result.allowed) {
      const detail =
        result.reason === "domain_not_allowed"
          ? "Este dominio no está en la lista de sitios permitidos."
          : result.reason === "http_not_allowed"
          ? "Solo se permiten conexiones HTTPS."
          : result.reason === "blocked_pattern_match"
          ? "Esta URL ha sido bloqueada por el administrador."
          : "No tienes permiso para acceder a este sitio.";
      return new Response(blockedHtml("Sitio no permitido", detail), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Fetch the target page
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    });

    // Validate final URL after redirects
    const finalUrl = response.url;
    if (finalUrl !== targetUrl) {
      const redirectResult = isAllowedUrl(
        finalUrl,
        config.allowed_domains || [],
        config.allowed_url_prefixes || [],
        config.blocked_url_patterns || [],
        config.allow_http || false
      );
      if (!redirectResult.allowed) {
        await supabase.from("browser_audit_logs").insert({
          company_id: companyId,
          user_id: userId || "anonymous",
          browser_config_id: configId,
          action: "NAVIGATE_BLOCKED",
          url: finalUrl,
          reason: "redirect_to_blocked_domain",
        });
        return new Response(
          blockedHtml(
            "Redirección bloqueada",
            "El sitio redirigió a un dominio no permitido."
          ),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "text/html; charset=utf-8",
            },
          }
        );
      }
    }

    const contentType = response.headers.get("content-type") || "";

    // For HTML content, rewrite and serve
    if (contentType.includes("text/html")) {
      let html = await response.text();

      const parsedFinal = new URL(finalUrl);
      const origin = `${parsedFinal.protocol}//${parsedFinal.host}`;

      // Build the proxy base URL for link interception
      const proxyBase = `${supabaseUrl}/functions/v1/browser-proxy?config_id=${encodeURIComponent(configId)}&company_id=${encodeURIComponent(companyId)}&user_id=${encodeURIComponent(userId)}&url=`;

      // Inject <base> tag for relative resource resolution (images, css, js load directly from origin)
      const baseTag = `<base href="${origin}${parsedFinal.pathname.replace(/\/[^/]*$/, "/")}">`;

      // Navigation interceptor script - catches link clicks and form submissions
      const interceptorScript = `
<script>
(function(){
  var proxyBase = ${JSON.stringify(proxyBase)};
  var currentOrigin = ${JSON.stringify(origin)};

  function resolveUrl(href) {
    if (!href) return null;
    if (href.startsWith('javascript:') || href.startsWith('data:') || href.startsWith('blob:') || href.startsWith('#') || href.startsWith('mailto:')) return null;
    try {
      var u = new URL(href, currentOrigin);
      return u.href;
    } catch(e) { return null; }
  }

  function proxyUrl(url) {
    return proxyBase + encodeURIComponent(url);
  }

  // Intercept link clicks
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el || !el.href) return;
    var resolved = resolveUrl(el.getAttribute('href'));
    if (!resolved) return;
    e.preventDefault();
    e.stopPropagation();
    // Navigate the iframe to the proxied URL
    window.location.href = proxyUrl(resolved);
  }, true);

  // Intercept form submissions
  document.addEventListener('submit', function(e) {
    var form = e.target;
    var action = form.getAttribute('action') || window.location.href;
    var resolved = resolveUrl(action);
    if (!resolved) return;
    e.preventDefault();
    if (form.method && form.method.toLowerCase() === 'post') {
      // For POST forms, redirect to GET with action URL proxied
      window.location.href = proxyUrl(resolved);
    } else {
      var fd = new FormData(form);
      var qs = new URLSearchParams(fd).toString();
      var sep = resolved.includes('?') ? '&' : '?';
      window.location.href = proxyUrl(resolved + sep + qs);
    }
  }, true);

  // Intercept window.open
  var origOpen = window.open;
  window.open = function(url) {
    if (url) {
      var resolved = resolveUrl(url);
      if (resolved) {
        window.location.href = proxyUrl(resolved);
        return null;
      }
    }
    return null;
  };

  // Intercept location changes via meta refresh or JS
  // Override location.assign and location.replace
  var origAssign = window.location.assign;
  var origReplace = window.location.replace;

  try {
    Object.defineProperty(window.location, 'assign', {
      value: function(url) {
        var resolved = resolveUrl(url);
        if (resolved) origAssign.call(window.location, proxyUrl(resolved));
        else origAssign.call(window.location, url);
      }
    });
    Object.defineProperty(window.location, 'replace', {
      value: function(url) {
        var resolved = resolveUrl(url);
        if (resolved) origReplace.call(window.location, proxyUrl(resolved));
        else origReplace.call(window.location, url);
      }
    });
  } catch(e) {}

  // Notify parent about current URL for address bar sync
  try {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'browser-proxy-navigate',
        url: ${JSON.stringify(finalUrl)},
        title: document.title || ${JSON.stringify(parsedFinal.hostname)}
      }, '*');
      // Also send title when it changes
      new MutationObserver(function() {
        window.parent.postMessage({
          type: 'browser-proxy-navigate',
          url: ${JSON.stringify(finalUrl)},
          title: document.title
        }, '*');
      }).observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true });
    }
  } catch(e) {}
})();
</script>`;

      // Remove CSP meta tags that might block our script
      html = html.replace(
        /<meta[^>]*http-equiv\s*=\s*["']?Content-Security-Policy["']?[^>]*>/gi,
        ""
      );

      // Inject our script and base tag
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(
          /(<head[^>]*>)/i,
          `$1${baseTag}${interceptorScript}`
        );
      } else if (/<html[^>]*>/i.test(html)) {
        html = html.replace(
          /(<html[^>]*>)/i,
          `$1<head>${baseTag}${interceptorScript}</head>`
        );
      } else {
        html = `<head>${baseTag}${interceptorScript}</head>` + html;
      }

      // Remove any existing <base> tags (except ours)
      // Our base tag is already injected, remove duplicates
      const baseRegex = /<base\s[^>]*>/gi;
      let firstBase = true;
      html = html.replace(baseRegex, (match) => {
        if (firstBase) {
          firstBase = false;
          return match; // keep our injected one
        }
        return ""; // remove duplicates
      });

      return new Response(html, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "X-Frame-Options": "ALLOWALL",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // For non-HTML content (images, CSS, JS, etc.), pass through
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return new Response(
      blockedHtml("Error de conexión", `No se pudo cargar el sitio. ${error.message}`),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
});
