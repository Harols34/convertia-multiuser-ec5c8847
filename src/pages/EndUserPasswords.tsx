import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, Key, Eye, EyeOff, RefreshCw, Shield, Users } from "lucide-react";
import BulkPasswordManager from "@/components/BulkPasswordManager";

interface EndUserRow {
  id: string;
  full_name: string;
  document_number: string;
  access_code: string | null;
  email: string | null;
  active: boolean;
  portal_password: string | null;
  companies: { name: string } | null;
}

export default function EndUserPasswords() {
  const [users, setUsers] = useState<EndUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<EndUserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("end_users")
      .select("id, full_name, document_number, access_code, email, active, portal_password, companies(name)")
      .order("full_name");

    if (!error && data) {
      setUsers(data as any);
    }
    setLoading(false);
  };

  const handleSetPassword = async () => {
    if (!selectedUser) return;
    if (!newPassword.trim()) {
      toast({ title: "Error", description: "La contraseña no puede estar vacía", variant: "destructive" });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 4 caracteres", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("set_end_user_password", {
      p_user_id: selectedUser.id,
      p_password: newPassword,
    });

    if (error) {
      toast({ title: "Error", description: "No se pudo establecer la contraseña", variant: "destructive" });
    } else {
      toast({ title: "Contraseña actualizada", description: `Se actualizó la contraseña de ${selectedUser.full_name}` });
      setDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      loadUsers();
    }
    setSaving(false);
  };

  const handleResetPassword = async (user: EndUserRow) => {
    setSaving(true);
    // Reset = remove password (set to null directly)
    const { error } = await supabase
      .from("end_users")
      .update({ portal_password: null })
      .eq("id", user.id);

    if (error) {
      toast({ title: "Error", description: "No se pudo resetear la contraseña", variant: "destructive" });
    } else {
      toast({ title: "Contraseña eliminada", description: `${user.full_name} ahora puede acceder sin contraseña` });
      loadUsers();
    }
    setSaving(false);
  };

  const filteredUsers = users.filter((u) => {
    const s = search.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(s) ||
      u.document_number.toLowerCase().includes(s) ||
      (u.access_code && u.access_code.toLowerCase().includes(s)) ||
      (u.email && u.email.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6 text-primary" />
            Contraseñas de Portal
          </h1>
          <p className="text-muted-foreground text-sm">
            Gestiona las contraseñas de acceso de los usuarios de "Busca tu Info"
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, documento, código o email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={loadUsers}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Contraseña</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No se encontraron usuarios
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell>{user.document_number}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {user.access_code || "—"}
                          </code>
                        </TableCell>
                        <TableCell>{user.companies?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={user.active ? "default" : "secondary"}>
                            {user.active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.portal_password ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                              <Shield className="h-3 w-3 mr-1" />
                              Asignada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              Sin contraseña
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setNewPassword("");
                                setConfirmPassword("");
                                setDialogOpen(true);
                              }}
                            >
                              <Key className="h-3 w-3 mr-1" />
                              {user.portal_password ? "Cambiar" : "Asignar"}
                            </Button>
                            {user.portal_password && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleResetPassword(user)}
                                disabled={saving}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Resetear
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Set/Change Password Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {selectedUser?.portal_password ? "Cambiar Contraseña" : "Asignar Contraseña"}
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p><strong>Usuario:</strong> {selectedUser.full_name}</p>
                <p><strong>Documento:</strong> {selectedUser.document_number}</p>
                <p><strong>Código:</strong> {selectedUser.access_code || "—"}</p>
              </div>
              <div className="space-y-2">
                <Label>Nueva Contraseña</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirmar Contraseña</Label>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSetPassword} disabled={saving}>
              {saving ? "Guardando..." : "Guardar Contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
