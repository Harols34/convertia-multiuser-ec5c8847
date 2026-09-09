import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, UserCog } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface AccessRole {
  id: string;
  name: string;
  label: string;
  description: string | null;
  active: boolean;
  can_create_tickets: boolean;
  can_view_all_company_tickets: boolean;
  visible_modules: string[];
}

const PORTAL_MODULES: { key: string; label: string }[] = [
  { key: "applications", label: "Mis Aplicativos" },
  { key: "alarms", label: "Mis Casos" },
  { key: "create_alarm", label: "Crear Caso" },
  { key: "chat", label: "Chat" },
  { key: "referrals", label: "Referidos" },
  { key: "browser", label: "Navegador" },
];

const normalize = (modules: unknown): string[] =>
  Array.isArray(modules) ? modules.map((m) => String(m).replace(/-/g, "_")) : [];

export default function AccessRolesManager() {
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", label: "", description: "" });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("access_roles").select("*").order("label");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRoles(
        (data ?? []).map((r: any) => ({ ...r, visible_modules: normalize(r.visible_modules) })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const patch = (id: string, changes: Partial<AccessRole>) =>
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));

  const toggleModule = (role: AccessRole, moduleKey: string, value: boolean) => {
    const next = value
      ? [...new Set([...role.visible_modules, moduleKey])]
      : role.visible_modules.filter((m) => m !== moduleKey);
    patch(role.id, { visible_modules: next });
  };

  const saveRole = async (role: AccessRole) => {
    setSaving(true);
    const { error } = await supabase
      .from("access_roles")
      .update({
        label: role.label,
        description: role.description,
        active: role.active,
        can_create_tickets: role.can_create_tickets,
        can_view_all_company_tickets: role.can_view_all_company_tickets,
        visible_modules: role.visible_modules,
      })
      .eq("id", role.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Guardado", description: `Rol "${role.label}" actualizado` });
    }
  };

  const createRole = async () => {
    if (!newRole.name || !newRole.label) {
      toast({ title: "Error", description: "Identificador y nombre son requeridos", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("access_roles").insert([
      {
        name: newRole.name,
        label: newRole.label,
        description: newRole.description || null,
        visible_modules: ["applications", "alarms", "chat"],
      },
    ]);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setCreateOpen(false);
    setNewRole({ name: "", label: "", description: "" });
    load();
  };

  const removeRole = async (role: AccessRole) => {
    if (!confirm(`¿Eliminar el rol de acceso "${role.label}"? Las personas asignadas quedarán sin rol.`)) return;
    const { error } = await supabase.from("access_roles").delete().eq("id", role.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Roles de Acceso (portal "Busca tu Info")
          </h2>
          <p className="text-sm text-muted-foreground">
            Aplican a todas las cuentas. Definen qué ve y qué puede hacer cada persona del portal.
          </p>
        </div>
        <Button variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Rol de Acceso
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}

      <div className="grid gap-4">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{role.name}</Badge>
                    {!role.active && <Badge variant="secondary">Inactivo</Badge>}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nombre visible</Label>
                      <Input value={role.label} onChange={(e) => patch(role.id, { label: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Descripción</Label>
                      <Input
                        value={role.description ?? ""}
                        onChange={(e) => patch(role.id, { description: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveRole(role)} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeRole(role)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex items-center justify-between rounded-lg bg-muted/30 p-2">
                  <Label className="text-sm">Activo</Label>
                  <Switch checked={role.active} onCheckedChange={(v) => patch(role.id, { active: v })} />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/30 p-2">
                  <Label className="text-sm">Puede crear solicitudes</Label>
                  <Switch
                    checked={role.can_create_tickets}
                    onCheckedChange={(v) => patch(role.id, { can_create_tickets: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/30 p-2">
                  <Label className="text-sm">Ve todas las solicitudes de su cuenta</Label>
                  <Switch
                    checked={role.can_view_all_company_tickets}
                    onCheckedChange={(v) => patch(role.id, { can_view_all_company_tickets: v })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm">Módulos visibles en el portal</Label>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {PORTAL_MODULES.map((m) => (
                    <div key={m.key} className="flex items-center justify-between rounded-lg border p-2">
                      <span className="text-sm">{m.label}</span>
                      <Switch
                        checked={role.visible_modules.includes(m.key)}
                        onCheckedChange={(v) => toggleModule(role, m.key, v)}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Se combina con la visibilidad configurada por empresa: un módulo debe estar activo en ambos lugares.
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Rol de Acceso</DialogTitle>
            <DialogDescription>Se podrá asignar a las personas de cualquier cuenta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Identificador (interno)</Label>
              <Input
                placeholder="ej: supervisor"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre visible</Label>
              <Input
                placeholder="ej: Supervisor"
                value={newRole.label}
                onChange={(e) => setNewRole({ ...newRole, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createRole}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
