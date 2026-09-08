import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Save, MousePointer2, Shield } from "lucide-react";
import {
  PRIVACY_POSITIONS,
  positionClasses,
  type PrivacyPosition,
  type PrivacySettings,
} from "@/components/PrivacyNotice";

const ZONES: PrivacyPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

function PositionDesigner({
  surface,
  value,
  onChange,
  label,
}: {
  surface: "landing" | "portal";
  value: PrivacyPosition;
  onChange: (p: PrivacyPosition) => void;
  label: string;
}) {
  const [hover, setHover] = useState<PrivacyPosition | null>(null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MousePointer2 className="h-4 w-4" />
          Ubicar en la pantalla
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}: arrastra la leyenda a la posición deseada</DialogTitle>
        </DialogHeader>

        <div className="relative w-full aspect-video rounded-lg border bg-muted/40 overflow-hidden">
          {/* Boceto de la pantalla */}
          <div className="absolute inset-0 p-4 opacity-40 pointer-events-none">
            {surface === "landing" ? (
              <div className="h-full flex flex-col gap-3">
                <div className="h-8 bg-foreground/10 rounded" />
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div className="bg-foreground/10 rounded" />
                  <div className="bg-foreground/10 rounded" />
                </div>
              </div>
            ) : (
              <div className="h-full flex gap-3">
                <div className="w-1/5 bg-foreground/20 rounded" />
                <div className="flex-1 flex flex-col gap-3">
                  <div className="h-8 bg-foreground/10 rounded" />
                  <div className="flex-1 bg-foreground/10 rounded" />
                </div>
              </div>
            )}
          </div>

          {/* Zonas soltables */}
          {ZONES.map((zone) => (
            <div
              key={zone}
              onDragOver={(e) => {
                e.preventDefault();
                setHover(zone);
              }}
              onDragLeave={() => setHover((h) => (h === zone ? null : h))}
              onDrop={(e) => {
                e.preventDefault();
                setHover(null);
                onChange(zone);
              }}
              onClick={() => onChange(zone)}
              className={`absolute w-[30%] h-[22%] rounded border border-dashed cursor-pointer transition-colors ${
                hover === zone ? "border-primary bg-primary/10" : "border-border/70"
              } ${positionClasses(zone)}`}
            />
          ))}

          {/* Leyenda arrastrable */}
          <div
            draggable
            onDragEnd={() => setHover(null)}
            className={`absolute z-10 cursor-grab active:cursor-grabbing text-[11px] text-muted-foreground bg-background border rounded px-2 py-1 shadow-sm ${positionClasses(
              value
            )}`}
          >
            Privacidad y Tratamiento de Datos Personales
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Arrastra la etiqueta o haz clic en una de las seis zonas para fijar su ubicación.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default function PrivacyConfig() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("privacy_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) setSettings(data as unknown as PrivacySettings);
    })();
  }, []);

  const update = (patch: Partial<PrivacySettings>) =>
    setSettings((s) => (s ? { ...s, ...patch } : s));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("privacy_settings")
      .update({
        link_label: settings.link_label,
        title: settings.title,
        content: settings.content,
        show_on_landing: settings.show_on_landing,
        landing_position: settings.landing_position,
        show_on_portal: settings.show_on_portal,
        portal_position: settings.portal_position,
      })
      .eq("id", settings.id);
    setSaving(false);
    toast({
      title: error ? "No se pudo guardar" : "Cambios guardados",
      description: error ? error.message : "La leyenda de privacidad fue actualizada.",
      variant: error ? "destructive" : undefined,
    });
  };

  if (!settings) return <div className="p-6 text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">Privacidad</h1>
            <p className="text-sm text-muted-foreground">
              Configura la leyenda de tratamiento de datos y dónde se muestra.
            </p>
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dónde se publica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {(
              [
                {
                  surface: "landing" as const,
                  label: "Página principal",
                  show: settings.show_on_landing,
                  pos: settings.landing_position,
                  onShow: (v: boolean) => update({ show_on_landing: v }),
                  onPos: (p: PrivacyPosition) => update({ landing_position: p }),
                },
                {
                  surface: "portal" as const,
                  label: "Portal de usuario",
                  show: settings.show_on_portal,
                  pos: settings.portal_position,
                  onShow: (v: boolean) => update({ show_on_portal: v }),
                  onPos: (p: PrivacyPosition) => update({ portal_position: p }),
                },
              ]
            ).map((row) => (
              <div key={row.surface} className="space-y-3 border-b pb-5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{row.label}</Label>
                  <Switch checked={row.show} onCheckedChange={row.onShow} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRIVACY_POSITIONS.map((p) => (
                    <Button
                      key={p.value}
                      type="button"
                      size="sm"
                      variant={row.pos === p.value ? "default" : "outline"}
                      onClick={() => row.onPos(p.value)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                <PositionDesigner
                  surface={row.surface}
                  label={row.label}
                  value={row.pos}
                  onChange={row.onPos}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contenido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Texto del enlace</Label>
              <Input
                value={settings.link_label}
                onChange={(e) => update({ link_label: e.target.value })}
              />
            </div>
            <div>
              <Label>Título de la ventana</Label>
              <Input value={settings.title} onChange={(e) => update({ title: e.target.value })} />
            </div>
            <div>
              <Label>Texto de la política</Label>
              <Textarea
                rows={16}
                value={settings.content}
                onChange={(e) => update({ content: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
