import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AlarmCaseChat from "@/components/AlarmCaseChat";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bell, CheckCircle2, MessageSquare, Inbox, Loader2, HelpCircle, CircleCheck, Settings2, Filter } from "lucide-react";
import AlarmAttachment from "@/components/AlarmAttachment";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AdminChatPanel from "@/components/AdminChatPanel";
import SupportSettingsPanel from "@/components/SupportSettingsPanel";
import { useAuth } from "@/lib/auth";

export const STATUS_LABELS: Record<string, string> = {
  abierta: "Abierta",
  en_proceso: "En gestión",
  pendiente_informacion: "Pendiente de información",
  resuelta: "Resuelta",
  cerrada: "Cerrada",
};
const STATUS_VARIANT: Record<string, any> = {
  abierta: "destructive",
  en_proceso: "default",
  pendiente_informacion: "outline",
  resuelta: "secondary",
  cerrada: "outline",
};

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const elapsed = (a: any) => {
  const end = a.resolved_at ? new Date(a.resolved_at).getTime() : new Date(a.updated_at).getTime();
  const m = Math.max(0, Math.round((end - new Date(a.created_at).getTime()) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

export default function HelpDesk() {
  const { user } = useAuth();
  const [alarms, setAlarms] = useState<any[]>([]);
  const [admins, setAdmins] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [comment, setComment] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newAssignee, setNewAssignee] = useState("none");
  const [saving, setSaving] = useState(false);
  const [notify, setNotify] = useState(true);
  const selectedRef = useRef<string | null>(null);
  const userRef = useRef<string | undefined>(undefined);

  const [f, setF] = useState({ status: "activos", assignee: "all", company: "all", priority: "all", q: "", from: "", to: "" });

  useEffect(() => { userRef.current = user?.id; }, [user]);
  useEffect(() => { selectedRef.current = selected?.id ?? null; }, [selected]);

  useEffect(() => {
    loadAlarms();
    supabase.from("profiles").select("id, full_name").order("full_name").then(({ data }) => setAdmins(data || []));
    (supabase as any).from("support_settings").select("notify_admins").limit(1).maybeSingle()
      .then(({ data }: any) => setNotify(data?.notify_admins !== false));

    const channel = supabase
      .channel("helpdesk-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "alarms" }, (p: any) => {
        loadAlarms(true);
        if (!notifyRef.current) return;
        const n = p.new, o = p.old;
        if (p.eventType === "INSERT") toast.info("Nuevo caso creado", { description: n.title });
        else if (p.eventType === "UPDATE") {
          if (n.assigned_to && n.assigned_to !== o?.assigned_to && n.assigned_to === userRef.current)
            toast.info("Se te asignó un caso", { description: n.title });
          else if (o?.status && n.status !== o.status)
            toast.info(n.status === "resuelta" || n.status === "cerrada" ? "Caso resuelto" : "Caso actualizado", {
              description: `${n.title} → ${STATUS_LABELS[n.status] ?? n.status}`,
            });
          else if (o?.priority && n.priority !== o.priority && n.priority === "alta")
            toast.warning("Caso escalado a prioridad alta", { description: n.title });
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alarm_comments" }, (p: any) => {
        if (p.new.alarm_id === selectedRef.current) loadDetail(p.new.alarm_id);
        if (notifyRef.current && p.new.author_type && p.new.author_type !== "admin")
          toast.info("Nuevo comentario del portal", { description: p.new.comment?.slice(0, 80) });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alarm_events" }, (p: any) => {
        if (p.new.alarm_id === selectedRef.current) loadDetail(p.new.alarm_id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notifyRef = useRef(true);
  useEffect(() => { notifyRef.current = notify; }, [notify]);

  useEffect(() => {
    if (!selected) return;
    const fresh = alarms.find((a) => a.id === selected.id);
    if (fresh && fresh.updated_at !== selected.updated_at) setSelected(fresh);
  }, [alarms]);

  // Enlaces profundos desde el centro de novedades
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "casos");
  const chatUserParam = searchParams.get("user");
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t) setTab(t);
    const id = searchParams.get("alarm");
    if (id && alarms.length) {
      const a = alarms.find((x) => x.id === id);
      if (a && selectedRef.current !== id) { setTab("casos"); open(a); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, alarms.length]);

  const loadAlarms = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from("alarms")
      .select(`*, end_users!alarms_end_user_id_fkey (id, full_name, document_number, companies (id, name)),
        affected_user:end_users!alarms_affected_end_user_id_fkey (id, full_name, document_number)`)
      .order("created_at", { ascending: false });
    if (error) toast.error("No se pudieron cargar los casos");
    else setAlarms(data || []);
    setLoading(false);
  };

  const loadDetail = async (id: string) => {
    const [c, e, a] = await Promise.all([
      supabase.from("alarm_comments").select("*").eq("alarm_id", id).order("created_at"),
      (supabase as any).from("alarm_events").select("*").eq("alarm_id", id).order("created_at"),
      supabase.from("alarm_attachments").select("*").eq("alarm_id", id),
    ]);
    setComments(c.data || []);
    setEvents(e.data || []);
    setAttachments(a.data || []);
  };

  const open = async (a: any) => {
    setSelected(a);
    setNewStatus(a.status);
    setNewAssignee(a.assigned_to ?? "none");
    setComment("");
    await loadDetail(a.id);
  };

  const adminName = (id?: string | null) => admins.find((x) => x.id === id)?.full_name ?? "Sin asignar";

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const updates: any = {};
    if (newStatus !== selected.status) {
      updates.status = newStatus;
      if (newStatus === "resuelta" || newStatus === "cerrada") updates.resolved_at = new Date().toISOString();
      if (!selected.responded_at) updates.responded_at = new Date().toISOString();
    }
    const assignee = newAssignee === "none" ? null : newAssignee;
    if (assignee !== (selected.assigned_to ?? null)) updates.assigned_to = assignee;

    if (Object.keys(updates).length) {
      const { error } = await supabase.from("alarms").update(updates).eq("id", selected.id);
      if (error) { setSaving(false); return toast.error("No se pudo actualizar el caso", { description: error.message }); }
    }
    if (comment.trim()) {
      const me = admins.find((x) => x.id === user?.id)?.full_name ?? user?.email ?? "Administrador";
      const { error } = await (supabase as any).from("alarm_comments").insert({
        alarm_id: selected.id, comment: comment.trim(), user_id: user?.id ?? null, author_type: "admin", author_name: me,
      });
      if (error) toast.error("No se pudo guardar el comentario");
      if (!selected.responded_at && !updates.responded_at)
        await supabase.from("alarms").update({ responded_at: new Date().toISOString() }).eq("id", selected.id);
    }
    setSaving(false);
    setComment("");
    toast.success("Caso actualizado");
    loadAlarms(true);
    loadDetail(selected.id);
  };

  const companies = useMemo(() => {
    const m = new Map<string, string>();
    alarms.forEach((a) => a.end_users?.companies && m.set(a.end_users.companies.id, a.end_users.companies.name));
    return Array.from(m.entries());
  }, [alarms]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { abierta: 0, en_proceso: 0, pendiente_informacion: 0, resuelta: 0 };
    alarms.forEach((a) => {
      const k = a.status === "cerrada" ? "resuelta" : a.status;
      c[k] = (c[k] ?? 0) + 1;
    });
    return c;
  }, [alarms]);

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return alarms.filter((a) => {
      if (f.status === "activos" && ["resuelta", "cerrada"].includes(a.status)) return false;
      if (f.status !== "activos" && f.status !== "all" && a.status !== f.status) return false;
      if (f.assignee === "mine" && a.assigned_to !== user?.id) return false;
      if (f.assignee === "none" && a.assigned_to) return false;
      if (!["all", "mine", "none"].includes(f.assignee) && a.assigned_to !== f.assignee) return false;
      if (f.company !== "all" && a.end_users?.companies?.id !== f.company) return false;
      if (f.priority !== "all" && a.priority !== f.priority) return false;
      if (f.from && new Date(a.created_at) < new Date(f.from + "T00:00:00")) return false;
      if (f.to && new Date(a.created_at) > new Date(f.to + "T23:59:59")) return false;
      if (q) {
        const hay = [a.title, a.end_users?.full_name, a.end_users?.document_number, a.affected_user?.full_name,
          a.affected_user?.document_number, a.application_label].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [alarms, f, user]);

  const timeline = useMemo(() => {
    const items = [
      ...comments.map((c) => ({ id: c.id, at: c.created_at, kind: "comment", who: c.author_name ?? (c.author_type === "admin" ? "Administrador" : "Portal"), type: c.author_type, text: c.comment })),
      ...events.map((e) => ({
        id: e.id, at: e.created_at, kind: "event", who: e.actor_name, type: "event",
        text: e.event_type === "created" ? "Caso creado"
          : e.event_type === "status" ? `Estado: ${STATUS_LABELS[e.old_value] ?? e.old_value} → ${STATUS_LABELS[e.new_value] ?? e.new_value}`
          : e.event_type === "assigned" ? `Responsable: ${e.old_value ?? "Sin asignar"} → ${e.new_value ?? "Sin asignar"}`
          : `Prioridad: ${e.old_value} → ${e.new_value}`,
      })),
    ];
    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [comments, events]);

  const kpi = (label: string, value: number, Icon: any, status: string) => (
    <button onClick={() => setF({ ...f, status })} className="text-left">
      <Card className={f.status === status ? "ring-2 ring-primary" : ""}>
        <CardContent className="p-4 flex items-center gap-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
          <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
        </CardContent>
      </Card>
    </button>
  );

  const setFilter = (k: string) => (v: string) => setF({ ...f, [k]: v });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mesa de Ayuda</h1>
        <p className="text-muted-foreground mt-2">Gestiona las alarmas y solicitudes de los usuarios</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="casos"><Bell className="h-4 w-4 mr-2" />Casos</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare className="h-4 w-4 mr-2" />Chat</TabsTrigger>
          <TabsTrigger value="config"><Settings2 className="h-4 w-4 mr-2" />Horario y alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="casos" className="pt-4 space-y-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {kpi("Abiertos", counts.abierta, Inbox, "abierta")}
            {kpi("En gestión", counts.en_proceso, Loader2, "en_proceso")}
            {kpi("Pendiente de información", counts.pendiente_informacion, HelpCircle, "pendiente_informacion")}
            {kpi("Resueltos", counts.resuelta, CircleCheck, "resuelta")}
          </div>

          <Card>
            <CardContent className="p-3 grid gap-2 md:grid-cols-4 lg:grid-cols-7 items-end">
              <div className="lg:col-span-2 space-y-1">
                <Label className="text-xs flex items-center gap-1"><Filter className="h-3 w-3" />Colaborador / caso</Label>
                <Input placeholder="Nombre, documento, asunto..." value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
              </div>
              <div className="space-y-1"><Label className="text-xs">Estado</Label>
                <Select value={f.status} onValueChange={setFilter("status")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activos">Activos</SelectItem><SelectItem value="all">Todos</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Responsable</Label>
                <Select value={f.assignee} onValueChange={setFilter("assignee")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem><SelectItem value="mine">Mi bandeja</SelectItem><SelectItem value="none">Sin asignar</SelectItem>
                    {admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                  </SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Campaña</Label>
                <Select value={f.company} onValueChange={setFilter("company")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todas</SelectItem>
                    {companies.map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}
                  </SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Prioridad</Label>
                <Select value={f.priority} onValueChange={setFilter("priority")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem><SelectItem value="baja">Baja</SelectItem></SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-1">
                <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <div className="overflow-x-auto scrollbar-visible">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caso</TableHead><TableHead>Solicitante</TableHead><TableHead>Colaborador</TableHead>
                    <TableHead>Campaña</TableHead><TableHead>Aplicativo</TableHead><TableHead>Prioridad</TableHead>
                    <TableHead>Estado</TableHead><TableHead>Responsable</TableHead><TableHead>Creado</TableHead>
                    <TableHead>Último cambio</TableHead><TableHead>Tiempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No hay casos con estos filtros.</TableCell></TableRow>
                  ) : filtered.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => open(a)}>
                      <TableCell className="font-medium max-w-[220px] truncate">{a.title}</TableCell>
                      <TableCell>{a.end_users?.full_name}</TableCell>
                      <TableCell className="text-xs">{a.affected_user ? `${a.affected_user.full_name} · ${a.affected_user.document_number}` : "—"}</TableCell>
                      <TableCell>{a.end_users?.companies?.name}</TableCell>
                      <TableCell>{a.application_label ?? "—"}</TableCell>
                      <TableCell className={a.priority === "alta" ? "text-destructive font-medium capitalize" : "capitalize"}>{a.priority}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABELS[a.status] ?? a.status}</Badge></TableCell>
                      <TableCell className="text-xs">{adminName(a.assigned_to)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmt(a.created_at)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmt(a.resolved_at || a.updated_at)}</TableCell>
                      <TableCell><Badge variant="outline">{elapsed(a)}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="pt-4"><AdminChatPanel initialUserId={chatUserParam} /></TabsContent>
        <TabsContent value="config" className="pt-4"><SupportSettingsPanel /></TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto scrollbar-visible">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>Seguimiento completo del caso</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid gap-6 md:grid-cols-[1fr_320px]">
              <div className="space-y-4 min-w-0">
                <p className="text-sm whitespace-pre-wrap">{selected.description}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="font-medium">Solicitante</p><p className="text-muted-foreground">{selected.end_users?.full_name} · {selected.end_users?.document_number}</p></div>
                  <div><p className="font-medium">Campaña</p><p className="text-muted-foreground">{selected.end_users?.companies?.name}</p></div>
                  <div><p className="font-medium">Colaborador</p><p className="text-muted-foreground">{selected.affected_user?.full_name ?? "—"}</p></div>
                  <div><p className="font-medium">Aplicativo</p><p className="text-muted-foreground">{selected.application_label ?? "—"}</p></div>
                  <div><p className="font-medium">Creado</p><p className="text-muted-foreground">{fmt(selected.created_at)}</p></div>
                  <div><p className="font-medium">Tiempo transcurrido</p><p className="text-muted-foreground">{elapsed(selected)}</p></div>
                </div>
                {attachments.length > 0 && (
                  <div className="space-y-2"><h4 className="font-semibold text-sm">Adjuntos</h4>
                    {attachments.map((x) => <AlarmAttachment key={x.id} attachmentPath={x.file_path} attachmentName={x.file_name} attachmentType={x.file_type} />)}
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Chat del caso</h4>
                  <AlarmCaseChat alarmId={selected.id} mode="admin" authorName={(user as any)?.user_metadata?.full_name ?? "Administrador"} height="300px" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">Trazabilidad ({timeline.length})</h4>
                  <ol className="relative border-l pl-4 space-y-3 max-h-[420px] overflow-y-auto scrollbar-visible">
                    {timeline.map((t) => (
                      <li key={t.id} className="relative">
                        <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${t.kind === "event" ? "bg-muted-foreground" : "bg-primary"}`} />
                        <div className={`rounded-md border p-2 ${t.kind === "event" ? "bg-muted/40" : ""}`}>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                            <span className="font-medium text-foreground">{t.who ?? "Sistema"}</span>
                            {t.kind === "comment" && <Badge variant="outline" className="text-[10px]">{t.type === "admin" ? "Administrador" : t.type === "bot" ? "C-IA" : "Staff / usuario"}</Badge>}
                            <span>{new Date(t.at).toLocaleString("es-ES")}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{t.text}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1"><Label>Estado</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1"><Label>Administrador responsable</Label>
                  <Select value={newAssignee} onValueChange={setNewAssignee}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Sin asignar</SelectItem>
                      {admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1"><Label>Comentario / avance</Label>
                  <Textarea rows={5} value={comment} onChange={(e) => setComment(e.target.value)}
                    placeholder={newStatus === "pendiente_informacion" ? "Indica qué información necesitas del Staff..." : "Escribe un avance del caso..."} />
                </div>
                <Button className="w-full" onClick={save} disabled={saving}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />{saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
