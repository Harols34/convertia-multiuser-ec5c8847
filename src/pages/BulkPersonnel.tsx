import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Table as TableIcon, FileSpreadsheet, AlertCircle } from "lucide-react";
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

interface ImportResult {
  success: number;
  errors: { row: number; error: string; data: any }[];
  total: number;
}

export default function BulkPersonnel() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  const generateAccessCode = (documentNumber: string, fullName: string) => {
    const namePart = fullName.split(" ")[0].toLowerCase();
    return `${documentNumber}_${namePart}`;
  };

const downloadTemplate = () => {
    const template = `company_name,document_number,full_name,phone,email
NombreEmpresa,12345678,Juan Pérez,3001234567,juan.perez@email.com
NombreEmpresa,87654321,María García,3009876543,maria.garcia@email.com`;

    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "plantilla_personal.csv";
    link.click();

    toast({
      title: "Plantilla descargada",
      description: "Usa el NOMBRE de la empresa (no el ID)",
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      const headers = lines[0].split(",").map((h) => h.trim());

      const expectedHeaders = ["company_name", "document_number", "full_name", "phone", "email"];
      const hasValidHeaders = expectedHeaders.every((h) => headers.includes(h));

      if (!hasValidHeaders) {
        toast({
          title: "Error en el archivo",
          description: "El archivo no tiene las columnas correctas. Descarga la plantilla.",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      const results: ImportResult = {
        success: 0,
        errors: [],
        total: lines.length - 1,
      };

      // Procesar cada línea (saltando el header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const values = line.split(",").map((v) => v.trim());
        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index] || "";
        });

        try {
          // Validar datos mínimos
          if (!rowData.company_name || !rowData.document_number || !rowData.full_name) {
            results.errors.push({
              row: i + 1,
              error: "Faltan datos obligatorios (company_name, document_number o full_name)",
              data: rowData,
            });
            continue;
          }

          // Buscar la empresa por nombre (case insensitive)
          const { data: company } = await supabase
            .from("companies")
            .select("id")
            .ilike("name", rowData.company_name)
            .single();

          if (!company) {
            results.errors.push({
              row: i + 1,
              error: `La empresa "${rowData.company_name}" no existe`,
              data: rowData,
            });
            continue;
          }

          // Generar código de acceso
          const accessCode = generateAccessCode(rowData.document_number, rowData.full_name);

          // Insertar usuario
          const { error } = await supabase.from("end_users").insert([
            {
              company_id: company.id,
              document_number: rowData.document_number,
              full_name: rowData.full_name,
              phone: rowData.phone || null,
              email: rowData.email || null,
              access_code: accessCode,
            },
          ]);

          if (error) {
            results.errors.push({
              row: i + 1,
              error: error.message,
              data: rowData,
            });
          } else {
            results.success++;
          }
        } catch (err: any) {
          results.errors.push({
            row: i + 1,
            error: err.message || "Error desconocido",
            data: rowData,
          });
        }
      }

      setResult(results);

      if (results.success > 0) {
        toast({
          title: "Importación completada",
          description: `${results.success} usuarios importados correctamente`,
        });
      }

      if (results.errors.length > 0) {
        toast({
          title: "Algunos usuarios no se importaron",
          description: `${results.errors.length} errores encontrados`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error al procesar el archivo",
        description: error.message,
        variant: "destructive",
      });
    }

    setImporting(false);
    event.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Carga Masiva de Personal</h1>
        <p className="text-muted-foreground mt-2">
          Importa múltiples usuarios mediante archivo CSV
        </p>
      </div>

      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">
            <Upload className="mr-2 h-4 w-4" />
            Cargar Archivo
          </TabsTrigger>
          <TabsTrigger value="results">
            <TableIcon className="mr-2 h-4 w-4" />
            Resultados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Paso 1: Descarga la Plantilla</CardTitle>
              <CardDescription>
                Descarga el archivo CSV de ejemplo y complétalo con los datos del personal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={downloadTemplate} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Descargar Plantilla CSV
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Paso 2: Completa el Archivo</CardTitle>
              <CardDescription>
                El archivo debe contener las siguientes columnas:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">company_name</Badge>
                  <span className="text-muted-foreground">Nombre de la empresa (obligatorio)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">document_number</Badge>
                  <span className="text-muted-foreground">Número de documento (obligatorio)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">full_name</Badge>
                  <span className="text-muted-foreground">Nombre completo (obligatorio)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">phone</Badge>
                  <span className="text-muted-foreground">Teléfono (opcional)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">email</Badge>
                  <span className="text-muted-foreground">Correo electrónico (opcional)</span>
                </div>
              </div>

              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> Usa el nombre exacto de la empresa tal como aparece
                  en la sección de Empresas. El sistema buscará automáticamente el ID correcto.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Paso 3: Sube el Archivo</CardTitle>
              <CardDescription>
                Selecciona el archivo CSV completado para importar los usuarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={importing}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload">
                    <Button asChild disabled={importing}>
                      <span>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        {importing ? "Importando..." : "Seleccionar Archivo CSV"}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
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
                  Los resultados de la importación aparecerán aquí
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Procesados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{result.total}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Importados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-success">{result.success}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Errores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      {result.errors.length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {result.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Errores Encontrados</CardTitle>
                    <CardDescription>
                      Revisa los siguientes registros que no pudieron ser importados
                    </CardDescription>
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
                              <code className="bg-muted px-2 py-1 rounded">
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
