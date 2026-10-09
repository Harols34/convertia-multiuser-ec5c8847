import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Send, X, Loader2 } from "lucide-react";
import ChatAttachment from "@/components/ChatAttachment";
import { toast } from "sonner";

interface Props {
  alarmId: string;
  /** "admin" when used from the admin panel */
  mode: "admin" | "portal";
  authorName: string;
  authorType?: string; // portal: "staff" | "user"
  endUserId?: string;
  disabled?: boolean;
  height?: string;
}

export default function AlarmCaseChat({ alarmId, mode, authorName, authorType, endUserId, disabled, height = "360px" }: Props) {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await (supabase as any).from("alarm_comments").select("*").eq("alarm_id", alarmId).order("created_at");
    setMsgs(data ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`case-chat-${alarmId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alarm_comments", filter: `alarm_id=eq.${alarmId}` }, (p: any) => {
        setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new]));
      })
      .subscribe();
    const iv = setInterval(() => document.visibilityState === "visible" && load(), 20000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [alarmId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length]);

  const isMine = (m: any) => (mode === "admin" ? m.author_type === "admin" || !m.author_type : m.end_user_id === endUserId);

  const send = async () => {
    if ((!text.trim() && !file) || sending) return;
    setSending(true);
    let att: any = {};
    if (file) {
      const path = `cases/${alarmId}/${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
      if (error) { toast.error("No se pudo subir el archivo"); setSending(false); return; }
      att = { attachment_url: path, attachment_name: file.name, attachment_type: file.type };
    }
    const userId = mode === "admin" ? (await supabase.auth.getUser()).data.user?.id : null;
    const { data, error } = await (supabase as any).from("alarm_comments").insert({
      alarm_id: alarmId,
      comment: text.trim() || "(Archivo adjunto)",
      author_type: mode === "admin" ? "admin" : authorType ?? "user",
      author_name: authorName,
      end_user_id: mode === "portal" ? endUserId : null,
      user_id: userId,
      ...att,
    }).select().maybeSingle();
    setSending(false);
    if (error) { toast.error("No se pudo enviar", { description: error.message }); return; }
    if (data) setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
    else load();
    setText(""); setFile(null);
  };

  return (
    <div className="flex flex-col rounded-lg border bg-background">
      <div className="overflow-y-auto scrollbar-visible p-3 space-y-2" style={{ height }}>
        {msgs.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Aún no hay mensajes en este caso.</p>}
        {msgs.map((m) => {
          const mine = isMine(m);
          const who = m.author_name ?? (m.author_type === "admin" || !m.author_type ? "Administrador" : m.author_type === "bot" ? "C-IA" : "Usuario");
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                <p className="text-[11px] font-semibold opacity-80">{who}{m.author_type === "admin" ? " · Administrador" : ""}</p>
                {m.attachment_url && <div className="my-1"><ChatAttachment attachmentUrl={m.attachment_url} attachmentName={m.attachment_name} attachmentType={m.attachment_type} /></div>}
                {m.comment !== "(Archivo adjunto)" && <p className="text-sm whitespace-pre-wrap">{m.comment}</p>}
                <p className="text-[10px] opacity-70 mt-1 text-right">{new Date(m.created_at).toLocaleString("es-ES")}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {!disabled && (
        <div className="border-t p-2 space-y-2">
          {file && (
            <div className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
              <Paperclip className="h-3 w-3" /><span className="truncate flex-1">{file.name}</span>
              <button onClick={() => setFile(null)} aria-label="Quitar archivo"><X className="h-3 w-3" /></button>
            </div>
          )}
          <div className="flex gap-2">
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size > 20 * 1024 * 1024) { toast.error("Máximo 20MB"); return; } setFile(f ?? null); e.target.value = ""; }} />
            <Button type="button" size="icon" variant="outline" onClick={() => fileRef.current?.click()} aria-label="Adjuntar"><Paperclip className="h-4 w-4" /></Button>
            <Input placeholder="Escribe un mensaje sobre este caso..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()} />
            <Button size="icon" onClick={send} disabled={sending} aria-label="Enviar">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
