import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

interface WelcomeMessage {
  id: string;
  title: string;
  message: string;
  emoji: string | null;
}

export function WelcomeBanner({ userName }: { userName?: string }) {
  const [msg, setMsg] = useState<WelcomeMessage | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("welcome_messages")
        .select("id, title, message, emoji")
        .eq("active", true);
      if (!mounted || !data || data.length === 0) return;
      setMsg(data[Math.floor(Math.random() * data.length)]);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!msg) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-primary/95 via-primary to-accent text-primary-foreground shadow-lg">
      {/* tech grid + glow */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary-foreground)/0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground)/0.6) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="absolute -left-10 -bottom-24 h-48 w-48 rounded-full bg-primary-foreground/5 blur-3xl" />

      <div className="relative flex items-start gap-4 px-5 py-4 sm:px-7 sm:py-6">
        <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/10 ring-1 ring-primary-foreground/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg sm:text-2xl font-semibold tracking-tight">
            {msg.title}
            {userName ? `, ${userName.split(" ")[0]}` : ""} {msg.emoji}
          </h2>
          <p className="mt-1 text-sm sm:text-base text-primary-foreground/80 max-w-3xl">
            {msg.message}
          </p>
        </div>
      </div>
      <div className="relative h-1 w-full bg-gradient-to-r from-primary-foreground/40 via-primary-foreground/10 to-transparent" />
    </div>
  );
}

export default WelcomeBanner;
