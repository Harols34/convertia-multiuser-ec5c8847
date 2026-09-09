import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Download,
  Table as TableIcon,
  FileSpreadsheet,
  ClipboardPaste,
  UserPlus,
  RefreshCw,
  Filter,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";

interface ImportResult {
  success: number;
  errors: { row: number; error: string; data: any }[];
  total: number;
  skipped?: number;
}

interface Company {
  id: string;
  name: string;
}

interface AccessRole {
  id: string;
  label: string;
}

interface PersonRow {
  id: string;
  company_id: string;
  document_number: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  access_code: string | null;
  campaign: string | null;
  active: boolean;
  access_role_id: string | null;
  portal_password: string | null;
  companies: { name: string } | null;
}

const COL = {
  id: "ID (No modificar)",
  company: "Empresa",
  document: "Documento",
  name: "Nombre Completo",
  phone: "Telefono",
  email: "Email",
  role: "Rol de Acceso",
  campaign: "Campana",
  code: "Codigo de Acceso",
  status: "Estado",
  hasPassword: "Clave Asignada",
  password: "Contrasena Portal",
};

const norm = (v: unknown) => String(v ?? "").trim();

export default function BulkPersonnel() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pasteContent, setPasteContent] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterCompany, setFilterCompany] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const createInputRef = useRef<HTMLInputElement>(null);
  const updateInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [companiesRes, rolesRes, peopleRes] = await Promise.all([
      supabase.from("companies").select("id, name").eq("active", true).order("name"),
      supabase.from("access_roles").select("id, label").eq("active", true).order("label"),
      supabase
        .from("end_users")
        .select(
          "id, company_id, document_number, full_name, phone, email, access_code, campaign, active, access_role_id, portal_password, companies(name)"
        )
        .order("full_name"),
    ]);
    setCompanies(companiesRes.data ?? []);
    setRoles((rolesRes.data as AccessRole[]) ?? []);
    setPeople((peopleRes.data as unknown as PersonRow[]) ?? []);
    setLoading(false);
  };

  const filteredPeople = useMemo(
    () =>
      people.filter((p) => {
        if (filterCompany !== "all" && p.company_id !== filterCompany) return false;
        if (filterRole !== "all") {
          if (filterRole === "none" ? p.access_role_id : p.access_role_id !== filterRole) return false;
        }
        if (filterStatus === "active" && !p.active) return false;
        if (filterStatus === "inactive" && p.active) return false;
        return true;
      }),
    [people, filterCompany, filterRole, filterStatus]
  );

  const generateAccessCode = (documentNumber: string, fullName: string) => {
    const namePart = fullName.split(" ")[0].toLowerCase();
    return `${documentNumber}_${namePart}`;
  };

  const findCompanyByName = (name: string) =>
    companies.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());

  const findRoleByLabel = (label: string) =>
    roles.find((r) => r.label.trim().toLowerCase() === label.trim().toLowerCase());

  const writeWorkbook = (rows: Record<string, unknown>[], sheet: string, fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(14, k.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet);
    XLSX.writeFile(wb, fileName);
  };

  // ---------- Creación masiva ----------
  const downloadCreateTemplate = () => {
    const example = {
      [COL.company]: companies[0]?.name ?? "NombreEmpresa",
      [COL.document]: "12345678",
      [COL.name]: "Juan Pérez",
      [COL.phone]: "3001234567",
      [COL.email]: "juan.perez@email.com",
      [COL.role]: roles[0]?.label ?? "Colaborador",
      [COL.campaign]: "",
      [COL.status]: "Activo",
      [COL.password]: "",
    };
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([example]);
    ws["!cols"] = Object.keys(example).map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, "Personal");
    const refWs = XLSX.utils.json_to_sheet([
      ...companies.map((c) => ({ Tipo: "Empresa", Valor: c.name })),
      ...roles.map((r) => ({ Tipo: "Rol de Acceso", Valor: r.label })),
      { Tipo: "Estado", Valor: "Activo" },
      { Tipo: "Estado", Valor: "Inactivo" },
    ]);
    refWs["!cols"] = [{ wch: 18 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, refWs, "Valores válidos");
    XLSX.writeFile(wb, "plantilla_creacion_personal.xlsx");
    toast({ title: "Plantilla descargada", description: "Revisa la hoja 'Valores válidos'" });
  };

  const readRows = async (file: File): Promise<Record<string, unknown>[]> => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  };

  const pick = (row: Record<string, unknown>, keys: string[]) => {
    for (const k of Object.keys(row)) {
      const cleaned = k
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
      if (keys.some((t) => cleaned === t || cleaned.includes(t))) return norm(row[k]);
    }
    return "";
  };

  const handleCreateUpload = async (file: File) => {
    setImporting(true);
    setResult(null);
    const res: ImportResult = { success: 0, errors: [], total: 0 };
    try {
      const rows = await readRows(file);
      res.total = rows.length;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const companyName = pick(row, ["empresa", "company"]);
        const document = pick(row, ["documento", "cedula", "document"]);
        const fullName = pick(row, ["nombre"]);
        const phone = pick(row, ["telefono", "celular", "phone"]);
        const email = pick(row, ["email", "correo"]);
        const roleLabel = pick(row, ["rol"]);
        const campaign = pick(row, ["campana", "campaign"]);
        const status = pick(row, ["estado"]);
        const password = pick(row, ["contrasena", "password"]);

        if (!companyName || !document || !fullName) {
          res.errors.push({ row: i + 2, error: "Faltan Empresa, Documento o Nombre", data: row });
          continue;
        }
        const company = findCompanyByName(companyName);
        if (!company) {
          res.errors.push({ row: i + 2, error: `La empresa "${companyName}" no existe`, data: row });
          continue;
        }
        let roleId: string | null = null;
        if (roleLabel) {
          const role = findRoleByLabel(roleLabel);
          if (!role) {
            res.errors.push({ row: i + 2, error: `El rol "${roleLabel}" no existe`, data: row });
            continue;
          }
          roleId = role.id;
        }

        const { data: created, error } = await supabase
          .from("end_users")
          .insert([
            {
              company_id: company.id,
              document_number: document,
              full_name: fullName,
              phone: phone || null,
              email: email || null,
              campaign: campaign || null,
              access_role_id: roleId,
              active: status ? status.toLowerCase().startsWith("activ") : true,
              access_code: generateAccessCode(document, fullName),
            },
          ])
          .select("id")
          .single();

        if (error) {
          res.errors.push({
            row: i + 2,
            error: error.message.includes("duplicate")
              ? "Ya existe un usuario con ese documento en la empresa"
              : error.message,
            data: row,
          });
          continue;
        }

        if (password && created) {
          const { error: pwErr } = await supabase.rpc("set_end_user_password", {
            p_user_id: created.id,
            p_password: password,
          });
          if (pwErr) res.errors.push({ row: i + 2, error: `Contraseña: ${pwErr.message}`, data: row });
        }
        res.success++;
      }
    } catch (err: any) {
      res.errors.push({ row: 0, error: err.message ?? "Error leyendo archivo", data: {} });
    }
    setResult(res);
    setImporting(false);
    loadData();
    toast({
      title: "Creación masiva finalizada",
      description: `${res.success} creados, ${res.errors.length} errores`,
      variant: res.errors.length && !res.success ? "destructive" : "default",
    });
  };

  // ---------- Actualización masiva ----------
  const downloadCurrentData = () => {
    if (filteredPeople.length === 0) {
      toast({ title: "Sin datos", description: "No hay usuarios con esos filtros", variant: "destructive" });
      return;
    }
    const rows = filteredPeople.map((p) => ({
      [COL.id]: p.id,
      [COL.company]: p.companies?.name ?? "",
      [COL.document]: p.document_number,
      [COL.name]: p.full_name,
      [COL.phone]: p.phone ?? "",
      [COL.email]: p.email ?? "",
      [COL.role]: roles.find((r) => r.id === p.access_role_id)?.label ?? "",
      [COL.campaign]: p.campaign ?? "",
      [COL.code]: p.access_code ?? "",
      [COL.status]: p.active ? "Activo" : "Inactivo",
      [COL.password]: "",
    }));
    writeWorkbook(rows, "Personal", `personal_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Datos descargados", description: `${rows.length} usuarios exportados` });
  };

  const handleUpdateUpload = async (file: File) => {
    setImporting(true);
    setResult(null);
    const res: ImportResult = { success: 0, errors: [], total: 0, skipped: 0 };
    try {
      const rows = await readRows(file);
      res.total = rows.length;
      const byId = new Map(people.map((p) => [p.id, p]));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const id = pick(row, ["id ("]) || norm(row[COL.id]);
        if (!id) {
          res.errors.push({ row: i + 2, error: "Fila sin ID de usuario", data: row });
          continue;
        }
        const current = byId.get(id);
        if (!current) {
          res.errors.push({ row: i + 2, error: "El usuario no existe", data: row });
          continue;
        }

        const document = pick(row, ["documento", "cedula"]) || current.document_number;
        const fullName = pick(row, ["nombre"]) || current.full_name;
        const phone = pick(row, ["telefono", "celular"]);
        const email = pick(row, ["email", "correo"]);
        const campaign = pick(row, ["campana", "campaign"]);
        const roleLabel = pick(row, ["rol"]);
        const status = pick(row, ["estado"]);
        const password = pick(row, ["contrasena", "password"]);
        const companyName = pick(row, ["empresa"]);

        const updates: Record<string, unknown> = {};
        if (document !== current.document_number) updates.document_number = document;
        if (fullName !== current.full_name) updates.full_name = fullName;
        if (phone !== (current.phone ?? "")) updates.phone = phone || null;
        if (email !== (current.email ?? "")) updates.email = email || null;
        if (campaign !== (current.campaign ?? "")) updates.campaign = campaign || null;

        if (companyName) {
          const company = findCompanyByName(companyName);
          if (!company) {
            res.errors.push({ row: i + 2, error: `La empresa "${companyName}" no existe`, data: row });
            continue;
          }
          if (company.id !== current.company_id) updates.company_id = company.id;
        }

        const currentRoleLabel = roles.find((r) => r.id === current.access_role_id)?.label ?? "";
        if (roleLabel !== currentRoleLabel) {
          if (!roleLabel) {
            updates.access_role_id = null;
          } else {
            const role = findRoleByLabel(roleLabel);
            if (!role) {
              res.errors.push({ row: i + 2, error: `El rol "${roleLabel}" no existe`, data: row });
              continue;
            }
            updates.access_role_id = role.id;
          }
        }

        if (status) {
          const active = status.toLowerCase().startsWith("activ");
          if (active !== current.active) updates.active = active;
        }

        if (updates.document_number || updates.full_name) {
          updates.access_code = generateAccessCode(document, fullName);
        }

        let changed = false;

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from("end_users").update(updates).eq("id", id);
          if (error) {
            res.errors.push({ row: i + 2, error: error.message, data: row });
            continue;
          }
          changed = true;
        }

        if (password) {
          if (password.length < 4) {
            res.errors.push({ row: i + 2, error: "Contraseña menor a 4 caracteres", data: row });
            continue;
          }
          const { error: pwErr } = await supabase.rpc("set_end_user_password", {
            p_user_id: id,
            p_password: password,
          });
          if (pwErr) {
            res.errors.push({ row: i + 2, error: `Contraseña: ${pwErr.message}`, data: row });
            continue;
          }
          changed = true;
        }

        if (changed) res.success++;
        else res.skipped = (res.skipped ?? 0) + 1;
      }
    } catch (err: any) {
      res.errors.push({ row: 0, error: err.message ?? "Error leyendo archivo", data: {} });
    }
    setResult(res);
    setImporting(false);
    loadData();
    toast({
      title: "Actualización masiva finalizada",
      description: `${res.success} actualizados, ${res.skipped ?? 0} sin cambios, ${res.errors.length} errores`,
    });
  };

  // ---------- Copiar y pegar (creación rápida) ----------
  const handlePasteImport = async () => {
    if (!pasteContent.trim()) {
      toast({ title: "Error", description: "No hay contenido para importar", variant: "destructive" });
      return;
    }
    setImporting(true);
    setResult(null);
    const res: ImportResult = { success: 0, errors: [], total: 0 };
    const lines = pasteContent.split("\n").filter((l) => l.trim());
    res.total = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/\t|,|[ ]{2,}/).map((p) => p.trim());
      const [companyName, document, fullName, phone, email] = parts;
      if (!companyName || !document || !fullName) {
        res.errors.push({ row: i + 1, error: "Faltan Empresa, Documento o Nombre", data: parts });
        continue;
      }
      const company = findCompanyByName(companyName);
      if (!company) {
        res.errors.push({ row: i + 1, error: `La empresa "${companyName}" no existe`, data: parts });
        continue;
      }
      const { error } = await supabase.from("end_users").insert([
        {
          company_id: company.id,
          document_number: document,
          full_name: fullName,
          phone: phone || null,
          email: email || null,
          access_code: generateAccessCode(document, fullName),
        },
      ]);
      if (error) res.errors.push({ row: i + 1, error: error.message, data: parts });
      else res.success++;
    }

    setResult(res);
    setImporting(false);
    loadData();
    toast({ title: "Importación finalizada", description: `${res.success} usuarios creados` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carga Masiva de Personal</h1>
          <p className="text-muted-foreground mt-2">
            Crea usuarios nuevos o actualiza los existentes desde un archivo Excel
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Recargar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
          <CardDescription>Aplican a la descarga de datos actuales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cuenta / Empresa</Label>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rol de acceso</Label>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="none">Sin rol</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estado</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Badge variant="secondary" className="h-9 px-3">
              {filteredPeople.length} usuarios
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="create">
        <TabsList>
          <TabsTrigger value="create">
            <UserPlus className="mr-2 h-4 w-4" />
            Creación masiva
          </TabsTrigger>
          <TabsTrigger value="update">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Actualización masiva
          </TabsTrigger>
          <TabsTrigger value="paste">
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Copiar y pegar
          </TabsTrigger>
          <TabsTrigger value="results">
            <TableIcon className="mr-2 h-4 w-4" />
            Resultados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Crear usuarios nuevos</CardTitle>
              <CardDescription>
                Descarga la plantilla, complétala y súbela. Cada fila crea un usuario nuevo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription className="text-xs">
                  Columnas: <strong>{COL.company}</strong>, <strong>{COL.document}</strong>,{" "}
                  <strong>{COL.name}</strong>, Teléfono, Email, Rol de Acceso, Campaña, Estado y
                  Contraseña Portal (opcional). El código de acceso se genera automáticamente.
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={downloadCreateTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar plantilla
                </Button>
                <input
                  ref={createInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCreateUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button disabled={importing} onClick={() => createInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? "Procesando..." : "Subir archivo de creación"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="update" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Actualizar usuarios existentes</CardTitle>
              <CardDescription>
                Descarga la información actual (con los filtros de arriba), modifica lo que necesites y
                súbela. Solo se actualizan las filas que tengan cambios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription className="text-xs">
                  No modifiques la columna <strong>{COL.id}</strong>. Puedes subir todas las filas o solo
                  algunas: las que estén iguales se omiten. La columna Contraseña Portal en blanco no
                  cambia la contraseña.
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={downloadCurrentData}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar datos ({filteredPeople.length})
                </Button>
                <input
                  ref={updateInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpdateUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button disabled={importing} onClick={() => updateInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? "Procesando..." : "Subir archivo de actualización"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paste" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pegar datos desde Excel</CardTitle>
              <CardDescription>
                Una línea por usuario: Empresa, Documento, Nombre, Teléfono, Email (sin encabezados).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={`Empresa A\t123456\tJuan Perez\t5551234\tjuan@test.com`}
                className="min-h-[240px] font-mono text-sm"
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
              />
              <Button onClick={handlePasteImport} disabled={importing}>
                {importing ? "Procesando..." : "Importar datos pegados"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {!result ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TableIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sin resultados</h3>
                <p className="text-sm text-muted-foreground">
                  Los resultados de la carga aparecerán aquí
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total filas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{result.total}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Procesados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{result.success}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Sin cambios</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{result.skipped ?? 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Errores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{result.errors.length}</div>
                  </CardContent>
                </Card>
              </div>

              {result.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Errores encontrados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fila</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead>Datos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.errors.map((error, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{error.row}</TableCell>
                            <TableCell className="text-destructive">{error.error}</TableCell>
                            <TableCell className="text-xs">
                              <code className="bg-muted px-2 py-1 rounded block w-full overflow-x-auto">
                                {JSON.stringify(error.data)}
                              </code>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
