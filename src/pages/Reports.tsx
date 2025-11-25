import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileSpreadsheet, FileText, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Reports() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const [reportData, setReportData] = useState({
    totalCases: 0,
    openCases: 0,
    inProgressCases: 0,
    resolvedCases: 0,
    closedCases: 0,
    avgResolutionTime: 0,
    totalUsers: 0,
    totalApplications: 0,
    frequentIssues: [] as any[],
  });

  const [credentials, setCredentials] = useState<any[]>([]);
  const [alarmDetails, setAlarmDetails] = useState<any[]>([]);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    setLoading(true);

    // Get alarms data
    const { data: alarms } = await supabase.from("alarms").select(`
      *,
      end_users (
        full_name,
        document_number,
        companies (name)
      )
    `);

    if (alarms) {
      const statusCounts = alarms.reduce((acc: any, alarm) => {
        acc[alarm.status] = (acc[alarm.status] || 0) + 1;
        return acc;
      }, {});

      const resolutionTimes = alarms
        .filter((a) => a.resolution_time_minutes)
        .map((a) => a.resolution_time_minutes);

      const avgTime = resolutionTimes.length
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : 0;

      // Frequent issues (by title similarity)
      const issueCounts: Record<string, number> = {};
      alarms.forEach((alarm) => {
        const key = alarm.title.toLowerCase().substring(0, 30);
        issueCounts[key] = (issueCounts[key] || 0) + 1;
      });

      const frequentIssues = Object.entries(issueCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([issue, count]) => ({ issue, count }));

      setReportData({
        totalCases: alarms.length,
        openCases: statusCounts.abierta || 0,
        inProgressCases: statusCounts.en_proceso || 0,
        resolvedCases: statusCounts.resuelta || 0,
        closedCases: statusCounts.cerrada || 0,
        avgResolutionTime: Math.round(avgTime),
        totalUsers: 0,
        totalApplications: 0,
        frequentIssues,
      });

      setAlarmDetails(alarms);
    }

    // Get user applications with credentials
    const { data: userApps } = await supabase.from("user_applications").select(`
      *,
      end_users (
        full_name,
        document_number,
        companies (name)
      ),
      company_applications (name),
      global_applications (name)
    `);

    if (userApps) {
      setCredentials(userApps);
    }

    // Get counts
    const [usersRes, appsRes] = await Promise.all([
      supabase.from("end_users").select("id", { count: "exact", head: true }),
      supabase.from("company_applications").select("id", { count: "exact", head: true }),
    ]);

    setReportData((prev) => ({
      ...prev,
      totalUsers: usersRes.count || 0,
      totalApplications: appsRes.count || 0,
    }));

    setLoading(false);
  };

  const exportToExcel = (type: "summary" | "credentials" | "alarms") => {
    try {
      let data: any[] = [];
      let filename = "";

      if (type === "summary") {
        data = [
          { Métrica: "Total de Casos", Valor: reportData.totalCases },
          { Métrica: "Casos Abiertos", Valor: reportData.openCases },
          { Métrica: "Casos En Proceso", Valor: reportData.inProgressCases },
          { Métrica: "Casos Resueltos", Valor: reportData.resolvedCases },
          { Métrica: "Casos Cerrados", Valor: reportData.closedCases },
          { Métrica: "Tiempo Promedio Resolución (min)", Valor: reportData.avgResolutionTime },
          { Métrica: "Total Usuarios", Valor: reportData.totalUsers },
          { Métrica: "Total Aplicativos", Valor: reportData.totalApplications },
        ];
        filename = "reporte_resumen.xlsx";
      } else if (type === "credentials") {
        data = credentials.map((cred) => ({
          Usuario: cred.end_users?.full_name || "N/A",
          Documento: cred.end_users?.document_number || "N/A",
          Empresa: cred.end_users?.companies?.name || "N/A",
          Aplicativo: cred.company_applications?.name || cred.global_applications?.name || "N/A",
          "Nombre de Usuario": cred.username || "N/A",
          Contraseña: cred.password || "N/A",
          "Fecha Creación": cred.credential_created_at
            ? new Date(cred.credential_created_at).toLocaleString()
            : "N/A",
          "Última Actualización": cred.credential_updated_at
            ? new Date(cred.credential_updated_at).toLocaleString()
            : "N/A",
          "Fecha Vencimiento": cred.credential_expires_at
            ? new Date(cred.credential_expires_at).toLocaleString()
            : "N/A",
        }));
        filename = "reporte_credenciales.xlsx";
      } else if (type === "alarms") {
        data = alarmDetails.map((alarm) => ({
          Título: alarm.title,
          Descripción: alarm.description,
          Estado: alarm.status,
          Prioridad: alarm.priority,
          Usuario: alarm.end_users?.full_name || "N/A",
          Empresa: alarm.end_users?.companies?.name || "N/A",
          "Fecha Creación": new Date(alarm.created_at).toLocaleString(),
          "Fecha Respuesta": alarm.responded_at
            ? new Date(alarm.responded_at).toLocaleString()
            : "N/A",
          "Fecha Resolución": alarm.resolved_at
            ? new Date(alarm.resolved_at).toLocaleString()
            : "N/A",
          "Tiempo Resolución (min)": alarm.resolution_time_minutes || "N/A",
        }));
        filename = "reporte_alarmas.xlsx";
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reporte");
      XLSX.writeFile(wb, filename);

      toast({ title: "Excel descargado correctamente" });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el archivo Excel",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = (type: "summary" | "credentials" | "alarms") => {
    try {
      let data: any[] = [];
      let filename = "";

      if (type === "summary") {
        data = [
          { Métrica: "Total de Casos", Valor: reportData.totalCases },
          { Métrica: "Casos Abiertos", Valor: reportData.openCases },
          { Métrica: "Casos En Proceso", Valor: reportData.inProgressCases },
          { Métrica: "Casos Resueltos", Valor: reportData.resolvedCases },
          { Métrica: "Casos Cerrados", Valor: reportData.closedCases },
          { Métrica: "Tiempo Promedio Resolución (min)", Valor: reportData.avgResolutionTime },
          { Métrica: "Total Usuarios", Valor: reportData.totalUsers },
          { Métrica: "Total Aplicativos", Valor: reportData.totalApplications },
        ];
        filename = "reporte_resumen.csv";
      } else if (type === "credentials") {
        data = credentials.map((cred) => ({
          Usuario: cred.end_users?.full_name || "N/A",
          Documento: cred.end_users?.document_number || "N/A",
          Empresa: cred.end_users?.companies?.name || "N/A",
          Aplicativo: cred.company_applications?.name || cred.global_applications?.name || "N/A",
          "Nombre de Usuario": cred.username || "N/A",
          Contraseña: cred.password || "N/A",
        }));
        filename = "reporte_credenciales.csv";
      } else if (type === "alarms") {
        data = alarmDetails.map((alarm) => ({
          Título: alarm.title,
          Estado: alarm.status,
          Prioridad: alarm.priority,
          Usuario: alarm.end_users?.full_name || "N/A",
          "Tiempo Resolución (min)": alarm.resolution_time_minutes || "N/A",
        }));
        filename = "reporte_alarmas.csv";
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();

      toast({ title: "CSV descargado correctamente" });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el archivo CSV",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = async (type: "summary" | "credentials" | "alarms") => {
    try {
      const pdf = new jsPDF();
      const title = type === "summary" ? "Reporte Resumen" : type === "credentials" ? "Reporte de Credenciales" : "Reporte de Alarmas";
      
      pdf.setFontSize(18);
      pdf.text(title, 14, 20);
      pdf.setFontSize(11);
      pdf.text(`Generado: ${new Date().toLocaleString()}`, 14, 28);

      if (type === "summary") {
        const data = [
          ["Métrica", "Valor"],
          ["Total de Casos", reportData.totalCases.toString()],
          ["Casos Abiertos", reportData.openCases.toString()],
          ["Casos En Proceso", reportData.inProgressCases.toString()],
          ["Casos Resueltos", reportData.resolvedCases.toString()],
          ["Casos Cerrados", reportData.closedCases.toString()],
          ["Tiempo Promedio Resolución (min)", reportData.avgResolutionTime.toString()],
          ["Total Usuarios", reportData.totalUsers.toString()],
          ["Total Aplicativos", reportData.totalApplications.toString()],
        ];

        autoTable(pdf, {
          head: [data[0]],
          body: data.slice(1),
          startY: 35,
        });

        if (reportData.frequentIssues.length > 0) {
          const frequentData = [
            ["Novedad Frecuente", "Cantidad"],
            ...reportData.frequentIssues.map((item) => [item.issue, item.count.toString()]),
          ];

          autoTable(pdf, {
            head: [frequentData[0]],
            body: frequentData.slice(1),
            startY: (pdf as any).lastAutoTable.finalY + 10,
          });
        }
      } else if (type === "credentials") {
        const data = credentials.slice(0, 50).map((cred) => [
          cred.end_users?.full_name || "N/A",
          cred.company_applications?.name || cred.global_applications?.name || "N/A",
          cred.username || "N/A",
          cred.credential_expires_at ? new Date(cred.credential_expires_at).toLocaleDateString() : "N/A",
        ]);

        autoTable(pdf, {
          head: [["Usuario", "Aplicativo", "Usuario App", "Vencimiento"]],
          body: data,
          startY: 35,
        });
      } else if (type === "alarms") {
        const data = alarmDetails.slice(0, 50).map((alarm) => [
          alarm.title.substring(0, 30),
          alarm.status,
          alarm.priority,
          alarm.end_users?.full_name || "N/A",
          alarm.resolution_time_minutes ? `${alarm.resolution_time_minutes} min` : "N/A",
        ]);

        autoTable(pdf, {
          head: [["Título", "Estado", "Prioridad", "Usuario", "T. Resolución"]],
          body: data,
          startY: 35,
        });
      }

      pdf.save(`${title.replace(/ /g, "_").toLowerCase()}.pdf`);
      toast({ title: "PDF descargado correctamente" });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    }
  };

  const exportDashboardImage = async () => {
    if (!dashboardRef.current) return;

    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      link.download = "dashboard_screenshot.png";
      link.href = canvas.toDataURL();
      link.click();

      toast({ title: "Imagen del dashboard descargada" });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar la imagen",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centro de Reportes</h1>
          <p className="text-muted-foreground mt-2">
            Descarga informes detallados en múltiples formatos
          </p>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary">Resumen Ejecutivo</TabsTrigger>
          <TabsTrigger value="credentials">Credenciales</TabsTrigger>
          <TabsTrigger value="alarms">Alarmas</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <Card ref={dashboardRef}>
            <CardHeader>
              <CardTitle>Resumen Ejecutivo del Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total de Casos</p>
                  <p className="text-3xl font-bold">{reportData.totalCases}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Casos Abiertos</p>
                  <p className="text-3xl font-bold text-red-500">{reportData.openCases}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">En Proceso</p>
                  <p className="text-3xl font-bold text-orange-500">{reportData.inProgressCases}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Resueltos</p>
                  <p className="text-3xl font-bold text-green-500">{reportData.resolvedCases}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Tiempo Promedio Resolución</p>
                  <p className="text-2xl font-bold">{reportData.avgResolutionTime} min</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Usuarios</p>
                  <p className="text-2xl font-bold">{reportData.totalUsers}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Aplicativos</p>
                  <p className="text-2xl font-bold">{reportData.totalApplications}</p>
                </div>
              </div>

              {reportData.frequentIssues.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Novedades Más Frecuentes</h3>
                  <div className="space-y-2">
                    {reportData.frequentIssues.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center border-b pb-2">
                        <span className="text-sm">{item.issue}</span>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => exportToExcel("summary")}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Descargar Excel
            </Button>
            <Button onClick={() => exportToCSV("summary")} variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Descargar CSV
            </Button>
            <Button onClick={() => exportToPDF("summary")} variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
            <Button onClick={exportDashboardImage} variant="outline">
              <ImageIcon className="mr-2 h-4 w-4" />
              Descargar Imagen
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="credentials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reporte de Credenciales de Usuario</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Total de credenciales registradas: <strong>{credentials.length}</strong>
              </p>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Usuario</th>
                      <th className="text-left p-2">Aplicativo</th>
                      <th className="text-left p-2">Username</th>
                      <th className="text-left p-2">Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.slice(0, 10).map((cred, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2">{cred.end_users?.full_name || "N/A"}</td>
                        <td className="p-2">
                          {cred.company_applications?.name || cred.global_applications?.name || "N/A"}
                        </td>
                        <td className="p-2">{cred.username || "N/A"}</td>
                        <td className="p-2">
                          {cred.credential_expires_at
                            ? new Date(cred.credential_expires_at).toLocaleDateString()
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {credentials.length > 10 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Mostrando 10 de {credentials.length}. Descarga el reporte completo.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => exportToExcel("credentials")}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Descargar Excel
            </Button>
            <Button onClick={() => exportToCSV("credentials")} variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Descargar CSV
            </Button>
            <Button onClick={() => exportToPDF("credentials")} variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="alarms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reporte Detallado de Alarmas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Total de alarmas: <strong>{alarmDetails.length}</strong>
              </p>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Título</th>
                      <th className="text-left p-2">Estado</th>
                      <th className="text-left p-2">Prioridad</th>
                      <th className="text-left p-2">T. Resolución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alarmDetails.slice(0, 10).map((alarm, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2">{alarm.title}</td>
                        <td className="p-2">{alarm.status}</td>
                        <td className="p-2">{alarm.priority}</td>
                        <td className="p-2">
                          {alarm.resolution_time_minutes ? `${alarm.resolution_time_minutes} min` : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {alarmDetails.length > 10 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Mostrando 10 de {alarmDetails.length}. Descarga el reporte completo.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => exportToExcel("alarms")}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Descargar Excel
            </Button>
            <Button onClick={() => exportToCSV("alarms")} variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Descargar CSV
            </Button>
            <Button onClick={() => exportToPDF("alarms")} variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
