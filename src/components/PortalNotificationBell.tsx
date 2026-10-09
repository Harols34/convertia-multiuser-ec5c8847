import { useState } from "react";
import { Bell, CheckCheck, MessageSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PortalNotif } from "@/hooks/usePortalNotifications";

interface Props {
  unread: PortalNotif[];
  onOpen: (n: PortalNotif) => void;
  onMarkAll: () => void;
}

export function PortalNotificationBell({ unread, onOpen, onMarkAll }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative shrink-0 h-9 w-9" aria-label="Notificaciones">
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold">Notificaciones {unread.length > 0 && <span className="text-muted-foreground font-normal">({unread.length} sin leer)</span>}</p>
          {unread.length > 0 && <Button variant="ghost" size="sm" onClick={onMarkAll}><CheckCheck className="h-4 w-4 mr-1" />Leídas</Button>}
        </div>
        <ScrollArea className="max-h-[400px]">
          {unread.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No tienes novedades nuevas</p>
          ) : unread.map((n) => {
            const Icon = n.module === "chat" ? MessageSquare : FileText;
            return (
              <button key={n.id} onClick={() => { setOpen(false); onOpen(n); }} className="w-full text-left flex gap-3 px-4 py-3 border-b hover:bg-accent">
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString("es-CO")}</p>
                </div>
              </button>
            );
          })}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
