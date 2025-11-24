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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Grid3x3, Plus, Globe, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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
  const [activeTab, setActiveTab] = useState("global");
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
                      <CardTitle className="text-lg">{app.name}</CardTitle>
                      <Badge variant="outline">{app.companies.name}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
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
                    <CardTitle className="text-lg">{app.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
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
