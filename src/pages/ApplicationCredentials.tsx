import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, RefreshCw, Search, Eye, EyeOff, Users, Key } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Company {
  id: string;
  name: string;
}

interface Application {
  id: string;
  name: string;
  type: "global" | "company";
}

interface EndUser {
  id: string;
  full_name: string;
  document_number: string;
}

interface UserAppCredential {
  user_id: string;
  app_id: string;
  username: string;
  password: string;
  notes: string;
}

export default function ApplicationCredentials() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>("");
  const [users, setUsers] = useState<EndUser[]>([]);
  const [credentials, setCredentials] = useState<UserAppCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Bulk update state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkUsername, setBulkUsername] = useState("");
  const [bulkPassword, setBulkPassword] = useState("");
  const [selectedAppsForBulk, setSelectedAppsForBulk] = useState<string[]>([]);
  const [selectedUsersForBulk, setSelectedUsersForBulk] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSearchTerm, setBulkSearchTerm] = useState("");

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadApplicationsAndUsers();
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (selectedApp && selectedCompany) {
      loadCredentials();
    }
  }, [selectedApp, selectedCompany]);

  const loadCompanies = async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .eq("active", true)
      .order("name");
    if (data) setCompanies(data);
  };

  const loadApplicationsAndUsers = async () => {
    setLoading(true);
    const [globalApps, companyApps, usersData] = await Promise.all([
      supabase.from("global_applications").select("id, name").eq("active", true),
      supabase
        .from("company_applications")
        .select("id, name")
        .eq("company_id", selectedCompany)
        .eq("active", true),
      supabase
        .from("end_users")
        .select("id, full_name, document_number")
        .eq("company_id", selectedCompany)
        .eq("active", true)
        .order("full_name"),
    ]);

    const apps: Application[] = [
      ...(globalApps.data?.map((a) => ({ ...a, type: "global" as const })) || []),
      ...(companyApps.data?.map((a) => ({ ...a, type: "company" as const })) || []),
    ];

    setApplications(apps);
    setUsers(usersData.data || []);
    setLoading(false);
  };

  const loadCredentials = async () => {
    const isGlobal = applications.find((a) => a.id === selectedApp)?.type === "global";
    
    const { data } = await supabase
      .from("user_applications")
      .select("*")
      .eq(isGlobal ? "global_application_id" : "application_id", selectedApp);

    const creds: UserAppCredential[] = users.map((user) => {
      const existing = data?.find((d) => d.end_user_id === user.id);
      return {
        user_id: user.id,
        app_id: selectedApp,
        username: existing?.username || "",
        password: existing?.password || "",
        notes: existing?.notes || "",
      };
    });

    setCredentials(creds);
  };

  const handleCredentialChange = (
    userId: string,
    field: "username" | "password" | "notes",
    value: string
  ) => {
    setCredentials((prev) =>
      prev.map((c) => (c.user_id === userId ? { ...c, [field]: value } : c))
    );
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const isGlobal = applications.find((a) => a.id === selectedApp)?.type === "global";

    try {
      for (const cred of credentials) {
        const { data: existing } = await supabase
          .from("user_applications")
          .select("id")
          .eq("end_user_id", cred.user_id)
          .eq(isGlobal ? "global_application_id" : "application_id", selectedApp)
          .single();

        const payload = {
          end_user_id: cred.user_id,
          [isGlobal ? "global_application_id" : "application_id"]: selectedApp,
          username: cred.username || null,
          password: cred.password || null,
          notes: cred.notes || null,
        };

        if (existing) {
          await supabase
            .from("user_applications")
            .update(payload)
            .eq("id", existing.id);
        } else {
          await supabase.from("user_applications").insert([payload]);
        }
      }

      toast({ title: "Credenciales guardadas correctamente" });
      loadCredentials();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron guardar las credenciales",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Bulk update functions
  const openBulkDialog = () => {
    setSelectedAppsForBulk([]);
    setSelectedUsersForBulk([]);
    setBulkUsername("");
    setBulkPassword("");
    setBulkSearchTerm("");
    setBulkDialogOpen(true);
  };

  const toggleAppSelection = (appId: string) => {
    setSelectedAppsForBulk((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    );
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsersForBulk((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    const filteredUsers = users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(bulkSearchTerm.toLowerCase()) ||
        u.document_number.includes(bulkSearchTerm)
    );
    setSelectedUsersForBulk(filteredUsers.map((u) => u.id));
  };

  const deselectAllUsers = () => {
    setSelectedUsersForBulk([]);
  };

  const selectAllApps = () => {
    setSelectedAppsForBulk(applications.map((a) => a.id));
  };

  const deselectAllApps = () => {
    setSelectedAppsForBulk([]);
  };

  const handleBulkUpdate = async () => {
    if (selectedUsersForBulk.length === 0 || selectedAppsForBulk.length === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos un usuario y un aplicativo",
        variant: "destructive",
      });
      return;
    }

    if (!bulkUsername && !bulkPassword) {
      toast({
        title: "Error",
        description: "Ingresa al menos usuario o contraseña para actualizar",
        variant: "destructive",
      });
      return;
    }

    setBulkSaving(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const userId of selectedUsersForBulk) {
        for (const appId of selectedAppsForBulk) {
          const app = applications.find((a) => a.id === appId);
          const isGlobal = app?.type === "global";

          // Check for existing record
          const { data: existing } = await supabase
            .from("user_applications")
            .select("id")
            .eq("end_user_id", userId)
            .eq(isGlobal ? "global_application_id" : "application_id", appId)
            .single();

          const updatePayload: Record<string, string | null> = {};
          if (bulkUsername) updatePayload.username = bulkUsername;
          if (bulkPassword) updatePayload.password = bulkPassword;

          if (existing) {
            const { error } = await supabase
              .from("user_applications")
              .update(updatePayload)
              .eq("id", existing.id);
            
            if (error) errorCount++;
            else successCount++;
          } else {
            const insertPayload = {
              end_user_id: userId,
              [isGlobal ? "global_application_id" : "application_id"]: appId,
              username: bulkUsername || null,
              password: bulkPassword || null,
            };
            const { error } = await supabase.from("user_applications").insert([insertPayload]);
            
            if (error) errorCount++;
            else successCount++;
          }
        }
      }

      toast({
        title: "Actualización masiva completada",
        description: `${successCount} credenciales actualizadas${errorCount > 0 ? `, ${errorCount} errores` : ""}`,
      });

      setBulkDialogOpen(false);
      if (selectedApp) loadCredentials();
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error durante la actualización masiva",
        variant: "destructive",
      });
    } finally {
      setBulkSaving(false);
    }
  };

  const filteredBulkUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(bulkSearchTerm.toLowerCase()) ||
      u.document_number.includes(bulkSearchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Credenciales</h1>
          <p className="text-muted-foreground mt-2">
            Asigna usuarios y contraseñas a los aplicativos por empresa
          </p>
        </div>
        {selectedCompany && (
          <Button onClick={openBulkDialog} variant="outline" className="gap-2">
            <Key className="h-4 w-4" />
            Actualización Masiva
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selección</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Empresa</label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Aplicativo</label>
              <Select
                value={selectedApp}
                onValueChange={setSelectedApp}
                disabled={!selectedCompany}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un aplicativo" />
                </SelectTrigger>
                <SelectContent>
                  {applications.map((app) => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.name} ({app.type === "global" ? "Global" : "Empresa"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedApp && selectedCompany && (
        <Card>
          <CardHeader className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle>Credenciales - {users.filter(u => 
                u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.document_number.includes(searchTerm)
              ).length} usuarios</CardTitle>
              <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadCredentials}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recargar
              </Button>
              <Button onClick={handleSaveAll} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Guardar Todos
              </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Usuario</th>
                    <th className="text-left p-3 font-medium">Documento</th>
                    <th className="text-left p-3 font-medium">Usuario App</th>
                    <th className="text-left p-3 font-medium">Contraseña</th>
                    <th className="text-left p-3 font-medium">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {credentials
                    .filter((cred) => {
                      const user = users.find((u) => u.id === cred.user_id);
                      if (!user) return false;
                      return (
                        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        user.document_number.includes(searchTerm)
                      );
                    })
                    .map((cred) => {
                    const user = users.find((u) => u.id === cred.user_id);
                    return (
                      <tr key={cred.user_id} className="border-t hover:bg-muted/50">
                        <td className="p-3">{user?.full_name}</td>
                        <td className="p-3">{user?.document_number}</td>
                        <td className="p-3">
                          <Input
                            value={cred.username}
                            onChange={(e) =>
                              handleCredentialChange(cred.user_id, "username", e.target.value)
                            }
                            placeholder="usuario123"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Input
                              type={visiblePasswords[cred.user_id] ? "text" : "password"}
                              value={cred.password}
                              onChange={(e) =>
                                handleCredentialChange(cred.user_id, "password", e.target.value)
                              }
                              placeholder="contraseña"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setVisiblePasswords(prev => ({
                                  ...prev,
                                  [cred.user_id]: !prev[cred.user_id]
                                }));
                              }}
                              className="px-2"
                            >
                              {visiblePasswords[cred.user_id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                        <td className="p-3">
                          <Input
                            value={cred.notes}
                            onChange={(e) =>
                              handleCredentialChange(cred.user_id, "notes", e.target.value)
                            }
                            placeholder="notas opcionales"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Update Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Actualización Masiva de Credenciales</DialogTitle>
            <DialogDescription>
              Ingresa usuario y/o contraseña una vez y selecciona los aplicativos donde se aplicará
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Credentials Input */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bulk-username">Usuario</Label>
                <Input
                  id="bulk-username"
                  value={bulkUsername}
                  onChange={(e) => setBulkUsername(e.target.value)}
                  placeholder="Nuevo usuario para los aplicativos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-password">Contraseña</Label>
                <Input
                  id="bulk-password"
                  type="password"
                  value={bulkPassword}
                  onChange={(e) => setBulkPassword(e.target.value)}
                  placeholder="Nueva contraseña para los aplicativos"
                />
              </div>
            </div>

            <Tabs defaultValue="apps" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="apps" className="gap-2">
                  <Key className="h-4 w-4" />
                  Aplicativos ({selectedAppsForBulk.length})
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-2">
                  <Users className="h-4 w-4" />
                  Usuarios ({selectedUsersForBulk.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="apps" className="mt-4">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllApps}>
                      Seleccionar todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAllApps}>
                      Deseleccionar todos
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px] border rounded-md p-4">
                    <div className="grid gap-2">
                      {applications.map((app) => (
                        <div key={app.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`app-${app.id}`}
                            checked={selectedAppsForBulk.includes(app.id)}
                            onCheckedChange={() => toggleAppSelection(app.id)}
                          />
                          <label
                            htmlFor={`app-${app.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                          >
                            {app.name}
                            <Badge variant="outline" className="text-xs">
                              {app.type === "global" ? "Global" : "Empresa"}
                            </Badge>
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="users" className="mt-4">
                <div className="space-y-3">
                  <div className="flex gap-2 items-center">
                    <Button variant="outline" size="sm" onClick={selectAllUsers}>
                      Seleccionar todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAllUsers}>
                      Deseleccionar todos
                    </Button>
                    <div className="flex-1">
                      <Input
                        placeholder="Buscar usuarios..."
                        value={bulkSearchTerm}
                        onChange={(e) => setBulkSearchTerm(e.target.value)}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <ScrollArea className="h-[200px] border rounded-md p-4">
                    <div className="grid gap-2">
                      {filteredBulkUsers.map((user) => (
                        <div key={user.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`user-${user.id}`}
                            checked={selectedUsersForBulk.includes(user.id)}
                            onCheckedChange={() => toggleUserSelection(user.id)}
                          />
                          <label
                            htmlFor={`user-${user.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {user.full_name}
                            <span className="text-muted-foreground ml-2">
                              ({user.document_number})
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>

            {/* Summary */}
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Resumen de la operación:</h4>
              <p className="text-sm text-muted-foreground">
                Se actualizarán las credenciales de <strong>{selectedUsersForBulk.length}</strong> usuario(s) 
                en <strong>{selectedAppsForBulk.length}</strong> aplicativo(s).
                {bulkUsername && <span> Usuario: <strong>{bulkUsername}</strong></span>}
                {bulkPassword && <span> Contraseña: <strong>••••••••</strong></span>}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkUpdate} disabled={bulkSaving}>
              {bulkSaving ? "Actualizando..." : "Aplicar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}