import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Key, Grid3x3, Bell, ExternalLink, Paperclip, X, Home, FileText, Download, Eye, EyeOff, Clock, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserChat from "./UserChat";
import AlarmAttachment from "@/components/AlarmAttachment";
import SecurityTips from "@/components/SecurityTips";
import { UserReferrals } from "@/components/UserReferrals";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  credential_created_at: string | null;
  last_password_change: string | null;
  credential_expires_at: string | null;
  credential_notes: string | null;
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
  const [userAlarms, setUserAlarms] = useState<any[]>([]);
  const [loadingAlarms, setLoadingAlarms] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [moduleVisibility, setModuleVisibility] = useState<Record<string, boolean>>({});
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

    loadUserAlarms();

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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alarms",
          filter: `end_user_id=eq.${userData.id}`,
        },
        () => {
          loadUserAlarms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userData, accessCode]);

  const loadUserAlarms = async () => {
    if (!userData) return;
    
    setLoadingAlarms(true);
    const { data, error } = await supabase
      .from("alarms")
      .select("*")
      .eq("end_user_id", userData.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Load attachments for each alarm
      const alarmsWithAttachments = await Promise.all(
        data.map(async (alarm) => {
          const { data: attachments } = await supabase
            .from("alarm_attachments")
            .select("*")
            .eq("alarm_id", alarm.id);
          return { ...alarm, attachments: attachments || [] };
        })
      );
      setUserAlarms(alarmsWithAttachments);
    }
    setLoadingAlarms(false);
  };

  const handleSearchWithCode = async (code: string) => {
    if (!code.trim()) return;

    setSearching(true);

    const { data: user, error: userError } = await supabase
      .from("end_users")
      .select("*, companies(name, id)")
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

    // Load company module visibility
    const { data: visibilityData } = await supabase
      .from("company_module_visibility")
      .select("*")
      .eq("company_id", (user as any).companies.id);

    const visibilityMap: Record<string, boolean> = {};
    if (visibilityData && visibilityData.length > 0) {
      visibilityData.forEach(v => {
        visibilityMap[v.module_name] = v.visible || false;
      });
    } else {
      // Default: all visible
      visibilityMap["applications"] = true;
      visibilityMap["alarms"] = true;
      visibilityMap["create_alarm"] = true;
      visibilityMap["chat"] = true;
      visibilityMap["referrals"] = true;
    }
    setModuleVisibility(visibilityMap);

    // Fetch user applications without joins first
    const { data: userApps, error: appsError } = await supabase
      .from("user_applications")
      .select("*")
      .eq("end_user_id", user.id);

    if (appsError) {
      console.error("Error loading user_applications:", appsError);
      toast({
        title: "Error",
        description: "No se pudieron cargar los aplicativos",
        variant: "destructive",
      });
      setSearching(false);
      return;
    }

    if (!userApps || userApps.length === 0) {
      setApplications([]);
      setUserData(user);
      setSearching(false);
      return;
    }

    // Manually join with global_applications and company_applications
    const enrichedApps = await Promise.all(
      userApps.map(async (app) => {
        let appDetails = null;

        if (app.global_application_id) {
          const { data: globalApp } = await supabase
            .from("global_applications")
            .select("name, description, url")
            .eq("id", app.global_application_id)
            .single();
          appDetails = { global_applications: globalApp, company_applications: null };
        } else if (app.application_id) {
          const { data: companyApp } = await supabase
            .from("company_applications")
            .select("name, description, url")
            .eq("id", app.application_id)
            .single();
          appDetails = { global_applications: null, company_applications: companyApp };
        }

        return {
          ...app,
          ...appDetails,
        };
      })
    );

    setApplications(enrichedApps as any);

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
      loadUserAlarms();
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
          <div className="flex justify-between items-center mb-4">
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              <Home className="mr-2 h-4 w-4" />
              Volver al Inicio
            </Button>
          </div>
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
                      {userData.companies?.name || "Sin empresa"} • Doc: {userData.document_number}
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
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${
                [
                  moduleVisibility.applications,
                  moduleVisibility.alarms,
                  moduleVisibility.create_alarm,
                  moduleVisibility.referrals,
                  moduleVisibility.chat
                ].filter(Boolean).length
              }, minmax(0, 1fr))` }}>
                {moduleVisibility.applications !== false && (
                  <TabsTrigger value="applications">Mis Aplicativos</TabsTrigger>
                )}
                {moduleVisibility.alarms !== false && (
                  <TabsTrigger value="history">Mis Alarmas</TabsTrigger>
                )}
                {moduleVisibility.create_alarm !== false && (
                  <TabsTrigger value="alarms">Crear Alarma</TabsTrigger>
                )}
                {moduleVisibility.referrals !== false && (
                  <TabsTrigger value="referrals">Referidos</TabsTrigger>
                )}
                {moduleVisibility.chat !== false && (
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                )}
              </TabsList>

              {moduleVisibility.applications !== false && (
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
                      <div className="text-center py-8 space-y-2">
                        <p className="text-sm text-muted-foreground">
                          No tienes aplicativos asignados
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Contacta al administrador para que te asigne aplicativos
                        </p>
                      </div>
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
                                  <div className="text-sm flex items-center gap-2">
                                    <span className="font-medium">Contraseña:</span>{" "}
                                    <code className="bg-muted px-2 py-1 rounded">
                                      {visiblePasswords[app.id] ? app.password : "••••••••"}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setVisiblePasswords(prev => ({
                                          ...prev,
                                          [app.id]: !prev[app.id]
                                        }));
                                      }}
                                      className="h-6 w-6 p-0"
                                    >
                                      {visiblePasswords[app.id] ? (
                                        <EyeOff className="h-3 w-3" />
                                      ) : (
                                        <Eye className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                 )}
                                 {app.notes && (
                                   <div className="text-sm">
                                     <span className="font-medium">Notas:</span>
                                     <p className="text-muted-foreground mt-1">{app.notes}</p>
                                   </div>
                                 )}
                                 {app.credential_notes && (
                                   <div className="text-sm">
                                     <span className="font-medium">Notas de Credenciales:</span>
                                     <p className="text-muted-foreground mt-1">{app.credential_notes}</p>
                                   </div>
                                 )}
                                 
                                 {/* Metadata */}
                                 <div className="pt-3 border-t space-y-1">
                                   {app.credential_created_at && (
                                     <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                       <Calendar className="h-3 w-3" />
                                       <span>Creado: {new Date(app.credential_created_at).toLocaleDateString("es-ES")}</span>
                                     </div>
                                   )}
                                   {app.last_password_change && (
                                     <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                       <Clock className="h-3 w-3" />
                                       <span>Última actualización: {new Date(app.last_password_change).toLocaleDateString("es-ES")}</span>
                                     </div>
                                   )}
                                   {app.credential_expires_at && (
                                     <div className="flex items-center gap-2 text-xs">
                                       <Clock className="h-3 w-3" />
                                       <span className={
                                         new Date(app.credential_expires_at) < new Date() 
                                           ? "text-destructive font-medium" 
                                           : "text-warning"
                                       }>
                                         Vence: {new Date(app.credential_expires_at).toLocaleDateString("es-ES")}
                                         {new Date(app.credential_expires_at) < new Date() && " (Vencido)"}
                                       </span>
                                     </div>
                                   )}
                                 </div>
                               </div>
                             </CollapsibleContent>
                           </Collapsible>
                        );
                      })
                    )}
                   </CardContent>
                </Card>
                
                {/* Security Tips */}
                <SecurityTips />
              </TabsContent>
              )}

              {moduleVisibility.alarms !== false && (
                <TabsContent value="history">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Historial de Alarmas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loadingAlarms ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : userAlarms.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No tienes alarmas registradas
                      </p>
                    ) : (
                      userAlarms.map((alarm) => (
                        <Collapsible key={alarm.id}>
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors">
                              <div className="flex items-center gap-3 text-left">
                                <div className="bg-muted p-2 rounded-lg">
                                  <Bell className="h-5 w-5 text-foreground" />
                                </div>
                                <div>
                                  <h4 className="font-semibold">{alarm.title}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(alarm.created_at).toLocaleString()}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      alarm.status === "abierta" ? "bg-destructive/10 text-destructive" :
                                      alarm.status === "en_proceso" ? "bg-yellow-500/10 text-yellow-600" :
                                      alarm.status === "resuelta" ? "bg-green-500/10 text-green-600" :
                                      "bg-muted text-muted-foreground"
                                    }`}>
                                      {alarm.status === "abierta" ? "Abierta" :
                                       alarm.status === "en_proceso" ? "En Proceso" :
                                       alarm.status === "resuelta" ? "Resuelta" : "Cerrada"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Prioridad: {alarm.priority}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-4 mt-2 p-4 border-l-2 border-muted space-y-3">
                              <div>
                                <span className="font-medium text-sm">Descripción:</span>
                                <p className="text-sm text-muted-foreground mt-1">{alarm.description}</p>
                              </div>
                              
                              {alarm.attachments && alarm.attachments.length > 0 && (
                                <div>
                                  <span className="font-medium text-sm">Archivos Adjuntos:</span>
                                  <div className="space-y-2 mt-2">
                                    {alarm.attachments.map((attachment: any) => (
                                      <AlarmAttachment
                                        key={attachment.id}
                                        attachmentPath={attachment.file_path}
                                        attachmentName={attachment.file_name}
                                        attachmentType={attachment.file_type}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              )}

              {moduleVisibility.create_alarm !== false && (
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
              )}

              {moduleVisibility.referrals !== false && (
                <TabsContent value="referrals">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Mis Referidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userData && <UserReferrals userId={userData.id} />}
                  </CardContent>
                </Card>
              </TabsContent>
              )}

              {moduleVisibility.chat !== false && (
                <TabsContent value="chat">
                  <UserChat accessCode={accessCode} />
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
