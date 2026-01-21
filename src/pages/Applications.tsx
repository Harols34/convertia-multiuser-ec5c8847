import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Grid3x3, Plus, Globe, Building2, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GlobalApp {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  active: boolean;
}

interface CompanyApp extends GlobalApp {
  company_id: string;
  notes: string | null;
  companies: { name: string };
}

interface Company {
  id: string;
  name: string;
}

export default function Applications() {
  const [globalApps, setGlobalApps] = useState<GlobalApp[]>([]);
  const [companyApps, setCompanyApps] = useState<CompanyApp[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("global");
  const [editingApp, setEditingApp] = useState<(GlobalApp | CompanyApp) | null>(null);
  const [editingType, setEditingType] = useState<"global" | "company">("global");
  const [deletingApp, setDeletingApp] = useState<{ id: string; type: "global" | "company"; name: string } | null>(null);
  
  const [globalFormData, setGlobalFormData] = useState({
    name: "",
    description: "",
    url: "",
  });
  const [companyFormData, setCompanyFormData] = useState({
    company_id: "",
    name: "",
    description: "",
    url: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [globalRes, companyRes, companiesRes] = await Promise.all([
      supabase.from("global_applications").select("*").order("created_at", { ascending: false }),
      supabase
        .from("company_applications")
        .select("*, companies(name)")
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").eq("active", true),
    ]);

    if (!globalRes.error) setGlobalApps(globalRes.data || []);
    if (!companyRes.error) setCompanyApps(companyRes.data || []);
    if (!companiesRes.error) setCompanies(companiesRes.data || []);

    setLoading(false);
  };

  const handleGlobalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("global_applications").insert([globalFormData]);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo crear el aplicativo global",
        variant: "destructive",
      });
    } else {
      toast({ title: "Aplicativo global creado correctamente" });
      setDialogOpen(false);
      setGlobalFormData({ name: "", description: "", url: "" });
      loadData();
    }
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("company_applications").insert([companyFormData]);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo crear el aplicativo",
        variant: "destructive",
      });
    } else {
      toast({ title: "Aplicativo creado correctamente" });
      setDialogOpen(false);
      setCompanyFormData({
        company_id: "",
        name: "",
        description: "",
        url: "",
        notes: "",
      });
      loadData();
    }
  };

  const handleEditGlobal = (app: GlobalApp) => {
    setEditingApp(app);
    setEditingType("global");
    setGlobalFormData({
      name: app.name,
      description: app.description || "",
      url: app.url || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditCompany = (app: CompanyApp) => {
    setEditingApp(app);
    setEditingType("company");
    setCompanyFormData({
      company_id: app.company_id,
      name: app.name,
      description: app.description || "",
      url: app.url || "",
      notes: app.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp) return;

    const { error } = await supabase
      .from("global_applications")
      .update(globalFormData)
      .eq("id", editingApp.id);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el aplicativo",
        variant: "destructive",
      });
    } else {
      toast({ title: "Aplicativo actualizado correctamente" });
      setEditDialogOpen(false);
      setEditingApp(null);
      loadData();
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp) return;

    const { error } = await supabase
      .from("company_applications")
      .update(companyFormData)
      .eq("id", editingApp.id);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el aplicativo",
        variant: "destructive",
      });
    } else {
      toast({ title: "Aplicativo actualizado correctamente" });
      setEditDialogOpen(false);
      setEditingApp(null);
      loadData();
    }
  };

  const handleDeleteClick = (id: string, type: "global" | "company", name: string) => {
    setDeletingApp({ id, type, name });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingApp) return;

    const table = deletingApp.type === "global" ? "global_applications" : "company_applications";
    const { error } = await supabase.from(table).delete().eq("id", deletingApp.id);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el aplicativo. Puede que tenga credenciales asociadas.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Aplicativo eliminado correctamente" });
      loadData();
    }
    setDeleteDialogOpen(false);
    setDeletingApp(null);
  };

  const handleToggleActive = async (id: string, type: "global" | "company", currentActive: boolean) => {
    const table = type === "global" ? "global_applications" : "company_applications";
    const { error } = await supabase.from(table).update({ active: !currentActive }).eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado",
        variant: "destructive",
      });
    } else {
      toast({ title: currentActive ? "Aplicativo desactivado" : "Aplicativo activado" });
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Aplicativos</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona aplicativos globales y por empresa
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Aplicativo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nuevo Aplicativo</DialogTitle>
              <DialogDescription>
                Selecciona el tipo de aplicativo a crear
              </DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="global">
                  <Globe className="mr-2 h-4 w-4" />
                  Global
                </TabsTrigger>
                <TabsTrigger value="company">
                  <Building2 className="mr-2 h-4 w-4" />
                  Por Empresa
                </TabsTrigger>
              </TabsList>

              <TabsContent value="global">
                <form onSubmit={handleGlobalSubmit}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="global-name">Nombre *</Label>
                      <Input
                        id="global-name"
                        value={globalFormData.name}
                        onChange={(e) =>
                          setGlobalFormData({ ...globalFormData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="global-desc">Descripción</Label>
                      <Textarea
                        id="global-desc"
                        value={globalFormData.description}
                        onChange={(e) =>
                          setGlobalFormData({ ...globalFormData, description: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="global-url">URL</Label>
                      <Input
                        id="global-url"
                        type="url"
                        value={globalFormData.url}
                        onChange={(e) =>
                          setGlobalFormData({ ...globalFormData, url: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Crear Aplicativo Global</Button>
                  </DialogFooter>
                </form>
              </TabsContent>

              <TabsContent value="company">
                <form onSubmit={handleCompanySubmit}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-select">Empresa *</Label>
                      <Select
                        value={companyFormData.company_id}
                        onValueChange={(value) =>
                          setCompanyFormData({ ...companyFormData, company_id: value })
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
                      <Label htmlFor="company-name">Nombre *</Label>
                      <Input
                        id="company-name"
                        value={companyFormData.name}
                        onChange={(e) =>
                          setCompanyFormData({ ...companyFormData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-url">URL</Label>
                      <Input
                        id="company-url"
                        type="url"
                        value={companyFormData.url}
                        onChange={(e) =>
                          setCompanyFormData({ ...companyFormData, url: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-desc">Descripción</Label>
                      <Textarea
                        id="company-desc"
                        value={companyFormData.description}
                        onChange={(e) =>
                          setCompanyFormData({ ...companyFormData, description: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-notes">Notas</Label>
                      <Textarea
                        id="company-notes"
                        value={companyFormData.notes}
                        onChange={(e) =>
                          setCompanyFormData({ ...companyFormData, notes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Crear Aplicativo</Button>
                  </DialogFooter>
                </form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Aplicativo</DialogTitle>
            <DialogDescription>
              Modifica la información del aplicativo
            </DialogDescription>
          </DialogHeader>

          {editingType === "global" ? (
            <form onSubmit={handleUpdateGlobal}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-global-name">Nombre *</Label>
                  <Input
                    id="edit-global-name"
                    value={globalFormData.name}
                    onChange={(e) =>
                      setGlobalFormData({ ...globalFormData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-global-desc">Descripción</Label>
                  <Textarea
                    id="edit-global-desc"
                    value={globalFormData.description}
                    onChange={(e) =>
                      setGlobalFormData({ ...globalFormData, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-global-url">URL</Label>
                  <Input
                    id="edit-global-url"
                    type="url"
                    value={globalFormData.url}
                    onChange={(e) =>
                      setGlobalFormData({ ...globalFormData, url: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar Cambios</Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={handleUpdateCompany}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-company-select">Empresa *</Label>
                  <Select
                    value={companyFormData.company_id}
                    onValueChange={(value) =>
                      setCompanyFormData({ ...companyFormData, company_id: value })
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
                  <Label htmlFor="edit-company-name">Nombre *</Label>
                  <Input
                    id="edit-company-name"
                    value={companyFormData.name}
                    onChange={(e) =>
                      setCompanyFormData({ ...companyFormData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-company-url">URL</Label>
                  <Input
                    id="edit-company-url"
                    type="url"
                    value={companyFormData.url}
                    onChange={(e) =>
                      setCompanyFormData({ ...companyFormData, url: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-company-desc">Descripción</Label>
                  <Textarea
                    id="edit-company-desc"
                    value={companyFormData.description}
                    onChange={(e) =>
                      setCompanyFormData({ ...companyFormData, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-company-notes">Notas</Label>
                  <Textarea
                    id="edit-company-notes"
                    value={companyFormData.notes}
                    onChange={(e) =>
                      setCompanyFormData({ ...companyFormData, notes: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar Cambios</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar aplicativo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el aplicativo
              <strong> "{deletingApp?.name}"</strong>.
              {deletingApp?.type === "global" 
                ? " Esto puede afectar credenciales asociadas a este aplicativo global."
                : " Esto puede afectar credenciales de usuarios asociadas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Aplicativos por Empresa</TabsTrigger>
          <TabsTrigger value="global">Aplicativos Globales</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : companyApps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Grid3x3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No hay aplicativos de empresa
                </h3>
                <p className="text-sm text-muted-foreground">
                  Crea el primer aplicativo para una empresa
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {companyApps.map((app) => (
                <Card key={app.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{app.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">{app.companies.name}</Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditCompany(app)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(app.id, "company", app.active)}>
                            {app.active ? "Desactivar" : "Activar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClick(app.id, "company", app.name)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {!app.active && (
                      <Badge variant="secondary" className="mb-2">Inactivo</Badge>
                    )}
                    {app.description && (
                      <p className="text-sm text-muted-foreground">{app.description}</p>
                    )}
                    {app.url && (
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline block"
                      >
                        Abrir aplicativo →
                      </a>
                    )}
                    {app.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">{app.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="global" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : globalApps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay aplicativos globales</h3>
                <p className="text-sm text-muted-foreground">
                  Crea el primer aplicativo global
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {globalApps.map((app) => (
                <Card key={app.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{app.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditGlobal(app)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(app.id, "global", app.active)}>
                            {app.active ? "Desactivar" : "Activar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClick(app.id, "global", app.name)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!app.active && (
                      <Badge variant="secondary" className="mb-2">Inactivo</Badge>
                    )}
                    {app.description && (
                      <p className="text-sm text-muted-foreground mb-2">{app.description}</p>
                    )}
                    {app.url && (
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Abrir aplicativo →
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}