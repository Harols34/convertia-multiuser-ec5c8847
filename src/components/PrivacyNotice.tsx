import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PrivacyPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export const PRIVACY_POSITIONS: { value: PrivacyPosition; label: string }[] = [
  { value: "top-left", label: "Superior izquierda" },
  { value: "top-center", label: "Superior centro" },
  { value: "top-right", label: "Superior derecha" },
  { value: "bottom-left", label: "Inferior izquierda" },
  { value: "bottom-center", label: "Inferior centro" },
  { value: "bottom-right", label: "Inferior derecha" },
];

export function positionClasses(pos: PrivacyPosition) {
  switch (pos) {
    case "top-left":
      return "top-2 left-3";
    case "top-center":
      return "top-2 left-1/2 -translate-x-1/2";
    case "top-right":
      return "top-2 right-3";
    case "bottom-left":
      return "bottom-2 left-3";
    case "bottom-right":
      return "bottom-2 right-3";
    default:
      return "bottom-2 left-1/2 -translate-x-1/2";
  }
}

export interface PrivacySettings {
  id: string;
  link_label: string;
  title: string;
  content: string;
  show_on_landing: boolean;
  landing_position: PrivacyPosition;
  show_on_portal: boolean;
  portal_position: PrivacyPosition;
}

export function PrivacyNotice({ surface }: { surface: "landing" | "portal" }) {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("privacy_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (active && data) setSettings(data as unknown as PrivacySettings);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!settings) return null;

  const visible =
    surface === "landing" ? settings.show_on_landing : settings.show_on_portal;
  if (!visible) return null;

  const pos =
    surface === "landing" ? settings.landing_position : settings.portal_position;

  return (
    <>
      <div
        className={`fixed z-40 pointer-events-none ${positionClasses(
          pos as PrivacyPosition
        )}`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto text-[11px] leading-tight text-muted-foreground/70 hover:text-foreground underline underline-offset-2 transition-colors bg-background/70 backdrop-blur-sm px-2 py-1 rounded"
        >
          {settings.link_label}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-visible">
          <DialogHeader>
            <DialogTitle>{settings.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
            {settings.content}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
