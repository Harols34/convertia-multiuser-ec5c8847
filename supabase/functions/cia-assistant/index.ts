import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Config = {
  id: string;
  enabled: boolean;
  bot_name: string;
  initial_message: string;
  allow_free_text: boolean;
  use_guided_menu: boolean;
  temperature: number;
  max_tokens: number;
  unknown_message: string;
  unauthorized_message: string;
  system_prompt: string;
  data_scope: string;
  tools: Record<string, boolean>;
  visible_application_ids: string[];
  company_id: string | null;
  campaign: string | null;
  role_key: string | null;
};

/** Resolves identity strictly from the server side. */
async function resolveUser(userId?: string, accessCode?: string) {
  let q = supabase
    .from("end_users")
    .select(
      "id, full_name, document_number, company_id, campaign, bot_role, active, access_role_id, companies(name), access_roles(name, label, can_create_tickets, can_view_all_company_tickets)",
    )
    .eq("active", true);
  if (userId) q = q.eq("id", userId);
  else if (accessCode) q = q.eq("access_code", accessCode);
  else return null;
  const { data } = await q.maybeSingle();
  return data as any;
}

/** Permiso real de creación de solicitudes: manda el rol de acceso del portal. */
function canCreateRequests(user: any): boolean {
  const role = user?.access_roles;
  if (role) return role.can_create_tickets === true;
  return user?.bot_role === "staff";
}

/** Global config < company < company+campaign < company+campaign+role */
async function resolveConfig(user: any): Promise<Config | null> {
  const { data } = await supabase.from("cia_configs").select("*");
  if (!data || data.length === 0) return null;
  const matches = (data as any[]).filter((c) => {
    if (c.company_id && c.company_id !== user.company_id) return false;
    if (c.campaign && c.campaign !== user.campaign) return false;
    if (c.role_key && c.role_key !== user.bot_role) return false;
    return true;
  });
  const score = (c: any) =>
    (c.company_id ? 4 : 0) + (c.campaign ? 2 : 0) + (c.role_key ? 1 : 0);
  matches.sort((a, b) => score(b) - score(a));
  const best = matches[0];
  if (!best) return null;
  const global = (data as any[]).find((c) => !c.company_id && !c.campaign && !c.role_key);
  // merge system prompt: global + specific
  const merged = { ...best } as Config;
  if (global && global.id !== best.id) {
    merged.system_prompt = [global.system_prompt, best.system_prompt].filter(Boolean).join("\n\n");
  }
  return merged;
}

/** Never selects password fields. */
async function getUserApps(user: any, cfg: Config) {
  const { data } = await supabase
    .from("user_applications")
    .select(
      "id, username, notes, credential_created_at, last_password_change, credential_expires_at, credential_notes, global_application_id, application_id, global_applications(id, name, description, url), company_applications(id, name, description, url)",
    )
    .eq("end_user_id", user.id);

  let apps = (data ?? []).map((r: any) => ({
    id: r.id,
    app_id: r.global_applications?.id ?? r.company_applications?.id ?? null,
    application: r.global_applications?.name ?? r.company_applications?.name ?? "Aplicativo",
    url: r.global_applications?.url ?? r.company_applications?.url ?? null,
    username: r.username,
    estado: r.username ? "Activo" : "Sin credencial",
    creado: r.credential_created_at,
    ultimo_cambio: r.last_password_change,
    expira: r.credential_expires_at,
    notas: r.credential_notes ?? r.notes,
  }));

  const visible = cfg.visible_application_ids ?? [];
  if (visible.length > 0) {
    apps = apps.filter((a) => a.app_id && visible.includes(a.app_id));
  }
  return apps;
}

async function getAlarms(user: any) {
  const { data } = await supabase
    .from("alarms")
    .select("id, title, description, status, priority, created_at, updated_at, responded_at, resolved_at")
    .eq("end_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []).map((a: any, i: number) => ({ ...a, numero: `#${String(i + 1).padStart(3, "0")}` }));
}

async function getAlarmDetail(user: any, alarmId: string) {
  const { data: alarm } = await supabase
    .from("alarms")
    .select("id, title, description, status, priority, created_at, updated_at, responded_at, resolved_at, end_user_id")
    .eq("id", alarmId)
    .maybeSingle();
  // Hard isolation: never return another user's case
  if (!alarm || alarm.end_user_id !== user.id) return null;
  const { data: comments } = await supabase
    .from("alarm_comments")
    .select("comment, created_at")
    .eq("alarm_id", alarmId)
    .order("created_at", { ascending: true });
  return { ...alarm, comments: comments ?? [] };
}

/** Real resolution/response statistics computed from the database. */
async function getResolutionStats(user: any) {
  const { data: ids } = await supabase
    .from("end_users")
    .select("id")
    .eq("company_id", user.company_id)
    .limit(2000);
  const userIds = (ids ?? []).map((r: any) => r.id);
  if (userIds.length === 0) return null;

  const { data } = await supabase
    .from("alarms")
    .select("id, status, created_at, responded_at, resolved_at, resolution_time_minutes, end_user_id")
    .in("end_user_id", userIds)
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows = data ?? [];
  const avg = (list: number[]) =>
    list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : null;

  const resolutionMin = rows
    .filter((a: any) => a.resolution_time_minutes)
    .map((a: any) => Number(a.resolution_time_minutes));
  const responseMin = rows
    .filter((a: any) => a.responded_at)
    .map((a: any) => (new Date(a.responded_at).getTime() - new Date(a.created_at).getTime()) / 60000);

  const mine = rows.filter((a: any) => a.end_user_id === user.id);
  const mineResolution = mine
    .filter((a: any) => a.resolution_time_minutes)
    .map((a: any) => Number(a.resolution_time_minutes));

  const toHours = (m: number | null) => (m === null ? null : Math.round((m / 60) * 10) / 10);

  return {
    total_casos_empresa: rows.length,
    abiertos: rows.filter((a: any) => a.status !== "cerrada" && a.status !== "resuelta").length,
    promedio_resolucion_horas: toHours(avg(resolutionMin)),
    promedio_primera_respuesta_horas: toHours(avg(responseMin)),
    promedio_resolucion_mis_casos_horas: toHours(avg(mineResolution)),
    nota: "Promedios calculados con los datos reales registrados en la plataforma.",
  };
}

async function getSla(user: any) {
  const { data } = await supabase
    .from("cia_sla")
    .select("application_name, novelty_type, min_days, max_days, notes, company_id, campaign")
    .eq("active", true);
  return (data ?? []).filter(
    (s: any) =>
      (!s.company_id || s.company_id === user.company_id) &&
      (!s.campaign || s.campaign === user.campaign),
  );
}

async function getKnowledge(user: any, category?: string, query?: string) {
  const { data } = await supabase
    .from("cia_knowledge")
    .select("title, content, category, tags, roles, company_id, campaign")
    .eq("active", true);
  let items = (data ?? []).filter(
    (k: any) =>
      (!k.company_id || k.company_id === user.company_id) &&
      (!k.campaign || k.campaign === user.campaign) &&
      (!k.roles?.length || k.roles.includes(user.bot_role)),
  );
  if (category) items = items.filter((k: any) => k.category === category);
  if (query) {
    const q = query.toLowerCase();
    const scored = items
      .map((k: any) => ({
        k,
        s:
          (k.title.toLowerCase().includes(q) ? 3 : 0) +
          (k.content.toLowerCase().includes(q) ? 2 : 0) +
          (k.tags ?? []).filter((t: string) => q.includes(t.toLowerCase())).length,
      }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    items = scored.length ? scored.slice(0, 6).map((x) => x.k) : items.slice(0, 6);
  }
  return items.slice(0, 12);
}

function buildMenu(cfg: Config) {
  const t = cfg.tools ?? {};
  const items: { key: string; label: string; icon: string }[] = [];
  if (t.credentials) items.push({ key: "credentials", label: "Mis accesos", icon: "🔐" });
  if (t.my_alarms) items.push({ key: "alarms", label: "Mis novedades", icon: "🔎" });
  if (t.sla) items.push({ key: "sla", label: "Tiempos de atención", icon: "⏱" });
  if (t.guidance) items.push({ key: "guidance", label: "Orientación de uso", icon: "📚" });
  if (t.tips) items.push({ key: "tips", label: "Tips para evitar bloqueos", icon: "💡" });
  if (t.create_alarm) items.push({ key: "create_alarm", label: "Reportar una novedad", icon: "📝" });
  return items;
}

/** Staff-only: users of the same company (never passwords). */
async function getStaffUsers(user: any, search?: string) {
  let q = supabase
    .from("end_users")
    .select("id, full_name, document_number, email, phone, campaign, bot_role, active, created_at")
    .eq("company_id", user.company_id)
    .order("full_name", { ascending: true })
    .limit(200);
  const s = (search ?? "").trim();
  if (s) q = q.or(`document_number.ilike.%${s}%,full_name.ilike.%${s}%,email.ilike.%${s}%`);
  const { data } = await q;
  return data ?? [];
}

async function getStaffUserDetail(user: any, search: string) {
  const list = await getStaffUsers(user, search);
  const target = list[0];
  if (!target) return null;
  const { data: apps } = await supabase
    .from("user_applications")
    .select(
      "id, username, credential_created_at, last_password_change, credential_expires_at, global_applications(name), company_applications(name)",
    )
    .eq("end_user_id", target.id);
  const { data: alarms } = await supabase
    .from("alarms")
    .select("id, title, status, created_at, updated_at, resolved_at")
    .eq("end_user_id", target.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return {
    usuario: {
      nombre: target.full_name,
      documento: target.document_number,
      email: target.email,
      telefono: target.phone,
      campana: target.campaign,
      rol: target.bot_role,
      activo: target.active,
    },
    aplicativos: (apps ?? []).map((a: any) => ({
      application: a.global_applications?.name ?? a.company_applications?.name ?? "Aplicativo",
      username: a.username,
      estado: a.username ? "Activo" : "Sin credencial",
      ultimo_cambio: a.last_password_change,
      expira: a.credential_expires_at,
    })),
    novedades: alarms ?? [],
  };
}

async function callAI(
  cfg: Config,
  user: any,
  contextData: unknown,
  question: string,
  history: { role: string; content: string }[] = [],
) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { error: "missing_key", text: cfg.unknown_message };

  const isStaff = user.bot_role === "staff";
  const system = [
    cfg.system_prompt,
    `Nombre del asistente: ${cfg.bot_name}.`,
    `Usuario autenticado: ${user.full_name} (documento ${user.document_number}), empresa: ${user.companies?.name ?? ""}, campaña: ${user.campaign ?? "N/A"}, rol: ${user.bot_role}.`,
    "REGLAS ESTRICTAS: usa únicamente el CONTEXTO DE DATOS entregado. Nunca inventes usuarios, casos, fechas, estados ni tiempos. Nunca muestres ni pidas contraseñas.",
    isStaff
      ? "Este usuario es STAFF: puede consultar la información de los usuarios de su empresa incluida en el contexto (nombre, documento, correo, campaña, aplicativos, novedades), NUNCA contraseñas. Si te piden un listado de usuarios, respóndelo en una tabla markdown."
      : `Si te preguntan por otro colaborador o por datos fuera del contexto responde exactamente: "${cfg.unauthorized_message}"`,
    "Recuerda y usa el historial de esta conversación para dar continuidad.",
    `Si no encuentras el dato responde exactamente: "${cfg.unknown_message}"`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      temperature: Number(cfg.temperature ?? 0.3),
      max_tokens: Number(cfg.max_tokens ?? 800),
      messages: [
        { role: "system", content: system },
        ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
        {
          role: "user",
          content: `CONTEXTO DE DATOS (real, de la base de datos):\n${JSON.stringify(contextData)}\n\nPREGUNTA DEL USUARIO:\n${question}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { error: `ai_${res.status}`, status: res.status, text: body };
  }
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content ?? cfg.unknown_message };
}

/** Conversation helpers — always scoped to the authenticated end user. */
async function listConversations(userId: string) {
  const { data } = await supabase
    .from("cia_conversations")
    .select("id, title, created_at, updated_at")
    .eq("end_user_id", userId)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

async function getConversation(userId: string, conversationId: string) {
  const { data: conv } = await supabase
    .from("cia_conversations")
    .select("id, title, end_user_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv || conv.end_user_id !== userId) return null;
  const { data: msgs } = await supabase
    .from("cia_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  return { id: conv.id, title: conv.title, messages: msgs ?? [] };
}

async function ensureConversation(userId: string, conversationId: string | undefined, firstMessage: string) {
  if (conversationId) {
    const owned = await getConversation(userId, conversationId);
    if (owned) return owned.id;
  }
  const title = firstMessage.trim().slice(0, 60) || "Nueva conversación";
  const { data } = await supabase
    .from("cia_conversations")
    .insert({ end_user_id: userId, title })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

async function saveMessages(conversationId: string, pairs: { role: string; content: string }[]) {
  try {
    await supabase
      .from("cia_messages")
      .insert(pairs.map((p) => ({ conversation_id: conversationId, role: p.role, content: p.content })));
    await supabase
      .from("cia_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  } catch (_) {
    // logging must never break the assistant
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, userId, accessCode } = body ?? {};

    const user = await resolveUser(userId, accessCode);
    if (!user) return json({ error: "unauthorized" }, 401);

    const cfg = await resolveConfig(user);
    if (!cfg || !cfg.enabled) return json({ enabled: false }, 200);

    const isStaff = user.bot_role === "staff";

    if (action === "context") {
      const apps = await getUserApps(user, cfg);
      const menu = buildMenu(cfg);
      if (isStaff) {
        menu.push({ key: "staff_users", label: "Usuarios a mi cargo", icon: "👥" });
        menu.push({ key: "staff_search", label: "Buscar usuario", icon: "🔍" });
      }
      return json({
        enabled: true,
        config: {
          bot_name: cfg.bot_name,
          initial_message: cfg.initial_message,
          allow_free_text: cfg.allow_free_text !== false,
          use_guided_menu: cfg.use_guided_menu,
        },
        user: { name: user.full_name, company: user.companies?.name ?? null, role: user.bot_role },
        menu,
        applications: apps.map((a) => ({ id: a.app_id, name: a.application })),
      });
    }

    if (action === "conversations") {
      return json({ data: await listConversations(user.id) });
    }

    if (action === "conversation") {
      const conv = await getConversation(user.id, String(body.conversationId ?? ""));
      if (!conv) return json({ error: "not_found" }, 404);
      return json({ data: conv });
    }

    if (action === "delete_conversation") {
      const conv = await getConversation(user.id, String(body.conversationId ?? ""));
      if (!conv) return json({ error: "not_found" }, 404);
      await supabase.from("cia_conversations").update({ archived: true }).eq("id", conv.id);
      return json({ ok: true });
    }

    if (action === "tool") {
      const tool = String(body.tool ?? "");
      const t = cfg.tools ?? {};
      const allowed: Record<string, boolean> = {
        credentials: !!t.credentials,
        alarms: !!t.my_alarms,
        alarm_detail: !!t.alarm_detail,
        sla: !!t.sla,
        guidance: !!t.guidance,
        tips: !!t.tips,
        staff_users: isStaff,
      };
      if (!allowed[tool]) return json({ error: "tool_not_allowed", message: cfg.unauthorized_message }, 403);

      const toolLabels: Record<string, string> = {
        credentials: "Mis accesos",
        alarms: "Mis novedades",
        alarm_detail: "Detalle de novedad",
        sla: "Tiempos de atención",
        guidance: "Orientación de uso",
        tips: "Tips para evitar bloqueos",
        staff_users: "Usuarios a mi cargo",
      };

      let data: unknown = null;
      if (tool === "credentials") {
        const apps = await getUserApps(user, cfg);
        const appId = body.applicationId;
        data = appId ? apps.filter((a) => a.app_id === appId) : apps;
      } else if (tool === "alarms") {
        data = await getAlarms(user);
      } else if (tool === "alarm_detail") {
        const detail = await getAlarmDetail(user, String(body.alarmId));
        if (!detail) return json({ error: "not_found", message: cfg.unauthorized_message }, 404);
        data = { ...detail, sla: await getSla(user) };
      } else if (tool === "sla") {
        const all = await getSla(user);
        const appName = body.applicationName ? String(body.applicationName) : "";
        data = appName
          ? all.filter((s: any) => (s.application_name ?? "").toLowerCase() === appName.toLowerCase())
          : all;
      } else if (tool === "guidance") {
        data = await getKnowledge(user, "orientacion");
      } else if (tool === "tips") {
        data = await getKnowledge(user, "tips");
      } else if (tool === "staff_users") {
        data = await getStaffUsers(user, body.search ? String(body.search) : undefined);
      } else {
        return json({ error: "invalid_tool" }, 400);
      }

      // Persist the interaction so administrators can audit the full conversation.
      const label = toolLabels[tool] ?? tool;
      const convId = await ensureConversation(user.id, body.conversationId, label);
      if (convId) {
        await saveMessages(convId, [
          { role: "user", content: label },
          { role: "assistant", content: `[${label}]\n\`\`\`json\n${JSON.stringify(data).slice(0, 6000)}\n\`\`\`` },
        ]);
      }
      return json({ tool, data, conversationId: convId });
    }

    if (action === "sla_apps") {
      const all = await getSla(user);
      const names = Array.from(
        new Set((all ?? []).map((s: any) => s.application_name).filter(Boolean)),
      ).sort((a: any, b: any) => String(a).localeCompare(String(b)));
      return json({ data: names });
    }

    if (action === "alarm_options") {
      const [{ data: peers }, { data: compApps }, { data: globalApps }] = await Promise.all([
        supabase
          .from("end_users")
          .select("id, full_name, document_number")
          .eq("company_id", user.company_id)
          .eq("active", true)
          .order("full_name")
          .limit(500),
        supabase
          .from("company_applications")
          .select("id, name")
          .eq("company_id", user.company_id)
          .eq("active", true)
          .order("name"),
        supabase.from("global_applications").select("id, name").eq("active", true).order("name"),
      ]);
      return json({
        data: {
          users: peers ?? [],
          applications: [
            ...(compApps ?? []).map((a: any) => ({ key: `company:${a.id}`, name: a.name })),
            ...(globalApps ?? []).map((a: any) => ({ key: `global:${a.id}`, name: a.name })),
          ],
          me: user.id,
        },
      });
    }

    if (action === "create_alarm") {
      if (!cfg.tools?.create_alarm) {
        return json({ error: "tool_not_allowed", message: cfg.unauthorized_message }, 403);
      }
      const title = String(body.title ?? "").trim().slice(0, 200);
      const description = String(body.description ?? "").trim().slice(0, 4000);
      const priority = ["baja", "media", "alta"].includes(String(body.priority))
        ? String(body.priority)
        : "media";
      if (!title || !description) return json({ error: "invalid_input", message: "Falta el asunto o la descripción." }, 400);

      // Usuario afectado: debe pertenecer a la misma cuenta
      const affectedId = String(body.affectedUserId ?? user.id);
      const { data: affected } = await supabase
        .from("end_users")
        .select("id, full_name, company_id")
        .eq("id", affectedId)
        .eq("company_id", user.company_id)
        .maybeSingle();
      if (!affected) {
        return json({ error: "invalid_user", message: "Debes indicar un usuario válido de tu cuenta." }, 400);
      }

      // Aplicativo / gestión: obligatorio, tomado de la cuenta
      const appKey = String(body.applicationKey ?? "");
      const [appScope, appId] = appKey.split(":");
      let applicationLabel = "";
      let companyAppId: string | null = null;
      let globalAppId: string | null = null;
      if (appScope === "company" && appId) {
        const { data: a } = await supabase
          .from("company_applications")
          .select("id, name")
          .eq("id", appId)
          .eq("company_id", user.company_id)
          .maybeSingle();
        if (a) {
          applicationLabel = a.name;
          companyAppId = a.id;
        }
      } else if (appScope === "global" && appId) {
        const { data: a } = await supabase
          .from("global_applications")
          .select("id, name")
          .eq("id", appId)
          .maybeSingle();
        if (a) {
          applicationLabel = a.name;
          globalAppId = a.id;
        }
      }
      if (!applicationLabel) {
        return json({ error: "invalid_application", message: "Debes seleccionar el aplicativo o tipo de gestión." }, 400);
      }

      const { data: openOnes } = await supabase
        .from("alarms")
        .select("id, status")
        .eq("affected_end_user_id", affected.id)
        .eq("application_label", applicationLabel)
        .not("status", "in", "(resuelta,cerrada)")
        .limit(1);
      if (openOnes && openOnes.length > 0) {
        return json({
          error: "duplicate_request",
          message: `Ya existe una solicitud en curso para ${affected.full_name} y "${applicationLabel}". Debes esperar a que sea resuelta.`,
        }, 409);
      }

      const { data: created, error } = await supabase
        .from("alarms")
        .insert({
          end_user_id: user.id,
          affected_end_user_id: affected.id,
          application_label: applicationLabel,
          application_id: companyAppId,
          global_application_id: globalAppId,
          title,
          description,
          priority,
          status: "abierta",
        })
        .select("id, title, status, created_at")
        .single();
      if (error) {
        if ((error as any).code === "23505") {
          return json({
            error: "duplicate_request",
            message: `Ya existe una solicitud en curso para ${affected.full_name} y "${applicationLabel}".`,
          }, 409);
        }
        return json({ error: "insert_failed", message: error.message }, 500);
      }

      const convId = await ensureConversation(user.id, body.conversationId, `Nueva novedad: ${title}`);
      if (convId) {
        await saveMessages(convId, [
          { role: "user", content: `Crear novedad: ${title}\n${description}` },
          { role: "assistant", content: `Novedad creada correctamente (${created.id}). Estado: ${created.status}.` },
        ]);
      }
      const sla = await getSla(user);
      return json({ data: created, sla, conversationId: convId });
    }

    if (action === "chat") {
      if (cfg.allow_free_text === false) {
        return json({ error: "free_text_disabled", message: "Por favor usa las opciones del menú." }, 403);
      }
      const question = String(body.message ?? "").slice(0, 2000);
      const conversationId = await ensureConversation(user.id, body.conversationId, question);
      const previous = conversationId ? await getConversation(user.id, conversationId) : null;
      const history = (previous?.messages ?? []).slice(-16).map((m: any) => ({ role: m.role, content: m.content }));

      const staffData = isStaff
        ? {
            usuarios_a_mi_cargo: await getStaffUsers(user),
            usuario_consultado: /\d{5,}/.test(question)
              ? await getStaffUserDetail(user, (question.match(/\d{5,}/) ?? [""])[0])
              : null,
          }
        : {};

      const [apps, alarms, sla, knowledge, stats] = await Promise.all([
        getUserApps(user, cfg),
        cfg.tools?.my_alarms ? getAlarms(user) : Promise.resolve([]),
        getSla(user),
        getKnowledge(user, undefined, question),
        getResolutionStats(user),
      ]);
      const result = await callAI(
        cfg,
        user,
        {
          mis_aplicativos: apps,
          mis_novedades: alarms,
          tiempos_sla: sla,
          conocimiento: knowledge,
          estadisticas_tiempos_reales: stats,
          puede_crear_novedad: !!cfg.tools?.create_alarm,
          ...staffData,
        },
        question,
        history,
      );
      if (result.error?.startsWith("ai_")) {
        const status = result.status ?? 500;
        const msg =
          status === 429
            ? "Demasiadas solicitudes, intenta en unos segundos."
            : status === 402
              ? "Se agotaron los créditos de IA del espacio de trabajo."
              : "No fue posible contactar al asistente en este momento.";
        return json({ error: result.error, message: msg }, status);
      }
      if (conversationId) {
        await saveMessages(conversationId, [
          { role: "user", content: question },
          { role: "assistant", content: result.text ?? "" },
        ]);
      }
      return json({ text: result.text, conversationId });
    }

    return json({ error: "invalid_action" }, 400);
  } catch (e) {
    return json({ error: "server_error", message: String(e) }, 500);
  }
});

