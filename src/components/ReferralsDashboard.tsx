import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download, Users, DollarSign, TrendingUp, Award } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

interface DashboardProps {
  referrals: any[];
  companies: any[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export function ReferralsDashboard({ referrals, companies }: DashboardProps) {
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("6months");
  const [bonusConfig, setBonusConfig] = useState({ bonus_amount: "500000", minimum_days: "60" });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase.from("referral_config").select("*");
    if (data) {
      const configObj: any = {};
      data.forEach(item => {
        configObj[item.config_key] = item.config_value;
      });
      setBonusConfig(configObj);
    }
  };

  const filteredReferrals = referrals.filter(r => 
    selectedCompany === "all" || r.company_id === selectedCompany
  );

  // Calculate KPIs
  const activeReferrals = filteredReferrals.filter(r => r.status === "activo").length;
  const inactiveReferrals = filteredReferrals.filter(r => r.status === "baja").length;
  const pendingBonuses = filteredReferrals.filter(r => r.referral_bonuses?.[0]?.status === "pendiente").length;
  const paidBonuses = filteredReferrals.filter(r => r.referral_bonuses?.[0]?.status === "pagado").length;
  
  const totalPaidAmount = filteredReferrals
    .filter(r => r.referral_bonuses?.[0]?.status === "pagado")
    .reduce((sum, r) => sum + (r.referral_bonuses[0].bonus_amount || 0), 0);
  
  const potentialPayoutAmount = pendingBonuses * parseFloat(bonusConfig.bonus_amount);

  // Calculate average tenure
  const avgTenureDays = filteredReferrals.length > 0
    ? filteredReferrals.reduce((sum, r) => {
        const hireDate = new Date(r.hire_date);
        const endDate = r.status === "baja" && r.termination_date 
          ? new Date(r.termination_date) 
          : new Date();
        return sum + Math.floor((endDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24));
      }, 0) / filteredReferrals.length
    : 0;

  // Top referrers ranking
  const referrerCounts = filteredReferrals.reduce((acc: any, r) => {
    const name = r.end_users.full_name;
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  const topReferrers = Object.entries(referrerCounts)
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Referrals by campaign
  const campaignCounts = filteredReferrals.reduce((acc: any, r) => {
    const campaign = r.campaign || "Sin campaña";
    acc[campaign] = (acc[campaign] || 0) + 1;
    return acc;
  }, {});

  const referralsByCampaign = Object.entries(campaignCounts).map(([name, value]) => ({ name, value }));

  // Monthly evolution
  const monthsToShow = dateRange === "6months" ? 6 : 12;
  const months = eachMonthOfInterval({
    start: subMonths(new Date(), monthsToShow - 1),
    end: new Date()
  });

  const monthlyData = months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    const hired = filteredReferrals.filter(r => {
      const hireDate = new Date(r.hire_date);
      return hireDate >= monthStart && hireDate <= monthEnd;
    }).length;

    const terminated = filteredReferrals.filter(r => {
      if (!r.termination_date) return false;
      const termDate = new Date(r.termination_date);
      return termDate >= monthStart && termDate <= monthEnd;
    }).length;

    const bonusesPaid = filteredReferrals.filter(r => {
      if (!r.referral_bonuses?.[0]?.paid_date) return false;
      const paidDate = new Date(r.referral_bonuses[0].paid_date);
      return paidDate >= monthStart && paidDate <= monthEnd;
    }).length;

    return {
      month: format(month, "MMM yyyy", { locale: es }),
      contratados: hired,
      bajas: terminated,
      bonosPagados: bonusesPaid
    };
  });

  const exportToExcel = (type: string) => {
    let data: any[] = [];
    let filename = "";

    if (type === "all") {
      data = filteredReferrals.map(r => ({
        "Usuario Referidor": r.end_users.full_name,
        "Documento Referidor": r.end_users.document_number,
        "Empresa": r.companies.name,
        "Referido": r.referred_name,
        "Documento": r.referred_document,
        "Campaña": r.campaign || "",
        "Estado": r.status,
        "Fecha Contratación": format(new Date(r.hire_date), "dd/MM/yyyy"),
        "Estado Bono": r.referral_bonuses?.[0]?.status || "Sin bono",
        "Valor Bono": r.referral_bonuses?.[0]?.bonus_amount || ""
      }));
      filename = "todos_referidos";
    } else if (type === "pending") {
      data = filteredReferrals
        .filter(r => r.referral_bonuses?.[0]?.status === "pendiente")
        .map(r => ({
          "Usuario Referidor": r.end_users.full_name,
          "Referido": r.referred_name,
          "Fecha Contratación": format(new Date(r.hire_date), "dd/MM/yyyy"),
          "Fecha Cumplimiento": r.referral_bonuses[0].condition_met_date 
            ? format(new Date(r.referral_bonuses[0].condition_met_date), "dd/MM/yyyy")
            : "",
          "Valor Bono": r.referral_bonuses[0].bonus_amount
        }));
      filename = "bonos_pendientes";
    } else if (type === "paid") {
      data = filteredReferrals
        .filter(r => r.referral_bonuses?.[0]?.status === "pagado")
        .map(r => ({
          "Usuario Referidor": r.end_users.full_name,
          "Referido": r.referred_name,
          "Fecha Pago": r.referral_bonuses[0].paid_date
            ? format(new Date(r.referral_bonuses[0].paid_date), "dd/MM/yyyy")
            : "",
          "Valor Bono": r.referral_bonuses[0].bonus_amount
        }));
      filename = "bonos_pagados";
    } else if (type === "kpis") {
      data = [{
        "Total Referidos": filteredReferrals.length,
        "Referidos Activos": activeReferrals,
        "Referidos Baja": inactiveReferrals,
        "Tiempo Promedio (días)": Math.round(avgTenureDays),
        "Bonos Pendientes": pendingBonuses,
        "Bonos Pagados": paidBonuses,
        "Monto Pagado": totalPaidAmount,
        "Monto Potencial": potentialPayoutAmount
      }];
      filename = "kpis_consolidados";
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `${filename}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Dashboard de Referidos", 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Fecha: ${format(new Date(), "dd/MM/yyyy")}`, 14, 30);
    
    const kpis = [
      ["Métrica", "Valor"],
      ["Total Referidos", filteredReferrals.length.toString()],
      ["Referidos Activos", activeReferrals.toString()],
      ["Referidos en Baja", inactiveReferrals.toString()],
      ["Tiempo Promedio", `${Math.round(avgTenureDays)} días`],
      ["Bonos Pendientes", pendingBonuses.toString()],
      ["Bonos Pagados", paidBonuses.toString()],
      ["Monto Total Pagado", `$${totalPaidAmount.toLocaleString('es-CO')}`],
      ["Monto Potencial", `$${potentialPayoutAmount.toLocaleString('es-CO')}`]
    ];

    (doc as any).autoTable({
      startY: 40,
      head: [kpis[0]],
      body: kpis.slice(1)
    });

    doc.save(`dashboard_referidos_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filtrar por empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6months">Últimos 6 meses</SelectItem>
            <SelectItem value="12months">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-2">
          <Button onClick={() => exportToExcel("all")} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Todos
          </Button>
          <Button onClick={() => exportToExcel("pending")} variant="outline" size="sm">
            Pendientes
          </Button>
          <Button onClick={() => exportToExcel("paid")} variant="outline" size="sm">
            Pagados
          </Button>
          <Button onClick={() => exportToExcel("kpis")} variant="outline" size="sm">
            KPIs
          </Button>
          <Button onClick={exportToPDF} variant="outline" size="sm">
            PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referidos Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeReferrals}</div>
            <p className="text-xs text-muted-foreground">
              {inactiveReferrals} en baja
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgTenureDays)}</div>
            <p className="text-xs text-muted-foreground">días promedio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bonos Pendientes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingBonuses}</div>
            <p className="text-xs text-muted-foreground">
              ${potentialPayoutAmount.toLocaleString('es-CO')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bonos Pagados</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidBonuses}</div>
            <p className="text-xs text-muted-foreground">
              ${totalPaidAmount.toLocaleString('es-CO')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolución Mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="contratados" stroke="hsl(var(--primary))" name="Contratados" />
                <Line type="monotone" dataKey="bajas" stroke="hsl(var(--destructive))" name="Bajas" />
                <Line type="monotone" dataKey="bonosPagados" stroke="hsl(var(--success))" name="Bonos Pagados" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Referidores</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topReferrers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Referidos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referidos por Campaña</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={referralsByCampaign}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {referralsByCampaign.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de Bonos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Pendientes", value: pendingBonuses },
                    { name: "Pagados", value: paidBonuses }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="hsl(var(--warning))" />
                  <Cell fill="hsl(var(--success))" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
