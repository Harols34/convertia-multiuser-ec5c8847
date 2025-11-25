import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ResponseTimesDashboard } from "@/components/ResponseTimesDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Reports() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [exportOptions, setExportOptions] = useState({
    users: true,
    credentials: true,
    alarms: true,
    metrics: true,
    responseTimes: true,
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadReportData();
    }
  }, [selectedCompany]);

  const loadCompanies = async () => {
    const { data } = await supabase.from("companies").select("*").eq("active", true);
    if (data) setCompanies(data);
  };

  const loadReportData = async () => {
    setLoading(true);
    
    const filter = selectedCompany === "all" 
      ? {} 
      : { company_id: selectedCompany };

    const [usersRes, appsRes, alarmsRes, credentialsRes] = await Promise.all([
      supabase.from("end_users").select(`
        *,
        companies(name)
      `).match(filter),
      supabase.from("company_applications").select("*").match(
        selectedCompany === "all" ? {} : { company_id: selectedCompany }
      ),
      supabase.from("alarms").select(`
        *,
        end_users(full_name, companies(name))
      `),
      supabase.from("user_applications").select(`
        *,
        end_users(full_name, document_number, companies(name)),
        company_applications(name),
        global_applications(name)
      `),
    ]);

    // Filter alarms by company
    let filteredAlarms = alarmsRes.data || [];
    if (selectedCompany !== "all") {
      const companyUsers = usersRes.data?.map(u => u.id) || [];
      filteredAlarms = filteredAlarms.filter(a => companyUsers.includes(a.end_user_id));
    }

    // Filter credentials by company
    let filteredCreds = credentialsRes.data || [];
    if (selectedCompany !== "all") {
      const companyUsers = usersRes.data?.map(u => u.id) || [];
      filteredCreds = filteredCreds.filter(c => companyUsers.includes(c.end_user_id));
    }

    // Calculate metrics
    const totalCases = filteredAlarms.length;
    const resolvedCases = filteredAlarms.filter(a => a.status === "resuelta" || a.status === "cerrada").length;
    const activeCases = filteredAlarms.filter(a => a.status === "abierta" || a.status === "en_proceso").length;
    const respondedCases = filteredAlarms.filter(a => a.responded_at).length;
    
    // Tiempos de respuesta (tiempo entre created_at y responded_at)
    const responseTimesData = filteredAlarms
      .filter(a => a.responded_at)
      .map(a => {
        const created = new Date(a.created_at).getTime();
        const responded = new Date(a.responded_at).getTime();
        return Math.round((responded - created) / 60000); // minutos
      });
    const avgResponseTime = responseTimesData.length > 0
      ? Math.round(responseTimesData.reduce((sum, t) => sum + t, 0) / responseTimesData.length)
      : 0;
    
    // Tiempos de resolución
    const resolutionTimesData = filteredAlarms
      .filter(a => a.resolution_time_minutes)
      .map(a => a.resolution_time_minutes);
    const avgResolutionTime = resolutionTimesData.length > 0
      ? Math.round(resolutionTimesData.reduce((sum, t) => sum + t, 0) / resolutionTimesData.length)
      : 0;

    // Most common issues
    const issueFrequency = filteredAlarms.reduce((acc: any, alarm) => {
      const key = alarm.title.toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    const topIssues = Object.entries(issueFrequency)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count }));

    // Access compliance (users with credentials)
    const usersWithAccess = new Set(filteredCreds.map(c => c.end_user_id)).size;
    const totalUsers = usersRes.data?.length || 0;
    const accessCompliance = totalUsers > 0 ? (usersWithAccess / totalUsers) * 100 : 0;

    setReportData({
      users: usersRes.data || [],
      applications: appsRes.data || [],
      alarms: filteredAlarms,
      credentials: filteredCreds,
      metrics: {
        totalCases,
        resolvedCases,
        activeCases,
        respondedCases,
        avgResponseTime,
        avgResolutionTime,
        accessCompliance: Math.round(accessCompliance),
        topIssues,
      },
    });

    setLoading(false);
  };

  const exportToExcel = () => {
    if (!reportData) return;

    const wb = XLSX.utils.book_new();

    if (exportOptions.users) {
      const usersData = reportData.users.map((user: any) => ({
        "Nombre Completo": user.full_name,
        "Documento": user.document_number,
        "Empresa": user.companies?.name,
        "Email": user.email || "",
        "Teléfono": user.phone || "",
        "Estado": user.active ? "Activo" : "Inactivo",
        "Fecha Creación": new Date(user.created_at).toLocaleString("es-ES"),
      }));
      const ws = XLSX.utils.json_to_sheet(usersData);
      XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
    }

    if (exportOptions.credentials) {
      const credsData = reportData.credentials.map((cred: any) => ({
        "Usuario": cred.end_users?.full_name,
        "Documento": cred.end_users?.document_number,
        "Empresa": cred.end_users?.companies?.name,
        "Aplicativo": cred.company_applications?.name || cred.global_applications?.name,
        "Usuario Aplicativo": cred.username || "",
        "Contraseña": cred.password || "",
        "Fecha Creación": cred.credential_created_at ? new Date(cred.credential_created_at).toLocaleString("es-ES") : "",
        "Última Actualización": cred.last_password_change ? new Date(cred.last_password_change).toLocaleString("es-ES") : "",
        "Fecha Vencimiento": cred.credential_expires_at ? new Date(cred.credential_expires_at).toLocaleString("es-ES") : "",
        "Notas": cred.notes || cred.credential_notes || "",
      }));
      const ws = XLSX.utils.json_to_sheet(credsData);
      XLSX.utils.book_append_sheet(wb, ws, "Credenciales");
    }

    if (exportOptions.alarms) {
      const alarmsData = reportData.alarms.map((alarm: any) => {
        const created = new Date(alarm.created_at).getTime();
        const responded = alarm.responded_at ? new Date(alarm.responded_at).getTime() : null;
        const responseTime = responded ? Math.round((responded - created) / 60000) : null;
        
        return {
          "Título": alarm.title,
          "Descripción": alarm.description,
          "Usuario": alarm.end_users?.full_name,
          "Empresa": alarm.end_users?.companies?.name,
          "Estado": alarm.status,
          "Prioridad": alarm.priority,
          "Fecha Creación": new Date(alarm.created_at).toLocaleString("es-ES"),
          "Fecha Respuesta": alarm.responded_at ? new Date(alarm.responded_at).toLocaleString("es-ES") : "",
          "Tiempo Respuesta (min)": responseTime || "",
          "Tiempo Resolución (min)": alarm.resolution_time_minutes || "",
          "Fecha Resolución": alarm.resolved_at ? new Date(alarm.resolved_at).toLocaleString("es-ES") : "",
        };
      });
      const ws = XLSX.utils.json_to_sheet(alarmsData);
      XLSX.utils.book_append_sheet(wb, ws, "Alarmas");
    }

    if (exportOptions.metrics) {
      const summaryData = [
        { "Métrica": "Total de Casos", "Valor": reportData.metrics.totalCases },
        { "Métrica": "Casos Resueltos", "Valor": reportData.metrics.resolvedCases },
        { "Métrica": "Casos en Gestión", "Valor": reportData.metrics.activeCases },
        { "Métrica": "Casos Respondidos", "Valor": reportData.metrics.respondedCases },
        { "Métrica": "Tiempo Promedio Respuesta (min)", "Valor": reportData.metrics.avgResponseTime },
        { "Métrica": "Tiempo Promedio Resolución (min)", "Valor": reportData.metrics.avgResolutionTime },
        { "Métrica": "Cumplimiento de Accesos (%)", "Valor": reportData.metrics.accessCompliance },
      ];
      const ws = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws, "Métricas");

      if (reportData.metrics.topIssues.length > 0) {
        const issuesData = reportData.metrics.topIssues.map((issue: any) => ({
          "Novedad": issue.issue,
          "Frecuencia": issue.count,
        }));
        const wsIssues = XLSX.utils.json_to_sheet(issuesData);
        XLSX.utils.book_append_sheet(wb, wsIssues, "Novedades Frecuentes");
      }
    }

    const fileName = `reporte_completo_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({ title: "Reporte Excel exportado exitosamente" });
  };

  const exportToPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    const companyName = selectedCompany === "all" 
      ? "Todas las Empresas" 
      : companies.find(c => c.id === selectedCompany)?.name || "";

    doc.setFontSize(16);
    doc.text("Reporte de Gestión BI", 14, 20);
    doc.setFontSize(11);
    doc.text(`Empresa: ${companyName}`, 14, 28);
    doc.text(`Generado: ${new Date().toLocaleString("es-ES")}`, 14, 34);

    let currentY = 42;

    // Metrics
    if (exportOptions.metrics) {
      autoTable(doc, {
        startY: currentY,
        head: [["Métrica", "Valor"]],
        body: [
          ["Total de Casos", reportData.metrics.totalCases],
          ["Casos Resueltos", reportData.metrics.resolvedCases],
          ["Casos en Gestión", reportData.metrics.activeCases],
          ["Casos Respondidos", reportData.metrics.respondedCases],
          ["Tiempo Promedio Respuesta", `${reportData.metrics.avgResponseTime} min`],
          ["Tiempo Promedio Resolución", `${reportData.metrics.avgResolutionTime} min`],
          ["Cumplimiento de Accesos", `${reportData.metrics.accessCompliance}%`],
        ],
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;

      if (reportData.metrics.topIssues.length > 0) {
        doc.setFontSize(12);
        doc.text("Novedades Más Frecuentes", 14, currentY);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [["Novedad", "Frecuencia"]],
          body: reportData.metrics.topIssues.map((issue: any) => [
            issue.issue,
            issue.count,
          ]),
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
      }
    }

    // Alarms with response times
    if (exportOptions.alarms && exportOptions.responseTimes && reportData.alarms.length > 0) {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(12);
      doc.text("Detalle de Alarmas con Tiempos", 14, currentY);
      
      autoTable(doc, {
        startY: currentY + 5,
        head: [["Título", "Usuario", "Estado", "T.Respuesta (min)", "T.Resolución (min)"]],
        body: reportData.alarms.slice(0, 100).map((alarm: any) => {
          const created = new Date(alarm.created_at).getTime();
          const responded = alarm.responded_at ? new Date(alarm.responded_at).getTime() : null;
          const responseTime = responded ? Math.round((responded - created) / 60000) : "-";
          
          return [
            alarm.title.substring(0, 25),
            alarm.end_users?.full_name?.substring(0, 20) || "-",
            alarm.status,
            responseTime,
            alarm.resolution_time_minutes || "-",
          ];
        }),
        styles: { fontSize: 8 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Users with credentials
    if (exportOptions.users && exportOptions.credentials && reportData.users.length > 0) {
      doc.addPage();
      currentY = 20;
      
      doc.setFontSize(12);
      doc.text("Personal y Credenciales", 14, currentY);
      
      const userCredentials = reportData.users.slice(0, 50).map((user: any) => {
        const userCreds = reportData.credentials.filter((c: any) => c.end_user_id === user.id);
        const apps = userCreds.map((c: any) => 
          c.company_applications?.name || c.global_applications?.name || "-"
        ).join(", ");
        
        return [
          user.full_name,
          user.document_number,
          user.companies?.name || "-",
          apps || "Sin aplicativos",
        ];
      });
      
      autoTable(doc, {
        startY: currentY + 5,
        head: [["Nombre", "Documento", "Empresa", "Aplicativos"]],
        body: userCredentials,
        styles: { fontSize: 8 },
      });
    }

    doc.save(`reporte_bi_${Date.now()}.pdf`);
    toast({ title: "Reporte PDF exportado exitosamente" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reportes y Exportaciones</h1>
        <p className="text-muted-foreground mt-2">
          Genera y descarga reportes detallados del sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Selecciona una empresa..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las Empresas</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {reportData && !loading && (
        <>
          {/* Metrics Summary */}
          <Tabs defaultValue="metrics" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="metrics">Métricas Generales</TabsTrigger>
              <TabsTrigger value="times">Tiempos de Respuesta</TabsTrigger>
            </TabsList>

            <TabsContent value="metrics" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total de Casos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{reportData.metrics.totalCases}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Casos Resueltos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-success">{reportData.metrics.resolvedCases}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Casos en Gestión</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-warning">{reportData.metrics.activeCases}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Tiempo Promedio Respuesta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{reportData.metrics.avgResponseTime} min</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Tiempo Promedio Resolución</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{reportData.metrics.avgResolutionTime} min</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Cumplimiento de Accesos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-info">{reportData.metrics.accessCompliance}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Personal Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{reportData.users.length}</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="times">
              <ResponseTimesDashboard alarms={reportData.alarms} />
            </TabsContent>
          </Tabs>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Datos a Exportar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="users" 
                    checked={exportOptions.users}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, users: checked as boolean }))
                    }
                  />
                  <Label htmlFor="users" className="cursor-pointer">Personal (Usuarios)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="credentials" 
                    checked={exportOptions.credentials}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, credentials: checked as boolean }))
                    }
                  />
                  <Label htmlFor="credentials" className="cursor-pointer">Credenciales y Aplicativos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="alarms" 
                    checked={exportOptions.alarms}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, alarms: checked as boolean }))
                    }
                  />
                  <Label htmlFor="alarms" className="cursor-pointer">Alarmas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="metrics" 
                    checked={exportOptions.metrics}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, metrics: checked as boolean }))
                    }
                  />
                  <Label htmlFor="metrics" className="cursor-pointer">Métricas y Estadísticas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="responseTimes" 
                    checked={exportOptions.responseTimes}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, responseTimes: checked as boolean }))
                    }
                  />
                  <Label htmlFor="responseTimes" className="cursor-pointer">Tiempos de Respuesta y Resolución</Label>
                </div>
              </div>
              
              <div className="grid gap-2 md:grid-cols-2 pt-4">
                <Button onClick={exportToExcel} className="w-full">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar a Excel
                </Button>
                <Button onClick={exportToPDF} className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  Exportar a PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Top Issues */}
          {reportData.metrics.topIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Novedades Más Frecuentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.metrics.topIssues.map((issue: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="font-medium">{issue.issue}</span>
                      <span className="text-muted-foreground">{issue.count} casos</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
