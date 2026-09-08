import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles, Plus, Pencil, Trash2 } from "lucide-react";

interface WelcomeMessage {
  id: string;
  title: string;
  message: string;
  emoji: string | null;
  active: boolean;
  created_at: string;
}

const empty = { title: "", message: "", emoji: "👋", active: true };

export default function WelcomeMessages() {
  const [items, setItems] = useState<WelcomeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WelcomeMessage | null>(null);
  const [form, setForm] = useState(empty);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("welcome_messages")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) toast({ title: "Error al cargar", description: error.message, variant: "destructive" });
    setItems((data as WelcomeMessage[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (m: WelcomeMessage) => {
    setEditing(m);
    setForm({ title: m.title, message: m.message, emoji: m.emoji || "👋", active: m.active });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast({ title: "Completa el título y el mensaje", variant: "destructive" });
      return;
    }
    const payload = { ...form, title: form.title.trim(), message: form.message.trim() };
    const { error } = editing
      ? await supabase.from("welcome_messages").update(payload).eq("id", editing.id)
      : await supabase.from("welcome_messages").insert(payload);
    if (error) {
      toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Mensaje actualizado" : "Mensaje creado" });
    setOpen(false);
    load();
  };

  const toggleActive = async (m: WelcomeMessage) => {
    const { error } = await supabase.from("welcome_messages").update({ active: !m.active }).eq("id", m.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const remove = async (m: WelcomeMessage) => {
    if (!confirm("¿Eliminar este mensaje de bienvenida?")) return;
    const { error } = await supabase.from("welcome_messages").delete().eq("id", m.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Mensaje eliminado" }); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Mensajes de Bienvenida
          </h1>
          <p className="text-muted-foreground">
            Los usuarios del portal ven uno distinto de forma aleatoria en cada ingreso.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo mensaje
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar mensaje" : "Nuevo mensaje"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_90px] gap-3">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Bienvenido a Convert-IA"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Emoji</Label>
                  <Input
                    value={form.emoji}
                    onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                    maxLength={4}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mensaje</Label>
                <Textarea
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Gestiona tus accesos, consulta tus solicitudes..."
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label>Activo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensajes ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay mensajes.</p>
          ) : (
            items.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{m.emoji} {m.title}</span>
                    <Badge variant={m.active ? "default" : "secondary"}>
                      {m.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{m.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={m.active} onCheckedChange={() => toggleActive(m)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(m)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
