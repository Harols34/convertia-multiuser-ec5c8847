import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Chat from "@/components/Chat";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

interface UserChatProps {
  accessCode?: string;
  userId?: string;
  userName?: string;
}

export default function UserChat({ accessCode, userId: propUserId, userName }: UserChatProps) {
  const [userId, setUserId] = useState<string | null>(propUserId || null);
  const [loading, setLoading] = useState(!propUserId);

  useEffect(() => {
    if (propUserId) {
      setUserId(propUserId);
      setLoading(false);
    } else if (accessCode) {
      loadUser();
    }
  }, [accessCode, propUserId]);

  const loadUser = async () => {
    const { data } = await supabase
      .from("end_users")
      .select("id")
      .eq("access_code", accessCode)
      .single();

    if (data) {
      setUserId(data.id);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!userId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Chat no disponible</h3>
          <p className="text-sm text-muted-foreground">
            No se pudo cargar el chat
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-[600px]">
      <Chat endUserId={userId} isAdmin={false} />
    </div>
  );
}
