import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, Save, Plus, Trash2, Pencil, Search } from "lucide-react";

const GLOBAL = "__global__";
const ANY = "__any__";

const TOOL_LABELS: Record<string, string> = {
  credentials: "Consultar mis credenciales",
  access_status: "Consultar estado de acceso",
  my_alarms: "Consultar mis novedades",
  alarm_detail: "Consultar detalle de novedad",
  comments: "Consultar comentarios",
  last_update: "Consultar última actualización",
  sla: "Consultar tiempos SLA",
  guidance: "Consultar orientación",
  tips: "Consultar recomendaciones",
  rag: "Consultar base de conocimiento (RAG)",
  create_alarm: "Crear novedad (Staff)",
  other_users: "Consultar otro colaborador",
  free_ai: "Pregunta abierta con IA",
};

const SCOPES = [
  { value: "own", label: "Solo mi información" },
  { value: "authorized", label: "Usuarios autorizados de mi campaña" },
  { value: "campaign", label: "Toda mi campaña" },
  { value: "company", label: "Toda mi empresa" },
  { value: "custom", label: "Alcance personalizado" },
];

const CATEGORIES = [
  { value: "orientacion", label: "Orientación de uso" },
  { value: "tips", label: "Tips / recomendaciones" },
  { value: "procedimiento", label: "Procedimiento" },
  { value: "faq", label: "Preguntas frecuentes" },
  { value: "politica", label: "Política" },
  { value: "general", label: "General" },
];

export default function BotConfig() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);

  const [companyId, setCompanyId] = useState<string>(GLOBAL);
  const [campaign, setCampaign] = useState<string>(ANY);
  const [roleKey, setRoleKey] = useState<string>(ANY);

  const [cfg, setCfg] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Knowledge
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [kSearch, setKSearch] = useState("");
  const [kOpen, setKOpen] = useState(false);
  const [kEdit, setKEdit] = useState<any>(null);

  // SLA
  const [slas, setSlas] = useState<any[]>([]);
  const [slaOpen, setSlaOpen] = useState(false);
  const [slaEdit, setSlaEdit] = useState<any>(null);

  const loadAll = async () => {
    const [c, g, ca, cfgs, k, s, eu] = await Promise.all([
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("global_applications").select("id, name").eq("active", true).order("name"),
      supabase.from("company_applications").select("id, name, company_id").eq("active", true).order("name"),
      supabase.from("cia_configs").select("*"),
      supabase.from("cia_knowledge").select("*").order("created_at", { ascending: false }),
      supabase.from("cia_sla").select("*").order("application_name"),
      supabase.from("end_users").select("campaign").not("campaign", "is", null),
    ]);
    setCompanies(c.data ?? []);
    setApps([
      ...((g.data ?? []) as any[]).map((a) => ({ ...a, company_id: null, scope: "Global" })),
      ...((ca.data ?? []) as any[]).map((a) => ({ ...a, scope: "Empresa" })),
    ]);
    setConfigs(cfgs.data ?? []);
    setKnowledge(k.data ?? []);
    setSlas(s.data ?? []);
    setCampaigns([...new Set(((eu.data ?? []) as any[]).map((r) => r.campaign).filter(Boolean))]);
  };

  // Conversations (audit)
  const [convs, setConvs] = useState<any[]>([]);
  const [convSearch, setConvSearch] = useState("");
  const [convOpen, setConvOpen] = useState(false);
  const [convDetail, setConvDetail] = useState<any>(null);

  const loadConversations = async () => {
    const { data } = await supabase
      .from("cia_conversations")
      .select("id, title, created_at, updated_at, archived, end_user_id")
      .order("updated_at", { ascending: false })
      .limit(300);
    const list = (data ?? []) as any[];
    const ids = [...new Set(list.map((c) => c.end_user_id))];
    let users: any[] = [];
    if (ids.length) {
      const { data: u } = await supabase
        .from("end_users")
        .select("id, full_name, document_number, campaign, bot_role, company_id, companies(name)")
        .in("id", ids);
      users = u ?? [];
    }
    setConvs(
      list.map((c) => ({ ...c, user: users.find((u) => u.id === c.end_user_id) ?? null })),
    );
  };

  const openConversation = async (c: any) => {
    const { data } = await supabase
      .from("cia_messages")
      .select("role, content, created_at")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: true });
    setConvDetail({ ...c, messages: data ?? [] });
    setConvOpen(true);
  };

  useEffect(() => {
    loadAll();
    loadConversations();
  }, []);

  /** Applications available for the selected scope (global + company owned). */
  const appOptions = useMemo(
    () => apps.filter((a) => !a.company_id || companyId === GLOBAL || a.company_id === companyId),
    [apps, companyId],
  );

  const current = useMemo(
    () =>
      configs.find(
        (c) =>
          (c.company_id ?? GLOBAL) === companyId &&
          (c.campaign ?? ANY) === campaign &&
          (c.role_key ?? ANY) === roleKey,
      ),
    [configs, companyId, campaign, roleKey],
  );

  useEffect(() => {
    if (current) {
      setCfg({ ...current });
    } else {
      const base = configs.find((c) => !c.company_id && !c.campaign && !c.role_key);
      setCfg({
        ...(base ?? {}),
        id: undefined,
        company_id: companyId === GLOBAL ? null : companyId,
        campaign: campaign === ANY ? null : campaign,
        role_key: roleKey === ANY ? null : roleKey,
        visible_application_ids: base?.visible_application_ids ?? [],
      });
    }
  }, [current, companyId, campaign, roleKey, configs]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const payload = {
      company_id: companyId === GLOBAL ? null : companyId,
      campaign: campaign === ANY ? null : campaign,
      role_key: roleKey === ANY ? null : roleKey,
      enabled: cfg.enabled ?? true,
      bot_name: cfg.bot_name ?? "C-IA",
      initial_message: cfg.initial_message ?? "",
      allow_free_text: !!cfg.allow_free_text,
      use_guided_menu: cfg.use_guided_menu ?? true,
      temperature: Number(cfg.temperature ?? 0.3),
      max_tokens: Number(cfg.max_tokens ?? 800),
      unknown_message: cfg.unknown_message ?? "",
      unauthorized_message: cfg.unauthorized_message ?? "",
      system_prompt: cfg.system_prompt ?? "",
      data_scope: cfg.data_scope ?? "own",
      tools: cfg.tools ?? {},
      visible_application_ids: cfg.visible_application_ids ?? [],
    };
    const res = cfg.id
      ? await supabase.from("cia_configs").update(payload).eq("id", cfg.id)
      : await supabase.from("cia_configs").insert(payload);
    setSaving(false);
    if (res.error) {
      toast({ title: "Error al guardar", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Configuración guardada" });
    loadAll();
  };

  const setTool = (key: string, val: boolean) =>
    setCfg((c: any) => ({ ...c, tools: { ...(c.tools ?? {}), [key]: val } }));

  const toggleApp = (id: string) =>
    setCfg((c: any) => {
      const list: string[] = c.visible_application_ids ?? [];
      return {
        ...c,
        visible_application_ids: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      };
    });

  const saveKnowledge = async () => {
    const payload = {
      company_id: kEdit.company_id || null,
      campaign: kEdit.campaign || null,
      roles: kEdit.rolesText ? kEdit.rolesText.split(",").map((r: string) => r.trim()).filter(Boolean) : [],
      category: kEdit.category ?? "general",
      title: kEdit.title,
      content: kEdit.content,
      tags: kEdit.tagsText ? kEdit.tagsText.split(",").map((r: string) => r.trim()).filter(Boolean) : [],
      active: kEdit.active ?? true,
    };
    if (!payload.title || !payload.content) {
      toast({ title: "Título y contenido son obligatorios", variant: "destructive" });
      return;
    }
    const res = kEdit.id
      ? await supabase.from("cia_knowledge").update(payload).eq("id", kEdit.id)
      : await supabase.from("cia_knowledge").insert(payload);
    if (res.error) return toast({ title: "Error", description: res.error.message, variant: "destructive" });
    setKOpen(false);
    setKEdit(null);
    loadAll();
  };

  const saveSla = async () => {
    const payload = {
      company_id: slaEdit.company_id || null,
      campaign: slaEdit.campaign || null,
      application_name: slaEdit.application_name,
      novelty_type: slaEdit.novelty_type,
      min_days: Number(slaEdit.min_days ?? 1),
      max_days: Number(slaEdit.max_days ?? 2),
      notes: slaEdit.notes || null,
      active: slaEdit.active ?? true,
    };
    if (!payload.application_name || !payload.novelty_type) {
      toast({ title: "Aplicativo y tipo de novedad son obligatorios", variant: "destructive" });
      return;
    }
    const res = slaEdit.id
      ? await supabase.from("cia_sla").update(payload).eq("id", slaEdit.id)
      : await supabase.from("cia_sla").insert(payload);
    if (res.error) return toast({ title: "Error", description: res.error.message, variant: "destructive" });
    setSlaOpen(false);
    setSlaEdit(null);
    loadAll();
  };

  const filteredKnowledge = knowledge.filter(
    (k) =>
      !kSearch ||
      k.title.toLowerCase().includes(kSearch.toLowerCase()) ||
      k.content.toLowerCase().includes(kSearch.toLowerCase()),
  );

  if (!cfg) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configuración BOT</h1>
          <p className="text-sm text-muted-foreground">Cerebro administrativo de C-IA</p>
        </div>
      </div>

      {/* Scope selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ámbito de la configuración</CardTitle>
          <CardDescription>Empresa → Campaña → Rol. Lo más específico prevalece.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Empresa</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL}>Global (todas)</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Campaña</Label>
            <Select value={campaign} onValueChange={setCampaign}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todas</SelectItem>
                {campaigns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Rol</Label>
            <Select value={roleKey} onValueChange={setRoleKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todos</SelectItem>
                <SelectItem value="colaborador">Colaborador</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="tools">Herramientas</TabsTrigger>
          <TabsTrigger value="apps">Aplicativos visibles</TabsTrigger>
          <TabsTrigger value="rag">Conocimiento / RAG</TabsTrigger>
          <TabsTrigger value="sla">Tiempos de gestión</TabsTrigger>
          <TabsTrigger value="convs">Historial conversaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                <div><Label>BOT habilitado</Label><p className="text-xs text-muted-foreground">Muestra el asistente flotante en el portal</p></div>
                <Switch checked={!!cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
              </div>
              <div><Label>Nombre</Label><Input value={cfg.bot_name ?? ""} onChange={(e) => setCfg({ ...cfg, bot_name: e.target.value })} /></div>
              <div><Label>Alcance de consulta</Label>
                <Select value={cfg.data_scope ?? "own"} onValueChange={(v) => setCfg({ ...cfg, data_scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label>Mensaje inicial</Label><Textarea value={cfg.initial_message ?? ""} onChange={(e) => setCfg({ ...cfg, initial_message: e.target.value })} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Permitir texto libre</Label>
                <Switch checked={!!cfg.allow_free_text} onCheckedChange={(v) => setCfg({ ...cfg, allow_free_text: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Usar menú guiado</Label>
                <Switch checked={cfg.use_guided_menu ?? true} onCheckedChange={(v) => setCfg({ ...cfg, use_guided_menu: v })} />
              </div>
              <div><Label>Temperatura IA</Label><Input type="number" step="0.1" min="0" max="2" value={cfg.temperature ?? 0.3} onChange={(e) => setCfg({ ...cfg, temperature: e.target.value })} /></div>
              <div><Label>Máximo de tokens</Label><Input type="number" value={cfg.max_tokens ?? 800} onChange={(e) => setCfg({ ...cfg, max_tokens: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Mensaje cuando no conoce la respuesta</Label><Textarea value={cfg.unknown_message ?? ""} onChange={(e) => setCfg({ ...cfg, unknown_message: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Mensaje ante consulta no autorizada</Label><Textarea value={cfg.unauthorized_message ?? ""} onChange={(e) => setCfg({ ...cfg, unauthorized_message: e.target.value })} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompt">
          <Card>
            <CardHeader><CardTitle className="text-base">Prompt del sistema</CardTitle><CardDescription>Se combina con el prompt global para este ámbito.</CardDescription></CardHeader>
            <CardContent>
              <Textarea rows={14} value={cfg.system_prompt ?? ""} onChange={(e) => setCfg({ ...cfg, system_prompt: e.target.value })} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools">
          <Card>
            <CardContent className="grid gap-2 pt-6 md:grid-cols-2">
              {Object.entries(TOOL_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="text-sm font-normal">{label}</Label>
                  <Switch checked={!!cfg.tools?.[key]} onCheckedChange={(v) => setTool(key, v)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apps">
          <Card>
            <CardHeader><CardTitle className="text-base">Aplicativos visibles para C-IA</CardTitle><CardDescription>Si no seleccionas ninguno, se muestran todos los del usuario.</CardDescription></CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-3">
              {appOptions.length === 0 && (
                <p className="text-sm text-muted-foreground md:col-span-3">
                  No hay aplicativos creados para este ámbito. Créalos en el módulo Aplicativos.
                </p>
              )}
              {appOptions.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm">
                  <Checkbox checked={(cfg.visible_application_ids ?? []).includes(a.id)} onCheckedChange={() => toggleApp(a.id)} />
                  <span className="flex-1">{a.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{a.scope}</Badge>
                </label>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rag">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div><CardTitle className="text-base">Base de conocimiento</CardTitle><CardDescription>Procedimientos, FAQ, tips y orientaciones.</CardDescription></div>
              <Button size="sm" onClick={() => { setKEdit({ active: true, category: "general" }); setKOpen(true); }}><Plus className="mr-1 h-4 w-4" />Nuevo</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar conocimiento..." value={kSearch} onChange={(e) => setKSearch(e.target.value)} />
              </div>
              {filteredKnowledge.map((k) => (
                <div key={k.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{k.title}</p>
                      <Badge variant="secondary" className="text-[10px]">{k.category}</Badge>
                      {!k.active && <Badge variant="outline" className="text-[10px]">Inactivo</Badge>}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{k.content}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setKEdit({ ...k, rolesText: (k.roles ?? []).join(", "), tagsText: (k.tags ?? []).join(", ") }); setKOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("cia_knowledge").delete().eq("id", k.id); loadAll(); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              {filteredKnowledge.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sin contenido.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sla">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div><CardTitle className="text-base">Tiempos de gestión</CardTitle><CardDescription>Por aplicativo y tipo de novedad.</CardDescription></div>
              <Button size="sm" onClick={() => { setSlaEdit({ active: true, min_days: 1, max_days: 2 }); setSlaOpen(true); }}><Plus className="mr-1 h-4 w-4" />Nuevo</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {slas.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{s.application_name} · {s.novelty_type}</p>
                    <p className="text-xs text-muted-foreground">{s.min_days}-{s.max_days} días hábiles {s.notes ? `· ${s.notes}` : ""}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setSlaEdit({ ...s }); setSlaOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("cia_sla").delete().eq("id", s.id); loadAll(); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              {slas.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sin tiempos configurados.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Guardando..." : "Guardar configuración"}</Button>
      </div>

      {/* Knowledge dialog */}
      <Dialog open={kOpen} onOpenChange={setKOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{kEdit?.id ? "Editar" : "Nuevo"} conocimiento</DialogTitle></DialogHeader>
          {kEdit && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={kEdit.title ?? ""} onChange={(e) => setKEdit({ ...kEdit, title: e.target.value })} /></div>
              <div><Label>Contenido</Label><Textarea rows={8} value={kEdit.content ?? ""} onChange={(e) => setKEdit({ ...kEdit, content: e.target.value })} /></div>
              <div className="grid gap-3 md:grid-cols-2">
                <div><Label>Categoría</Label>
                  <Select value={kEdit.category ?? "general"} onValueChange={(v) => setKEdit({ ...kEdit, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Empresa</Label>
                  <Select value={kEdit.company_id ?? GLOBAL} onValueChange={(v) => setKEdit({ ...kEdit, company_id: v === GLOBAL ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GLOBAL}>Todas</SelectItem>
                      {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Campaña (opcional)</Label><Input value={kEdit.campaign ?? ""} onChange={(e) => setKEdit({ ...kEdit, campaign: e.target.value })} /></div>
                <div><Label>Roles (separados por coma)</Label><Input placeholder="colaborador, staff" value={kEdit.rolesText ?? ""} onChange={(e) => setKEdit({ ...kEdit, rolesText: e.target.value })} /></div>
                <div><Label>Etiquetas</Label><Input value={kEdit.tagsText ?? ""} onChange={(e) => setKEdit({ ...kEdit, tagsText: e.target.value })} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3"><Label>Activo</Label><Switch checked={kEdit.active ?? true} onCheckedChange={(v) => setKEdit({ ...kEdit, active: v })} /></div>
              </div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setKOpen(false)}>Cancelar</Button><Button onClick={saveKnowledge}>Guardar</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SLA dialog */}
      <Dialog open={slaOpen} onOpenChange={setSlaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{slaEdit?.id ? "Editar" : "Nuevo"} tiempo de gestión</DialogTitle></DialogHeader>
          {slaEdit && (
            <div className="space-y-3">
              <div><Label>Aplicativo</Label><Input value={slaEdit.application_name ?? ""} onChange={(e) => setSlaEdit({ ...slaEdit, application_name: e.target.value })} /></div>
              <div><Label>Tipo de novedad</Label><Input placeholder="Creación / Restablecimiento / Desbloqueo" value={slaEdit.novelty_type ?? ""} onChange={(e) => setSlaEdit({ ...slaEdit, novelty_type: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Días mínimos</Label><Input type="number" value={slaEdit.min_days ?? 1} onChange={(e) => setSlaEdit({ ...slaEdit, min_days: e.target.value })} /></div>
                <div><Label>Días máximos</Label><Input type="number" value={slaEdit.max_days ?? 2} onChange={(e) => setSlaEdit({ ...slaEdit, max_days: e.target.value })} /></div>
              </div>
              <div><Label>Empresa</Label>
                <Select value={slaEdit.company_id ?? GLOBAL} onValueChange={(v) => setSlaEdit({ ...slaEdit, company_id: v === GLOBAL ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GLOBAL}>Todas</SelectItem>
                    {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notas</Label><Input value={slaEdit.notes ?? ""} onChange={(e) => setSlaEdit({ ...slaEdit, notes: e.target.value })} /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSlaOpen(false)}>Cancelar</Button><Button onClick={saveSla}>Guardar</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
