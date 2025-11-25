import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, UserPlus, Upload, DollarSign, TrendingUp, Users, Calendar, Download } from "lucide-react";
import { format, differenceInDays, differenceInMonths } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { ReferralsDashboard } from "@/components/ReferralsDashboard";

interface EndUser {
  id: string;
  full_name: string;
  document_number: string;
  company_id: string;
  companies: { name: string };
}

interface Referral {
  id: string;
  referring_user_id: string;
  referred_document: string;
  referred_name: string;
  campaign: string | null;
  status: "activo" | "baja";
  hire_date: string;
  termination_date: string | null;
  company_id: string;
  end_users: EndUser;
  companies: { name: string };
  referral_bonuses?: {
    id: string;
    bonus_amount: number;
    status: string;
    condition_met_date: string | null;
    paid_date: string | null;
  } | null;
}

interface ReferralConfig {
  bonus_amount: string;
  minimum_days: string;
  auto_alarm_enabled: string;
}

export default function Referrals() {
  const [users, setUsers] = useState<EndUser[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ReferralConfig>({
    bonus_amount: "500000",
    minimum_days: "60",
    auto_alarm_enabled: "true"
  });
  const { toast } = useToast();

  // Form states
  const [selectedUser, setSelectedUser] = useState<EndUser | null>(null);
  const [referralForm, setReferralForm] = useState({
    referred_document: "",
    referred_name: "",
    campaign: "",
    status: "activo" as "activo" | "baja",
    hire_date: "",
    termination_date: ""
  });

  useEffect(() => {
    loadData();
    loadConfig();
  }, [selectedCompany]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load companies
      const { data: companiesData } = await supabase
        .from("companies")
        .select("*")
        .eq("active", true)
        .order("name");
      setCompanies(companiesData || []);

      // Load users with referrals
      let usersQuery = supabase
        .from("end_users")
        .select("*, companies(name)")
        .eq("active", true);

      if (selectedCompany !== "all") {
        usersQuery = usersQuery.eq("company_id", selectedCompany);
      }

      const { data: usersData } = await usersQuery.order("full_name");
      setUsers(usersData || []);

      // Load referrals
      let referralsQuery = supabase
        .from("referrals")
        .select("*, end_users(*, companies(name)), companies(name), referral_bonuses(*)");

      if (selectedCompany !== "all") {
        referralsQuery = referralsQuery.eq("company_id", selectedCompany);
      }

      const { data: referralsData } = await referralsQuery.order("created_at", { ascending: false });
      setReferrals((referralsData || []) as any);
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

  const loadConfig = async () => {
    const { data } = await supabase
      .from("referral_config")
      .select("*");
    
    if (data) {
      const configObj: any = {};
      data.forEach(item => {
        configObj[item.config_key] = item.config_value;
      });
      setConfig(configObj);
    }
  };

  const saveConfig = async () => {
    try {
      for (const [key, value] of Object.entries(config)) {
        await supabase
          .from("referral_config")
          .update({ config_value: value })
          .eq("config_key", key);
      }
      toast({
        title: "Configuración guardada",
        description: "Los valores se actualizaron correctamente"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleCreateReferral = async () => {
    if (!selectedUser || !referralForm.referred_document || !referralForm.referred_name || !referralForm.hire_date) {
      toast({
        title: "Error",
        description: "Complete todos los campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    if (referralForm.status === "baja" && !referralForm.termination_date) {
      toast({
        title: "Error",
        description: "La fecha de baja es obligatoria cuando el estado es 'Baja'",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: referralData, error: referralError } = await supabase
        .from("referrals")
        .insert({
          referring_user_id: selectedUser.id,
          referred_document: referralForm.referred_document,
          referred_name: referralForm.referred_name,
          campaign: referralForm.campaign || null,
          status: referralForm.status,
          hire_date: referralForm.hire_date,
          termination_date: referralForm.termination_date || null,
          company_id: selectedUser.company_id
        })
        .select()
        .single();

      if (referralError) throw referralError;

      // Check if condition is met and create bonus record
      const hireDate = new Date(referralForm.hire_date);
      const today = new Date();
      const daysSinceHire = differenceInDays(today, hireDate);
      const minimumDays = parseInt(config.minimum_days);

      if (daysSinceHire >= minimumDays && referralForm.status === "activo") {
        await supabase
          .from("referral_bonuses")
          .insert({
            referral_id: referralData.id,
            bonus_amount: parseFloat(config.bonus_amount),
            condition_met_date: format(new Date(), "yyyy-MM-dd"),
            status: "pendiente"
          });
      }

      toast({
        title: "Éxito",
        description: "Referido creado correctamente"
      });

      setReferralForm({
        referred_document: "",
        referred_name: "",
        campaign: "",
        status: "activo",
        hire_date: "",
        termination_date: ""
      });
      setSelectedUser(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleBulkUpload = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      for (const row of jsonData) {
        const user = users.find(u => u.document_number === row["Documento Usuario"]);
        if (!user) continue;

        await supabase.from("referrals").insert({
          referring_user_id: user.id,
          referred_document: row["Documento Referido"],
          referred_name: row["Nombre Referido"],
          campaign: row["Campaña"] || null,
          status: row["Estado"]?.toLowerCase() === "baja" ? "baja" : "activo",
          hire_date: row["Fecha Contratación"],
          termination_date: row["Fecha Baja"] || null,
          company_id: user.company_id
        });
      }

      toast({
        title: "Éxito",
        description: `${jsonData.length} referidos cargados correctamente`
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const calculateTime = (referral: Referral) => {
    const hireDate = new Date(referral.hire_date);
    const endDate = referral.status === "baja" && referral.termination_date
      ? new Date(referral.termination_date)
      : new Date();
    
    const days = differenceInDays(endDate, hireDate);
    const months = differenceInMonths(endDate, hireDate);
    
    return { days, months };
  };

  const exportToExcel = () => {
    const data = referrals.map(r => {
      const time = calculateTime(r);
      return {
        "Usuario que Refiere": r.end_users.full_name,
        "Documento Usuario": r.end_users.document_number,
        "Empresa": r.companies.name,
        "Referido": r.referred_name,
        "Documento Referido": r.referred_document,
        "Campaña": r.campaign || "",
        "Estado": r.status,
        "Fecha Contratación": format(new Date(r.hire_date), "dd/MM/yyyy"),
        "Fecha Baja": r.termination_date ? format(new Date(r.termination_date), "dd/MM/yyyy") : "",
        "Días Activo": time.days,
        "Meses Activo": time.months,
        "Estado Bono": r.referral_bonuses?.[0]?.status || "pendiente",
        "Valor Bono": r.referral_bonuses?.[0]?.bonus_amount || config.bonus_amount
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Referidos");
    XLSX.writeFile(wb, `referidos_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.document_number.includes(searchTerm)
  );

  const filteredReferrals = referrals.filter(r =>
    r.end_users.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.referred_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.referred_document.includes(searchTerm)
  );

  // Calculate metrics
  const activeReferrals = referrals.filter(r => r.status === "activo").length;
  const inactiveReferrals = referrals.filter(r => r.status === "baja").length;
  const pendingBonuses = referrals.filter(r => r.referral_bonuses?.[0]?.status === "pendiente").length;
  const paidBonuses = referrals.filter(r => r.referral_bonuses?.[0]?.status === "pagado").length;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Referidos</h1>
            <p className="text-muted-foreground">Control de referidos, bonos y alarmas</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToExcel} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="referrals" className="space-y-4">
          <TabsList>
            <TabsTrigger value="referrals">Referidos</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="config">Configuración</TabsTrigger>
          </TabsList>

          <TabsContent value="referrals" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Referidos Activos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeReferrals}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Referidos Baja</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{inactiveReferrals}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bonos Pendientes</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingBonuses}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bonos Pagados</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{paidBonuses}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Listado de Referidos</CardTitle>
                    <CardDescription>Todos los referidos registrados</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64"
                    />
                    <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las empresas</SelectItem>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Asignar Referido
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Asignar Nuevo Referido</DialogTitle>
                          <DialogDescription>Complete la información del referido</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Usuario que Refiere</Label>
                            <Select
                              value={selectedUser?.id}
                              onValueChange={(value) => {
                                const user = users.find(u => u.id === value);
                                setSelectedUser(user || null);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione usuario" />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredUsers.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.full_name} - {u.document_number}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Documento del Referido</Label>
                              <Input
                                value={referralForm.referred_document}
                                onChange={(e) => setReferralForm({ ...referralForm, referred_document: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Nombre Completo del Referido</Label>
                              <Input
                                value={referralForm.referred_name}
                                onChange={(e) => setReferralForm({ ...referralForm, referred_name: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Campaña / Proyecto</Label>
                              <Input
                                value={referralForm.campaign}
                                onChange={(e) => setReferralForm({ ...referralForm, campaign: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Estado</Label>
                              <Select
                                value={referralForm.status}
                                onValueChange={(value: "activo" | "baja") => setReferralForm({ ...referralForm, status: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="activo">Activo</SelectItem>
                                  <SelectItem value="baja">Baja</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Fecha de Contratación</Label>
                              <Input
                                type="date"
                                value={referralForm.hire_date}
                                onChange={(e) => setReferralForm({ ...referralForm, hire_date: e.target.value })}
                              />
                            </div>
                            {referralForm.status === "baja" && (
                              <div>
                                <Label>Fecha de Baja</Label>
                                <Input
                                  type="date"
                                  value={referralForm.termination_date}
                                  onChange={(e) => setReferralForm({ ...referralForm, termination_date: e.target.value })}
                                />
                              </div>
                            )}
                          </div>
                          <Button onClick={handleCreateReferral} className="w-full">
                            Crear Referido
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Upload className="mr-2 h-4 w-4" />
                          Carga Masiva
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Carga Masiva de Referidos</DialogTitle>
                          <DialogDescription>Suba un archivo Excel con los datos</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleBulkUpload(file);
                            }}
                          />
                          <p className="text-sm text-muted-foreground">
                            Columnas requeridas: Documento Usuario, Documento Referido, Nombre Referido, Campaña, Estado, Fecha Contratación, Fecha Baja
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario que Refiere</TableHead>
                      <TableHead>Referido</TableHead>
                      <TableHead>Campaña</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha Contratación</TableHead>
                      <TableHead>Tiempo</TableHead>
                      <TableHead>Bono</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReferrals.map((referral) => {
                      const time = calculateTime(referral);
                      return (
                        <TableRow key={referral.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{referral.end_users.full_name}</div>
                              <div className="text-sm text-muted-foreground">{referral.end_users.document_number}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{referral.referred_name}</div>
                              <div className="text-sm text-muted-foreground">{referral.referred_document}</div>
                            </div>
                          </TableCell>
                          <TableCell>{referral.campaign || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={referral.status === "activo" ? "default" : "secondary"}>
                              {referral.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(referral.hire_date), "dd/MM/yyyy", { locale: es })}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{time.months} meses</div>
                              <div className="text-muted-foreground">{time.days} días</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={referral.referral_bonuses?.[0]?.status === "pagado" ? "default" : "outline"}>
                              {referral.referral_bonuses?.[0]?.status || "pendiente"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard">
            <Card>
              <CardHeader>
                <CardTitle>Dashboard de Métricas</CardTitle>
                <CardDescription>Análisis y visualización de datos</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Dashboard de métricas en desarrollo</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle>Configuración Global</CardTitle>
                <CardDescription>Parámetros del sistema de referidos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Valor del Bono (COP)</Label>
                  <Input
                    type="number"
                    value={config.bonus_amount}
                    onChange={(e) => setConfig({ ...config, bonus_amount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Días Mínimos para Bono</Label>
                  <Input
                    type="number"
                    value={config.minimum_days}
                    onChange={(e) => setConfig({ ...config, minimum_days: e.target.value })}
                  />
                </div>
                <Button onClick={saveConfig}>Guardar Configuración</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
