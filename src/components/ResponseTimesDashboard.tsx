import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Clock, TrendingDown, Activity } from "lucide-react";

interface ResponseTimesProps {
  alarms: any[];
}

export function ResponseTimesDashboard({ alarms }: ResponseTimesProps) {
  // Calculate response and resolution times
  const alarmsWithTimes = alarms.map(alarm => {
    const created = new Date(alarm.created_at).getTime();
    const responded = alarm.responded_at ? new Date(alarm.responded_at).getTime() : null;
    const resolved = alarm.resolved_at ? new Date(alarm.resolved_at).getTime() : null;
    
    const responseTime = responded ? Math.round((responded - created) / 60000) : null;
    const resolutionTime = alarm.resolution_time_minutes || null;
    
    return {
      ...alarm,
      responseTime,
      resolutionTime,
    };
  });

  // Average response time by priority
  const responseByPriority = ['alta', 'media', 'baja'].map(priority => {
    const priorityAlarms = alarmsWithTimes.filter(a => a.priority === priority && a.responseTime);
    const avg = priorityAlarms.length > 0
      ? Math.round(priorityAlarms.reduce((sum, a) => sum + (a.responseTime || 0), 0) / priorityAlarms.length)
      : 0;
    return {
      priority: priority.charAt(0).toUpperCase() + priority.slice(1),
      tiempoRespuesta: avg,
    };
  });

  // Average resolution time by priority
  const resolutionByPriority = ['alta', 'media', 'baja'].map(priority => {
    const priorityAlarms = alarmsWithTimes.filter(a => a.priority === priority && a.resolutionTime);
    const avg = priorityAlarms.length > 0
      ? Math.round(priorityAlarms.reduce((sum, a) => sum + (a.resolutionTime || 0), 0) / priorityAlarms.length)
      : 0;
    return {
      priority: priority.charAt(0).toUpperCase() + priority.slice(1),
      tiempoResolucion: avg,
    };
  });

  // Daily response and resolution times (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const dailyTimes = last7Days.map(day => {
    const dayAlarms = alarmsWithTimes.filter(a => a.created_at.startsWith(day));
    const responded = dayAlarms.filter(a => a.responseTime);
    const resolved = dayAlarms.filter(a => a.resolutionTime);
    
    const avgResponse = responded.length > 0
      ? Math.round(responded.reduce((sum, a) => sum + (a.responseTime || 0), 0) / responded.length)
      : 0;
    const avgResolution = resolved.length > 0
      ? Math.round(resolved.reduce((sum, a) => sum + (a.resolutionTime || 0), 0) / resolved.length)
      : 0;

    return {
      date: new Date(day).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      respuesta: avgResponse,
      resolucion: avgResolution,
    };
  });

  // Overall metrics
  const respondedAlarms = alarmsWithTimes.filter(a => a.responseTime);
  const resolvedAlarms = alarmsWithTimes.filter(a => a.resolutionTime);
  
  const avgResponseTime = respondedAlarms.length > 0
    ? Math.round(respondedAlarms.reduce((sum, a) => sum + (a.responseTime || 0), 0) / respondedAlarms.length)
    : 0;
  
  const avgResolutionTime = resolvedAlarms.length > 0
    ? Math.round(resolvedAlarms.reduce((sum, a) => sum + (a.resolutionTime || 0), 0) / resolvedAlarms.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio de Respuesta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseTime} min</div>
            <p className="text-xs text-muted-foreground mt-1">
              Desde creación hasta primera respuesta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio de Resolución</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResolutionTime} min</div>
            <p className="text-xs text-muted-foreground mt-1">
              Desde respuesta hasta resolución completa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos Respondidos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{respondedAlarms.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              De {alarms.length} casos totales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tiempo de Respuesta por Prioridad</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={responseByPriority}>
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
                <Bar dataKey="tiempoRespuesta" fill="hsl(var(--info))" name="Tiempo (min)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tiempo de Resolución por Prioridad</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={resolutionByPriority}>
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
                <Bar dataKey="tiempoResolucion" fill="hsl(var(--success))" name="Tiempo (min)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Tiempos (Últimos 7 días)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyTimes}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px"
                }}
                formatter={(value) => `${value} min`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="respuesta" 
                stroke="hsl(var(--info))" 
                name="Tiempo de Respuesta" 
                strokeWidth={2}
                dot={{ fill: "hsl(var(--info))" }}
              />
              <Line 
                type="monotone" 
                dataKey="resolucion" 
                stroke="hsl(var(--success))" 
                name="Tiempo de Resolución" 
                strokeWidth={2}
                dot={{ fill: "hsl(var(--success))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
