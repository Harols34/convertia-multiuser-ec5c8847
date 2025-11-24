import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Key, Grid3x3, Bell, ExternalLink, Paperclip, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserChat from "./UserChat";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface EndUser {
  id: string;
  full_name: string;
  document_number: string;
  companies: { name: string };
}

interface UserApplication {
  id: string;
  username: string | null;
  password: string | null;
  notes: string | null;
  global_application_id: string | null;
  global_applications: {
    name: string;
    description: string | null;
    url: string | null;
  } | null;
  company_applications: {
    name: string;
    description: string | null;
    url: string | null;
  } | null;
}

export default function UserPortal() {
  const [searchParams] = useSearchParams();
  const [accessCode, setAccessCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [userData, setUserData] = useState<EndUser | null>(null);
  const [applications, setApplications] = useState<UserApplication[]>([]);
  const [showAlarmForm, setShowAlarmForm] = useState(false);
  const [alarmData, setAlarmData] = useState({ title: "", description: "" });
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  // Cargar automáticamente si viene el código por URL
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setAccessCode(code);
      setTimeout(() => {
        handleSearchWithCode(code);
      }, 300);
    }
  }, [searchParams]);

  // Subscribe to real-time updates for user applications
  useEffect(() => {
    if (!userData) return;

    const channel = supabase
      .channel(`user-apps-${userData.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_applications",
          filter: `end_user_id=eq.${userData.id}`,
        },
        () => {
          if (accessCode) {
            handleSearchWithCode(accessCode);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userData, accessCode]);

  const handleSearchWithCode = async (code: string) => {
    if (!code.trim()) return;

    setSearching(true);

    const { data: user, error: userError } = await supabase
      .from("end_users")
      .select("*, companies(name)")
      .eq("access_code", code.trim())
      .maybeSingle();

    if (userError || !user) {
      toast({
        title: "Código no encontrado",
        description: "No se encontró ningún usuario con ese código de acceso",
        variant: "destructive",
      });
      setSearching(false);
      return;
    }

    const { data: userApps } = await supabase
      .from("user_applications")
      .select("*")
      .eq("end_user_id", user.id);

    if (userApps) {
      const globalAppIds = userApps
        .filter((app) => app.global_application_id)
        .map((app) => app.global_application_id);

      const { data: globalApps } = globalAppIds.length > 0
        ? await supabase
            .from("global_applications")
            .select("id, name, description, url")
            .in("id", globalAppIds)
        : { data: [] };

      const companyAppIds = userApps
        .filter((app) => app.application_id)
        .map((app) => app.application_id);

      const { data: companyApps } = companyAppIds.length > 0
        ? await supabase
            .from("company_applications")
            .select("id, name, description, url")
            .in("id", companyAppIds)
        : { data: [] };

      const enrichedApps = userApps.map((app) => ({
        ...app,
        global_applications: app.global_application_id
          ? globalApps?.find((g) => g.id === app.global_application_id) || null
          : null,
        company_applications: app.application_id
          ? companyApps?.find((c) => c.id === app.application_id) || null
          : null,
      }));

      setApplications(enrichedApps as any);
    }

    setUserData(user);
    setSearching(false);
  };

  const handleSearch = async () => {
    if (!accessCode.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu código de acceso",
        variant: "destructive",
      });
      return;
    }

    handleSearchWithCode(accessCode.trim());
  };

  const handleCreateAlarm = async () => {
    if (!userData || !alarmData.title || !alarmData.description) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    setUploadingFiles(true);

    try {
      const { data: alarm, error: alarmError } = await supabase
        .from("alarms")
        .insert([
          {
            end_user_id: userData.id,
            title: alarmData.title,
            description: alarmData.description,
            priority: "media",
          },
        ])
        .select()
        .single();

      if (alarmError) throw alarmError;

      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${alarm.id}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("alarm-attachments")
            .upload(fileName, file);

          if (!uploadError) {
            await supabase.from("alarm_attachments").insert([
              {
                alarm_id: alarm.id,
                file_name: file.name,
                file_path: fileName,
                file_type: file.type,
                file_size: file.size,
              },
            ]);
          }
        }
      }

      toast({
        title: "Alarma creada",
        description: "Tu solicitud ha sido enviada correctamente",
      });

      setAlarmData({ title: "", description: "" });
      setSelectedFiles([]);
      setShowAlarmForm(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo crear la alarma: " + error.message,
        variant: "destructive",
      });
    }

    setUploadingFiles(false);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Busca tu Info</h1>
          <p className="text-muted-foreground">
            Ingresa tu código de acceso para ver tus aplicativos
          </p>
        </div>

        {!userData ? (
          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código de Acceso</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="code"
                        placeholder="Ingresa tu código único"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="pl-10"
                      />
                    </div>
                    <Button onClick={handleSearch} disabled={searching}>
                      <Search className="mr-2 h-4 w-4" />
                      {searching ? "Buscando..." : "Buscar"}
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>¿No tienes tu código?</strong> Contacta al administrador de tu empresa
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">{userData.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {userData.companies.name} • Doc: {userData.document_number}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUserData(null);
                      setApplications([]);
                      setAccessCode("");
                    }}
                  >
                    Salir
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Tabs defaultValue="applications" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="applications">Mis Aplicativos</TabsTrigger>
                <TabsTrigger value="alarms">Crear Alarma</TabsTrigger>
                <TabsTrigger value="chat">Chat</TabsTrigger>
              </TabsList>

              <TabsContent value="applications">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Grid3x3 className="h-5 w-5" />
                      Tus Aplicativos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {applications.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No tienes aplicativos asignados
                      </p>
                    ) : (
                      applications.map((app) => {
                        const appData = app.global_applications || app.company_applications;
                        if (!appData) return null;

                        return (
                          <Collapsible key={app.id}>
                            <CollapsibleTrigger className="w-full">
                           <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors">
                                 <div className="flex items-center gap-3 text-left">
                                   <div className="bg-muted p-2 rounded-lg">
                                     <Grid3x3 className="h-5 w-5 text-foreground" />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold">{appData.name}</h4>
                                    {appData.description && (
                                      <p className="text-xs text-muted-foreground">
                                        {appData.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="ml-4 mt-2 p-4 border-l-2 border-muted space-y-2">
                                {appData.url && (
                                   <a
                                     href={appData.url}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="flex items-center gap-2 text-sm text-foreground hover:underline font-medium"
                                   >
                                    <ExternalLink className="h-3 w-3" />
                                    Abrir aplicativo
                                  </a>
                                )}
                                {app.username && (
                                  <div className="text-sm">
                                    <span className="font-medium">Usuario:</span>{" "}
                                    <code className="bg-muted px-2 py-1 rounded">{app.username}</code>
                                  </div>
                                )}
                                {app.password && (
                                  <div className="text-sm">
                                    <span className="font-medium">Contraseña:</span>{" "}
                                    <code className="bg-muted px-2 py-1 rounded">{app.password}</code>
                                  </div>
                                )}
                                {app.notes && (
                                  <div className="text-sm">
                                    <span className="font-medium">Notas:</span>
                                    <p className="text-muted-foreground mt-1">{app.notes}</p>
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="alarms">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      ¿Necesitas ayuda?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!showAlarmForm ? (
                      <Button onClick={() => setShowAlarmForm(true)} className="w-full">
                        Crear nueva solicitud de ayuda
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="alarm-title">Asunto *</Label>
                          <Input
                            id="alarm-title"
                            placeholder="Describe brevemente el problema"
                            value={alarmData.title}
                            onChange={(e) =>
                              setAlarmData({ ...alarmData, title: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="alarm-description">Descripción *</Label>
                          <Textarea
                            id="alarm-description"
                            placeholder="Explica con detalle tu problema o solicitud"
                            value={alarmData.description}
                            onChange={(e) =>
                              setAlarmData({ ...alarmData, description: e.target.value })
                            }
                            rows={4}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="file-upload">Adjuntar Evidencia (opcional)</Label>
                          <div className="space-y-2">
                            <input
                              id="file-upload"
                              type="file"
                              multiple
                              accept="image/*,video/*,.pdf,.doc,.docx"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                setSelectedFiles((prev) => [...prev, ...files]);
                              }}
                              className="hidden"
                            />
                            <label htmlFor="file-upload">
                              <Button type="button" variant="outline" className="w-full" asChild>
                                <span>
                                  <Paperclip className="mr-2 h-4 w-4" />
                                  Seleccionar Archivos
                                </span>
                              </Button>
                            </label>

                            {selectedFiles.length > 0 && (
                              <div className="space-y-2">
                                {selectedFiles.map((file, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                                  >
                                    <div className="flex items-center gap-2 text-sm">
                                      <Paperclip className="h-3 w-3" />
                                      <span className="truncate max-w-[200px]">{file.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        ({(file.size / 1024).toFixed(1)} KB)
                                      </span>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
                                      }
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowAlarmForm(false);
                              setAlarmData({ title: "", description: "" });
                              setSelectedFiles([]);
                            }}
                            className="flex-1"
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleCreateAlarm}
                            disabled={uploadingFiles}
                            className="flex-1"
                          >
                            {uploadingFiles ? "Enviando..." : "Enviar Solicitud"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="chat">
                <UserChat accessCode={accessCode} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
