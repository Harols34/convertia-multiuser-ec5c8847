import { supabase } from "@/integrations/supabase/client";

interface AccessLogParams {
    userId?: string;
    email?: string;
    role?: string;
    status: "success" | "failure" | "blocked";
    failureReason?: string;
}

interface ActivityLogParams {
    userId: string;
    role?: string;
    actionType: string;
    module: string;
    details?: any;
}

export const auditService = {
    async logAccess(params: AccessLogParams) {
        try {
            // Obtener datos del cliente (IP, User Agent)
            // Nota: En un entorno cliente, la IP puede no ser precisa o requerir un servicio externo.
            // Aquí usamos una llamada a un servicio público simple o dejamos que Supabase/Edge Functions lo manejen si fuera posible.
            // Para este MVP, intentaremos obtener la IP de un servicio público si es posible, o registrar null.

            let ipAddress = null;
            let location = null;

            try {
                const response = await fetch('https://api.ipify.org?format=json');
                const data = await response.json();
                ipAddress = data.ip;
            } catch (e) {
                console.warn("No se pudo obtener la IP:", e);
            }

            const userAgent = navigator.userAgent;

            await supabase.from("access_logs").insert({
                user_id: params.userId,
                email: params.email,
                role: params.role,
                status: params.status,
                failure_reason: params.failureReason,
                ip_address: ipAddress,
                user_agent: userAgent,
                location: location // Implementar geolocalización si se requiere más adelante
            });
        } catch (error) {
            console.error("Error logging access:", error);
        }
    },

    async logActivity(params: ActivityLogParams) {
        try {
            let ipAddress = null;
            try {
                const response = await fetch('https://api.ipify.org?format=json');
                const data = await response.json();
                ipAddress = data.ip;
            } catch (e) {
                // Silencioso para no interrumpir flujo
            }

            const userAgent = navigator.userAgent;

            await supabase.from("activity_logs").insert({
                user_id: params.userId,
                role: params.role,
                action_type: params.actionType,
                module: params.module,
                details: params.details,
                ip_address: ipAddress,
                user_agent: userAgent
            });
        } catch (error) {
            console.error("Error logging activity:", error);
        }
    }
};
