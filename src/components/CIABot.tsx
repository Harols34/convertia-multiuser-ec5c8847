import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Bot,
  X,
  Send,
  ArrowLeft,
  Loader2,
  Sparkles,
  History,
  Plus,
  Pin,
  PinOff,
  GripVertical,
  Trash2,
} from "lucide-react";

interface MenuItem {
  key: string;
  label: string;
  icon: string;
}

interface BotContext {
  enabled: boolean;
  config: {
    bot_name: string;
    initial_message: string;
    allow_free_text: boolean;
    use_guided_menu: boolean;
  };
  user: { name: string; company: string | null; role: string };
  menu: MenuItem[];
  applications: { id: string; name: string }[];
}

interface Msg {
  id: string;
  role: "bot" | "user";
  content: React.ReactNode;
}

interface ConversationItem {
  id: string;
  title: string;
  updated_at: string;
}

const uid = () => Math.random().toString(36).slice(2);

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—";

const MIN_W = 320;
const MIN_H = 380;

function Markdown({ children }: { children: string }) {
  return (
    <div className="cia-md space-y-2 text-sm [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export function CIABot({ endUserId }: { endUserId: string }) {
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<BotContext | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [subMenu, setSubMenu] = useState<null | "apps">(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [awaitingSearch, setAwaitingSearch] = useState(false);
  const [alarmDraft, setAlarmDraft] = useState<{
    step: "user" | "app" | "title" | "description";
    title: string;
    affectedUserId?: string;
    affectedName?: string;
    applicationKey?: string;
    applicationName?: string;
    users: { id: string; full_name: string; document_number: string }[];
    apps: { key: string; name: string }[];
    me?: string;
  } | null>(null);
  const [alarmForm, setAlarmForm] = useState<{
    users: { id: string; full_name: string; document_number: string }[];
    apps: { key: string; name: string }[];
    me?: string;
    affectedUserId: string;
    applicationKey: string;
    title: string;
    description: string;
    priority: string;
    submitting: boolean;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Position & size (floating window)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 400, h: 580 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const call = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("cia-assistant", {
      body: { userId: endUserId, ...payload },
    });
    if (error) {
      let msg = "No fue posible contactar al asistente.";
      try {
        const parsed = JSON.parse((await (error as any).context?.text?.()) ?? "{}");
        if (parsed?.message) msg = parsed.message;
      } catch {
        /* ignore */
      }
      return { __error: msg } as any;
    }
    return data as any;
  };

  useEffect(() => {
    if (!endUserId) return;
    call({ action: "context" }).then((d) => {
      if (d && !d.__error && d.enabled) setCtx(d as BotContext);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endUserId]);

  useEffect(() => {
    if (open && ctx && messages.length === 0) {
      setMessages([{ id: uid(), role: "bot", content: ctx.config.initial_message }]);
    }
    if (open && pos === null) {
      setPos({
        x: Math.max(12, window.innerWidth - size.w - 24),
        y: Math.max(12, window.innerHeight - size.h - 24),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ctx]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Drag & resize listeners
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (dragRef.current) {
        setPos({
          x: Math.min(Math.max(0, e.clientX - dragRef.current.dx), window.innerWidth - 120),
          y: Math.min(Math.max(0, e.clientY - dragRef.current.dy), window.innerHeight - 60),
        });
      } else if (resizeRef.current) {
        const r = resizeRef.current;
        setSize({
          w: Math.max(MIN_W, r.w + (e.clientX - r.x)),
          h: Math.max(MIN_H, r.h + (e.clientY - r.y)),
        });
      }
    };
    const up = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const push = (role: "bot" | "user", content: React.ReactNode) =>
    setMessages((m) => [...m, { id: uid(), role, content }]);

  const loadConversations = useCallback(async () => {
    const res = await call({ action: "conversations" });
    if (res && !res.__error) setConversations(res.data ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endUserId]);

  const openHistory = async () => {
    setShowHistory(true);
    await loadConversations();
  };

  const startNew = () => {
    setConversationId(null);
    setShowHistory(false);
    setSubMenu(null);
    setMessages([{ id: uid(), role: "bot", content: ctx?.config.initial_message ?? "¡Hola!" }]);
  };

  const openConversation = async (id: string) => {
    setLoading(true);
    const res = await call({ action: "conversation", conversationId: id });
    setLoading(false);
    if (!res || res.__error || !res.data) return;
    setConversationId(id);
    setShowHistory(false);
    setMessages(
      (res.data.messages ?? []).map((m: any) => ({
        id: uid(),
        role: m.role === "assistant" ? "bot" : "user",
        content: m.role === "assistant" ? <Markdown>{m.content}</Markdown> : m.content,
      })),
    );
  };

  const deleteConversation = async (id: string) => {
    await call({ action: "delete_conversation", conversationId: id });
    if (conversationId === id) startNew();
    loadConversations();
  };

  const runTool = async (tool: string, extra: Record<string, unknown> = {}) => {
    setLoading(true);
    const res = await call({ action: "tool", tool, conversationId, ...extra });
    setLoading(false);
    if (!res || res.__error) return push("bot", res?.__error ?? "Error");
    if (res.error) return push("bot", res.message ?? "No autorizado.");
    if (res.conversationId) setConversationId(res.conversationId);
    renderTool(tool, res.data);
    loadConversations();
  };

  const renderTool = (tool: string, data: any) => {
    if (tool === "staff_users") {
      if (!data?.length) return push("bot", "No encontré usuarios con ese criterio.");
      push(
        "bot",
        <div className="space-y-2 text-xs">
          <p className="font-medium">Usuarios ({data.length}):</p>
          <div className="max-h-72 overflow-auto rounded-lg border">
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left">Nombre</th>
                  <th className="px-2 py-1 text-left">Documento</th>
                  <th className="px-2 py-1 text-left">Campaña</th>
                  <th className="px-2 py-1 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.map((u: any) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-2 py-1">{u.full_name}</td>
                    <td className="px-2 py-1">{u.document_number}</td>
                    <td className="px-2 py-1">{u.campaign ?? "—"}</td>
                    <td className="px-2 py-1">{u.active ? "Activo" : "Inactivo"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            No se muestran contraseñas. Escribe un documento para ver el detalle de un usuario.
          </p>
        </div>,
      );
      return;
    }
    if (tool === "credentials") {
      if (!data?.length) return push("bot", "No tienes aplicativos asignados visibles.");
      push(
        "bot",
        <div className="space-y-2">
          <p className="font-medium">Estos son tus accesos:</p>
          {data.map((a: any) => (
            <div key={a.id} className="rounded-lg border bg-muted/40 p-2 text-xs">
              <p className="font-semibold">{a.application}</p>
              <p>Usuario: {a.username ?? "—"}</p>
              <p>Estado: {a.estado}</p>
              <p>Último cambio: {fmt(a.ultimo_cambio)}</p>
              {a.expira && <p>Expira: {fmt(a.expira)}</p>}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">
            Por seguridad nunca muestro contraseñas.
          </p>
        </div>,
      );
      return;
    }
    if (tool === "alarms") {
      if (!data?.length) return push("bot", "No tienes novedades registradas.");
      push(
        "bot",
        <div className="space-y-2">
          <p className="font-medium">Tus novedades:</p>
          {data.map((a: any) => (
            <button
              key={a.id}
              onClick={() => {
                push("user", `Caso ${a.numero}`);
                runTool("alarm_detail", { alarmId: a.id });
              }}
              className="w-full rounded-lg border bg-background p-2 text-left text-xs hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {a.numero} · {a.title}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {a.status}
                </Badge>
              </div>
              <span className="text-muted-foreground">Creado: {fmt(a.created_at)}</span>
            </button>
          ))}
        </div>,
      );
      return;
    }
    if (tool === "alarm_detail") {
      push(
        "bot",
        <div className="space-y-1 text-xs">
          <p className="text-sm font-semibold">{data.title}</p>
          <p>Estado: {data.status}</p>
          <p>Fecha de reporte: {fmt(data.created_at)}</p>
          <p>Última actualización: {fmt(data.updated_at)}</p>
          {data.resolved_at && <p>Solución: {fmt(data.resolved_at)}</p>}
          <p className="pt-1">{data.description}</p>
          {data.comments?.length > 0 && (
            <div className="mt-2 space-y-1 border-t pt-2">
              <p className="font-medium">Comentarios:</p>
              {data.comments.map((c: any, i: number) => (
                <p key={i} className="text-muted-foreground">
                  {fmt(c.created_at)} — {c.comment}
                </p>
              ))}
            </div>
          )}
          {data.sla?.length > 0 && (
            <p className="mt-2 text-muted-foreground">
              Tiempos estimados configurados: {data.sla[0].min_days}-{data.sla[0].max_days} días hábiles.
            </p>
          )}
        </div>,
      );
      return;
    }
    if (tool === "sla") {
      if (!data?.length) return push("bot", "Aún no hay tiempos de atención configurados.");
      push(
        "bot",
        <div className="space-y-1 text-xs">
          <p className="font-medium">Tiempos de atención:</p>
          {data.map((s: any, i: number) => (
            <p key={i}>
              <span className="font-semibold">{s.application_name}</span> · {s.novelty_type}:{" "}
              {s.min_days}-{s.max_days} días hábiles
            </p>
          ))}
        </div>,
      );
      return;
    }
    // guidance / tips (knowledge)
    if (!data?.length) return push("bot", "Aún no hay contenido publicado para esta opción.");
    push(
      "bot",
      <div className="space-y-2 text-xs">
        {data.map((k: any, i: number) => (
          <div key={i} className="rounded-lg border bg-muted/40 p-2">
            <p className="font-semibold">{k.title}</p>
            <p className="whitespace-pre-wrap">{k.content}</p>
          </div>
        ))}
      </div>,
    );
  };

  const handleMenu = async (item: MenuItem) => {
    push("user", item.label);
    if (item.key === "credentials" && ctx?.applications?.length) {
      setSubMenu("apps");
      push("bot", "Selecciona un aplicativo o consulta todos:");
      return;
    }
    setSubMenu(null);
    if (item.key === "staff_search") {
      setAwaitingSearch(true);
      push("bot", "Escribe el número de documento o el nombre del usuario que deseas consultar.");
      return;
    }
    const map: Record<string, string> = {
      credentials: "credentials",
      alarms: "alarms",
      sla: "sla",
      guidance: "guidance",
      tips: "tips",
      staff_users: "staff_users",
    };
    if (item.key === "create_alarm") {
      await startAlarmForm();
      return;
    }
    if (map[item.key]) runTool(map[item.key]);
    else push("bot", "Esta opción aún no está disponible para tu perfil.");
  };

  const sendFreeText = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    push("user", q);

    if (awaitingSearch) {
      setAwaitingSearch(false);
      await runTool("staff_users", { search: q });
      return;
    }

    // Guided alarm creation inside the chat
    if (alarmDraft) {
      if (alarmDraft.step === "user") {
        const lower = q.toLowerCase();
        const match =
          lower === "yo" || lower === "mi" || lower === "mí"
            ? alarmDraft.users.find((u) => u.id === alarmDraft.me)
            : alarmDraft.users.find(
                (u) => u.document_number === q || u.full_name.toLowerCase().includes(lower),
              );
        if (!match) {
          push("bot", "No encontré ese usuario en tu cuenta. Escribe *yo* o el número de documento exacto.");
          return;
        }
        setAlarmDraft({ ...alarmDraft, step: "app", affectedUserId: match.id, affectedName: match.full_name });
        push(
          "bot",
          <Markdown>
            {`Usuario: **${match.full_name}**.\n\n**¿Sobre qué aplicativo o gestión es?** Responde con el número:\n\n${alarmDraft.apps
              .map((a, i) => `${i + 1}. ${a.name}`)
              .join("\n")}`}
          </Markdown>,
        );
        return;
      }

      if (alarmDraft.step === "app") {
        const idx = parseInt(q, 10) - 1;
        const app = alarmDraft.apps[idx] ?? alarmDraft.apps.find((a) => a.name.toLowerCase() === q.toLowerCase());
        if (!app) {
          push("bot", "No identifiqué ese aplicativo. Responde con el número de la lista.");
          return;
        }
        setAlarmDraft({ ...alarmDraft, step: "title", applicationKey: app.key, applicationName: app.name });
        push("bot", `Aplicativo: ${app.name}. ¿Cuál es el asunto? (ejemplo: Bloqueo de usuario)`);
        return;
      }

      if (alarmDraft.step === "title") {
        setAlarmDraft({ ...alarmDraft, step: "description", title: q });
        push("bot", "Perfecto. Ahora descríbeme con detalle qué ocurre (mensaje de error, desde cuándo).");
        return;
      }
      const draft = alarmDraft;
      setAlarmDraft(null);
      setLoading(true);
      const res = await call({
        action: "create_alarm",
        title: draft.title,
        description: q,
        priority: "media",
        affectedUserId: draft.affectedUserId,
        applicationKey: draft.applicationKey,
        conversationId,
      });
      setLoading(false);
      if (!res || res.__error) return push("bot", res?.__error ?? "Error");
      if (res.error) return push("bot", res.message ?? "No fue posible crear la novedad.");
      if (res.conversationId) setConversationId(res.conversationId);
      window.dispatchEvent(new CustomEvent("cia:alarm-created"));
      push(
        "bot",
        <Markdown>{`✅ Tu novedad **${draft.title}** fue creada y quedó en estado *abierta*. Puedes seguirla en "Mis novedades".`}</Markdown>,
      );
      loadConversations();
      return;
    }

    setLoading(true);
    const res = await call({ action: "chat", message: q, conversationId });
    setLoading(false);
    if (!res || res.__error) return push("bot", res?.__error ?? "Error");
    if (res.error) return push("bot", res.message ?? "No disponible.");
    if (res.conversationId) setConversationId(res.conversationId);
    push("bot", <Markdown>{String(res.text ?? "")}</Markdown>);
    loadConversations();
  };

  if (!ctx?.enabled) return null;

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Abrir ${ctx.config.bot_name}`}
          className="group fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-110 active:scale-95"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
          <Bot className="h-7 w-7 animate-[aura-drift-1_4s_ease-in-out_infinite]" />
          <Sparkles className="absolute -right-0.5 -top-0.5 h-4 w-4 text-yellow-300" />
        </button>
      )}

      {/* Ventana flotante movible y redimensionable */}
      {open && (
        <div
          style={
            pos
              ? { left: pos.x, top: pos.y, width: size.w, height: size.h }
              : { right: 20, bottom: 20, width: size.w, height: size.h }
          }
          className={cn(
            "fixed flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl",
            pinned ? "z-[2147483000] opacity-95 hover:opacity-100" : "z-[70]",
          )}
        >
          <div
            onMouseDown={(e) => {
              if (!pos) return;
              dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
            }}
            className="flex cursor-move select-none items-center justify-between bg-primary px-3 py-2.5 text-primary-foreground"
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 opacity-70" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/15">
                <Bot className="h-4 w-4" />
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-primary bg-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{ctx.config.bot_name}</p>
                <p className="text-[11px] opacity-80">Asistente inteligente de usuarios</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                title="Nueva conversación"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15"
                onClick={startNew}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Histórico de conversaciones"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15"
                onClick={() => (showHistory ? setShowHistory(false) : openHistory())}
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title={pinned ? "Quitar de primer plano" : "Mantener sobre todo"}
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15"
                onClick={() => setPinned((p) => !p)}
              >
                {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showHistory ? (
            <div className="flex-1 overflow-y-auto p-2">
              <p className="px-1 pb-2 text-xs font-semibold text-muted-foreground">
                Conversaciones guardadas
              </p>
              {conversations.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">Aún no tienes conversaciones.</p>
              ) : (
                <div className="space-y-1">
                  {conversations.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-1 rounded-lg border p-2 hover:bg-accent"
                    >
                      <button
                        onClick={() => openConversation(c.id)}
                        className="flex-1 text-left text-xs"
                      >
                        <p className="line-clamp-1 font-medium">{c.title}</p>
                        <p className="text-[10px] text-muted-foreground">{fmt(c.updated_at)}</p>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => deleteConversation(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="space-y-3 p-3">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl px-3 py-2 text-sm",
                        m.role === "user"
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm bg-muted",
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Menú guiado */}
          {!showHistory && ctx.config.use_guided_menu && (
            <div className="border-t p-2">
              {subMenu === "apps" ? (
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSubMenu(null)}>
                    <ArrowLeft className="mr-1 h-3 w-3" /> Volver
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => { setSubMenu(null); runTool("credentials"); }}>
                    Todos
                  </Button>
                  {ctx.applications.map((a) => (
                    <Button
                      key={a.id}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setSubMenu(null);
                        push("user", a.name);
                        runTool("credentials", { applicationId: a.id });
                      }}
                    >
                      {a.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {ctx.menu.map((item) => (
                    <Button key={item.key} size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleMenu(item)}>
                      {item.icon} {item.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!showHistory && (
            <div className="flex items-center gap-2 border-t p-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendFreeText()}
                placeholder={
                  alarmDraft
                    ? alarmDraft.step === "user"
                      ? "Escribe 'yo' o el documento del usuario..."
                      : alarmDraft.step === "app"
                        ? "Número del aplicativo..."
                        : alarmDraft.step === "title"
                          ? "Escribe el asunto de la novedad..."
                          : "Describe la novedad..."
                    : "Escribe tu pregunta..."
                }
                className="h-9 text-sm"
                autoFocus
              />
              <Button size="icon" className="h-9 w-9" onClick={sendFreeText} disabled={loading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Redimensionar */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              resizeRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
            }}
            title="Cambiar tamaño"
            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-tl bg-border"
          />
        </div>
      )}
    </>
  );
}

export default CIABot;
