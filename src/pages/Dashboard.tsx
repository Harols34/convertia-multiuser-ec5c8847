import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Grid3x3, Bell, TrendingUp, AlertCircle } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({
    companies: 0,
    personnel: 0,
    applications: 0,
    alarms: 0,
    activeAlarms: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [companiesRes, personnelRes, appsRes, alarmsRes, activeAlarmsRes] = await Promise.all([
      supabase.from("companies").select("id", { count: "exact", head: true }),
      supabase.from("end_users").select("id", { count: "exact", head: true }),
      supabase.from("company_applications").select("id", { count: "exact", head: true }),
      supabase.from("alarms").select("id", { count: "exact", head: true }),
      supabase.from("alarms").select("id", { count: "exact", head: true }).eq("status", "abierta"),
    ]);

    setStats({
      companies: companiesRes.count || 0,
      personnel: personnelRes.count || 0,
      applications: appsRes.count || 0,
      alarms: alarmsRes.count || 0,
      activeAlarms: activeAlarmsRes.count || 0,
    });
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Vista general del sistema de gestión multiempresa
        </p>
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

      {/* Bienvenida y acciones rápidas */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bienvenido al Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta es tu plataforma centralizada para gestionar empresas, personal, aplicativos y atender solicitudes de ayuda.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span>Gestión multiempresa totalmente aislada</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent" />
                <span>Control de accesos por código único</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-info" />
                <span>Mesa de ayuda integrada</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
