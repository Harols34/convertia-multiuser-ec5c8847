import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, differenceInDays, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import Confetti from "react-confetti";
import { useToast } from "@/hooks/use-toast";
import { Search, Gift, Calendar, Clock, CheckCircle, XCircle, Users } from "lucide-react";

interface MyReferral {
    id: string;
    referred_name: string;
    referred_document: string;
    status: string;
    hire_date: string | null;
    probation_end_date: string | null;
    bonus_payment_date: string | null;
    referral_bonuses?: {
        status: string;
        bonus_amount: number;
    } | null;
}

export default function MyReferrals() {
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [referrals, setReferrals] = useState<MyReferral[]>([]);
    const [showConfetti, setShowConfetti] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        if (currentUser) {
            loadMyReferrals();
        } else {
            setReferrals([]);
        }
    }, [currentUser]);

    const loadUsers = async () => {
        const { data } = await supabase
            .from("end_users")
            .select("id, full_name, document_number")
            .eq("active", true)
            .order("full_name");
        setUsers(data || []);
    };

    const loadMyReferrals = async () => {
        const { data } = await supabase
            .from("referrals")
            .select(`
        id,
        referred_name,
        referred_document,
        status,
        hire_date,
        probation_end_date,
        bonus_payment_date,
        referral_bonuses(status, bonus_amount)
      `)
            .eq("referring_user_id", currentUser)
            .order("created_at", { ascending: false });

        if (data) {
            const formattedReferrals = data.map((r: any) => ({
                ...r,
                referral_bonuses: r.referral_bonuses?.[0] || null
            }));
            setReferrals(formattedReferrals);

            // Check for recent achievements to show confetti
            const hasNewBonus = formattedReferrals.some(r =>
                r.referral_bonuses?.status === "pagado" ||
                (r.status === "contratado" && r.probation_end_date && new Date(r.probation_end_date) <= new Date())
            );

            if (hasNewBonus) {
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 5000);
            }
        }
    };

    const calculateProgress = (hireDate: string | null) => {
        if (!hireDate) return 0;
        const start = new Date(hireDate);
        const end = addMonths(start, 3);
        const totalDays = differenceInDays(end, start);
        const daysPassed = differenceInDays(new Date(), start);

        const progress = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
        return progress;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "contratado": return "bg-green-500";
            case "seleccionado": return "bg-blue-500";
            case "baja":
            case "finalizado": return "bg-red-500";
            default: return "bg-gray-500";
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {showConfetti && <Confetti numberOfPieces={200} recycle={false} />}

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary">Mis Referidos</h1>
                    <p className="text-muted-foreground">Consulta el estado de tus referidos y bonificaciones</p>
                </div>

                <Card className="w-full md:w-auto p-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Soy:</span>
                        <Select value={currentUser || ""} onValueChange={setCurrentUser}>
                            <SelectTrigger className="w-[250px]">
                                <SelectValue placeholder="Selecciona tu usuario" />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map(u => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.full_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </Card>
            </div>

            {!currentUser ? (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <Search className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">Selecciona tu usuario</h3>
                    <p className="text-muted-foreground">Para ver tus referidos, por favor identifícate arriba.</p>
                </div>
            ) : referrals.length === 0 ? (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">No tienes referidos aún</h3>
                    <p className="text-muted-foreground">¡Empieza a referir talento para ganar bonos!</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {referrals.map((referral) => (
                        <Card key={referral.id} className="relative overflow-hidden transition-all hover:shadow-lg">
                            <div className={`absolute top-0 left-0 w-1 h-full ${getStatusColor(referral.status)}`} />
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg">{referral.referred_name}</CardTitle>
                                        <CardDescription>{referral.referred_document}</CardDescription>
                                    </div>
                                    <Badge variant={referral.status === "contratado" ? "default" : "secondary"}>
                                        {referral.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {referral.status === "contratado" && referral.hire_date ? (
                                    <>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Progreso para bono</span>
                                                <span className="font-medium">{Math.round(calculateProgress(referral.hire_date))}%</span>
                                            </div>
                                            <Progress value={calculateProgress(referral.hire_date)} className="h-2" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Calendar className="h-4 w-4" />
                                                <span>Contratado:</span>
                                            </div>
                                            <div className="font-medium">
                                                {format(new Date(referral.hire_date), "dd MMM yyyy", { locale: es })}
                                            </div>

                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Clock className="h-4 w-4" />
                                                <span>Pago estimado:</span>
                                            </div>
                                            <div className="font-medium">
                                                {referral.bonus_payment_date
                                                    ? format(new Date(referral.bonus_payment_date), "dd MMM yyyy", { locale: es })
                                                    : "Pendiente"}
                                            </div>
                                        </div>

                                        {referral.referral_bonuses?.status === "pagado" ? (
                                            <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                                                <Gift className="h-5 w-5" />
                                                <span className="font-medium">¡Bono Pagado!</span>
                                            </div>
                                        ) : calculateProgress(referral.hire_date) >= 100 ? (
                                            <div className="mt-4 p-3 bg-yellow-50 text-yellow-700 rounded-lg flex items-center gap-2">
                                                <CheckCircle className="h-5 w-5" />
                                                <span className="font-medium">¡Elegible para pago!</span>
                                            </div>
                                        ) : null}
                                    </>
                                ) : (
                                    <div className="py-4 text-center text-muted-foreground text-sm">
                                        {referral.status === "finalizado" || referral.status === "baja" ? (
                                            <div className="flex flex-col items-center gap-2 text-red-500">
                                                <XCircle className="h-8 w-8" />
                                                <span>Proceso finalizado</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <Clock className="h-8 w-8" />
                                                <span>En proceso de selección</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
