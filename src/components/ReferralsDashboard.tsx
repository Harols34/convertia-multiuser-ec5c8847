import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, UserCheck, UserX, DollarSign, TrendingUp, Award, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { differenceInMonths } from "date-fns";

interface DashboardMetrics {
  totalActive: number;
  totalInactive: number;
  avgTenure: number;
  totalBonusesPaid: number;
  totalBonusesPending: number;
  totalAmountPaid: number;
  potentialPayout: number;
  conversionRate: number;
  nonSelected: number;
  retention3to6: number;
  retention6to12: number;
}

interface TopReferrer {
  user_name: string;
  document: string;
  count: number;
}

export function ReferralsDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalActive: 0,
    totalInactive: 0,
    avgTenure: 0,
    totalBonusesPaid: 0,
    totalBonusesPending: 0,
    totalAmountPaid: 0,
    potentialPayout: 0,
    conversionRate: 0,
    nonSelected: 0,
    retention3to6: 0,
    retention6to12: 0
  });
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);
  const [companyCampaignData, setCompanyCampaignData] = useState<any[]>([]);
  const [monthlyEvolution, setMonthlyEvolution] = useState<any[]>([]);
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [companies, setCompanies] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadCompanies();
    loadMetrics();
  }, [filterCompany]);

  const loadCompanies = async () => {
    const { data } = await supabase.from("companies").select("id, name").eq("active", true);
    setCompanies(data || []);
  };

  const loadMetrics = async () => {
    try {
      let query = supabase.from("referrals").select(`
        *,
        end_users!referrals_referring_user_id_fkey(full_name, document_number),
        companies(name),
        referral_bonuses(*)
      `);

      if (filterCompany !== "all") {
        query = query.eq("company_id", filterCompany);
      }

      const { data: referrals, error } = await query;

      if (error) {
        console.error("Error loading referrals:", error);
        toast({
          title: "Error cargando datos",
          description: "No se pudieron cargar los referidos. Verifique permisos o conexión.",
          variant: "destructive"
        });
        return;
      }

      if (!referrals) return;

      const { data: config } = await supabase
        .from("referral_config")
        .select("config_value")
        .eq("config_key", "bonus_amount")
        .single();

      const bonusAmount = parseFloat(config?.config_value || "0");

      // Helper to ensure array
      const getBonuses = (r: any) => {
        if (Array.isArray(r.referral_bonuses)) return r.referral_bonuses;
        if (r.referral_bonuses) return [r.referral_bonuses];
        return [];
      };

      // Calculate metrics
      const active = referrals.filter(r =>
        ["iniciado", "citado", "seleccionado", "capacitacion", "contratado", "activo"].includes(r.status)
      );
      const inactive = referrals.filter(r => r.status === "baja");

      // Average tenure in days
      const totalTenure = referrals.reduce((acc, r) => {
        if (!r.hire_date) return acc;
        const start = new Date(r.hire_date);
        const end = r.termination_date ? new Date(r.termination_date) : new Date();
        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return acc + days;
      }, 0);

      const avgTenure = referrals.length > 0 ? Math.floor(totalTenure / referrals.length) : 0;

      // Bonuses
      const bonusesPaid = referrals.filter(r =>
        getBonuses(r).some((b: any) => b.status?.toLowerCase() === "pagado")
      ).length;

      const bonusesPending = referrals.filter(r => {
        const bonuses = getBonuses(r);
        const hasPending = bonuses.some((b: any) => b.status?.toLowerCase() === "pendiente");
        const hasPaid = bonuses.some((b: any) => b.status?.toLowerCase() === "pagado");

        if (hasPending) return true;
        if (hasPaid) return false;

        return ["contratado", "activo"].includes(r.status);
      }).length;

      // New Metrics Calculation
      const totalReferrals = referrals.length;
      const hiredOrSelected = referrals.filter(r => ["contratado", "seleccionado"].includes(r.status)).length;
      const conversionRate = totalReferrals > 0 ? (hiredOrSelected / totalReferrals) * 100 : 0;

      const nonSelected = referrals.filter(r => r.status === "finalizado").length;

      // Retention
      const retention3to6 = referrals.filter(r => {
        if (!r.hire_date || (r.status !== "activo" && r.status !== "contratado")) return false;
        const hireDate = new Date(r.hire_date);
        const months = differenceInMonths(new Date(), hireDate);
        return months >= 3 && months < 6;
      }).length;

      const retention6to12 = referrals.filter(r => {
        if (!r.hire_date || (r.status !== "activo" && r.status !== "contratado")) return false;
        const hireDate = new Date(r.hire_date);
        const months = differenceInMonths(new Date(), hireDate);
        return months >= 6 && months <= 12;
      }).length;

      setMetrics({
        totalActive: active.length,
        totalInactive: inactive.length,
        avgTenure,
        totalBonusesPaid: bonusesPaid,
        totalBonusesPending: bonusesPending,
        totalAmountPaid: bonusesPaid * bonusAmount,
        potentialPayout: bonusesPending * bonusAmount,
        conversionRate,
        nonSelected,
        retention3to6,
        retention6to12
      });

      // Top referrers
      const referrerMap = new Map<string, { name: string; doc: string; count: number }>();
      referrals.forEach(r => {
        const userId = r.referring_user_id;
        const userName = r.end_users?.full_name || "Desconocido";
        const userDoc = r.end_users?.document_number || "";

        if (referrerMap.has(userId)) {
          referrerMap.get(userId)!.count++;
        } else {
          referrerMap.set(userId, { name: userName, doc: userDoc, count: 1 });
        }
      });

      const topRefs = Array.from(referrerMap.values())
        .map(r => ({ user_name: r.name, document: r.doc, count: r.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setTopReferrers(topRefs);

      // Campaign data
      const campaignMap = new Map<string, number>();
      referrals.forEach(r => {
        const campaign = r.campaign || "Sin campaña";
        campaignMap.set(campaign, (campaignMap.get(campaign) || 0) + 1);
      });

      const campData = Array.from(campaignMap.entries()).map(([name, value]) => ({ name, value }));
      setCompanyCampaignData(campData);

      // Monthly evolution (last 6 months)
      const monthlyData: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        const hired = referrals.filter(r => {
          if (!r.hire_date) return false;
          const hireDate = new Date(r.hire_date);
          return `${hireDate.getFullYear()}-${String(hireDate.getMonth() + 1).padStart(2, '0')}` === monthKey;
        }).length;

        const terminated = referrals.filter(r => {
          if (!r.termination_date) return false;
          const termDate = new Date(r.termination_date);
          return `${termDate.getFullYear()}-${String(termDate.getMonth() + 1).padStart(2, '0')}` === monthKey;
        }).length;

        const bonusPaid = referrals.filter(r => {
          const bonuses = getBonuses(r);
          const hasPaid = bonuses.some((b: any) => {
            if (!b.paid_date || b.status?.toLowerCase() !== "pagado") return false;
            const paidDate = new Date(b.paid_date);
            return `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, '0')}` === monthKey;
          });
          return hasPaid;
        }).length;

        monthlyData.push({
          month: date.toLocaleDateString('es', { month: 'short', year: '2-digit' }),
          contratados: hired,
          bajas: terminated,
          bonosPagados: bonusPaid
        });
      }

      setMonthlyEvolution(monthlyData);
    } catch (error) {
      console.error("Unexpected error in loadMetrics:", error);
    }
  };

  const exportToExcel = () => {
    const wsMetrics = XLSX.utils.json_to_sheet([
      { Métrica: "Referidos Activos", Valor: metrics.totalActive },
      { Métrica: "Referidos Inactivos", Valor: metrics.totalInactive },
      { Métrica: "Permanencia Promedio (días)", Valor: metrics.avgTenure },
      { Métrica: "Bonos Pagados", Valor: metrics.totalBonusesPaid },
      { Métrica: "Bonos Pendientes", Valor: metrics.totalBonusesPending },
      { Métrica: "Monto Total Pagado", Valor: `$${metrics.totalAmountPaid.toLocaleString()}` },
      { Métrica: "Pago Potencial Pendiente", Valor: `$${metrics.potentialPayout.toLocaleString()}` },
      { Métrica: "Tasa de Conversión", Valor: `${metrics.conversionRate.toFixed(1)}%` },
      { Métrica: "No Seleccionados", Valor: metrics.nonSelected },
      { Métrica: "Retención 3-6 Meses", Valor: metrics.retention3to6 },
      { Métrica: "Retención 6-12 Meses", Valor: metrics.retention6to12 }
    ]);

    const wsTopReferrers = XLSX.utils.json_to_sheet(
      topReferrers.map(r => ({
        Nombre: r.user_name,
        Documento: r.document,
        "Total Referidos": r.count
      }))
    );

    const wsMonthly = XLSX.utils.json_to_sheet(monthlyEvolution);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsMetrics, "Métricas");
    XLSX.utils.book_append_sheet(wb, wsTopReferrers, "Top Referidores");
    XLSX.utils.book_append_sheet(wb, wsMonthly, "Evolución Mensual");

    XLSX.writeFile(wb, `Dashboard_Referidos_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({ title: "Dashboard exportado exitosamente" });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Dashboard de Referidos", 14, 20);
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 28);

    // Metrics table
    autoTable(doc, {
      startY: 35,
      head: [['Métrica', 'Valor']],
      body: [
        ['Referidos Activos', metrics.totalActive.toString()],
        ['Referidos Inactivos', metrics.totalInactive.toString()],
        ['Permanencia Promedio (días)', metrics.avgTenure.toString()],
        ['Bonos Pagados', metrics.totalBonusesPaid.toString()],
        ['Bonos Pendientes', metrics.totalBonusesPending.toString()],
        ['Monto Total Pagado', `$${metrics.totalAmountPaid.toLocaleString()}`],
        ['Pago Potencial', `$${metrics.potentialPayout.toLocaleString()}`],
        ['Tasa de Conversión', `${metrics.conversionRate.toFixed(1)}%`],
        ['No Seleccionados', metrics.nonSelected.toString()],
        ['Retención 3-6 Meses', metrics.retention3to6.toString()],
        ['Retención 6-12 Meses', metrics.retention6to12.toString()]
      ]
    });

    // Top referrers
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Top Referidores', 'Documento', 'Cantidad']],
      body: topReferrers.slice(0, 5).map(r => [r.user_name, r.document, r.count.toString()])
    });

    doc.save(`Dashboard_Referidos_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: "PDF generado exitosamente" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Dashboard de Referidos</h2>
        <div className="flex gap-2">
          <Select value={filterCompany} onValueChange={setFilterCompany}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las empresas</SelectItem>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportToExcel} variant="outline">Exportar Excel</Button>
          <Button onClick={exportToPDF} variant="outline">Exportar PDF</Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referidos Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referidos Inactivos</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalInactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permanencia Promedio</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgTenure} días</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bonos Pendientes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalBonusesPending}</div>
            <p className="text-xs text-muted-foreground">
              ${metrics.potentialPayout.toLocaleString()} potencial
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bonos Pagados</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalBonusesPaid}</div>
            <p className="text-xs text-muted-foreground">
              Total pagado: ${metrics.totalAmountPaid.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Referidos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalActive + metrics.totalInactive}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.conversionRate.toFixed(0)}% activos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Referidos a Seleccionados/Contratados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Seleccionados</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.nonSelected}</div>
            <p className="text-xs text-muted-foreground">Candidatos finalizados sin contratación</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retención (3-6 Meses)</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.retention3to6}</div>
            <p className="text-xs text-muted-foreground">Referidos activos entre 3 y 6 meses</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Evolución Mensual</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyEvolution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="contratados" name="Contratados" fill="#22c55e" />
                <Bar dataKey="bajas" name="Bajas" fill="#ef4444" />
                <Bar dataKey="bonosPagados" name="Bonos Pagados" fill="#eab308" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Top Referidores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topReferrers.map((referrer, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-none">{referrer.user_name}</p>
                      <p className="text-xs text-muted-foreground">{referrer.document}</p>
                    </div>
                  </div>
                  <div className="font-bold">{referrer.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}