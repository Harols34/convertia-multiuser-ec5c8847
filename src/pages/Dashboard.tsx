import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Grid3x3, Bell, TrendingUp, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    companies: 0,
    personnel: 0,
    applications: 0,
    alarms: 0,
    activeAlarms: 0,
    avgResolutionTime: 0,
  });

  const [alarmsByStatus, setAlarmsByStatus] = useState<any[]>([]);
  const [alarmsByPriority, setAlarmsByPriority] = useState<any[]>([]);
  const [alarmsTrend, setAlarmsTrend] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadChartData();
  }, []);

  const loadStats = async () => {
    const [companiesRes, personnelRes, appsRes, alarmsRes, activeAlarmsRes, resolutionTimeRes] = await Promise.all([
      supabase.from("companies").select("id", { count: "exact", head: true }),
      supabase.from("end_users").select("id", { count: "exact", head: true }),
      supabase.from("company_applications").select("id", { count: "exact", head: true }),
      supabase.from("alarms").select("id", { count: "exact", head: true }),
      supabase.from("alarms").select("id", { count: "exact", head: true }).eq("status", "abierta"),
      supabase.from("alarms").select("resolution_time_minutes").not("resolution_time_minutes", "is", null),
    ]);

    const avgTime = resolutionTimeRes.data?.length 
      ? resolutionTimeRes.data.reduce((acc, curr) => acc + (curr.resolution_time_minutes || 0), 0) / resolutionTimeRes.data.length
      : 0;

    setStats({
      companies: companiesRes.count || 0,
      personnel: personnelRes.count || 0,
      applications: appsRes.count || 0,
      alarms: alarmsRes.count || 0,
      activeAlarms: activeAlarmsRes.count || 0,
      avgResolutionTime: Math.round(avgTime),
    });
  };

  const loadChartData = async () => {
    // Alarms by status
    const { data: statusData } = await supabase
      .from("alarms")
      .select("status");
    
    if (statusData) {
      const statusCount = statusData.reduce((acc: any, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {});

      const statusLabels: Record<string, string> = {
        abierta: "Abiertas",
        en_proceso: "En Proceso",
        resuelta: "Resueltas",
        cerrada: "Cerradas"
      };

      setAlarmsByStatus(
        Object.entries(statusCount).map(([key, value]) => ({
          name: statusLabels[key] || key,
          value: value,
        }))
      );
    }

    // Alarms by priority
    const { data: priorityData } = await supabase
      .from("alarms")
      .select("priority");
    
    if (priorityData) {
      const priorityCount = priorityData.reduce((acc: any, curr) => {
        acc[curr.priority] = (acc[curr.priority] || 0) + 1;
        return acc;
      }, {});

      setAlarmsByPriority(
        Object.entries(priorityCount).map(([key, value]) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          cantidad: value,
        }))
      );
    }

    // Alarms trend (last 7 days)
    const { data: trendData } = await supabase
      .from("alarms")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    
    if (trendData) {
      const dailyCount: Record<string, number> = {};
      trendData.forEach((alarm) => {
        const date = new Date(alarm.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
        dailyCount[date] = (dailyCount[date] || 0) + 1;
      });

      setAlarmsTrend(
        Object.entries(dailyCount).map(([date, count]) => ({
          fecha: date,
          alarmas: count,
        }))
      );
    }
  };

  const metrics = [
    {
      title: "Empresas Activas",
      value: stats.companies,
      icon: Building2,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Personal Registrado",
      value: stats.personnel,
      icon: Users,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Aplicativos",
      value: stats.applications,
      icon: Grid3x3,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Alarmas Totales",
      value: stats.alarms,
      icon: Bell,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Alarmas Abiertas",
      value: stats.activeAlarms,
      icon: AlertCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: "Tiempo Promedio Resolución",
      value: `${stats.avgResolutionTime} min`,
      icon: Clock,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
  ];

  const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#6366f1"];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Ejecutivo</h1>
          <p className="text-muted-foreground mt-2">
            Métricas y análisis en tiempo real del sistema
          </p>
        </div>
        <Button onClick={() => navigate("/reports")}>
          Ver Reportes Detallados
        </Button>
      </div>

      {/* Métricas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <Card key={metric.title} className="hover:shadow-lg transition-all">
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

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Estado de Alarmas - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Alarmas por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={alarmsByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {alarmsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Prioridad de Alarmas - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Alarmas por Prioridad</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={alarmsByPriority}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="cantidad" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tendencia de Alarmas - Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Alarmas (Últimos 7 días)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={alarmsTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="alarmas" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Acciones Rápidas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate("/companies")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Gestionar Empresas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Crear y administrar empresas del sistema
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate("/personnel")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gestionar Personal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Registrar y administrar usuarios
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate("/help-desk")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Mesa de Ayuda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Atender solicitudes y alarmas
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
