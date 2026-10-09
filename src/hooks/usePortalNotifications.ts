import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PortalNotif = {
  id: string;
  module: "history" | "chat";
  alarmId?: string;
  title: string;
  body: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  abierta: "Abierta", en_proceso: "En gestión", pendiente_informacion: "Pendiente de información",
  resuelta: "Resuelta", cerrada: "Cerrada",
};

type Seen = { history: string; chat: string; dismissed: string[] };
const key = (id: string) => `portal_notif_seen_${id}`;
const readSeen = (id: string): Seen => {
  try {
    const v = JSON.parse(localStorage.getItem(key(id)) || "null");
    if (v) return { dismissed: [], ...v };
  } catch {}
  // Primera vez: solo lo de los últimos 7 días cuenta como nuevo
  const base = new Date(Date.now() - 7 * 864e5).toISOString();
  return { history: base, chat: base, dismissed: [] };
};

/** Notificaciones independientes por usuario del portal (comentarios, cambios de estado, chat). */
export function usePortalNotifications(endUserId?: string, alarms: { id: string; title: string }[] = []) {
  const [items, setItems] = useState<PortalNotif[]>([]);
  const [seen, setSeen] = useState<Seen | null>(null);
  const alarmIds = useMemo(() => alarms.map((a) => a.id).sort().join(","), [alarms]);

  useEffect(() => { if (endUserId) setSeen(readSeen(endUserId)); }, [endUserId]);

  const load = useCallback(async () => {
    if (!endUserId) return;
    const ids = alarmIds ? alarmIds.split(",") : [];
    const titles = new Map(alarms.map((a) => [a.id, a.title]));
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const out: PortalNotif[] = [];
    if (ids.length) {
      const [{ data: comments }, { data: events }] = await Promise.all([
        supabase.from("alarm_comments").select("id, alarm_id, comment, author_name, created_at, attachment_name")
          .in("alarm_id", ids).eq("author_type", "admin").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
        supabase.from("alarm_events").select("id, alarm_id, event_type, new_value, actor_name, created_at")
          .in("alarm_id", ids).in("event_type", ["status", "assigned"]).gte("created_at", since).order("created_at", { ascending: false }).limit(200),
      ]);
      (comments || []).forEach((c: any) => out.push({
        id: `c-${c.id}`, module: "history", alarmId: c.alarm_id, created_at: c.created_at,
        title: `Nuevo mensaje en "${titles.get(c.alarm_id) ?? "tu caso"}"`,
        body: `${c.author_name || "Administrador"}: ${c.comment || c.attachment_name || "Archivo adjunto"}`,
      }));
      (events || []).forEach((e: any) => out.push({
        id: `e-${e.id}`, module: "history", alarmId: e.alarm_id, created_at: e.created_at,
        title: `Actualización en "${titles.get(e.alarm_id) ?? "tu caso"}"`,
        body: e.event_type === "status" ? `Estado: ${STATUS_LABEL[e.new_value] ?? e.new_value}` : `Asignado a ${e.new_value ?? "un responsable"}`,
      }));
    }
    const { data: chats } = await supabase.from("chat_messages").select("id, message, created_at, attachment_name")
      .eq("end_user_id", endUserId).eq("sender_type", "admin").gte("created_at", since).order("created_at", { ascending: false }).limit(100);
    (chats || []).forEach((m: any) => out.push({
      id: `m-${m.id}`, module: "chat", created_at: m.created_at,
      title: "Nuevo mensaje en el Chat", body: m.message || m.attachment_name || "Archivo adjunto",
    }));
    out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    setItems((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out));
  }, [endUserId, alarmIds]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!endUserId) return;
    load();
    const ch = supabase.channel(`portal-notif-${endUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alarm_comments" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alarm_events" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `end_user_id=eq.${endUserId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [endUserId, load]);

  const persist = (s: Seen) => { if (endUserId) localStorage.setItem(key(endUserId), JSON.stringify(s)); setSeen(s); };

  const unread = useMemo(() => {
    if (!seen) return [];
    return items.filter((i) => i.created_at > seen[i.module] && !seen.dismissed.includes(i.id));
  }, [items, seen]);

  const markModuleSeen = useCallback((module: "history" | "chat") => {
    if (!seen) return;
    persist({ ...seen, [module]: new Date().toISOString(), dismissed: seen.dismissed.slice(-200) });
  }, [seen]); // eslint-disable-line react-hooks/exhaustive-deps

  const markOne = (id: string) => seen && persist({ ...seen, dismissed: [...seen.dismissed, id].slice(-300) });
  const markAll = () => { const now = new Date().toISOString(); persist({ history: now, chat: now, dismissed: [] }); };

  const countByModule = {
    history: unread.filter((u) => u.module === "history").length,
    chat: unread.filter((u) => u.module === "chat").length,
  };
  return { items, unread, countByModule, markModuleSeen, markOne, markAll };
}
