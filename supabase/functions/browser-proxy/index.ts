import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function isAllowed(
  url: string,
  domains: string[],
  prefixes: string[],
  blocked: string[],
  httpOk: boolean
): { ok: boolean; why: string; host?: string } {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (["javascript:","data:","file:","blob:","vbscript:"].includes(u.protocol))
      return { ok: false, why: "protocol" };
    if (u.protocol === "http:" && !httpOk)
      return { ok: false, why: "http" };
    if (u.protocol !== "https:" && u.protocol !== "http:")
      return { ok: false, why: "protocol" };
    for (const p of blocked) if (url.includes(p)) return { ok: false, why: "blocked", host: h };
    for (const p of prefixes) if (url.startsWith(p)) return { ok: true, why: "ok" };
    for (const d of domains) {
      const dl = d.toLowerCase().trim();
      if (h === dl || h.endsWith("." + dl)) return { ok: true, why: "ok" };
    }
    return { ok: false, why: "domain", host: h };
  } catch { return { ok: false, why: "invalid" }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(sbUrl, sbKey);
    const p = new URL(req.url).searchParams;
    const tgt = p.get("url") || "";
    const cid = p.get("config_id") || "";
    const coid = p.get("company_id") || "";
    const uid = p.get("user_id") || "";

    const errPage = function(t: string, d: string) {
      return '<html><head><meta charset="utf-8"></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0"><div style="text-align:center"><div style="font-size:3rem">\\u{1F6E1}</div><h2>' + t + '</h2><p style="color:#999">' + d + '</p></div></body></html>';
    };

    if (!tgt || !cid || !coid)
      return new Response(errPage("Error", "Params incompletos"), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "text/html;charset=utf-8" }
      });

    const { data: cfg } = await sb.from("browser_configs").select("*")
      .eq("id", cid).eq("company_id", coid).eq("enabled", true).single();

    if (!cfg)
      return new Response(errPage("No configurado", "Contacta al admin"), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "text/html;charset=utf-8" }
      });

    const chk = isAllowed(tgt, cfg.allowed_domains||[], cfg.allowed_url_prefixes||[], cfg.blocked_url_patterns||[], cfg.allow_http||false);

    sb.from("browser_audit_logs").insert({
      company_id: coid, user_id: uid||"anon", browser_config_id: cid,
      action: chk.ok ? "NAVIGATE_ALLOWED" : "NAVIGATE_BLOCKED", url: tgt, reason: chk.why
    });

    if (!chk.ok)
      return new Response(errPage("Bloqueado", (chk.host||tgt) + " no permitido"), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "text/html;charset=utf-8" }
      });

    const res = await fetch(tgt, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    const fUrl = res.url;
    if (fUrl !== tgt) {
      const rc = isAllowed(fUrl, cfg.allowed_domains||[], cfg.allowed_url_prefixes||[], cfg.blocked_url_patterns||[], cfg.allow_http||false);
      if (!rc.ok) {
        sb.from("browser_audit_logs").insert({ company_id: coid, user_id: uid||"anon", browser_config_id: cid, action: "NAVIGATE_BLOCKED", url: fUrl, reason: "redirect" });
        return new Response(errPage("Redireccion bloqueada", (rc.host||fUrl)+" no permitido"), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "text/html;charset=utf-8" }
        });
      }
    }

    const ct = (res.headers.get("content-type")||"").toLowerCase();

    if (ct.includes("text/html") || ct.includes("xhtml")) {
      let html = await res.text();
      const pu = new URL(fUrl);

      // Script interceptor: usa postMessage para navegacion
      const scr = '<script>(function(){' +
        'var CU=' + JSON.stringify(fUrl) + ';' +
        'function rv(h){if(!h)return null;if(h.charAt(0)==="#"||h.indexOf("javascript:")===0||h.indexOf("mailto:")===0||h.indexOf("data:")===0)return null;try{return new URL(h,CU).href}catch(e){return null}}' +
        'document.addEventListener("click",function(e){var a=e.target;while(a&&a.tagName!=="A")a=a.parentElement;if(!a||!a.href)return;var r=rv(a.getAttribute("href"));if(!r)return;e.preventDefault();e.stopPropagation();window.parent.postMessage({type:"proxy-nav",url:r},"*")},true);' +
        'document.addEventListener("submit",function(e){var f=e.target;var ac=f.getAttribute("action")||CU;var r=rv(ac);if(!r)return;e.preventDefault();if(f.method&&f.method.toLowerCase()==="post"){window.parent.postMessage({type:"proxy-nav",url:r},"*")}else{var fd=new FormData(f);var q=new URLSearchParams(fd).toString();window.parent.postMessage({type:"proxy-nav",url:r+(r.indexOf("?")>-1?"&":"?")+q},"*")}},true);' +
        'window.open=function(u){if(u){var r=rv(u);if(r)window.parent.postMessage({type:"proxy-nav",url:r},"*")}return null};' +
        'try{window.parent.postMessage({type:"proxy-title",title:document.title||' + JSON.stringify(pu.hostname) + ',url:CU},"*")}catch(x){}' +
        'try{new MutationObserver(function(){window.parent.postMessage({type:"proxy-title",title:document.title,url:CU},"*")}).observe(document.querySelector("title")||document.head,{childList:true,subtree:true,characterData:true})}catch(x){}' +
      '})()<\/script>';

      var base = '<base href="' + fUrl + '">';

      // Limpiar CSP y X-Frame-Options meta tags
      html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?(Content-Security-Policy|X-Frame-Options)["']?[^>]*>/gi, "");

      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/(<head[^>]*>)/i, '$1' + base + scr);
      } else if (/<html[^>]*>/i.test(html)) {
        html = html.replace(/(<html[^>]*>)/i, '$1<head>' + base + scr + '</head>');
      } else {
        html = '<html><head>' + base + scr + '</head>' + html + '</html>';
      }

      // Quitar bases duplicadas
      var bc = 0;
      html = html.replace(/<base\s[^>]*>/gi, function(m){ bc++; return bc<=1?m:''; });

      return new Response(html, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html;charset=utf-8", "Cache-Control": "no-store" }
      });
    }

    // Non-HTML pass through
    return new Response(await res.arrayBuffer(), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": ct, "Cache-Control": "public,max-age=3600" }
    });
  } catch (err) {
    return new Response('<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0"><div style="text-align:center"><h2>Error</h2><p style="color:#999">' + err.message + '</p></div></body></html>', {
      status: 200, headers: { ...corsHeaders, "Content-Type": "text/html;charset=utf-8" }
    });
  }
});
