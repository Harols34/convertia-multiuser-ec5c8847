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
import { Users, Plus, Pencil, Trash2, Key, Upload, FileSpreadsheet } from "lucide-react";
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
  const [formData, setFormData] = useState({
    company_id: "",
    document_number: "",
    full_name: "",
    phone: "",
    email: "",
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personal</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona los usuarios finales de cada empresa
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = "/bulk-personnel"}>
            <Upload className="mr-2 h-4 w-4" />
            Carga CSV
          </Button>
          <Button variant="outline" onClick={() => window.location.href = "/bulk-paste"}>
            <Upload className="mr-2 h-4 w-4" />
            Copiar y Pegar
          </Button>

          <Button variant="outline" onClick={() => window.location.href = "/bulk-edit"}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Vista Excel
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

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : personnel.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay personal registrado</h3>
            <p className="text-sm text-muted-foreground">
              Crea el primer usuario para comenzar
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Listado de Personal</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Celular</TableHead>
                  <TableHead>Código de Acceso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personnel.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.companies?.name || "Sin empresa"}
                    </TableCell>
                    <TableCell>{user.document_number}</TableCell>
                    <TableCell>{user.full_name}</TableCell>
                    <TableCell>{user.phone || "-"}</TableCell>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
