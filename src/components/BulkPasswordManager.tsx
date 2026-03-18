import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Filter } from "lucide-react";
import * as XLSX from "xlsx";

interface EndUserRow {
  id: string;
  full_name: string;
  document_number: string;
  access_code: string | null;
  email: string | null;
  active: boolean;
  portal_password: string | null;
  companies: { name: string } | null;
}

interface UploadResult {
  total: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface BulkPasswordManagerProps {
  users: EndUserRow[];
  onRefresh: () => void;
}

export default function BulkPasswordManager({ users, onRefresh }: BulkPasswordManagerProps) {
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPassword, setFilterPassword] = useState<string>("all");
  const [uploading, setUploading] = useState(false);
  const [resultDialog, setResultDialog] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Get unique companies for filter
  const companies = Array.from(
    new Set(users.map((u) => u.companies?.name).filter(Boolean))
  ).sort() as string[];

  // Apply filters to get users for download
  const getFilteredUsers = () => {
    return users.filter((u) => {
      if (filterCompany !== "all" && u.companies?.name !== filterCompany) return false;
      if (filterStatus === "active" && !u.active) return false;
      if (filterStatus === "inactive" && u.active) return false;
      if (filterPassword === "with" && !u.portal_password) return false;
      if (filterPassword === "without" && u.portal_password) return false;
      return true;
    });
  };

  const handleDownloadTemplate = () => {
    const filtered = getFilteredUsers();
    if (filtered.length === 0) {
      toast({ title: "Sin datos", description: "No hay usuarios con los filtros seleccionados", variant: "destructive" });
      return;
    }

    const rows = filtered.map((u) => ({
      "ID (No modificar)": u.id,
      "Nombre": u.full_name,
      "Documento": u.document_number,
      "Código de Acceso": u.access_code || "",
      "Email": u.email || "",
      "Empresa": u.companies?.name || "",
      "Estado": u.active ? "Activo" : "Inactivo",
      "Tiene Contraseña": u.portal_password ? "Sí" : "No",
      "Nueva Contraseña": "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    ws["!cols"] = [
      { wch: 38 }, // ID
      { wch: 30 }, // Nombre
      { wch: 15 }, // Documento
      { wch: 15 }, // Código
      { wch: 25 }, // Email
      { wch: 20 }, // Empresa
      { wch: 10 }, // Estado
      { wch: 16 }, // Tiene Contraseña
      { wch: 20 }, // Nueva Contraseña
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contraseñas");
    XLSX.writeFile(wb, `plantilla_contrasenas_${new Date().toISOString().slice(0, 10)}.xlsx`);

    toast({ title: "Plantilla descargada", description: `${filtered.length} usuarios incluidos en la plantilla` });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const result: UploadResult = { total: 0, updated: 0, skipped: 0, errors: [] };

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      result.total = rows.length;

      for (const row of rows) {
        const userId = row["ID (No modificar)"]?.trim();
        const newPassword = row["Nueva Contraseña"]?.trim();

        if (!userId) {
          result.errors.push(`Fila sin ID de usuario`);
          continue;
        }

        // Skip rows with empty password
        if (!newPassword) {
          result.skipped++;
          continue;
        }

        if (newPassword.length < 4) {
          const name = row["Nombre"] || userId;
          result.errors.push(`${name}: contraseña menor a 4 caracteres`);
          continue;
        }

        const { error } = await supabase.rpc("set_end_user_password", {
          p_user_id: userId,
          p_password: newPassword,
        });

        if (error) {
          const name = row["Nombre"] || userId;
          result.errors.push(`${name}: ${error.message}`);
        } else {
          result.updated++;
        }
      }
    } catch (err: any) {
      result.errors.push(`Error leyendo archivo: ${err.message}`);
    }

    setUploadResult(result);
    setResultDialog(true);
    setUploading(false);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (result.updated > 0) {
      onRefresh();
    }
  };

  const filteredCount = getFilteredUsers().length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Asignación Masiva de Contraseñas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Filter className="h-3 w-3" /> Empresa
              </Label>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Estado</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Contraseña</Label>
              <Select value={filterPassword} onValueChange={setFilterPassword}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="with">Con contraseña</SelectItem>
                  <SelectItem value="without">Sin contraseña</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Badge variant="secondary" className="h-9 px-3">
              {filteredCount} usuarios
            </Badge>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleDownloadTemplate} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Descargar Plantilla ({filteredCount})
            </Button>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="bulk-password-upload"
              />
              <Button
                variant="default"
                className="gap-2"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Procesando..." : "Subir Archivo"}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Descarga la plantilla, completa la columna "Nueva Contraseña" para los usuarios que deseas actualizar.
            Las filas con contraseña en blanco serán omitidas. Mínimo 4 caracteres por contraseña.
          </p>
        </CardContent>
      </Card>

      {/* Upload Result Dialog */}
      <Dialog open={resultDialog} onOpenChange={setResultDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Resultado de Carga Masiva
            </DialogTitle>
          </DialogHeader>
          {uploadResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{uploadResult.total}</p>
                  <p className="text-xs text-muted-foreground">Total filas</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{uploadResult.updated}</p>
                  <p className="text-xs text-muted-foreground">Actualizadas</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{uploadResult.skipped}</p>
                  <p className="text-xs text-muted-foreground">Omitidas</p>
                </div>
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Errores ({uploadResult.errors.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-xs space-y-1">
                    {uploadResult.errors.map((err, i) => (
                      <p key={i} className="text-destructive">{err}</p>
                    ))}
                  </div>
                </div>
              )}

              {uploadResult.errors.length === 0 && uploadResult.updated > 0 && (
                <div className="flex items-center gap-2 text-emerald-600 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Todas las contraseñas se actualizaron correctamente
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultDialog(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
