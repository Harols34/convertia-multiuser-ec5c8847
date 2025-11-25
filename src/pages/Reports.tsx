import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Reports() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
    const avgResolutionTime = filteredAlarms
      .filter(a => a.resolution_time_minutes)
      .reduce((sum, a) => sum + a.resolution_time_minutes, 0) / (resolvedCases || 1);

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
        avgResolutionTime: Math.round(avgResolutionTime),
        accessCompliance: Math.round(accessCompliance),
        topIssues,
      },
    });

    setLoading(false);
  };

  const exportToExcel = (type: "users" | "credentials" | "alarms" | "summary") => {
    if (!reportData) return;

    const wb = XLSX.utils.book_new();

    if (type === "users" || type === "summary") {
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

    if (type === "credentials" || type === "summary") {
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

    if (type === "alarms" || type === "summary") {
      const alarmsData = reportData.alarms.map((alarm: any) => ({
        "Título": alarm.title,
        "Descripción": alarm.description,
        "Usuario": alarm.end_users?.full_name,
        "Empresa": alarm.end_users?.companies?.name,
        "Estado": alarm.status,
        "Prioridad": alarm.priority,
        "Fecha Creación": new Date(alarm.created_at).toLocaleString("es-ES"),
        "Tiempo Resolución (min)": alarm.resolution_time_minutes || "",
        "Fecha Resolución": alarm.resolved_at ? new Date(alarm.resolved_at).toLocaleString("es-ES") : "",
      }));
      const ws = XLSX.utils.json_to_sheet(alarmsData);
      XLSX.utils.book_append_sheet(wb, ws, "Alarmas");
    }

    if (type === "summary") {
      const summaryData = [
        { "Métrica": "Total de Casos", "Valor": reportData.metrics.totalCases },
        { "Métrica": "Casos Resueltos", "Valor": reportData.metrics.resolvedCases },
        { "Métrica": "Casos en Gestión", "Valor": reportData.metrics.activeCases },
        { "Métrica": "Tiempo Promedio Resolución (min)", "Valor": reportData.metrics.avgResolutionTime },
        { "Métrica": "Cumplimiento de Accesos (%)", "Valor": reportData.metrics.accessCompliance },
      ];
      const ws = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws, "Resumen");

      const issuesData = reportData.metrics.topIssues.map((issue: any) => ({
        "Novedad": issue.issue,
        "Frecuencia": issue.count,
      }));
      const wsIssues = XLSX.utils.json_to_sheet(issuesData);
      XLSX.utils.book_append_sheet(wb, wsIssues, "Novedades Frecuentes");
    }

    const fileName = `reporte_${type}_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({ title: "Reporte exportado exitosamente" });
  };

  const exportToPDF = (type: "summary" | "detailed") => {
    if (!reportData) return;

    const doc = new jsPDF();
    const companyName = selectedCompany === "all" 
      ? "Todas las Empresas" 
      : companies.find(c => c.id === selectedCompany)?.name || "";

    doc.setFontSize(16);
    doc.text("Reporte de Gestión", 14, 20);
    doc.setFontSize(11);
    doc.text(`Empresa: ${companyName}`, 14, 28);
    doc.text(`Generado: ${new Date().toLocaleString("es-ES")}`, 14, 34);

    // Summary metrics
    (doc as any).autoTable({
      startY: 42,
      head: [["Métrica", "Valor"]],
      body: [
        ["Total de Casos", reportData.metrics.totalCases],
        ["Casos Resueltos", reportData.metrics.resolvedCases],
        ["Casos en Gestión", reportData.metrics.activeCases],
        ["Tiempo Promedio Resolución", `${reportData.metrics.avgResolutionTime} min`],
        ["Cumplimiento de Accesos", `${reportData.metrics.accessCompliance}%`],
      ],
    });

    // Top issues
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("Novedades Más Frecuentes", 14, finalY);
    
    (doc as any).autoTable({
      startY: finalY + 5,
      head: [["Novedad", "Frecuencia"]],
      body: reportData.metrics.topIssues.map((issue: any) => [
        issue.issue,
        issue.count,
      ]),
    });

    if (type === "detailed") {
      // Add alarms details
      doc.addPage();
      doc.setFontSize(12);
      doc.text("Detalle de Alarmas", 14, 20);
      
      (doc as any).autoTable({
        startY: 25,
        head: [["Título", "Usuario", "Estado", "Prioridad", "Tiempo (min)"]],
        body: reportData.alarms.slice(0, 50).map((alarm: any) => [
          alarm.title.substring(0, 30),
          alarm.end_users?.full_name,
          alarm.status,
          alarm.priority,
          alarm.resolution_time_minutes || "-",
        ]),
      });
    }

    doc.save(`reporte_${type}_${Date.now()}.pdf`);
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

          {/* Export Options */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Exportar a Excel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button onClick={() => exportToExcel("users")} className="w-full" variant="outline">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Usuarios
                </Button>
                <Button onClick={() => exportToExcel("credentials")} className="w-full" variant="outline">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Credenciales
                </Button>
                <Button onClick={() => exportToExcel("alarms")} className="w-full" variant="outline">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Alarmas
                </Button>
                <Button onClick={() => exportToExcel("summary")} className="w-full">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Reporte Completo
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exportar a PDF</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button onClick={() => exportToPDF("summary")} className="w-full" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Reporte Resumen
                </Button>
                <Button onClick={() => exportToPDF("detailed")} className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  Reporte Detallado
                </Button>
              </CardContent>
            </Card>
          </div>

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
