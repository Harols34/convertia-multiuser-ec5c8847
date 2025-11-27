import { useState, useEffect, memo } from "react";
import { Users, Activity, AlertTriangle, Shield, Lock, TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts";

interface DataPoint {
  time: string;
  value: number;
}

interface SystemMetric {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  data: DataPoint[];
  currentValue: number;
  trend: number;
  fixedValues: number[];
}

const createFixedData = (baseValues: number[]): DataPoint[] => {
  const now = new Date();
  return baseValues.map((value, i) => ({
    time: new Date(now.getTime() - (4 - i) * 60000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    value
  }));
};

const CustomTooltip = memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 px-3 py-2 rounded-lg border border-slate-300 shadow-lg">
        <p className="text-xs text-slate-200 font-medium">{payload[0].payload.time}</p>
        <p className="text-sm text-white font-bold">{Math.round(payload[0].value).toLocaleString()}</p>
      </div>
    );
  }
  return null;
});

CustomTooltip.displayName = 'CustomTooltip';

export function BIDashboard() {
  const [metrics, setMetrics] = useState<SystemMetric[]>([
    {
      id: "usuarios-activos",
      label: "Usuarios Activos",
      icon: <Users className="h-5 w-5" />,
      color: "#10b981",
      fixedValues: [1180, 1220, 1247, 1210, 1265],
      data: createFixedData([1180, 1220, 1247, 1210, 1265]),
      currentValue: 1265,
      trend: 12.5,
    },
    {
      id: "tickets-soporte",
      label: "Tickets de Soporte",
      icon: <Activity className="h-5 w-5" />,
      color: "#3b82f6",
      fixedValues: [38, 45, 43, 41, 37],
      data: createFixedData([38, 45, 43, 41, 37]),
      currentValue: 37,
      trend: -8.2,
    },
    {
      id: "alarmas-activas",
      label: "Alarmas Críticas",
      icon: <AlertTriangle className="h-5 w-5" />,
      color: "#ef4444",
      fixedValues: [10, 14, 12, 15, 11],
      data: createFixedData([10, 14, 12, 15, 11]),
      currentValue: 11,
      trend: -15.3,
    },
    {
      id: "accesos-seguros",
      label: "Accesos Seguros",
      icon: <Shield className="h-5 w-5" />,
      color: "#8b5cf6",
      fixedValues: [865, 892, 910, 878, 925],
      data: createFixedData([865, 892, 910, 878, 925]),
      currentValue: 925,
      trend: 18.7,
    },
    {
      id: "credenciales-activas",
      label: "Credenciales Activas",
      icon: <Lock className="h-5 w-5" />,
      color: "#f59e0b",
      fixedValues: [2420, 2456, 2480, 2445, 2510],
      data: createFixedData([2420, 2456, 2480, 2445, 2510]),
      currentValue: 2510,
      trend: 5.4,
    },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prevMetrics =>
        prevMetrics.map(metric => {
          const rotatedValues = [...metric.fixedValues.slice(1), metric.fixedValues[0]];
          const now = new Date();

          const newData = rotatedValues.map((value, i) => ({
            time: new Date(now.getTime() - (4 - i) * 60000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            value
          }));

          const newValue = rotatedValues[4];
          const oldValue = metric.currentValue;
          const newTrend = oldValue > 0 ? ((newValue - oldValue) / oldValue) * 100 : 0;

          return {
            ...metric,
            fixedValues: rotatedValues,
            data: newData,
            currentValue: newValue,
            trend: Number(newTrend.toFixed(1))
          };
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-8">
      <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-slate-100">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Dashboard Ejecutivo</h3>
          <p className="text-sm text-slate-600 mt-1">Métricas en tiempo real del sistema</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          <span className="text-sm font-semibold text-emerald-700">En vivo</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-6 border-2 border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="p-2.5 rounded-lg shadow-sm"
                  style={{ backgroundColor: `${metric.color}15`, color: metric.color }}
                >
                  {metric.icon}
                </div>
                <h4 className="text-sm font-semibold text-slate-700">{metric.label}</h4>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-slate-900">
                  {metric.currentValue.toLocaleString()}
                </span>
                <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${metric.trend > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                  }`}>
                  {metric.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{Math.abs(metric.trend).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="h-20 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metric.data}>
                  <defs>
                    <linearGradient id={`gradient-${metric.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={metric.color} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={metric.color} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={metric.color}
                    strokeWidth={2.5}
                    fill={`url(#gradient-${metric.id})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (metric.currentValue / (metric.currentValue * 1.2)) * 100)}%`,
                    backgroundColor: metric.color
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-6 border-2 border-slate-100">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Resumen Consolidado</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-600 mb-1 uppercase tracking-wide font-semibold">Total Operaciones</p>
            <p className="text-3xl font-bold text-slate-900">
              {metrics.reduce((sum, m) => sum + m.currentValue, 0).toLocaleString()}
            </p>
          </div>
          <div className="md:col-span-2 bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-600 mb-3 uppercase tracking-wide font-semibold">Top 3 Métricas</p>
            <div className="space-y-2">
              {metrics.slice(0, 3).map((metric) => (
                <div key={metric.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 font-medium">{metric.label}</span>
                  <span className="font-bold text-slate-900">{metric.currentValue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t-2 border-slate-100 grid grid-cols-3 gap-6">
        <div className="text-center">
          <p className="text-xs text-slate-600 mb-1 uppercase tracking-wide font-semibold">Uptime</p>
          <p className="text-xl font-bold text-emerald-600">99.9%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-600 mb-1 uppercase tracking-wide font-semibold">Performance</p>
          <p className="text-xl font-bold text-blue-600">Óptimo</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-600 mb-1 uppercase tracking-wide font-semibold">Estado</p>
          <p className="text-xl font-bold text-slate-900 flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Activo
          </p>
        </div>
      </div>
    </div>
  );
}
