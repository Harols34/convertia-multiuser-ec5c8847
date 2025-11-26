import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, differenceInDays, differenceInMonths } from "date-fns";
import { es } from "date-fns/locale";
import { UserPlus, Calendar, TrendingUp, DollarSign, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserReferralsProps {
  userId: string;
  searchQuery?: string;
}

interface Referral {
  id: string;
  referred_document: string;
  referred_name: string;
  campaign: string | null;
  status: "iniciado" | "citado" | "seleccionado" | "capacitacion" | "contratado" | "finalizado" | "baja" | "activo";
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

export function UserReferrals({ userId, searchQuery = "" }: UserReferralsProps) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [bonusAmount, setBonusAmount] = useState(50000);
  const [minimumDays, setMinimumDays] = useState(30);
  const { toast } = useToast();

  useEffect(() => {
    loadReferrals();
    loadBonusConfig();
  }, [userId]);

  const loadBonusConfig = async () => {
    const { data: amountData } = await supabase
      .from("referral_config")
      .select("config_value")
      .eq("config_key", "bonus_amount")
      .single();

    if (amountData) {
      setBonusAmount(Number(amountData.config_value));
    }

    const { data: daysData } = await supabase
      .from("referral_config")
      .select("config_value")
      .eq("config_key", "minimum_days")
      .single();

    if (daysData) {
      setMinimumDays(Number(daysData.config_value));
    }
  };

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
    if (!referral.hire_date) return { days: 0, months: 0 };
    const hireDate = new Date(referral.hire_date);
    const endDate = (referral.status === "baja" || referral.status === "finalizado") && referral.termination_date
      ? new Date(referral.termination_date)
      : new Date();

    const days = differenceInDays(endDate, hireDate);
    const months = differenceInMonths(endDate, hireDate);

    return { days, months };
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "contratado":
      case "activo":
        return "default";
      case "baja":
      case "finalizado":
        return "destructive";
      case "seleccionado":
      case "capacitacion":
        return "secondary"; // Using secondary for intermediate positive states
      default:
        return "outline";
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Helper to ensure array
  const getBonuses = (r: any) => {
    if (Array.isArray(r.referral_bonuses)) return r.referral_bonuses;
    if (r.referral_bonuses) return [r.referral_bonuses];
    return [];
  };

  const filteredReferrals = referrals.filter(r => {
    const query = searchQuery.toLowerCase();
    return (
      r.referred_name.toLowerCase().includes(query) ||
      r.referred_document.toLowerCase().includes(query) ||
      (r.campaign && r.campaign.toLowerCase().includes(query)) ||
      r.status.toLowerCase().includes(query)
    );
  });

  if (filteredReferrals.length === 0 && referrals.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <UserPlus className="h-12 w-12 mb-4" />
          <p>No tienes referidos registrados</p>
        </CardContent>
      </Card>
    );
  }

  const activeReferrals = filteredReferrals.filter(r =>
    ["iniciado", "citado", "seleccionado", "capacitacion", "contratado", "activo"].includes(r.status)
  ).length;

  const pendingBonuses = filteredReferrals.filter(r => {
    const bonuses = getBonuses(r);
    const hasPending = bonuses.some((b: any) => b.status?.toLowerCase() === "pendiente");
    const hasPaid = bonuses.some((b: any) => b.status?.toLowerCase() === "pagado");

    if (hasPending) return true;
    if (hasPaid) return false;

    return ["contratado", "activo"].includes(r.status);
  }).length;

  const paidBonuses = filteredReferrals.filter(r =>
    getBonuses(r).some((b: any) => b.status?.toLowerCase() === "pagado")
  ).length;

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
        {filteredReferrals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No se encontraron referidos con ese criterio
          </div>
        ) : (
          filteredReferrals.map((referral) => {
            const time = calculateTime(referral);
            const bonuses = getBonuses(referral);
            const bonus = bonuses.length > 0 ? bonuses[0] : null;

            return (
              <Card key={referral.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{referral.referred_name}</CardTitle>
                      <CardDescription>Documento: {referral.referred_document}</CardDescription>
                    </div>
                    <Badge variant={getStatusBadgeVariant(referral.status)}>
                      {formatStatus(referral.status)}
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

                    {(bonus || ["contratado", "activo"].includes(referral.status)) && (
                      <div>
                        <div className="text-muted-foreground mb-1">Estado del Bono</div>
                        <div className="flex items-center gap-2">
                          {bonus?.status === "pagado" ? (
                            <>
                              <Badge variant="default">Pagado</Badge>
                              {bonus.paid_date && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(bonus.paid_date), "dd/MM/yyyy")}
                                </div>
                              )}
                            </>
                          ) : (
                            <Badge variant={time.days >= minimumDays ? "default" : "destructive"}>
                              {time.days >= minimumDays ? "Cumple" : "No Cumple"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {(bonus || ["contratado", "activo"].includes(referral.status)) && (
                    <div className="pt-3 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Valor del bono:</span>
                        <span className="text-lg font-bold text-primary">
                          ${(bonus?.status === "pagado" ? (bonus?.bonus_amount || bonusAmount) : 0).toLocaleString('es-CO')}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
