import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bell, Clock, CheckCircle2, User, Building2, MessageSquare } from "lucide-react";
import AlarmAttachment from "@/components/AlarmAttachment";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Chat from "@/components/Chat";

interface Alarm {
  id: string;
  title: string;
  description: string;
  status: "abierta" | "en_proceso" | "resuelta" | "cerrada";
  priority: string;
  created_at: string;
  end_user_id: string;
  end_users: {
    id: string;
    full_name: string;
    document_number: string;
    companies: {
      name: string;
    };
  };
}

export default function HelpDesk() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadAlarms();

    // Escuchar cambios en tiempo real
    const channel = supabase
      .channel("alarms-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alarms",
        },
        () => {
          loadAlarms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadAlarms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("alarms")
      .select(
        `
        *,
        end_users (
          id,
          full_name,
          document_number,
          companies (name)
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las alarmas",
        variant: "destructive",
      });
    } else {
      setAlarms(data || []);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async () => {
    if (!selectedAlarm || !newStatus) return;

    const updates: any = { status: newStatus };
    if (newStatus === "resuelta" || newStatus === "cerrada") {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("alarms")
      .update(updates)
      .eq("id", selectedAlarm.id);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la alarma",
        variant: "destructive",
      });
    } else {
      if (comment) {
        await supabase.from("alarm_comments").insert([
          {
            alarm_id: selectedAlarm.id,
            comment: comment,
          },
        ]);
      }

      toast({ title: "Alarma actualizada correctamente" });
      setDialogOpen(false);
      setComment("");
      setNewStatus("");
      loadAlarms();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      abierta: { variant: "destructive", label: "Abierta" },
      en_proceso: { variant: "default", label: "En Proceso" },
      resuelta: { variant: "secondary", label: "Resuelta" },
      cerrada: { variant: "outline", label: "Cerrada" },
    };
    const config = variants[status] || variants.abierta;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      alta: "text-destructive",
      media: "text-warning",
      baja: "text-muted-foreground",
    };
    return colors[priority] || colors.media;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mesa de Ayuda</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona las alarmas y solicitudes de los usuarios
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : alarms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay alarmas registradas</h3>
            <p className="text-sm text-muted-foreground">
              Las alarmas aparecerán aquí cuando los usuarios las creen
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {alarms.map((alarm) => (
            <Card
              key={alarm.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={async () => {
                setSelectedAlarm(alarm);
                setNewStatus(alarm.status);
                
                // Load attachments
                const { data: alarmAttachments } = await supabase
                  .from("alarm_attachments")
                  .select("*")
                  .eq("alarm_id", alarm.id);
                setAttachments(alarmAttachments || []);
                
                setDialogOpen(true);
              }}
            >
              <CardHeader>
                <div className="flex items-start justify-between space-y-0">
                  <CardTitle className="text-lg line-clamp-2">{alarm.title}</CardTitle>
                  {getStatusBadge(alarm.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {alarm.description}
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span>{alarm.end_users.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span>{alarm.end_users.companies.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{new Date(alarm.created_at).toLocaleString()}</span>
                  </div>
                  <div className={`font-medium ${getPriorityColor(alarm.priority)}`}>
                    Prioridad: {alarm.priority}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedAlarm?.title}</DialogTitle>
            <DialogDescription>Gestionar alarma y chat con el usuario</DialogDescription>
          </DialogHeader>

          {selectedAlarm && (
            <Tabs defaultValue="alarm" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="alarm">Detalles de Alarma</TabsTrigger>
                <TabsTrigger value="chat">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </TabsTrigger>
              </TabsList>

              <TabsContent value="alarm" className="space-y-4 py-4">
                <div>
                  <h4 className="font-semibold mb-2">Descripción</h4>
                  <p className="text-sm text-muted-foreground">{selectedAlarm.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Usuario</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedAlarm.end_users.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Doc: {selectedAlarm.end_users.document_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Empresa</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedAlarm.end_users.companies.name}
                    </p>
                  </div>
                </div>

                {attachments.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Archivos Adjuntos ({attachments.length})</h4>
                    <div className="grid gap-3">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="border rounded-lg p-3">
                          <AlarmAttachment
                            attachmentPath={attachment.file_path}
                            attachmentName={attachment.file_name}
                            attachmentType={attachment.file_type}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="status">Cambiar Estado</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="abierta">Abierta</SelectItem>
                      <SelectItem value="en_proceso">En Proceso</SelectItem>
                      <SelectItem value="resuelta">Resuelta</SelectItem>
                      <SelectItem value="cerrada">Cerrada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comment">Comentario (opcional)</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Añade un comentario sobre esta alarma..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateStatus}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Actualizar Alarma
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="chat" className="h-[500px]">
                <Chat endUserId={selectedAlarm.end_user_id} isAdmin={true} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
