import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ClipboardPaste, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Company {
  id: string;
  name: string;
}

interface ParsedUser {
  document_number: string;
  full_name: string;
  phone?: string;
  email?: string;
}

interface ImportResult {
  success: number;
  errors: { row: number; error: string; data: any }[];
  total: number;
}

export default function BulkPaste() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [pastedData, setPastedData] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .eq("active", true)
      .order("name");
    if (data) setCompanies(data);
  };

  const generateAccessCode = (documentNumber: string, fullName: string) => {
    const namePart = fullName.split(" ")[0].toLowerCase();
    return `${documentNumber}_${namePart}`;
  };

  const parsePastedData = (text: string): ParsedUser[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    const users: ParsedUser[] = [];

    for (const line of lines) {
      // Soportar tabulaciones o múltiples espacios como separador
      const parts = line.split(/[\t]+|[ ]{2,}/).map((p) => p.trim()).filter((p) => p);
      
      if (parts.length >= 2) {
        const user: ParsedUser = {
          document_number: parts[0],
          full_name: parts[1],
        };

        if (parts[2]) user.phone = parts[2];
        if (parts[3]) user.email = parts[3];

        users.push(user);
      }
    }

    return users;
  };

  const handleImport = async () => {
    if (!selectedCompany) {
      toast({
        title: "Error",
        description: "Selecciona una empresa primero",
        variant: "destructive",
      });
      return;
    }

    if (!pastedData.trim()) {
      toast({
        title: "Error",
        description: "Pega los datos de los usuarios",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const parsedUsers = parsePastedData(pastedData);

      const results: ImportResult = {
        success: 0,
        errors: [],
        total: parsedUsers.length,
      };

      for (let i = 0; i < parsedUsers.length; i++) {
        const user = parsedUsers[i];

        try {
          if (!user.document_number || !user.full_name) {
            results.errors.push({
              row: i + 1,
              error: "Faltan documento o nombre completo",
              data: user,
            });
            continue;
          }

          const accessCode = generateAccessCode(user.document_number, user.full_name);

          const { error } = await supabase.from("end_users").insert([
            {
              company_id: selectedCompany,
              document_number: user.document_number,
              full_name: user.full_name,
              phone: user.phone || null,
              email: user.email || null,
              access_code: accessCode,
            },
          ]);

          if (error) {
            results.errors.push({
              row: i + 1,
              error: error.message,
              data: user,
            });
          } else {
            results.success++;
          }
        } catch (err: any) {
          results.errors.push({
            row: i + 1,
            error: err.message || "Error desconocido",
            data: user,
          });
        }
      }

      setResult(results);

      if (results.success > 0) {
        toast({
          title: "Importación completada",
          description: `${results.success} usuarios creados correctamente`,
        });
      }

      if (results.errors.length > 0) {
        toast({
          title: "Algunos usuarios no se crearon",
          description: `${results.errors.length} errores encontrados`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error al procesar los datos",
        description: error.message,
        variant: "destructive",
      });
    }

    setImporting(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Crear Personal - Copiar y Pegar</h1>
        <p className="text-muted-foreground mt-2">
          Crea múltiples usuarios copiando y pegando desde Excel u otra fuente
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Paso 1: Selecciona la Empresa</CardTitle>
            <CardDescription>
              Todos los usuarios se crearán para esta empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="company-select">Empresa *</Label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger id="company-select" className="mt-2">
                <SelectValue placeholder="Selecciona una empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paso 2: Pega los Datos</CardTitle>
            <CardDescription>
              Copia desde Excel y pega aquí (cada línea un usuario)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Formato esperado por línea:</strong><br />
                Documento [TAB] NombreCompleto [TAB] Teléfono [TAB] Email<br />
                <em>Mínimo: Documento y Nombre (separados por tabulación)</em>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="paste-data">Datos de usuarios</Label>
              <Textarea
                id="paste-data"
                placeholder="12345678    Juan Pérez    3001234567    juan@email.com&#10;87654321    María García    3009876543    maria@email.com"
                value={pastedData}
                onChange={(e) => setPastedData(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleImport}
              disabled={importing || !selectedCompany || !pastedData.trim()}
              className="w-full"
            >
              <ClipboardPaste className="mr-2 h-4 w-4" />
              {importing ? "Creando usuarios..." : "Crear Usuarios"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados de la Importación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{result.total}</div>
                <span className="text-sm text-muted-foreground">Total</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div className="text-2xl font-bold text-success">{result.success}</div>
                <span className="text-sm text-muted-foreground">Creados</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div className="text-2xl font-bold text-destructive">{result.errors.length}</div>
                <span className="text-sm text-muted-foreground">Errores</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Errores Encontrados</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Línea</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Datos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.map((error, index) => (
                      <TableRow key={index}>
                        <TableCell>{error.row}</TableCell>
                        <TableCell className="text-destructive text-sm">{error.error}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {JSON.stringify(error.data)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
