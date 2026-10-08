import { useState } from "react";
import { Tag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RELEASES, CURRENT_VERSION } from "@/lib/changelog";

export function VersionHistory({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md"
        title="Historial de versiones"
      >
        <Tag className="h-4 w-4 shrink-0" />
        {!collapsed && <span>Versión {CURRENT_VERSION} · Ver cambios</span>}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-visible">
          <DialogHeader>
            <DialogTitle>Historial de versiones</DialogTitle>
            <DialogDescription>Cambios realizados en la plataforma desde la V1.0.0</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {RELEASES.map((r, i) => (
              <div key={r.version} className="border-l-2 pl-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={i === 0 ? "default" : "outline"}>{r.version}</Badge>
                  <span className="font-semibold text-sm">{r.title}</span>
                  {i === 0 && <span className="text-xs text-muted-foreground">(actual)</span>}
                </div>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-0.5">
                  {r.changes.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
