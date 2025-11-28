import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Pencil, Save, X, Plus, Check } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: string;
    user_companies?: { company_id: string, companies: { name: string } }[];
}

interface Company {
    id: string;
    name: string;
}

export default function SystemUsers() {
    const [users, setUsers] = useState<Profile[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [roles, setRoles] = useState<{ name: string; label: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<Profile | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newUser, setNewUser] = useState({
        email: "",
        password: "",
        full_name: "",
        role: "moderator",
        company_ids: [] as string[]
    });
    const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load users with company details (many-to-many)
            const { data: profilesData, error: profilesError } = await supabase
                .from("profiles")
                .select(`
          *,
          user_companies (
            company_id,
            companies (name)
          )
        `)
                .order("full_name");

            if (profilesError) throw profilesError;

            // Load companies for the selector
            const { data: companiesData, error: companiesError } = await supabase
                .from("companies")
                .select("id, name")
                .eq("active", true)
                .order("name");

            if (companiesError) throw companiesError;

            // Load roles
            const { data: rolesData, error: rolesError } = await supabase
                .from("roles")
                .select("name, label")
                .order("label");

            if (rolesError) throw rolesError;

            setUsers((profilesData as any) || []);
            setCompanies(companiesData || []);
            setRoles((rolesData as { name: string; label: string }[]) || []);
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (user: Profile) => {
        setEditingUser({ ...user });
        setSelectedCompanies(user.user_companies?.map(uc => uc.company_id) || []);
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!editingUser) return;

        try {
            // 1. Update Profile
            const { error: profileError } = await supabase
                .from("profiles")
                .update({
                    full_name: editingUser.full_name,
                    role: editingUser.role as any,
                })
                .eq("id", editingUser.id);

            if (profileError) throw profileError;

            // 2. Update Companies (Delete all and re-insert)
            // Note: In a real app, you might want to be smarter about this (diffing)
            const { error: deleteError } = await supabase
                .from("user_companies" as any)
                .delete()
                .eq("user_id", editingUser.id);

            if (deleteError) throw deleteError;

            if (selectedCompanies.length > 0) {
                const { error: insertError } = await supabase
                    .from("user_companies" as any)
                    .insert(
                        selectedCompanies.map(companyId => ({
                            user_id: editingUser.id,
                            company_id: companyId
                        }))
                    );

                if (insertError) throw insertError;
            }

            toast({
                title: "Éxito",
                description: "Usuario actualizado correctamente",
            });
            setIsDialogOpen(false);
            loadData();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleCreateUser = async () => {
        if (!newUser.email || !newUser.password || !newUser.full_name) {
            toast({
                title: "Error",
                description: "Por favor complete todos los campos obligatorios",
                variant: "destructive"
            });
            return;
        }

        try {
            const { data, error } = await supabase.rpc('create_system_user' as any, {
                email: newUser.email,
                password: newUser.password,
                full_name: newUser.full_name,
                role_name: newUser.role, // Changed from role to role_name to match RPC
                company_ids: newUser.company_ids
            });

            if (error) throw error;

            toast({
                title: "Éxito",
                description: "Usuario creado correctamente",
            });
            setIsCreateDialogOpen(false);
            setNewUser({
                email: "",
                password: "",
                full_name: "",
                role: "moderator",
                company_ids: []
            });
            loadData();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const toggleCompanySelection = (companyId: string, isCreating: boolean = false) => {
        if (isCreating) {
            setNewUser(prev => {
                const exists = prev.company_ids.includes(companyId);
                return {
                    ...prev,
                    company_ids: exists
                        ? prev.company_ids.filter(id => id !== companyId)
                        : [...prev.company_ids, companyId]
                };
            });
        } else {
            setSelectedCompanies(prev => {
                const exists = prev.includes(companyId);
                return exists
                    ? prev.filter(id => id !== companyId)
                    : [...prev, companyId];
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Users className="h-8 w-8" />
                        Usuarios del Sistema
                    </h1>
                    <p className="text-muted-foreground">Gestione los roles y asignación de empresas</p>
                </div>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Usuario
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Lista de Usuarios</CardTitle>
                    <CardDescription>
                        Usuarios con acceso a la plataforma
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Empresas Asignadas</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.full_name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                                            {roles.find(r => r.name === user.role)?.label || user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {user.role === "admin" ? (
                                            <span className="text-muted-foreground italic">Todas (Admin)</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {user.user_companies && user.user_companies.length > 0 ? (
                                                    user.user_companies.map((uc, idx) => (
                                                        <Badge key={idx} variant="outline" className="text-xs">
                                                            {uc.companies?.name}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">Sin asignar</span>
                                                )}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit User Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Editar Usuario</DialogTitle>
                        <DialogDescription>
                            Modifique el nombre, rol y empresas asignadas.
                        </DialogDescription>
                    </DialogHeader>

                    {editingUser && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nombre Completo</Label>
                                <Input
                                    value={editingUser.full_name}
                                    onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Rol</Label>
                                <Select
                                    value={editingUser.role}
                                    onValueChange={(val) => setEditingUser({ ...editingUser, role: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map(role => (
                                            <SelectItem key={role.name} value={role.name}>
                                                {role.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Empresas Asignadas</Label>
                                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                                    <div className="space-y-4">
                                        {companies.map((company) => (
                                            <div key={company.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`edit-${company.id}`}
                                                    checked={selectedCompanies.includes(company.id)}
                                                    onCheckedChange={() => toggleCompanySelection(company.id)}
                                                    disabled={editingUser.role === "admin"}
                                                />
                                                <label
                                                    htmlFor={`edit-${company.id}`}
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                    {company.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                {editingUser.role === "admin" && (
                                    <p className="text-xs text-muted-foreground">Los administradores tienen acceso global por defecto.</p>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave}>Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create User Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                        <DialogDescription>
                            Complete la información para crear un nuevo usuario en el sistema.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Contraseña</Label>
                                <Input
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Nombre Completo</Label>
                            <Input
                                value={newUser.full_name}
                                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Rol</Label>
                            <Select
                                value={newUser.role}
                                onValueChange={(val) => setNewUser({ ...newUser, role: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map(role => (
                                        <SelectItem key={role.name} value={role.name}>
                                            {role.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Empresas Asignadas</Label>
                            <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                                <div className="space-y-4">
                                    {companies.map((company) => (
                                        <div key={company.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`create-${company.id}`}
                                                checked={newUser.company_ids.includes(company.id)}
                                                onCheckedChange={() => toggleCompanySelection(company.id, true)}
                                                disabled={newUser.role === "admin"}
                                            />
                                            <label
                                                htmlFor={`create-${company.id}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                {company.name}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            {newUser.role === "admin" && (
                                <p className="text-xs text-muted-foreground">Los administradores tienen acceso global por defecto.</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateUser}>Crear Usuario</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
