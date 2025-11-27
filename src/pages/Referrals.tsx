import { useState, useEffect } from "react";
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
import { ReferralsDashboard } from "@/components/ReferralsDashboard";
import { Search, UserPlus, Upload, DollarSign, TrendingUp, Users, Calendar, Download, Pencil, AlertTriangle, Check, ChevronsUpDown, ClipboardPaste, Filter, X } from "lucide-react";
import { format, differenceInDays, differenceInMonths, addMonths, endOfMonth, setDate, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { auditService } from "@/lib/audit";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

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
  status: "iniciado" | "citado" | "seleccionado" | "capacitacion" | "contratado" | "finalizado";
  hire_date: string | null;
  termination_date: string | null;
  probation_end_date?: string | null;
  bonus_payment_date?: string | null;
  observations?: string | null;
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
    status: "iniciado" as any,
    hire_date: "",
    termination_date: "",
    observations: ""
  });

  // Edit states
  const [editingReferral, setEditingReferral] = useState<Referral | null>(null);
  const [editForm, setEditForm] = useState({
    status: "iniciado" as any,
    termination_date: "",
    bonus_status: "pendiente",
    hire_date: "",
    observations: ""
  });
  const [dialogCompanyFilter, setDialogCompanyFilter] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [pasteContent, setPasteContent] = useState("");
  const [importing, setImporting] = useState(false);

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

      // Sort bonuses for each referral to ensure we get the latest one
      const processedReferrals = (referralsData || []).map((r: any) => {
        let bonuses = r.referral_bonuses;

        // Ensure bonuses is an array
        if (bonuses && !Array.isArray(bonuses)) {
          bonuses = [bonuses];
        } else if (!bonuses) {
          bonuses = [];
        }

        return {
          ...r,
          referral_bonuses: bonuses.sort((a: any, b: any) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          )
        };
      });

      setReferrals(processedReferrals);
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

  const calculateDates = (hireDateStr: string) => {
    if (!hireDateStr) return { probationDate: null, paymentDate: null };

    const hireDate = new Date(hireDateStr);
    // 3 months probation
    const probationDate = addMonths(hireDate, 3);

    // Payment date: next 15th or end of month
    let paymentDate = new Date(probationDate);
    if (probationDate.getDate() <= 15) {
      paymentDate = setDate(paymentDate, 15);
    } else {
      paymentDate = endOfMonth(paymentDate);
    }

    return {
      probationDate: format(probationDate, "yyyy-MM-dd"),
      paymentDate: format(paymentDate, "yyyy-MM-dd")
    };
  };

  const handleCreateReferral = async () => {
    if (!selectedUser || !referralForm.referred_document || !referralForm.referred_name) {
      toast({
        title: "Error",
        description: "Complete todos los campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    if (referralForm.status === "finalizado" && !referralForm.termination_date) {
      toast({
        title: "Error",
        description: "La fecha de fin es obligatoria cuando el estado es 'Finalizado'",
        variant: "destructive"
      });
      return;
    }

    const { probationDate, paymentDate } = calculateDates(referralForm.hire_date);

    try {
      const { data: referralData, error: referralError } = await supabase
        .from("referrals")
        .insert({
          referring_user_id: selectedUser.id,
          referred_document: referralForm.referred_document,
          referred_name: referralForm.referred_name,
          campaign: referralForm.campaign || null,
          status: referralForm.status,
          hire_date: (["contratado", "finalizado"].includes(referralForm.status) ? referralForm.hire_date : null) || null,
          termination_date: referralForm.termination_date || null,
          probation_end_date: probationDate,
          bonus_payment_date: paymentDate,
          observations: referralForm.observations || null,
          company_id: selectedUser.company_id
        })
        .select()
        .single();

      if (referralError) throw referralError;

      if (referralForm.hire_date && referralForm.status === "contratado") {
        await supabase
          .from("referral_bonuses")
          .insert({
            referral_id: referralData.id,
            bonus_amount: parseFloat(config.bonus_amount),
            condition_met_date: probationDate,
            status: "pendiente"
          });
      }

      toast({
        title: "Éxito",
        description: "Referido creado correctamente"
      });

      // Audit Log
      auditService.logActivity({
        userId: (await supabase.auth.getUser()).data.user?.id || "unknown",
        role: "sistema", // Asumimos sistema por ahora
        actionType: "create",
        module: "referrals",
        details: { referralId: referralData.id, referredName: referralForm.referred_name }
      });

      setReferralForm({
        referred_document: "",
        referred_name: "",
        campaign: "",
        status: "iniciado",
        hire_date: "",
        termination_date: "",
        observations: ""
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

  const processBulkData = async (data: any[]) => {
    let successCount = 0;
    let errorCount = 0;

    for (const row of data) {
      // Normalize keys to lowercase for easier matching
      const normalizedRow: any = {};
      Object.keys(row).forEach(key => {
        normalizedRow[key.toLowerCase()] = row[key];
      });

      // Try to find user by document number
      // Check for various possible column names
      const userDoc = normalizedRow["documento usuario"] || normalizedRow["documento_usuario"] || normalizedRow["documentouser"];
      if (!userDoc) {
        errorCount++;
        continue;
      }

      const user = users.find(u => u.document_number === String(userDoc));
      if (!user) {
        errorCount++;
        continue;
      }

      try {
        await supabase.from("referrals").insert({
          referring_user_id: user.id,
          referred_document: String(normalizedRow["documento referido"] || normalizedRow["documento_referido"] || normalizedRow["referidodoc"] || ""),
          referred_name: normalizedRow["nombre referido"] || normalizedRow["nombre_referido"] || normalizedRow["referidonombre"] || "",
          campaign: normalizedRow["campaña"] || normalizedRow["campana"] || null,
          status: (normalizedRow["estado"] || "").toLowerCase() === "finalizado" ? "finalizado" : "iniciado", // Default to iniciado if not specified
          hire_date: normalizedRow["fecha contratación"] || normalizedRow["fecha_contratacion"] || null,
          termination_date: normalizedRow["fecha baja"] || normalizedRow["fecha_baja"] || null,
          company_id: user.company_id
        });
        successCount++;
      } catch (error) {
        console.error("Error inserting referral:", error);
        errorCount++;
      }
    }

    return { successCount, errorCount };
  };

  const handleBulkUpload = async (file: File) => {
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      const { successCount, errorCount } = await processBulkData(jsonData);

      toast({
        title: "Carga completada",
        description: `${successCount} referidos cargados. ${errorCount} errores.`,
        variant: errorCount > 0 ? "default" : "default" // You might want "destructive" if errors exist, but mixed results are common
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const handlePasteImport = async () => {
    if (!pasteContent.trim()) {
      toast({
        title: "Error",
        description: "No hay contenido para importar",
        variant: "destructive"
      });
      return;
    }

    setImporting(true);
    try {
      // Parse CSV/TSV from text
      const rows = pasteContent.split("\n").filter(r => r.trim());
      const headers = rows[0].split(/[\t,]/).map(h => h.trim());

      const jsonData = rows.slice(1).map(row => {
        const values = row.split(/[\t,]/).map(v => v.trim());
        const obj: any = {};
        headers.forEach((h, i) => {
          if (i < values.length) obj[h] = values[i];
        });
        return obj;
      });

      const { successCount, errorCount } = await processBulkData(jsonData);

      toast({
        title: "Importación completada",
        description: `${successCount} referidos importados. ${errorCount} errores.`,
      });
      loadData();
      setPasteContent("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Error al procesar los datos pegados: " + error.message,
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const handleEditClick = (referral: Referral) => {
    setEditingReferral(referral);
    setEditForm({
      status: referral.status,
      termination_date: referral.termination_date || "",
      bonus_status: referral.referral_bonuses?.[0]?.status || "pendiente",
      hire_date: referral.hire_date || "",
      observations: referral.observations || ""
    });
  };

  const handleUpdateReferral = async () => {
    if (!editingReferral) return;

    try {
      const { probationDate, paymentDate } = calculateDates(editForm.hire_date);

      const { error: referralError } = await supabase
        .from("referrals")
        .update({
          status: editForm.status,
          termination_date: (["finalizado"].includes(editForm.status) ? editForm.termination_date : null) || null,
          hire_date: (["contratado", "finalizado"].includes(editForm.status) ? editForm.hire_date : null) || null,
          probation_end_date: probationDate,
          bonus_payment_date: paymentDate,
          observations: editForm.observations || null
        })
        .eq("id", editingReferral.id);

      if (referralError) throw referralError;

      // Bonus handling logic
      const { data: bonuses } = await supabase
        .from("referral_bonuses")
        .select("id, status, created_at")
        .eq("referral_id", editingReferral.id)
        .order("created_at", { ascending: false });

      const existingBonus = bonuses && bonuses.length > 0 ? bonuses[0] : null;

      if (existingBonus) {
        const updates: any = {
          status: editForm.bonus_status
        };

        if (editForm.bonus_status === "pagado" && existingBonus.status !== "pagado") {
          updates.paid_date = format(new Date(), "yyyy-MM-dd");
        } else if (editForm.bonus_status === "pendiente") {
          updates.paid_date = null; // Reset paid date if moving back to pending
        }

        const { error: bonusError } = await supabase
          .from("referral_bonuses")
          .update(updates)
          .eq("id", existingBonus.id);

        if (bonusError) throw bonusError;
      } else if (editForm.bonus_status === "pagado") {
        const { error: newBonusError } = await supabase
          .from("referral_bonuses")
          .insert({
            referral_id: editingReferral.id,
            bonus_amount: parseFloat(config.bonus_amount),
            status: "pagado",
            paid_date: format(new Date(), "yyyy-MM-dd"),
            condition_met_date: format(new Date(), "yyyy-MM-dd")
          });

        if (newBonusError) throw newBonusError;
      } else {
        // Create bonus if it doesn't exist and status implies it should
        if (editForm.bonus_status === "pagado" || ["contratado", "activo"].includes(editForm.status)) {
          const isPaid = editForm.bonus_status === "pagado";
          const { error: newBonusError } = await supabase
            .from("referral_bonuses")
            .insert({
              referral_id: editingReferral.id,
              bonus_amount: parseFloat(config.bonus_amount),
              status: isPaid ? "pagado" : "pendiente",
              paid_date: isPaid ? format(new Date(), "yyyy-MM-dd") : null,
              condition_met_date: probationDate || format(new Date(), "yyyy-MM-dd")
            });

          if (newBonusError) throw newBonusError;
        }
      }

      toast({
        title: "Éxito",
        description: "Referido actualizado correctamente"
      });

      // Audit Log
      auditService.logActivity({
        userId: (await supabase.auth.getUser()).data.user?.id || "unknown",
        role: "sistema",
        actionType: "update",
        module: "referrals",
        details: {
          referralId: editingReferral.id,
          newStatus: editForm.status,
          newBonusStatus: editForm.bonus_status
        }
      });

      setEditingReferral(null);
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
    if (!referral.hire_date || !["contratado", "finalizado"].includes(referral.status)) return { days: 0, months: 0 };
    const hireDate = new Date(referral.hire_date);
    const endDate = referral.status === "finalizado" && referral.termination_date
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
        "Fecha Contratación": r.hire_date ? format(new Date(r.hire_date), "dd/MM/yyyy") : "",
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

  const filteredReferrals = referrals.filter(r => {
    const matchesSearch =
      r.end_users.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referred_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referred_document.includes(searchTerm);

    const matchesStatus = filterStatus === "all" || r.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const activeReferrals = referrals.filter(r =>
    ["iniciado", "citado", "seleccionado", "capacitacion", "contratado", "activo"].includes(r.status)
  ).length;
  const inactiveReferrals = referrals.filter(r => r.status === "finalizado").length;
  const pendingBonuses = referrals.filter(r => r.referral_bonuses?.[0]?.status === "pendiente").length;
  const paidBonuses = referrals.filter(r => r.referral_bonuses?.[0]?.status === "pagado").length;

  return (
    <div className="space-y-6">
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
                <CardTitle className="text-sm font-medium">Referidos Finalizados</CardTitle>
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
                      <SelectValue placeholder="Empresa" />
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

                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="iniciado">Iniciado</SelectItem>
                      <SelectItem value="citado">Citado</SelectItem>
                      <SelectItem value="seleccionado">Seleccionado</SelectItem>
                      <SelectItem value="capacitacion">Capacitación</SelectItem>
                      <SelectItem value="contratado">Contratado</SelectItem>
                      <SelectItem value="finalizado">Finalizado</SelectItem>
                    </SelectContent>
                  </Select>

                  {(searchTerm || selectedCompany !== "all" || filterStatus !== "all") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedCompany("all");
                        setFilterStatus("all");
                      }}
                      title="Limpiar filtros"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Asignar
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Asignar Nuevo Referido</DialogTitle>
                        <DialogDescription>Complete la información del referido</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Filtrar por Empresa</Label>
                            <Select
                              value={dialogCompanyFilter}
                              onValueChange={setDialogCompanyFilter}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Todas las empresas" />
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
                          </div>
                          <div>
                            <Label>Usuario que Refiere</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between",
                                    !selectedUser && "text-muted-foreground"
                                  )}
                                >
                                  {selectedUser
                                    ? `${selectedUser.full_name} - ${selectedUser.document_number}`
                                    : "Seleccione usuario"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0">
                                <Command>
                                  <CommandInput placeholder="Buscar por nombre o cédula..." />
                                  <CommandList>
                                    <CommandEmpty>No se encontraron usuarios.</CommandEmpty>
                                    <CommandGroup>
                                      {users
                                        .filter(u => dialogCompanyFilter === "all" || u.company_id === dialogCompanyFilter)
                                        .map((user) => (
                                          <CommandItem
                                            value={`${user.full_name} ${user.document_number}`}
                                            key={user.id}
                                            onSelect={() => {
                                              setSelectedUser(user);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedUser?.id === user.id
                                                  ? "opacity-100"
                                                  : "opacity-0"
                                              )}
                                            />
                                            {user.full_name} - {user.document_number}
                                          </CommandItem>
                                        ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
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
                              onValueChange={(value: any) => setReferralForm({ ...referralForm, status: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="iniciado">Iniciado</SelectItem>
                                <SelectItem value="citado">Citado</SelectItem>
                                <SelectItem value="seleccionado">Seleccionado</SelectItem>
                                <SelectItem value="capacitacion">Capacitación</SelectItem>
                                <SelectItem value="contratado">Contratado</SelectItem>
                                <SelectItem value="finalizado">Finalizado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {["contratado", "finalizado"].includes(referralForm.status) && (
                            <div>
                              <Label>Fecha de Contratación</Label>
                              <Input
                                type="date"
                                value={referralForm.hire_date}
                                onChange={(e) => setReferralForm({ ...referralForm, hire_date: e.target.value })}
                              />
                            </div>
                          )}
                          {referralForm.status === "finalizado" && (
                            <div className="col-span-2">
                              <Label>Observaciones</Label>
                              <Input
                                value={referralForm.observations}
                                onChange={(e) => setReferralForm({ ...referralForm, observations: e.target.value })}
                                placeholder="Motivo de finalización..."
                              />
                            </div>
                          )}
                          {(referralForm.status === "finalizado") && (
                            <div>
                              <Label>Fecha de Fin/Baja</Label>
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
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Carga Masiva de Referidos</DialogTitle>
                        <DialogDescription>Importe referidos desde Excel o pegando datos</DialogDescription>
                      </DialogHeader>

                      <Tabs defaultValue="paste">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="paste">
                            <ClipboardPaste className="mr-2 h-4 w-4" />
                            Copiar y Pegar
                          </TabsTrigger>
                          <TabsTrigger value="upload">
                            <Upload className="mr-2 h-4 w-4" />
                            Subir Archivo
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="paste" className="space-y-4">
                          <div className="space-y-2">
                            <Label>Pegar datos (con encabezados)</Label>
                            <Textarea
                              placeholder={`Documento Usuario	Nombre Referido	Documento Referido	Campaña	Estado
123456	Juan Perez	987654	Ventas	Iniciado`}
                              className="min-h-[200px] font-mono text-sm"
                              value={pasteContent}
                              onChange={(e) => setPasteContent(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Copie desde Excel incluyendo los encabezados. Columnas requeridas: Documento Usuario, Nombre Referido, Documento Referido.
                            </p>
                          </div>
                          <Button onClick={handlePasteImport} disabled={importing} className="w-full">
                            {importing ? "Procesando..." : "Importar Datos"}
                          </Button>
                        </TabsContent>

                        <TabsContent value="upload" className="space-y-4">
                          <div className="space-y-2">
                            <Label>Seleccionar archivo Excel (.xlsx)</Label>
                            <Input
                              type="file"
                              accept=".xlsx, .xls"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleBulkUpload(file);
                              }}
                              disabled={importing}
                            />
                          </div>
                        </TabsContent>
                      </Tabs>
                    </DialogContent>

                  </Dialog>

                  <Dialog open={!!editingReferral} onOpenChange={(open) => !open && setEditingReferral(null)}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar Referido</DialogTitle>
                        <DialogDescription>Modificar estado y bono del referido</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Estado</Label>
                            <Select
                              value={editForm.status}
                              onValueChange={(value: any) => setEditForm({ ...editForm, status: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="iniciado">Iniciado</SelectItem>
                                <SelectItem value="citado">Citado</SelectItem>
                                <SelectItem value="seleccionado">Seleccionado</SelectItem>
                                <SelectItem value="capacitacion">Capacitación</SelectItem>
                                <SelectItem value="contratado">Contratado</SelectItem>
                                <SelectItem value="finalizado">Finalizado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Estado del Bono</Label>
                            <Select
                              value={editForm.bonus_status}
                              onValueChange={(value) => setEditForm({ ...editForm, bonus_status: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pendiente">Pendiente</SelectItem>
                                <SelectItem value="pagado">Pagado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {["contratado", "finalizado"].includes(editForm.status) && (
                          <div>
                            <Label>Fecha de Contratación</Label>
                            <Input
                              type="date"
                              value={editForm.hire_date}
                              onChange={(e) => setEditForm({ ...editForm, hire_date: e.target.value })}
                            />
                          </div>
                        )}
                        {["finalizado"].includes(editForm.status) && (
                          <div>
                            <Label>Fecha de Baja/Fin</Label>
                            <Input
                              type="date"
                              value={editForm.termination_date}
                              onChange={(e) => setEditForm({ ...editForm, termination_date: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Requerida si el estado es Finalizado.
                            </p>
                          </div>
                        )}
                        {editForm.status === "finalizado" && (
                          <div className="col-span-2">
                            <Label>Observaciones</Label>
                            <Input
                              value={editForm.observations}
                              onChange={(e) => setEditForm({ ...editForm, observations: e.target.value })}
                            />
                          </div>
                        )}
                        <Button onClick={handleUpdateReferral} className="w-full">
                          Guardar Cambios
                        </Button>
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
                    <TableHead>Acciones</TableHead>
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
                          <Badge variant={
                            referral.status === "contratado" ? "default" :
                              referral.status === "finalizado" ? "destructive" :
                                "secondary"
                          }>
                            {referral.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{referral.hire_date ? format(new Date(referral.hire_date), "dd/MM/yyyy", { locale: es }) : "-"}</TableCell>
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
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(referral)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {time.days >= parseInt(config.minimum_days) && referral.referral_bonuses?.[0]?.status !== "pagado" && (
                              <div title="Tiempo cumplido - Bono pendiente">
                                <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card >
        </TabsContent >

        <TabsContent value="dashboard">
          <ReferralsDashboard />
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
      </Tabs >
    </div >
  );
}
