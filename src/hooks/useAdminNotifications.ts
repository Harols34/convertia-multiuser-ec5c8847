import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Minutos tras los cuales algo visto pero no respondido vuelve a alertar */
export const SEEN_UNANSWERED_MINUTES = 30;

export type AdminNotif = {
  id: string;
  kind: "new_alarm" | "comment" | "chat" | "pending" | "seen_unanswered";
  title: string;
  body: string;
  created_at: string;
  link: string;
  refKey: string; // alarm:<id> | chat:<end_user_id>
};

type Seen = { refs: Record<string, string>; newAlarmsAt: string };
const key = (uid: string) => `admin_notif_seen_${uid}`;
const readSeen = (uid: string): Seen => {
  try { const v = JSON.parse(localStorage.getItem(key(uid)) || "null"); if (v) return v; } catch {}
  return { refs: {}, newAlarmsAt: new Date(Date.now() - 7 * 864e5).toISOString() };
};

/** Centro de novedades por administrador: cada admin lleva su propio registro de vistos. */
export function useAdminNotifications(userId?: string) {
  const [all, setAll] = useState<AdminNotif[]>([]);
  const [seen, setSeen] = useState<Seen | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => { if (userId) setSeen(readSeen(userId)); }, [userId]);

  const load = useCallback(async () => {
    const [{ data: alarms }, { data: comments }, { data: chats }] = await Promise.all([
      supabase.from("alarms").select("id, title, status, priority, created_at, assigned_to, end_users!alarms_end_user_id_fkey(full_name)")
        .in("status", ["abierta", "en_proceso", "pendiente_informacion"]).order("created_at", { ascending: false }).limit(500),
      supabase.from("alarm_comments").select("id, alarm_id, author_type, author_name, comment, attachment_name, created_at")
        .order("created_at", { ascending: false }).limit(1000),
      supabase.from("chat_messages").select("id, end_user_id, sender_type, message, attachment_name, created_at, end_users(full_name)")
        .order("created_at", { ascending: false }).limit(1000),
    ]);
    const out: AdminNotif[] = [];
    const openAlarms = new Map((alarms || []).map((a: any) => [a.id, a]));

    (alarms || []).forEach((a: any) => {
      const who = a.end_users?.full_name ?? "Usuario";
      out.push({
        id: `p-${a.id}`, kind: a.status === "abierta" && !a.assigned_to ? "new_alarm" : "pending",
        title: a.status === "abierta" && !a.assigned_to ? `Nueva novedad: ${a.title}` : `Pendiente: ${a.title}`,
        body: `${who} · ${a.status.replace("_", " ")}${a.priority ? ` · ${a.priority}` : ""}`,
        created_at: a.created_at, link: `/help-desk?alarm=${a.id}`, refKey: `alarm:${a.id}`,
      });
    });

    const lastByAlarm = new Map<string, any>();
    (comments || []).forEach((c: any) => { if (!lastByAlarm.has(c.alarm_id)) lastByAlarm.set(c.alarm_id, c); });
    lastByAlarm.forEach((c, alarmId) => {
      const a: any = openAlarms.get(alarmId);
      if (!a || c.author_type === "admin") return;
      out.push({
        id: `c-${c.id}`, kind: "comment", title: `Comentario sin responder: ${a.title}`,
        body: `${c.author_name || "Usuario"}: ${c.comment || c.attachment_name || "Archivo"}`,
        created_at: c.created_at, link: `/help-desk?alarm=${alarmId}`, refKey: `alarm:${alarmId}`,
      });
    });

    const lastByUser = new Map<string, any>();
    (chats || []).forEach((m: any) => { if (!lastByUser.has(m.end_user_id)) lastByUser.set(m.end_user_id, m); });
    lastByUser.forEach((m, uid) => {
      if (m.sender_type === "admin") return;
      out.push({
        id: `m-${m.id}`, kind: "chat", title: `Chat sin responder: ${m.end_users?.full_name ?? "Usuario"}`,
        body: m.message || m.attachment_name || "Archivo", created_at: m.created_at,
        link: `/help-desk?tab=chat&user=${uid}`, refKey: `chat:${uid}`,
      });
    });
    out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    setAll((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out));
  }, []);

  useEffect(() => {
    if (!userId) return;
    load();
    const ch = supabase.channel(`admin-notif-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alarms" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alarm_comments" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => load())
      .subscribe();
    // Re-evalúa "visto sin responder" cada minuto
    const iv = setInterval(() => setTick((t) => t + 1), 60000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [userId, load]);

  const persist = (s: Seen) => { if (userId) localStorage.setItem(key(userId), JSON.stringify(s)); setSeen(s); };

  const view = useMemo(() => {
    const s = seen ?? { refs: {}, newAlarmsAt: "" };
    const limit = Date.now() - SEEN_UNANSWERED_MINUTES * 60000;
    const result: AdminNotif[] = [];
    all.forEach((n) => {
      if (n.kind === "pending") return result.push(n);
      const seenAt = s.refs[n.refKey];
      if (n.kind === "new_alarm" && !seenAt) return result.push(n);
      if (n.kind === "new_alarm") return result.push({ ...n, kind: "pending" });
      // comment / chat
      if (!seenAt || seenAt < n.created_at) return result.push(n);
      if (new Date(seenAt).getTime() < limit) {
        result.push({ ...n, kind: "seen_unanswered", title: n.title.replace("sin responder", "visto y sin responder") });
      }
    });
    return result;
  }, [all, seen, tick]);

  const counts = {
    new_alarm: view.filter((v) => v.kind === "new_alarm").length,
    comment: view.filter((v) => v.kind === "comment").length,
    chat: view.filter((v) => v.kind === "chat").length,
    pending: view.filter((v) => v.kind === "pending").length,
    seen_unanswered: view.filter((v) => v.kind === "seen_unanswered").length,
  };
  const urgent = counts.new_alarm + counts.comment + counts.chat + counts.seen_unanswered;

  const markSeen = (refKey: string) => seen && persist({ ...seen, refs: { ...seen.refs, [refKey]: new Date().toISOString() } });
  const markAllSeen = () => {
    if (!seen) return;
    const now = new Date().toISOString();
    const refs = { ...seen.refs };
    view.forEach((v) => { if (v.kind !== "pending" && v.kind !== "seen_unanswered") refs[v.refKey] = now; });
    persist({ refs, newAlarmsAt: now });
  };

  return { items: view, counts, urgent, markSeen, markAllSeen };
}
