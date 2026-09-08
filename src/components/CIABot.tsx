import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bot, X, Send, ArrowLeft, Loader2, Sparkles } from "lucide-react";

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

const uid = () => Math.random().toString(36).slice(2);

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—";

export function CIABot({ endUserId }: { endUserId: string }) {
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<BotContext | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [subMenu, setSubMenu] = useState<null | "apps">(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ctx]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const push = (role: "bot" | "user", content: React.ReactNode) =>
    setMessages((m) => [...m, { id: uid(), role, content }]);

  const runTool = async (tool: string, extra: Record<string, unknown> = {}) => {
    setLoading(true);
    const res = await call({ action: "tool", tool, ...extra });
    setLoading(false);
    if (!res || res.__error) return push("bot", res?.__error ?? "Error");
    if (res.error) return push("bot", res.message ?? "No autorizado.");
    renderTool(tool, res.data);
  };

  const renderTool = (tool: string, data: any) => {
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

  const handleMenu = (item: MenuItem) => {
    push("user", item.label);
    if (item.key === "credentials" && ctx?.applications?.length) {
      setSubMenu("apps");
      push("bot", "Selecciona un aplicativo o consulta todos:");
      return;
    }
    setSubMenu(null);
    const map: Record<string, string> = {
      credentials: "credentials",
      alarms: "alarms",
      sla: "sla",
      guidance: "guidance",
      tips: "tips",
    };
    if (map[item.key]) runTool(map[item.key]);
    else push("bot", "Esta opción aún no está disponible para tu perfil.");
  };

  const sendFreeText = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    push("user", q);
    setLoading(true);
    const res = await call({ action: "chat", message: q });
    setLoading(false);
    if (!res || res.__error) return push("bot", res?.__error ?? "Error");
    if (res.error) return push("bot", res.message ?? "No disponible.");
    push("bot", res.text);
  };

  if (!ctx?.enabled) return null;

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Abrir ${ctx.config.bot_name}`}
          className="group fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-110 active:scale-95"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
          <Bot className="h-7 w-7 animate-[aura-drift-1_4s_ease-in-out_infinite]" />
          <Sparkles className="absolute -right-0.5 -top-0.5 h-4 w-4 text-yellow-300" />
        </button>
      )}

      {/* Ventana */}
      {open && (
        <div className="fixed bottom-0 right-0 z-50 flex h-[85vh] w-full flex-col overflow-hidden border bg-background shadow-2xl sm:bottom-5 sm:right-5 sm:h-[560px] sm:w-[380px] sm:rounded-2xl">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/15">
                <Bot className="h-5 w-5" />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-primary bg-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{ctx.config.bot_name}</p>
                <p className="text-[11px] opacity-80">Asistente inteligente de usuarios</p>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="space-y-3 p-3">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
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

          {/* Menú guiado */}
          {ctx.config.use_guided_menu && (
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

          {ctx.config.allow_free_text && (
            <div className="flex items-center gap-2 border-t p-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendFreeText()}
                placeholder="Escribe tu pregunta..."
                className="h-9 text-sm"
              />
              <Button size="icon" className="h-9 w-9" onClick={sendFreeText} disabled={loading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default CIABot;
