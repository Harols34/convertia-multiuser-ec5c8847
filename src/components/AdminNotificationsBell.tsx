import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Inbox, MessageSquare, MessagesSquare, Clock, EyeOff, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useAdminNotifications, SEEN_UNANSWERED_MINUTES, type AdminNotif } from "@/hooks/useAdminNotifications";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const META: Record<AdminNotif["kind"], { label: string; icon: any; cls: string }> = {
  new_alarm: { label: "Nuevas novedades", icon: Inbox, cls: "text-destructive" },
  comment: { label: "Comentarios sin responder", icon: MessageSquare, cls: "text-primary" },
  chat: { label: "Chats sin responder", icon: MessagesSquare, cls: "text-primary" },
  seen_unanswered: { label: `Vistos sin responder (+${SEEN_UNANSWERED_MINUTES} min)`, icon: EyeOff, cls: "text-destructive" },
  pending: { label: "Pendientes", icon: Clock, cls: "text-muted-foreground" },
};

const ago = (d: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
};

export function AdminNotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, counts, urgent, markSeen, markAllSeen } = useAdminNotifications(user?.id);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const prevUrgent = useRef<number | null>(null);

  useEffect(() => {
    if (prevUrgent.current !== null && urgent > prevUrgent.current) {
      toast.info("Tienes novedades nuevas", { description: `${urgent} por atender` });
    }
    prevUrgent.current = urgent;
  }, [urgent]);

  const list = items.filter((i) => (filter === "all" ? i.kind !== "pending" : i.kind === filter));

  const go = (n: AdminNotif) => { markSeen(n.refKey); setOpen(false); navigate(n.link); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Novedades">
          <Bell className="h-5 w-5" />
          {urgent > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {urgent > 99 ? "99+" : urgent}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold">Centro de novedades</p>
          <Button variant="ghost" size="sm" onClick={markAllSeen}><CheckCheck className="h-4 w-4 mr-1" />Marcar vistas</Button>
        </div>
        <div className="grid grid-cols-5 gap-1 p-2 border-b">
          {(Object.keys(META) as AdminNotif["kind"][]).map((k) => {
            const M = META[k]; const Icon = M.icon;
            return (
              <button key={k} onClick={() => setFilter(filter === k ? "all" : k)} title={M.label}
                className={cn("rounded-md p-2 text-center hover:bg-accent", filter === k && "bg-accent")}>
                <Icon className={cn("h-4 w-4 mx-auto", M.cls)} />
                <p className="text-lg font-bold leading-tight">{counts[k]}</p>
                <p className="text-[10px] leading-tight text-muted-foreground line-clamp-2">{M.label}</p>
              </button>
            );
          })}
        </div>
        <Tabs value={filter} onValueChange={setFilter} className="px-2 pt-2">
          <TabsList className="w-full"><TabsTrigger value="all" className="flex-1">Por atender</TabsTrigger><TabsTrigger value="pending" className="flex-1">Pendientes</TabsTrigger></TabsList>
        </Tabs>
        <ScrollArea className="h-[360px]">
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Sin novedades por atender</p>
          ) : list.map((n) => {
            const M = META[n.kind]; const Icon = M.icon;
            return (
              <button key={n.id + n.kind} onClick={() => go(n)} className="w-full text-left flex gap-3 px-4 py-3 border-b hover:bg-accent">
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", M.cls)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{ago(n.created_at)}</p>
                </div>
              </button>
            );
          })}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
