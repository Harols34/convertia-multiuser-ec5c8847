import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, Save } from "lucide-react";

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

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "moderator", label: "Especialista RH" }
];

export default function RolesPermissions() {
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(false);
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
      if (existing) {
        return prev.map(p => 
          p.role === role && p.module_id === moduleId
            ? { ...p, [field]: value }
            : p
        );
      } else {
        return [...prev, {
          role,
          module_id: moduleId,
          can_view: field === "can_view" ? value : false,
          can_create: field === "can_create" ? value : false,
          can_edit: field === "can_edit" ? value : false,
          can_delete: field === "can_delete" ? value : false
        }];
      }
    });
  };

  const savePermissions = async () => {
    setLoading(true);
    try {
      // Delete existing permissions
      await supabase.from("role_module_permissions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Insert new permissions
      const permissionsToInsert = permissions.filter(p => 
        p.can_view || p.can_create || p.can_edit || p.can_delete
      );

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

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Roles y Permisos
            </h1>
            <p className="text-muted-foreground">Configure el acceso a módulos por rol</p>
          </div>
          <Button onClick={savePermissions} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            Guardar Cambios
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Asignación de Módulos por Rol</CardTitle>
            <CardDescription>
              Seleccione los módulos y permisos para cada rol del sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ROLES.map((role) => (
              <div key={role.value} className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="default" className="text-base px-3 py-1">
                    {role.label}
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Módulo</TableHead>
                      <TableHead className="text-center">Ver</TableHead>
                      <TableHead className="text-center">Crear</TableHead>
                      <TableHead className="text-center">Editar</TableHead>
                      <TableHead className="text-center">Eliminar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules.map((module) => {
                      const perm = getPermission(role.value, module.id);
                      return (
                        <TableRow key={module.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{module.display_name}</div>
                              <div className="text-sm text-muted-foreground">{module.description}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.can_view}
                              onCheckedChange={(checked) => 
                                updatePermission(role.value, module.id, "can_view", checked as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.can_create}
                              onCheckedChange={(checked) => 
                                updatePermission(role.value, module.id, "can_create", checked as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.can_edit}
                              onCheckedChange={(checked) => 
                                updatePermission(role.value, module.id, "can_edit", checked as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.can_delete}
                              onCheckedChange={(checked) => 
                                updatePermission(role.value, module.id, "can_delete", checked as boolean)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
