import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    if (["javascript:", "data:", "file:", "blob:", "vbscript:"].includes(parsed.protocol)) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get params from query string (for GET/iframe src) or body (for POST)
    let targetUrl: string;
    let browserConfigId: string;
    let companyId: string;
    let userId: string;

    if (req.method === "GET") {
      const params = new URL(req.url).searchParams;
      targetUrl = params.get("url") || "";
      browserConfigId = params.get("config_id") || "";
      companyId = params.get("company_id") || "";
      userId = params.get("user_id") || "";
    } else {
      const body = await req.json();
      targetUrl = body.url || "";
      browserConfigId = body.browser_config_id || "";
      companyId = body.company_id || "";
      userId = body.user_id || "";
    }

    if (!targetUrl || !browserConfigId || !companyId) {
      return new Response(
        JSON.stringify({ error: "Missing required params: url, config_id, company_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch browser config
    const { data: config, error: configError } = await supabase
      .from("browser_configs")
      .select("*")
      .eq("id", browserConfigId)
      .eq("company_id", companyId)
      .eq("enabled", true)
      .single();

    if (configError || !config) {
      return new Response(
        `<html><body><h2>Browser not configured</h2></body></html>`,
        { status: 403, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    const result = isAllowedUrl(
      targetUrl,
      config.allowed_domains || [],
      config.allowed_url_prefixes || [],
      config.blocked_url_patterns || [],
      config.allow_http || false
    );

    // Log the navigation attempt
    await supabase.from("browser_audit_logs").insert({
      company_id: companyId,
      user_id: userId || "anonymous",
      browser_config_id: browserConfigId,
      action: result.allowed ? "NAVIGATE_ALLOWED" : "NAVIGATE_BLOCKED",
      url: targetUrl,
      reason: result.reason,
    });

    if (!result.allowed) {
      return new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; color: #333; }
          .container { text-align: center; padding: 2rem; }
          .icon { font-size: 3rem; margin-bottom: 1rem; }
          h2 { margin: 0.5rem 0; }
          p { color: #666; font-size: 0.9rem; }
        </style></head><body><div class="container">
          <div class="icon">🛡️</div>
          <h2>Sitio no permitido</h2>
          <p>${result.reason === "domain_not_allowed" ? "Este dominio no está en la lista de sitios permitidos." :
            result.reason === "http_not_allowed" ? "Solo se permiten conexiones HTTPS." :
            result.reason === "blocked_pattern_match" ? "Esta URL ha sido bloqueada por el administrador." :
            "No tienes permiso para acceder a este sitio."}</p>
          <p style="margin-top: 1rem; font-size: 0.8rem;">Contacta al administrador si necesitas acceso.</p>
        </div></body></html>`,
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Fetch the actual page content
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
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
          browser_config_id: browserConfigId,
          action: "NAVIGATE_BLOCKED",
          url: finalUrl,
          reason: "redirect_to_blocked_domain",
        });
        return new Response(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; color: #333; }
            .container { text-align: center; padding: 2rem; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h2 { margin: 0.5rem 0; }
            p { color: #666; font-size: 0.9rem; }
          </style></head><body><div class="container">
            <div class="icon">🔄</div>
            <h2>Redirección bloqueada</h2>
            <p>El sitio redirigió a un dominio no permitido.</p>
          </div></body></html>`,
          { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
        );
      }
    }

    const contentType = response.headers.get("content-type") || "";

    // For HTML content, inject base tag and return
    if (contentType.includes("text/html")) {
      let html = await response.text();

      // Determine the base URL for relative resources
      const parsedFinal = new URL(finalUrl);
      const baseUrl = `${parsedFinal.protocol}//${parsedFinal.host}`;

      // Inject <base> tag right after <head> to resolve relative URLs
      const baseTag = `<base href="${baseUrl}/" target="_self">`;
      if (html.includes("<head>")) {
        html = html.replace("<head>", `<head>${baseTag}`);
      } else if (html.includes("<HEAD>")) {
        html = html.replace("<HEAD>", `<HEAD>${baseTag}`);
      } else {
        html = baseTag + html;
      }

      return new Response(html, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          // Remove any frame-blocking headers
          "X-Frame-Options": "ALLOWALL",
        },
      });
    }

    // For non-HTML content, pass through as-is
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; color: #333; }
        .container { text-align: center; padding: 2rem; }
        h2 { margin: 0.5rem 0; }
        p { color: #666; font-size: 0.9rem; }
      </style></head><body><div class="container">
        <h2>Error de conexión</h2>
        <p>No se pudo cargar el sitio solicitado.</p>
        <p style="font-size: 0.75rem; color: #999;">${error.message}</p>
      </div></body></html>`,
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});
