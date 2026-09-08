import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface WelcomeMessage {
  id: string;
  title: string;
  message: string;
  emoji: string | null;
}

function useWelcomeMessage() {
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

  return msg;
}

/* Moving aura layers — soft colored glows drifting over a white card */
function Aura() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      {/* rotating conic sheen */}
      <div className="absolute left-1/2 top-1/2 h-[250%] w-[250%] -translate-x-1/2 -translate-y-1/2">
        <div
          className="animate-aura-spin h-full w-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, hsl(var(--info) / 0.14) 60deg, transparent 130deg, hsl(var(--primary) / 0.08) 200deg, transparent 270deg, hsl(var(--warning) / 0.12) 320deg, transparent 360deg)",
          }}
        />
      </div>
      {/* drifting glow blobs */}
      <div className="animate-aura-1 absolute left-[-15%] top-[15%] h-24 w-48 rounded-full bg-info/20 blur-2xl" />
      <div className="animate-aura-2 absolute right-[-10%] bottom-[-45%] h-24 w-52 rounded-full bg-primary/10 blur-2xl" />
      <div className="animate-aura-3 absolute left-[45%] top-[-35%] h-16 w-32 rounded-full bg-warning/20 blur-2xl" />
    </div>
  );
}

/** Compact variant: sits inline beside the module title in the top bar */
export function WelcomeBanner({ userName, compact }: { userName?: string; compact?: boolean }) {
  const msg = useWelcomeMessage();
  if (!msg) return null;

  const heading = `${msg.title}${userName ? `, ${userName.split(" ")[0]}` : ""} ${msg.emoji ?? ""}`;

  if (compact) {
    return (
      <div className="relative h-10 w-full overflow-hidden rounded-xl border border-border/60 bg-card text-foreground shadow-sm">
        <Aura />
        <div className="relative flex h-full items-center gap-2.5 px-4">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold tracking-tight">{heading}</span>
          <span className="hidden truncate text-xs text-muted-foreground lg:inline">
            — {msg.message}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card text-foreground shadow-lg">
      <Aura />
      <div className="relative flex items-start gap-4 px-5 py-4 sm:px-7 sm:py-6">
        <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/5 ring-1 ring-primary/15">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg sm:text-2xl font-semibold tracking-tight">{heading}</h2>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground max-w-3xl">
            {msg.message}
          </p>
        </div>
      </div>
      <div className="relative h-1 w-full bg-gradient-to-r from-primary/40 via-primary/10 to-transparent" />
    </div>
  );
}

export default WelcomeBanner;
