import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search } from "lucide-react";
import Chat from "@/components/Chat";

interface Conversation {
  endUserId: string;
  fullName: string;
  company: string;
  lastMessage: string;
  lastAt: string;
  lastSender: "user" | "admin";
}

export default function AdminChatPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();

    const channel = supabase
      .channel("admin-chat-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => loadConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadConversations = async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select(
        `end_user_id, message, created_at, sender_type,
         end_users ( full_name, companies ( name ) )`
      )
      .order("created_at", { ascending: false })
      .limit(1000);

    const map = new Map<string, Conversation>();
    (data || []).forEach((row: any) => {
      if (map.has(row.end_user_id)) return;
      map.set(row.end_user_id, {
        endUserId: row.end_user_id,
        fullName: row.end_users?.full_name || "Usuario",
        company: row.end_users?.companies?.name || "Sin empresa",
        lastMessage: row.message,
        lastAt: row.created_at,
        lastSender: row.sender_type,
      });
    });

    setConversations(Array.from(map.values()));
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const active = conversations.find((c) => c.endUserId === selected) || null;

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr] h-[calc(100vh-16rem)] min-h-[520px]">
      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 border-b space-y-2">
          <p className="font-semibold text-sm">Conversaciones</p>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar usuario o empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-visible">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No hay conversaciones.
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.endUserId}
                onClick={() => setSelected(c.endUserId)}
                className={`w-full text-left p-3 border-b hover:bg-muted transition-colors ${
                  selected === c.endUserId ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{c.fullName}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(c.lastAt).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{c.company}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">
                    {c.lastSender === "admin" ? "Soporte" : "Usuario"}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">
                    {c.lastMessage}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </Card>

      <div className="h-full min-h-0">
        {active ? (
          <Chat
            key={active.endUserId}
            endUserId={active.endUserId}
            isAdmin
            title={`Chat con ${active.fullName} · ${active.company}`}
            userName={active.fullName}
          />
        ) : (
          <Card className="h-full">
            <CardContent className="h-full flex flex-col items-center justify-center text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">Selecciona una conversación</h3>
              <p className="text-sm text-muted-foreground">
                Elige un usuario de la lista para ver y responder el chat.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
