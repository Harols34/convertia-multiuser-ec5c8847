import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Plus,
  Pencil,
  Trash2,
  X,
  Shield,
  FileText,
  Search,
  Settings,
} from "lucide-react";

interface BrowserConfigRow {
  id: string;
  company_id: string;
  name: string;
  enabled: boolean;
  allowed_domains: string[];
  allowed_url_prefixes: string[];
  blocked_url_patterns: string[];
  allow_new_tabs: boolean;
  allow_downloads: boolean;
  allow_popups: boolean;
  allow_http: boolean;
  created_at: string;
  updated_at: string;
  companies?: { name: string };
}

interface AuditLogRow {
  id: string;
  company_id: string;
  user_id: string;
  action: string;
  url: string | null;
  reason: string | null;
  created_at: string;
}

export default function BrowserConfig() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<BrowserConfigRow[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BrowserConfigRow | null>(null);
  const [logSearch, setLogSearch] = useState("");
  const [logActionFilter, setLogActionFilter] = useState("all");

  // Form state
  const [formName, setFormName] = useState("");
  const [formCompanyId, setFormCompanyId] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formDomains, setFormDomains] = useState<string[]>([]);
  const [formPrefixes, setFormPrefixes] = useState<string[]>([]);
  const [formBlocked, setFormBlocked] = useState<string[]>([]);
  const [formAllowNewTabs, setFormAllowNewTabs] = useState(true);
  const [formAllowDownloads, setFormAllowDownloads] = useState(false);
  const [formAllowPopups, setFormAllowPopups] = useState(false);
  const [formAllowHttp, setFormAllowHttp] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [prefixInput, setPrefixInput] = useState("");
  const [blockedInput, setBlockedInput] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [configsRes, companiesRes, logsRes] = await Promise.all([
      supabase.from("browser_configs").select("*, companies(name)"),
      supabase.from("companies").select("id, name").eq("active", true),
      supabase
        .from("browser_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (configsRes.data) {
      setConfigs(
        configsRes.data.map((d: any) => ({
          ...d,
          allowed_domains: d.allowed_domains || [],
          allowed_url_prefixes: d.allowed_url_prefixes || [],
          blocked_url_patterns: d.blocked_url_patterns || [],
        }))
      );
    }
    if (companiesRes.data) setCompanies(companiesRes.data);
    if (logsRes.data) setLogs(logsRes.data as AuditLogRow[]);
    setLoading(false);
  };

  const resetForm = () => {
    setFormName("");
    setFormCompanyId("");
    setFormEnabled(true);
    setFormDomains([]);
    setFormPrefixes([]);
    setFormBlocked([]);
    setFormAllowNewTabs(true);
    setFormAllowDownloads(false);
    setFormAllowPopups(false);
    setFormAllowHttp(false);
    setDomainInput("");
    setPrefixInput("");
    setBlockedInput("");
    setEditingConfig(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (config: BrowserConfigRow) => {
    setEditingConfig(config);
    setFormName(config.name);
    setFormCompanyId(config.company_id);
    setFormEnabled(config.enabled);
    setFormDomains(config.allowed_domains);
    setFormPrefixes(config.allowed_url_prefixes);
    setFormBlocked(config.blocked_url_patterns);
    setFormAllowNewTabs(config.allow_new_tabs);
    setFormAllowDownloads(config.allow_downloads);
    setFormAllowPopups(config.allow_popups);
    setFormAllowHttp(config.allow_http);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formCompanyId) {
      toast({ title: "Error", description: "Nombre y empresa son requeridos", variant: "destructive" });
      return;
    }

    const payload = {
      name: formName,
      company_id: formCompanyId,
      enabled: formEnabled,
      allowed_domains: formDomains,
      allowed_url_prefixes: formPrefixes,
      blocked_url_patterns: formBlocked,
      allow_new_tabs: formAllowNewTabs,
      allow_downloads: formAllowDownloads,
      allow_popups: formAllowPopups,
      allow_http: formAllowHttp,
    };

    let error;
    if (editingConfig) {
      ({ error } = await supabase.from("browser_configs").update(payload).eq("id", editingConfig.id));
    } else {
      ({ error } = await supabase.from("browser_configs").insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingConfig ? "Actualizado" : "Creado", description: "Configuración guardada" });
      setDialogOpen(false);
      resetForm();
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta configuración de navegador?")) return;
    const { error } = await supabase.from("browser_configs").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Eliminado" });
      loadData();
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await supabase.from("browser_configs").update({ enabled }).eq("id", id);
    loadData();
  };

  const addChip = (value: string, list: string[], setter: (v: string[]) => void, inputSetter: (v: string) => void) => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !list.includes(trimmed)) {
      setter([...list, trimmed]);
    }
    inputSetter("");
  };

  const removeChip = (value: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.filter((v) => v !== value));
  };

  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      !logSearch ||
      (log.url && log.url.toLowerCase().includes(logSearch.toLowerCase())) ||
      log.user_id.toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.reason && log.reason.toLowerCase().includes(logSearch.toLowerCase()));
    const matchAction = logActionFilter === "all" || log.action === logActionFilter;
    return matchSearch && matchAction;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" />
            Configuración Navegador
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona navegadores embebidos, dominios permitidos y permisos por empresa
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Navegador
        </Button>
      </div>

      <Tabs defaultValue="configs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configs">
            <Settings className="mr-2 h-4 w-4" />
            Configuraciones
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="mr-2 h-4 w-4" />
            Logs de Navegación
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configs">
          {configs.length === 0 ? (
            <Card className="p-8 text-center">
              <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold">Sin configuraciones</h3>
              <p className="text-sm text-muted-foreground">Crea un navegador para una empresa</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {configs.map((config) => (
                <Card key={config.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{config.name}</CardTitle>
                      </div>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={(v) => handleToggle(config.id, v)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(config as any).companies?.name || "Sin empresa"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Dominios permitidos</p>
                      <div className="flex flex-wrap gap-1">
                        {config.allowed_domains.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">Ninguno</span>
                        ) : (
                          config.allowed_domains.map((d) => (
                            <Badge key={d} variant="secondary" className="text-xs">
                              {d}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {config.allow_new_tabs && <Badge variant="outline">Nuevas pestañas</Badge>}
                      {config.allow_http && <Badge variant="outline">HTTP</Badge>}
                      {config.allow_downloads && <Badge variant="outline">Descargas</Badge>}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(config)}>
                        <Pencil className="mr-1 h-3 w-3" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(config.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por URL, usuario..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={logActionFilter} onValueChange={setLogActionFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar acción" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="NAVIGATE_ALLOWED">Permitidas</SelectItem>
                    <SelectItem value="NAVIGATE_BLOCKED">Bloqueadas</SelectItem>
                    <SelectItem value="TAB_OPEN">Tab abierta</SelectItem>
                    <SelectItem value="TAB_CLOSE">Tab cerrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Razón</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Sin logs registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{log.user_id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.action === "NAVIGATE_BLOCKED"
                                ? "destructive"
                                : log.action === "NAVIGATE_ALLOWED"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={log.url || ""}>
                          {log.url || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.reason || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingConfig ? "Editar Navegador" : "Nuevo Navegador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ej: Navegador Principal" />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={formCompanyId} onValueChange={setFormCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Habilitado</Label>
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
            </div>

            {/* Allowed domains */}
            <div className="space-y-2">
              <Label>Dominios permitidos</Label>
              <div className="flex gap-2">
                <Input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="ejemplo.com"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChip(domainInput, formDomains, setFormDomains, setDomainInput))}
                />
                <Button type="button" size="sm" onClick={() => addChip(domainInput, formDomains, setFormDomains, setDomainInput)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {formDomains.map((d) => (
                  <Badge key={d} variant="secondary" className="gap-1">
                    {d}
                    <button onClick={() => removeChip(d, formDomains, setFormDomains)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Allowed URL prefixes */}
            <div className="space-y-2">
              <Label>Prefijos de URL permitidos (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  value={prefixInput}
                  onChange={(e) => setPrefixInput(e.target.value)}
                  placeholder="https://docs.ejemplo.com/"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChip(prefixInput, formPrefixes, setFormPrefixes, setPrefixInput))}
                />
                <Button type="button" size="sm" onClick={() => addChip(prefixInput, formPrefixes, setFormPrefixes, setPrefixInput)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {formPrefixes.map((p) => (
                  <Badge key={p} variant="secondary" className="gap-1">
                    {p}
                    <button onClick={() => removeChip(p, formPrefixes, setFormPrefixes)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Blocked patterns */}
            <div className="space-y-2">
              <Label>Patrones bloqueados (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  value={blockedInput}
                  onChange={(e) => setBlockedInput(e.target.value)}
                  placeholder="malware.com"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChip(blockedInput, formBlocked, setFormBlocked, setBlockedInput))}
                />
                <Button type="button" size="sm" onClick={() => addChip(blockedInput, formBlocked, setFormBlocked, setBlockedInput)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {formBlocked.map((b) => (
                  <Badge key={b} variant="destructive" className="gap-1">
                    {b}
                    <button onClick={() => removeChip(b, formBlocked, setFormBlocked)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Permitir nuevas pestañas</Label>
                <Switch checked={formAllowNewTabs} onCheckedChange={setFormAllowNewTabs} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Permitir HTTP (inseguro)</Label>
                <Switch checked={formAllowHttp} onCheckedChange={setFormAllowHttp} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Permitir descargas</Label>
                <Switch checked={formAllowDownloads} onCheckedChange={setFormAllowDownloads} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Permitir popups</Label>
                <Switch checked={formAllowPopups} onCheckedChange={setFormAllowPopups} />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button className="flex-1" onClick={handleSave}>
                {editingConfig ? "Guardar Cambios" : "Crear Navegador"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
