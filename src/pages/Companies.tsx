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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Pencil, Trash2, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Company {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
}

interface ModuleVisibility {
  id: string;
  company_id: string;
  module_name: string;
  visible: boolean;
}

const AVAILABLE_MODULES = [
  { name: "applications", label: "Mis Aplicativos" },
  { name: "alarms", label: "Mis Alarmas" },
  { name: "create_alarm", label: "Crear Alarma" },
  { name: "chat", label: "Chat" },
  { name: "referrals", label: "Referidos" }
];

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [moduleVisibilityOpen, setModuleVisibilityOpen] = useState(false);
  const [selectedCompanyForModules, setSelectedCompanyForModules] = useState<Company | null>(null);
  const [moduleVisibility, setModuleVisibility] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las empresas",
        variant: "destructive",
      });
    } else {
      setCompanies(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCompany) {
      const { error } = await supabase
        .from("companies")
        .update(formData)
        .eq("id", editingCompany.id);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo actualizar la empresa",
          variant: "destructive",
        });
      } else {
        toast({ title: "Empresa actualizada correctamente" });
        setDialogOpen(false);
        loadCompanies();
      }
    } else {
      const { error } = await supabase
        .from("companies")
        .insert([formData]);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo crear la empresa",
          variant: "destructive",
        });
      } else {
        toast({ title: "Empresa creada correctamente" });
        setDialogOpen(false);
        loadCompanies();
      }
    }

    setFormData({ name: "", description: "" });
    setEditingCompany(null);
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({ name: company.name, description: company.description || "" });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta empresa? Esto eliminará todos sus datos relacionados.")) {
      return;
    }

    const { error } = await supabase
      .from("companies")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la empresa",
        variant: "destructive",
      });
    } else {
      toast({ title: "Empresa eliminada correctamente" });
      loadCompanies();
    }
  };

  const handleConfigureModules = async (company: Company) => {
    setSelectedCompanyForModules(company);
    
    // Load current visibility settings
    const { data } = await supabase
      .from("company_module_visibility")
      .select("*")
      .eq("company_id", company.id);
    
    const visibilityMap: Record<string, boolean> = {};
    AVAILABLE_MODULES.forEach(module => {
      const existing = data?.find(v => v.module_name === module.name);
      visibilityMap[module.name] = existing?.visible ?? true;
    });
    
    setModuleVisibility(visibilityMap);
    setModuleVisibilityOpen(true);
  };

  const saveModuleVisibility = async () => {
    if (!selectedCompanyForModules) return;

    try {
      // Delete existing visibility records
      await supabase
        .from("company_module_visibility")
        .delete()
        .eq("company_id", selectedCompanyForModules.id);

      // Insert new visibility records
      const records = AVAILABLE_MODULES.map(module => ({
        company_id: selectedCompanyForModules.id,
        module_name: module.name,
        visible: moduleVisibility[module.name] ?? true
      }));

      const { error } = await supabase
        .from("company_module_visibility")
        .insert(records);

      if (error) throw error;

      toast({
        title: "Configuración guardada",
        description: "La visibilidad de módulos se actualizó correctamente"
      });
      setModuleVisibilityOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona las cuentas empresariales del sistema
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingCompany(null); setFormData({ name: "", description: "" }); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? "Editar Empresa" : "Nueva Empresa"}
              </DialogTitle>
              <DialogDescription>
                {editingCompany
                  ? "Modifica los datos de la empresa"
                  : "Completa los datos para crear una nueva empresa"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">
                  {editingCompany ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay empresas registradas</h3>
            <p className="text-sm text-muted-foreground">
              Crea tu primera empresa para comenzar
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Card key={company.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{company.name}</CardTitle>
                  <Badge variant={company.active ? "default" : "secondary"}>
                    {company.active ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleConfigureModules(company)}
                    title="Configurar módulos visibles"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(company)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(company.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {company.description || "Sin descripción"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Creada: {new Date(company.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Module Visibility Dialog */}
      <Dialog open={moduleVisibilityOpen} onOpenChange={setModuleVisibilityOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Módulos Visibles</DialogTitle>
            <DialogDescription>
              Seleccione qué módulos estarán visibles en "Busca tu Información" para {selectedCompanyForModules?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {AVAILABLE_MODULES.map((module) => (
              <div key={module.name} className="flex items-center space-x-2">
                <Checkbox
                  id={module.name}
                  checked={moduleVisibility[module.name] ?? true}
                  onCheckedChange={(checked) => 
                    setModuleVisibility({ ...moduleVisibility, [module.name]: checked as boolean })
                  }
                />
                <Label htmlFor={module.name} className="cursor-pointer">
                  {module.label}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={saveModuleVisibility}>
              Guardar Configuración
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
