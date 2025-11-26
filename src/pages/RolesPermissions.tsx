import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Save, Plus, Trash2, Check, X, Search, MoreVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Module {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  route: string | null;
}

interface RolePermission {
  role: string;
  module_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Role {
  id: string;
  name: string;
  label: string;
  description: string | null;
}

export default function RolesPermissions() {
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", label: "", description: "" });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: modulesData } = await supabase
        .from("app_modules")
        .select("*")
        .eq("active", true)
        .order("display_name");

      setModules(modulesData || []);

      const { data: permissionsData } = await supabase
        .from("role_module_permissions")
        .select("*");

      setPermissions(permissionsData || []);

      const { data: rolesData } = await supabase
        .from("roles" as any)
        .select("*")
        .order("label");

      setRoles(rolesData || []);

      if (rolesData && rolesData.length > 0 && !selectedRole) {
        setSelectedRole(rolesData[0]);
      }

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getPermission = (role: string, moduleId: string) => {
    return permissions.find(p => p.role === role && p.module_id === moduleId) || {
      role,
      module_id: moduleId,
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false
    };
  };

  const updatePermission = (role: string, moduleId: string, field: keyof RolePermission, value: boolean) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.role === role && p.module_id === moduleId);
      let newPermissions;
      if (existing) {
        newPermissions = prev.map(p =>
          p.role === role && p.module_id === moduleId
            ? { ...p, [field]: value }
            : p
        );
      } else {
        newPermissions = [...prev, {
          role,
          module_id: moduleId,
          can_view: field === "can_view" ? value : false,
          can_create: field === "can_create" ? value : false,
          can_edit: field === "can_edit" ? value : false,
          can_delete: field === "can_delete" ? value : false
        }];
      }
      return newPermissions;
    });
    setHasUnsavedChanges(true);
  };

  const toggleAllForModule = (role: string, moduleId: string, value: boolean) => {
    setPermissions(prev => {
      // Remove existing permission for this module/role if exists to avoid duplicates when adding
      const filtered = prev.filter(p => !(p.role === role && p.module_id === moduleId));
      return [...filtered, {
        role,
        module_id: moduleId,
        can_view: value,
        can_create: value,
        can_edit: value,
        can_delete: value
      }];
    });
    setHasUnsavedChanges(true);
  };

  const savePermissions = async () => {
    setLoading(true);
    try {
      // Delete existing permissions
      await supabase.from("role_module_permissions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Insert new permissions
      const permissionsToInsert = permissions
        .filter(p => p.can_view || p.can_create || p.can_edit || p.can_delete)
        .map(({ role, module_id, can_view, can_create, can_edit, can_delete }) => ({
          role,
          module_id,
          can_view,
          can_create,
          can_edit,
          can_delete
        }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from("role_module_permissions")
          .insert(permissionsToInsert as any);

        if (error) throw error;
      }

      toast({
        title: "Éxito",
        description: "Permisos guardados correctamente"
      });
      setHasUnsavedChanges(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRole.name || !newRole.label) {
      toast({
        title: "Error",
        description: "Nombre y etiqueta son requeridos",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("roles" as any)
        .insert([newRole]);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Rol creado correctamente"
      });
      setIsCreateDialogOpen(false);
      setNewRole({ name: "", label: "", description: "" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteRole = async (roleName: string) => {
    if (roleName === 'admin') {
      toast({
        title: "Error",
        description: "No se puede eliminar el rol de administrador",
        variant: "destructive"
      });
      return;
    }

    if (!confirm("¿Está seguro de eliminar este rol? Esta acción no se puede deshacer.")) return;

    try {
      const { error } = await supabase
        .from("roles" as any)
        .delete()
        .eq("name", roleName);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Rol eliminado correctamente"
      });
      loadData();
      if (selectedRole?.name === roleName) {
        setSelectedRole(null);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col gap-4">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Roles y Permisos
          </h1>
          <p className="text-muted-foreground">Gestione el acceso granular a los módulos del sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Rol
          </Button>
          <Button
            onClick={savePermissions}
            disabled={loading || !hasUnsavedChanges}
            variant={hasUnsavedChanges ? "default" : "secondary"}
          >
            <Save className="mr-2 h-4 w-4" />
            {hasUnsavedChanges ? "Guardar Cambios" : "Guardado"}
          </Button>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Sidebar: Roles List */}
        <Card className="w-80 flex flex-col shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Roles</CardTitle>
            <CardDescription>Seleccione un rol para editar</CardDescription>
          </CardHeader>
          <Separator />
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {roles.map((role) => (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border",
                    selectedRole?.id === role.id
                      ? "bg-primary/10 border-primary/50"
                      : "hover:bg-muted border-transparent"
                  )}
                >
                  <div className="space-y-1 overflow-hidden">
                    <div className="font-medium truncate">{role.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{role.description || "Sin descripción"}</div>
                  </div>
                  {role.name !== 'admin' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRole(role.name);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Main Panel: Permissions Matrix */}
        <Card className="flex-1 flex flex-col min-w-0">
          {selectedRole ? (
            <>
              <CardHeader className="pb-4 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="outline" className="text-base px-3 py-1 font-normal">
                        {selectedRole.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground font-normal">({selectedRole.name})</span>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Configure los permisos de acceso para este rol
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <div className="grid gap-6">
                    {modules.map((module) => {
                      const perm = getPermission(selectedRole.name, module.id);
                      const allEnabled = perm.can_view && perm.can_create && perm.can_edit && perm.can_delete;

                      return (
                        <div key={module.id} className="flex flex-col gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h3 className="font-semibold text-lg">{module.display_name}</h3>
                              <p className="text-sm text-muted-foreground">{module.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`all-${module.id}`} className="text-xs text-muted-foreground">
                                {allEnabled ? "Desactivar todo" : "Activar todo"}
                              </Label>
                              <Switch
                                id={`all-${module.id}`}
                                checked={allEnabled}
                                onCheckedChange={(checked) => toggleAllForModule(selectedRole.name, module.id, checked)}
                              />
                            </div>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="flex items-center justify-between space-x-2 p-2 rounded-lg bg-muted/30">
                              <Label htmlFor={`view-${module.id}`} className="flex flex-col cursor-pointer">
                                <span className="font-medium">Ver</span>
                                <span className="text-xs text-muted-foreground">Acceso de lectura</span>
                              </Label>
                              <Switch
                                id={`view-${module.id}`}
                                checked={perm.can_view}
                                onCheckedChange={(checked) => updatePermission(selectedRole.name, module.id, "can_view", checked)}
                              />
                            </div>

                            <div className="flex items-center justify-between space-x-2 p-2 rounded-lg bg-muted/30">
                              <Label htmlFor={`create-${module.id}`} className="flex flex-col cursor-pointer">
                                <span className="font-medium">Crear</span>
                                <span className="text-xs text-muted-foreground">Crear registros</span>
                              </Label>
                              <Switch
                                id={`create-${module.id}`}
                                checked={perm.can_create}
                                onCheckedChange={(checked) => updatePermission(selectedRole.name, module.id, "can_create", checked)}
                              />
                            </div>

                            <div className="flex items-center justify-between space-x-2 p-2 rounded-lg bg-muted/30">
                              <Label htmlFor={`edit-${module.id}`} className="flex flex-col cursor-pointer">
                                <span className="font-medium">Editar</span>
                                <span className="text-xs text-muted-foreground">Modificar registros</span>
                              </Label>
                              <Switch
                                id={`edit-${module.id}`}
                                checked={perm.can_edit}
                                onCheckedChange={(checked) => updatePermission(selectedRole.name, module.id, "can_edit", checked)}
                              />
                            </div>

                            <div className="flex items-center justify-between space-x-2 p-2 rounded-lg bg-muted/30">
                              <Label htmlFor={`delete-${module.id}`} className="flex flex-col cursor-pointer">
                                <span className="font-medium">Eliminar</span>
                                <span className="text-xs text-muted-foreground">Borrar registros</span>
                              </Label>
                              <Switch
                                id={`delete-${module.id}`}
                                checked={perm.can_delete}
                                onCheckedChange={(checked) => updatePermission(selectedRole.name, module.id, "can_delete", checked)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <Shield className="h-12 w-12 mx-auto opacity-20" />
                <p>Seleccione un rol para configurar sus permisos</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Rol</DialogTitle>
            <DialogDescription>
              Defina el nombre y etiqueta para el nuevo rol.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Identificador (interno)</Label>
              <Input
                placeholder="ej: supervisor_ventas"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              />
              <p className="text-xs text-muted-foreground">Usado en la base de datos. Minúsculas y guiones bajos.</p>
            </div>
            <div className="space-y-2">
              <Label>Etiqueta (visible)</Label>
              <Input
                placeholder="ej: Supervisor de Ventas"
                value={newRole.label}
                onChange={(e) => setNewRole({ ...newRole, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Descripción opcional"
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateRole}>Crear Rol</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
