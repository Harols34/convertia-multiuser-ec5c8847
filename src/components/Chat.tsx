import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Paperclip, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ChatAttachment from "./ChatAttachment";

interface Message {
  id: string;
  sender_type: "user" | "admin";
  message: string;
  created_at: string;
  sender_id: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
}

interface ChatProps {
  endUserId: string;
  isAdmin?: boolean;
}

export default function Chat({ endUserId, isAdmin = false }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMessages();
    subscribeToMessages();
  }, [endUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("end_user_id", endUserId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`chat-${endUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `end_user_id=eq.${endUserId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedFile) return;

    setLoading(true);
    
    let attachmentUrl = null;
    let attachmentName = null;
    let attachmentType = null;

    // Upload file if selected
    if (selectedFile) {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${endUserId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(fileName, selectedFile);

      if (!uploadError) {
        attachmentUrl = fileName;
        attachmentName = selectedFile.name;
        attachmentType = selectedFile.type;
      }
    }

    const { error } = await supabase.from("chat_messages").insert([
      {
        end_user_id: endUserId,
        sender_type: isAdmin ? "admin" : "user",
        message: newMessage.trim() || "(Archivo adjunto)",
        sender_id: isAdmin ? (await supabase.auth.getUser()).data.user?.id : null,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        attachment_type: attachmentType,
      },
    ]);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    } else {
      setNewMessage("");
      setSelectedFile(null);
    }

    setLoading(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          setSelectedFile(blob);
          toast({
            title: "Imagen capturada",
            description: "Presiona enviar para compartir la captura",
          });
        }
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Chat {isAdmin ? "con Usuario" : "con Soporte"}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  (isAdmin && msg.sender_type === "admin") ||
                  (!isAdmin && msg.sender_type === "user")
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    (isAdmin && msg.sender_type === "admin") ||
                    (!isAdmin && msg.sender_type === "user")
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  
                  {msg.attachment_url && (
                    <div className="mt-2">
                      <ChatAttachment
                        attachmentUrl={msg.attachment_url}
                        attachmentName={msg.attachment_name}
                        attachmentType={msg.attachment_type}
                      />
                    </div>
                  )}
                  
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t space-y-2">
          {selectedFile && (
            <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Paperclip className="h-3 w-3" />
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onPaste={handlePaste}
              placeholder="Escribe un mensaje o pega una captura..."
              disabled={loading}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={loading || (!newMessage.trim() && !selectedFile)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
