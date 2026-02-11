import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    // Block dangerous protocols
    if (["javascript:", "data:", "file:", "blob:", "vbscript:"].includes(parsed.protocol)) {
      return { allowed: false, reason: "protocol_not_allowed" };
    }

    // Only allow https (and http if explicitly enabled)
    if (parsed.protocol === "http:" && !allowHttp) {
      return { allowed: false, reason: "http_not_allowed" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { allowed: false, reason: "protocol_not_allowed" };
    }

    // Check blocked patterns
    for (const pattern of blockedPatterns) {
      if (url.includes(pattern)) {
        return { allowed: false, reason: "blocked_pattern_match" };
      }
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check exact domain match
    for (const domain of allowedDomains) {
      const d = domain.toLowerCase().trim();
      if (hostname === d || hostname.endsWith("." + d)) {
        // If there are prefix restrictions, also check those
        if (allowedPrefixes.length > 0) {
          for (const prefix of allowedPrefixes) {
            if (url.startsWith(prefix)) {
              return { allowed: true, reason: "allowed" };
            }
          }
          // Domain matched but no prefix matched - still allow if domain is in list
          // (prefixes are additive, not restrictive when domains are set)
        }
        return { allowed: true, reason: "allowed" };
      }
    }

    // Check URL prefixes (these implicitly allow the domain)
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

    const { url, browser_config_id, company_id, user_id } = await req.json();

    if (!url || !browser_config_id || !company_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: url, browser_config_id, company_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch browser config
    const { data: config, error: configError } = await supabase
      .from("browser_configs")
      .select("*")
      .eq("id", browser_config_id)
      .eq("company_id", company_id)
      .eq("enabled", true)
      .single();

    if (configError || !config) {
      // Log blocked
      await supabase.from("browser_audit_logs").insert({
        company_id,
        user_id: user_id || "anonymous",
        browser_config_id,
        action: "NAVIGATE_BLOCKED",
        url,
        reason: "config_not_found_or_disabled",
      });

      return new Response(
        JSON.stringify({ allowed: false, reason: "browser_not_configured" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = isAllowedUrl(
      url,
      config.allowed_domains || [],
      config.allowed_url_prefixes || [],
      config.blocked_url_patterns || [],
      config.allow_http || false
    );

    // Log the navigation attempt
    await supabase.from("browser_audit_logs").insert({
      company_id,
      user_id: user_id || "anonymous",
      browser_config_id,
      action: result.allowed ? "NAVIGATE_ALLOWED" : "NAVIGATE_BLOCKED",
      url,
      reason: result.reason,
    });

    if (!result.allowed) {
      return new Response(
        JSON.stringify({ allowed: false, reason: result.reason }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ allowed: true, url, reason: "allowed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
