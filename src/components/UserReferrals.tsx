import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, differenceInMonths } from "date-fns";
import { es } from "date-fns/locale";
import { UserPlus, Calendar, TrendingUp, DollarSign, CheckCircle } from "lucide-react";

interface UserReferralsProps {
  userId: string;
}

interface Referral {
  id: string;
  referred_document: string;
  referred_name: string;
  campaign: string | null;
  status: "activo" | "baja";
  hire_date: string;
  termination_date: string | null;
  referral_bonuses: Array<{
    id: string;
    bonus_amount: number;
    status: string;
    condition_met_date: string | null;
    paid_date: string | null;
  }>;
}

export function UserReferrals({ userId }: UserReferralsProps) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadReferrals();
  }, [userId]);

  const loadReferrals = async () => {
    try {
      const { data } = await supabase
        .from("referrals")
        .select("*, referral_bonuses(*)")
        .eq("referring_user_id", userId)
        .order("created_at", { ascending: false });

      setReferrals((data || []) as any);
    } catch (error) {
      console.error("Error loading referrals:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTime = (referral: Referral) => {
    const hireDate = new Date(referral.hire_date);
    const endDate = referral.status === "baja" && referral.termination_date
      ? new Date(referral.termination_date)
      : new Date();
    
    const days = differenceInDays(endDate, hireDate);
    const months = differenceInMonths(endDate, hireDate);
    
    return { days, months };
  };

  const markBonusAsPaid = async (bonusId: string) => {
    try {
      const { error } = await supabase
        .from("referral_bonuses")
        .update({
          status: "pagado",
          paid_date: format(new Date(), "yyyy-MM-dd"),
          paid_by: userId
        })
        .eq("id", bonusId);

      if (error) throw error;

      toast({
        title: "Bono marcado como pagado",
        description: "El bono se ha registrado correctamente"
      });

      loadReferrals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (referrals.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <UserPlus className="h-12 w-12 mb-4" />
          <p>No tienes referidos registrados</p>
        </CardContent>
      </Card>
    );
  }

  const activeReferrals = referrals.filter(r => r.status === "activo").length;
  const pendingBonuses = referrals.filter(r => r.referral_bonuses?.[0]?.status === "pendiente").length;
  const paidBonuses = referrals.filter(r => r.referral_bonuses?.[0]?.status === "pagado").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referidos Activos</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeReferrals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bonos Pendientes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingBonuses}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bonos Pagados</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidBonuses}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {referrals.map((referral) => {
          const time = calculateTime(referral);
          const bonus = referral.referral_bonuses?.[0];
          
          return (
            <Card key={referral.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{referral.referred_name}</CardTitle>
                    <CardDescription>Documento: {referral.referred_document}</CardDescription>
                  </div>
                  <Badge variant={referral.status === "activo" ? "default" : "secondary"}>
                    {referral.status === "activo" ? "Activo" : "Baja"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {referral.campaign && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Campaña:</span>
                    <span className="font-medium">{referral.campaign}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      Fecha de Ingreso
                    </div>
                    <div className="font-medium">
                      {format(new Date(referral.hire_date), "dd 'de' MMMM, yyyy", { locale: es })}
                    </div>
                  </div>
                  
                  {referral.status === "baja" && referral.termination_date && (
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        Fecha de Baja
                      </div>
                      <div className="font-medium">
                        {format(new Date(referral.termination_date), "dd 'de' MMMM, yyyy", { locale: es })}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <div className="text-muted-foreground mb-1">Tiempo</div>
                    <div className="font-medium">
                      {time.months} {time.months === 1 ? "mes" : "meses"} ({time.days} días)
                    </div>
                  </div>
                  
                  {bonus && (
                    <div>
                      <div className="text-muted-foreground mb-1">Estado del Bono</div>
                      <Badge variant={bonus.status === "pagado" ? "default" : "outline"}>
                        {bonus.status === "pagado" ? "Pagado" : "Pendiente"}
                      </Badge>
                      {bonus.status === "pagado" && bonus.paid_date && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Pagado: {format(new Date(bonus.paid_date), "dd/MM/yyyy")}
                        </div>
                      )}
                      {bonus.status === "pendiente" && bonus.condition_met_date && (
                        <div className="text-xs text-success mt-1">
                          ✓ Listo para pago desde {format(new Date(bonus.condition_met_date), "dd/MM/yyyy")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {bonus && (
                  <div className="pt-3 border-t space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Valor del bono:</span>
                      <span className="text-lg font-bold text-primary">
                        ${bonus.bonus_amount.toLocaleString('es-CO')}
                      </span>
                    </div>
                    
                    {bonus.status === "pendiente" && bonus.condition_met_date && (
                      <Button 
                        onClick={() => markBonusAsPaid(bonus.id)}
                        className="w-full"
                        size="sm"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Marcar Bono como Pagado
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
