import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const DAYS = [
  { n: 1, l: "Lun" }, { n: 2, l: "Mar" }, { n: 3, l: "Mié" }, { n: 4, l: "Jue" },
  { n: 5, l: "Vie" }, { n: 6, l: "Sáb" }, { n: 7, l: "Dom" },
];

export default function SupportSettingsPanel() {
  const [s, setS] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (supabase as any).from("support_settings").select("*").order("created_at").limit(1).maybeSingle()
      .then(({ data }: any) => setS(data));
  }, []);

  if (!s) return <p className="text-sm text-muted-foreground p-4">Cargando configuración...</p>;

  const set = (k: string, v: any) => setS({ ...s, [k]: v });

  const save = async () => {
    setSaving(true);
    const { id, created_at, updated_at, ...rest } = s;
    const { error } = await (supabase as any).from("support_settings").update(rest).eq("id", id);
    setSaving(false);
    error ? toast.error("No se pudo guardar", { description: error.message }) : toast.success("Configuración guardada");
  };

  const msgField = (k: string, label: string) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea rows={2} value={s[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horario de atención y respuestas de C-IA</CardTitle>
        <CardDescription>
          Estos valores los usa el asistente C-IA al registrar solicitudes y al responder preguntas sobre horarios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1"><Label>Hora inicio</Label><Input type="time" value={s.start_time} onChange={(e) => set("start_time", e.target.value)} /></div>
          <div className="space-y-1"><Label>Hora fin</Label><Input type="time" value={s.end_time} onChange={(e) => set("end_time", e.target.value)} /></div>
          <div className="space-y-1"><Label>Hora de corte</Label><Input type="time" value={s.cutoff_time} onChange={(e) => set("cutoff_time", e.target.value)} /></div>
          <div className="space-y-1"><Label>Zona horaria</Label><Input value={s.timezone} onChange={(e) => set("timezone", e.target.value)} /></div>
        </div>
        <div className="space-y-2">
          <Label>Días hábiles</Label>
          <div className="flex flex-wrap gap-4">
            {DAYS.map((d) => (
              <label key={d.n} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={s.work_days?.includes(d.n)}
                  onCheckedChange={(c) =>
                    set("work_days", c ? [...(s.work_days ?? []), d.n].sort() : (s.work_days ?? []).filter((x: number) => x !== d.n))
                  }
                />
                {d.l}
              </label>
            ))}
          </div>
        </div>
        {msgField("schedule_message", "Mensaje de horario de atención")}
        {msgField("before_cutoff_message", "Mensaje: solicitud antes de la hora de corte")}
        {msgField("after_cutoff_message", "Mensaje: solicitud después de la hora de corte (incluye viernes)")}
        {msgField("non_working_message", "Mensaje: solicitud fuera de horario / día no hábil")}
        {msgField("urgent_message", "Mensaje para solicitudes urgentes")}
        <div className="space-y-1">
          <Label>Palabras que marcan una solicitud como urgente (separadas por coma)</Label>
          <Input
            value={(s.urgent_keywords ?? []).join(", ")}
            onChange={(e) => set("urgent_keywords", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))}
          />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={s.notify_admins} onCheckedChange={(v) => set("notify_admins", v)} />
          Mostrar alertas a los administradores al crear, asignar, actualizar, escalar o resolver casos
        </label>
        <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar configuración"}</Button>
      </CardContent>
    </Card>
  );
}
