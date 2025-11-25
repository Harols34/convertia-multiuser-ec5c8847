import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Users, Activity, Download, Search, AlertTriangle, MapPin, Monitor } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Verification() {
    const [accessLogs, setAccessLogs] = useState<any[]>([]);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterUser, setFilterUser] = useState("");

    // Dashboard Metrics
    const [metrics, setMetrics] = useState({
        totalAccess: 0,
        failedAccess: 0,
        activeUsers: 0,
        suspiciousActivity: 0
    });

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        try {
            // Load Access Logs
            const { data: accessData } = await supabase
                .from("access_logs")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(100);

            setAccessLogs(accessData || []);

            // Load Activity Logs
            const { data: activityData } = await supabase
                .from("activity_logs")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(100);

            setActivityLogs(activityData || []);

            // Calculate Metrics (Simple version for MVP)
            const today = new Date().toISOString().split('T')[0];
            const todayAccess = accessData?.filter(l => l.created_at.startsWith(today)) || [];
            const failed = todayAccess.filter(l => l.status === 'failure').length;
            const uniqueUsers = new Set(todayAccess.map(l => l.user_id)).size;

            setMetrics({
                totalAccess: todayAccess.length,
                failedAccess: failed,
                activeUsers: uniqueUsers,
                suspiciousActivity: failed > 5 ? 1 : 0 // Simple threshold
            });

        } catch (error) {
            console.error("Error loading logs:", error);
        } finally {
            setLoading(false);
        }
    };

    const exportAccessLogs = (formatType: 'excel' | 'pdf') => {
        if (formatType === 'excel') {
            const ws = XLSX.utils.json_to_sheet(accessLogs);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Access Logs");
            XLSX.writeFile(wb, `access_logs_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
        } else {
            const doc = new jsPDF();
            autoTable(doc, {
                head: [['Fecha', 'Usuario/Email', 'Rol', 'IP', 'Estado', 'Razón']],
                body: accessLogs.map(log => [
                    format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
                    log.email || log.user_id,
                    log.role,
                    log.ip_address,
                    log.status,
                    log.failure_reason || '-'
                ])
            });
            doc.save(`access_logs_${format(new Date(), "yyyy-MM-dd")}.pdf`);
        }
    };

    const filteredAccessLogs = accessLogs.filter(log =>
        (log.email && log.email.toLowerCase().includes(filterUser.toLowerCase())) ||
        (log.user_id && log.user_id.includes(filterUser))
    );

    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <ShieldAlert className="h-8 w-8 text-primary" />
                        Módulo de Verificación
                    </h1>
                    <p className="text-muted-foreground">Auditoría, seguridad y monitoreo de actividad</p>
                </div>
                <Button onClick={loadLogs} variant="outline">
                    Actualizar Datos
                </Button>
            </div>

            {/* Dashboard KPI Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Accesos Hoy</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totalAccess}</div>
                        <p className="text-xs text-muted-foreground">Intentos de login</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Fallos de Acceso</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{metrics.failedAccess}</div>
                        <p className="text-xs text-muted-foreground">Credenciales inválidas</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.activeUsers}</div>
                        <p className="text-xs text-muted-foreground">Sesiones únicas hoy</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Alertas</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">{metrics.suspiciousActivity}</div>
                        <p className="text-xs text-muted-foreground">Patrones inusuales</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="access" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="access">Auditoría de Accesos</TabsTrigger>
                    <TabsTrigger value="activity">Registro de Actividad</TabsTrigger>
                </TabsList>

                <TabsContent value="access" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Logs de Inicio de Sesión</CardTitle>
                                <div className="flex gap-2">
                                    <div className="relative w-64">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Filtrar por usuario..."
                                            className="pl-8"
                                            value={filterUser}
                                            onChange={(e) => setFilterUser(e.target.value)}
                                        />
                                    </div>
                                    <Select onValueChange={(v: any) => exportAccessLogs(v)}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Exportar" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                                            <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <CardDescription>Registro inmutable de todos los intentos de acceso al sistema.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha y Hora</TableHead>
                                        <TableHead>Usuario / Email</TableHead>
                                        <TableHead>Rol</TableHead>
                                        <TableHead>IP / Ubicación</TableHead>
                                        <TableHead>Dispositivo</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAccessLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell>{format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{log.email || "Desconocido"}</div>
                                                <div className="text-xs text-muted-foreground">{log.user_id || "-"}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{log.role || "N/A"}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {log.ip_address || "N/A"}
                                                </div>
                                                <div className="text-xs text-muted-foreground">{log.location || ""}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1" title={log.user_agent}>
                                                    <Monitor className="h-3 w-3" />
                                                    <span className="truncate max-w-[150px]">{log.user_agent || "N/A"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                                                    {log.status === 'success' ? 'Exitoso' : 'Fallido'}
                                                </Badge>
                                                {log.failure_reason && (
                                                    <div className="text-xs text-destructive mt-1">{log.failure_reason}</div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="activity" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Logs de Actividad del Sistema</CardTitle>
                            <CardDescription>Registro detallado de acciones realizadas por los usuarios.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Módulo</TableHead>
                                        <TableHead>Acción</TableHead>
                                        <TableHead>Detalles</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activityLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell>{format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                                            <TableCell>{log.user_id}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{log.module}</Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{log.action_type}</TableCell>
                                            <TableCell>
                                                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-w-[300px]">
                                                    {JSON.stringify(log.details, null, 2)}
                                                </pre>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
