import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, Search, Clock, ShieldAlert, ExternalLink } from "lucide-react";

interface LogEntry {
  id: string;
  company_id: string;
  user_id: string;
  action: string;
  url: string | null;
  reason: string | null;
  created_at: string;
  browser_config_id: string | null;
}

interface EndUser {
  id: string;
  full_name: string;
  document_number: string;
  company_id: string;
}

export default function BrowserHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [endUsers, setEndUsers] = useState<EndUser[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [filterUser, setFilterUser] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [logsRes, usersRes, companiesRes] = await Promise.all([
      supabase
        .from("browser_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("end_users").select("id, full_name, document_number, company_id"),
      supabase.from("companies").select("id, name").eq("active", true),
    ]);

    if (logsRes.data) setLogs(logsRes.data as LogEntry[]);
    if (usersRes.data) setEndUsers(usersRes.data);
    if (companiesRes.data) setCompanies(companiesRes.data);
    setLoading(false);
  };

  const getUserName = (userId: string) => {
    const found = endUsers.find((u) => u.id === userId);
    return found ? found.full_name : userId.slice(0, 8) + "...";
  };

  const getCompanyName = (companyId: string) => {
    const found = companies.find((c) => c.id === companyId);
    return found ? found.name : companyId.slice(0, 8);
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "NAVIGATE_ALLOWED": return "Permitida";
      case "NAVIGATE_BLOCKED": return "Bloqueada";
      case "TAB_OPEN": return "Tab abierta";
      case "TAB_CLOSE": return "Tab cerrada";
      default: return action;
    }
  };

  // Get unique user IDs from logs
  const uniqueUserIds = [...new Set(logs.map((l) => l.user_id))];

  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      !searchText ||
      (log.url && log.url.toLowerCase().includes(searchText.toLowerCase())) ||
      getUserName(log.user_id).toLowerCase().includes(searchText.toLowerCase()) ||
      (log.reason && log.reason.toLowerCase().includes(searchText.toLowerCase()));
    const matchUser = filterUser === "all" || log.user_id === filterUser;
    const matchAction = filterAction === "all" || log.action === filterAction;
    const matchCompany = filterCompany === "all" || log.company_id === filterCompany;
    return matchSearch && matchUser && matchAction && matchCompany;
  });

  // Stats
  const totalAllowed = filteredLogs.filter((l) => l.action === "NAVIGATE_ALLOWED").length;
  const totalBlocked = filteredLogs.filter((l) => l.action === "NAVIGATE_BLOCKED").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="h-6 w-6" />
          Historial de Navegación
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historial completo de navegación del navegador embebido por usuario y empresa
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{filteredLogs.length}</p>
            <p className="text-xs text-muted-foreground">Total eventos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-primary">{totalAllowed}</p>
            <p className="text-xs text-muted-foreground">Navegaciones permitidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-destructive">{totalBlocked}</p>
            <p className="text-xs text-muted-foreground">Navegaciones bloqueadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{uniqueUserIds.length}</p>
            <p className="text-xs text-muted-foreground">Usuarios activos</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por URL, usuario, razón..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las empresas</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {uniqueUserIds.map((uid) => (
                  <SelectItem key={uid} value={uid}>{getUserName(uid)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                <SelectItem value="NAVIGATE_ALLOWED">Permitidas</SelectItem>
                <SelectItem value="NAVIGATE_BLOCKED">Bloqueadas</SelectItem>
                <SelectItem value="TAB_OPEN">Tab abierta</SelectItem>
                <SelectItem value="TAB_CLOSE">Tab cerrada</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setSearchText(""); setFilterUser("all"); setFilterAction("all"); setFilterCompany("all"); }}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Razón</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Sin registros de navegación
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("es")}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {getUserName(log.user_id)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {getCompanyName(log.company_id)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.action === "NAVIGATE_BLOCKED"
                            ? "destructive"
                            : log.action === "NAVIGATE_ALLOWED"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {getActionLabel(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[250px] truncate" title={log.url || ""}>
                      {log.url ? (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3 shrink-0" />
                          {log.url}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.reason || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
