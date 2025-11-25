import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Grid3x3, Bell, TrendingUp, AlertCircle, Clock, CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function Dashboard() {
  const [stats, setStats] = useState({
    companies: 0,
    personnel: 0,
    applications: 0,
    alarms: 0,
    activeAlarms: 0,
  });
  
  const [alarmsData, setAlarmsData] = useState<any[]>([]);
  const [resolutionData, setResolutionData] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  const [priorityDistribution, setPriorityDistribution] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [companiesRes, personnelRes, appsRes, alarmsRes, activeAlarmsRes, allAlarmsData] = await Promise.all([
      supabase.from("companies").select("id", { count: "exact", head: true }),
      supabase.from("end_users").select("id", { count: "exact", head: true }),
      supabase.from("company_applications").select("id", { count: "exact", head: true }),
      supabase.from("alarms").select("id", { count: "exact", head: true }),
      supabase.from("alarms").select("id", { count: "exact", head: true }).eq("status", "abierta"),
      supabase.from("alarms").select("*").order("created_at", { ascending: false }),
    ]);

    setStats({
      companies: companiesRes.count || 0,
      personnel: personnelRes.count || 0,
      applications: appsRes.count || 0,
      alarms: alarmsRes.count || 0,
      activeAlarms: activeAlarmsRes.count || 0,
    });

    // Process alarms data for charts
    if (allAlarmsData.data) {
      processChartsData(allAlarmsData.data);
    }
  };

  const processChartsData = (alarms: any[]) => {
    // Status distribution
    const statusCount = alarms.reduce((acc: any, alarm) => {
      acc[alarm.status] = (acc[alarm.status] || 0) + 1;
      return acc;
    }, {});

    setStatusDistribution([
      { name: "Abierta", value: statusCount.abierta || 0, color: "hsl(var(--destructive))" },
      { name: "En Proceso", value: statusCount.en_proceso || 0, color: "hsl(var(--warning))" },
      { name: "Resuelta", value: statusCount.resuelta || 0, color: "hsl(var(--success))" },
      { name: "Cerrada", value: statusCount.cerrada || 0, color: "hsl(var(--muted-foreground))" },
    ]);

    // Priority distribution
    const priorityCount = alarms.reduce((acc: any, alarm) => {
      acc[alarm.priority || "media"] = (acc[alarm.priority || "media"] || 0) + 1;
      return acc;
    }, {});

    setPriorityDistribution([
      { name: "Alta", value: priorityCount.alta || 0 },
      { name: "Media", value: priorityCount.media || 0 },
      { name: "Baja", value: priorityCount.baja || 0 },
    ]);

    // Resolution time data (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    const dailyData = last7Days.map(day => {
      const dayAlarms = alarms.filter(a => a.created_at.startsWith(day));
      const resolved = dayAlarms.filter(a => a.status === 'resuelta' || a.status === 'cerrada');
      const avgResolution = resolved.length > 0
        ? resolved.reduce((sum, a) => sum + (a.resolution_time_minutes || 0), 0) / resolved.length
        : 0;

      return {
        date: new Date(day).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        creadas: dayAlarms.length,
        resueltas: resolved.length,
        tiempoPromedio: Math.round(avgResolution),
      };
    });

    setAlarmsData(dailyData);

    // Average resolution times by status
    const resolvedAlarms = alarms.filter(a => a.resolution_time_minutes);
    const avgByPriority = ['alta', 'media', 'baja'].map(priority => {
      const priorityAlarms = resolvedAlarms.filter(a => a.priority === priority);
      const avg = priorityAlarms.length > 0
        ? priorityAlarms.reduce((sum, a) => sum + a.resolution_time_minutes, 0) / priorityAlarms.length
        : 0;
      return {
        priority: priority.charAt(0).toUpperCase() + priority.slice(1),
        tiempo: Math.round(avg),
      };
    });

    setResolutionData(avgByPriority);
  };

  const exportDashboardPDF = async () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Dashboard - Reporte de Gestión", 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, 30);
    
    // Stats table
    autoTable(doc, {
      startY: 40,
      head: [['Métrica', 'Valor']],
      body: [
        ['Empresas Activas', stats.companies],
        ['Personal Registrado', stats.personnel],
        ['Aplicativos', stats.applications],
        ['Alarmas Totales', stats.alarms],
        ['Alarmas Abiertas', stats.activeAlarms],
      ],
    });
    
    doc.save(`dashboard-${Date.now()}.pdf`);
  };

  const metrics = [
    {
      title: "Empresas Activas",
      value: stats.companies,
      icon: Building2,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Personal Registrado",
      value: stats.personnel,
      icon: Users,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Aplicativos",
      value: stats.applications,
      icon: Grid3x3,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Alarmas Totales",
      value: stats.alarms,
      icon: Bell,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Alarmas Abiertas",
      value: stats.activeAlarms,
      icon: AlertCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard BI</h1>
          <p className="text-muted-foreground mt-2">
            Análisis integral del sistema de gestión
          </p>
        </div>
        <Button onClick={exportDashboardPDF} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar Dashboard
        </Button>
      </div>

      {/* Métricas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map((metric) => (
          <Card key={metric.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <div className={`${metric.bgColor} p-2 rounded-lg`}>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <TrendingUp className="inline h-3 w-3 mr-1" />
                Actualizado en tiempo real
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficas y Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="distribution">Distribución</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tendencia de Alarmas (Últimos 7 días)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={alarmsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="creadas" stroke="hsl(var(--destructive))" name="Creadas" strokeWidth={2} />
                    <Line type="monotone" dataKey="resueltas" stroke="hsl(var(--success))" name="Resueltas" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tiempo Promedio de Resolución por Prioridad</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={resolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="priority" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                      formatter={(value) => `${value} min`}
                    />
                    <Bar dataKey="tiempo" fill="hsl(var(--primary))" name="Minutos" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Tiempo Promedio Respuesta</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {resolutionData.length > 0
                    ? Math.round(resolutionData.reduce((sum, d) => sum + d.tiempo, 0) / resolutionData.length)
                    : 0} min
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Todas las prioridades
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Tasa de Resolución</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.alarms > 0
                    ? Math.round(((stats.alarms - stats.activeAlarms) / stats.alarms) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.alarms - stats.activeAlarms} de {stats.alarms} resueltas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Eficiencia Semanal</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {alarmsData.length > 0
                    ? Math.round((alarmsData.reduce((sum, d) => sum + d.resueltas, 0) / 
                        alarmsData.reduce((sum, d) => sum + d.creadas, 0)) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Últimos 7 días
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tiempo Promedio Diario (minutos)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={alarmsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="tiempoPromedio" 
                    stroke="hsl(var(--info))" 
                    name="Tiempo Promedio" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--info))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribución por Prioridad</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={priorityDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Acciones rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <a
              href="/companies"
              className="block p-3 rounded-lg border hover:bg-secondary transition-colors"
            >
              <div className="font-medium">Crear Nueva Empresa</div>
              <div className="text-sm text-muted-foreground">
                Añade una nueva cuenta al sistema
              </div>
            </a>
            <a
              href="/personnel"
              className="block p-3 rounded-lg border hover:bg-secondary transition-colors"
            >
              <div className="font-medium">Registrar Personal</div>
              <div className="text-sm text-muted-foreground">
                Añade usuarios a las empresas
              </div>
            </a>
            <a
              href="/help-desk"
              className="block p-3 rounded-lg border hover:bg-secondary transition-colors"
            >
              <div className="font-medium">Ver Alarmas</div>
              <div className="text-sm text-muted-foreground">
                Revisa las solicitudes de ayuda
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
