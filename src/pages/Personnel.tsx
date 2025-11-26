import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Pencil, Trash2, Key, Upload, FileSpreadsheet, Search, Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Company {
  id: string;
  name: string;
}

interface EndUser {
  id: string;
  company_id: string;
  document_number: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  access_code: string | null;
  active: boolean;
  companies: { name: string };
}

export default function Personnel() {
  const [personnel, setPersonnel] = useState<EndUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<EndUser | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [formData, setFormData] = useState({
    company_id: "",
    document_number: "",
    full_name: "",
    phone: "",
    email: "",
    active: true
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [personnelRes, companiesRes] = await Promise.all([
      supabase
        .from("end_users")
        .select("*, companies(name)")
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").eq("active", true),
    ]);

    if (personnelRes.error) {
      toast({
        title: "Error",
        description: "No se pudo cargar el personal",
        variant: "destructive",
      });
    } else {
      setPersonnel(personnelRes.data || []);
    }

    if (!companiesRes.error) {
      setCompanies(companiesRes.data || []);
    }

    setLoading(false);
  };

  const generateAccessCode = (documentNumber: string, fullName: string) => {
    const namePart = fullName.split(" ")[0].toLowerCase();
    return `${documentNumber}_${namePart}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const accessCode = generateAccessCode(formData.document_number, formData.full_name);

    if (editingUser) {
      const { error } = await supabase
        .from("end_users")
        .update({ ...formData, access_code: accessCode })
        .eq("id", editingUser.id);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo actualizar el usuario",
          variant: "destructive",
        });
      } else {
        toast({ title: "Usuario actualizado correctamente" });
        setDialogOpen(false);
        loadData();
      }
    } else {
      const { error } = await supabase
        .from("end_users")
        .insert([{ ...formData, access_code: accessCode }]);

      if (error) {
        toast({
          title: "Error",
          description: error.message.includes("duplicate")
            ? "Ya existe un usuario con ese número de documento en esta empresa"
            : "No se pudo crear el usuario",
          variant: "destructive",
        });
      } else {
        toast({ title: "Usuario creado correctamente" });
        setDialogOpen(false);
        loadData();
      }
    }

    setFormData({
      company_id: "",
      document_number: "",
      full_name: "",
      phone: "",
      email: "",
      active: true
    });
    setEditingUser(null);
  };

  const handleEdit = (user: EndUser) => {
    setEditingUser(user);
    setFormData({
      company_id: user.company_id,
      document_number: user.document_number,
      full_name: user.full_name,
      phone: user.phone || "",
      email: user.email || "",
      active: user.active
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este usuario?")) {
      return;
    }

    const { error } = await supabase.from("end_users").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario",
        variant: "destructive",
      });
    } else {
      toast({ title: "Usuario eliminado correctamente" });
      loadData();
    }
  };

  const filteredPersonnel = personnel.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.document_number.includes(searchTerm) ||
      user.companies?.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCompany = filterCompany === "all" || user.company_id === filterCompany;
    const matchesStatus = filterStatus === "all" ||
      (filterStatus === "active" ? user.active : !user.active);

    return matchesSearch && matchesCompany && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Personal
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona los usuarios finales de cada empresa
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.location.href = "/bulk-personnel"}>
            <Upload className="mr-2 h-4 w-4" />
            Carga Masiva
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingUser(null);
                  setFormData({
                    company_id: "",
                    document_number: "",
                    full_name: "",
                    phone: "",
                    email: "",
                    active: true
                  });
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
                </DialogTitle>
                <DialogDescription>
                  {editingUser
                    ? "Modifica los datos del usuario"
                    : "Completa los datos para crear un nuevo usuario"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Empresa *</Label>
                    <Select
                      value={formData.company_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, company_id: value })
                      }
                      required
                    >
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
                    <Label htmlFor="document">Número de Documento *</Label>
                    <Input
                      id="document"
                      value={formData.document_number}
                      onChange={(e) =>
                        setFormData({ ...formData, document_number: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre Completo *</Label>
                    <Input
                      id="name"
                      value={formData.full_name}
                      onChange={(e) =>
                        setFormData({ ...formData, full_name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Celular</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Correo Electrónico</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Estado</Label>
                    <Select
                      value={formData.active ? "true" : "false"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, active: value === "true" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Activo</SelectItem>
                        <SelectItem value="false">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">
                    {editingUser ? "Actualizar" : "Crear"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-1 md:flex-none">
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las empresas</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>

              {(searchTerm || filterCompany !== "all" || filterStatus !== "all") && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterCompany("all");
                    setFilterStatus("all");
                  }}
                  title="Limpiar filtros"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredPersonnel.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron resultados con los filtros actuales.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Código Acceso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPersonnel.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {user.companies?.name || "Sin empresa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{user.document_number}</TableCell>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-muted-foreground">
                        <span>{user.phone || "-"}</span>
                        <span>{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active ? "default" : "secondary"}>
                        {user.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Key className="h-3 w-3 text-muted-foreground" />
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {user.access_code}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
