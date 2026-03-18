import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Key, Grid3x3, Bell, ExternalLink, Paperclip, X, Home, FileText,
  Eye, EyeOff, Clock, Users as UsersIcon, Globe, Menu, MessageCircle,
  LogOut, ChevronLeft,
} from "lucide-react";
import UserChat from "./UserChat";
import AlarmAttachment from "@/components/AlarmAttachment";
import SecurityTips from "@/components/SecurityTips";
import { UserReferrals } from "@/components/UserReferrals";
import { auditService } from "@/lib/audit";
import { RemoteBrowser } from "@/components/RemoteBrowser";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

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

type ModuleKey = "applications" | "history" | "alarms" | "referrals" | "chat" | "browser" | "change-password";

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: React.ElementType;
  visibilityKey: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "applications", label: "Mis Aplicativos", icon: Grid3x3, visibilityKey: "applications" },
  { key: "history", label: "Mis Alarmas", icon: FileText, visibilityKey: "alarms" },
  { key: "alarms", label: "Crear Alarma", icon: Bell, visibilityKey: "create_alarm" },
  { key: "referrals", label: "Referidos", icon: UsersIcon, visibilityKey: "referrals" },
  { key: "chat", label: "Chat", icon: MessageCircle, visibilityKey: "chat" },
  { key: "browser", label: "Navegador", icon: Globe, visibilityKey: "browser" },
];

export default function UserPortal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [userData, setUserData] = useState<EndUser | null>(null);
  const [applications, setApplications] = useState<UserApplication[]>([]);
  const [alarmData, setAlarmData] = useState({ title: "", description: "" });
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [userAlarms, setUserAlarms] = useState<any[]>([]);
  const [loadingAlarms, setLoadingAlarms] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [moduleVisibility, setModuleVisibility] = useState<Record<string, boolean>>({});
  const [portalSearch, setPortalSearch] = useState("");
  const [activeModule, setActiveModule] = useState<ModuleKey>("applications");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Password change state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Session check: redirect to home if no portal session
  useEffect(() => {
    const portalUserId = sessionStorage.getItem("portal_user_id");
    const code = searchParams.get("code");
    if (!portalUserId && !code) {
      navigate("/", { replace: true });
    }
  }, []);

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

    let visibilityData = null;
    const companyId = (user as any).companies?.id || (user as any).company_id;

    if (companyId) {
      const { data } = await supabase
        .from("company_module_visibility")
        .select("*")
        .eq("company_id", companyId);
      visibilityData = data;
    }

    const visibilityMap: Record<string, boolean> = {};
    if (visibilityData && visibilityData.length > 0) {
      visibilityData.forEach(v => {
        visibilityMap[v.module_name] = v.visible || false;
      });
    } else if (companyId) {
      visibilityMap["applications"] = true;
      visibilityMap["alarms"] = true;
      visibilityMap["create_alarm"] = true;
      visibilityMap["chat"] = true;
      visibilityMap["referrals"] = true;
      visibilityMap["browser"] = true;
    } else {
      visibilityMap["applications"] = true;
      visibilityMap["alarms"] = false;
      visibilityMap["create_alarm"] = false;
      visibilityMap["chat"] = false;
      visibilityMap["referrals"] = false;
      visibilityMap["browser"] = false;
    }
    setModuleVisibility(visibilityMap);

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
        return { ...app, ...appDetails };
      })
    );

    setApplications(enrichedApps as any);

    auditService.logActivity({
      userId: "system",
      role: "user",
      actionType: "consulta_info",
      module: "Busca tu Info",
      details: {
        consulted_user: user.full_name,
        consulted_document: user.document_number,
        company: (user as any).companies?.name || "Sin empresa"
      }
    });

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
        .insert([{
          end_user_id: userData.id,
          title: alarmData.title,
          description: alarmData.description,
          priority: "media",
        }])
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
            await supabase.from("alarm_attachments").insert([{
              alarm_id: alarm.id,
              file_name: file.name,
              file_path: fileName,
              file_type: file.type,
              file_size: file.size,
            }]);
          }
        }
      }

      toast({ title: "Alarma creada", description: "Tu solicitud ha sido enviada correctamente" });
      setAlarmData({ title: "", description: "" });
      setSelectedFiles([]);
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

  const filteredApplications = applications.filter(app => {
    const appData = app.global_applications || app.company_applications;
    if (!appData) return false;
    const searchLower = portalSearch.toLowerCase();
    return (
      appData.name.toLowerCase().includes(searchLower) ||
      (appData.description && appData.description.toLowerCase().includes(searchLower)) ||
      (app.username && app.username.toLowerCase().includes(searchLower))
    );
  });

  const filteredAlarms = userAlarms.filter(alarm => {
    const searchLower = portalSearch.toLowerCase();
    return (
      alarm.title.toLowerCase().includes(searchLower) ||
      alarm.description.toLowerCase().includes(searchLower) ||
      alarm.status.toLowerCase().includes(searchLower)
    );
  });

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => moduleVisibility[item.visibilityKey] === true
  );

  // Set first visible module as active if current isn't visible
  useEffect(() => {
    if (userData && visibleNavItems.length > 0) {
      const currentVisible = visibleNavItems.find((item) => item.key === activeModule);
      if (!currentVisible) {
        setActiveModule(visibleNavItems[0].key);
      }
    }
  }, [moduleVisibility, userData]);

  const handleNavClick = (key: ModuleKey) => {
    setActiveModule(key);
    if (isMobile) setSidebarOpen(false);
  };

  // ── Sidebar content (shared between mobile Sheet and desktop) ──
  const SidebarNav = () => (
    <div className="flex flex-col h-full">
      {/* User info */}
      {userData && (
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full shrink-0">
              <UsersIcon className="h-5 w-5 text-primary" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{userData.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {userData.companies?.name || "Sin empresa"}
                </p>
                <p className="text-xs text-muted-foreground">{userData.document_number}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      {!sidebarCollapsed && (
        <div className="p-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={portalSearch}
              onChange={(e) => setPortalSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
      )}

      {/* Nav items */}
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-1 px-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNavClick(item.key)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border/50 p-2">
        <button
          onClick={() => window.location.href = "/"}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all w-full"
          title={sidebarCollapsed ? "Inicio" : undefined}
        >
          <Home className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span>Inicio</span>}
        </button>
        {userData && (
          <button
            onClick={() => {
              setUserData(null);
              setApplications([]);
              setAccessCode("");
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-all w-full"
            title={sidebarCollapsed ? "Salir" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Salir</span>}
          </button>
        )}
      </div>
    </div>
  );

  // ── Login screen ──
  if (!userData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Busca tu Info</h1>
            <p className="text-muted-foreground">Ingresa tu código de acceso para ver tus aplicativos</p>
          </div>
          <Card className="shadow-xl border-primary/10">
            <CardContent className="pt-8 pb-8 px-6">
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="code" className="text-base">Código de Acceso</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Key className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="code"
                        placeholder="Ingresa tu código único"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="pl-10 h-11"
                        autoFocus
                      />
                    </div>
                    <Button onClick={handleSearch} disabled={searching} size="lg" className="px-6">
                      {searching ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div> : <Search className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <strong>¿No tienes tu código?</strong> Contacta al administrador de tu empresa
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Main portal layout with sidebar ──
  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 shrink-0",
          sidebarCollapsed ? "w-16" : "w-60"
        )}
      >
        {/* Collapse toggle */}
        <div className="flex items-center justify-end p-2 border-b border-border/50">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")} />
          </Button>
        </div>
        <SidebarNav />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarNav />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile trigger + module title) */}
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-40 flex items-center h-12 px-4 gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => {
              setSidebarCollapsed(false);
              setSidebarOpen(true);
            }}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {(() => {
              const current = NAV_ITEMS.find((i) => i.key === activeModule);
              if (!current) return null;
              const Icon = current.icon;
              return (
                <>
                  <Icon className="h-4 w-4 text-primary" />
                  <span>{current.label}</span>
                </>
              );
            })()}
          </div>
        </header>

        {/* Content area */}
        <main className={cn(
          "flex-1 min-h-0",
          activeModule === "browser" ? "flex flex-col" : "overflow-auto"
        )}>
          <div className={cn(
            activeModule === "browser" ? "flex-1 min-h-0 flex flex-col p-0" : "p-4 sm:p-6"
          )}>
            {/* Applications */}
            {activeModule === "applications" && moduleVisibility.applications && (
              <div className="max-w-[1400px] mx-auto">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredApplications.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-muted/30 rounded-xl border border-dashed">
                      <Grid3x3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-lg font-medium">No se encontraron aplicativos</p>
                      <p className="text-sm text-muted-foreground">
                        {portalSearch ? "Intenta con otra búsqueda" : "No tienes aplicativos asignados"}
                      </p>
                    </div>
                  ) : (
                    filteredApplications.map((app) => {
                      const appData = app.global_applications || app.company_applications;
                      if (!appData) return null;
                      return (
                        <Card key={app.id} className="hover:shadow-md transition-all duration-200 group">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="bg-primary/5 p-2.5 rounded-xl group-hover:bg-primary/10 transition-colors">
                                <Grid3x3 className="h-5 w-5 text-primary" />
                              </div>
                              {appData.url && (
                                <a
                                  href={appData.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-medium bg-secondary hover:bg-secondary/80 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1"
                                >
                                  Abrir <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <CardTitle className="text-lg mt-3 line-clamp-1" title={appData.name}>
                              {appData.name}
                            </CardTitle>
                            {appData.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 h-10" title={appData.description}>
                                {appData.description}
                              </p>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-3 pt-0">
                            <div className="space-y-2 bg-muted/40 p-3 rounded-lg">
                              {app.username && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-muted-foreground">Usuario:</span>
                                  <code className="bg-background px-2 py-0.5 rounded border font-mono text-xs select-all">
                                    {app.username}
                                  </code>
                                </div>
                              )}
                              {app.password && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-muted-foreground">Pass:</span>
                                  <div className="flex items-center gap-2">
                                    <code className="bg-background px-2 py-0.5 rounded border font-mono text-xs">
                                      {visiblePasswords[app.id] ? app.password : "••••••••"}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() => setVisiblePasswords(prev => ({ ...prev, [app.id]: !prev[app.id] }))}
                                    >
                                      {visiblePasswords[app.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                            {(app.notes || app.credential_notes) && (
                              <Collapsible>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="w-full h-8 text-xs">
                                    Ver notas <ChevronDown className="ml-1 h-3 w-3" />
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="text-xs text-muted-foreground pt-2 space-y-1">
                                  {app.notes && <p>N: {app.notes}</p>}
                                  {app.credential_notes && <p>NC: {app.credential_notes}</p>}
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                            {app.credential_expires_at && (
                              <div className={`text-xs flex items-center gap-1.5 ${new Date(app.credential_expires_at) < new Date() ? "text-destructive" : "text-amber-600"}`}>
                                <Clock className="h-3 w-3" />
                                {new Date(app.credential_expires_at) < new Date() ? "Vencida: " : "Vence: "}
                                {new Date(app.credential_expires_at).toLocaleDateString()}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
                <div className="mt-8">
                  <SecurityTips />
                </div>
              </div>
            )}

            {/* Alarm History */}
            {activeModule === "history" && moduleVisibility.alarms && (
              <div className="max-w-[1000px] mx-auto">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Historial de Alarmas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingAlarms ? (
                      <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : filteredAlarms.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        {portalSearch ? "No se encontraron alarmas con ese criterio" : "No tienes alarmas registradas"}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredAlarms.map((alarm) => (
                          <Collapsible key={alarm.id} className="border rounded-lg hover:bg-muted/30 transition-colors">
                            <CollapsibleTrigger className="w-full flex items-center justify-between p-4">
                              <div className="flex items-center gap-4 text-left">
                                <div className={`p-2 rounded-full ${alarm.status === "abierta" ? "bg-red-100 text-red-600" :
                                  alarm.status === "en_proceso" ? "bg-yellow-100 text-yellow-600" : "bg-green-100 text-green-600"}`}>
                                  <Bell className="h-4 w-4" />
                                </div>
                                <div>
                                  <h4 className="font-semibold">{alarm.title}</h4>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <span>{new Date(alarm.created_at).toLocaleString()}</span>
                                    <span>•</span>
                                    <span className="capitalize">{alarm.priority}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <Badge variant={alarm.status === "abierta" ? "destructive" : alarm.status === "en_proceso" ? "secondary" : "default"}>
                                  {alarm.status.replace("_", " ")}
                                </Badge>
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="border-t bg-muted/10 px-4 py-3">
                              <p className="text-sm mb-3">{alarm.description}</p>
                              {alarm.attachments && alarm.attachments.length > 0 && (
                                <div className="space-y-2">
                                  <span className="text-xs font-medium text-muted-foreground">Adjuntos:</span>
                                  <div className="flex flex-wrap gap-2">
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
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Create Alarm */}
            {activeModule === "alarms" && moduleVisibility.create_alarm && (
              <div className="max-w-2xl mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Nueva Solicitud de Ayuda
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Asunto</Label>
                      <Input
                        value={alarmData.title}
                        onChange={(e) => setAlarmData({ ...alarmData, title: e.target.value })}
                        placeholder="Resumen del problema"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descripción Detallada</Label>
                      <Textarea
                        value={alarmData.description}
                        onChange={(e) => setAlarmData({ ...alarmData, description: e.target.value })}
                        placeholder="Explica qué sucede..."
                        rows={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Evidencia (Opcional)</Label>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                        <input
                          type="file"
                          multiple
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setSelectedFiles((prev) => [...prev, ...files]);
                          }}
                        />
                        <Paperclip className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Arrastra archivos aquí o haz clic para seleccionar</p>
                      </div>
                      {selectedFiles.length > 0 && (
                        <div className="space-y-2 mt-2">
                          {selectedFiles.map((file, i) => (
                            <div key={i} className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                              <span className="truncate">{file.name}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="pt-4 flex gap-3">
                      <Button className="flex-1" onClick={handleCreateAlarm} disabled={uploadingFiles}>
                        {uploadingFiles ? "Enviando..." : "Enviar Solicitud"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Referrals */}
            {activeModule === "referrals" && moduleVisibility.referrals && (
              <UserReferrals userId={userData.id} searchQuery={portalSearch} />
            )}

            {/* Chat */}
            {activeModule === "chat" && moduleVisibility.chat && (
              <UserChat userId={userData.id} userName={userData.full_name} />
            )}

            {/* Browser - always mounted when visible to keep session */}
            {moduleVisibility.browser && (
              <div className={cn("flex-1 min-h-0 min-w-0", activeModule !== "browser" && "hidden")}>
                <RemoteBrowser
                  companyId={(userData as any).companies?.id || (userData as any).company_id}
                  userId={userData.id}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
